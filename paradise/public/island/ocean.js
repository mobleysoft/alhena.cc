import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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
uniform vec4 uImpacts[8];
${groundGLSL}
float heightAt(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 32; i++) {
    vec4 w = uWaves[i];
    h += w.z * sin(dot(w.xy, p) - uFrequencies[i] * uTime + w.w);
  }
  h *= uChop * smoothstep(-.05, 8.0, -ground(p));
  for (int i = 0; i < 8; i++) {
    vec4 impact = uImpacts[i];
    float age = uTime - impact.z;
    float dist = length(p - impact.xy);
    float front = dist - age * 2.3;
    float edge = 1.0-smoothstep(4.5,5.8,max(abs(p.x-.5),abs(p.y-19.0)));
    if (age > 0.0 && age < 6.0) h += sin(front * 13.0) * exp(-front * front * 2.8) * exp(-age * .8) * impact.w * edge;
  }
  return h;
}`;

export function createOcean(renderer, scene) {
  let waves = spectrum(12), chop = 1.2, time = 0, impulseIndex = 0;
  const impacts = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0));
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const refractTarget = new THREE.WebGLRenderTarget(size.x, size.y, { depthBuffer: true });
  const reflectTarget = new THREE.WebGLRenderTarget(Math.max(256, size.x >> 1), Math.max(256, size.y >> 1));
  const uniforms = {
    uTime: { value: 0 }, uChop: { value: chop },
    uWaves: { value: waves.map(w => new THREE.Vector4(w.kx, w.kz, w.amplitude, w.phase)) },
    uFrequencies: { value: waves.map(w => w.freq) }, uImpacts: { value: impacts },
    uResolution: { value: size }, uRefraction: { value: refractTarget.texture }, uReflection: { value: reflectTarget.texture },
    uSun: { value: new THREE.Vector3(-.6, .7, -.5).normalize() },
    uColor: { value: new THREE.Color('#329d91') }, uSky: { value: new THREE.Color('#c9e1d3') },
    uWarmth: { value: new THREE.Color('#ffdeb0') }, uLight: { value: 1 }, uSpecular: { value: 1 },
    uReflectionMatrix: { value: new THREE.Matrix4() },
    uDetailLayer: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `${heightGLSL}
      varying vec3 vWorld;
      varying vec4 vMirror;
      varying vec3 vWaterNormal;
      uniform mat4 uReflectionMatrix;
      uniform float uDetailLayer;
      void main() {
        vec3 p = position;
        if(uDetailLayer<.5) p.xz = sign(p.xz) * pow(abs(p.xz) / 180.0, vec2(2.2)) * 180.0;
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
      uniform float uDetailLayer;
      void main() {
        if(uDetailLayer<.5 && abs(vWorld.x-.5)<6.0 && abs(vWorld.z-19.0)<6.0) discard;
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
  const geometry = new THREE.PlaneGeometry(360, 360, 220, 220);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'JONSWAP ocean'; mesh.frustumCulled = false; scene.add(mesh);
  // Resolving the short bobber ripples on the distant ocean's coarse grid
  // produced triangular reflection folds. This local patch samples each crest.
  const detailGeometry = new THREE.PlaneGeometry(13,13,168,168);
  detailGeometry.rotateX(-Math.PI/2);detailGeometry.translate(.5,0,19);
  const detailMaterial=material.clone();
  detailMaterial.uniforms={...uniforms,uDetailLayer:{value:1}};
  const detailMesh=new THREE.Mesh(detailGeometry,detailMaterial);
  detailMesh.name='Resolved fishing ripples';detailMesh.frustumCulled=false;scene.add(detailMesh);
  const mirrorCamera = new THREE.PerspectiveCamera();
  const view = new THREE.Vector3(), target = new THREE.Vector3();
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.02);
  return {
    mesh, uniforms,
    height(x, z, t = time) {
      let h = waves.reduce((sum, w) => sum + w.amplitude * Math.sin(w.kx*x + w.kz*z - w.freq*t + w.phase), 0) * chop * smooth(-.05,8,-groundHeight(x,z));
      for (const p of impacts) { const age=t-p.z, front=Math.hypot(x-p.x,z-p.y)-age*2.3;
        const edge=1-smooth(4.5,5.8,Math.max(Math.abs(x-.5),Math.abs(z-19)));
        if(age>0 && age<6) h += Math.sin(front*13)*Math.exp(-front*front*2.8)*Math.exp(-age*.8)*p.w*edge;
      } return h;
    },
    impulse(x, z, strength = .09) { impacts[impulseIndex++ % 8].set(x,z,time,strength); },
    setWeather(wind, choppiness) {
      waves = spectrum(wind); chop = choppiness; uniforms.uChop.value = chop;
      waves.forEach((w,i) => { uniforms.uWaves.value[i].set(w.kx,w.kz,w.amplitude,w.phase); uniforms.uFrequencies.value[i]=w.freq; });
    },
    update(t) { time=t; uniforms.uTime.value=t; },
    resize() {
      renderer.getDrawingBufferSize(size); refractTarget.setSize(size.x,size.y);
      reflectTarget.setSize(Math.max(256,size.x>>1),Math.max(256,size.y>>1));
    },
    render(camera, outputTarget = null) {
      mesh.visible=false;detailMesh.visible=false;
      renderer.setRenderTarget(refractTarget); renderer.render(scene,camera);
      mirrorCamera.copy(camera); mirrorCamera.position.y *= -1;
      camera.getWorldDirection(view); target.copy(camera.position).add(view); target.y *= -1;
      mirrorCamera.up.set(0,-1,0); mirrorCamera.lookAt(target); mirrorCamera.updateMatrixWorld();
      uniforms.uReflectionMatrix.value.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
      uniforms.uReflectionMatrix.value.multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
      const priorClips=renderer.clippingPlanes;
      renderer.clippingPlanes=[clip]; renderer.setRenderTarget(reflectTarget); renderer.render(scene,mirrorCamera);
      renderer.clippingPlanes=priorClips; mesh.visible=true;detailMesh.visible=true; renderer.setRenderTarget(outputTarget); renderer.render(scene,camera);
    },
  };
}

export function makeSandMaterial(timeUniform) {
  const material = new THREE.MeshStandardMaterial({color:0xe9d5a6,roughness:.93});
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'varying vec3 vTerrain;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain=position;');
    shader.fragmentShader = 'varying vec3 vTerrain; uniform float uTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = fract(sin(dot(floor(vTerrain.xz*85.0),vec2(12.9898,78.233)))*43758.5453);
      diffuseColor.rgb *= .94 + grain * .12;
      float wet = 1.0 - smoothstep(-.2,.55,vTerrain.y);
      diffuseColor.rgb *= mix(1.0,.79,wet);
      float a=sin(vTerrain.x*2.6+sin(vTerrain.z*2.3+uTime*.5));
      float b=sin(vTerrain.z*3.0+sin(vTerrain.x*2.1-uTime*.4));
      float caustic=pow(max(0.0,1.0-abs(a+b)*.6),14.0);
      diffuseColor.rgb += vec3(.13,.19,.12)*caustic*(1.0-smoothstep(-.45,-.04,vTerrain.y))*exp(min(0.0,vTerrain.y)*.18);`);
  };
  return material;
}
