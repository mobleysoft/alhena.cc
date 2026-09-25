import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/island/vendor/three.module.min.js';
import {createHost,createHostHeadGeometry,createHostHairGeometry,createHostDressGeometry,createHostApronGeometry} from '../public/island/host.js';
const builders=[createHostHeadGeometry,createHostHairGeometry,createHostDressGeometry,createHostApronGeometry];

test('sculpted face, hair, dress and apron are deterministic, finite and bounded',()=>{
  for(const build of builders){
    const g=build(),copy=build();assert.deepEqual(g.attributes.position.array,copy.attributes.position.array);
    assert.ok(g.index.count/3<6500);assert.ok(g.boundingSphere.radius<1);
    for(const a of Object.values(g.attributes))assert.ok(a.array.every(Number.isFinite));
    assert.ok(g.attributes.color.array.every(c=>c>=0&&c<=1));
    const n=g.attributes.normal;
    for(let i=0;i<n.count;i++)assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.99);
    g.dispose();copy.dispose();
  }
});

test('all four primary sculptures are closed, consistently wound, nondegenerate solids',()=>{
  for(const build of builders){
    const g=build(),p=g.attributes.position,idx=g.index.array,edges=new Map();let volume=0;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<idx.length;i+=3){
      a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-10,`${build.name}: zero area`);
      volume+=a.dot(b.clone().cross(c))/6;
      for(let j=0;j<3;j++){
        const x=idx[i+j],y=idx[i+(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join(':');
        const e=edges.get(key)||{count:0,winding:0};e.count++;e.winding+=x<y?1:-1;edges.set(key,e);
      }
    }
    assert.ok(volume>0,`${build.name}: positive enclosed volume`);
    for(const e of edges.values()){assert.equal(e.count,2);assert.equal(e.winding,0);}
    g.dispose();
  }
});

test('host keeps the existing articulated interface with seven batched meshes',()=>{
  const h=createHost(new THREE.Group()),other=createHost(new THREE.Group()),meshes=[],copies=[];
  h.g.traverse(o=>{if(o.isMesh)meshes.push(o);});other.g.traverse(o=>{if(o.isMesh)copies.push(o);});
  assert.equal(meshes.length,7);assert.equal(new Set(meshes.map(m=>m.material)).size,1);
  assert.ok(h.evidence().triangles<25000);assert.equal(h.eyes.length,2);assert.equal(h.arms.length,2);
  meshes.forEach((m,i)=>{assert.equal(m.geometry,copies[i].geometry);assert.notEqual(m,copies[i]);});
  h.g.updateMatrixWorld(true);const headBefore=h.head.matrixWorld.clone(),eyeBefore=h.eyes[0].matrixWorld.clone();
  h.eyes[0].scale.y=.1;h.arms[1].rotation.z=1.9;h.g.updateMatrixWorld(true);
  assert.deepEqual(h.head.matrixWorld,headBefore);assert.notDeepEqual(h.eyes[0].matrixWorld,eyeBefore);
  assert.equal(h.evidence().blink,.1);assert.equal(h.evidence().greetingArm,1.9);
  assert.equal(other.evidence().blink,1);assert.ok(other.evidence().greetingArm<.3);
});

test('face has an integrated nose and cheek relief rather than an added sphere',()=>{
  const g=createHostHeadGeometry(),p=g.attributes.position;let nose=-Infinity,cheek=-Infinity;
  for(let i=0;i<p.count;i++){
    if(Math.abs(p.getX(i))<.01&&Math.abs(p.getY(i)+.045)<.025)nose=Math.max(nose,p.getZ(i));
    if(Math.abs(p.getX(i)-.16)<.03&&Math.abs(p.getY(i)+.085)<.03)cheek=Math.max(cheek,p.getZ(i));
  }
  assert.ok(nose>.34);assert.ok(cheek>.23&&cheek<nose-.04);g.dispose();
});
