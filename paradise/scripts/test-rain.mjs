import test from 'node:test';
import assert from 'node:assert/strict';
import { createRainState, RAIN } from '../public/island/rain.js';

function random() { let s=71; return () => ((s=Math.imul(s,1664525)+1013904223>>>0)/2**32); }
test('rain meets the moving sea, stays bounded, and fades when the storm passes',()=>{
  let time=0;
  const rain=createRainState({height:()=>Math.sin(time)*.25,ground:()=>-2,random:random()});
  for(let i=0;i<600;i++){
    time+=1/60;rain.step(1/60,true);
    assert.ok(rain.snapshot().rings<=RAIN.rings);
    for(const r of rain.rings.filter(r=>r.alive))assert.ok(Math.abs(r.y-Math.sin(time)*.25)<1e-9);
    for(const d of rain.drops)assert.ok([d.x,d.y,d.z].every(Number.isFinite));
  }
  assert.ok(rain.snapshot().contacts>500);assert.ok(rain.snapshot().rings>0);
  assert.equal(rain.snapshot().dryContacts,0);
  for(let i=0;i<300;i++)rain.step(1/60,false);
  assert.equal(rain.snapshot().intensity,0);assert.equal(rain.snapshot().rings,0);
  assert.equal(rain.snapshot().drops,0);
});
test('dry land never receives water rings; emerging land retires existing rings',()=>{
  let bed=-2;
  const rain=createRainState({height:()=>0,ground:()=>bed,random:random()});
  for(let i=0;i<180;i++)rain.step(1/60,true);
  assert.ok(rain.snapshot().rings>0);bed=2;rain.step(1/60,true);
  assert.equal(rain.snapshot().rings,0);
  for(let i=0;i<180;i++)rain.step(1/60,true);
  assert.ok(rain.snapshot().dryContacts>0);assert.equal(rain.snapshot().rings,0);
});
test('reduced motion disables decorative rain and invalid timesteps do not corrupt state',()=>{
  const rain=createRainState({height:()=>0,ground:()=>-2,random:random(),reducedMotion:true});
  const before=JSON.stringify(rain.drops);
  for(let i=0;i<300;i++)rain.step(1/60,true);
  for(const dt of [NaN,Infinity,-1,0])rain.step(dt,true);
  assert.equal(JSON.stringify(rain.drops),before);
  assert.equal(rain.snapshot().contacts,0);assert.equal(rain.snapshot().intensity,0);
});
