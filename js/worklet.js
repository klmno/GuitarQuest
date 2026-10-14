/*
 * GuitarQuest: analysis AudioWorklet (grown from the Phase 0 test page).
 *
 * Loaded as an ordinary <script>. The body of guitarQuestWorklet() is turned into
 * a Blob module for audioWorklet.addModule(), so the page also works from file://
 * (addModule with a file:// URL is blocked by CORS in Chromium).
 *
 * Per render quantum it does:
 *   - level metering (peak, RMS, clipped samples)                      REQ-DET-7
 *   - onset detection from the energy of the first difference          REQ-DET-2
 *   - 55 Hz high-pass, anti-alias low-pass, decimation to ~24 kHz
 *   - YIN pitch detection every ~5 ms while the gate is open           REQ-DET-1
 *   - a small note tracker: onset -> first stable pitch = "note"       REQ-DET-3
 *   - noise-floor measurement on request                               REQ-DET-7
 *   - a 12-bin chroma vector over the 150 ms after each onset           REQ-DET-5
 *   - the level decay after each onset (short decay = palm mute)       REQ-DET-10
 *   - notes still ringing when a new note is picked are cancelled with comb filters tuned to
 *     their periods before the new pitch is measured, and the chroma of a new strum uses only
 *     the energy that the strum added (positive spectral difference)
 *
 * Input processing options (Settings > Guitar input > Note detection; setOptions message):
 *   hum      0 | 50 | 60    notch filters at the mains frequency and its first harmonics
 *   onset    'flux'         new notes from the SuperFlux onset function (Böck & Widmer, DAFx-13): log
 *                           quarter-tone spectrum, positive change against a maximum-filtered frame two
 *                           hops back, online peak picking. Reacts to the new note's own partials,
 *                           so it still finds a soft note picked while louder ones ring.
 *            'energy'       the jump in first-difference energy (the original detector)
 *   sens     'low' | 'normal' | 'high'      onset threshold
 *   ring     'off' | 'normal' | 'strong'    how many ringing notes are cancelled, and for how long
 *   pitchLp  true | false   1.5 kHz low-pass before YIN (fewer octave errors on bright or driven tone)
 *   confirm  2 | 3          readings that must agree before a note is reported
 */
function guitarQuestWorklet() {
  'use strict';

  // ---------- small DSP helpers ----------
  class Biquad {
    constructor(c) { this.c = c; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
    run(x) {
      const c = this.c;
      const y = c.b0 * x + c.b1 * this.x1 + c.b2 * this.x2 - c.a1 * this.y1 - c.a2 * this.y2;
      this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
      return y;
    }
  }
  function rbj(type, fc, fs, q) {
    const w = 2 * Math.PI * fc / fs, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
    else if (type === 'notch') { b0 = 1; b1 = -2 * cw; b2 = 1; }
    else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * cw / a0, a2: (1 - al) / a0 };
  }
  const FLUX_DELTA = { low: 2, normal: 1.2, high: 0.8 };   // onset threshold on the SuperFlux function (calibrated by tests/detect-bench.js)
  const DEFAULT_OPTS = { hum: 0, onset: 'flux', sens: 'normal', ring: 'normal', pitchLp: false, confirm: 2 };
  const toDb = (lin) => (lin > 1e-9 ? 20 * Math.log10(lin) : -180);
  const toMidi = (f) => 69 + 12 * Math.log2(f / 440);

  class GuitarInputProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = (options && options.processorOptions) || {};
      this.sr = sampleRate;
      this.dec = Math.max(1, Math.round(sampleRate / 24000));
      this.srd = sampleRate / this.dec;

      // filters (input rate)
      this.hp = new Biquad(rbj('hp', 55, this.sr, 0.707));
      const lpf = Math.min(5000, 0.4 * this.srd);
      this.lp1 = new Biquad(rbj('lp', lpf, this.sr, 0.541));
      this.lp2 = new Biquad(rbj('lp', lpf, this.sr, 1.307));
      this.decPhase = 0;

      // YIN setup (decimated rate)
      this.minF = o.minFreq || 70;     // below drop-D D2 (73.4 Hz)
      this.maxF = o.maxFreq || 1400;   // above E6 (1318.5 Hz)
      this.tauMax = Math.ceil(this.srd / this.minF);
      this.tauMin = Math.max(2, Math.floor(this.srd / this.maxF));
      this.W = 384;                                  // ~16 ms integration window (shorter = faster first pitch)
      this.frameLen = this.W + this.tauMax + 2;
      this.ringSize = 4096;
      this.ring = new Float32Array(this.ringSize);
      this.ringPos = 0;
      this.frame = new Float32Array(this.frameLen);
      this.d = new Float32Array(this.tauMax + 2);
      this.hopDec = 128;                             // analysis every 128 decimated samples (~5.3 ms)
      this.sinceHop = 0;
      this.yinThresh = o.yinThreshold || 0.15;
      this.decWritten = 0;

      // gate / level
      this.gateDb = o.gateDb != null ? o.gateDb : -55;
      this.gateLin = Math.pow(10, this.gateDb / 20);
      this.channelMode = 'mix';
      this.lvPeak = 0; this.lvSq = 0; this.lvN = 0; this.lvClip = 0;
      this.reportEvery = 1024; this.sinceReport = 0;
      this.floorMeasure = null;

      // onset detector
      this.prevX = 0;
      this.hist = new Float32Array(8); this.histPos = 0; this.histFill = 0;
      this.lastOnsetFrame = -1e9;
      this.refractory = Math.round(0.08 * this.sr);
      this.recentRms = 0;

      // note tracker
      this.confMin = o.confMin || 0.8;
      this.awaiting = false;       // onset seen, waiting for stable pitch
      this.onsetFrame = 0;
      this.prevEst = null;         // previous accepted post-onset estimate (midi)
      this.curMidi = null;         // midi of the note currently sounding
      this.legatoRun = 0; this.legatoMidi = 0;
      this.gateOpen = false;
      this.lastPitch = null;       // {f, conf, frame}
      this.analyses = 0;

      // chroma after onset (REQ-DET-5): 150 ms of decimated signal, Hann window, 4096-point FFT
      this.fftN = 4096;
      this.chromaN = Math.min(this.fftN, Math.round(0.15 * this.srd));
      this.chromaBuf = new Float32Array(this.fftN);
      this.chromaPos = -1;
      this.re = new Float64Array(this.fftN); this.im = new Float64Array(this.fftN);
      this.hann = new Float32Array(this.chromaN);
      for (let i = 0; i < this.chromaN; i++) this.hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.chromaN - 1));
      this.binPc = new Int8Array(this.fftN / 2).fill(-1);
      for (let k = 1; k < this.fftN / 2; k++) {
        const f = k * this.srd / this.fftN;
        if (f >= 95 && f <= 1300) this.binPc[k] = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
      }
      this.rev = new Uint16Array(this.fftN);
      const bits = Math.log2(this.fftN);
      for (let i = 0; i < this.fftN; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); this.rev[i] = r; }
      this.envEarly = 0; this.envLate = 0; this.envLateN = 0;

      // ringing-note cancellation
      this.recent = [];                 // recent stable notes {period (decimated samples), frame}
      this.cancel = [];                 // periods to cancel after the latest onset
      this.cancelAt = -1e12; this.cancelFor = Math.round(2.5 * this.sr);
      this.MAXC = 3; this.combGain = 0.98; this.preSub = 0.7;
      this.ext = new Float32Array(this.frameLen + 5 * (this.tauMax + 3));
      this.ext2 = new Float32Array(this.ext.length);
      this.frameC = new Float32Array(this.frameLen);
      this.preMag = new Float32Array(this.fftN / 2); this.hasPre = false;

      // low-passed copy of the decimated signal for pitch detection (pitchLp)
      this.ringP = new Float32Array(this.ringSize);
      this.agree = 0;
      // recent block energies (first difference), to place a spectral-flux onset on the attack
      this.blockE = new Float32Array(16); this.blockF = new Float64Array(16); this.blockPos = 0;
      // spectral flux: 1024-point frames (~43 ms) every hop, quarter-tone filterbank 60 Hz .. 5 kHz
      const FN = (this.fluxN = 1024);
      this.fre = new Float64Array(FN); this.fim = new Float64Array(FN);
      this.fwin = new Float32Array(FN); for (let i = 0; i < FN; i++) this.fwin[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FN - 1));
      this.frev = new Uint16Array(FN);
      for (let i = 0, bits = Math.log2(FN); i < FN; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); this.frev[i] = r; }
      this.fcos = new Float64Array(FN / 2); this.fsin = new Float64Array(FN / 2);
      for (let k = 0; k < FN / 2; k++) { this.fcos[k] = Math.cos(-2 * Math.PI * k / FN); this.fsin[k] = Math.sin(-2 * Math.PI * k / FN); }
      const binHz = this.srd / FN, centres = [];
      for (let f = 60; f <= Math.min(5000, 0.45 * this.srd); f *= Math.pow(2, 1 / 24)) {
        const c = Math.round(f / binHz);
        if (!centres.length || c > centres[centres.length - 1]) centres.push(c);
      }
      this.bands = [];   // triangular filters, not normalised (as in the paper): [{k0, w: Float32Array}]
      for (let m = 1; m < centres.length - 1; m++) {
        const lo = centres[m - 1], c = centres[m], hi = centres[m + 1], w = new Float32Array(hi - lo + 1);
        for (let k = lo; k <= hi; k++) w[k - lo] = k <= c ? (k - lo) / Math.max(1, c - lo) : (hi - k) / Math.max(1, hi - c);
        this.bands.push({ k0: lo, w });
      }
      this.fluxMu = 2;                                   // compare with the frame two hops back
      this.fluxFrames = [0, 1, 2].map(() => new Float32Array(this.bands.length)); this.fluxCount = 0;
      this.sfHist = new Float32Array(19); this.sfPos = 0; this.sfFill = 0;   // ~100 ms of onset function
      this.fluxPreMax = 6;                               // ~30 ms: the peak must be the largest so far
      this.mags1k = new Float32Array(FN / 2);
      this.setOptions(Object.assign({}, DEFAULT_OPTS, o.opts || {}));

      this.port.onmessage = (e) => this.onMsg(e.data);
    }

    setOptions(op) {
      const o = (this.opt = Object.assign({}, this.opt || DEFAULT_OPTS, op || {}));
      const hz = +o.hum || 0;
      this.notches = hz ? [1, 2, 3, 4].map((k) => new Biquad(rbj('notch', hz * k, this.sr, 18))).filter((b, k) => hz * (k + 1) < 0.45 * this.sr) : [];
      this.plp = o.pitchLp ? new Biquad(rbj('lp', 1500, this.srd, 0.707)) : null;
      const R = { off: [0, 0, 0.98, 0], normal: [3, 2.5, 0.98, 0.7], strong: [5, 4, 0.99, 0.85] }[o.ring] || [3, 2.5, 0.98, 0.7];
      this.MAXC = R[0]; this.cancelFor = Math.round(R[1] * this.sr); this.combGain = R[2]; this.preSub = R[3];
      this.confirmN = +o.confirm === 3 ? 3 : 2;
      this.fluxDelta = { low: FLUX_DELTA.low, normal: FLUX_DELTA.normal, high: FLUX_DELTA.high }[o.sens] || FLUX_DELTA.normal;
      this.energyK = { low: 6, normal: 4, high: 2.8 }[o.sens] || 4;
      if (o.fluxDelta) this.fluxDelta = o.fluxDelta;   // for tests/detect-bench.js
    }

    onMsg(m) {
      if (m.type === 'setGate') { this.gateDb = m.db; this.gateLin = Math.pow(10, m.db / 20); }
      else if (m.type === 'setChannel') this.channelMode = m.mode;
      else if (m.type === 'setConfMin') this.confMin = m.value;
      else if (m.type === 'setOptions') this.setOptions(m.opts);
      else if (m.type === 'measureFloor') {
        // Goertzel filters at 50/100/150 and 60/120/180 Hz find mains hum in the quiet signal
        const fs = [50, 100, 150, 60, 120, 180];
        const chain = (hz) => [1, 2, 3, 4].filter((k) => hz * k < 0.45 * this.sr).map((k) => new Biquad(rbj('notch', hz * k, this.sr, 18)));
        this.floorMeasure = { left: Math.round((m.seconds || 2) * this.sr), sq: 0, n: 0, peak: 0,
          coef: fs.map((f) => 2 * Math.cos(2 * Math.PI * f / this.sr)), s1: new Float64Array(6), s2: new Float64Array(6),
          // the noise as it would be with each hum filter, so the gate can be set for the filtered signal
          f50: chain(50), f60: chain(60), sq50: 0, pk50: 0, sq60: 0, pk60: 0 };
      }
    }

    process(inputs) {
      const inp = inputs[0];
      if (!inp || inp.length === 0 || !inp[0]) return true;
      const n = inp[0].length;
      const L = inp[0], R = inp.length > 1 ? inp[1] : null;
      const mode = this.channelMode;
      const blockStart = currentFrame;

      let peak = 0, sq = 0, clip = 0, dsq = 0, sqF = 0;   // sq: the input as it is (meter); sqF: after the hum filter (gate)
      let prev = this.prevX;
      for (let i = 0; i < n; i++) {
        let x;
        if (mode === 'left' || !R) x = L[i];
        else if (mode === 'right') x = R[i];
        else x = 0.5 * (L[i] + R[i]);
        const ax = x < 0 ? -x : x;
        if (ax > peak) peak = ax;
        if (ax >= 0.999) clip++;
        sq += x * x;
        const fmz = this.floorMeasure;
        if (fmz) {
          for (let g = 0; g < 6; g++) { const v = x + fmz.coef[g] * fmz.s1[g] - fmz.s2[g]; fmz.s2[g] = fmz.s1[g]; fmz.s1[g] = v; }
          let a = x, b = x;
          for (const f of fmz.f50) a = f.run(a);
          for (const f of fmz.f60) b = f.run(b);
          fmz.sq50 += a * a; fmz.sq60 += b * b;
          if (Math.abs(a) > fmz.pk50) fmz.pk50 = Math.abs(a);
          if (Math.abs(b) > fmz.pk60) fmz.pk60 = Math.abs(b);
        }
        for (let k = 0; k < this.notches.length; k++) x = this.notches[k].run(x);
        sqF += x * x;

        const h = this.hp.run(x);
        const dx = h - prev; prev = h; dsq += dx * dx;

        const y = this.lp2.run(this.lp1.run(h));
        if (++this.decPhase >= this.dec) {
          this.decPhase = 0;
          this.ring[this.ringPos] = y;
          this.ringP[this.ringPos] = this.plp ? this.plp.run(y) : y;
          if (this.chromaPos >= 0) {
            this.chromaBuf[this.chromaPos++] = y;
            if (this.chromaPos >= this.chromaN) this.finishChroma();
          }
          this.ringPos = (this.ringPos + 1) & (this.ringSize - 1);
          this.decWritten++;
          if (++this.sinceHop >= this.hopDec) {
            this.sinceHop = 0;
            // frame index (input rate) of the newest sample in the analysis window
            if (this.opt.onset === 'flux') this.fluxHop(blockStart + i + 1);
            this.analyse(blockStart + i + 1);
          }
        }
      }
      this.prevX = prev;

      // level accumulation
      if (peak > this.lvPeak) this.lvPeak = peak;
      this.lvSq += sq; this.lvN += n; this.lvClip += clip;
      const blockRms = Math.sqrt(sqF / n);
      this.recentRms = blockRms;
      // envelope after the last onset: peak in the first 60 ms, mean in 120-150 ms
      const since = blockStart - this.lastOnsetFrame;
      if (since >= 0 && since < 0.06 * this.sr) { if (blockRms > this.envEarly) this.envEarly = blockRms; }
      else if (since >= 0.12 * this.sr && since < 0.15 * this.sr) { this.envLate += blockRms; this.envLateN++; }

      // noise floor measurement
      if (this.floorMeasure) {
        const fm = this.floorMeasure;
        fm.sq += sq; fm.n += n; if (peak > fm.peak) fm.peak = peak; fm.left -= n;
        if (fm.left <= 0) {
          const rmsDb = toDb(Math.sqrt(fm.sq / fm.n));
          // hum: the power at the mains frequencies against all the noise
          const pw = fm.s1.map((v, g) => Math.max(0, v * v + fm.s2[g] * fm.s2[g] - fm.coef[g] * v * fm.s2[g]) * 2 / (fm.n * fm.n));
          const p50 = pw[0] + pw[1] + pw[2], p60 = pw[3] + pw[4] + pw[5], all = fm.sq / fm.n;
          const humHz = Math.max(p50, p60) > 0.2 * all && Math.max(p50, p60) > 1e-12 ? (p50 > p60 ? 50 : 60) : 0;
          this.port.postMessage({ type: 'floor', rmsDb, peakDb: toDb(fm.peak), humHz, humShare: all > 0 ? Math.max(p50, p60) / all : 0,
            with50: { rmsDb: toDb(Math.sqrt(fm.sq50 / fm.n)), peakDb: toDb(fm.pk50) }, with60: { rmsDb: toDb(Math.sqrt(fm.sq60 / fm.n)), peakDb: toDb(fm.pk60) } });
          this.floorMeasure = null;
        }
      }

      // onset detection on first-difference energy
      const e = dsq / n;
      this.blockE[this.blockPos] = e; this.blockF[this.blockPos] = blockStart; this.blockPos = (this.blockPos + 1) & 15;
      let mean = 0;
      for (let k = 0; k < this.histFill; k++) mean += this.hist[k];
      mean = this.histFill ? mean / this.histFill : 0;
      if (this.opt.onset !== 'flux' && this.histFill >= 4 && blockRms > this.gateLin && e > this.energyK * mean + 1e-10 &&
          blockStart - this.lastOnsetFrame > this.refractory) this.fireOnset(blockStart, blockRms, 0);
      this.hist[this.histPos] = e; this.histPos = (this.histPos + 1) % this.hist.length;
      if (this.histFill < this.hist.length) this.histFill++;

      // unclear: onset but no stable pitch within 250 ms
      if (this.awaiting && blockStart - this.onsetFrame > 0.25 * this.sr) {
        this.awaiting = false;
        this.port.postMessage({ type: 'unclear', onsetFrame: this.onsetFrame, frame: blockStart });
      }

      // periodic report
      this.sinceReport += n;
      if (this.sinceReport >= this.reportEvery) {
        this.sinceReport = 0;
        this.port.postMessage({
          type: 'frame', frame: blockStart + n, time: (blockStart + n) / this.sr,
          peakDb: toDb(this.lvPeak), rmsDb: toDb(Math.sqrt(this.lvSq / Math.max(1, this.lvN))),
          clip: this.lvClip, gateOpen: this.gateOpen,
          pitch: this.lastPitch, analyses: this.analyses,
        });
        this.lvPeak = 0; this.lvSq = 0; this.lvN = 0; this.lvClip = 0;
      }
      return true;
    }

    // a new note starts at `frame`; `late` = decimated samples since then (the flux onset is found a little after the attack)
    fireOnset(frame, rms, late) {
      this.lastOnsetFrame = frame;
      this.onsetFrame = frame;
      this.awaiting = true;
      this.chromaPos = 0; this.chromaOnset = frame;
      this.recent = this.recent.filter((r) => frame - r.frame < 3 * this.sr);
      this.cancel = this.MAXC ? this.recent.slice(-this.MAXC).map((r) => r.period).filter((P) => this.stillRinging(P, late)) : [];
      this.cancelAt = frame;
      this.capturePre(late);
      this.envEarly = rms; this.envLate = 0; this.envLateN = 0;
      this.prevEst = null; this.agree = 0;
      this.port.postMessage({ type: 'onset', frame, time: frame / this.sr, rmsDb: toDb(rms) });
    }

    // SuperFlux onset function for the newest frame, with online peak picking
    fluxHop(frameNow) {
      const N = this.fluxN, mask = this.ringSize - 1;
      if (this.decWritten < N) return;
      const re = this.fre, im = this.fim, rev = this.frev, w = this.fwin;
      let p = (this.ringPos - N) & mask;
      for (let i = 0; i < N; i++) { re[rev[i]] = this.ring[p] * w[i]; im[rev[i]] = 0; p = (p + 1) & mask; }
      for (let size = 2; size <= N; size <<= 1) {
        const half = size >> 1, stride = N / size;
        for (let start = 0; start < N; start += size) {
          for (let k = 0; k < half; k++) {
            const wr = this.fcos[k * stride], wi = this.fsin[k * stride], i = start + k, j = i + half;
            const tr = wr * re[j] - wi * im[j], ti = wr * im[j] + wi * re[j];
            re[j] = re[i] - tr; im[j] = im[i] - ti; re[i] += tr; im[i] += ti;
          }
        }
      }
      const mags = this.mags1k;
      for (let k = 0; k < N / 2; k++) mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const B = this.bands.length, frames = this.fluxFrames;
      const cur = frames[this.fluxCount % 3], old = frames[(this.fluxCount + 1) % 3]; // old = two hops back
      for (let b = 0; b < B; b++) {
        const { k0, w: wt } = this.bands[b];
        let s = 0;
        for (let j = 0; j < wt.length; j++) s += mags[k0 + j] * wt[j];
        cur[b] = Math.log10(1 + s);
      }
      this.fluxCount++;
      if (this.fluxCount <= this.fluxMu) return;
      let sf = 0;
      for (let b = 0; b < B; b++) {
        const mx = Math.max(old[b], b > 0 ? old[b - 1] : 0, b + 1 < B ? old[b + 1] : 0);
        const d = cur[b] - mx;
        if (d > 0) sf += d;
      }
      // peak picking: the largest value of the last ~30 ms, above the ~100 ms mean by delta
      const H = this.sfHist, L = H.length;
      let mx = 0, sum = sf;
      for (let k = 1; k < Math.min(this.sfFill + 1, L); k++) {
        const v = H[(this.sfPos - k + L) % L];
        sum += v;
        if (k <= this.fluxPreMax && v > mx) mx = v;
      }
      const mean = sum / Math.min(this.sfFill + 1, L);
      H[this.sfPos] = sf; this.sfPos = (this.sfPos + 1) % L; if (this.sfFill < L) this.sfFill++;
      if (this.sfFill < 4 || sf < mx || sf < mean + this.fluxDelta) return;
      if (this.recentRms <= this.gateLin) return;
      // place the onset on the attack: the block whose energy rose most in the last ~35 ms
      let best = -1, rise = -Infinity;
      for (let k = 0; k < 15; k++) {
        const j = (this.blockPos - 1 - k) & 15, jp = (j - 1) & 15;
        if (frameNow - this.blockF[j] > 0.035 * this.sr) break;
        const r = this.blockE[j] - this.blockE[jp];
        if (r > rise) { rise = r; best = j; }
      }
      const frame = best >= 0 ? this.blockF[best] : frameNow - this.hopDec * this.dec / 2;
      if (frame - this.lastOnsetFrame <= this.refractory) return;
      this.fireOnset(frame, this.recentRms, Math.round((frameNow - frame) / this.dec));
    }

    // magnitude spectrum of the 150 ms before an onset: what was already ringing
    capturePre(late) {
      const n = this.chromaN, mask = this.ringSize - 1, skip = late || 0;
      if (this.decWritten < n + skip) { this.hasPre = false; return; }
      let p = (this.ringPos - n - skip) & mask;
      const buf = this.chromaBuf;
      for (let i = 0; i < n; i++) { buf[i] = this.ring[p]; p = (p + 1) & mask; }
      this.fftMag(this.preMag);
      this.hasPre = true;
    }
    fftMag(out) {
      const N = this.fftN, n = this.chromaN, re = this.re, im = this.im, rev = this.rev;
      for (let i = 0; i < N; i++) { const v = i < n ? this.chromaBuf[i] * this.hann[i] : 0; re[rev[i]] = v; im[rev[i]] = 0; }
      for (let size = 2; size <= N; size <<= 1) {
        const half = size >> 1, step = -2 * Math.PI / size;
        for (let start = 0; start < N; start += size) {
          for (let k = 0; k < half; k++) {
            const a = step * k, wr = Math.cos(a), wi = Math.sin(a);
            const i = start + k, j = i + half;
            const tr = wr * re[j] - wi * im[j], ti = wr * im[j] + wi * re[j];
            re[j] = re[i] - tr; im[j] = im[i] - ti; re[i] += tr; im[i] += ti;
          }
        }
      }
      for (let k = 0; k < N / 2; k++) out[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }

    finishChroma() {
      const N = this.fftN, n = this.chromaN, re = this.re, im = this.im, rev = this.rev;
      for (let i = 0; i < N; i++) { const v = i < n ? this.chromaBuf[i] * this.hann[i] : 0; re[rev[i]] = v; im[rev[i]] = 0; }
      for (let size = 2; size <= N; size <<= 1) {
        const half = size >> 1, step = -2 * Math.PI / size;
        for (let start = 0; start < N; start += size) {
          for (let k = 0; k < half; k++) {
            const a = step * k, wr = Math.cos(a), wi = Math.sin(a);
            const i = start + k, j = i + half;
            const tr = wr * re[j] - wi * im[j], ti = wr * im[j] + wi * re[j];
            re[j] = re[i] - tr; im[j] = im[i] - ti; re[i] += tr; im[i] += ti;
          }
        }
      }
      const chroma = new Array(12).fill(0);
      let total = 0;
      const mags = this.mags || (this.mags = new Float32Array(N / 2));
      for (let k = 0; k < N / 2; k++) mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      // keep only what the strum added, unless that removes almost everything (same chord again)
      if (this.hasPre && this.preSub > 0) {
        let all = 0, added = 0;
        const dif = this.dif || (this.dif = new Float32Array(N / 2));
        for (let k = 0; k < N / 2; k++) { const v = mags[k] - this.preSub * this.preMag[k]; dif[k] = v > 0 ? v : 0; all += mags[k]; added += dif[k]; }
        if (added > 0.3 * all) mags.set(dif);
      }
      for (let k = 2; k < N / 2 - 1; k++) {
        const pc = this.binPc[k];
        if (pc < 0) continue;
        const mag = mags[k];
        if (mag < mags[k - 1] || mag < mags[k + 1]) continue;   // spectral peaks only: less leakage
        // refine the peak frequency before assigning a pitch class
        const a = mags[k - 1], b = mag, c = mags[k + 1], den = a - 2 * b + c;
        const kk = den < 0 ? k + 0.5 * (a - c) / den : k;
        const f = kk * this.srd / N;
        const pcr = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
        chroma[pcr] += Math.sqrt(mag); total += mag;
      }
      const mx = Math.max(...chroma) || 1;
      for (let i = 0; i < 12; i++) chroma[i] /= mx;
      const late = this.envLateN ? this.envLate / this.envLateN : 0;
      const decayDb = toDb(late) - toDb(this.envEarly);
      this.chromaPos = -1;
      this.port.postMessage({ type: 'chroma', onsetFrame: this.chromaOnset, time: this.chromaOnset / this.sr, chroma,
        energy: total, decayDb, frame: currentFrame });
    }

    analyse(frameNow) {
      if (this.decWritten < this.frameLen) return;
      // linearise the newest frameLen samples
      const f = this.frame, len = this.frameLen, ring = this.ringP, mask = this.ringSize - 1;
      let p = (this.ringPos - len) & mask;
      let e = 0;
      for (let j = 0; j < len; j++) { const v = ring[p]; f[j] = v; p = (p + 1) & mask; }
      const W = this.W, off = len - W - this.tauMax - 1;  // window starts so its lag partner ends at the newest sample
      for (let j = 0; j < W; j++) { const v = f[off + this.tauMax + j]; e += v * v; }
      const rms = Math.sqrt(e / W);
      const open = rms > this.gateLin * 0.7;
      if (!open) {
        if (this.gateOpen) { this.curMidi = null; this.legatoRun = 0; }
        this.gateOpen = false; this.lastPitch = null;
        return;
      }
      this.gateOpen = true;
      this.analyses++;

      // Notes still ringing from before the last onset: comb-filter them out (x[n] - g*x[n-P] removes
      // a note of period P and all its harmonics) so the new note is measured on its own.
      let a = f;
      this.usedCancel = false;
      if (this.cancel.length && frameNow - this.cancelAt < this.cancelFor) {
        const K = this.cancel.length, ext = len + K * (this.tauMax + 3);
        if (this.decWritten >= ext) {
          const x = this.ext;
          let q = (this.ringPos - ext) & mask;
          for (let j = 0; j < ext; j++) { x[j] = ring[q]; q = (q + 1) & mask; }
          let start = 0;
          for (const P of this.cancel) {
            const Pi = Math.floor(P), fr = P - Pi, s0 = start + Pi + 1;
            const g = this.combGain;
            for (let j = ext - 1; j >= s0; j--) x[j] -= g * (x[j - Pi] * (1 - fr) + x[j - Pi - 1] * fr);
            start = s0;
          }
          const fc = this.frameC;
          for (let j = 0; j < len; j++) fc[j] = x[ext - len + j];
          let ec = 0;
          for (let j = 0; j < W; j++) { const v = fc[off + this.tauMax + j]; ec += v * v; }
          // if the comb removed nearly everything, the new note shares its period with a ringing
          // note (a repeat or an octave): measure the plain signal instead
          if (ec > 0.12 * e) { a = fc; this.usedCancel = true; }
        }
      }

      // YIN difference function on window a[off .. off+W+tau]
      const d = this.d, tMax = this.tauMax;
      d[0] = 0;
      for (let tau = 1; tau <= tMax + 1; tau++) {
        let s = 0;
        for (let j = 0; j < W; j++) {
          const df = a[off + j] - a[off + j + tau];
          s += df * df;
        }
        d[tau] = s;
      }
      // cumulative mean normalised difference, in place
      let run = 0;
      d[0] = 1;
      for (let tau = 1; tau <= tMax + 1; tau++) {
        run += d[tau];
        d[tau] = run > 0 ? d[tau] * tau / run : 1;
      }
      // absolute threshold, then walk to the local minimum
      let tau = -1;
      for (let t = this.tauMin; t <= tMax; t++) {
        if (d[t] < this.yinThresh) {
          while (t + 1 <= tMax && d[t + 1] < d[t]) t++;
          tau = t; break;
        }
      }
      if (tau < 0) {  // no dip under the threshold: take the global minimum, low confidence
        let best = this.tauMin;
        for (let t = this.tauMin + 1; t <= tMax; t++) if (d[t] < d[best]) best = t;
        tau = best;
      }
      // The comb could not be used because the new note shares its period with a ringing one.
      // If the plain signal points at a ringing note's period P, the new note is usually P/2, P/3
      // or P/4 (an octave or more above): take the shortest of those with a clear dip.
      // The comb could not be used because the new note shares its period with a ringing one.
      // If the plain signal points at a ringing note's period P, the new note is usually P/2, P/3
      // or P/4 (an octave or more above): take the shortest of those with a clear dip.
      if (!this.usedCancel && this.cancel.length && frameNow - this.cancelAt < this.cancelFor) {
        const tied = this.cancel.some((P) => { const m = Math.round(tau / P); return m >= 1 && Math.abs(tau - m * P) < 0.03 * tau; });
        if (tied) {
          for (let k = 4; k >= 2; k--) {
            const c = Math.round(tau / k);
            if (c < this.tauMin + 1) continue;
            let bi = c;
            for (let t = Math.max(this.tauMin, c - 2); t <= Math.min(tMax, c + 2); t++) if (d[t] < d[bi]) bi = t;
            if (d[bi] < 0.35) { tau = bi; break; }
          }
        }
      }
      // parabolic interpolation
      let bt = tau;
      if (tau > 1 && tau < tMax + 1) {
        const a = d[tau - 1], b = d[tau], c = d[tau + 1];
        const den = a - 2 * b + c;
        if (den > 1e-12) bt = tau + 0.5 * (a - c) / den;
      }
      const freq = this.srd / bt;
      const conf = Math.max(0, Math.min(1, 1 - d[tau]));
      this.lastPitch = { f: freq, conf, frame: frameNow };
      this.track(freq, conf, frameNow);
    }

    // true when this pitch could also be a note that was still ringing (same pitch, or 2x/3x/4x apart):
    // the lesson then treats a mismatch as "unclear" instead of a wrong note (REQ-DET-6)
    relatedToRinging(freq) {
      const per = this.srd / freq;
      return this.cancel.some((P) => {
        for (let k = 1; k <= 4; k++) {
          if (Math.abs(per * k - P) < 0.03 * P || Math.abs(P * k - per) < 0.03 * per) return true;
        }
        return false;
      });
    }
    // Is a note of period P audible just before the onset? (level above the gate and periodic at P)
    stillRinging(P, late) {
      const mask = this.ringSize - 1, n = 512, Pi = Math.floor(P), fr = P - Pi, skip = late || 0;
      if (this.decWritten < n + P + 2 + skip) return false;
      let xy = 0, xx = 0, yy = 0;
      for (let j = 1; j <= n; j++) {
        const i0 = (this.ringPos - j - skip) & mask;
        const x = this.ring[i0];
        const y = this.ring[(i0 - Pi) & mask] * (1 - fr) + this.ring[(i0 - Pi - 1) & mask] * fr;
        xy += x * y; xx += x * x; yy += y * y;
      }
      if (Math.sqrt(xx / n) < this.gateLin * 0.5) return false;
      return xy / Math.sqrt(xx * yy + 1e-20) > 0.5;
    }
    remember(freq, frame) {
      this.recent.push({ period: this.srd / freq, frame });
      if (this.recent.length > 6) this.recent.shift();
    }
    track(freq, conf, frameNow) {
      if (conf < this.confMin || freq < this.minF || freq > this.maxF) return;
      const m = toMidi(freq);
      const windowFrames = (this.W + this.tauMax) * this.dec;
      if (this.awaiting) {
        // only trust estimates whose window is mostly after the onset
        if (frameNow - this.onsetFrame < windowFrames * 0.5) return;
        this.agree = this.prevEst != null && Math.abs(m - this.prevEst) < 0.3 ? this.agree + 1 : 0;
        if (this.agree >= this.confirmN - 1) {
          this.awaiting = false;
          this.curMidi = Math.round(m);
          this.legatoRun = 0;
          const ringing = this.relatedToRinging(freq);
          this.remember(freq, frameNow);
          this.port.postMessage({ type: 'note', onsetFrame: this.onsetFrame, onsetTime: this.onsetFrame / this.sr, frame: frameNow,
            detectMs: (frameNow - this.onsetFrame) / this.sr * 1000, freq, conf, legato: false, ringing });
        }
        this.prevEst = m;
        return;
      }
      // sustaining: a stable new pitch without a pick attack = legato change (slide, hammer-on...)
      if (this.curMidi == null) { this.curMidi = Math.round(m); return; }
      if (Math.abs(m - this.curMidi) > 0.6) {
        if (this.legatoRun > 0 && Math.abs(m - this.legatoMidi) < 0.3) this.legatoRun++;
        else { this.legatoRun = 1; this.legatoMidi = m; }
        if (this.legatoRun >= 3 && frameNow - this.cancelAt < this.cancelFor && this.relatedToRinging(freq)) { this.legatoRun = 0; return; } // an old note still ringing, not a slur
        if (this.legatoRun >= 3) {
          this.curMidi = Math.round(m); this.legatoRun = 0;
          this.remember(freq, frameNow);
          this.port.postMessage({ type: 'note', onsetFrame: null, onsetTime: frameNow / this.sr, frame: frameNow, detectMs: null, freq, conf, legato: true });
        }
      } else this.legatoRun = 0;
    }
  }

  registerProcessor('guitar-input', GuitarInputProcessor);
}

// Build a module URL the page can hand to audioWorklet.addModule().
function guitarQuestWorkletUrl() {
  const src = '(' + guitarQuestWorklet.toString() + ')();';
  // Pages opened from file:// have an opaque origin, where Chromium refuses blob: worklet
  // modules; a data: URL works there. Served pages use a blob: URL.
  if (location.protocol === 'file:') return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(src);
  return URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
}
if (typeof module !== 'undefined') module.exports = { guitarQuestWorklet };
