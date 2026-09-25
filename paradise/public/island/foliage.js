import * as THREE from './vendor/three.module.min.js';

export const PALM = Object.freeze({ pairs: 13, segments: 8, length: 3.25 });
const baseColor = new THREE.Color('#385d43');
const tipColor = new THREE.Color('#799258');

export function frondSpine(t) {
  return new THREE.Vector3(0, .85 * Math.sin(t * Math.PI) - .96 * t * t, t * PALM.length);
}

// Closed, folded leaflets give the canopy a real silhouette and lit underside.
// All pinnae in one frond share a buffer and draw call; the frond remains articulated.
export function createFrondGeometry(variant = 0) {
  const positions = [], colors = [], indices = [];
  for (let pair = 0; pair < PALM.pairs; pair++) {
    for (const side of [-1, 1]) {
      const t = .12 + pair / (PALM.pairs - 1) * .81 + (side < 0 ? .009 : 0);
      const root = frondSpine(t);
      const length = (.12 + 1.05 * Math.sin(t * Math.PI) ** .8) * (1 + .045 * Math.sin(pair * 2.3 + variant));
      const sweep = .22 + .26 * t;
      const cross = new THREE.Vector3(-sweep, 0, side).normalize();
      const offset = positions.length / 3;
      for (let step = 0; step <= PALM.segments; step++) {
        const u = step / PALM.segments;
        const width = .004 + .105 * Math.sin(Math.PI * u) ** .65 * (.6 + .4 * (1 - t));
        const center = root.clone().add(new THREE.Vector3(side * length * u, .13 * Math.sin(u * Math.PI) - .22 * u * u, length * sweep * u));
        const color = baseColor.clone().lerp(tipColor, .2 + .48 * u + .1 * Math.sin(pair * 1.7 + variant));
        // Viewed down the leaf: ridge, left edge, underside, right edge.
        for (const [across, elevation, shade] of [[0, .035 * Math.sin(Math.PI * u) + .003, 1.05], [-width, 0, .95], [0, -.012, .8], [width, 0, 1]]) {
          const p = center.clone().addScaledVector(cross, across);p.y += elevation;
          positions.push(p.x, p.y, p.z);colors.push(color.r * shade, color.g * shade, color.b * shade);
        }
      }
      for (let step = 0; step < PALM.segments; step++) {
        for (let edge = 0; edge < 4; edge++) {
          const a = offset + step * 4 + edge, b = offset + step * 4 + (edge + 1) % 4;
          indices.push(a, b, a + 4, b, b + 4, a + 4);
        }
      }
      indices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2);
      const end = offset + PALM.segments * 4;
      indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

export function createTrunkGeometry(height) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.3, height * .35, .1),
    new THREE.Vector3(-.1, height * .7, .2), new THREE.Vector3(.5, height, .15),
  ]);
  const segments = 64, radial = 12;
  const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const position = geometry.attributes.position, colors = [];
  const dark = new THREE.Color('#876c48'), light = new THREE.Color('#b39465');
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, center = curve.getPointAt(t);
    const ring = .5 + .5 * Math.cos(t * Math.PI * 30);
    const radius = (.23 - .10 * t) * (1 + ring * .06);
    const color = dark.clone().lerp(light, .2 + .35 * ring);
    for (let column = 0; column <= radial; column++) {
      const i = row * (radial + 1) + column;
      const p = new THREE.Vector3().fromBufferAttribute(position, i).sub(center).multiplyScalar(radius).add(center);
      position.setXYZ(i, p.x, p.y, p.z);colors.push(color.r, color.g, color.b);
    }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
