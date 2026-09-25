// Karplus-Strong plucked string, with optional hum, noise, and soft-clip "crunch"
function ks(freq, sr, dur, amp=0.5, seed=1){
  const N = Math.round(dur*sr), out = new Float32Array(N);
  const L = sr/freq, Li = Math.floor(L + 0.4), frac = L + 0.5 - Li; // loop delay = Li - 0.5 + allpass
  const buf = new Float32Array(Li+2); let s = seed;
  const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647*2-1; };
  // pick position ~ 1/5 of string: comb the noise burst
  for(let i=0;i<buf.length;i++) buf[i]=rnd();
  const pp = Math.max(1, Math.round(Li/5)); const b2 = buf.slice();
  for(let i=0;i<buf.length;i++) buf[i]=b2[i]-b2[(i+pp)%buf.length];
  let idx=0, last=0; const decay = Math.pow(0.001, 1/(freq*3.5)); // ~3.5 s T60
  // fractional delay via first-order allpass
  const C=(1-frac)/(1+frac); let apx=0, apy=0;
  for(let n=0;n<N;n++){
    const a = buf[idx], b = buf[(idx+1)%(Li)];
    let y = decay*0.5*(a+b);
    const ap = C*y + apx - C*apy; apx=y; apy=ap;
    out[n]=ap*amp; buf[idx]=ap; idx=(idx+1)%Li;
  }
  return out;
}
function mix(sr, events, total, {hum=0, noise=0, drive=0}={}){
  const out = new Float32Array(Math.round(total*sr));
  for(const e of events){ const s=ks(e.f, sr, e.dur, e.amp||0.4, e.seed||7); const o=Math.round(e.t*sr);
    for(let i=0;i<s.length && o+i<out.length;i++){ out[o+i]+=s[i]; } }
  let s=12345; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647*2-1; };
  for(let i=0;i<out.length;i++){
    let x = out[i] + hum*(Math.sin(2*Math.PI*60*i/sr)+0.3*Math.sin(2*Math.PI*180*i/sr)) + noise*rnd();
    if(drive>0) x = Math.tanh(x*(1+drive))/Math.tanh(1+drive);
    out[i]=x;
  }
  return out;
}
module.exports={ks,mix};
