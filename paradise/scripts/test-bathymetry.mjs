import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../public/island/vendor/three.module.min.js';
import { groundHeight, OFFSHORE_SHELF } from '../public/island/ocean.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
const oldGround = (x, z) => {
  const r = Math.hypot(x/12.8, (z-3.3)/9.2);
  return 1.18-3.9*smooth(.48,1.22,r)-16*smooth(1.3,4.8,r)
    +.1*Math.sin(x*.55)*Math.cos(z*.47)*(1-smooth(.45,.95,r));
};

test('the island, shoreline and inner cove retain their authored elevations', () => {
  for (let i=0;i<=130;i++) for(let angle=0;angle<64;angle++) {
    const r=i/100,a=angle*Math.PI/32,x=12.8*r*Math.cos(a),z=3.3+9.2*r*Math.sin(a);
    assert.ok(Math.abs(groundHeight(x,z)-oldGround(x,z))<1e-12);
  }
});

test('offshore grade is continuous, bounded and still reaches the deep seafloor', () => {
  const {start,end,drop}=OFFSHORE_SHELF;
  assert.ok(1.5*drop/((end-start)*9.2)<.4, 'maximum analytic outer-shelf slope stays below 0.4');
  for(let angle=0;angle<64;angle++) {
    const a=angle*Math.PI/32;let previous=-2.72;
    for(let i=0;i<=100;i++) {
      const r=start+(end-start)*i/100,x=r*12.8*Math.cos(a),z=3.3+r*9.2*Math.sin(a),h=groundHeight(x,z);
      assert.ok(Number.isFinite(h)&&h<=previous+1e-10&&h>=-18.72-1e-10);
      const e=.001,dx=(groundHeight(x+e,z)-groundHeight(x-e,z))/(2*e),dz=(groundHeight(x,z+e)-groundHeight(x,z-e))/(2*e);
      assert.ok(Math.hypot(dx,dz)<.4);previous=h;
    }
    assert.ok(Math.abs(previous+18.72)<1e-10);
  }
});

// Reproduce the two clear-water scanlines from the observed overview frame.
// First-hit sampling intentionally detects self-occlusion, not just derivatives.
function paths(height) {
  const camera=new THREE.PerspectiveCamera(40,1.6,.1,550);
  camera.position.set(Math.sin(.63)*38,25,Math.cos(.63)*38);
  camera.lookAt(-5,1,4);camera.updateMatrixWorld();
  return [[.28,.34],[.58,.62]].map(([lo,hi])=>{
    const lengths=[];
    for(let u=lo;u<=hi+.00001;u+=.002) {
      const ray=new THREE.Vector3(u*2-1,.2,1).unproject(camera).sub(camera.position).normalize();
      const start=camera.position.clone().addScaledVector(ray,-camera.position.y/ray.y);
      for(let d=0;d<120;d+=.025){
        const p=start.clone().addScaledVector(ray,d);
        if(p.y<=height(p.x,p.z)){lengths.push(d);break;}
      }
    }
    assert.equal(lengths.length,Math.round((hi-lo)/.002)+1);
    return Math.max(...lengths.slice(1).map((v,i)=>Math.abs(v-lengths[i])));
  });
}

test('overview rays no longer jump behind the outer shelf', () => {
  const before=paths(oldGround),after=paths(groundHeight);
  assert.ok(before.every(v=>v>10), 'the regression reproduces both original optical-depth jumps');
  assert.ok(after.every(v=>v<.5), `graded shelf remains continuous: ${after}`);
});
