import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectGraph, sourceCompatibility } from './validate-model.mjs';
const load = async (name) =>
  JSON.parse(await readFile(new URL(`${name}.json`, import.meta.url), 'utf8'));
for (const name of ['studio', 'flutter'])
  test(`${name} source pipeline is serializable and structurally modeled, not admitted`, async () => {
    const graph = await load(name),
      result = inspectGraph(graph);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
    assert.equal(result.execution, 'not-admitted');
    assert.deepEqual(JSON.parse(JSON.stringify(graph)), graph);
  });
test('same-frame ordering is explicit and cycles/current target reads are rejected', async () => {
  const graph = await load('studio');
  graph.passes[3].dependsOn = [];
  assert(inspectGraph(graph).errors.some((x) => x.code === 'missing-read-after-write-order'));
  graph.passes[0].dependsOn = ['main-pass'];
  graph.passes[3].dependsOn = ['background-pass'];
  assert(inspectGraph(graph).errors.some((x) => x.code === 'pass-cycle'));
  graph.passes[0].reads.push('background');
  assert(inspectGraph(graph).errors.some((x) => x.code === 'current-target-feedback'));
});
test('host objects, callback closures and anonymous shader strings are not graph data', async () => {
  for (const [key, value] of [
    ['shaderSource', 'void main(){}'],
    ['callback', () => {}],
    ['gpuDevice', new Map()],
  ]) {
    const graph = await load('studio');
    graph[key] = value;
    assert.equal(inspectGraph(graph).valid, false);
  }
});
test('formats, spaces, alpha and immutable kernel provenance cannot disappear', async () => {
  const graph = await load('flutter');
  delete graph.resources[0].alpha;
  assert(inspectGraph(graph).errors.some((x) => x.code === 'incomplete-resource-contract'));
  graph.kernels[0].upstream.commit = 'main';
  assert(inspectGraph(graph).errors.some((x) => x.code === 'unpinned-kernel'));
});
test('mixed scalar ABI and bounded weight arrays retain actual target limits', async () => {
  const graph = await load('studio');
  assert.equal(graph.uniformBlocks[0].bytes, 160);
  assert.equal(graph.data[0].maxCount, 201);
  assert.equal(graph.data[0].targetBindings.webgpu, 'read-only-storage-buffer');
  graph.uniformBlocks[0].fields[1].offset = 0;
  assert(inspectGraph(graph).errors.some((x) => x.code === 'uniform-overlap'));
});
test('Flutter geometry has bounded shape storage and no invented physical format', async () => {
  const graph = await load('flutter');
  assert.equal(graph.uniformBlocks[0].fields.find((x) => x.name === 'uShapeData').count, 112);
  assert.equal(graph.resources[0].format, 'host-managed-ui-image');
  assert.equal(graph.sources[0].kind, 'host-compositor-backdrop');
  assert.equal(graph.sources[0].reservedSampler, 0);
});
test('copied or reconstructed texture never silently satisfies a live backdrop requirement', () => {
  assert.equal(
    sourceCompatibility('host-compositor-backdrop', 'reconstructed-scene').compatible,
    false
  );
  assert.equal(
    sourceCompatibility('host-compositor-backdrop', 'application-owned-captured-texture')
      .compatible,
    false
  );
  assert.equal(sourceCompatibility('application-texture', 'application-texture').compatible, true);
});
test('structural success does not clear an unresolved license or claim compilation', async () => {
  const result = inspectGraph(await load('studio'));
  assert.equal(result.valid, true);
  assert(result.reasons.some((x) => x.includes('Unresolved license')));
  assert.equal(result.execution, 'not-admitted');
});

test('uniform blocks and intermediate producers cannot be disconnected', async () => {
  const missingBlock = await load('studio');
  missingBlock.uniformBlocks = [];
  assert.equal(inspectGraph(missingBlock).valid, false);
  const producer = await load('studio');
  producer.passes.splice(1, 1);
  producer.passes[1].dependsOn = ['background-pass'];
  assert(inspectGraph(producer).errors.some((x) => x.code === 'missing-resource-producer'));
  const writesSource = await load('studio');
  writesSource.passes[0].writes = 'media';
  assert(inspectGraph(writesSource).errors.some((x) => x.code === 'external-source-write'));
});
test('bounded data and ABI require explicit size and known types', async () => {
  const graph = await load('studio');
  delete graph.data[0].maxCount;
  assert.equal(inspectGraph(graph).valid, false);
  const abi = await load('studio');
  delete abi.uniformBlocks[0].bytes;
  assert.equal(inspectGraph(abi).valid, false);
  const type = await load('studio');
  type.uniformBlocks[0].fields[0].type = 'gpu-object';
  assert.equal(inspectGraph(type).valid, false);
});
test('omitted Flutter frost preprocessing cannot be enabled through unrestricted uniforms', async () => {
  const graph = await load('flutter');
  const frost = graph.uniformBlocks[1].fields.find((f) => f.name === 'uFrost');
  frost.binding = { kind: 'frame-value', id: 'uFrost' };
  assert(inspectGraph(graph).errors.some((x) => x.code === 'disabled-feature-precondition'));
});
test('live Flutter uniforms remain host-owned and Studio background tracks shape motion', async () => {
  const flutter = await load('flutter');
  const size = flutter.uniformBlocks[1].fields.find((f) => f.name === 'uSize');
  size.binding = { kind: 'frame-value', id: 'uSize' };
  assert(inspectGraph(flutter).errors.some((x) => x.code === 'host-binding-ownership'));
  const studio = await load('studio');
  assert(studio.passes[0].update.dependencies.includes('pointer-spring-state'));
  assert(studio.kernels[0].license.startsWith('blocked'));
});

test('live compositor sampler ownership cannot be replaced with a data texture', async () => {
  const graph = await load('flutter');
  graph.passes[1].bindings.uBackgroundTexture = 'geometry';
  assert(inspectGraph(graph).errors.some((x) => x.code === 'host-sampler-ownership'));
});

test('Flutter live coordinates distinguish matte raster DPR from screen placement', async () => {
  const graph = await load('flutter');
  assert.equal(
    graph.frameInputs.find((f) => f.id === 'matte-transform').to,
    'screen-logical-pixels'
  );
  assert.equal(
    graph.frameInputs.find((f) => f.id === 'enclosing-filter-pass-rect').space,
    'screen-physical-pixels'
  );
  assert.equal(
    graph.frameInputs.find((f) => f.id === 'screen-device-pixel-ratio').distinctFrom,
    'matte-dpr'
  );
  const offset = graph.uniformBlocks[1].fields.find((f) => f.name === 'uCaptureOffset');
  assert.deepEqual(offset.binding, { kind: 'constant', value: [0, 0] });
  offset.binding = { kind: 'frame-value', id: 'uCaptureOffset' };
  assert(inspectGraph(graph).errors.some((e) => e.code === 'disabled-feature-precondition'));
});
