import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/island/vendor/three.module.min.js';
import { WATER_LIGHT, createLightSliceGeometry, integrateWaterLight } from '../public/island/water-light.js';

test('homogeneous light integration agrees with the analytic solution at every step count', () => {
  for (const distance of [0, .01, 1, 5, 24]) for (const steps of [1, 8, 32, 256]) {
    const result = integrateWaterLight(distance, () => [1, 1, 1], steps);
    for (let c = 0; c < 3; c++) {
      const t = Math.exp(-WATER_LIGHT.extinction[c] * distance);
      const r = (1 - t) * WATER_LIGHT.scattering[c] / WATER_LIGHT.extinction[c];
      assert.ok(Math.abs(result.transmission[c] - t) < 1e-12);
      assert.ok(Math.abs(result.radiance[c] - r) < 1e-12);
      assert.ok(result.transmission[c] + result.radiance[c] <= 1 + 1e-12, 'passive medium cannot invent energy');
    }
  }
});

test('light paths respect occlusion and colored extinction without negative or invalid radiance', () => {
  const dark = integrateWaterLight(8, () => [0, 0, 0]);assert.deepEqual(dark.radiance, [0, 0, 0]);
  const lit = integrateWaterLight(8), shadow = integrateWaterLight(8, d => d > 4 ? [0, 0, 0] : [1, 1, 1]);
  assert.ok(lit.transmission[0] < lit.transmission[1] && lit.transmission[1] < lit.transmission[2]);
  shadow.radiance.forEach((v, c) => assert.ok(v > 0 && v < lit.radiance[c]));
  for (const d of [-1, NaN, Infinity]) assert.throws(() => integrateWaterLight(d), RangeError);
  assert.throws(() => integrateWaterLight(1, () => [NaN, 0, 0]), RangeError);
  assert.throws(() => integrateWaterLight(1, undefined, 0), RangeError);
});

test('four light slices use bounded geometry with no triangle crossing between atlas tiles', () => {
  const g = createLightSliceGeometry(), p = g.attributes.position, s = g.attributes.slice, index = g.index;
  assert.equal(p.count, 4 * 129 * 129);assert.ok(index.count / 3 < 140000);
  assert.ok(p.array.every(Number.isFinite));assert.ok(s.array.every(Number.isFinite));
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    assert.equal(s.getX(a), s.getX(b));assert.equal(s.getX(a), s.getX(c));
    assert.equal(s.getY(a), Math.fround(WATER_LIGHT.depths[s.getX(a)]));
  }
  g.dispose();
});

test('depth reconstruction returns the actual world point, including translated cameras', () => {
  const camera = new THREE.PerspectiveCamera(40, 1.6, .1, 550);
  camera.position.set(26, 23, 33);camera.lookAt(-3, 1, 4);camera.updateMatrixWorld();
  const inverse = new THREE.Matrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  for (const point of [[0, -2, 12], [-2, -.4, 17], [4, -7, 22]]) {
    const world = new THREE.Vector3(...point), projected = world.clone().project(camera);
    const restored = new THREE.Vector4(projected.x, projected.y, projected.z, 1).applyMatrix4(inverse);
    const actual = new THREE.Vector3(restored.x, restored.y, restored.z).divideScalar(restored.w);
    assert.ok(actual.distanceTo(world) < 1e-9);
  }
});
