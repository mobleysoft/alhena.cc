import * as THREE from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Authored clay miniature. No scans, portrait data, or external model service.
const palette={skin:'#bc8661',blush:'#ba7363',hair:'#3f362d',jade:'#397d74',linen:'#eee1c2',ink:'#253534',wood:'#967552',gold:'#d6b870'};
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.66,metalness:0});
const cache=new Map(), clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const gaussian=(x,y)=>Math.exp(-x*x-y*y);

function geometry(positions,indices,colors){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function rings(rows,bottom,top,point,colorAt,around=48){
  const positions=[...bottom],indices=[],colors=[],color=new THREE.Color();
  colorAt(...bottom,color).toArray(colors,0);
  for(let i=0;i<rows;i++)for(let j=0;j<around;j++){
    const p=point(i,j/around*Math.PI*2);positions.push(...p);colorAt(...p,color).toArray(colors,colors.length);
  }
  const tip=positions.length/3;positions.push(...top);colorAt(...top,color).toArray(colors,colors.length);
  for(let j=0;j<around;j++){
    const k=(j+1)%around;indices.push(0,1+k,1+j);
    for(let i=0;i<rows-1;i++){const a=1+i*around+j,b=1+i*around+k;indices.push(a,b,a+around,b,b+around,a+around);}
    const last=1+(rows-1)*around;indices.push(tip,last+j,last+k);
  }
  return geometry(positions,indices,colors);
}

export function createHostHeadGeometry(){
  const skin=new THREE.Color(palette.skin),blush=new THREE.Color(palette.blush);
  return rings(47,[0,-.365,0],[0,.365,0],(i,a)=>{
    const t=(i+1)/48,y=-.365*Math.cos(t*Math.PI),r=Math.sin(t*Math.PI);
    const x=.318*r*Math.sin(a)*(1-.24*smooth(.01,-.34,y)),front=Math.max(0,Math.cos(a));
    let z=.285*r*Math.cos(a);
    z+=front**8*(.071*gaussian(x/.046,(y+.045)/.09)+.017*gaussian(x/.1,(y+.15)/.07));
    for(const side of [-1,1])z+=front**4*(.011*gaussian((x-side*.17)/.09,(y+.085)/.065)-.009*gaussian((x-side*.108)/.052,(y-.028)/.044));
    return [x,y,z];
  },(x,y,z,c)=>c.copy(skin).lerp(blush,(gaussian((x-.17)/.065,(y+.085)/.065)+gaussian((x+.17)/.065,(y+.085)/.065))*.28*smooth(.1,.24,z)),64);
}

export function createHostHairGeometry(){
  const hair=new THREE.Color(palette.hair),warm=new THREE.Color('#65503b');
  return rings(25,[0,-.09,-.045],[0,.398,-.02],(i,a)=>{
    const u=1-i/25,front=Math.max(0,Math.cos(a));
    const edge=-.145+.32*front*front+.06*Math.sin(a)*front;
    const theta=Math.acos(edge/.398)*u,flute=.004*Math.sin(14*a+u*3)*Math.sin(theta);
    return [(.337+flute)*Math.sin(theta)*Math.sin(a),.398*Math.cos(theta)+.018*Math.sin(theta)*front,(.306+flute)*Math.sin(theta)*Math.cos(a)-.02];
  },(x,y,z,c)=>c.copy(hair).lerp(warm,.14+.12*Math.sin(Math.atan2(x,z+.02)*14+y*7)));
}

const dressProfile=[[0,.455],[.07,.475],[.27,.431],[.52,.365],[.77,.292],[.94,.276],[1.12,.302],[1.25,.281],[1.39,.137]];
function dressRadius(y){
  for(let i=1;i<dressProfile.length;i++)if(y<=dressProfile[i][0]){
    const [a,r]=dressProfile[i-1],[b,s]=dressProfile[i];return THREE.MathUtils.lerp(r,s,smooth(a,b,y));
  }return dressProfile.at(-1)[1];
}
export function createHostDressGeometry(){
  const base=new THREE.Color(palette.jade),light=new THREE.Color('#508d7c');
  return rings(31,[0,0,0],[0,1.392,0],(i,a)=>{
    const y=i/30*1.39,fold=.012*Math.cos(a*10+.3)* (1-smooth(.15,.85,y)),r=dressRadius(y)+fold;
    return [Math.sin(a)*r,y,Math.cos(a)*r*.68];
  },(x,y,z,c)=>c.copy(base).lerp(light,.12+.08*Math.cos(Math.atan2(x,z/.68)*10)));
}

export function createHostApronGeometry(){
  const nx=16,ny=24,row=nx+1,side=row*(ny+1),positions=[],colors=[],indices=[];
  const linen=new THREE.Color(palette.linen),shade=new THREE.Color('#d8c9a7'),c=new THREE.Color();
  for(let layer=0;layer<2;layer++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const v=j/ny,u=i/nx*2-1,y=.18+v*1.04;
    const width=.285-.125*smooth(.12,.93,v),x=u*width,r=dressRadius(y);
    const z=Math.sqrt(Math.max(0,r*r-x*x))*.68+.024+.004*Math.cos(u*9)*(1-v)-layer*.014;
    positions.push(x,y,z);c.copy(linen).lerp(shade,.045+.06*Math.cos(u*9)*(1-v)).toArray(colors,colors.length);
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const a=j*row+i,b=a+1,d=a+row,e=d+1;indices.push(a,b,d,b,e,d,a+side,d+side,b+side,b+side,d+side,e+side);
  }
  const edge=[];for(let i=0;i<=nx;i++)edge.push(i);for(let j=1;j<=ny;j++)edge.push(j*row+nx);
  for(let i=nx-1;i>=0;i--)edge.push(ny*row+i);for(let j=ny-1;j>0;j--)edge.push(j*row);
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,a+side,b,b,a+side,b+side);}
  return geometry(positions,indices,colors);
}

function paint(g,color){
  if(color){const c=new THREE.Color(color),values=[];for(let i=0;i<g.attributes.position.count;i++)c.toArray(values,i*3);g.setAttribute('color',new THREE.Float32BufferAttribute(values,3));}
  g.deleteAttribute('uv');return g;
}
function oval(scale,position,color){const g=new THREE.SphereGeometry(1,16,10);g.scale(...scale);g.translate(...position);return paint(g,color);}
function cord(points,r,color){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),frames=curve.computeFrenetFrames(24,false),c=new THREE.Color(color);
  return rings(23,curve.getPointAt(0).toArray(),curve.getPointAt(1).toArray(),(i,a)=>{
    const t=(i+1)/24,p=curve.getPointAt(t),radius=r*Math.sin(t*Math.PI)**.25;
    return p.addScaledVector(frames.normals[i+1],Math.cos(a)*radius).addScaledVector(frames.binormals[i+1],Math.sin(a)*radius).toArray();
  },(_x,_y,_z,out)=>out.copy(c),8);
}
function batch(name,parts){
  if(!cache.has(name)){const list=parts();const g=mergeGeometries(list);list.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();cache.set(name,g);}
  return cache.get(name);
}
function sculpt(parent,name,parts){const m=new THREE.Mesh(batch(name,parts),material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function group(parent,position=[0,0,0]){const g=new THREE.Group();g.position.fromArray(position);parent.add(g);return g;}

export function createHost(parent){
  const g=group(parent),body=group(g,[0,.85,0]),head=group(body,[0,1.64,0]),eyes=[],arms=[];
  g.name='Alhena / sculpted clay host';
  sculpt(body,'host-dress',()=>[createHostDressGeometry(),createHostApronGeometry(),
    oval([.12,.19,.105],[0,1.4,0],palette.skin),
    cord([[-.13,1.2,.205],[-.17,1.32,.153],[-.19,1.34,.02]],.017,palette.linen),
    cord([[.13,1.2,.205],[.17,1.32,.153],[.19,1.34,.02]],.017,palette.linen),
    cord([[-.13,.65,.211],[0,.64,.238],[.13,.65,.211]],.009,'#b8ac90'),
    oval([.025,.025,.018],[-.14,1.15,.21],palette.gold),oval([.025,.025,.018],[.14,1.15,.21],palette.gold)]);
  sculpt(head,'host-face',()=>{
    const parts=[createHostHeadGeometry(),createHostHairGeometry(),oval([.175,.195,.16],[.015,.22,-.285],palette.hair)];
    for(const side of [-1,1]){
      parts.push(oval([.059,.095,.048],[side*.295,-.035,-.016],palette.skin));
      parts.push(oval([.019,.035,.014],[side*.327,-.04,.018],palette.blush));
      parts.push(oval([.021,.027,.02],[side*.324,-.113,.01],palette.gold));
      parts.push(cord([[side*.065,.106,.273],[side*.105,.116,.266],[side*.151,.098,.247]],.01,palette.hair));
    }
    parts.push(cord([[-.061,-.132,.286],[-.032,-.151,.31],[0,-.156,.315],[.034,-.15,.31],[.061,-.129,.285]],.009,'#8d5849'));
    return parts;
  });
  for(const side of [-1,1]){
    const eye=group(head,[side*.108,.024,.265]);eyes.push(eye);
    sculpt(eye,'host-eye',()=>[oval([.027,.035,.018],[0,0,0],palette.ink),oval([.006,.008,.005],[-.006,.012,.016],'#f8ecd4')]);
    const arm=group(body,[side*.29,1.12,0]);arm.rotation.z=side*.23;arms.push(arm);
    sculpt(arm,`host-arm-${side}`,()=>[oval([.128,.145,.14],[0,-.065,0],palette.jade),
      oval([.098,.27,.108],[0,-.24,.005],palette.skin),oval([.086,.25,.092],[0,-.56,.085],palette.skin),
      oval([.09,.11,.075],[0,-.77,.135],palette.skin),oval([.036,.068,.043],[-side*.071,-.735,.16],palette.skin)]);
  }
  sculpt(g,'host-shoes',()=>[-1,1].flatMap(side=>[
    oval([.072,.32,.072],[side*.18,.6,0],palette.skin),oval([.13,.079,.205],[side*.18,.268,.065],palette.wood),
    cord([[side*.18-.105,.298,.095],[side*.18,.337,.1],[side*.18+.105,.298,.095]],.023,palette.linen)]));
  let meshes=0,triangles=0;g.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index.count/3;}});
  return {g,body,head,arms,eyes,evidence:()=>({meshes,triangles,headYaw:head.rotation.y,blink:eyes[0].scale.y,greetingArm:arms[1].rotation.z})};
}
