import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrum, groundHeight, shortWaveHeight, SHORT_WAVES } from '../public/island/ocean.js';
import { catchCount, chooseFish, readCatches, recordCatch } from '../public/island/catalog.js';
import { createState, stepField, sampleField, createRippleField, RIPPLE } from '../public/island/ripple-field.js';
import { createQuadruped, solveTwoBone, distance, LEG } from '../public/island/locomotion.js';
import { createSpray, SPLASH } from '../public/island/splash.js';

test('ballistic spray returns to water with bounded, non-recursive impulses',()=>{
  const hits=[],spray=createSpray({height:()=>0,ground:()=>-2,random:()=>.5,impulse:(...args)=>hits.push(args)});
  assert.equal(spray.burst(1,19,.22),true);let peakHeight=0;
  const initial=spray.snapshot().emitted;
  for(let i=0;i<120;i++){
    spray.step(1/60);
    for(const d of spray.drops.filter(d=>d.alive)){
      assert.ok([d.x,d.y,d.z,d.vx,d.vy,d.vz].every(Number.isFinite));peakHeight=Math.max(peakHeight,d.y);
    }
  }
  const final=spray.snapshot();assert.ok(peakHeight>.15);
  assert.equal(final.active,0);assert.equal(final.crowns,0);assert.equal(final.returned,initial);
  assert.equal(final.emitted,initial,'returning spray must not recursively emit particles');
  assert.ok(hits.length>0);hits.forEach(([x,z,force])=>{assert.ok(Number.isFinite(x+z));assert.ok(force>0&&force<=.025);});
});
test('spray pool is bounded and rejects dry or invalid impacts',()=>{
  const spray=createSpray({height:()=>0,ground:x=>x<0?1:-2,random:()=>.5});
  for(const args of [[-1,0,.2],[NaN,0,.2],[0,Infinity,.2],[0,0,-1],[0,0,Infinity]])assert.equal(spray.burst(...args),false);
  for(let i=0;i<500;i++)spray.burst(1,19,.3);
  assert.equal(spray.snapshot().active,SPLASH.capacity);assert.equal(spray.snapshot().emitted,SPLASH.capacity);
  assert.equal(spray.snapshot().crowns,SPLASH.crowns);
  spray.step(NaN);spray.step(Infinity);spray.step(-1);
  for(let i=0;i<180;i++)spray.step(1/60);
  assert.equal(spray.snapshot().active,0);
});
test('spray follows a moving water surface and expires if the surface disappears',()=>{
  let t=0;const spray=createSpray({height:()=>Math.sin(t)*.2,random:()=>.5});spray.burst(0,19,.28);
  for(let i=0;i<120;i++){t+=1/60;spray.step(1/60);}
  assert.equal(spray.snapshot().returned,spray.snapshot().emitted);
  let height=0;const lost=createSpray({height:()=>height,random:()=>.5});lost.burst(0,19,.28);height=-100;
  for(let i=0;i<120;i++)lost.step(1/60);
  assert.equal(lost.snapshot().active,0);assert.equal(lost.snapshot().expired,lost.snapshot().emitted);
});

test('two-bone IK preserves segment lengths and clamps unreachable targets',()=>{
  for(const target of [[0,0,0],[0,-.6,.2],[0,2,0],[1,2,3]]){
    const hip=[0,0,0],pose=solveTwoBone(hip,target,.36,.36,[0,0,1]);
    assert.ok(pose.knee.every(Number.isFinite)&&pose.foot.every(Number.isFinite));
    assert.ok(Math.abs(distance(hip,pose.knee)-.36)<1e-8);
    assert.ok(Math.abs(distance(pose.knee,pose.foot)-.36)<1e-8);
  }
});
test('quadruped plants stance paws without sliding, with at least three contacts',()=>{
  for(const ground of [()=>0,groundHeight,(x,z)=>.07*x+.04*z]){
    const gait=createQuadruped(ground);let previous=gait.snapshot(),maxReach=0,maxClearance=0;
    for(let frame=0;frame<60*48;frame++){
      const pose=gait.update(1/60);
      assert.ok(pose.feet.filter(f=>f.stance).length>=3);
      for(let i=0;i<4;i++){
        const f=pose.feet[i],p=previous.feet[i];maxReach=Math.max(maxReach,f.reachError);
        if(f.stance&&p.stance)assert.ok(distance(f.target,p.target)<1e-8,'planted world-space target must not skate');
        const clearance=f.target[1]-ground(f.target[0],f.target[2])-LEG.pad;
        assert.ok(clearance>=-1e-9);maxClearance=Math.max(maxClearance,clearance);
      }
      previous=pose;
    }
    assert.ok(previous.stepCount>25);assert.ok(maxClearance>.1);
    assert.ok(maxReach<.001,`leg must reach planted target: ${maxReach}`);
  }
});
test('quadruped settles on attention and does not travel in reduced motion',()=>{
  const gait=createQuadruped(groundHeight);
  for(let i=0;i<120;i++)gait.update(1/60,{active:true});
  const a=gait.snapshot();assert.equal(a.mode,'watching');assert.ok(a.speed<.001);
  const reduced=createQuadruped(groundHeight),start=reduced.snapshot();
  for(let i=0;i<120;i++)reduced.update(1/60,{reducedMotion:true});
  assert.ok(distance(start.root,reduced.snapshot().root)<1e-8);assert.equal(reduced.snapshot().stepCount,0);
});

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
  // The deep bed is now farther offshore so it cannot silhouette through the cove.
  assert.ok(groundHeight(70,3.3)<-10);
  for(let x=0;x<110;x+=.01){assert.ok(Math.abs(groundHeight(x+.01,3.3)-groundHeight(x,3.3))<.03);}
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
