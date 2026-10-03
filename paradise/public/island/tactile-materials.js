import * as THREE from './vendor/three.module.min.js';

export const TACTILE_SIZE = 256;
const cache = new Map(), mapped = new WeakMap();
const tau = Math.PI * 2, clamp = x => Math.max(0, Math.min(1, x));
const wave = (u, v, x, y, phase = 0) => Math.sin(tau * (u * x + v * y) + phase);

// Periodic, authored miniature surfaces. Mipmaps filter away the weave/grain
// in the wide shot; these are material maps, not overlays or scanned textures.
export function surfaceTexel(kind, u, v) {
  const broad = wave(u,v,2,3,.2)*.5 + wave(u,v,5,-4,1.4)*.3 + wave(u,v,11,9,.7)*.2;
  const pores = wave(u,v,29,37,.8)*wave(u,v,43,-23,2.2);
  if (kind === 'wood') {
    const bend = .23 * wave(u,v,1,2) + .09 * wave(u,v,3,-1,.7);
    const fiber = Math.sin(tau * (v * 13 + bend));
    const latewood = Math.max(0, fiber) ** 8;
    return { color: .97 - .14 * latewood + broad * .018,
      height: .5 + fiber * .13 + pores * .04, roughness: .87 + broad * .055 - latewood * .04 };
  }
  if (kind === 'linen') {
    const warp = .5 + .5 * wave(u,v,32,0), weft = .5 + .5 * wave(u,v,0,32);
    const over = wave(u,v,16,16), weave = Math.max(warp*(.7+.3*over),weft*(.7-.3*over));
    return { color: .91 + weave * .07 + broad * .012,
      height: .25 + weave * .47, roughness: .95 + pores * .025 };
  }
  if (kind === 'ceramic') return { color: .96 + broad * .025 + pores * .009,
    height: .5 + broad * .10 + pores * .10, roughness: .86 + broad * .07 + pores * .03 };
  if (kind === 'markercard') {
    // Cardstock colored with a broad felt-tip: overlapping pass streaks
    // (markers never lay down perfectly flat ink) over a fibrous paper
    // base. Added for WeylandAI's envelope/folder-tab UI object; kept
    // here rather than forked so any venture using tactile-materials
    // inherits it.
    const passA = wave(u,v,3,1,.4), passB = wave(u,v,1,-4,2.1), passC = wave(u,v,7,6,3.6);
    const streaks = Math.max(0, passA)*.5 + Math.max(0, passB)*.35 + Math.max(0, passC)*.15;
    const fiber = broad * .5 + pores * .5;
    return { color: .88 + streaks * .1 + fiber * .025,
      height: .5 + fiber * .06, roughness: .68 + streaks * .1 + fiber * .04 };
  }
  throw Error(`Unknown tactile surface: ${kind}`);
}

export function createSurfaceMaps(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const albedo = new Uint8Array(TACTILE_SIZE ** 2 * 4), packed = new Uint8Array(albedo.length);
  for (let y=0;y<TACTILE_SIZE;y++) for (let x=0;x<TACTILE_SIZE;x++) {
    const s=surfaceTexel(kind,x/TACTILE_SIZE,y/TACTILE_SIZE), i=(y*TACTILE_SIZE+x)*4;
    albedo[i]=albedo[i+1]=albedo[i+2]=Math.round(clamp(s.color)*255);albedo[i+3]=255;
    packed[i]=Math.round(clamp(s.height)*255);packed[i+1]=Math.round(clamp(s.roughness)*255);packed[i+2]=0;packed[i+3]=255;
  }
  function texture(data, colorSpace) {
    const t=new THREE.DataTexture(data,TACTILE_SIZE,TACTILE_SIZE,THREE.RGBAFormat);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;
    t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;
    t.anisotropy=4;t.colorSpace=colorSpace;t.needsUpdate=true;return t;
  }
  const result={map:texture(albedo,THREE.SRGBColorSpace),detail:texture(packed,THREE.NoColorSpace)};
  cache.set(kind,result);return result;
}

export function tactileMaterial(color, kind, roughness=.7) {
  const maps=createSurfaceMaps(kind);
  const material=new THREE.MeshStandardMaterial({color,roughness,metalness:0,
    map:maps.map,bumpMap:maps.detail,roughnessMap:maps.detail,
    bumpScale:kind==='linen'?.009:kind==='wood'?.012:.006});
  material.userData.tactile=kind;return material;
}

// Metric UVs are baked before static batching. Longest-axis fibers follow
// each individual plank/post rather than swimming through the whole island.
export function tactileGeometry(source) {
  if(mapped.has(source))return mapped.get(source);
  const g=source.clone();g.computeBoundingBox();
  const size=g.boundingBox.getSize(new THREE.Vector3()).toArray(), p=g.attributes.position,n=g.attributes.normal;
  if(!n)throw Error('Tactile geometry requires normals');
  const axis=size.indexOf(Math.max(...size)), uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const position=[p.getX(i),p.getY(i),p.getZ(i)], normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
    const face=normal.indexOf(Math.max(...normal)), axes=[0,1,2].filter(a=>a!==face);
    const along=axes.includes(axis)?axis:axes[0], across=axes.find(a=>a!==along);
    uv[i*2]=position[along];uv[i*2+1]=position[across];
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));mapped.set(source,g);return g;
}

// Closed fabric panels: a shallow drape and scalloped front hem, not rigid
// boards. Adjacent stripes use the same global surface so their seams meet.
export function createAwningPanelGeometry(panel, valance=false) {
  if(!Number.isInteger(panel)||panel<0||panel>=12)throw Error('Awning panel outside 0..11');
  const width=4.8, depth=3.05, nx=8, nz=valance?2:12, positions=[],uv=[],indices=[];
  const top=(x,t)=>3.56-.28*t-.12*Math.sin(Math.PI*t)-.065*(1-(x/(width/2))**2);
  for(let side=0;side<2;side++)for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const u=x/nx,t=z/nz,px=-width/2+(panel+u)*.4;
    const py=valance?top(px,1)-t*(.22+.08*Math.sin(Math.PI*u)):top(px,t);
    const pz=valance?1.425+(side?-.009:.009):-1.625+t*depth;
    positions.push(px,py+(valance?0:(side?-.009:.009)),pz);
    uv.push(px,valance?py:pz);
  }
  const stride=nx+1,layer=stride*(nz+1);
  function quad(a,b,c,d,reverse=false){if(reverse)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d);}
  for(let side=0;side<2;side++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const a=side*layer+z*stride+x;quad(a,a+stride,a+stride+1,a+1,!!side);
  }
  for(let x=0;x<nx;x++){quad(x,x+1,x+1+layer,x+layer);const a=nz*stride+x;quad(a+1,a,a+layer,a+1+layer);}
  for(let z=0;z<nz;z++){const a=z*stride,b=a+nx;quad(a+stride,a,a+layer,a+stride+layer);quad(b,b+stride,b+stride+layer,b+layer);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.metricUV=true;return geometry;
}
