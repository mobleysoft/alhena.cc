import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrondGeometry, createTrunkGeometry, PALM } from '../public/island/foliage.js';
import * as THREE from '../public/island/vendor/three.module.min.js';
import { prepareStaticGeometry } from '../public/island/static-geometry.js';

function valid(geometry) {
  for (const name of ['position', 'normal', 'color']) {
    const a = geometry.attributes[name];assert.ok(a);assert.ok(a.array.every(Number.isFinite));
    assert.equal(a.count, geometry.attributes.position.count);
  }
  for (const index of geometry.index.array) assert.ok(index < geometry.attributes.position.count);
  const n = geometry.attributes.normal;
  for (let i = 0; i < n.count; i++) assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .001);
}

test('palm fronds are deterministic bounded meshes with closed leaflets', () => {
  const a = createFrondGeometry(1), b = createFrondGeometry(1);valid(a);
  assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
  assert.ok(a.index.count / 3 < 2000);assert.ok(a.boundingSphere.radius < 3);
  assert.equal(a.attributes.position.count, PALM.pairs * 2 * (PALM.segments + 1) * 4);
  const edges = new Map();
  for (let i = 0; i < a.index.count; i += 3) {
    const v = Array.from(a.index.array.slice(i, i + 3));
    for (let j = 0; j < 3; j++) {
      const key = [v[j], v[(j + 1) % 3]].sort((x, y) => x - y).join(':');
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(n => n === 2), 'each leaflet edge belongs to two faces');
  a.dispose();b.dispose();
});

test('trunks taper along their curved centerline with finite normals', () => {
  for (const height of [5.9, 6.7, 6.8]) {
    const g = createTrunkGeometry(height);valid(g);g.computeBoundingBox();
    assert.ok(g.boundingBox.max.y >= height - .1);
    const p = g.attributes.position;
    const width = row => Math.hypot(p.getX(row * 13) - p.getX(row * 13 + 6), p.getY(row * 13) - p.getY(row * 13 + 6), p.getZ(row * 13) - p.getZ(row * 13 + 6));
    assert.ok(width(64) < width(0) * .7);
    g.dispose();
  }
});

test('static batching retains painted vertex colors and does not mutate its source', () => {
  const source=createTrunkGeometry(6),material=new THREE.MeshStandardMaterial({vertexColors:true});
  const trunk=new THREE.Mesh(source,material);trunk.position.set(2,0,3);trunk.updateMatrixWorld(true);
  const expanded=prepareStaticGeometry(trunk);
  assert.ok(expanded.attributes.color,'batched trunk must not render black');
  assert.equal(expanded.index,null);assert.ok(source.index,'source stays reusable');
  for(let i=0;i<expanded.attributes.color.count;i++){
    const original=source.index.array[i];
    for(const axis of ['getX','getY','getZ'])assert.equal(expanded.attributes.color[axis](i),source.attributes.color[axis](original));
    assert.ok(Math.abs(expanded.attributes.position.getX(i)-source.attributes.position.getX(original)-2)<1e-6);
  }
  expanded.dispose();source.dispose();material.dispose();
});
