import * as THREE from './vendor/three.module.min.js';

export const RAIN = { drops: 600, rings: 64, lifetime: .85, span: 48, ceiling: 24 };

// Decorative rain contacts sample the existing ocean. They do not inject 600
// impulses per frame into the fishing solver or pretend to be a fluid simulation.
export function createRainState({ height, ground, random = Math.random, reducedMotion = false }) {
  const drops = Array.from({ length: RAIN.drops }, () => ({
    x: (random() - .5) * RAIN.span, y: 2 + random() * RAIN.ceiling,
    z: (random() - .5) * RAIN.span + 8, speed: 12 + random() * 5,
  }));
  const rings = Array.from({ length: RAIN.rings }, () => ({ alive: false }));
  let intensity = 0, contacts = 0, dryContacts = 0;
  function step(dt, storm) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .05);
    const target = storm && !reducedMotion ? 1 : 0;
    intensity += (target - intensity) * (1 - Math.exp(-dt * 2.5));
    if (intensity < .002 && !target) intensity = 0;
    for (const ring of rings) {
      if (!ring.alive) continue;
      ring.age += dt;
      ring.y = height(ring.x, ring.z);
      if (ring.age >= RAIN.lifetime || ring.y - ground(ring.x, ring.z) < .035) ring.alive = false;
    }
    if (!intensity) return;
    for (let i = 0; i < Math.ceil(drops.length * intensity); i++) {
      const d = drops[i];
      d.x += dt * 2.4; d.z += dt * .7; d.y -= dt * d.speed;
      if (d.x > RAIN.span / 2) d.x -= RAIN.span;
      if (d.z > RAIN.span / 2 + 8) d.z -= RAIN.span;
      const water = height(d.x, d.z), bed = ground(d.x, d.z);
      if (d.y > Math.max(water, bed)) continue;
      if (water - bed > .035) {
        contacts++;
        const ring = rings.find(r => !r.alive);
        if (ring) Object.assign(ring, { alive: true, x: d.x, z: d.z, y: water, age: 0 });
      } else dryContacts++;
      d.x = (random() - .5) * RAIN.span;
      d.z = (random() - .5) * RAIN.span + 8;
      d.y = RAIN.ceiling + random() * 3;
    }
  }
  return { drops, rings, step, snapshot: () => ({ intensity, contacts, dryContacts,
    drops: Math.ceil(drops.length * intensity), rings: rings.filter(r => r.alive).length,
    reducedMotion, capacity: RAIN.rings }) };
}

export function createRain(scene, ocean, ground, options = {}) {
  const state = createRainState({ height: (x, z) => ocean.height(x, z), ground, ...options });
  const positions = new Float32Array(RAIN.drops * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.LineBasicMaterial({ color: '#d8edeb', transparent: true, opacity: .28, depthWrite: false });
  const streaks = new THREE.LineSegments(geometry, material);
  streaks.name = 'Wind-slanted rain'; streaks.frustumCulled = false; scene.add(streaks);

  const ringGeometry = new THREE.PlaneGeometry(1, 1);
  const lives = new Float32Array(RAIN.rings);
  ringGeometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(lives, 1).setUsage(THREE.DynamicDrawUsage));
  const ringMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#d8edeb') }, uOpacity: { value: 0 } },
    vertexShader: `attribute float aLife; varying vec2 vUv; varying float vLife;
      void main(){vUv=uv;vLife=aLife;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; varying float vLife; uniform vec3 uColor; uniform float uOpacity;
      void main(){float r=length(vUv-.5)*2.0;
        float ring=smoothstep(.68,.79,r)*(1.0-smoothstep(.84,.98,r));
        float alpha=ring*sin(vLife*3.14159265)*(1.0-vLife)*uOpacity;
        if(alpha<.003)discard;gl_FragColor=vec4(uColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, RAIN.rings);
  rings.name = 'Rain contact rings'; rings.frustumCulled = false;
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rings.count = 0; scene.add(rings);
  const dummy = new THREE.Object3D(), normal = new THREE.Vector3(), planeNormal = new THREE.Vector3(0, 0, 1);
  function update(dt, storm) {
    state.step(dt, storm);
    const snapshot = state.snapshot();
    streaks.visible = snapshot.intensity > 0;
    material.opacity = .32 * snapshot.intensity;
    for (let i = 0; i < snapshot.drops; i++) {
      const d = state.drops[i], offset = i * 6;
      positions.set([d.x, d.y, d.z, d.x - .075, d.y + d.speed * .032, d.z - .022], offset);
    }
    geometry.setDrawRange(0, snapshot.drops * 2); geometry.attributes.position.needsUpdate = true;
    let count = 0;
    for (const r of state.rings) {
      if (!r.alive) continue;
      const life = r.age / RAIN.lifetime, radius = .035 + life * .3;
      // Align each ring with the current water tangent, rather than y=0.
      const dx = (ocean.height(r.x + .08, r.z) - ocean.height(r.x - .08, r.z)) / .16;
      const dz = (ocean.height(r.x, r.z + .08) - ocean.height(r.x, r.z - .08)) / .16;
      normal.set(-dx, 1, -dz).normalize();
      dummy.position.set(r.x, r.y + .025, r.z);
      dummy.quaternion.setFromUnitVectors(planeNormal, normal);
      dummy.scale.setScalar(radius * 2); dummy.updateMatrix();
      rings.setMatrixAt(count, dummy.matrix); lives[count++] = life;
    }
    rings.count = count; rings.visible = count > 0;
    rings.instanceMatrix.needsUpdate = true; ringGeometry.attributes.aLife.needsUpdate = true;
    ringMaterial.uniforms.uOpacity.value = snapshot.intensity * .55;
  }
  return { update, snapshot: () => ({ ...state.snapshot(), renderedRings: rings.count }),
    setColor(color) { material.color.copy(color).lerp(new THREE.Color('#e4f0eb'), .75); ringMaterial.uniforms.uColor.value.copy(material.color); } };
}
