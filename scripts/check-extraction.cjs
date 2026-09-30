#!/usr/bin/env node
'use strict';
// Run from any directory: node hindcasts/scripts/check-extraction.cjs
// Acceptance checks for regressions found in the 2026-09-30 extraction review.
const assert=require('node:assert/strict');
const Prolepsis=require('../prolepsis/engine.js');
const Horn=require('../horn-of-plenty/engine.js');
let failed=0;
function check(name,run){try{run();console.log(`PASS: ${name}`);}catch(e){failed++;console.error(`FAIL: ${name}\n${e.message}`);}}
for(const key of ['balance','flowY','chromaSplit','edgeInscription','lightPersistence','blur']){
  check(`Prolepsis preserves ${key}=0`,()=>assert.equal(Prolepsis.validateParams({[key]:0})[key],0));
}
check('Horn of Plenty preserves the original Husk preset',()=>assert.deepEqual(Horn.PRESETS.husk,{
  fiber:160,white:25,dens:4,even:65,pitch:0,rev:10,spread:25
}));
console.log(`${failed} acceptance check(s) failed`);
process.exitCode=failed?1:0;
