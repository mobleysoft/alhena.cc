import * as THREE from './vendor/three.module.min.js';
import { createRippleField, RIPPLE } from './ripple-field.js';

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Small wind waves supply the curvature that focuses sunlight. The legacy
// 32-component swell remains unchanged; this layer also enters CPU buoyancy.
export const SHORT_WAVES=Object.freeze([.8,1.1,1.65,2.2].map((length,i)=>{
  const k=TAU/length,angle=[.4,-.7,1.1,-.2][i];
  return Object.freeze({kx:Math.cos(angle)*k,kz:Math.sin(angle)*k,amplitude:[.008,.010,.016,.019][i],frequency:Math.sqrt(9.81*k+.000074*k**3)});
}));
export const shortWaveHeight=(x,z,t,wind=12)=>SHORT_WAVES.reduce((h,w)=>h+w.amplitude*Math.sin(w.kx*x+w.kz*z-w.frequency*t),0)*Math.min(1.6,Math.max(.4,wind/12));
export function groundHeight(x, z) {
  const r = Math.hypot(x / 12.8, (z - 3.3) / 9.2);
  return 1.18 - 3.9 * smooth(.48, 1.22, r) - 16 * smooth(1.3, 4.8, r)
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
  return 1.18 - 3.9 * smoothstep(.48, 1.22, r) - 16.0 * smoothstep(1.3,4.8,r)
    + .10 * sin(p.x * .55) * cos(p.y * .47) * (1.0 - smoothstep(.45, .95, r));
}`;
const heightGLSL = `
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

export function createOcean(renderer, scene) {
  let waves = spectrum(12), wind=12, chop = 1.2, time = 0, causticTime=-1;
  const rippleTexture=new THREE.DataTexture(new Float32Array(RIPPLE.size**2*4),RIPPLE.size,RIPPLE.size,THREE.RGBAFormat,THREE.FloatType);
  rippleTexture.minFilter=rippleTexture.magFilter=THREE.LinearFilter;rippleTexture.needsUpdate=true;
  const fluid=createRippleField(groundHeight,{preferGPU:new URLSearchParams(location.search).get('fluid')!=='cpu',onChange:data=>{rippleTexture.image.data=data;rippleTexture.needsUpdate=true;}});
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const refractTarget = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: true });
  const reflectTarget = new THREE.WebGLRenderTarget(Math.max(256, size.x >> 1), Math.max(256, size.y >> 1));
  const uniforms = {
    uTime: { value: 0 }, uChop: { value: chop },
    uWaves: { value: waves.map(w => new THREE.Vector4(w.kx, w.kz, w.amplitude, w.phase)) },
    uFrequencies: { value: waves.map(w => w.freq) }, uRipples: { value: rippleTexture },
    uShortWaves:{value:SHORT_WAVES.map(w=>new THREE.Vector4(w.kx,w.kz,w.amplitude,w.frequency))},uRippleWind:{value:1},
    uResolution: { value: size }, uRefraction: { value: refractTarget.texture }, uReflection: { value: reflectTarget.texture },
    uSun: { value: new THREE.Vector3(-.6, .7, -.5).normalize() },
    uColor: { value: new THREE.Color('#329d91') }, uSky: { value: new THREE.Color('#c9e1d3') },
    uWarmth: { value: new THREE.Color('#ffdeb0') }, uLight: { value: 1 }, uSpecular: { value: 1 },
    uReflectionMatrix: { value: new THREE.Matrix4() },
  };
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
      void main() {
        float h = vWorld.y;
        float depth = h - ground(vWorld.xz);
        if (depth < .015) discard;
        vec3 n = normalize(vWaterNormal);
        vec2 phase = vec2(vWorld.x * 8.0 + vWorld.z * 9.0 - uTime * 1.8, vWorld.x * 13.0 - vWorld.z * 7.0 + uTime * 2.0);
        // Suppress sub-pixel capillary waves instead of aliasing them into a grid.
        vec2 footprint = fwidth(phase);
        vec2 fine = vec2(sin(phase.x), cos(phase.y)) * .006 * (1.0 - smoothstep(vec2(.7), vec2(2.8), footprint));
        n = normalize(n + vec3(fine.x, 0.0, fine.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fresnel = .02 + .98 * pow(1.0 - max(dot(n,v), 0.0), 5.0);
        vec2 screen = gl_FragCoord.xy / uResolution;
        vec2 distortion = n.xz * .008 * min(depth, 1.0);
        vec3 bed = texture2D(uRefraction, clamp(screen + distortion, .002, .998)).rgb;
        vec2 mirrorUv = vMirror.xy / vMirror.w + distortion * 1.2;
        vec3 reflection = texture2D(uReflection, clamp(mirrorUv, .002, .998)).rgb;
        vec3 absorption = exp(-depth * vec3(.92,.19,.12));
        vec3 transmitted = bed * absorption + uColor * uLight * (1.0 - absorption) * .42;
        vec3 col = mix(transmitted, reflection, min(.9, fresnel + .1));
        float sun = pow(max(dot(reflect(-uSun,n), v), 0.0), 170.0);
        col += sun * uWarmth * uLight * uSpecular * 1.6;
        float rim = (1.0 - smoothstep(.05,.42,depth));
        float foam = rim * (.6 + .4 * sin(vWorld.x * 12.0 + vWorld.z * 16.0 + uTime));
        col = mix(col, vec3(.9,.96,.89) * uLight, foam * .7);
        float fog = 1.0 - exp(-length(cameraPosition-vWorld) * .006);
        col = mix(col, uSky, fog * .7);
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
        vOriginal=origin;vProjected=hit;vWet=step(.03,h-ground(p))*step(-12.0,ground(p));
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
    mesh, uniforms, fluid,
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
      waves.forEach((w,i) => { uniforms.uWaves.value[i].set(w.kx,w.kz,w.amplitude,w.phase); uniforms.uFrequencies.value[i]=w.freq; });
    },
    update(t) { time=t; uniforms.uTime.value=t;fluid.step(); },
    resize() {
      renderer.getDrawingBufferSize(size); refractTarget.setSize(size.x,size.y);
      reflectTarget.setSize(Math.max(256,size.x>>1),Math.max(256,size.y>>1));
    },
    render(camera, outputTarget = null) {
      if(time-causticTime>1/30){
        const color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
        renderer.setClearColor(0,0);renderer.setRenderTarget(causticTarget);renderer.render(causticScene,causticCamera);
        renderer.setClearColor(color,alpha);causticTime=time;
      }
      mesh.visible=false;
      renderer.setRenderTarget(refractTarget); renderer.render(scene,camera);
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
    shader.fragmentShader = 'varying vec3 vTerrain; uniform float uTime,uCausticLight;uniform sampler2D uCaustics;uniform vec3 uCausticSun;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = fract(sin(dot(floor(vTerrain.xz*85.0),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb *= .94 + grain * .12;
      float wet = 1.0 - smoothstep(-.2,.55,vTerrain.y);
      diffuseColor.rgb *= mix(1.0,.79,wet);
      vec2 causticUv=(vTerrain.xz-vec2(-20.0,-10.0))/40.0;
      float caustic=texture2D(uCaustics,causticUv).r;
      caustic*=step(0.0,causticUv.x)*step(0.0,causticUv.y)*step(causticUv.x,1.0)*step(causticUv.y,1.0);
      float submerged=1.0-smoothstep(-.15,.015,vTerrain.y);
      float light=max(0.0,caustic-.8)*submerged*exp(min(0.0,vTerrain.y)*.23)*uCausticLight;
      diffuseColor.rgb += vec3(.15,.20,.16)*min(light,2.5);`);
  };
  return material;
}
