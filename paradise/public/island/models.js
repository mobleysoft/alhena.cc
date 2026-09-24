import * as THREE from './vendor/three.module.min.js';
import { groundHeight, makeSandMaterial } from './ocean.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { createQuadruped, LEG, LEGS } from './locomotion.js';

const clay = (color, roughness=.7) => new THREE.MeshStandardMaterial({color,roughness,metalness:0});
const mat = {
  cream:clay('#f4ead1'), coral:clay('#bb6952'), roof:clay('#d48b6a'), wood:clay('#967552'), lightWood:clay('#c8a476'),
  green:clay('#496e50'), leaf:clay('#698753'), mint:clay('#89ae9a'), jade:clay('#397d74'), gold:clay('#d6b870',.4),
  dark:clay('#203233'), black:clay('#252d2b',.49), skin:clay('#bc8661'), hair:clay('#353228'), pink:clay('#d88b80'),
  glass:new THREE.MeshStandardMaterial({color:'#2d6b65',roughness:.18,metalness:.2}),
  lamp:new THREE.MeshStandardMaterial({color:'#ffeac1',emissive:'#ffd29a',emissiveIntensity:1.1,roughness:.45}),
};
const geoCache=new Map();
function rounded(w,h,d,r=.08) {
  const key=[w,h,d,r].join(','); if(geoCache.has(key)) return geoCache.get(key);
  r=Math.min(r,w*.45,h*.45,d*.45);
  const shape=new THREE.Shape(), x=-w/2+r,y=-h/2+r;
  shape.moveTo(x,y); shape.lineTo(x+w-2*r,y); shape.lineTo(x+w-2*r,y+h-2*r); shape.lineTo(x,y+h-2*r); shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r,curveSegments:3});
  geo.translate(0,0,-d/2+r); geoCache.set(key,geo); return geo;
}
function mesh(parent,geo,material,x=0,y=0,z=0) {
  const obj=new THREE.Mesh(geo,material); obj.position.set(x,y,z); obj.castShadow=true; obj.receiveShadow=true; parent.add(obj); return obj;
}
function box(parent,w,h,d,material,x=0,y=0,z=0,r=.07) { return mesh(parent,rounded(w,h,d,r),material,x,y,z); }
const sphereGeo=new THREE.SphereGeometry(1,24,16);
function oval(parent,sx,sy,sz,material,x=0,y=0,z=0) {const m=mesh(parent,sphereGeo,material,x,y,z);m.scale.set(sx,sy,sz);return m;}
function cylinder(parent,rt,rb,h,material,x=0,y=0,z=0) {return mesh(parent,new THREE.CylinderGeometry(rt,rb,h,20),material,x,y,z);}
function tube(parent,points,r,material) {return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,r,7,false),material);}
function group(parent,x=0,y=0,z=0) {const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function label(parent,text,w,h,x,y,z,bg='#f4ead1',color='#36564c') {
  const c=document.createElement('canvas');c.width=768;c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 80px Georgia';ctx.fillText(text,384,130);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  return mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.8}),x,y,z);
}

function house(parent,x,z) {
  const g=group(parent,x,groundHeight(x,z),z);g.rotation.y=.18;
  box(g,4.9,.25,4.6,mat.lightWood,0,.12,0);
  box(g,4.1,2.8,3.5,mat.cream,0,1.57,-.2,.15);
  for(let i=0;i<9;i++) box(g,4.12,.028,.035,mat.lightWood,0,.46+i*.28,1.57,.006);
  box(g,.95,1.95,.12,mat.jade,.85,1.26,1.62);
  cylinder(g,.045,.045,.05,mat.gold,1.16,1.29,1.72).rotation.x=Math.PI/2;
  for(const xw of [-1.2]) {
    box(g,1.25,1.15,.1,mat.wood,xw,1.87,1.66);box(g,1.05,.96,.13,mat.glass,xw,1.87,1.73);
    box(g,.045,1,.04,mat.cream,xw,1.87,1.81);box(g,1.07,.05,.04,mat.cream,xw,1.87,1.81);
    for(const d of [-.88,.88]) {box(g,.4,1.28,.1,mat.mint,xw+d,1.87,1.7);for(let i=0;i<6;i++)box(g,.32,.05,.04,mat.jade,xw+d,1.39+i*.18,1.77,.01);}
    box(g,1.36,.3,.46,mat.coral,xw,1.14,1.86);for(let i=0;i<7;i++)oval(g,.17,.24,.18,mat.green,xw-.5+i*.17,1.38,1.89);
  }
  for(const side of [-1,1]) {
    const roof=box(g,2.6,.2,4.6,mat.roof,side*1.1,3.24,-.2,.09);roof.rotation.z=-side*.36;
    for(let i=0;i<13;i++) {const rib=box(g,2.58,.055,.1,mat.coral,side*1.1,3.37,-2.3+i*.34,.02);rib.rotation.z=-side*.36;}
  }
  tube(g,[[0,3.7,-2.52],[0,3.73,0],[0,3.7,2.15]],.12,mat.coral);
  box(g,1.5,.18,.64,mat.lightWood,.75,.08,2.6);box(g,1.8,.14,.65,mat.lightWood,.75,-.05,3.05);
  label(g,'THE SLOW HOUSE',2.25,.5,0,2.81,1.65);
  return g;
}

function palm(parent,x,z,height=6,rotation=0) {
  const base=groundHeight(x,z), g=group(parent,x,base,z);g.rotation.y=rotation;
  tube(g,[[0,0,0],[-.3,height*.35,.1],[-.1,height*.7,.2],[.5,height,.15]],.19,mat.wood);
  for(let i=1;i<9;i++){const band=cylinder(g,.199,.202,.035,mat.lightWood,-.2+Math.max(0,i-5)*.15,height*i/10,.13);band.rotation.z=-.1;}
  const crown=group(g,.5,height,.15), fronds=[];
  for(let j=0;j<8;j++) {
    const arm=group(crown);arm.rotation.y=j*Math.PI/4;
    const geo=new THREE.PlaneGeometry(1,1,8,14), pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const u=pos.getX(i)*2,v=pos.getY(i)+.5;const width=Math.sin(v*Math.PI)*.7;
      pos.setXYZ(i,u*width,.9*Math.sin(v*Math.PI)-v*.85-u*u*.1,v*3.15);}
    geo.computeVertexNormals(); const leafMat=(j%2?mat.green:mat.leaf).clone();leafMat.side=THREE.DoubleSide;
    mesh(arm,geo,leafMat);tube(arm,[[0,0,0],[0,.54,1],[0,.25,2],[0,-.84,3.15]],.024,mat.mint);fronds.push(arm);
  }
  for(let j=0;j<3;j++)oval(crown,.2,.26,.2,mat.wood,Math.sin(j*2)*.27,-.12,Math.cos(j*2)*.27);
  return {g,fronds};
}

function person(parent) {
  const g=group(parent), body=group(g,0,.85,0);
  const skirt=new THREE.LatheGeometry([new THREE.Vector2(.46,0),new THREE.Vector2(.5,.08),new THREE.Vector2(.43,.25),new THREE.Vector2(.28,.85),new THREE.Vector2(.29,1)],32);
  mesh(body,skirt,mat.jade);oval(body,.31,.46,.22,mat.jade,0,1.0,0);
  box(body,.41,.77,.045,mat.cream,0,.72,.25,.045);
  const head=group(body,0,1.64,0);oval(head,.32,.37,.29,mat.skin);
  oval(head,.35,.25,.3,mat.hair,0,.19,-.025);oval(head,.2,.21,.2,mat.hair,0,.34,-.25);
  const eyes=[];
  for(const sx of [-1,1]) {oval(head,.065,.11,.07,mat.skin,sx*.3,-.03,0);const eye=group(head,sx*.108,.015,.272);oval(eye,.026,.038,.017,mat.dark);eyes.push(eye);oval(head,.035,.043,.012,mat.pink,sx*.18,-.09,.256);}
  oval(head,.043,.055,.037,mat.skin,0,-.055,.29);
  const smile=mesh(head,new THREE.TorusGeometry(.071,.009,6,14,Math.PI),mat.coral,0,-.12,.266);smile.rotation.z=Math.PI;
  const arms=[];
  for(const side of [-1,1]){const arm=group(body,side*.29,1.12,0);arm.rotation.z=side*.23;
    oval(arm,.115,.3,.12,mat.skin,0,-.2,0);oval(arm,.103,.26,.1,mat.skin,0,-.56,.1);oval(arm,.105,.12,.1,mat.skin,0,-.77,.14);arms.push(arm);}
  for(const x of [-.18,.18]){cylinder(g,.07,.07,.64,mat.skin,x,.61,0);oval(g,.13,.09,.22,mat.wood,x,.27,.05);}
  return {g,head,arms,body,eyes};
}

function beachBar(parent,x,z) {
  const g=group(parent,x,groundHeight(x,z),z);g.rotation.y=-.18;
  box(g,5,.2,3.6,mat.lightWood,0,.1,0);
  box(g,3.8,1.18,1.25,mat.jade,0,.78,.45,.13);
  for(let i=0;i<15;i++)box(g,.11,1.03,.045,mat.mint,-1.71+i*.244,.78,1.08,.025);
  box(g,4.15,.17,1.55,mat.cream,0,1.42,.45,.08);
  label(g,'ALHENA',1.9,.48,0,.91,1.12,'#397d74','#f4ead1');
  for(const xp of [-2.05,2.05]) cylinder(g,.065,.07,3.3,mat.wood,xp,1.76,-.6);
  for(let i=0;i<12;i++) {
    const canopy=box(g,.4,.09,3.05,i%2?mat.cream:mat.mint,-2.2+i*.4,3.47,-.1,.035);canopy.rotation.x=.1;
    box(g,.4,.25,.09,i%2?mat.cream:mat.mint,-2.2+i*.4,3.17,1.42,.04);
  }
  for(let i=0;i<4;i++){const xp=-1.35+i*.38;cylinder(g,.06,.07,.35,i%2?mat.glass:mat.coral,xp,1.67,.5);cylinder(g,.035,.035,.1,mat.gold,xp,1.89,.5);}
  cylinder(g,.19,.16,.24,mat.cream,.8,1.64,.65);mesh(g,new THREE.TorusGeometry(.1,.028,7,16),mat.cream,1,1.65,.65);
  const actor=person(g);actor.g.position.set(-2.15,-.23,1.7);
  for(const xp of [-1.2,1.2]){const seat=group(g,xp,0,2);cylinder(seat,.34,.34,.14,mat.coral,0,1,0);for(const d of [-1,1])for(const e of [-1,1])cylinder(seat,.045,.045,.92,mat.wood,d*.21,.48,e*.21);}
  return {g,actor};
}

function lab(parent) {
  const g=group(parent), body=group(g,0,.76,0);
  oval(body,.38,.4,.75,mat.black);oval(body,.36,.47,.38,mat.black,0,.02,.43);
  const neck=group(body,0,.3,.52), head=group(neck,0,.22,.12);
  oval(head,.33,.33,.36,mat.black);oval(head,.22,.16,.28,mat.black,0,-.07,.3);oval(head,.15,.1,.08,mat.dark,0,-.04,.55);
  const ears=[];
  for(const side of [-1,1]){const ear=oval(head,.14,.28,.13,mat.black,side*.28,-.06,-.02);ear.rotation.z=side*.24;ears.push(ear);
    oval(head,.035,.036,.023,mat.gold,side*.175,.05,.27);oval(head,.019,.024,.014,mat.dark,side*.18,.051,.288);}
  const collar=mesh(neck,new THREE.TorusGeometry(.235,.038,9,28),mat.coral,0,.02,.015);collar.rotation.x=Math.PI/2;
  oval(neck,.067,.08,.02,mat.gold,0,-.08,.255);
  const legs=[];
  for(const spec of LEGS) {
    const hip=group(body,spec.x,-.04,spec.z);oval(hip,spec.z<0?.14:.115,LEG.upper*.58,.12,mat.black,0,-LEG.upper/2,0);
    const knee=group(hip,0,-LEG.upper,0);oval(knee,.088,.085,.087,mat.black);
    oval(knee,.078,LEG.lower*.56,.08,mat.black,0,-LEG.lower/2,0);
    const paw=group(knee,0,-LEG.lower,0);oval(paw,.12,LEG.pad,.16,mat.black,0,0,.025);
    for(const toe of [-1,0,1])oval(paw,.034,.033,.065,mat.black,toe*.058,-.013,.13);
    legs.push({hip,knee,paw,id:spec.id});
  }
  const tail=group(body,0,.12,-.63);tube(tail,[[0,0,0],[0,.02,-.28],[.13,.18,-.6],[.2,.4,-.78]],.065,mat.black);
  g.rotation.y=-.6;return {g,body,head,neck,ears,legs,tail};
}

function jetty(parent) {
  const g=group(parent,1,0,10);g.rotation.y=Math.PI;
  for(let j=0;j<22;j++){const z=1.4-j*.3;box(g,2.1,.12,.27,mat.lightWood,0,.75,z,.045);
    for(const x of [-.75,.75])oval(g,.025,.008,.025,mat.dark,x,.815,z);}
  for(const x of [-.73,.73])box(g,.16,.24,7,mat.wood,x,.56,-1.75);
  for(const x of [-1,1])for(const z of [1.4,-1.5,-4.6]){cylinder(g,.09,.11,2.2,mat.wood,x,.15,z);cylinder(g,.12,.12,.08,mat.lightWood,x,1.28,z);}
  tube(g,[[-1,1.25,1.4],[-1,1.02,-.05],[-1,1.25,-1.5],[-1,1.02,-3.05],[-1,1.25,-4.6]],.027,mat.cream);
  const float=mesh(g,new THREE.TorusGeometry(.35,.1,10,32),mat.coral,1.16,.65,-2.8);float.rotation.y=Math.PI/2;
  box(g,.65,.5,.5,mat.jade,-.4,1.04,-3.2,.08);box(g,.68,.08,.55,mat.cream,-.4,1.32,-3.2,.03);
  return g;
}

function umbrella(parent,x,z) {
  const g=group(parent,x,groundHeight(x,z),z);cylinder(g,.048,.048,3,mat.lightWood,0,1.5,0);
  for(let i=0;i<10;i++) {
    const geo=new THREE.SphereGeometry(1.5,7,6,i*Math.PI/5,Math.PI/5,0,Math.PI/2);
    geo.scale(1,.38,1);const m=mesh(g,geo,i%2?mat.cream:mat.coral,0,2.9,0);m.material=m.material.clone();m.material.side=THREE.DoubleSide;
  }
  oval(g,.07,.09,.07,mat.gold,0,3.5,0);
  for(const offset of [-.75,.75]){const chair=group(g,offset,0,.5);chair.rotation.y=.15;
    box(chair,.65,.1,1.4,mat.cream,0,.4,0);const back=box(chair,.65,1,.07,mat.mint,0,.93,-.62);back.rotation.x=-.25;
    for(const xp of [-.28,.28])for(const zz of [-.52,.52])cylinder(chair,.035,.035,.4,mat.wood,xp,.2,zz);}
  return g;
}

export function createIsland(scene,timeUniform,optics) {
  const world=group(scene);world.name='Sculpted cove';
  const groundGeo=new THREE.PlaneGeometry(400,400,180,180);groundGeo.rotateX(-Math.PI/2);
  const p=groundGeo.attributes.position;for(let i=0;i<p.count;i++){
    const x=Math.sign(p.getX(i))*(Math.abs(p.getX(i))/200)**2*200;
    const z=Math.sign(p.getZ(i))*(Math.abs(p.getZ(i))/200)**2*200;
    p.setXYZ(i,x,groundHeight(x,z),z);
  }groundGeo.computeVertexNormals();
  const ground=mesh(world,groundGeo,makeSandMaterial(timeUniform,optics));ground.castShadow=false;
  const cottage=house(world,-5,3), bar=beachBar(world,4.5,3.1), dock=jetty(world);
  const dog=lab(world);dog.g.position.set(-.4,groundHeight(-.4,7),7);
  const palms=[palm(world,-8,2,6.8,.8),palm(world,-7,6,5.9,-.3),palm(world,8,3,6.7,.6)];
  umbrella(world,-4.7,-.5);
  // Rounded granite outcrops and planting concentrate around the island rim.
  const rock=clay('#959c86'),rockLight=clay('#b8b8a0');
  for(let i=0;i<32;i++) {const angle=i*2.39996,r=10.1+(i%4)*.3,x=Math.cos(angle)*r,z=3+Math.sin(angle)*r*.69;
    const s=.35+(i%5)*.13;oval(world,s,s*.68,s*.87,i%3?rock:rockLight,x,groundHeight(x,z)+s*.23,z).rotation.y=angle;}
  for(let i=0;i<22;i++) {const a=i*2.3999,x=Math.cos(a)*9,z=4+Math.sin(a)*5.8;
    if(z<0)continue;const bush=group(world,x,groundHeight(x,z),z);
    for(let j=0;j<4;j++)oval(bush,.45,.5,.4,j%2?mat.green:mat.leaf,Math.sin(j*2)*.3,.25,Math.cos(j*2)*.3);}
  for(let i=0;i<45;i++) {const a=i*2.4,r=6+Math.sin(i)*2,x=Math.cos(a)*r,z=1+Math.sin(a)*4;
    const h=groundHeight(x,z);if(h<.15)continue;const s=.04+(i%3)*.025;oval(world,s,.025,s*.73,mat.cream,x,h+.016,z);}
  const cablePoints=[[-3,3.5,1],[-.1,2.7,1.9],[3,3.5,1]];tube(world,cablePoints,.015,mat.wood);
  for(const x of [-3,3])cylinder(world,.05,.06,3.3,mat.wood,x,1.95,1);
  for(let i=0;i<13;i++){const x=-2.8+i*.46,y=2.7+.8*(x/3)**2;oval(world,.055,.09,.055,mat.lamp,x,y,1.8-(x/3)**2*.8);}
  // The promotion board is part of the place, and links only on deliberate clicks.
  const sign=group(world,7,groundHeight(7,.3),.3);sign.rotation.y=-.4;
  for(const x of [-.65,.65])box(sign,.08,1.65,.09,mat.wood,x,.8,0);
  box(sign,1.75,.88,.11,mat.lightWood,0,1.3,0);const board=label(sign,'ALHENA',1.56,.68,0,1.3,.061);board.userData.link='https://alhena.cc';
  const lamp=new THREE.PointLight('#ffcc8e',6,12,2);lamp.position.set(4.5,3.5,3.8);scene.add(lamp);
  // Static props share material batches; the articulated rigs retain their transforms.
  const dynamic=new Set([dog.g,bar.actor.g,ground,board,...palms.flatMap(p=>p.fronds)]);
  world.updateMatrixWorld(true);const batches=new Map(),originals=[];
  function collect(node){if(dynamic.has(node))return;
    if(node.isMesh && !Array.isArray(node.material)){
      const key=node.material.uuid+':'+node.castShadow;
      if(!batches.has(key))batches.set(key,{material:node.material,cast:node.castShadow,geometries:[]});
      const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
      for(const name of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(name))geometry.deleteAttribute(name);
      batches.get(key).geometries.push(geometry.index?geometry.toNonIndexed():geometry);originals.push(node);
    }for(const child of node.children)collect(child);
  }collect(world);
  for(const node of originals)node.removeFromParent();
  for(const b of batches.values()){const combined=mergeGeometries(b.geometries);if(combined){const m=mesh(world,combined,b.material);m.castShadow=b.cast;}b.geometries.forEach(g=>g.dispose());}
  const gait=createQuadruped(groundHeight),down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
  const upperQ=new THREE.Quaternion(),lowerQ=new THREE.Quaternion(),bodyInverse=new THREE.Quaternion(),padQ=new THREE.Quaternion(),yawQ=new THREE.Quaternion();
  const hipPoint=new THREE.Vector3(),kneePoint=new THREE.Vector3(),footPoint=new THREE.Vector3(),normal=new THREE.Vector3();
  let previousPhase='idle',greeting=0,pose=gait.snapshot();
  return {world,dog,bar,cottage,palms,board,lamp,ground,dock,
    actors() {
      return {...gait.snapshot(),renderedFeet:dog.legs.map(leg=>({id:leg.id,position:leg.paw.getWorldPosition(new THREE.Vector3()).toArray()})),greeting};
    },
    update(t,dt,wind=1,{phase='idle',target=[.5,0,19],reducedMotion=false}={}) {
      if(phase==='landed'&&previousPhase!=='landed')greeting=2.8;previousPhase=phase;greeting=Math.max(0,greeting-dt);
      const active=['strike','fight'].includes(phase)||greeting>0,follow=1-Math.exp(-dt*7);
      pose=gait.update(dt,{active,reducedMotion});dog.g.position.fromArray(pose.root);dog.g.rotation.y=pose.yaw;
      dog.body.position.y=.76+pose.bodyBob;dog.g.updateMatrixWorld(true);dog.body.getWorldQuaternion(bodyInverse).invert();
      dog.legs.forEach((leg,i)=>{
        const f=pose.feet[i];dog.body.worldToLocal(hipPoint.fromArray(f.hip));dog.body.worldToLocal(kneePoint.fromArray(f.knee));dog.body.worldToLocal(footPoint.fromArray(f.foot));
        leg.hip.position.copy(hipPoint);upperQ.setFromUnitVectors(down,kneePoint.clone().sub(hipPoint).normalize());
        lowerQ.setFromUnitVectors(down,footPoint.clone().sub(kneePoint).normalize());leg.hip.quaternion.copy(upperQ);
        leg.knee.quaternion.copy(upperQ).invert().multiply(lowerQ);
        padQ.setFromUnitVectors(up,normal.fromArray(f.normal));yawQ.setFromAxisAngle(up,f.heading);padQ.multiply(yawQ).premultiply(bodyInverse);
        leg.paw.quaternion.copy(lowerQ).invert().multiply(padQ);
      });
      const look=Math.atan2(target[0]-pose.root[0],target[2]-pose.root[2])-pose.yaw;
      const yaw=active?THREE.MathUtils.clamp(Math.atan2(Math.sin(look),Math.cos(look)),-.65,.65):Math.sin(t*.7)*.08;
      dog.head.rotation.y+=(yaw-dog.head.rotation.y)*follow;
      dog.head.rotation.x+=((pose.mode==='sniffing'?.5+Math.sin(t*5)*.06:.02)-dog.head.rotation.x)*follow;
      dog.neck.rotation.x+=((pose.mode==='sniffing'?.18:0)-dog.neck.rotation.x)*follow;
      dog.tail.rotation.z=reducedMotion?0:Math.sin(t*(active?7:3.5))*(active?.32:.16);
      dog.ears.forEach((ear,i)=>{ear.rotation.x=reducedMotion?0:Math.sin(t*4+i)*pose.speed*.2;});
      bar.actor.head.rotation.y+=( (active?-.22:Math.sin(t*.35)*.12)-bar.actor.head.rotation.y)*follow;
      bar.actor.body.rotation.z=reducedMotion?0:Math.sin(t*.8)*.01;
      const greet=!reducedMotion&&greeting>0;
      bar.actor.arms[1].rotation.z+=((greet?1.9+Math.sin(t*9)*.12:.23)-bar.actor.arms[1].rotation.z)*follow;
      bar.actor.arms[1].rotation.x+=((greet?-.2:-.35+Math.sin(t*.65)*.12)-bar.actor.arms[1].rotation.x)*follow;
      const blink=reducedMotion?1:1-.94*Math.max(0,1-Math.abs(t%4.7-.12)/.12);bar.actor.eyes.forEach(eye=>eye.scale.y=blink);
      palms.forEach((p,i)=>p.fronds.forEach((f,j)=>f.rotation.x=Math.sin(t*.6+i+j)*.028*wind));
    },
  };
}

export function makeFish(scene,index=0) {
  const g=group(scene),m=clay(['#427e78','#628d86','#7c9983','#c49562'][index%4],.4);
  oval(g,.105,.17,.44,m);
  const tail=group(g,0,0,-.43);const tailMesh=mesh(tail,new THREE.ConeGeometry(.19,.3,3),m,0,0,-.09);tailMesh.rotation.x=-Math.PI/2;tailMesh.scale.z=.25;
  for(const sx of [-1,1])oval(g,.025,.033,.025,mat.dark,sx*.085,.055,.23);
  return {g,tail};
}
