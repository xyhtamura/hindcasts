#!/usr/bin/env node
'use strict';
// node sounder/run-rack.cjs render --input recording.wav --recipe chain.json --output result.wav
const fs=require('node:fs'),path=require('node:path');
const Rack=require('./rack.js'),WAV=require('./wav.cjs');
const help=`Sounder offline rack
  node sounder/run-rack.cjs describe
  node sounder/run-rack.cjs validate --recipe chain.json
  node sounder/run-rack.cjs render --input recording.wav --recipe chain.json --output result.wav [--report result.json] [--stage node-id] [--force]
Output is float32 WAV at the input rate and length. --stage exports a raw cached intermediate.
Existing output files require --force. Paths are relative to the working directory.`;
function main(args){
  const command=args.shift();if(!command||command==='--help'){console.log(help);return;}
  const opts={};while(args.length){
    const k=args.shift();if(k==='--force'){opts.force=true;continue;}
    if(!['--input','--recipe','--output','--report','--stage'].includes(k)||!args.length||args[0].startsWith('--'))throw Error(`Invalid option ${k}\n${help}`);
    if(opts[k.slice(2)]!==undefined)throw Error(`Duplicate option ${k}`);opts[k.slice(2)]=args.shift();
  }
  if(command==='describe'){
    console.log(JSON.stringify({format:'hindcasts-rack',version:1,effects:[{id:'sounder',stateVersion:3,acceptedStateVersions:[2,3],detectors:['power','mono'],
      operation:'Whole-file multiband level transfer',controls:{tauMs:[0.5,2000],floorDb:[-200,-1],smoothMs:[0,2000],makeupDb:[-60,36],mix:[0,1]},
      curve:'Normalized x and y in [0,1]; x=0 is floorDb, x=1 is 0 dB. Window tauMs changes the level measurement.'}],
      routing:['sounder (one input, bypass, cell mix)','mix (inputs with gainDb)'],example:Rack.chain([Rack.defaultState()])},null,2));return;
  }
  if(!['validate','render'].includes(command))throw Error(`Unknown command ${command}`);
  if(!opts.recipe)throw Error('--recipe is required');
  const recipe=JSON.parse(fs.readFileSync(opts.recipe,'utf8'));const plan=Rack.validate(recipe);
  if(command==='validate'){console.log(JSON.stringify({valid:true,order:plan.order.map(n=>n.id)}));return;}
  if(!opts.input||!opts.output)throw Error('--input and --output are required');
  const destinations=[opts.output,opts.report].filter(Boolean).map(p=>path.resolve(p));
  const sources=[opts.input,opts.recipe].map(p=>path.resolve(p).toLowerCase());
  if(new Set(destinations.map(p=>p.toLowerCase())).size!==destinations.length||destinations.some(p=>sources.includes(p.toLowerCase())))throw Error('Output and report paths must differ from each other and input files');
  for(const p of destinations)if(fs.existsSync(p)&&!opts.force)throw Error(`File exists: ${p}; use --force to replace`);
  if(opts.stage&&opts.stage!=='source'&&!plan.order.some(n=>n.id===opts.stage))throw Error(`Stage is not on the output route: ${opts.stage}`);
  const audio=WAV.decode(fs.readFileSync(opts.input));const result=Rack.render(audio,recipe);
  const output=opts.stage?{sampleRate:audio.sampleRate,channels:result.cache.get(opts.stage)}:result;
  const report={...result.report,exportedStage:opts.stage??'master',input:path.resolve(opts.input),recipe:path.resolve(opts.recipe),outputFile:path.resolve(opts.output)};
  fs.writeFileSync(opts.output,WAV.encode(output),{flag:opts.force?'w':'wx'});
  if(opts.report)fs.writeFileSync(opts.report,JSON.stringify(report,null,2)+'\n',{flag:opts.force?'w':'wx'});
  console.log(JSON.stringify(report,null,2));
}
try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
