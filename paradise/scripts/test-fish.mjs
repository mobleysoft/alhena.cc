import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/island/vendor/three.module.min.js';
import {createFishGeometry, makeFish, fishStyles} from '../public/island/fish.js';
import {species} from '../public/island/catalog.js';

test('eight deterministic sculpted hulls have finite geometry, colors, and normalized skin weights', () => {
  assert.equal(fishStyles.length, species.length);
  for (let variant = 0; variant < fishStyles.length; variant++) {
    const g = createFishGeometry(variant), duplicate = createFishGeometry(variant);
    assert.deepEqual(g.attributes.position.array, duplicate.attributes.position.array);
    assert.ok(g.boundingSphere.radius < 1);assert.ok(g.index.count / 3 < 10000);
    for (const attr of Object.values(g.attributes)) assert.ok(attr.array.every(Number.isFinite));
    const {normal, skinIndex, skinWeight, color} = g.attributes;
    for (let i = 0; i < normal.count; i++) assert.ok(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i)) > .99, `normal ${i}`);
    for (let i = 0; i < skinWeight.count; i++) {
      assert.ok(Math.abs(skinWeight.getX(i)+skinWeight.getY(i)+skinWeight.getZ(i)+skinWeight.getW(i)-1) < 1e-6);
    }
    assert.ok(skinIndex.array.every(i => i >= 0 && i < 6));
    assert.ok(color.array.every(c => c >= 0 && c <= 1));
    g.dispose();duplicate.dispose();
  }
});

test('all sculpted parts are closed with outward winding and nondegenerate faces', () => {
 for(let variant=0;variant<fishStyles.length;variant++){
  const g = createFishGeometry(variant), p = g.attributes.position, idx = g.index.array, edges = new Map();
  const key = i => [p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0;
  for(let i=0;i<idx.length;i+=3){
    a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-10,'no zero-area faces');
    volume+=a.dot(b.clone().cross(c))/6;
    for(let j=0;j<3;j++){
      const x=key(idx[i+j]),y=key(idx[i+(j+1)%3]),k=[x,y].sort().join('|');
      const value=edges.get(k)||{count:0,winding:0};value.count++;value.winding+=x<y?1:-1;edges.set(k,value);
    }
  }
  assert.ok(volume>.01,'outward surface encloses positive volume');
  for(const e of edges.values()){assert.equal(e.count,2,'closed welded edge');assert.equal(e.winding,0,'consistent winding');}
  g.dispose();
 }
});

test('school shares eight geometries and one material, but not skeletons', () => {
  const scene=new THREE.Scene(),school=Array.from({length:14},(_,i)=>makeFish(scene,i));
  assert.equal(new Set(school.map(f=>f.mesh.geometry)).size,8);
  assert.equal(new Set(school.map(f=>f.mesh.material)).size,1);
  assert.equal(new Set(school.map(f=>f.mesh.skeleton)).size,14);
  assert.deepEqual(school.slice(0,8).map(f=>f.name),species.map(s=>s.name));
  for(const f of school){let count=0;f.g.traverse(o=>{if(o.isMesh)count++;});assert.equal(count,1);}
});

test('skin bends actual tail vertices, keeps head stable, and bounds reduced-motion animation', () => {
  const f=makeFish(new THREE.Group(),0),samples=[];
  for(let i=0;i<30;i++){f.update(i/30);samples.push(f.evidence());}
  const extent = rows => Math.max(...rows.map(s=>s.tail[0]))-Math.min(...rows.map(s=>s.tail[0]));
  assert.ok(extent(samples)>.12);
  for(const s of samples){assert.deepEqual(s.head,samples[0].head);assert.equal(s.bones,6);}
  const reduced=[];for(let i=0;i<30;i++){f.update(i/30,{reducedMotion:true});reduced.push(f.evidence());}
  assert.ok(extent(reduced)<extent(samples)*.4);
  for(const s of [...samples,...reduced]) assert.ok(s.tail.every(Number.isFinite));
});
