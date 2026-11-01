import assert from 'node:assert/strict';
import { lstat, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractBoundedZip, materializeBoundedZip } from './extract-artifact.mjs';
import { PREVIEW_LIMITS, sanitizePreviewTree } from './sanitize-tree.mjs';
import { formatProducerStats, summarizeProducerStats } from './producer-stat-inventory.mjs';

const artifact = process.env.PREVIEW_GENERATED_ARTIFACT;

async function inventory(root, directory = root, files = new Map()) {
  for (const entry of await readdir(directory)) {
    const filename = path.join(directory, entry);
    const stat = await lstat(filename);
    assert.equal(stat.isSymbolicLink(), false, filename);
    if (stat.isDirectory()) await inventory(root, filename, files);
    else {
      assert.equal(stat.isFile(), true, filename);
      files.set(path.relative(root, filename).split(path.sep).join('/'), await readFile(filename));
    }
  }
  return files;
}

test(
  'admits every file of the complete generated documentation artifact unchanged',
  { skip: artifact ? false : 'run after the canonical apps-www build with its complete ZIP' },
  async (t) => {
    assert.ok(process.env.PREVIEW_GENERATED_SOURCE, 'the complete producer directory is required');
    // Diagnostic only: observe the builder's canonical dist before the existing
    // ZIP guard. Unknown stats never authorize admission or skip that guard.
    const sourceRoot = path.resolve(process.env.PREVIEW_GENERATED_SOURCE);
    const stats =
      sourceRoot === path.resolve('apps/www/dist')
        ? await summarizeProducerStats(sourceRoot)
        : { status: 'unavailable', reason: 'not-canonical-dist' };
    t.diagnostic(`producer-stat-inventory ${formatProducerStats(stats)}`);
    const bytes = await readFile(artifact);
    assert.ok(bytes.length <= PREVIEW_LIMITS.maxCompressedBytes, 'the compressed artifact fits');
    // Use the publisher's defaults, including its hostile-archive checks. A
    // successful build alone does not establish producer/admission compatibility.
    const admitted = extractBoundedZip(bytes);
    const source = await inventory(path.resolve(process.env.PREVIEW_GENERATED_SOURCE));
    const names = [...source.keys()].sort();
    assert.ok(source.get('index.html')?.length, 'the canonical entrypoint is present');
    assert.deepEqual([...admitted.keys()].sort(), names);
    for (const name of names) assert.deepEqual(admitted.get(name), source.get(name), name);

    const root = await mkdtemp(path.join(tmpdir(), 'preview-generated-artifact-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const extracted = path.join(root, 'extracted');
    const output = path.join(root, 'sanitized');
    await materializeBoundedZip(bytes, extracted);
    const result = await sanitizePreviewTree({ source: extracted, output });
    const sanitized = await inventory(output);
    assert.equal(result.files, source.size);
    assert.deepEqual([...sanitized.keys()].sort(), names);
    for (const name of names) assert.deepEqual(sanitized.get(name), source.get(name), name);
    t.diagnostic(
      `${source.size} complete files; ${bytes.length} compressed bytes; ${result.bytes} expanded bytes`
    );
  }
);
