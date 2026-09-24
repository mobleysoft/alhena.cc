import * as THREE from './vendor/three.module.min.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const SPLASH={capacity:160,crowns:6,gravity:9.81,lifetime:1.6};

// Bounded ballistic spray. Only water contacts return a small impulse; those
// impulses do not emit more spray, so an impact cannot become a feedback loop.
export function createSpray({height,ground=()=>-Infinity,impulse=()=>{},random=Math.random}){
  const drops=Array.from({length:SPLASH.capacity},()=>({alive:false}));
  const crowns=Array.from({length:SPLASH.crowns},()=>({alive:false}));
  let emitted=0,returned=0,expired=0,bursts=0,feedback=0,peak=0;
  function burst(x,z,strength=.22){
    if(![x,z,strength].every(Number.isFinite)||strength<=0)return false;
    const y=height(x,z);if(!Number.isFinite(y)||y-ground(x,z)<.02)return false;
    strength=clamp(strength,.01,.4);bursts++;
    const crown=crowns.find(c=>!c.alive)||crowns.reduce((a,b)=>a.age>b.age?a:b);
    Object.assign(crown,{alive:true,x,z,y,age:0,strength,seed:random()*Math.PI*2});
    let remaining=Math.ceil(12+strength*150),index=0;
    for(const d of drops){
      if(d.alive)continue;
      const angle=index++*2.39996323+random()*.3,speed=(.35+random()*.8)*Math.sqrt(strength/.22);
      Object.assign(d,{alive:true,x,y:y+.035,z,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
        vy:(1.2+random()*1.6)*Math.sqrt(strength/.22),age:0,radius:.012+random()*.022});
      emitted++;if(--remaining===0)break;
    }
    peak=Math.max(peak,drops.filter(d=>d.alive).length);return true;
  }
  function step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,1/30);
    let hits=0,x=0,z=0,force=0;
    for(const c of crowns){if(!c.alive)continue;c.age+=dt;c.y=height(c.x,c.z);if(c.age>=.62)c.alive=false;}
    for(const d of drops){
      if(!d.alive)continue;
      d.age+=dt;d.vy-=SPLASH.gravity*dt;
      const drag=Math.exp(-.32*dt);d.vx*=drag;d.vz*=drag;
      d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
      const surface=height(d.x,d.z),bed=ground(d.x,d.z);
      if(d.vy<0&&d.y<=Math.max(surface,bed)+.01){
        d.alive=false;
        if(surface-bed>.02){returned++;hits++;x+=d.x;z+=d.z;force+=Math.min(4,-d.vy)*d.radius*.007;}
        else expired++;
      }else if(d.age>=SPLASH.lifetime){d.alive=false;expired++;}
    }
    // Aggregate tiny simultaneous contacts to fit the water solver's bounded
    // event queue; the spray is visual detail, not a second fluid solver.
    if(hits){impulse(x/hits,z/hits,Math.min(.025,force));feedback++;}
  }
  return {drops,crowns,burst,step,snapshot:()=>({active:drops.filter(d=>d.alive).length,
    crowns:crowns.filter(c=>c.alive).length,emitted,returned,expired,bursts,feedback,peak,capacity:SPLASH.capacity})};
}

export function createSplashes(scene,ocean,ground,{reducedMotion=false}={}){
  const spray=createSpray({height:(x,z)=>ocean.height(x,z),ground,impulse:(x,z,s)=>ocean.impulse(x,z,s)});
  const material=new THREE.MeshPhysicalMaterial({color:'#c8e3d7',roughness:.15,metalness:0,clearcoat:1,clearcoatRoughness:.08});
  const droplets=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),material,SPLASH.capacity);
  droplets.name='Ballistic water droplets';droplets.frustumCulled=false;droplets.count=0;
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(droplets);
  const crownMaterial=material.clone();crownMaterial.transparent=true;crownMaterial.opacity=.55;
  crownMaterial.side=THREE.DoubleSide;crownMaterial.depthWrite=false;
  const rings=spray.crowns.map(()=>{
    const geometry=new THREE.PlaneGeometry(1,1,64,5),mesh=new THREE.Mesh(geometry,crownMaterial.clone());
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);mesh.name='Impact water crown';
    mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);return mesh;
  });
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),velocity=new THREE.Vector3();
  function render(){
    let count=0;
    for(const d of spray.drops){
      if(!d.alive)continue;
      dummy.position.set(d.x,d.y,d.z);velocity.set(d.vx,d.vy,d.vz);
      const speed=velocity.length();dummy.quaternion.setFromUnitVectors(up,velocity.normalize());
      dummy.scale.set(d.radius,d.radius*(1+speed*.14),d.radius);
      dummy.updateMatrix();droplets.setMatrixAt(count++,dummy.matrix);
    }
    droplets.count=count;droplets.instanceMatrix.needsUpdate=true;
    spray.crowns.forEach((c,i)=>{
      const mesh=rings[i];mesh.visible=c.alive;if(!c.alive)return;
      const life=c.age/.62,env=Math.sin(life*Math.PI),radius=.07+c.age*(.7+c.strength*3.5);
      const positions=mesh.geometry.attributes.position;
      for(let row=0;row<=5;row++)for(let col=0;col<=64;col++){
        const a=col/64*Math.PI*2,v=row/5;
        const scallop=.7+.3*Math.sin(a*11+c.seed),r=radius*(.65+.35*v);
        positions.setXYZ(row*65+col,Math.cos(a)*r,env*(.12+c.strength*1.5)*v*scallop-.025,Math.sin(a)*r);
      }
      positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.position.set(c.x,c.y,c.z);
      mesh.material.opacity=.58*(1-life*life);
    });
  }
  return {
    burst:(x,z,strength)=>!reducedMotion&&spray.burst(x,z,strength),
    step:dt=>spray.step(dt),render,
    setColor:color=>{material.color.copy(color).lerp(new THREE.Color('#f4fff3'),.65);rings.forEach(m=>m.material.color.copy(material.color));},
    snapshot:()=>({...spray.snapshot(),rendered:droplets.count,renderedCrowns:rings.filter(m=>m.visible).length,reducedMotion}),
  };
}
