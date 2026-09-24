import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrum, groundHeight, shortWaveHeight, SHORT_WAVES } from '../public/island/ocean.js';
import { catchCount, chooseFish, readCatches, recordCatch } from '../public/island/catalog.js';
import { createState, stepField, sampleField, createRippleField, RIPPLE } from '../public/island/ripple-field.js';

test('finite-difference water is stable, propagates disturbances and dissipates energy',()=>{
  const n=64;let a=createState(()=>-2,n),b=new Float32Array(a.length);
  const cell=RIPPLE.span/(n-1),x=RIPPLE.minX+32*cell,z=32*cell;
  stepField(a,b,[{x,z,strength:.22,radius:.22}],n);[a,b]=[b,a];
  assert.ok(sampleField(a,x,z,n)<0,'impact depresses the surface');
  let farPeak=0,earlyEnergy=0,lateEnergy=0;
  for(let t=0;t<600;t++){
    stepField(a,b,[],n);[a,b]=[b,a];
    farPeak=Math.max(farPeak,Math.abs(sampleField(a,x+2,z,n)));
    assert.ok(a.every(Number.isFinite));
    const energy=a.reduce((sum,v,i)=>sum+(i%4<2?v*v:0),0);
    if(t===60)earlyEnergy=energy;if(t===599)lateEnergy=energy;
  }
  assert.ok(farPeak>.001,'force propagates beyond the injection footprint');
  assert.ok(lateEnergy<earlyEnergy*.1,'damping dissipates the disturbance');
});
test('shoreline mask remains dry; published field matches the sampled surface',()=>{
  const field=createRippleField((x)=>x<0?1:-2,{preferGPU:false});
  assert.equal(field.impulse(-1,13,.2),false);
  assert.equal(field.impulse(NaN,13,.2),false);
  assert.equal(field.impulse(1,13,.2),true);
  for(let i=0;i<150;i++)field.step();
  assert.equal(field.height(-1,13),0);
  assert.equal(field.height(100,100),0);
  assert.equal(field.height(1,13),sampleField(field.data,1,13));
  assert.equal(field.snapshot().impulseCount,1);
  field.dispose();
});

test('32 finite wave components retain PandoraChat dispersion and spectrum',()=>{
  for(const wind of [8,12,18]){
    const waves=spectrum(wind);assert.equal(waves.length,32);
    const wp=.13*9.81/wind*Math.PI*2;
    waves.forEach((w,i)=>{
      assert.ok(Object.values(w).every(Number.isFinite));
      assert.ok(w.amplitude>=0&&w.amplitude<=1.8);
      assert.ok(w.phase>=0&&w.phase<Math.PI*2);
      assert.ok(Math.abs(Math.hypot(w.kx,w.kz)*9.81-w.freq*w.freq)<1e-10);
      assert.ok(Math.abs(w.freq-wp*.5*7**(i/31))<1e-10);
    });
  }
});
test('shore transitions continuously into a deep seabed',()=>{
  assert.ok(groundHeight(0,3.3)>1);
  assert.ok(groundHeight(45,3.3)<-10);
  for(let x=0;x<80;x+=.01){assert.ok(Math.abs(groundHeight(x+.01,3.3)-groundHeight(x,3.3))<.03);}
});
test('small wind waves are bounded, weather-driven and use gravity-capillary dispersion',()=>{
  const limit=SHORT_WAVES.reduce((sum,w)=>sum+w.amplitude,0)*1.6;
  for(const w of SHORT_WAVES){const k=Math.hypot(w.kx,w.kz);assert.ok(Math.abs(w.frequency**2-9.81*k-.000074*k**3)<1e-12);}
  for(let t=0;t<100;t+=.13){assert.ok(Math.abs(shortWaveHeight(2,19,t,18))<=limit);assert.ok(Number.isFinite(shortWaveHeight(2,19,t,8)));}
  assert.ok(Math.abs(shortWaveHeight(2,19,2,18))>Math.abs(shortWaveHeight(2,19,2,8)));
});
test('legacy catch counts are preserved exactly and imported once',()=>{
  const saved=new Map([['paradise_fish_log',JSON.stringify({'glass minnow':27,'tide perch':3})]]);
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  const records=readCatches(storage);assert.equal(catchCount(records),30);
  recordCatch(records,'Silver mullet',storage);
  recordCatch(records,'Silver mullet',storage);
  assert.equal(catchCount(readCatches(storage)),32);
  assert.equal(JSON.parse(saved.get('paradise_fish_log'))['glass minnow'],27);
});
test('malformed or blocked browser storage cannot stop the island',()=>{
  assert.deepEqual(readCatches({getItem:()=>'{bad'}),[]);
  assert.deepEqual(readCatches({getItem:()=>{throw new Error('blocked');}}),[]);
  const records=[];recordCatch(records,'Amberjack',{setItem:()=>{throw new Error('full');}});
  assert.equal(catchCount(records),1);
});
test('a full storage quota does not hide a readable legacy journal',()=>{
  const records=readCatches({getItem:key=>key==='paradise_fish_log'?JSON.stringify({'tide perch':9}):null,setItem:()=>{throw new Error('full');}});
  assert.equal(catchCount(records),9);
});
test('weather and time influence rare-fish distribution',()=>{
  const count=(weather,time)=>{let n=0;for(let i=0;i<1000;i++)if(chooseFish(weather,time,()=>i/1000)==='Moon wrasse')n++;return n;};
  assert.ok(count('storm','night')>count('calm','noon'));
});
