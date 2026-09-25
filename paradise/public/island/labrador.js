import * as THREE from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {LEG,LEGS} from './locomotion.js';

// Authored vinyl/clay sculpture; the existing terrain-aware leg solver supplies
// its pose. Geometry is cached, while each instance has independent joints.
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.53,metalness:0});
const cache=new Map(),coat=new THREE.Color('#273331'),warm=new THREE.Color('#46514a');
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// Profile rows: longitudinal position, half-width, half-height, vertical center.
// Bounded cubic interpolation keeps taper tips from overshooting through zero.
function profileAt(profile,z){
  let i=1;while(i<profile.length-1&&z>profile[i][0])i++;
  const a=profile[i-1],b=profile[i],prev=profile[Math.max(0,i-2)],next=profile[Math.min(profile.length-1,i+1)];
  const span=b[0]-a[0],t=(z-a[0])/span,t2=t*t,t3=t2*t;
  return [1,2,3].map(k=>{
    const ma=(b[k]-prev[k])/(b[0]-prev[0])*span,mb=(next[k]-a[k])/(next[0]-a[0])*span;
    return THREE.MathUtils.clamp((2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*ma+(-2*t3+3*t2)*b[k]+(t3-t2)*mb,Math.min(a[k],b[k]),Math.max(a[k],b[k]));
  });
}

function loft(profile,{rows=36,around=40,shape,paint}={}){
  const first=profile[0],last=profile.at(-1),positions=[0,first[3],first[0]],colors=[],indices=[],c=new THREE.Color();
  function color(x,y,z){
    if(paint)paint(x,y,z,c);
    else c.copy(coat).lerp(warm,.08+.10*smooth(-.25,.35,y));
    c.toArray(colors,colors.length);
  }
  color(...positions);
  for(let i=1;i<rows;i++){
    const z=THREE.MathUtils.lerp(first[0],last[0],i/rows),[rx,ry,cy]=profileAt(profile,z);
    for(let j=0;j<around;j++){
      const a=j/around*Math.PI*2,p=shape?shape(z,a,rx,ry,cy):[Math.cos(a)*rx,cy+Math.sin(a)*ry,z];
      positions.push(...p);color(...p);
    }
  }
  const tip=positions.length/3;positions.push(0,last[3],last[0]);color(0,last[3],last[0]);
  for(let j=0;j<around;j++){
    const k=(j+1)%around;indices.push(0,1+k,1+j);
    for(let i=0;i<rows-2;i++){const a=1+i*around+j,b=1+i*around+k;indices.push(a,b,a+around,b,b+around,a+around);}
    const end=1+(rows-2)*around;indices.push(tip,end+j,end+k);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export function createLabradorHeadGeometry(){
  const nose=new THREE.Color('#151e1e'),nostril=new THREE.Color('#080e0e');
  const nostrilMask=(x,y,z)=>Math.exp(-(((Math.abs(x)-.073)/.03)**2)-(((y+.022)/.017)**2))*smooth(.55,.585,z);
  return loft([[-.33,0,0,-.005],[-.25,.215,.215,.005],[-.08,.295,.245,.012],[.08,.285,.245,.006],
    [.2,.235,.208,-.012],[.3,.195,.16,-.065],[.47,.192,.145,-.072],[.565,.15,.108,-.048],[.615,0,0,-.035]],
  {rows:48,around:48,shape:(z,a,rx,ry,cy)=>{
    const power=1-.22*smooth(.18,.38,z),ca=Math.cos(a),sa=Math.sin(a);
    const x=Math.sign(ca)*Math.abs(ca)**power*rx,y=cy+Math.sign(sa)*Math.abs(sa)**power*ry;
    return [x,y,z-.005*nostrilMask(x,y,z)];
  },paint:(x,y,z,c)=>c.copy(coat).lerp(warm,.10+.09*smooth(-.15,.25,y)).lerp(nose,smooth(.51,.57,z)).lerp(nostril,nostrilMask(x,y,z))});
}

export function createLabradorEarGeometry(){
  const g=loft([[0,0,0,0],[.045,.098,.057,0],[.14,.145,.061,.025],[.28,.142,.045,.06],[.39,.09,.032,.085],[.455,0,0,.09]],
    {rows:28,around:24,shape:(z,a,rx,ry,cy)=>[Math.cos(a)*rx+.024*Math.sin(z*7),cy+Math.sin(a)*ry,z]});
  return g.rotateX(Math.PI/2);
}

export function createLabradorTailGeometry(){
  const g=loft([[0,0,0,0],[.05,.107,.095,0],[.19,.095,.085,.02],[.43,.073,.064,-.015],
    [.65,.05,.045,-.075],[.82,.029,.025,-.17],[.94,0,0,-.22]],{rows:36,around:24});
  return g.rotateY(Math.PI);
}

const torsoProfile=[[-.86,0,0,.02],[-.76,.23,.27,.03],[-.55,.325,.34,.055],[-.3,.315,.30,.10],
  [-.08,.31,.31,.075],[.17,.37,.405,.025],[.4,.385,.44,.015],[.57,.315,.405,.075],[.69,.18,.26,.20],[.76,0,0,.28]];
const softUnion=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function skinField(x,y,z){
  let d;
  if(z<=-.86)d=Math.hypot(x,y-.02,z+.86);
  else if(z>=.76)d=Math.hypot(x,y-.28,z-.76);
  else{const [rx,ry,cy]=profileAt(torsoProfile,z);d=(Math.hypot(x/Math.max(rx,.001),(y-cy)/Math.max(ry,.001))-1)*Math.min(rx,ry);}
  for(const leg of LEGS){
    const along=THREE.MathUtils.clamp((-.04-y)/.72,0,1),cy=-.04-along*.72;
    const radius=along<.5?THREE.MathUtils.lerp(leg.z<0?.155:.12,.075,along*2):THREE.MathUtils.lerp(.075,.06,(along-.5)*2);
    d=softUnion(d,Math.hypot(x-leg.x,y-cy,z-leg.z)-radius,.10);
    const q=[(x-leg.x)/.125,(y+.76)/.065,(z-leg.z-.045)/.17];
    const k0=Math.hypot(...q),k1=Math.hypot(q[0]/.125,q[1]/.065,q[2]/.17);
    const paw=k1>1e-8?k0*(k0-1)/k1:-.065;d=softUnion(d,paw,.055);
  }
  return d;
}

// Indexed marching tetrahedra turn the authored body/limb field into a single
// watertight skin. This runs once per page, not in the animation loop.
export function createLabradorSkinGeometry(){
  const n=[32,40,52],lo=[-.64,-.90,-1.02],hi=[.64,.70,1.06],points=[],values=[];
  const id=(x,y,z)=>(z*(n[1]+1)+y)*(n[0]+1)+x;
  for(let z=0;z<=n[2];z++)for(let y=0;y<=n[1];y++)for(let x=0;x<=n[0];x++){
    const p=[x,y,z].map((v,i)=>lo[i]+(hi[i]-lo[i])*v/n[i]);points.push(p);values.push(skinField(...p));
  }
  const positions=[],indices=[],colors=[],skinIndices=[],weights=[],edges=new Map(),c=new THREE.Color();
  function vertex(a,b){
    // An isosurface can pass through a grid node. All incident tetrahedra must
    // share that vertex, not create coincident sliver faces for each edge.
    const node=Math.abs(values[a])<1e-10?a:Math.abs(values[b])<1e-10?b:null;
    const key=node!==null?`node:${node}`:a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))return edges.get(key);
    const t=values[a]/(values[a]-values[b]),p=node!==null?points[node]:points[a].map((v,i)=>v+(points[b][i]-v)*t),index=positions.length/3;
    positions.push(...p);c.copy(coat).lerp(warm,.08+.10*smooth(-.25,.35,p[1])).toArray(colors,colors.length);
    let leg=0,best=Infinity;LEGS.forEach((l,i)=>{const d=(p[0]-l.x)**2+(p[2]-l.z)**2;if(d<best){best=d;leg=i;}});
    const shoulder=smooth(.07,.21,Math.abs(p[0]))*(1-smooth(-.25,-.04,p[1]))*(1-smooth(.12,.32,Math.abs(p[2]-LEGS[leg].z)));
    const influence=THREE.MathUtils.lerp(1,shoulder,smooth(-.52,-.25,p[1]));
    const knee=1-smooth(-.51,-.30,p[1]),pad=1-smooth(-.77,-.64,p[1]);
    skinIndices.push(0,1+leg*3,2+leg*3,3+leg*3);
    weights.push(1-influence,influence*(1-knee),influence*knee*(1-pad),influence*knee*pad);edges.set(key,index);return index;
  }
  function triangle(a,b,c,direction){
    if(a===b||b===c||c===a)return;
    const p=positions.slice(a*3,a*3+3),q=positions.slice(b*3,b*3+3).map((v,i)=>v-p[i]),r=positions.slice(c*3,c*3+3).map((v,i)=>v-p[i]);
    const dot=(q[1]*r[2]-q[2]*r[1])*direction[0]+(q[2]*r[0]-q[0]*r[2])*direction[1]+(q[0]*r[1]-q[1]*r[0])*direction[2];
    indices.push(a,dot>0?b:c,dot>0?c:b);
  }
  const tets=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
  for(let z=0;z<n[2];z++)for(let y=0;y<n[1];y++)for(let x=0;x<n[0];x++){
    const cube=Array.from({length:8},(_,i)=>id(x+(i&1),y+((i>>1)&1),z+((i>>2)&1)));
    if(cube.every(i=>values[i]>=0)||cube.every(i=>values[i]<0))continue;
    for(const tet of tets){const inside=tet.map(i=>cube[i]).filter(i=>values[i]<0),outside=tet.map(i=>cube[i]).filter(i=>values[i]>=0);
      if(!inside.length||!outside.length)continue;
      const dir=[0,1,2].map(c=>outside.reduce((s,i)=>s+points[i][c],0)/outside.length-inside.reduce((s,i)=>s+points[i][c],0)/inside.length);
      if(inside.length===1||outside.length===1){const one=inside.length===1?inside:outside,many=inside.length===1?outside:inside;
        triangle(...many.map(i=>vertex(one[0],i)),dir);
      }else{const [a,b]=inside,[c,d]=outside,ac=vertex(a,c),ad=vertex(a,d),bc=vertex(b,c),bd=vertex(b,d);triangle(ac,ad,bc,dir);triangle(ad,bd,bc,dir);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(indices);
  // Sample the smooth field rather than exposing the tetrahedra's diagonal
  // pattern as a faceted highlight on the coat and small curved paws.
  const normals=[],h=.0002;
  for(let i=0;i<positions.length;i+=3){const [x,y,z]=positions.slice(i,i+3);
    const normal=new THREE.Vector3(skinField(x+h,y,z)-skinField(x-h,y,z),skinField(x,y+h,z)-skinField(x,y-h,z),skinField(x,y,z+h)-skinField(x,y,z-h)).normalize();
    normal.toArray(normals,normals.length);
  }
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function paint(g,color){const c=new THREE.Color(color),data=[];for(let i=0;i<g.attributes.position.count;i++)c.toArray(data,i*3);g.setAttribute('color',new THREE.Float32BufferAttribute(data,3));g.deleteAttribute('uv');return g;}
function oval(scale,position,color){const g=new THREE.SphereGeometry(1,16,10);g.scale(...scale);g.translate(...position);return paint(g,color);}
function cord(points,r,color){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,6,false);return paint(g,color);}
function group(parent,position=[0,0,0],bone=false){const g=bone?new THREE.Bone():new THREE.Group();g.position.fromArray(position);parent.add(g);return g;}
function sculpt(parent,name,build){
  if(!cache.has(name)){const parts=build();parts.forEach(g=>g.deleteAttribute('uv'));const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();cache.set(name,g);}
  const m=new THREE.Mesh(cache.get(name),material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}

export function createLabrador(parent){
  const g=group(parent),body=group(g,[0,.76,0],true),neck=group(body,[0,.3,.52]),head=group(neck,[0,.22,.12]);
  g.name='Black Labrador / sculpted clay companion';
  sculpt(neck,'labrador-neck-collar',()=>{
    const neckGeo=loft([[-.23,0,0,.055],[-.15,.23,.235,.025],[.02,.24,.25,-.045],[.19,.20,.215,-.075],[.3,0,0,-.07]],{rows:24,around:32}).rotateX(-Math.PI/2);
    const collar=paint(new THREE.TorusGeometry(.238,.031,10,48),'#bd765b');collar.rotateX(Math.PI/2);collar.translate(0,.065,.056);
    return [neckGeo,collar,oval([.07,.081,.018],[0,-.021,.317],'#d5b56e'),oval([.018,.021,.01],[0,-.014,.335],'#786445')];
  });
  sculpt(head,'labrador-face',()=>[createLabradorHeadGeometry(),
    cord([[-.165,-.137,.27],[-.177,-.153,.39],[-.123,-.169,.515],[0,-.158,.566],[.123,-.169,.515],[.177,-.153,.39],[.165,-.137,.27]],.0065,'#101919')]);
  const ears=[],eyes=[];
  for(const side of [-1,1]){
    const ear=group(head,[side*.275,.135,-.085]);ear.rotation.z=side*.2;ears.push(ear);
    sculpt(ear,'labrador-ear',()=>[createLabradorEarGeometry()]);
    const eye=group(head,[side*.235,.095,.161]);eye.rotation.y=side*.62;eyes.push(eye);
    sculpt(eye,'labrador-eye',()=>[oval([.044,.032,.012],[0,0,0],'#17221f'),oval([.025,.023,.006],[0,0,.009],'#8d693e'),
      oval([.013,.018,.004],[0,0,.014],'#101716'),oval([.005,.006,.002],[-.007,.009,.018],'#e8e3c8')]);
  }
  const legs=[];
  for(const spec of LEGS){
    const hip=group(body,[spec.x,-.04,spec.z],true),knee=group(hip,[0,-LEG.upper,0],true),paw=group(knee,[0,-LEG.lower,0],true);
    legs.push({hip,knee,paw,id:spec.id});
  }
  if(!cache.has('labrador-skin'))cache.set('labrador-skin',createLabradorSkinGeometry());
  const skin=new THREE.SkinnedMesh(cache.get('labrador-skin'),material);skin.name='labrador-continuous-skin';skin.castShadow=true;skin.receiveShadow=true;skin.frustumCulled=false;body.add(skin);
  g.updateWorldMatrix(true,true);skin.bind(new THREE.Skeleton([body,...legs.flatMap(l=>[l.hip,l.knee,l.paw])]));
  const tail=group(body,[0,.12,-.70]);sculpt(tail,'labrador-otter-tail',()=>[createLabradorTailGeometry()]);
  let meshes=0,triangles=0;g.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index.count/3;}});
  return {g,body,head,neck,ears,eyes,legs,tail,skin,evidence:()=>({meshes,triangles,materials:1,bones:skin.skeleton.bones.length,headYaw:head.rotation.y,headPitch:head.rotation.x,tailYaw:tail.rotation.y,blink:eyes[0].scale.y})};
}
