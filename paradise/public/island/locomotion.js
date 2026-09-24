// Kinematic terrain-aware foot planting. No authored walk-cycle clips.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(v,s)=>v.map(n=>n*s),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export const distance=(a,b)=>Math.hypot(...sub(a,b));
const unit=v=>mul(v,1/(Math.hypot(...v)||1));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
const ease=t=>t*t*(3-2*t);
const rotate=(v,yaw)=>[v[0]*Math.cos(yaw)+v[2]*Math.sin(yaw),v[1],-v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw)];
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export const LEG=Object.freeze({upper:.36,lower:.36,pad:.065,hip:.72,lift:.13,duration:.23});
export const LEGS=Object.freeze([
  {id:'rear-left',x:-.24,z:-.5,bend:1},
  {id:'front-left',x:-.24,z:.45,bend:-1},
  {id:'rear-right',x:.24,z:-.5,bend:1},
  {id:'front-right',x:.24,z:.45,bend:-1},
].map(Object.freeze));

export function solveTwoBone(hip,target,upper,lower,bend) {
  const delta=sub(target,hip),actual=Math.hypot(...delta);
  const direction=actual>1e-9?mul(delta,1/actual):[0,-1,0];
  const d=clamp(actual,Math.abs(upper-lower)+1e-5,upper+lower-1e-5);
  let pole=sub(bend,mul(direction,dot(bend,direction)));
  if(Math.hypot(...pole)<1e-7){const fallback=Math.abs(direction[0])<.8?[1,0,0]:[0,0,1];pole=sub(fallback,mul(direction,dot(fallback,direction)));}
  const along=(upper*upper-lower*lower+d*d)/(2*d),out=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {knee:add(add(hip,mul(direction,along)),mul(unit(pole),out)),foot:add(hip,mul(direction,d)),reachError:Math.abs(actual-d)};
}

export function createQuadruped(ground) {
  let time=0,travel=0,speed=0,yaw=Math.PI/2,bodyBob=0,nextLeg=0,stepCount=0;
  let root=[-1.6,ground(-1.6,7.45),7.45],mode='rest',attention=0;
  const nominal=(leg,lead=0)=>{
    const p=add(root,rotate([leg.x,0,leg.z+lead],yaw));p[1]=ground(p[0],p[2])+LEG.pad;return p;
  };
  const feet=LEGS.map(leg=>({id:leg.id,position:nominal(leg),heading:yaw,swing:null}));
  let pose;
  function solve() {
    // A small body crouch keeps the planted paws reachable over slopes/turns.
    for(let i=0;i<feet.length;i++){
      const hip=add(root,rotate([LEGS[i].x,0,LEGS[i].z],yaw)),foot=feet[i].position;
      const horizontal=(hip[0]-foot[0])**2+(hip[2]-foot[2])**2;
      const ceiling=foot[1]+Math.sqrt(Math.max(0,(LEG.upper+LEG.lower-.003)**2-horizontal));
      bodyBob=Math.max(-.08,Math.min(bodyBob,ceiling-root[1]-LEG.hip));
    }
    pose={root:[...root],yaw,speed,mode,bodyBob,attention,stepCount,feet:feet.map((f,i)=>{
      const leg=LEGS[i],hip=add(root,rotate([leg.x,LEG.hip+bodyBob,leg.z],yaw));
      const bones=solveTwoBone(hip,f.position,LEG.upper,LEG.lower,rotate([0,0,leg.bend],yaw));
      const e=.025,normal=unit([ground(f.position[0]-e,f.position[2])-ground(f.position[0]+e,f.position[2]),2*e,ground(f.position[0],f.position[2]-e)-ground(f.position[0],f.position[2]+e)]);
      return {id:f.id,hip,...bones,target:[...f.position],normal,heading:f.heading,stance:!f.swing,swing:f.swing?f.swing.elapsed/LEG.duration:0};
    })};
    return pose;
  }
  solve();
  return {
    update(dt,{active=false,reducedMotion=false,moving}={}) {
      dt=clamp(Number.isFinite(dt)?dt:0,0,.05);time+=dt;
      const phase=time%24,wantsWalk=moving??(phase<13||phase>20);
      attention+=(Number(active)-attention)*(1-Math.exp(-dt*5));
      const tangentLength=Math.hypot(Math.cos(travel)*1.3,Math.sin(travel)*.65);
      const curvature=1.3*.65/tangentLength**3;
      const desired=reducedMotion?0:wantsWalk&&!active?.32/(1+curvature*.85):0;
      speed+=(desired-speed)*(1-Math.exp(-dt*5));
      if(reducedMotion)speed=0;
      travel+=speed*dt/Math.hypot(Math.cos(travel)*1.3,Math.sin(travel)*.65);
      root=[-1.6+Math.sin(travel)*1.3,0,6.8+Math.cos(travel)*.65];root[1]=ground(root[0],root[2]);
      yaw=Math.atan2(Math.cos(travel)*1.3,-Math.sin(travel)*.65);
      bodyBob=reducedMotion?0:(Math.sin(time*2.4)*.003+Math.sin(travel*16)*.01*(speed/.32));
      mode=reducedMotion?'rest':active?'watching':speed>.03?'walking':phase>14&&phase<19?'sniffing':'rest';
      for(const f of feet)if(f.swing){
        const s=f.swing;s.elapsed=Math.min(LEG.duration,s.elapsed+dt);const t=s.elapsed/LEG.duration;
        f.position=mix(s.from,s.to,ease(t));f.position[1]=ground(f.position[0],f.position[2])+LEG.pad+Math.sin(t*Math.PI)*LEG.lift;
        f.heading=s.heading+angleDelta(s.heading,s.toHeading)*ease(t);
        if(t===1){f.position=[...s.to];f.swing=null;}
      }
      if(!reducedMotion&&!feet.some(f=>f.swing)) {
        let candidate=null;
        for(let attempt=0;attempt<4;attempt++){
          const i=(nextLeg+attempt)%4,f=feet[i],target=nominal(LEGS[i],speed*LEG.duration*1.5);
          const error=Math.hypot(f.position[0]-target[0],f.position[2]-target[2]);
          if(error>(speed>.02?.125:.16)&&(!candidate||error>candidate.error+.015))candidate={i,f,target,error};
        }
        if(candidate){const {i,f,target}=candidate;f.swing={from:[...f.position],to:target,heading:f.heading,toHeading:yaw,elapsed:0};nextLeg=(i+1)%4;stepCount++;}
      }
      return solve();
    },
    snapshot(){return {...pose,root:[...pose.root],feet:pose.feet.map(f=>({...f,hip:[...f.hip],knee:[...f.knee],foot:[...f.foot],target:[...f.target],normal:[...f.normal]}))};},
  };
}
