// Sounder DSP shared by the page and offline rack. No DOM or AudioContext.
(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.SounderDSP=factory();
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function create(sr,G={crossovers:[]}){
const HOP=128,HBINS=160,SHAPE_MS=2,LUTN=512;
const FFT_N=4096, FFT_HOP=FFT_N>>2;
const HANN=(()=>{const w=new Float64Array(FFT_N);for(let n=0;n<FFT_N;n++)w[n]=0.5-0.5*Math.cos(2*Math.PI*n/FFT_N);return w;})();
function fft(re,im,inv){const n=re.length;
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
    if(i<j){const tr=re[i];re[i]=re[j];re[j]=tr;const ti=im[i];im[i]=im[j];im[j]=ti;}}
  for(let len=2;len<=n;len<<=1){const ang=(inv?2:-2)*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){let cr=1,ci=0;
      for(let k=0;k<len>>1;k++){const a=i+k,b=a+(len>>1);
        const xr=re[b]*cr-im[b]*ci,xi=re[b]*ci+im[b]*cr;
        re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;
        const ncr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=ncr;}}}
  if(inv)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
function splitBand(x,mask){const N=FFT_N,hop=FFT_HOP,w=HANN,pad=N,plen=x.length+2*pad;
  const xp=new Float64Array(plen);xp.set(x,pad);
  const out=new Float64Array(plen),wsum=new Float64Array(plen),re=new Float64Array(N),im=new Float64Array(N);
  for(let st=0;st+N<=plen;st+=hop){
    for(let k=0;k<N;k++){re[k]=xp[st+k]*w[k];im[k]=0;}
    fft(re,im,false);
    for(let k=0;k<=N>>1;k++){const g=mask[k];re[k]*=g;im[k]*=g;if(k>0&&k<N-k){re[N-k]*=g;im[N-k]*=g;}}
    fft(re,im,true);
    for(let k=0;k<N;k++){out[st+k]+=re[k]*w[k];wsum[st+k]+=w[k]*w[k];}}
  const y=new Float32Array(x.length);
  for(let i=0;i<x.length;i++){const ws=wsum[pad+i];y[i]=ws>1e-9?out[pad+i]/ws:0;}
  return y;}
function crossoverBins(){const half=FFT_N>>1,cs=G.crossovers.slice().sort((a,b)=>a-b);
  const fb=f=>clamp(Math.round(f/(sr/2)*half),2,half-2);
  const bins=cs.map(fb);
  return bins.map((bin,i)=>{const loN=i>0?bins[i-1]:0,hiN=i<bins.length-1?bins[i+1]:half;
    let hw=Math.max(2,Math.round(bin*0.12));
    hw=Math.min(hw,Math.floor(0.45*(bin-loN)),Math.floor(0.45*(hiN-bin)));
    return {bin,half:Math.max(1,hw)};});}
function buildMasks(xo){const half=FFT_N>>1,B=xo.length+1,masks=[];
  const fall=(k,c)=>{const lo=c.bin-c.half,hi=c.bin+c.half;if(k<=lo)return 1;if(k>=hi)return 0;
    const t=(k-lo)/(2*c.half);return Math.cos(0.5*Math.PI*t)**2;};
  for(let b=0;b<B;b++){const m=new Float64Array(half+1),lo=b>0?xo[b-1]:null,hi=b<B-1?xo[b]:null;
    for(let k=0;k<=half;k++){let g=1;if(hi)g*=fall(k,hi);if(lo)g*=(1-fall(k,lo));m[k]=g;}masks.push(m);}
  return masks;}
function avgMono(chs){const len=chs[0].length,m=new Float32Array(len),n=chs.length;
  for(const c of chs)for(let i=0;i<len;i++)m[i]+=c[i]/n;return m;}

/* ── per-band analysis engine (pure) ── */
function analyseMono(m,tauMs,floorDb){const len=m.length,nF=Math.ceil(len/HOP);
  const fe=new Float64Array(nF),fn=new Float64Array(nF);
  for(let f=0;f<nF;f++){const a=f*HOP,b=Math.min(a+HOP,len);let e=0;for(let i=a;i<b;i++)e+=m[i]*m[i];fe[f]=e;fn[f]=b-a;}
  const pe=new Float64Array(nF+1),pn=new Float64Array(nF+1);
  for(let f=0;f<nF;f++){pe[f+1]=pe[f]+fe[f];pn[f+1]=pn[f]+fn[f];}
  const W=Math.max(1,Math.round((tauMs/1000*sr)/HOP)),hw=W>>1;
  const lev=new Float32Array(nF),h=new Float32Array(HBINS),toN=db=>clamp((db-floorDb)/(0-floorDb),0,1);
  for(let f=0;f<nF;f++){const lo=clamp(f-hw,0,nF),hi=clamp(f+(W-hw),0,nF);
    const e=pe[hi]-pe[lo],n=pn[hi]-pn[lo];
    const rms=n>0?Math.sqrt(e/n):0,db=rms>1e-7?20*Math.log10(rms):-200,nn=toN(db);
    lev[f]=nn;h[clamp(Math.floor(nn*(HBINS-1)),0,HBINS-1)]+=pn[f+1]-pn[f];}
  let mx=0;for(let i=0;i<HBINS;i++)mx=Math.max(mx,h[i]);if(mx>0)for(let i=0;i<HBINS;i++)h[i]=Math.sqrt(h[i]/mx);
  return {framePrefixE:pe,framePrefixN:pn,levelN:lev,hist:h,nFrames:nF};}
function lutFor(P){const cv=P.map(p=>({...p})).sort((a,b)=>a.x-b.x);cv[0].x=0;cv[cv.length-1].x=1;
  const out=new Float32Array(LUTN),n=cv.length;
  const gp=idx=>idx<0?{x:2*cv[0].x-cv[1].x,y:2*cv[0].y-cv[1].y}:idx>n-1?{x:2*cv[n-1].x-cv[n-2].x,y:2*cv[n-1].y-cv[n-2].y}:cv[idx];
  for(let i=0;i<LUTN;i++){const x=i/(LUTN-1);let k=0;while(k<n-2&&cv[k+1].x<x)k++;
    const p0=gp(k-1),p1=cv[k],p2=cv[k+1],p3=gp(k+2);
    const seg=Math.max(1e-6,p2.x-p1.x),t=clamp((x-p1.x)/seg,0,1),t2=t*t,t3=t2*t;
    let y=0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3);
    out[i]=clamp(y,0,1);}return out;}
const applyOn=(L,nx)=>{const t=clamp(nx,0,1)*(LUTN-1),i=t|0,fr=t-i;return i>=LUTN-1?L[LUTN-1]:L[i]*(1-fr)+L[i+1]*fr;};

/* process one band's channels -> WET channels (per-band dry/wet handled by caller) */
function processChannels(chs,m,P,len,ch){
  const out=Array.from({length:ch},()=>new Float32Array(len)),L=lutFor(P.curve),fl=P.floorDb;
  const nToD=n=>fl+n*(0-fl),dToN=db=>clamp((db-fl)/(0-fl),0,1);
  if(P.tauMs<SHAPE_MS){
    const Ntf=8193,TF=new Float32Array(Ntf),floorLin=Math.pow(10,fl/20),mk=Math.pow(10,P.makeupDb/20);
    for(let i=0;i<Ntf;i++){const v=-1+2*i/(Ntf-1),a=v<0?-v:v;let g;
      if(a<=floorLin)g=Math.min(mk,1);
      else{const db=20*Math.log10(a),gd=clamp(nToD(applyOn(L,dToN(db)))-db,-60,36);g=Math.pow(10,gd/20)*mk;}
      TF[i]=v*g;}
    for(let c=0;c<ch;c++){const din=chs[c],dout=out[c];
      for(let i=0;i<len;i++){const v=din[i],t=(clamp(v,-1,1)+1)*0.5*(Ntf-1),k=t|0,fr=t-k;
        dout[i]=k>=Ntf-1?TF[Ntf-1]:TF[k]*(1-fr)+TF[k+1]*fr;}}
  } else {
    const A=analyseMono(m,P.tauMs,P.floorDb),nF=A.nFrames,lev=A.levelN,gdb=new Float32Array(nF);
    for(let f=0;f<nF;f++){const nx=lev[f],inDb=nToD(nx),outDb=nToD(applyOn(L,nx));let g=outDb-inDb;
      if(nx<=0.001)g=Math.min(g,0);else if(nx<0.06)g*=nx/0.06;g=clamp(g+P.makeupDb,-60,36);gdb[f]=g;}
    const glin=new Float32Array(nF);for(let f=0;f<nF;f++)glin[f]=Math.pow(10,gdb[f]/20);
    const frameMs=HOP/sr*1000,a=P.smoothMs>0?Math.exp(-frameMs/P.smoothMs):0;
    if(a>0){for(let f=1;f<nF;f++)glin[f]=glin[f]*(1-a)+glin[f-1]*a;
      for(let f=nF-2;f>=0;f--)glin[f]=glin[f]*(1-a)+glin[f+1]*a;}
    for(let c=0;c<ch;c++){const din=chs[c],dout=out[c];
      for(let i=0;i<len;i++){const fp=i/HOP,f0=fp|0,fr=fp-f0;
        const g=f0>=nF-1?glin[nF-1]:glin[f0]*(1-fr)+glin[f0+1]*fr;dout[i]=din[i]*g;}}
  }
  return out;}


function* renderSteps(chs,state){
  const len=chs[0].length,ch=chs.length;
  const xo=crossoverBins(),masks=xo.length?buildMasks(xo):null;
  const anySolo=state.bands.some(b=>b.solo);
  const acc=Array.from({length:ch},()=>new Float32Array(len));
  for(let b=0;b<state.bands.length;b++){
    const P=state.bands[b];
    yield b;
    if(!(anySolo?P.solo:P.enabled))continue;
    const bch=masks?chs.map(x=>splitBand(x,masks[b])):chs;
    const wet=processChannels(bch,avgMono(bch),P,len,ch);
    for(let c=0;c<ch;c++)for(let i=0;i<len;i++)
      acc[c][i]+=P.mix*wet[c][i]+(1-P.mix)*bch[c][i];
  }
  const mk=Math.pow(10,G.makeupDb/20);
  for(let c=0;c<ch;c++)for(let i=0;i<len;i++)
    acc[c][i]=(1-G.mix)*chs[c][i]+G.mix*acc[c][i]*mk;
  return acc;
}
function render(chs,state){
  const steps=renderSteps(chs,state);let step=steps.next();
  while(!step.done)step=steps.next();return step.value;
}
async function renderAsync(chs,state,onBand=()=>{}){
  const steps=renderSteps(chs,state);let step=steps.next();
  while(!step.done){onBand(step.value);await new Promise(r=>setTimeout(r,0));step=steps.next();}
  return step.value;
}
return {splitBand,crossoverBins,buildMasks,avgMono,analyseMono,lutFor,processChannels,render,renderAsync};
}
return {create};
});
