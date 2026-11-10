import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This reads source bytes and historical metadata. It executes no product code.
const root = fileURLToPath(new URL('../../', import.meta.url));
const options = new Map();
const allowed = new Set(['--manifest', '--current-root', '--historical-root']);
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const value = args[index + 1];
  assert.ok(allowed.has(flag) && value && !value.startsWith('--'), `Invalid option: ${flag}`);
  assert.ok(!options.has(flag), `Duplicate option: ${flag}`);
  options.set(flag, value);
}
assert.ok(options.has('--historical-root'), 'Supply --historical-root with the retained candidate bytes');
const currentRoot = path.resolve(options.get('--current-root') ?? root);
const historicalRoot = path.resolve(options.get('--historical-root'));
const manifestPath = path.resolve(
  options.get('--manifest') ?? path.join(root, 'internal/records/2026-11-10-finf-1157-adjacent-source-reconciliation.json')
);
const manifestBytes = readFileSync(manifestPath);
const record = JSON.parse(manifestBytes.toString('utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digest = (value) => sha256(JSON.stringify(value) + '\n');
const validHash = (value) => /^[a-f0-9]{64}$/.test(value);
const expectedPathSet = '3d2687423cee0d91cc72e11741c94112fd232a1a2718c8c56ec26d7955cea36c';
const expectedLayers = '7ea23e690684a106cbdc284662862f56d9592ab8c9a6c91f7a33b39ed4cb39cc';
const expectedConditions = 'd797243fab9f9e0811f630c5bff90d3b30fecf3f2622c4576bda72505213422a';
const expectedMissing = [
  'spec/contracts/C-HOOK-0001.yaml',
  'spec/tests/T-HOOK-0001.yaml',
  'spec/tests/T-HOOK-0002.yaml',
].sort();
assert.equal(record.kind, 'finf.adjacent-source-reconciliation');
assert.equal(record.issue, 1157);
assert.equal(record.repositoryId, 'github.com:Proto-UI/Proto-UI');
assert.equal(record.binding.historicalBase, '6047ee9fb6dbf703f603ffb7832780df58c41fe7');
assert.equal(record.sourceRows.length, 42, 'Preserve every historical candidate path');
const paths = record.sourceRows.map((row) => row.path);
assert.equal(new Set(paths).size, 42, 'Candidate path identities must be unique');
for (const filename of paths) {
  assert.ok(!path.isAbsolute(filename) && !filename.split('/').includes('..'), 'Repository-relative paths only');
}
assert.equal(digest([...paths].sort()), expectedPathSet, 'The exact original 42-path set changed');
assert.equal(record.binding.pathSetSha256, expectedPathSet);
assert.equal(record.layers.length, 6, 'Preserve all six ordered source layers');
const layerProjection = record.layers.map((layer) => ({
  id: layer.id,
  files: layer.files.map((file) => [file.path, file.beforeSha256 ?? null, file.afterSha256 ?? file.sha256]),
}));
assert.equal(digest(layerProjection), expectedLayers, 'A historical layer identity, order or hash changed');
assert.equal(record.binding.layersSha256, expectedLayers);
const rows = new Map(record.sourceRows.map((row) => [row.path, row]));
const finalHashes = new Map(record.sourceRows.map((row) => [row.path, row.historicalPreimage.sha256]));
const layerIds = new Map(paths.map((filename) => [filename, []]));
for (const layer of record.layers) {
  for (const file of layer.files) {
    assert.ok(rows.has(file.path), `Unknown candidate: ${file.path}`);
    const next = file.afterSha256 ?? file.sha256;
    assert.ok(validHash(next), `Missing historical hash: ${file.path}`);
    if (file.beforeSha256 !== undefined) {
      assert.equal(finalHashes.get(file.path), file.beforeSha256, `Broken source overlay: ${file.path}`);
    }
    finalHashes.set(file.path, next);
    layerIds.get(file.path).push(layer.id);
  }
}

// Resolve each original path at the immutable base, without lazy fetches.
const preimages = record.sourceRows.filter((row) => row.historicalPreimage.present);
const batch = execFileSync('git', ['cat-file', '--batch'], {
  cwd: currentRoot,
  input: record.sourceRows.map((row) => `${record.binding.historicalBase}:${row.path}`).join('\n') + '\n',
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  maxBuffer: 64 * 1024 * 1024,
});
let offset = 0;
for (const row of record.sourceRows) {
  const end = batch.indexOf(10, offset);
  assert.ok(end >= offset, `Missing preimage header: ${row.path}`);
  const header = batch.subarray(offset, end).toString('utf8');
  offset = end + 1;
  if (!row.historicalPreimage.present) {
    assert.equal(header, `${record.binding.historicalBase}:${row.path} missing`);
    continue;
  }
  const [objectId, type, count] = header.split(' ');
  const size = Number(count);
  assert.equal(objectId, row.historicalPreimage.gitBlobSha);
  assert.equal(type, 'blob', `Unavailable immutable preimage: ${row.path}`);
  assert.ok(Number.isSafeInteger(size) && size >= 0);
  const bytes = batch.subarray(offset, offset + size);
  assert.equal(bytes.length, size);
  assert.equal(sha256(bytes), row.historicalPreimage.sha256, `Preimage mismatch: ${row.path}`);
  offset += size + 1;
}
assert.equal(offset, batch.length, 'Unexpected immutable preimage output');
const missingCurrent = [];
for (const row of record.sourceRows) {
  assert.equal(row.finalHistoricalSha256, finalHashes.get(row.path));
  assert.deepEqual(row.layerIds, layerIds.get(row.path));
  assert.equal(
    sha256(readFileSync(path.join(historicalRoot, row.path))),
    row.finalHistoricalSha256,
    `Retained historical source differs: ${row.path}`
  );
  let current = null;
  try {
    current = sha256(readFileSync(path.join(currentRoot, row.path)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.equal(current !== null, row.currentSource.present, `Current source presence differs: ${row.path}`);
  assert.equal(current, row.currentSource.sha256, `Current source bytes differ: ${row.path}`);
  if (current === null) missingCurrent.push(row.path);
}
assert.deepEqual(missingCurrent.sort(), expectedMissing);
assert.deepEqual(record.sourceRows.filter((row) => !row.historicalPreimage.present).map((row) => row.path).sort(), expectedMissing);
assert.equal(record.conditions.length, 6);
assert.equal(digest(record.conditions.map(({ key, parentKey, original, parentOriginal }) => ({
  key, parentKey, original, parentOriginal,
}))), expectedConditions, 'The complete original condition text or parent-source binding changed');
for (let index = 0; index < record.conditions.length; index += 1) {
  const condition = record.conditions[index];
  assert.equal(condition.key, `issue.1157.${String(index + 1).padStart(3, '0')}`);
  assert.equal(condition.parentKey, `issue.1093.${String(index + 7).padStart(3, '0')}`);
  assert.equal(condition.historicalChecked, false);
  assert.equal(condition.original, condition.parentOriginal, 'The inherited compound condition changed');
  assert.equal(condition.currentAcceptance, 'unmet');
}
assert.equal(record.lastUnacknowledgedAction.resultRecorded, false, 'A tool start cannot become a result');
assert.equal(record.lastUnacknowledgedAction.checks.length, 5);
for (const check of record.lastUnacknowledgedAction.checks) assert.equal(check.result, 'not-recorded');
assert.equal(record.terminalMap.dataType, 'string');
assert.equal(record.terminalMap.dataEmpty, true);
assert.equal(record.terminalMap.schemaRejected, true);
assert.equal(record.terminalMap.validTerminalMap, false);
assert.equal(record.terminalMap.consumedOrAccepted, false);
console.log(JSON.stringify({
  kind: 'finf.1157.source-readback',
  manifestSha256: sha256(manifestBytes),
  historicalCandidatePaths: paths.length,
  immutablePreimages: preimages.length,
  currentPaths: paths.length - missingCurrent.length,
  currentAbsentPaths: missingCurrent,
  productChecksExecuted: false,
  productAcceptance: 'not-assessed',
  publicationOrIssueClosure: 'not-performed',
}, null, 2));
