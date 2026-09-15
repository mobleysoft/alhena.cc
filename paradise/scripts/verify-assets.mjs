#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pipelinePath = path.join(root, 'assets.pipeline.json');
const runtimeManifestPath = path.join(root, 'public/assets/paradise-asset-manifest.json');

function fail(message) {
  console.error(`Asset verification failed: ${message}`);
  process.exit(1);
}

function mib(bytes) {
  return bytes / 1024 / 1024;
}

const pipeline = JSON.parse(await readFile(pipelinePath, 'utf8'));
const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, 'utf8'));
const runtimeIds = new Set((runtimeManifest.assets || []).map(asset => asset.id));

if (!Array.isArray(pipeline.slots) || pipeline.slots.length === 0) {
  fail('assets.pipeline.json has no slots');
}

const rows = [];
let presentBytes = 0;
for (const slot of pipeline.slots) {
  if (!slot.id || !slot.path) fail(`slot is missing id/path: ${JSON.stringify(slot)}`);
  if (!runtimeIds.has(slot.id)) fail(`${slot.id} is missing from public runtime manifest`);
  if (path.extname(slot.path).toLowerCase() !== '.glb') fail(`${slot.id} must target a .glb file`);

  const absolute = path.join(root, slot.path);
  if (!existsSync(absolute)) {
    rows.push({ id: slot.id, status: slot.required ? 'MISSING_REQUIRED' : 'missing_optional', sizeMiB: 0, path: slot.path, loadByDefault: false });
    if (slot.required) fail(`${slot.id} required asset is missing at ${slot.path}`);
    continue;
  }

  const info = await stat(absolute);
  const sizeMiB = mib(info.size);
  presentBytes += info.size;
  if (sizeMiB > slot.maxMiB) fail(`${slot.id} is ${sizeMiB.toFixed(2)} MiB, over ${slot.maxMiB} MiB budget`);
  const manifestEntry = (runtimeManifest.assets || []).find(asset => asset.id === slot.id) || {};
  const status = manifestEntry.status === 'candidate' || manifestEntry.loadByDefault === false ? 'present_candidate' : 'present';
  rows.push({ id: slot.id, status, sizeMiB: Number(sizeMiB.toFixed(2)), path: slot.path, loadByDefault: manifestEntry.loadByDefault !== false });
}

const totalMiB = mib(presentBytes);
if (totalMiB > pipeline.budgets.totalOptionalMiB) {
  fail(`present optional assets total ${totalMiB.toFixed(2)} MiB, over ${pipeline.budgets.totalOptionalMiB} MiB`);
}

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  totalPresentMiB: Number(totalMiB.toFixed(2)),
  slots: rows
}, null, 2));
