import * as THREE from './vendor/three.module.min.js';
import { createOcean } from './ocean.js';
import { createIsland, makeFish } from './models.js';
import { readCatches, recordCatch, catchCount, chooseFish } from './catalog.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
catch(error){$('error').hidden=false;$('error-detail').textContent=error.message;throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<900?1.25:1.5));
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
$('world').appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,550);
const focus=new THREE.Vector3(-3,1,4),targetPosition=new THREE.Vector3();
camera.position.set(26,23,33);camera.lookAt(focus);
const hemi=new THREE.HemisphereLight('#eef8e6','#b18b66',2);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffe0b1',3.2);sun.position.set(-15,23,12);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=19;sun.shadow.camera.bottom=-19;sun.shadow.camera.far=90;
sun.shadow.normalBias=.035;sun.shadow.bias=-.00008;scene.add(sun);
const timeUniform={value:0};
const ocean=createOcean(renderer,scene);
const island=createIsland(scene,timeUniform);
const skyUniforms={uTop:{value:new THREE.Color('#91bfc4')},uHorizon:{value:new THREE.Color('#e5e9cb')},uSun:{value:new THREE.Vector3(-.6,.6,.2).normalize()},uTime:timeUniform,uCloud:{value:.35},uNight:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(250,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,
  vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec3 vDir;uniform vec3 uTop,uHorizon,uSun;uniform float uTime,uCloud,uNight;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec3 d=normalize(vDir);float h=max(0.0,d.y);vec3 col=mix(uHorizon,uTop,smoothstep(0.0,.7,h));
      vec2 q=d.xz/max(.15,h)*1.8+uTime*.006;float n=noise(q)*.56+noise(q*2.1)*.27+noise(q*4.3)*.12;
      float cloud=smoothstep(.52-uCloud*.13,.78,n)*smoothstep(.01,.25,h);col=mix(col,uHorizon*1.08,cloud*.8);
      float sd=max(0.0,dot(d,uSun));col+=vec3(1,.7,.37)*pow(sd,90.0)*.25*(1.0-uNight);
      col+=vec3(1,.94,.74)*smoothstep(.9993,.9998,sd)*(1.0-cloud)*mix(1.6,.12,uNight);
      float stars=step(.9987,hash(floor(d.xz/max(.1,h)*320.0)))*smoothstep(.12,.35,h);col+=stars*uNight*.8;
      gl_FragColor=vec4(col,1);#include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`.replace('vec4(col,1);#include','vec4(col,1);\n#include'),
}));scene.add(sky);

// Lens depth uses the shared scene depth buffer, including water and characters.
const frameTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1),samples:4});
const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const postUniforms={image:{value:frameTarget.texture},depth:{value:frameTarget.depthTexture},resolution:{value:new THREE.Vector2()},near:{value:.1},far:{value:550},focusDistance:{value:40},strength:{value:1}};
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
  uniforms:postUniforms,depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1);}',
  fragmentShader:`varying vec2 vUv;uniform sampler2D image,depth;uniform vec2 resolution;uniform float near,far,focusDistance,strength;
    void main(){float z=texture2D(depth,vUv).r;float dist=(near*far)/((far-near)*z-far)*-1.0;
      float coc=clamp(abs(dist-focusDistance)/max(dist,.1)*6.0,0.0,3.0)*strength;
      vec2 stepUv=vec2(coc)/resolution;vec3 col=texture2D(image,vUv).rgb*.28;
      for(int i=0;i<8;i++){float a=float(i)*.785398;col+=texture2D(image,vUv+vec2(cos(a),sin(a))*stepUv).rgb*.09;}
      float vignette=1.0-smoothstep(.2,.85,length(vUv-.5))*.16;col*=vignette;
      gl_FragColor=vec4(col,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
})));

const environments={
  dawn:{top:'#91baca',horizon:'#eedabe',sun:'#ffd4ad',position:[-17,12,8],power:2.7,hemi:1.7,exposure:1.18,water:'#428f89',light:1},
  noon:{top:'#82bdd0',horizon:'#d4e5d5',sun:'#fff2d7',position:[-10,26,12],power:3.1,hemi:2,exposure:1.16,water:'#2e9c8d',light:1.1},
  sunset:{top:'#9dc3c1',horizon:'#efd8b5',sun:'#ffd3a0',position:[-17,16,9],power:3.3,hemi:1.8,exposure:1.14,water:'#449f91',light:1},
  night:{top:'#142b3d',horizon:'#416775',sun:'#b4d8f0',position:[-8,18,-12],power:1.3,hemi:.65,exposure:1,water:'#143e47',light:.5},
};
const weather={calm:{wind:8,chop:.85,label:'still water'},breeze:{wind:12,chop:1.2,label:'a gentle breeze'},storm:{wind:18,chop:1.5,label:'passing rain'}};
let timeKey=environments[params.get('time')]?params.get('time'):'sunset';
let weatherKey=weather[params.get('weather')]?params.get('weather'):'breeze';
function environment(){
  const e=environments[timeKey],storm=weatherKey==='storm',level=storm?.7:1;
  skyUniforms.uTop.value.set(e.top);skyUniforms.uHorizon.value.set(e.horizon);skyUniforms.uCloud.value=storm?.95:.35;skyUniforms.uNight.value=timeKey==='night'?1:0;
  if(storm){skyUniforms.uTop.value.multiplyScalar(.62);skyUniforms.uHorizon.value.multiplyScalar(.72);}
  sun.position.set(...e.position);sun.color.set(e.sun);sun.intensity=e.power*level;hemi.intensity=e.hemi*level;renderer.toneMappingExposure=e.exposure;
  skyUniforms.uSun.value.copy(sun.position).normalize();ocean.uniforms.uSun.value.copy(skyUniforms.uSun.value);
  ocean.uniforms.uSky.value.copy(skyUniforms.uHorizon.value);ocean.uniforms.uColor.value.set(e.water);ocean.uniforms.uWarmth.value.set(e.sun);ocean.uniforms.uLight.value=e.light*level;
  ocean.uniforms.uSpecular.value=(timeKey==='night'?.07:1)*(storm?.35:1);
  ocean.setWeather(weather[weatherKey].wind,weather[weatherKey].chop);island.lamp.intensity=timeKey==='night'?12:2;
  document.body.classList.toggle('night',timeKey==='night');document.body.dataset.time=timeKey;document.body.dataset.weather=weatherKey;
  for(const b of document.querySelectorAll('[data-time]'))b.classList.toggle('active',b.dataset.time===timeKey);
  for(const b of document.querySelectorAll('[data-weather]'))b.classList.toggle('active',b.dataset.weather===weatherKey);
  renderer.shadowMap.needsUpdate=true;
  $('conditions').textContent=`${{dawn:'First light',noon:'Daylight',sunset:'Golden hour',night:'Under the moon'}[timeKey]} / ${weather[weatherKey].label}`;
}
document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{timeKey=b.dataset.time;environment();}));
document.querySelectorAll('[data-weather]').forEach(b=>b.addEventListener('click',()=>{weatherKey=b.dataset.weather;environment();}));
environment();

const fish=Array.from({length:14},(_,i)=>{const f=makeFish(scene,i);f.g.scale.setScalar(.7+i%4*.18);return f;});
const bobber=new THREE.Group();
const bobberBase=new THREE.Mesh(new THREE.SphereGeometry(.115,20,16),new THREE.MeshStandardMaterial({color:'#df7655',roughness:.3}));bobber.add(bobberBase);
const bobberTop=new THREE.Mesh(new THREE.SphereGeometry(.115,20,16,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#fff1cc',roughness:.3}));bobber.add(bobberTop);
const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.25,8),new THREE.MeshStandardMaterial({color:'#374940'}));antenna.position.y=.18;bobber.add(antenna);
bobber.visible=false;scene.add(bobber);
const rodTip=new THREE.Vector3(.55,2.05,14.2);
const rod=new THREE.Mesh(new THREE.CylinderGeometry(.018,.048,3,12),new THREE.MeshStandardMaterial({color:'#5b5138',roughness:.4}));
rod.position.set(1.1,1.5,13);rod.rotation.x=-.7;rod.rotation.z=.3;rod.castShadow=true;scene.add(rod);
const linePositions=new Float32Array(25*3),lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(linePositions,3));
const lineMat=new THREE.LineBasicMaterial({color:'#fff7d8'}),line=new THREE.Line(lineGeo,lineMat);line.frustumCulled=false;line.visible=false;scene.add(line);
const nodes=Array.from({length:25},()=>({p:new THREE.Vector3(),old:new THREE.Vector3()}));
let lineReady=false,bobberVy=0,phase='idle',phaseAt=0,nextNibble=0,biteAt=0,lastImpulse=0,tension=0,reelProgress=0,holding=false;
let entered=false,wide=true,elapsed=0,orbit=0,motionEnabled=false,audioEnabled=false,audioContext;
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const catches=readCatches(storage);
function journal(){
  $('catch-count').textContent=String(catchCount(catches));$('catch-list').replaceChildren();
  for(const c of catches.slice().reverse()){const li=document.createElement('li');li.textContent=c.name+(c.count>1?` x${c.count}`:'');$('catch-list').appendChild(li);}
  if(!catches.length){const li=document.createElement('li');li.textContent='Your first discovery is waiting.';$('catch-list').appendChild(li);}
}journal();
function sound(frequency=160,duration=.2){
  if(!audioEnabled)return;
  audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume();
  const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime;
  osc.type='sine';osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(40,t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.12,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain).connect(audioContext.destination);osc.start();osc.stop(t+duration+.03);
}
function haptic(pattern){if(navigator.vibrate)navigator.vibrate(pattern);}
function setPhase(value,text){
  phase=value;phaseAt=elapsed;$('phase').textContent={idle:'A GOOD DAY FOR NOTHING',cast:'A LITTLE FURTHER',hunt:'FOLLOW THE SHADOWS',strike:'NOW. SET THE HOOK.',fight:'EASY DOES IT',landed:'A LITTLE DISCOVERY'}[value];
  $('status').textContent=text;$('cast').textContent={idle:'Cast a line',cast:'Casting...',hunt:'Twitch the lure',strike:'Hook!',fight:'Hold to reel',landed:'Cast again'}[value];
}
function cast(){
  bobber.visible=true;line.visible=true;lineReady=false;bobberVy=0;holding=false;
  bobber.position.copy(rodTip);tension=0;reelProgress=0;wide=false;
  setPhase('cast','Find a quiet pocket of water.');haptic(18);
}
function act(){
  if(!entered)return;
  if(phase==='idle'||phase==='landed'){cast();return;}
  if(phase==='hunt'){ocean.impulse(bobber.position.x,bobber.position.z,.06);biteAt=Math.max(elapsed+1,biteAt-.65);sound(280,.08);return;}
  if(phase==='strike'){tension=.25;reelProgress=0;setPhase('fight','Feather the reel. Ease off when the line glows red.');haptic([30,40,30]);}
}
function release(){holding=false;}
$('cast').addEventListener('pointerdown',event=>{event.preventDefault();$('cast').setPointerCapture(event.pointerId);act();if(phase==='fight')holding=true;});
$('cast').addEventListener('pointerup',release);$('cast').addEventListener('pointercancel',release);
addEventListener('pointerup',release);addEventListener('blur',release);
addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||e.target.matches('button,input,select,textarea'))return;e.preventDefault();act();holding=phase==='fight';});
addEventListener('keyup',e=>{if(e.code==='Space')release();});
function land(){
  const name=chooseFish(weatherKey,timeKey);recordCatch(catches,name,storage);
  journal();$('catch-name').textContent=name;$('catch-toast').hidden=false;setTimeout(()=>$('catch-toast').hidden=true,4500);
  setPhase('landed','A good catch. Back to the sea it goes.');haptic([30,45,70]);sound(600,.6);holding=false;
  ocean.impulse(bobber.position.x,bobber.position.z,.2);bobber.visible=false;line.visible=false;
}
function updateFishing(dt){
  if(phase==='cast'){
    const t=Math.min(1,(elapsed-phaseAt)/1.2);bobber.position.lerpVectors(rodTip,new THREE.Vector3(.5,0,19),t);bobber.position.y+=Math.sin(t*Math.PI)*2.8;
    if(t===1){ocean.impulse(.5,19,.22);sound(210,.34);setPhase('hunt','Watch the float. A twitch will bring the shadows closer.');biteAt=elapsed+7+Math.random()*4;nextNibble=elapsed+2.5;}
  }else if(['hunt','strike','fight'].includes(phase)){
    const h=ocean.height(bobber.position.x,bobber.position.z);
    const dip=phase==='strike'?-.18:0;
    bobberVy+=(h+dip-bobber.position.y)*36*dt;bobberVy*=Math.exp(-7*dt);bobber.position.y+=bobberVy*dt;
    bobber.rotation.z=Math.atan((ocean.height(bobber.position.x+.04,bobber.position.z)-h)/.04)*.8;
    if(phase==='hunt' && elapsed>=nextNibble){bobberVy-=.6;ocean.impulse(bobber.position.x,bobber.position.z,.035);nextNibble=elapsed+2.6;haptic(8);}
    if(phase==='hunt' && elapsed>=biteAt){setPhase('strike','The float is under. Tap now!');ocean.impulse(bobber.position.x,bobber.position.z,.28);sound(130,.45);haptic([40,20,40]);}
    if(phase==='strike' && elapsed-phaseAt>2.2){setPhase('hunt','A clever one. Twitch the lure and try again.');biteAt=elapsed+5;}
    if(phase==='fight'){
      const jumping=Math.sin((elapsed-phaseAt)*1.55)>.96;
      tension=THREE.MathUtils.clamp(tension+dt*(holding?.2+(jumping?.7:0):-.42),0,1);
      if(holding && tension<.86)reelProgress+=dt*.115;
      bobber.position.x=.5+Math.sin(elapsed*1.6)*.5;bobber.position.z=19-reelProgress*3;
      if(jumping && elapsed-lastImpulse>.9){lastImpulse=elapsed;ocean.impulse(bobber.position.x,bobber.position.z,.24);sound(150,.2);haptic(22);}
      $('status').textContent=jumping?'It is jumping. Release the reel!':tension>.78?'Ease off. Let the line cool.':'Keep a gentle pull. The line tells you everything.';
      if(tension>=1){setPhase('hunt','The line slipped. Take a breath and try again.');biteAt=elapsed+6;holding=false;tension=0;reelProgress=0;}
      else if(reelProgress>=1)land();
    }
  }
  lineMat.color.set(tension>.78?'#ec624b':tension>.27?'#f3c867':'#fff4d8');
  if(line.visible){
    if(!lineReady){nodes.forEach((n,i)=>{n.p.lerpVectors(rodTip,bobber.position,i/24);n.old.copy(n.p);});lineReady=true;}
    const length=rodTip.distanceTo(bobber.position)*(1.025+(1-tension)*.015)/24;
    for(let i=1;i<24;i++){const n=nodes[i],x=n.p.clone().sub(n.old).multiplyScalar(.98);n.old.copy(n.p);n.p.add(x);n.p.y-=9.81*dt*dt;}
    for(let pass=0;pass<7;pass++){
      nodes[0].p.copy(rodTip);nodes[24].p.copy(bobber.position);
      for(let i=0;i<24;i++){const a=nodes[i].p,b=nodes[i+1].p,delta=b.clone().sub(a);const len=delta.length();if(len>1e-6){delta.multiplyScalar((len-length)/len*.5);if(i>0)a.add(delta);if(i+1<24)b.sub(delta);}}
    }
    nodes[0].p.copy(rodTip);nodes[24].p.copy(bobber.position);nodes.forEach((n,i)=>n.p.toArray(linePositions,i*3));lineGeo.attributes.position.needsUpdate=true;
  }
}

function togglePanel(id,button,force){const panel=$(id);panel.hidden=force===undefined?!panel.hidden:!force;if(button)$(button).setAttribute('aria-expanded',String(!panel.hidden));}
$('menu-button').onclick=()=>togglePanel('settings','menu-button');$('close-settings').onclick=()=>togglePanel('settings','menu-button',false);
$('journal').onclick=()=>togglePanel('journal-panel','journal');$('close-journal').onclick=()=>togglePanel('journal-panel','journal',false);
$('view').onclick=()=>{wide=!wide;$('view').textContent=wide?'Fishing view':'Island view';};
$('sound').onclick=()=>{audioEnabled=!audioEnabled;$('sound').textContent=audioEnabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(audioEnabled));sound(330,.25);};
$('begin').onclick=()=>{entered=true;wide=true;document.body.classList.add('entered');$('play-controls').hidden=false;$('loading').textContent='Drag to explore';};
addEventListener('keydown',event=>{if(event.code==='Escape'){togglePanel('settings','menu-button',false);togglePanel('journal-panel','journal',false);}});
let drag=null;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,orbit};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(drag)orbit=drag.orbit+(e.clientX-drag.x)*.004;});
renderer.domElement.addEventListener('pointerup',e=>{
  if(drag&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<12){
    pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);
    if(raycaster.intersectObject(island.board).length)window.open(island.board.userData.link,'_blank','noopener,noreferrer');
    else if(entered)act();
  }drag=null;
});
renderer.domElement.addEventListener('pointercancel',()=>drag=null);
let lastMotion=0;
function onMotion(e){const a=e.acceleration;if(!a)return;const force=Math.hypot(a.x||0,a.y||0,a.z||0);if(force>13&&elapsed-lastMotion>1){lastMotion=elapsed;act();if(phase==='fight'){holding=true;setTimeout(release,350);}}}
$('motion').onclick=async()=>{
  if(motionEnabled){removeEventListener('devicemotion',onMotion);motionEnabled=false;$('motion').textContent='Enable wrist casting';return;}
  try{if(!globalThis.DeviceMotionEvent)throw new Error('Motion controls are unavailable on this device.');
    if(typeof DeviceMotionEvent.requestPermission==='function' && await DeviceMotionEvent.requestPermission()!=='granted')throw new Error('Motion permission was declined. Touch controls are ready.');
    addEventListener('devicemotion',onMotion);motionEnabled=true;$('motion').textContent='Disable wrist casting';$('motion-status').textContent='Flick to cast or twitch. Touch and hold to reel; release to ease the line.';
  }catch(error){$('motion-status').textContent=error.message;}
};

const rainGeo=new THREE.BufferGeometry(),rainPositions=new Float32Array(600*3);
for(let i=0;i<600;i++){rainPositions[i*3]=(Math.random()-.5)*45;rainPositions[i*3+1]=Math.random()*22;rainPositions[i*3+2]=(Math.random()-.5)*45;}
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:'#d8edeb',size:.055,transparent:true,opacity:.65}));scene.add(rain);
let frameCount=0,lastFrame=performance.now(),fpsAt=lastFrame,fps=0,shadowAt=0,accumulator=0;
function resize(){camera.aspect=innerWidth/innerHeight;camera.fov=innerHeight>innerWidth?56:40;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);ocean.resize();const size=renderer.getDrawingBufferSize(new THREE.Vector2());frameTarget.setSize(size.x,size.y);postUniforms.resolution.value.copy(size);}
addEventListener('resize',resize);resize();
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden)holding=false;});
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();$('error').hidden=false;$('error-detail').textContent='Graphics paused. Reload to reopen the island; your field notes are saved.';});
function animate(now){
  requestAnimationFrame(animate);if(document.hidden)return;
  const dt=Math.min((now-lastFrame)/1000,.25);lastFrame=now;accumulator+=dt;
  while(accumulator>=1/60){elapsed+=1/60;ocean.update(elapsed);updateFishing(1/60);accumulator-=1/60;}
  timeUniform.value=elapsed;island.update(reducedMotion?0:elapsed,dt,weatherKey==='storm'?2:1);
  for(let i=0;i<fish.length;i++){const f=fish[i];const attracted=phase==='hunt'||phase==='strike'||phase==='fight';
    const cx=attracted&&i<4?bobber.position.x:Math.sin(i*1.5)*9,cz=attracted&&i<4?bobber.position.z:15+i%4*2;
    f.g.position.set(cx+Math.sin(elapsed*.3+i*2)*2.1,-.65-Math.sin(elapsed*.5+i)*.12,cz+Math.cos(elapsed*.3+i*2)*.8);
    f.g.position.y+=ocean.height(f.g.position.x,f.g.position.z);
    f.g.rotation.y=Math.atan2(Math.cos(elapsed*.3+i*2)*2.1,-Math.sin(elapsed*.3+i*2)*.8);f.tail.rotation.y=Math.sin(elapsed*8+i)*.23;
    if(phase==='fight'&&i===0&&Math.sin((elapsed-phaseAt)*1.55)>.9)f.g.position.set(bobber.position.x,.35+Math.sin(elapsed*8)*.2,bobber.position.z);
  }
  rain.visible=weatherKey==='storm';if(rain.visible){for(let i=0;i<600;i++){rainPositions[i*3+1]-=dt*11;if(rainPositions[i*3+1]<0)rainPositions[i*3+1]=22;}rainGeo.attributes.position.needsUpdate=true;}
  const portrait=innerHeight>innerWidth;let targetFocus;
  if(!entered||wide){
    const radius=portrait?44:38,angle=.63+orbit;
    targetPosition.set(Math.sin(angle)*radius,portrait?32:25,Math.cos(angle)*radius);
    targetFocus=new THREE.Vector3(entered?0:portrait?0:-5,portrait&&!entered?10:1,4);
  }else{const radius=phase==='strike'?4.8:phase==='fight'?7:12;
    targetPosition.set(bobber.position.x+Math.sin(.65+orbit)*radius,phase==='strike'?2.5:6,bobber.position.z+Math.cos(.65+orbit)*radius);
    targetFocus=bobber.position.clone();targetFocus.y=.1;
  }
  const ease=1-Math.exp(-dt*(reducedMotion?20:2.3));camera.position.lerp(targetPosition,ease);focus.lerp(targetFocus,ease);camera.lookAt(focus);
  postUniforms.focusDistance.value=camera.position.distanceTo(focus);postUniforms.strength.value=phase==='strike'?1.5:.65;
  if(elapsed-shadowAt>.12){renderer.shadowMap.needsUpdate=true;shadowAt=elapsed;}
  ocean.render(camera,frameTarget);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
  frameCount++;if(now-fpsAt>1000){fps=frameCount*1000/(now-fpsAt);frameCount=0;fpsAt=now;}
  if(!$('begin').dataset.ready){$('begin').dataset.ready='true';$('begin').disabled=false;$('begin').textContent='Take a little time  \u2197';$('loading').textContent='Your island is ready';document.body.dataset.ready='true';}
}
// Read-only evidence for browser verification; gameplay is exercised through real controls.
window.__paradise={snapshot:()=>({build:document.body.dataset.paradiseBuild,renderer:'Three.js WebGL2',waveComponents:32,phase,entered,catches:catchCount(catches),time:timeKey,weather:weatherKey,fps:Math.round(fps),canvases:document.querySelectorAll('canvas').length,frames:document.querySelectorAll('iframe').length,bobber:bobber.position.toArray(),surface:ocean.height(bobber.position.x,bobber.position.z),tension,reelProgress,motionEnabled})};
requestAnimationFrame(animate);
