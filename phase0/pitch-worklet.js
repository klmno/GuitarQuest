/*
 * GuitarQuest Phase 0: analysis AudioWorklet.
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
    else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * cw / a0, a2: (1 - al) / a0 };
  }
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

      this.port.onmessage = (e) => this.onMsg(e.data);
    }

    onMsg(m) {
      if (m.type === 'setGate') { this.gateDb = m.db; this.gateLin = Math.pow(10, m.db / 20); }
      else if (m.type === 'setChannel') this.channelMode = m.mode;
      else if (m.type === 'setConfMin') this.confMin = m.value;
      else if (m.type === 'measureFloor') this.floorMeasure = { left: Math.round((m.seconds || 2) * this.sr), sq: 0, n: 0, peak: 0 };
    }

    process(inputs) {
      const inp = inputs[0];
      if (!inp || inp.length === 0 || !inp[0]) return true;
      const n = inp[0].length;
      const L = inp[0], R = inp.length > 1 ? inp[1] : null;
      const mode = this.channelMode;
      const blockStart = currentFrame;

      let peak = 0, sq = 0, clip = 0, dsq = 0;
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

        const h = this.hp.run(x);
        const dx = h - prev; prev = h; dsq += dx * dx;

        const y = this.lp2.run(this.lp1.run(h));
        if (++this.decPhase >= this.dec) {
          this.decPhase = 0;
          this.ring[this.ringPos] = y;
          this.ringPos = (this.ringPos + 1) & (this.ringSize - 1);
          this.decWritten++;
          if (++this.sinceHop >= this.hopDec) {
            this.sinceHop = 0;
            // frame index (input rate) of the newest sample in the analysis window
            this.analyse(blockStart + i + 1);
          }
        }
      }
      this.prevX = prev;

      // level accumulation
      if (peak > this.lvPeak) this.lvPeak = peak;
      this.lvSq += sq; this.lvN += n; this.lvClip += clip;
      const blockRms = Math.sqrt(sq / n);
      this.recentRms = blockRms;

      // noise floor measurement
      if (this.floorMeasure) {
        const fm = this.floorMeasure;
        fm.sq += sq; fm.n += n; if (peak > fm.peak) fm.peak = peak; fm.left -= n;
        if (fm.left <= 0) {
          const rmsDb = toDb(Math.sqrt(fm.sq / fm.n));
          this.port.postMessage({ type: 'floor', rmsDb, peakDb: toDb(fm.peak) });
          this.floorMeasure = null;
        }
      }

      // onset detection on first-difference energy
      const e = dsq / n;
      let mean = 0;
      for (let k = 0; k < this.histFill; k++) mean += this.hist[k];
      mean = this.histFill ? mean / this.histFill : 0;
      if (this.histFill >= 4 && blockRms > this.gateLin && e > 4 * mean + 1e-10 &&
          blockStart - this.lastOnsetFrame > this.refractory) {
        this.lastOnsetFrame = blockStart;
        this.onsetFrame = blockStart;
        this.awaiting = true;
        this.prevEst = null;
        this.port.postMessage({ type: 'onset', frame: blockStart, time: blockStart / this.sr, rmsDb: toDb(blockRms) });
      }
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

    analyse(frameNow) {
      if (this.decWritten < this.frameLen) return;
      // linearise the newest frameLen samples
      const f = this.frame, len = this.frameLen, ring = this.ring, mask = this.ringSize - 1;
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

      // YIN difference function on window f[off .. off+W+tau]
      const d = this.d, tMax = this.tauMax;
      d[0] = 0;
      for (let tau = 1; tau <= tMax + 1; tau++) {
        let s = 0;
        for (let j = 0; j < W; j++) {
          const df = f[off + j] - f[off + j + tau];
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

    track(freq, conf, frameNow) {
      if (conf < this.confMin || freq < this.minF || freq > this.maxF) return;
      const m = toMidi(freq);
      const windowFrames = (this.W + this.tauMax) * this.dec;
      if (this.awaiting) {
        // only trust estimates whose window is mostly after the onset
        if (frameNow - this.onsetFrame < windowFrames * 0.5) return;
        if (this.prevEst != null && Math.abs(m - this.prevEst) < 0.3) {
          this.awaiting = false;
          this.curMidi = Math.round(m);
          this.legatoRun = 0;
          this.port.postMessage({ type: 'note', onsetFrame: this.onsetFrame, frame: frameNow,
            detectMs: (frameNow - this.onsetFrame) / this.sr * 1000, freq, conf, legato: false });
        }
        this.prevEst = m;
        return;
      }
      // sustaining: a stable new pitch without a pick attack = legato change (slide, hammer-on...)
      if (this.curMidi == null) { this.curMidi = Math.round(m); return; }
      if (Math.abs(m - this.curMidi) > 0.6) {
        if (this.legatoRun > 0 && Math.abs(m - this.legatoMidi) < 0.3) this.legatoRun++;
        else { this.legatoRun = 1; this.legatoMidi = m; }
        if (this.legatoRun >= 3) {
          this.curMidi = Math.round(m); this.legatoRun = 0;
          this.port.postMessage({ type: 'note', onsetFrame: null, frame: frameNow, detectMs: null, freq, conf, legato: true });
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
