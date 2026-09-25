import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/island/vendor/three.module.min.js';
import { surfaceTexel, createSurfaceMaps, tactileMaterial, tactileGeometry, createAwningPanelGeometry, TACTILE_SIZE } from '../public/island/tactile-materials.js';
import { prepareStaticGeometry } from '../public/island/static-geometry.js';

test('periodic authored maps are finite, bounded, mipmapped and shared', () => {
  const textures=new Set();
  for(const kind of ['wood','linen','ceramic']) {
    for(const [u,v] of [[.12,.19],[.39,.88],[.73,.23]]) {
      const a=surfaceTexel(kind,u,v),b=surfaceTexel(kind,u+1,v),c=surfaceTexel(kind,u,v+1);
      for(const key of Object.keys(a)){assert.ok(a[key]>=0&&a[key]<=1);assert.ok(Math.abs(a[key]-b[key])<1e-12);assert.ok(Math.abs(a[key]-c[key])<1e-12);}
    }
    const maps=createSurfaceMaps(kind);assert.equal(maps,createSurfaceMaps(kind));
    const a=tactileMaterial('#987654',kind),b=tactileMaterial('#abcdef',kind);
    assert.equal(a.map,b.map);assert.equal(a.bumpMap,a.roughnessMap);assert.equal(a.bumpMap,b.bumpMap);
    assert.notEqual(a,b);assert.notDeepEqual(a.color,b.color);
    for(const t of [maps.map,maps.detail]) {
      textures.add(t);assert.equal(t.image.width,TACTILE_SIZE);assert.equal(t.image.data.byteLength,TACTILE_SIZE**2*4);
      assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.wrapT,THREE.RepeatWrapping);
      assert.equal(t.generateMipmaps,true);assert.equal(t.minFilter,THREE.LinearMipmapLinearFilter);
      const red=t.image.data.filter((_,i)=>i%4===0);
      assert.ok(Math.max(...red)-Math.min(...red)>4,'subtle maps must still have nonconstant surface information');assert.ok(t.anisotropy<=4);
    }
    assert.equal(maps.map.colorSpace,THREE.SRGBColorSpace);assert.equal(maps.detail.colorSpace,THREE.NoColorSpace);
  }
  assert.equal(textures.size,6);assert.ok([...textures].reduce((sum,t)=>sum+t.image.data.byteLength*4/3,0)<=2*1024**2);
  assert.throws(()=>createSurfaceMaps('invented'),/Unknown/);
});

test('metric UVs preserve original geometry, follow each plank and survive static merging', () => {
  const source=new THREE.BoxGeometry(3,.15,.4),original=source.attributes.uv.array.slice();
  const mapped=tactileGeometry(source);assert.equal(mapped,tactileGeometry(source));assert.notEqual(mapped,source);
  assert.deepEqual(source.attributes.uv.array,original);assert.deepEqual(source.attributes.position.array,mapped.attributes.position.array);
  for(let i=0;i<mapped.attributes.position.count;i++) {
    if(mapped.attributes.normal.getY(i)>.9){assert.equal(mapped.attributes.uv.getX(i),mapped.attributes.position.getX(i));assert.equal(mapped.attributes.uv.getY(i),mapped.attributes.position.getZ(i));}
  }
  const post=tactileGeometry(new THREE.CylinderGeometry(.1,.1,2,12));
  for(let i=0;i<post.attributes.position.count;i++)if(Math.abs(post.attributes.normal.getY(i))<.1)assert.equal(post.attributes.uv.getX(i),post.attributes.position.getY(i));
  const mesh=new THREE.Mesh(mapped,tactileMaterial('#abcdef','wood'));mesh.position.set(4,5,6);mesh.rotation.y=.4;mesh.updateMatrixWorld();
  const baked=prepareStaticGeometry(mesh),flat=mapped.toNonIndexed();assert.deepEqual(baked.attributes.uv.array,flat.attributes.uv.array);
});

test('all cloth panels are closed outward meshes with matching stripe seams', () => {
  let triangles=0;
  for(const valance of [false,true])for(let panel=0;panel<12;panel++) {
    const g=createAwningPanelGeometry(panel,valance),p=g.attributes.position,a=g.index.array,edges=new Map();let volume=0;
    for(const key of ['position','normal','uv'])assert.ok(g.attributes[key].array.every(Number.isFinite));
    for(let i=0;i<a.length;i+=3){const x=new THREE.Vector3().fromBufferAttribute(p,a[i]),y=new THREE.Vector3().fromBufferAttribute(p,a[i+1]),z=new THREE.Vector3().fromBufferAttribute(p,a[i+2]);
      volume+=x.dot(y.clone().cross(z))/6;assert.ok(y.clone().sub(x).cross(z.clone().sub(x)).length()>1e-9);
      for(const [v,w] of [[a[i],a[i+1]],[a[i+1],a[i+2]],[a[i+2],a[i]]]){const key=[Math.min(v,w),Math.max(v,w)].join(',');const item=edges.get(key)||[0,0];item[0]++;item[1]+=v<w?1:-1;edges.set(key,item);}
    }
    assert.ok(volume>0);for(const e of edges.values())assert.deepEqual(e,[2,0]);triangles+=a.length/3;
    if(panel<11){const next=createAwningPanelGeometry(panel+1,valance).attributes.position,rows=p.count/18;
      for(let side=0;side<2;side++)for(let row=0;row<rows;row++) {
        const end=side*rows*9+row*9+8,start=side*rows*9+row*9;
        for(const get of ['getX','getY','getZ'])assert.ok(Math.abs(p[get](end)-next[get](start))<1e-6);
      }
    }
    assert.equal(g.userData.metricUV,true);
  }
  assert.ok(triangles<8500);assert.throws(()=>createAwningPanelGeometry(12),/outside/);
});

test('awning has a draped profile, an actual thickness and a scalloped hem',()=>{
  const top=createAwningPanelGeometry(5).attributes.position,hem=createAwningPanelGeometry(5,true).attributes.position;
  assert.ok(top.getY(6*9+4)<(top.getY(4)+top.getY(12*9+4))/2-.1);
  assert.ok(Math.abs(top.getY(4)-top.getY(13*9+4)-.018)<1e-6);
  assert.ok(hem.getY(2*9+4)<(hem.getY(2*9)+hem.getY(2*9+8))/2-.07);
});
