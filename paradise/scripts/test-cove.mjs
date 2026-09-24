import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrum, groundHeight } from '../public/island/ocean.js';
import { catchCount, chooseFish, readCatches, recordCatch } from '../public/island/catalog.js';

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
