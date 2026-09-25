import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const base = process.env.PARADISE_URL || 'https://paradise.alhena.cc/';
const output = process.env.PARADISE_REPORT_DIR || fileURLToPath(new URL('../verification/release-current/', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
const paths = ['index.html', ...(await readdir(join(root, 'island')))
  .filter(name => /\.(js|css)$/.test(name)).map(name => `island/${name}`),
  'island/vendor/three.module.min.js', 'island/vendor/BufferGeometryUtils.js'];
const report = { at: new Date().toISOString(), base, files: [], ok: true };
for (const path of paths) {
  try {
    const expected = hash(await readFile(join(root, path)));
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    const actual = hash(Buffer.from(await response.arrayBuffer()));
    const ok = response.ok && expected === actual;
    report.files.push({ path, status: response.status, expected, actual, ok });
    report.ok &&= ok;
    console.log(`${ok ? 'MATCH' : 'FAIL'} ${response.status} ${path}`);
  } catch (error) {
    report.files.push({ path, ok: false, error: error.message });report.ok = false;
  }
}
await mkdir(output, { recursive: true });
await writeFile(join(output, 'source-hashes.json'), JSON.stringify(report, null, 2) + '\n');
if (!report.ok) process.exitCode = 1;
console.log(`Release source verification: ${report.ok ? 'PASS' : 'FAIL'} (${paths.length} files)`);
