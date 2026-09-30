'use strict';
// Dependency-free PCM WAV I/O for the rack runner. Reject unsupported formats.
function decode(b){
  if(b.length<12||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw Error('Expected a RIFF WAV file');
  const end=b.readUInt32LE(4)+8;if(end>b.length)throw Error('Truncated WAV');
  let fmt,data;
  for(let o=12;o+8<=end;){
    const size=b.readUInt32LE(o+4),next=o+8+size;if(next>end)throw Error('Truncated WAV chunk');
    const id=b.toString('ascii',o,o+4);
    if(id==='fmt ')fmt=b.subarray(o+8,next);if(id==='data')data=b.subarray(o+8,next);
    o=next+(size&1);
  }
  if(!fmt||fmt.length<16||!data)throw Error('WAV needs fmt and data chunks');
  const tag=fmt.readUInt16LE(0),ch=fmt.readUInt16LE(2),sampleRate=fmt.readUInt32LE(4),align=fmt.readUInt16LE(12),bits=fmt.readUInt16LE(14);
  if(!((tag===1&&[16,24,32].includes(bits))||(tag===3&&bits===32)))throw Error('Supported WAV: PCM 16/24/32-bit or float32 (no extensible WAV)');
  if(ch<1||ch>32||align!==ch*bits/8||data.length%align)throw Error('Invalid WAV channel layout');
  const frames=data.length/align,channels=Array.from({length:ch},()=>new Float32Array(frames));
  for(let i=0,o=0;i<frames;i++)for(let c=0;c<ch;c++,o+=bits/8){
    const x=tag===3?data.readFloatLE(o):bits===16?data.readInt16LE(o)/32768:bits===24?data.readIntLE(o,3)/8388608:data.readInt32LE(o)/2147483648;
    if(!Number.isFinite(x))throw Error('WAV contains non-finite samples');channels[c][i]=x;
  }
  return {channels,sampleRate};
}
function encode(audio){
  const {channels,sampleRate}=audio,ch=channels.length,len=channels[0].length;
  const bytes=len*ch*4;if(bytes>0xffffffff-36)throw Error('Output exceeds RIFF size limit');
  const b=Buffer.alloc(44+bytes);b.write('RIFF');b.writeUInt32LE(36+bytes,4);b.write('WAVE',8);b.write('fmt ',12);
  b.writeUInt32LE(16,16);b.writeUInt16LE(3,20);b.writeUInt16LE(ch,22);b.writeUInt32LE(sampleRate,24);
  b.writeUInt32LE(sampleRate*ch*4,28);b.writeUInt16LE(ch*4,32);b.writeUInt16LE(32,34);
  b.write('data',36);b.writeUInt32LE(bytes,40);
  for(let i=0,o=44;i<len;i++)for(let c=0;c<ch;c++,o+=4)b.writeFloatLE(channels[c][i],o);
  return b;
}
module.exports={decode,encode};
