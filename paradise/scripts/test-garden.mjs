import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/island/vendor/three.module.min.js';
import { createStoneGeometry, createCoastalLeaf, gardenLayout, createCoastalGarden } from '../public/island/coastal-garden.js';
import { groundHeight } from '../public/island/ocean.js';
import { createQuadruped } from '../public/island/locomotion.js';

test('sculpted assets have finite bounded geometry, colors and seam normals', () => {
  for (const build of [createStoneGeometry, createCoastalLeaf]) for (let i = 0; i < 3; i++) {
    const g = build(i), duplicate = build(i);
    assert.deepEqual(g.attributes.position.array, duplicate.attributes.position.array);
    assert.ok(g.boundingSphere.radius < 2);
    for (const name of ['position', 'normal', 'color']) assert.ok(g.attributes[name].array.every(Number.isFinite));
    const n = g.attributes.normal;
    for (let v = 0; v < n.count; v++) assert.ok(Math.hypot(n.getX(v), n.getY(v), n.getZ(v)) > .99);
    assert.ok(g.attributes.color.array.every(v => v >= 0 && v <= 1));
    g.dispose();duplicate.dispose();
  }
});

test('coastal garden uses shared meshes, bounded materials and dry planting', () => {
  const parent = new THREE.Group(), garden = createCoastalGarden(parent, groundHeight);
  const geometries = new Set(), materials = new Set();let triangles = 0;
  garden.group.traverse(m => {if(m.isMesh){geometries.add(m.geometry);materials.add(m.material);triangles += m.geometry.index.count / 3;}});
  assert.equal(materials.size, 2);assert.ok(geometries.size <= 8);assert.ok(triangles < 150000);
  assert.equal(garden.layout.rocks.length, 27);assert.ok(garden.layout.plants.length > 12);
  for (const p of garden.layout.plants) assert.ok(groundHeight(p.x, p.z) > .18);
  for (const g of geometries) g.dispose();for (const m of materials) m.dispose();
});

test('decorative clusters leave the jetty and walking dog circuit clear', () => {
  const layout = gardenLayout(groundHeight), gait = createQuadruped(groundHeight);
  for (const item of [...layout.rocks, ...layout.plants]) {
    const radius = item.scale * 1.25;
    assert.ok(!(Math.abs(item.x - 1) < 1.4 + radius && item.z + radius > 9), 'jetty clearance includes prop footprint');
  }
  for (let frame = 0; frame < 60 * 100; frame++) {
    const { root } = gait.update(1 / 60, { moving: true });
    for (const item of [...layout.rocks, ...layout.plants]) {
      assert.ok(Math.hypot(item.x - root[0], item.z - root[2]) > item.scale * 1.25 + .9, 'dog must not intersect new props');
    }
  }
});
