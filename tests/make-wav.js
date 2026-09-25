// Writes a synthesized test recording (E2..E6 plucked notes) for the browser test: node tests/make-wav.js /tmp/guitar.wav
const {mix}=require('./synth.js'); const fs=require('fs');
const sr=48000, notes=[40,45,50,55,59,64,69,76,81,88];
const ev=notes.map((m,i)=>({f:440*Math.pow(2,(m-69)/12),t:0.5+i*0.8,dur:0.7,amp:0.35}));
const s=mix(sr,ev,0.5+notes.length*0.8+0.5,{hum:0.002,noise:0.0005});
const b=Buffer.alloc(44+s.length*2); b.write('RIFF',0); b.writeUInt32LE(36+s.length*2,4); b.write('WAVEfmt ',8);
b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(sr,24); b.writeUInt32LE(sr*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(s.length*2,40);
for(let i=0;i<s.length;i++) b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(s[i]*32767))),44+i*2);
fs.writeFileSync(process.argv[2] || 'guitar.wav', b);
