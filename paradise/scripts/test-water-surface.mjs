import test from 'node:test';
import assert from 'node:assert/strict';
import {spectrum,SHORT_WAVES,NORMAL_EPSILON,normalSteps,reflectionSize} from '../public/island/ocean.js';

test('angle-addition samples reproduce the legacy finite differences',()=>{
  for(const wind of [8,12,18])for(const w of [...spectrum(wind),...SHORT_WAVES]){
    const step=normalSteps(w).toArray();
    for(const phase of [-201.2,-3,0,7.4,804.1]){
      const s=Math.sin(phase),c=Math.cos(phase);
      const shifted=[s*step[0]+c*step[1],s*step[0]-c*step[1],s*step[2]+c*step[3],s*step[2]-c*step[3]];
      [w.kx,-w.kx,w.kz,-w.kz].forEach((k,i)=>assert.ok(Math.abs(shifted[i]-Math.sin(phase+k*NORMAL_EPSILON))<1e-12));
    }
  }
});

test('reflection targets retain aspect ratio without exceeding one megapixel',()=>{
  for(const [width,height] of [[1,1],[390,844],[844,390],[1440,900],[2160,1350],[7680,4320]]){
    const [w,h]=reflectionSize(width,height);
    assert.ok(w>=1&&h>=1&&w<=width&&h<=height&&w*h<=1048576);
    assert.ok(Math.abs(w/width-h/height)<Math.max(1/width,1/height));
    if(width*height<=1048576)assert.deepEqual([w,h],[width,height]);
  }
});
