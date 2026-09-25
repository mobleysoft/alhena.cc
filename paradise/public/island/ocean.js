import * as THREE from './vendor/three.module.min.js';
import { createRippleField, RIPPLE } from './ripple-field.js';
import { createWaterLight, waterLightGLSL } from './water-light.js';

const TAU = Math.PI * 2;
export const NORMAL_EPSILON = .04;
export const normalSteps = wave => new THREE.Vector4(Math.cos(wave.kx*NORMAL_EPSILON),Math.sin(wave.kx*NORMAL_EPSILON),Math.cos(wave.kz*NORMAL_EPSILON),Math.sin(wave.kz*NORMAL_EPSILON));
export function reflectionSize(width,height) {
  const scale=Math.min(1,Math.sqrt(1048576/(width*height)));
  return [Math.max(1,Math.floor(width*scale)),Math.max(1,Math.floor(height*scale))];
}
export function createReflectionTarget(renderer,width,height) {
  return new THREE.WebGLRenderTarget(...reflectionSize(width,height),{samples:Math.min(4,renderer.capabilities.maxSamples)});
}
export const causticWindowGLSL = `
float causticCoverage(vec2 uv) {
  float edge=min(min(uv.x,uv.y),min(1.0-uv.x,1.0-uv.y));
  return smoothstep(0.0,.07,edge);
}`;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Small wind waves supply the curvature that focuses sunlight. The legacy
// 32-component swell remains unchanged; this layer also enters CPU buoyancy.
export const SHORT_WAVES=Object.freeze([.8,1.1,1.65,2.2].map((length,i)=>{
  const k=TAU/length,angle=[.4,-.7,1.1,-.2][i];
  return Object.freeze({kx:Math.cos(angle)*k,kz:Math.sin(angle)*k,amplitude:[.008,.010,.016,.019][i],frequency:Math.sqrt(9.81*k+.000074*k**3)});
}));
export const shortWaveHeight=(x,z,t,wind=12)=>SHORT_WAVES.reduce((h,w)=>h+w.amplitude*Math.sin(w.kx*x+w.kz*z-w.frequency*t),0)*Math.min(1.6,Math.max(.4,wind/12));
// A steep outer shelf self-occludes in the overview camera, abruptly changing
// the underwater optical path. Keep the cove intact, then grade the seabed out.
export const OFFSHORE_SHELF = Object.freeze({ start: 1.3, end: 8, drop: 16 });
export function groundHeight(x, z) {
  const r = Math.hypot(x / 12.8, (z - 3.3) / 9.2);
  return 1.18 - 3.9 * smooth(.48, 1.22, r) - OFFSHORE_SHELF.drop * smooth(OFFSHORE_SHELF.start, OFFSHORE_SHELF.end, r)
    + .10 * Math.sin(x * .55) * Math.cos(z * .47) * (1 - smooth(.45, .95, r));
}

// Source: public/game-v3/three/legacy_pandorachat_ocean.html, waveParms.
// Keep its 32 frequencies, peak enhancement, phase hash and dispersion intact.
export function spectrum(wind) {
  const g = 9.81, wp = .13 * g / Math.max(wind, 1) * TAU;
  const min = wp * .5, max = wp * 3.5;
  return Array.from({ length: 32 }, (_, i) => {
    const freq = min * (max / min) ** (i / 31);
    const sigma = freq <= wp ? .07 : .09;
    const peak = Math.exp(-((freq - wp) ** 2) / (2 * sigma ** 2 * wp ** 2));
    const density = .0081 * g * g / freq ** 5 * Math.exp(-1.25 * (wp / freq) ** 4) * 3.3 ** peak;
    const amplitude = Math.min(1.8, Math.sqrt(2 * density * (max - min) / 32) * .35 * wind / 12);
    const theta = (i / 32 - .5) * Math.PI * .9;
    const hashed = Math.sin(i * 17.31 + .73) * 43758.5453123;
    return { kx: Math.cos(theta) * freq * freq / g, kz: Math.sin(theta) * freq * freq / g, freq, amplitude, phase: (hashed - Math.floor(hashed)) * TAU };
  });
}

const groundGLSL = `
float ground(vec2 p) {
  float r = length(vec2(p.x / 12.8, (p.y - 3.3) / 9.2));
  return 1.18 - 3.9 * smoothstep(.48, 1.22, r) - ${OFFSHORE_SHELF.drop.toFixed(6)} * smoothstep(${OFFSHORE_SHELF.start.toFixed(6)},${OFFSHORE_SHELF.end.toFixed(6)},r)
    + .10 * sin(p.x * .55) * cos(p.y * .47) * (1.0 - smoothstep(.45, .95, r));
}`;
export const heightGLSL = `
uniform float uTime;
uniform float uChop;
uniform vec4 uWaves[32];
uniform float uFrequencies[32];
uniform vec4 uShortWaves[4];
uniform float uRippleWind;
uniform sampler2D uRipples;
${groundGLSL}
float rippleAt(vec2 p) {
  vec2 uv=(p-vec2(-13.0,0.0))/26.0;
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return 0.0;
  return texture2D(uRipples,(uv*127.0+.5)/128.0).r;
}
float heightAt(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 32; i++) {
    vec4 w = uWaves[i];
    h += w.z * sin(dot(w.xy, p) - uFrequencies[i] * uTime + w.w);
  }
  h *= uChop;
  for(int i=0;i<4;i++){vec4 w=uShortWaves[i];h+=w.z*sin(dot(w.xy,p)-w.w*uTime)*uRippleWind;}
  h *= smoothstep(-.05, 8.0, -ground(p));
  return h+rippleAt(p);
}`;

// Angle addition reproduces four central-difference height samples using one
// sin/cos pair per wave. The coefficients are precomputed when weather changes.
export const surfaceNormalGLSL = `
uniform vec4 uWaveSteps[32];
uniform vec4 uShortSteps[4];
vec4 shiftedWave(float phase, vec4 step) {
  float s=sin(phase),c=cos(phase);
  return vec4(s*step.x+c*step.y,s*step.x-c*step.y,s*step.z+c*step.w,s*step.z-c*step.w);
}
vec3 surfaceNormal(vec2 p) {
  vec4 heights=vec4(0.0);
  for(int i=0;i<32;i++) {
    vec4 w=uWaves[i];
    heights+=w.z*shiftedWave(dot(w.xy,p)-uFrequencies[i]*uTime+w.w,uWaveSteps[i]);
  }
  heights*=uChop;
  for(int i=0;i<4;i++) {
    vec4 w=uShortWaves[i];
    heights+=w.z*uRippleWind*shiftedWave(dot(w.xy,p)-w.w*uTime,uShortSteps[i]);
  }
  vec2 dx=vec2(${NORMAL_EPSILON},0.0),dz=dx.yx;
  heights*=smoothstep(vec4(-.05),vec4(8.0),-vec4(ground(p+dx),ground(p-dx),ground(p+dz),ground(p-dz)));
  heights+=vec4(rippleAt(p+dx),rippleAt(p-dx),rippleAt(p+dz),rippleAt(p-dz));
  return normalize(vec3(heights.y-heights.x,${NORMAL_EPSILON*2},heights.w-heights.z));
}`;

export function createOcean(renderer, scene) {
  let waves = spectrum(12), wind=12, chop = 1.2, time = 0, causticTime=-1;
  const rippleTexture=new THREE.DataTexture(new Float32Array(RIPPLE.size**2*4),RIPPLE.size,RIPPLE.size,THREE.RGBAFormat,THREE.FloatType);
  rippleTexture.minFilter=rippleTexture.magFilter=THREE.LinearFilter;rippleTexture.needsUpdate=true;
  const fluid=createRippleField(groundHeight,{preferGPU:new URLSearchParams(location.search).get('fluid')!=='cpu',onChange:data=>{rippleTexture.image.data=data;rippleTexture.needsUpdate=true;}});
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const refractTarget = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: true, depthTexture: new THREE.DepthTexture(size.x, size.y) });
  const reflectTarget = createReflectionTarget(renderer,size.x,size.y);
  const uniforms = {
    uTime: { value: 0 }, uChop: { value: chop },
    uWaves: { value: waves.map(w => new THREE.Vector4(w.kx, w.kz, w.amplitude, w.phase)) },
    uFrequencies: { value: waves.map(w => w.freq) }, uRipples: { value: rippleTexture },
    uWaveSteps:{value:waves.map(normalSteps)},uShortSteps:{value:SHORT_WAVES.map(normalSteps)},
    uPixelNormals:{value:new URLSearchParams(location.search).get('normals')==='vertex'?0:1},
    uSurfaceDebug:{value:Number(new URLSearchParams(location.search).get('water-debug'))||0},
    uShortWaves:{value:SHORT_WAVES.map(w=>new THREE.Vector4(w.kx,w.kz,w.amplitude,w.frequency))},uRippleWind:{value:1},
    uResolution: { value: size }, uRefraction: { value: refractTarget.texture }, uReflection: { value: reflectTarget.texture },
    uSun: { value: new THREE.Vector3(-.6, .7, -.5).normalize() },
    uColor: { value: new THREE.Color('#329d91') }, uSky: { value: new THREE.Color('#c9e1d3') },
    uWarmth: { value: new THREE.Color('#ffdeb0') }, uLight: { value: 1 }, uSpecular: { value: 1 },
    uReflectionMatrix: { value: new THREE.Matrix4() },
    uRefractionDepth: { value: refractTarget.depthTexture }, uInverseViewProjection: { value: new THREE.Matrix4() },
  };
  const volume = createWaterLight(renderer, heightGLSL, uniforms);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `${heightGLSL}
      varying vec3 vWorld;
      varying vec4 vMirror;
      varying vec3 vWaterNormal;
      uniform mat4 uReflectionMatrix;
      void main() {
        vec3 p = position;
        p.y = heightAt(p.xz);
        float eps = .04;
        vWaterNormal = normalize(vec3(-(heightAt(p.xz+vec2(eps,0.0))-p.y)/eps,1.0,-(heightAt(p.xz+vec2(0.0,eps))-p.y)/eps));
        vWorld = p;
        vMirror = uReflectionMatrix * vec4(p.x, 0.0, p.z, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `${heightGLSL}
      varying vec3 vWorld;
      varying vec4 vMirror;
      varying vec3 vWaterNormal;
      uniform vec2 uResolution;
      uniform sampler2D uRefraction;
      uniform sampler2D uReflection;
      uniform vec3 uColor;
      uniform vec3 uSky;
      uniform vec3 uWarmth;
      uniform vec3 uSun;
      uniform float uLight;
      uniform float uSpecular;
      uniform sampler2D uRefractionDepth;
      uniform mat4 uInverseViewProjection;
      uniform float uPixelNormals;
      uniform float uSurfaceDebug;
      ${surfaceNormalGLSL}
      ${waterLightGLSL}
      vec3 refractedHit(vec2 uv) {
        float d = texture2D(uRefractionDepth, uv).r;
        vec4 world = uInverseViewProjection * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return world.xyz / world.w;
      }
      void main() {
        float h = vWorld.y;
        float depth = h - ground(vWorld.xz);
        if (depth < .015) discard;
        vec3 n = uPixelNormals > .5 ? surfaceNormal(vWorld.xz) : normalize(vWaterNormal);
        vec2 phase = vec2(vWorld.x * 8.0 + vWorld.z * 9.0 - uTime * 1.8, vWorld.x * 13.0 - vWorld.z * 7.0 + uTime * 2.0);
        // Suppress sub-pixel capillary waves instead of aliasing them into a grid.
        vec2 footprint = fwidth(phase);
        vec2 fine = vec2(sin(phase.x), cos(phase.y)) * .006 * (1.0 - smoothstep(vec2(.7), vec2(2.8), footprint));
        n = normalize(n + vec3(fine.x, 0.0, fine.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fresnel = .02 + .98 * pow(1.0 - max(dot(n,v), 0.0), 5.0);
        vec2 screen = gl_FragCoord.xy / uResolution;
        vec2 distortion = n.xz * .008 * min(depth, 1.0);
        vec2 bedUv = clamp(screen + distortion, .002, .998);
        vec3 hit = refractedHit(bedUv);
        // Distortion must not pull an above-water prop into the underwater ray.
        if(hit.y > h + .02 || dot(hit-vWorld,-v) < 0.0) { bedUv = screen; hit = refractedHit(bedUv); }
        vec3 bed = texture2D(uRefraction, bedUv).rgb;
        vec2 mirrorUv = vMirror.xy / vMirror.w + distortion * 1.2;
        vec3 reflection = texture2D(uReflection, clamp(mirrorUv, .002, .998)).rgb;
        vec3 transmitted = waterRadiance(vWorld,hit,bed);
        vec3 col = mix(transmitted, reflection, min(.9, fresnel + .1));
        float sun = pow(max(dot(reflect(-uSun,n), v), 0.0), 170.0);
        col += sun * uWarmth * uLight * uSpecular * 1.6;
        float rim = (1.0 - smoothstep(.05,.42,depth));
        float foam = rim * (.6 + .4 * sin(vWorld.x * 12.0 + vWorld.z * 16.0 + uTime));
        col = mix(col, vec3(.9,.96,.89) * uLight, foam * .7);
        float fog = 1.0 - exp(-length(cameraPosition-vWorld) * .006);
        col = mix(col, uSky, fog * .7);
        if(uSurfaceDebug==1.0)col=n*.5+.5;
        if(uSurfaceDebug==2.0)col=reflection;
        if(uSurfaceDebug==3.0)col=bed;
        if(uSurfaceDebug==4.0)col=vec3(length(hit-vWorld)/30.0);
        if(uSurfaceDebug==5.0)col=transmitted;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // One stitched topology: uniform around fishing/shore, stretched offshore.
  // Separate overlapping meshes left cracks where their wave samples differed.
  const axis=(lo,hi)=>[
    ...Array.from({length:40},(_,i)=>lo-(lo+180)*((40-i)/40)**2),
    ...Array.from({length:257},(_,i)=>lo+(hi-lo)*i/256),
    ...Array.from({length:40},(_,i)=>hi+(180-hi)*((i+1)/40)**2),
  ];
  const xs=axis(-13,13),zs=axis(0,26);
  const geometry=new THREE.PlaneGeometry(1,1,xs.length-1,zs.length-1);
  const positions=geometry.attributes.position;
  for(let z=0;z<zs.length;z++)for(let x=0;x<xs.length;x++)positions.setXYZ(z*xs.length+x,xs[x],0,zs[z]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'JONSWAP ocean'; mesh.frustumCulled = false; scene.add(mesh);
  // Refract a grid of sunlight rays through the same displaced surface, then
  // measure the area contraction on the seabed (rather than painting sine nets).
  const causticSize=768,causticSpan=40;
  const causticTarget=new THREE.WebGLRenderTarget(causticSize,causticSize,{type:THREE.HalfFloatType,depthBuffer:false});
  const causticScene=new THREE.Scene(),causticCamera=new THREE.Camera();
  const causticMaterial=new THREE.ShaderMaterial({
    uniforms,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,blending:THREE.AdditiveBlending,
    vertexShader:`${heightGLSL}
      uniform vec3 uSun;varying vec3 vOriginal,vProjected;varying float vWet;
      void main(){vec2 p=position.xz;float h=heightAt(p),e=.055;
        vec3 n=normalize(vec3(-(heightAt(p+vec2(e,0))-heightAt(p-vec2(e,0)))/(2.0*e),1.0,-(heightAt(p+vec2(0,e))-heightAt(p-vec2(0,e)))/(2.0*e)));
        vec3 ray=refract(-normalize(uSun),n,1.0/1.333);
        vec3 origin=vec3(p.x,h,p.y);float distanceToBed=max(0.0,(h-ground(p))/max(.15,-ray.y));
        vec3 hit=origin+ray*distanceToBed;
        distanceToBed=max(0.0,(h-ground(hit.xz))/max(.15,-ray.y));hit=origin+ray*min(distanceToBed,18.0);
        vOriginal=origin;vProjected=hit;vWet=step(.03,h-ground(p))*(1.0-smoothstep(10.0,14.0,-ground(p)));
        gl_Position=vec4(hit.x/20.0,(hit.z-10.0)/20.0,0.0,1.0);
      }`,
    fragmentShader:`varying vec3 vOriginal,vProjected;varying float vWet;
      void main(){float initial=length(cross(dFdx(vOriginal),dFdy(vOriginal)));
        float projected=length(cross(dFdx(vProjected),dFdy(vProjected)));
        float concentration=clamp(initial/max(projected,.00001),0.0,8.0);
        gl_FragColor=vec4(vec3(concentration*vWet),1.0);
      }`,
  });
  const causticGrid=new THREE.PlaneGeometry(causticSpan,causticSpan,320,320);causticGrid.rotateX(-Math.PI/2);causticGrid.translate(0,0,10);
  const rays=new THREE.Mesh(causticGrid,causticMaterial);rays.frustumCulled=false;causticScene.add(rays);
  const mirrorCamera = new THREE.PerspectiveCamera();
  const view = new THREE.Vector3(), target = new THREE.Vector3();
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.02);
  return {
    mesh, uniforms, fluid, volumeEvidence: () => volume.evidence(),
    surfaceEvidence: () => ({normalMode:uniforms.uPixelNormals.value?'per-pixel central difference':'legacy vertex interpolation',epsilon:NORMAL_EPSILON,reflection:{width:reflectTarget.width,height:reflectTarget.height,samples:reflectTarget.samples}}),
    optics:{caustics:{value:causticTarget.texture},light:uniforms.uLight,sun:uniforms.uSun},
    causticEvidence() {
      const pixels=new Uint16Array(causticSize*causticSize*4);
      renderer.readRenderTargetPixels(causticTarget,0,0,causticSize,causticSize,pixels);
      let min=Infinity,max=0,sum=0,lit=0;
      for(let i=0;i<pixels.length;i+=4){const v=THREE.DataUtils.fromHalfFloat(pixels[i]);min=Math.min(min,v);max=Math.max(max,v);sum+=v;if(v>1.1)lit++;}
      return {min,max,mean:sum/(causticSize*causticSize),focusedPixels:lit};
    },
    height(x, z, t = time) {
      let h = (waves.reduce((sum, w) => sum + w.amplitude * Math.sin(w.kx*x + w.kz*z - w.freq*t + w.phase), 0) * chop + shortWaveHeight(x,z,t,wind)) * smooth(-.05,8,-groundHeight(x,z));
      return h+fluid.height(x,z);
    },
    impulse(x, z, strength = .09) { fluid.impulse(x,z,strength); },
    setWeather(nextWind, choppiness) {
      wind=nextWind;waves = spectrum(wind); chop = choppiness; uniforms.uChop.value = chop;uniforms.uRippleWind.value=Math.min(1.6,Math.max(.4,wind/12));
      waves.forEach((w,i) => { uniforms.uWaves.value[i].set(w.kx,w.kz,w.amplitude,w.phase); uniforms.uFrequencies.value[i]=w.freq;uniforms.uWaveSteps.value[i].copy(normalSteps(w)); });
    },
    update(t) { time=t; uniforms.uTime.value=t;fluid.step(); },
    resize() {
      renderer.getDrawingBufferSize(size); refractTarget.setSize(size.x,size.y);
      reflectTarget.setSize(...reflectionSize(size.x,size.y));
    },
    render(camera, outputTarget = null) {
      if(time-causticTime>1/30){
        const color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
        renderer.setClearColor(0,0);renderer.setRenderTarget(causticTarget);renderer.render(causticScene,causticCamera);
        volume.render();
        renderer.setClearColor(color,alpha);causticTime=time;
      }
      mesh.visible=false;
      renderer.setRenderTarget(refractTarget); renderer.render(scene,camera);
      uniforms.uInverseViewProjection.value.multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
      mirrorCamera.copy(camera); mirrorCamera.position.y *= -1;
      camera.getWorldDirection(view); target.copy(camera.position).add(view); target.y *= -1;
      mirrorCamera.up.set(0,-1,0); mirrorCamera.lookAt(target); mirrorCamera.updateMatrixWorld();
      uniforms.uReflectionMatrix.value.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
      uniforms.uReflectionMatrix.value.multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
      const priorClips=renderer.clippingPlanes;
      renderer.clippingPlanes=[clip]; renderer.setRenderTarget(reflectTarget); renderer.render(scene,mirrorCamera);
      renderer.clippingPlanes=priorClips; mesh.visible=true; renderer.setRenderTarget(outputTarget); renderer.render(scene,camera);
    },
  };
}

export function makeSandMaterial(timeUniform,optics) {
  const material = new THREE.MeshStandardMaterial({color:0xe9d5a6,roughness:.93});
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uCaustics=optics.caustics;shader.uniforms.uCausticLight=optics.light;shader.uniforms.uCausticSun=optics.sun;
    shader.vertexShader = 'varying vec3 vTerrain;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain=position;');
    shader.fragmentShader = 'varying vec3 vTerrain; uniform float uTime,uCausticLight;uniform sampler2D uCaustics;uniform vec3 uCausticSun;\n' + causticWindowGLSL + '\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = fract(sin(dot(floor(vTerrain.xz*85.0),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb *= .94 + grain * .12;
      float wet = 1.0 - smoothstep(-.2,.55,vTerrain.y);
      diffuseColor.rgb *= mix(1.0,.79,wet);
      vec2 causticUv=(vTerrain.xz-vec2(-20.0,-10.0))/40.0;
      float caustic=texture2D(uCaustics,causticUv).r;
      float submerged=1.0-smoothstep(-.15,.015,vTerrain.y);
      float light=max(0.0,caustic-.8)*causticCoverage(causticUv)*submerged*exp(min(0.0,vTerrain.y)*.23)*uCausticLight;
      diffuseColor.rgb += vec3(.15,.20,.16)*min(light,2.5);`);
  };
  return material;
}
