import * as THREE from './vendor/three.module.min.js';

// Deliberate asymmetry leaves the jetty, dog circuit and cottage frontage clear.
export const ROCK_CLUSTERS = Object.freeze([
  [-8.8, 1.9, 1.32], [-8.4, 5.6, .88], [-6.2, 8.1, .62],
  [6.8, 7.8, 1.13], [8.8, 5.2, 1.26], [8.7, 1.4, .85],
  [6.5, -1.5, .98], [-1.8, -3.3, .86], [-7.3, -.9, 1.16],
].map(Object.freeze));
export const PLANT_PATCHES = Object.freeze([
  [-8.05, .7, 1.32], [-8, 4.7, 1.08], [-5.7, 8.1, 1.12],
  [5.4, 8.3, 1.18], [7.9, 5.8, 1.35], [8.05, 1.15, 1.24],
  [6.2, -1.25, 1.26], [-1.6, -2.45, 1.24], [-6.85, -.9, 1.16],
].map(Object.freeze));

function finish(geometry) {
  geometry.computeVertexNormals();
  // SphereGeometry duplicates the longitude seam. Average the shared normals
  // after deformation so a highlight cannot reveal that arbitrary seam.
  const n = geometry.attributes.normal;
  if (geometry.parameters?.widthSegments) {
    const w = geometry.parameters.widthSegments, h = geometry.parameters.heightSegments;
    for (let row = 0; row <= h; row++) {
      const first = row * (w + 1), last = first + w;
      const v = new THREE.Vector3(n.getX(first) + n.getX(last), n.getY(first) + n.getY(last), n.getZ(first) + n.getZ(last)).normalize();
      n.setXYZ(first, v.x, v.y, v.z);n.setXYZ(last, v.x, v.y, v.z);
    }
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function createStoneGeometry(seed = 0) {
  const geometry = new THREE.SphereGeometry(1, 28, 18), p = geometry.attributes.position;
  const colors = [], low = new THREE.Color('#7d8c87'), high = new THREE.Color('#c4c5af');
  const shape = v => Math.sign(v) * Math.abs(v) ** .82;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const erosion = 1 + .09 * Math.sin(x * 3.1 + seed * 1.7) * Math.cos(z * 3.8 - seed) + .045 * Math.sin(y * 6 + x * 2);
    const px = shape(x) * erosion, py = shape(y) * (.63 + .09 * Math.sin(seed + x * 2)), pz = shape(z) * erosion * .82;
    p.setXYZ(i, px + .08 * y, py, pz);
    const sediment = .035 * Math.sin(py * 18 + x * 1.2 + seed);
    const color = low.clone().lerp(high, THREE.MathUtils.clamp(.5 + y * .29 + sediment, 0, 1));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return finish(geometry);
}

export function createCoastalLeaf(seed = 0) {
  const geometry = new THREE.SphereGeometry(1, 10, 18), p = geometry.attributes.position;
  const colors = [], base = new THREE.Color('#375f45'), tip = new THREE.Color('#90aa72');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (y + 1) * .5;
    const reach = .78 + seed * .11;
    // A thick, folded leaf rather than a flat sprite; the center rib catches
    // a highlight while the shoulders turn down into the rosette.
    p.setXYZ(i, x * .28, Math.sin(t * 2.45) * reach - Math.abs(x) * .09 + z * .035, t * (1.02 + seed * .09));
    const color = base.clone().lerp(tip, .12 + t * .58 + .10 * (1 - Math.abs(x)));colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return finish(geometry);
}

export function gardenLayout(ground) {
  const rocks = [], plants = [];
  ROCK_CLUSTERS.forEach(([x, z, size], i) => {
    for (let j = 0; j < 3; j++) {
      const a = i * 2.4 + j * 2.15, r = j ? size * .9 : 0;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const scale = size * [1, .62, .4][j];
      rocks.push({ x: px, y: ground(px, pz) + scale * .19, z: pz, scale, angle: a, variant: (i + j) % 5 });
    }
  });
  PLANT_PATCHES.forEach(([x, z, scale], i) => {
    for (let j = 0; j < 3; j++) {
      const a = j * 2.4 + i, r = j ? .54 : 0, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      const y = ground(px, pz);
      if (y > .18) plants.push({ x: px, y: y - .035, z: pz, scale: scale * [1, .7, .53][j], angle: a });
    }
  });
  return { rocks, plants };
}

export function createCoastalGarden(parent, ground) {
  const group = new THREE.Group();group.name = 'Sculpted coastal garden';parent.add(group);
  const stone = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .84 });
  const leaf = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .65, side: THREE.DoubleSide });
  const stones = Array.from({ length: 5 }, (_, i) => createStoneGeometry(i));
  const leaves = Array.from({ length: 3 }, (_, i) => createCoastalLeaf(i));
  const layout = gardenLayout(ground);
  for (const item of layout.rocks) {
    const m = new THREE.Mesh(stones[item.variant], stone);m.name = 'Weathered stone';
    m.position.set(item.x, item.y, item.z);m.scale.setScalar(item.scale);m.rotation.y = item.angle;
    m.castShadow = m.receiveShadow = true;group.add(m);
  }
  for (const item of layout.plants) {
    const plant = new THREE.Group();plant.position.set(item.x, item.y, item.z);plant.scale.setScalar(item.scale);group.add(plant);
    for (let j = 0; j < 9; j++) {
      const m = new THREE.Mesh(leaves[j % 3], leaf);m.name = 'Coastal rosette';
      m.rotation.y = j * Math.PI * 2 / 9 + item.angle;
      m.scale.setScalar(.75 + .2 * Math.sin(j * 2.4));m.castShadow = m.receiveShadow = true;plant.add(m);
    }
  }
  return { group, layout };
}
