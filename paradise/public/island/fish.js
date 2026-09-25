import * as THREE from './vendor/three.module.min.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { species } from './catalog.js';

// Authored vinyl miniatures, not scans or a claim of exact biological anatomy.
export const fishStyles = [
  { depth: .85, width: 1, back: '#355e65', flank: '#94b2ac', belly: '#e1dcc5', fin: '#627f78', pattern: 'lines', fork: 1 },
  { depth: .84, width: .85, back: '#285369', flank: '#66a9b5', belly: '#dbe0c9', fin: '#b3ae69', pattern: 'stripe', fork: 1.12 },
  { depth: 1.12, width: 1.12, back: '#456763', flank: '#95a78c', belly: '#e3d9b9', fin: '#7f967a', pattern: 'spots', fork: .85 },
  { depth: 1.42, width: 1.04, back: '#756c3e', flank: '#d5b763', belly: '#f0dfaa', fin: '#b78b50', pattern: 'band', fork: .95 },
  { depth: 1.18, width: 1.1, back: '#8c4b44', flank: '#d7876d', belly: '#efc5a0', fin: '#b76551', pattern: 'lines', fork: .9 },
  { depth: 1.02, width: .94, back: '#426e6a', flank: '#67a997', belly: '#c9d2a0', fin: '#658d88', pattern: 'bars', fork: .6 },
  { depth: .78, width: .8, back: '#305d6c', flank: '#87b0b6', belly: '#dee2d1', fin: '#547c83', pattern: 'mackerel', fork: 1.18 },
  { depth: 1.04, width: 1.12, back: '#546f6a', flank: '#abb18a', belly: '#e5ddbb', fin: '#b99f62', pattern: 'stripe', fork: 1.1 },
];
const cache = new Map();
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .39, metalness: .08 });
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function skin(geometry, fixedBone) {
  const p = geometry.attributes.position, ids = [], weights = [];
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i); let a = 0, b = 0, mix = 0;
    if (fixedBone !== undefined) a = b = fixedBone;
    else if (z < -.52) { a = 2; b = 3; mix = smooth(-.52, -.8, z); }
    else if (z < -.3) { a = 1; b = 2; mix = smooth(-.3, -.52, z); }
    else if (z < -.08) { a = 0; b = 1; mix = smooth(-.08, -.3, z); }
    ids.push(a, b, 0, 0); weights.push(1 - mix, mix, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ids, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.deleteAttribute('uv');
  return geometry;
}

function paint(geometry, color) {
  const colors = [], c = new THREE.Color(color);
  for (let i = 0; i < geometry.attributes.position.count; i++) c.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function bodyGeometry(style) {
  const positions = [0, 0, -.5], colors = [], indices = [], around = 32, length = 42;
  const back = new THREE.Color(style.back), flank = new THREE.Color(style.flank), belly = new THREE.Color(style.belly);
  const dark = back.clone().multiplyScalar(.64), color = new THREE.Color();
  back.toArray(colors, 0);
  for (let i = 1; i < length; i++) {
    const t = i / length, z = -.5 + t;
    const radius = Math.sin(t * Math.PI) ** .57 * (.35 + .65 * Math.sin(t * Math.PI * .78));
    for (let j = 0; j < around; j++) {
      const a = j / around * Math.PI * 2, side = Math.sin(a), x = Math.cos(a) * .112 * style.width * radius;
      const y = side * .17 * style.depth * radius + .014 * Math.sin(Math.PI * t);
      positions.push(x, y, z);
      color.copy(flank).lerp(back, smooth(.12, .92, side)).lerp(belly, smooth(.05, -.95, side));
      const flankMask = (1 - smooth(.7, .95, Math.abs(side))) * smooth(.06, .22, t) * (1 - smooth(.82, .94, t));
      let mark = 0;
      if (style.pattern === 'lines') mark = Math.exp(-(Math.sin(side * 18) ** 2) * 34) * .2;
      if (style.pattern === 'stripe') mark = Math.exp(-((side * 12) ** 2)) * .65;
      if (style.pattern === 'band') mark = Math.exp(-(((z - .24) * 34) ** 2)) * .7;
      if (style.pattern === 'bars') mark = Math.exp(-(Math.sin(z * 32 + side * 3) ** 2) * 9) * .38;
      if (style.pattern === 'mackerel') mark = Math.exp(-(Math.sin(z * 49 + Math.sin(side * 9)) ** 2) * 12) * smooth(-.15, .55, side) * .85;
      if (style.pattern === 'spots') mark = Math.exp(-(Math.sin(z * 47 + side * 8) ** 2 + Math.sin(side * 24) ** 2) * 13) * .85;
      // An inset gill arc belongs to the same skin rather than floating beside it.
      mark = Math.max(mark * flankMask, Math.exp(-(((z - .21 + side * side * .08) * 95) ** 2)) * flankMask * .48);
      color.lerp(dark, mark);color.toArray(colors, colors.length);
    }
  }
  const tip = positions.length / 3;positions.push(0, 0, .5);flank.toArray(colors, colors.length);
  for (let j = 0; j < around; j++) {
    const next = (j + 1) % around;indices.push(0, 1 + next, 1 + j);
    for (let i = 0; i < length - 2; i++) {
      const a = 1 + i * around + j, b = 1 + i * around + next, c = a + around, d = b + around;
      indices.push(a, b, c, b, d, c);
    }
    const last = 1 + (length - 2) * around;indices.push(tip, last + j, last + next);
  }
  const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));g.setIndex(indices);g.computeVertexNormals();
  return skin(g);
}

// Closed, rounded lens: a curved fin outline, thick at the root, soft at the edge.
function finGeometry(outline, center, thickness, color, transform = new THREE.Matrix4(), fixedBone) {
  const curve = new THREE.CatmullRomCurve3(outline.map(([y, z]) => new THREE.Vector3(0, y, z)), true, 'centripetal');
  const n = 48, rings = 5, positions = [], indices = [], colors = [];
  const base = new THREE.Color(color), edge = base.clone().lerp(new THREE.Color('#eddfb7'), .28);
  const c = new THREE.Color();
  function vertex(x, y, z, t, phase = 0) {
    positions.push(x, y, z);c.copy(base).lerp(edge, t * t * .65);
    c.multiplyScalar(1 - .07 * Math.cos(phase * 16) * Math.sin(t * Math.PI));c.toArray(colors, colors.length);
    return positions.length / 3 - 1;
  }
  const equator = [];
  for (let j = 0; j < n; j++) { const b = curve.getPoint(j / n);equator.push(vertex(0, b.y, b.z, 1)); }
  function tri(a, b, c, sign) {
    const ay = positions[b * 3 + 1] - positions[a * 3 + 1], az = positions[b * 3 + 2] - positions[a * 3 + 2];
    const by = positions[c * 3 + 1] - positions[a * 3 + 1], bz = positions[c * 3 + 2] - positions[a * 3 + 2];
    if ((ay * bz - az * by) * sign < 0) indices.push(a, c, b);else indices.push(a, b, c);
  }
  for (const sign of [-1, 1]) {
    const pole = vertex(sign * thickness, ...center, 0);let previous = null;
    for (let r = 1; r <= rings; r++) {
      const angle = r / rings * Math.PI / 2, t = Math.sin(angle), ring = [];
      for (let j = 0; j < n; j++) {
        const b = curve.getPoint(j / n);
        ring.push(r === rings ? equator[j] : vertex(sign * thickness * Math.cos(angle), center[0] + (b.y - center[0]) * t, center[1] + (b.z - center[1]) * t, t, j / n * Math.PI * 2));
      }
      for (let j = 0; j < n; j++) {
        const k = (j + 1) % n;
        if (!previous) tri(pole, ring[j], ring[k], sign);
        else { tri(previous[j], ring[j], previous[k], sign);tri(previous[k], ring[j], ring[k], sign); }
      }
      previous = ring;
    }
  }
  const g = new THREE.BufferGeometry();g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));g.setIndex(indices);g.computeVertexNormals();g.applyMatrix4(transform);
  return skin(g, fixedBone);
}

function spherePart(position, scale, color) {
  const g = new THREE.SphereGeometry(1, 16, 12);g.scale(...scale);g.translate(...position);return skin(paint(g, color), 0);
}

export function createFishGeometry(index = 0) {
  const style = fishStyles[index % fishStyles.length], h = .17 * style.depth, parts = [bodyGeometry(style)];
  const tail = [[0, -.445], [.07, -.51], [.26 * style.fork, -.87], [.09, -.84], [0, -.73], [-.09, -.84], [-.24 * style.fork, -.87], [-.065, -.51]];
  parts.push(finGeometry(tail, [0, -.63], .022, style.fin));
  parts.push(finGeometry([[h * .76, .21], [h * 1.75, .06], [h * 1.52, -.17], [h * .45, -.4]], [h * 1.02, -.07], .019, style.fin));
  parts.push(finGeometry([[-h * .74, .02], [-h * 1.4, -.21], [-h * .43, -.4]], [-h * .86, -.2], .014, style.fin));
  for (const side of [-1, 1]) {
    const transform = new THREE.Matrix4().makeRotationZ(side * .88);transform.setPosition(side * .095 * style.width, -.035, .14);
    parts.push(finGeometry([[0, .03], [-.15, -.055], [-.22, -.27], [-.09, -.19]], [-.08, -.1], .011, style.fin, transform, side < 0 ? 4 : 5));
    const eyeX = .076 * style.width, eyeY = h * .28, eyeZ = .34;
    parts.push(spherePart([side * eyeX, eyeY, eyeZ], [.022, .037, .042], '#c3bd81'));
    parts.push(spherePart([side * (eyeX + .016), eyeY, eyeZ + .002], [.012, .024, .028], '#162f34'));
    parts.push(spherePart([side * (eyeX + .027), eyeY + .009, eyeZ + .012], [.004, .006, .006], '#f7ebd0'));
  }
  const merged = mergeGeometries(parts);for (const p of parts) p.dispose();
  merged.computeBoundingBox();merged.computeBoundingSphere();return merged;
}

export function makeFish(parent, index = 0) {
  const variant = index % fishStyles.length;
  if (!cache.has(variant)) cache.set(variant, createFishGeometry(variant));
  const g = new THREE.Group(), mesh = new THREE.SkinnedMesh(cache.get(variant), material), bones = [];
  for (let i = 0; i < 6; i++) {const b = new THREE.Bone();b.name = ['head', 'spine', 'tail', 'tail-tip', 'left-fin', 'right-fin'][i];bones.push(b);}
  bones[0].add(bones[1], bones[4], bones[5]);bones[1].position.z = -.13;bones[1].add(bones[2]);bones[2].position.z = -.28;
  bones[2].add(bones[3]);bones[3].position.z = -.32;
  bones[4].position.set(-.095 * fishStyles[variant].width, -.035, .14);bones[5].position.set(.095 * fishStyles[variant].width, -.035, .14);
  mesh.add(bones[0]);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow = true;mesh.receiveShadow = true;
  // Animation never leaves this conservative bound; do not recalculate 14 hulls every frame.
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -.18), 1);
  g.add(mesh);parent.add(g);
  const p = mesh.geometry.attributes.position;let tailVertex = 0, headVertex = 0;
  for (let i = 1; i < p.count; i++) {if (p.getZ(i) < p.getZ(tailVertex)) tailVertex = i;if (p.getZ(i) > p.getZ(headVertex)) headVertex = i;}
  function vertexPosition(i) {const v = new THREE.Vector3().fromBufferAttribute(p, i);return mesh.applyBoneTransform(i, v).toArray();}
  return {g, mesh, bones, name: species[variant].name,
    update(time, {reducedMotion = false} = {}) {
      const phase = time * (6.2 + variant * .18) + index * 2.1, amplitude = reducedMotion ? .25 : 1;
      bones[1].rotation.y = Math.sin(phase) * .08 * amplitude;
      bones[2].rotation.y = Math.sin(phase - .65) * .22 * amplitude;
      bones[3].rotation.y = Math.sin(phase - 1.3) * .18 * amplitude;
      for (let i = 4; i < 6; i++) bones[i].rotation.z = Math.sin(phase * .5 + (i - 4) * .7) * .16 * amplitude;
    },
    evidence() {
      g.updateMatrixWorld(true);mesh.skeleton.update();
      return {name: species[variant].name, variant, skinned: mesh.isSkinnedMesh, bones: bones.length,
        vertices: p.count, triangles: mesh.geometry.index.count / 3, tail: vertexPosition(tailVertex), head: vertexPosition(headVertex)};
    },
  };
}
