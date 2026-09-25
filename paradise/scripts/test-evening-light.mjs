import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/island/vendor/three.module.min.js';
import {eveningPreset,createEveningLights,createWindowMaterial} from '../public/island/evening-light.js';

test('evening illumination follows time and weather, with a bounded daylight baseline',()=>{
  assert.equal(eveningPreset('noon').window,0);assert.equal(eveningPreset('night').window,2.8);
  assert.ok(eveningPreset('sunset').window<eveningPreset('night').window);
  assert.ok(eveningPreset('noon','storm').window>eveningPreset('noon').window);
  for(const time of ['dawn','noon','sunset','night',null,'invalid','__proto__','toString'])for(const weather of ['calm','breeze','storm',null]){
    const p=eveningPreset(time,weather);for(const v of Object.values(p))assert.ok(Number.isFinite(v)&&v>=0&&v<=18);
  }
});
test('curtained glazing is deterministic, finite and keeps independent material state',()=>{
  const a=createWindowMaterial(),b=createWindowMaterial();
  assert.deepEqual(a.map.image.data,b.map.image.data);assert.equal(a.map.image.width,64);
  assert.ok(new Set(a.map.image.data).size>30);assert.equal(a.map.image.data.length,64*64*4);
  assert.equal(a.map,a.emissiveMap);assert.equal(a.map.colorSpace,T.SRGBColorSpace);
  a.emissiveIntensity=2;assert.equal(b.emissiveIntensity,0);
});
test('modeled fixtures use four non-shadow local lights and restore exact day state',()=>{
  function make(){const root=new T.Group(),cottage=new T.Group(),bar=new T.Group(),dock=new T.Group();root.add(cottage,bar,dock);
    cottage.position.set(-5,1,3);bar.position.set(4.5,1,3.1);dock.position.set(1,0,10);dock.rotation.y=Math.PI;
    return {root,system:createEveningLights(root,{cottage,bar,dock,windowMaterial:createWindowMaterial()})};}
  const a=make(),b=make(),initial=a.system.evidence();
  assert.equal(initial.lightCount,4);assert.equal(initial.shadowLights,0);
  a.system.setEnvironment('night','storm');const night=a.system.evidence();
  assert.ok(night.windowEmission>2);assert.ok(night.lights.every(l=>l.intensity>0&&l.range<=7));
  assert.ok(night.lights.every(l=>l.position.every(Number.isFinite)));
  assert.equal(b.system.evidence().windowEmission,0,'one cove must not change another');
  a.system.setEnvironment('noon','calm');assert.deepEqual(a.system.evidence(),initial);
  let meshes=0,triangles=0;a.root.traverse(m=>{if(m.isMesh){meshes++;const g=m.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;
    assert.ok(g.attributes.position.array.every(Number.isFinite));}});
  assert.ok(meshes<50);assert.ok(triangles<10000);
});
