import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/island/vendor/three.module.min.js';
import {createLabrador,createLabradorHeadGeometry,createLabradorEarGeometry,createLabradorTailGeometry,createLabradorSkinGeometry} from '../public/island/labrador.js';
import {LEG,LEGS} from '../public/island/locomotion.js';

const builders=[createLabradorHeadGeometry,createLabradorEarGeometry,createLabradorTailGeometry,createLabradorSkinGeometry];
test('Labrador sculptures are deterministic, bounded closed solids',()=>{
  for(const build of builders){
    const g=build(),copy=build(),p=g.attributes.position,idx=g.index.array,edges=new Map();let volume=0;
    assert.deepEqual(p.array,copy.attributes.position.array);assert.ok(g.boundingSphere.radius<1.5);
    for(const attr of Object.values(g.attributes))assert.ok(attr.array.every(Number.isFinite));
    assert.ok(g.attributes.color.array.every(v=>v>=0&&v<=1));
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<idx.length;i+=3){
      a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-10,`${build.name}: nondegenerate triangle`);
      volume+=a.dot(b.clone().cross(c))/6;
      for(let j=0;j<3;j++){const x=idx[i+j],y=idx[i+(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join(':');
        const e=edges.get(key)||{count:0,winding:0};e.count++;e.winding+=x<y?1:-1;edges.set(key,e);}
    }
    assert.ok(volume>0,`${build.name}: outward winding`);
    for(const e of edges.values()){assert.equal(e.count,2);assert.equal(e.winding,0);}
    g.dispose();copy.dispose();
  }
});

test('one-material Labrador keeps four independent two-bone legs and cached geometry',()=>{
  const dog=createLabrador(new THREE.Group()),other=createLabrador(new THREE.Group()),meshes=[],copies=[];
  dog.g.traverse(o=>{if(o.isMesh)meshes.push(o);});other.g.traverse(o=>{if(o.isMesh)copies.push(o);});
  assert.equal(meshes.length,8);assert.equal(new Set(meshes.map(m=>m.material)).size,1);
  assert.ok(dog.evidence().triangles<50000);assert.equal(dog.legs.length,4);
  assert.ok(dog.skin.isSkinnedMesh);assert.equal(dog.skin.skeleton.bones.length,13);
  const sw=dog.skin.geometry.attributes.skinWeight;
  for(let i=0;i<sw.count;i++)assert.ok(Math.abs(sw.getX(i)+sw.getY(i)+sw.getZ(i)+sw.getW(i)-1)<1e-6);
  meshes.forEach((m,i)=>{assert.equal(m.geometry,copies[i].geometry);assert.notEqual(m,copies[i]);});
  dog.legs.forEach((leg,i)=>{assert.equal(leg.id,LEGS[i].id);assert.equal(leg.knee.parent,leg.hip);assert.equal(leg.paw.parent,leg.knee);
    assert.equal(leg.knee.position.y,-LEG.upper);assert.equal(leg.paw.position.y,-LEG.lower);});
  dog.head.rotation.y=.4;dog.tail.rotation.y=.3;dog.eyes[0].scale.y=.1;
  assert.equal(other.head.rotation.y,0);assert.equal(other.tail.rotation.y,0);assert.equal(other.eyes[0].scale.y,1);
});

test('continuous torso has a deeper chest and a tucked-up waist; muzzle is part of skull',()=>{
  const body=createLabradorSkinGeometry(),p=body.attributes.position;
  const bottom=(lo,hi)=>{let min=Infinity;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<.06&&p.getZ(i)>lo&&p.getZ(i)<hi)min=Math.min(min,p.getY(i));return min;};
  assert.ok(bottom(.2,.5)<bottom(-.35,-.12)-.13);
  const head=createLabradorHeadGeometry();assert.ok(head.boundingBox.max.z>.6);assert.ok(head.boundingBox.min.z<-.3);
  body.dispose();head.dispose();
});

test('all four skinned soles follow their paw bone under body and joint transforms',()=>{
  const parent=new THREE.Group();parent.position.set(3,.6,-4);parent.rotation.y=.4;
  const dog=createLabrador(parent),p=dog.skin.geometry.attributes.position,sw=dog.skin.geometry.attributes.skinWeight,si=dog.skin.geometry.attributes.skinIndex;
  dog.g.position.set(.3,.2,1);dog.g.rotation.y=-.6;dog.body.position.y+=.05;
  dog.legs.forEach((leg,i)=>{leg.hip.rotation.x=.18*(i%2?-1:1);leg.knee.rotation.x=-.3;leg.paw.rotation.set(.05,.13,.08);});
  parent.updateMatrixWorld(true);dog.skin.skeleton.update();const counts=[0,0,0,0];
  for(let i=0;i<p.count;i++){
    const rendered=dog.skin.localToWorld(dog.skin.getVertexPosition(i,new THREE.Vector3()));
    assert.ok(rendered.toArray().every(Number.isFinite));
    if(p.getY(i)>-.77)continue;
    assert.equal(sw.getW(i),1,'sole must not remain anchored to the torso');
    const leg=(si.getW(i)-3)/3,spec=LEGS[leg];counts[leg]++;
    const offset=new THREE.Vector3().fromBufferAttribute(p,i).sub(new THREE.Vector3(spec.x,-.76,spec.z));
    const expected=dog.legs[leg].paw.localToWorld(offset);
    assert.ok(rendered.distanceTo(expected)<1e-6,'deformed skin agrees with the paw, not just the empty joint');
  }
  assert.ok(counts.every(n=>n>30));
});
