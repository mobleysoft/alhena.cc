import * as THREE from './vendor/three.module.min.js';

export const WATER_LIGHT = Object.freeze({
  depths: Object.freeze([.35, 1.2, 3, 7]), span: 40, grid: 128, tile: 256, steps: 8,
  extinction: Object.freeze([.70, .17, .115]), scattering: Object.freeze([.04, .068, .05]), anisotropy: .2,
});

// Reference for the shader's piecewise-constant radiative-transfer integration.
// Each step integrates its extinction exactly, avoiding step-size-dependent fog.
export function integrateWaterLight(distance, incident = () => [1, 1, 1], steps = WATER_LIGHT.steps) {
  if (!Number.isFinite(distance) || distance < 0 || !Number.isInteger(steps) || steps < 1 || steps > 1024) throw new RangeError('invalid light path');
  const transmission = [1, 1, 1], radiance = [0, 0, 0], ds = distance / steps;
  for (let i = 0; i < steps; i++) {
    const light = incident((i + .5) * ds);
    for (let c = 0; c < 3; c++) {
      if (!Number.isFinite(light[c]) || light[c] < 0) throw new RangeError('invalid incident radiance');
      const stepT = Math.exp(-WATER_LIGHT.extinction[c] * ds);
      radiance[c] += transmission[c] * (1 - stepT) * WATER_LIGHT.scattering[c] / WATER_LIGHT.extinction[c] * light[c];
      transmission[c] *= stepT;
    }
  }
  return { transmission, radiance };
}

export function createLightSliceGeometry() {
  const { grid, span, depths } = WATER_LIGHT, row = grid + 1, count = row * row;
  const positions = new Float32Array(count * depths.length * 3), slices = new Float32Array(count * depths.length * 2);
  const indices = new Uint32Array(grid * grid * depths.length * 6);
  let index = 0;
  depths.forEach((depth, layer) => {
    for (let z = 0; z <= grid; z++) for (let x = 0; x <= grid; x++) {
      const i = layer * count + z * row + x;
      positions.set([(x / grid - .5) * span, 0, (z / grid - .5) * span + 10], i * 3);
      slices.set([layer, depth], i * 2);
      if (z < grid && x < grid) {
        indices.set([i, i + row, i + 1, i + 1, i + row, i + row + 1], index);index += 6;
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('slice', new THREE.BufferAttribute(slices, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));return geometry;
}

const glVec = values => `vec3(${values.map(v => v.toFixed(6)).join(',')})`;
export const waterLightGLSL = `
uniform sampler2D uLightVolume;
uniform float uVolumeEnabled;
const vec3 extinction = ${glVec(WATER_LIGHT.extinction)};
const vec3 scattering = ${glVec(WATER_LIGHT.scattering)};
float lightSlice(vec2 uv, float layer) {
  vec2 tile = vec2(mod(layer, 2.0), floor(layer / 2.0));
  // Half-texel bounds prevent bilinear reads leaking between depth slices.
  return texture2D(uLightVolume, (tile + clamp(uv, .5 / 256.0, 255.5 / 256.0)) * .5).r;
}
float focusedLight(vec3 p) {
  vec2 uv = (p.xz - vec2(-20.0, -10.0)) / 40.0;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
  float d = max(0.0, -p.y), focus;
  if (d < .35) focus = mix(1.0, lightSlice(uv, 0.0), d / .35);
  else if (d < 1.2) focus = mix(lightSlice(uv, 0.0), lightSlice(uv, 1.0), (d - .35) / .85);
  else if (d < 3.0) focus = mix(lightSlice(uv, 1.0), lightSlice(uv, 2.0), (d - 1.2) / 1.8);
  else focus = mix(lightSlice(uv, 2.0), lightSlice(uv, 3.0), clamp((d - 3.0) / 4.0, 0.0, 1.0));
  float edge = smoothstep(0.0, .04, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
  return mix(1.0, min(focus, 5.0), edge);
}
vec3 waterRadiance(vec3 start, vec3 end, vec3 bed) {
  vec3 path = end - start;
  float distanceInWater = min(length(path), 24.0);
  vec3 direction = normalize(path + vec3(0.0, -.00001, 0.0));
  vec3 sunlight = refract(-normalize(uSun), vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  float cosine = dot(sunlight, -direction), g = ${WATER_LIGHT.anisotropy.toFixed(6)};
  float phase = (1.0 - g*g) / pow(max(.01, 1.0 + g*g - 2.0*g*cosine), 1.5);
  float ds = distanceInWater / ${WATER_LIGHT.steps.toFixed(1)};
  vec3 stepT = exp(-extinction * ds), transmittance = vec3(1.0), radiance = vec3(0.0);
  for (int i = 0; i < ${WATER_LIGHT.steps}; i++) {
    vec3 p = start + direction * (float(i) + .5) * ds;
    float lightDistance = max(0.0, start.y - p.y) / max(.3, -sunlight.y);
    vec3 direct = uWarmth * exp(-extinction * lightDistance) * focusedLight(p) * phase;
    vec3 incident = (direct * .35 + uColor) * uLight;
    radiance += transmittance * (1.0 - stepT) * scattering / extinction * incident;
    transmittance *= stepT;
  }
  return bed * transmittance + radiance * uVolumeEnabled;
}`;

export function createWaterLight(renderer, heightGLSL, uniforms) {
  const size = WATER_LIGHT.tile * 2;
  const target = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: false });
  target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;
  uniforms.uLightVolume = { value: target.texture };
  uniforms.uVolumeEnabled = { value: new URLSearchParams(location.search).get('volume') === 'off' ? 0 : 1 };
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: `${heightGLSL}
      attribute vec2 slice; uniform vec3 uSun;
      varying vec3 vOriginal, vProjected; varying float vWet; varying vec2 vLocal;
      void main() {
        vec2 p = position.xz; float h = heightAt(p), e = .055;
        vec3 n = normalize(vec3(-(heightAt(p+vec2(e,0.0))-heightAt(p-vec2(e,0.0)))/(2.0*e),1.0,
          -(heightAt(p+vec2(0.0,e))-heightAt(p-vec2(0.0,e)))/(2.0*e)));
        vec3 ray = refract(-normalize(uSun), n, 1.0 / 1.333);
        vec3 origin = vec3(p.x,h,p.y), hit = origin + ray * max(0.0,(h + slice.y) / max(.15,-ray.y));
        vOriginal = origin; vProjected = hit;
        // Only wet surface entries transmit sunlight. Do not zero a slice
        // below the local bed: interpolation would falsely shadow the water
        // above it. The viewing ray already stops at the real depth buffer.
        vWet = step(.03,h-ground(p));
        vLocal = vec2(hit.x / 20.0, (hit.z - 10.0) / 20.0);
        vec2 tile = vec2(mod(slice.x,2.0),floor(slice.x/2.0));
        gl_Position = vec4(vLocal * .5 + tile - .5, 0.0, 1.0);
      }`,
    fragmentShader: `varying vec3 vOriginal,vProjected; varying float vWet; varying vec2 vLocal;
      void main() {
        if(any(greaterThan(abs(vLocal),vec2(1.0)))) discard;
        float initial = length(cross(dFdx(vOriginal),dFdy(vOriginal)));
        float projected = length(cross(dFdx(vProjected),dFdy(vProjected)));
        gl_FragColor = vec4(vec3(clamp(initial / max(projected,.00001),0.0,8.0) * vWet),1.0);
      }`,
  });
  const rays = new THREE.Mesh(createLightSliceGeometry(), material);rays.frustumCulled = false;scene.add(rays);
  let frames = 0;
  return {
    render() { renderer.setRenderTarget(target);renderer.render(scene,camera);frames++; },
    dispose() { rays.geometry.dispose();material.dispose();target.dispose(); },
    evidence() {
      const pixels = new Uint16Array(size * size * 4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
      const slices = WATER_LIGHT.depths.map(depth => ({ depth, min: Infinity, max: 0, sum: 0, focused: 0 }));
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const s = slices[Math.floor(y / WATER_LIGHT.tile) * 2 + Math.floor(x / WATER_LIGHT.tile)];
        const v = THREE.DataUtils.fromHalfFloat(pixels[(y * size + x) * 4]);
        s.min = Math.min(s.min,v);s.max = Math.max(s.max,v);s.sum += v;if(v > 1.2)s.focused++;
      }
      return { frames, enabled: uniforms.uVolumeEnabled.value === 1, steps: WATER_LIGHT.steps,
        slices: slices.map(({sum,...s}) => ({...s,mean:sum / WATER_LIGHT.tile**2})) };
    },
  };
}
