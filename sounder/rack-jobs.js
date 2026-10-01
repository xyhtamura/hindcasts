/* Browser-only cancellable job transport. Input buffers remain owned by the host. */
(()=>{
'use strict';
const workerURL=new URL('rack-worker.js',document.currentScript.src);
window.HindcastsRackJobs={start(payload,onProgress=()=>{}){
  let worker,settled=false,rejectJob;
  const promise=new Promise((resolve,reject)=>{
    rejectJob=reject;
    function finish(error,result){if(settled)return;settled=true;worker?.terminate();error?reject(error):resolve(result);}
    try{
      worker=new Worker(workerURL);
      worker.onmessage=e=>{if(settled)return;const m=e.data;if(m.type==='progress')onProgress(m);else if(m.type==='result')finish(null,m.result);else if(m.type==='error')finish(Error(m.message));};
      worker.onerror=e=>{e.preventDefault();finish(Error(e.message||'Worker failed to start. Serve this page over HTTP.'));};
      worker.onmessageerror=()=>finish(Error('Worker result could not be read.'));
      worker.postMessage(payload);
    }catch(error){finish(error);}
  });
  return {promise,cancel(){if(settled)return;settled=true;worker?.terminate();const error=Error('Job cancelled');error.name='AbortError';rejectJob(error);}};
}};
})();
