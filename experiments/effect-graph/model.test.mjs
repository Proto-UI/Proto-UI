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
  const image = { kind: 'application-texture', sourceKinds: ['owned-image'] };
  assert.equal(sourceCompatibility(image, image).compatible, true);
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

test('malformed collection members return an invalid inspection without throwing', async () => {
  for (const key of ['kernels', 'sources', 'resources', 'data', 'passes', 'uniformBlocks']) {
    for (const value of [null, 3, {}, 'invalid']) {
      const graph = await load('studio');
      graph[key].push(value);
      const result = inspectGraph(graph);
      assert.equal(result.valid, false, `${key}: ${JSON.stringify(value)}`);
      assert.equal(result.execution, 'not-admitted');
    }
  }
});

test('missing or malformed nested metadata stays a diagnostic, never an exception', async () => {
  const mutations = [
    (g) => delete g.kernels[0].license,
    (g) => (g.kernels[0].license = 7),
    (g) => (g.kernels[0].upstream.commit = { toString: null }),
    (g) => (g.kernels[0].uniformBlocks = {}),
    (g) => delete g.kernels[0].samplers,
    (g) => (g.kernels[1].samplers = [null]),
    (g) => (g.passes[1].reads = {}),
    (g) => (g.passes[1].dependsOn = 2),
    (g) => (g.passes[1].bindings = []),
    (g) => (g.uniformBlocks[0].fields = [null]),
    (g) => (g.uniformBlocks[0].fields[0].type = { toString: null }),
    (g) => delete g.uniformBlocks[0].fields,
    (g) => (g.uniformBlocks[0].reservedAutoInputs = {}),
    (g) => (g.featurePreconditions = [null]),
    (g) => (g.featurePreconditions = [{ mode: 'excluded' }]),
  ];
  for (const mutate of mutations) {
    const graph = await load('flutter');
    mutate(graph);
    const result = inspectGraph(graph);
    assert.equal(result.valid, false, String(mutate));
    assert.equal(result.execution, 'not-admitted');
  }
});

test('every declared texture sampler requires its own pass binding', async () => {
  for (const name of ['studio', 'flutter']) {
    const original = await load(name);
    for (const pass of original.passes) {
      const kernel = original.kernels.find((k) => k.id === pass.kernel);
      for (const sampler of kernel.samplers ?? []) {
        const graph = structuredClone(original);
        delete graph.passes.find((p) => p.id === pass.id).bindings[sampler.name];
        const result = inspectGraph(graph);
        assert(result.errors.some((e) => e.code === 'missing-sampler-binding'));
        assert.equal(result.execution, 'not-admitted');
      }
    }
  }
  const studio = await load('studio');
  studio.passes[3].bindings = {};
  assert.equal(inspectGraph(studio).valid, false);
});

test('packed scalar and vector fields cannot forge or omit their typed byte length', async () => {
  for (const bytes of [1, 4, 12, 16, undefined]) {
    const graph = await load('studio');
    if (bytes === undefined) delete graph.uniformBlocks[0].fields[0].bytes;
    else graph.uniformBlocks[0].fields[0].bytes = bytes;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'uniform-byte-size'));
  }
  const noOffset = await load('studio');
  delete noOffset.uniformBlocks[0].fields[0].offset;
  assert(inspectGraph(noOffset).errors.some((e) => e.code === 'uniform-out-of-bounds'));
  const wrongVector = await load('studio');
  wrongVector.uniformBlocks[0].fields[0].type = 'vec4f';
  assert(inspectGraph(wrongVector).errors.some((e) => e.code === 'uniform-byte-size'));
});

test('packed widths distinguish vector size from padding and reject unmodeled strides', async () => {
  // WGSL SizeOf(vec3<f32>) is 12 despite its 16-byte alignment. This probe
  // checks a field's byte length, not complete struct layout or reflection.
  const vector = await load('studio');
  vector.uniformBlocks[0].fields = [{ name: 'probe', type: 'vec3<f32>', offset: 0, bytes: 12 }];
  const result = inspectGraph(vector);
  assert(!result.errors.some((error) => error.code === 'uniform-byte-size'));
  // A valid synthetic field width is not the pinned Studio shader's interface.
  assert(result.errors.some((error) => error.code === 'source-interface-fact-mismatch'));
  vector.uniformBlocks[0].fields[0].bytes = 16;
  assert(inspectGraph(vector).errors.some((e) => e.code === 'uniform-byte-size'));
  for (const field of [
    { name: 'matrix', type: 'mat3<f32>', offset: 0, bytes: 36 },
    { name: 'array', type: 'f32', count: 4, offset: 0, bytes: 16 },
  ]) {
    const graph = await load('studio');
    graph.uniformBlocks[0].fields = [field];
    assert(inspectGraph(graph).errors.some((e) => e.code === 'unsupported-packed-uniform-type'));
  }
});

test('read-only data binding names and kinds remain mandatory for blur kernels', async () => {
  for (const passIndex of [1, 2]) {
    const graph = await load('studio');
    delete graph.passes[passIndex].bindings.u_blurWeights;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'missing-data-binding'));
    graph.passes[passIndex].bindings.u_blurWeights = 'background';
    assert(inspectGraph(graph).errors.some((e) => e.code === 'data-binding-mismatch'));
  }
  const graph = await load('studio');
  delete graph.kernels[1].dataBindings;
  assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-data-binding-contract'));
});

test('unknown and absent uniform ABI labels cannot disable packed bounds', async () => {
  for (const abi of [undefined, '', 'wgsl-uniform-bufer']) {
    const graph = await load('studio');
    if (abi === undefined) delete graph.uniformBlocks[0].abi;
    else graph.uniformBlocks[0].abi = abi;
    delete graph.uniformBlocks[0].bytes;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'unknown-uniform-abi'));
  }
});

test('declared finite pass ceilings bound the actual graph', async () => {
  for (const limit of [undefined, 0, 1, 3.5, 9, '4']) {
    const graph = await load('studio');
    if (limit === undefined) delete graph.limits.passes;
    else graph.limits.passes = limit;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'unsupported-graph-budget'));
  }
  const graph = await load('studio');
  graph.limits.passes = 5;
  assert.equal(inspectGraph(graph).valid, true);
});

test('indexed application samplers cannot omit or collide with reserved slots', async () => {
  for (const slot of [undefined, 0, -1, 1.5]) {
    const graph = await load('flutter');
    if (slot === undefined) delete graph.kernels[1].samplers[1].slot;
    else graph.kernels[1].samplers[1].slot = slot;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-sampler-slot'));
  }
  const graph = await load('studio');
  assert.equal(inspectGraph(graph).valid, true, 'named bindings do not invent numeric slots');
});

test('a graph must produce exactly one presentation target', async () => {
  const graph = await load('studio');
  graph.passes.pop();
  graph.limits.passes = 3;
  assert(inspectGraph(graph).errors.some((e) => e.code === 'missing-presentation-writer'));
  const duplicate = await load('studio');
  duplicate.passes.push({ ...structuredClone(duplicate.passes[3]), id: 'second-presentation' });
  duplicate.limits.passes = 5;
  assert(inspectGraph(duplicate).errors.some((e) => e.code === 'multiple-writers'));
});

test('source compatibility rejects unknown or absent kinds even when equal', () => {
  for (const source of [undefined, null, '', 'typo-source'])
    assert.deepEqual(sourceCompatibility(source, source), {
      compatible: false,
      reason: 'unknown-source-kind',
    });
  assert.equal(sourceCompatibility('video-frame', 'video-frame').compatible, true);
});

test('immutable provenance includes repository and exact relative path', async () => {
  for (const mutate of [
    (k) => delete k.upstream.repo,
    (k) => delete k.upstream.path,
    (k) => (k.upstream.repo = 'owner'),
    (k) => (k.upstream.path = ''),
    (k) => (k.upstream.path = '../shader.wgsl'),
  ]) {
    const graph = await load('studio');
    mutate(graph.kernels[0]);
    assert(inspectGraph(graph).errors.some((e) => e.code === 'unpinned-kernel'));
  }
});

test('precondition modes cannot silently disable exclusions or host requirements', async () => {
  for (const mode of [undefined, 'exclued', '']) {
    const graph = await load('flutter');
    if (mode === undefined) delete graph.featurePreconditions[0].mode;
    else graph.featurePreconditions[0].mode = mode;
    graph.uniformBlocks[1].fields.find((f) => f.name === 'uFrost').binding = {
      kind: 'frame-value',
      id: 'uFrost',
    };
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-feature-precondition-mode'));
  }
  const host = await load('flutter');
  host.featurePreconditions[1].requiredHostSamplers.uBackgroundTexture = 1;
  assert(inspectGraph(host).errors.some((e) => e.code === 'missing-host-sampler'));
});

test('graph member identifiers cannot be empty even when references agree', async () => {
  for (const id of ['', '   ']) {
    const graph = await load('studio');
    graph.kernels[0].id = id;
    graph.passes[0].kernel = id;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'duplicate-or-invalid-id'));
  }
});

test('binding names are unique across texture and data inputs of a kernel', async () => {
  const graph = await load('studio');
  graph.kernels[3].samplers[1].name = 'u_bg';
  delete graph.passes[3].bindings.u_blurredBg;
  assert(inspectGraph(graph).errors.some((e) => e.code === 'duplicate-binding-name'));
  const mixed = await load('studio');
  mixed.kernels[1].dataBindings[0].name = 'u_prevPassTexture';
  assert(inspectGraph(mixed).errors.some((e) => e.code === 'duplicate-binding-name'));
});

test('frame inputs declare every extent, coordinate and uniform value dependency', async () => {
  const missing = await load('flutter');
  delete missing.frameInputs;
  assert.equal(inspectGraph(missing).valid, false);
  const original = await load('flutter');
  for (const id of ['matte-dpr', 'geometry-pixel-budget', 'matte-transform', 'uShapeData']) {
    const graph = structuredClone(original);
    graph.frameInputs = graph.frameInputs.filter((input) => input.id !== id);
    assert(
      inspectGraph(graph).errors.some((e) => e.code === 'missing-frame-input'),
      id
    );
  }
});

test('the pinned host size uniform retains its reserved reflected float slots', async () => {
  for (const slots of [undefined, [2, 3], [0], [0, 0]]) {
    const graph = await load('flutter');
    const binding = graph.uniformBlocks[1].fields.find((f) => f.name === 'uSize').binding;
    if (slots === undefined) delete binding.floatSlots;
    else binding.floatSlots = slots;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'host-uniform-slot-contract'));
  }
});

test('declared shape count and stride fit the pinned bounded float array', async () => {
  for (const [key, value] of [
    ['maxShapes', undefined],
    ['shapeStrideFloats', undefined],
    ['maxShapes', 100],
    ['shapeStrideFloats', 0],
    ['maxShapes', 1.5],
  ]) {
    const graph = await load('flutter');
    if (value === undefined) delete graph.limits[key];
    else graph.limits[key] = value;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'shape-capacity-mismatch'));
  }
});

test('unknown license labels cannot erase unresolved provenance diagnostics', async () => {
  const graph = await load('studio');
  graph.kernels[0].license = 'blockd-IQ-transitive-provenance';
  assert(inspectGraph(graph).errors.some((e) => e.code === 'unknown-license-gate'));
});

test('target requirements remain nonempty, unique declared capability names', async () => {
  for (const requirements of [undefined, [], [''], ['   '], ['one', 'one'], [42]]) {
    const graph = await load('flutter');
    if (requirements === undefined) delete graph.requirements;
    else graph.requirements = requirements;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-capability-requirements'));
  }
});

test('every reflected uniform has a recognized typed value binding', async () => {
  for (const binding of [
    undefined,
    {},
    { kind: 'frame-vlaue', id: 'uGlassColor' },
    { kind: 'constant', value: [1] },
    { kind: 'constant', value: ['red', 1, 1, 1] },
  ]) {
    const graph = await load('flutter');
    const field = graph.uniformBlocks[1].fields.find((f) => f.name === 'uGlassColor');
    if (binding === undefined) delete field.binding;
    else field.binding = binding;
    assert(
      inspectGraph(graph).errors.some((e) =>
        ['missing-reflected-value-binding', 'invalid-constant-uniform'].includes(e.code)
      )
    );
  }
});

test('pass invalidation retains a recognized policy and declared dependencies', async () => {
  for (const update of [
    undefined,
    'upstrem-dirty',
    {},
    { kind: 'any-dirty', dependencies: [] },
    { kind: 'any-dirty', dependencies: ['source:missing'] },
    { kind: 'any-dirty', dependencies: ['uniform:missing'] },
    { kind: 'any-dirty', dependencies: ['geomtry'] },
  ]) {
    const graph = await load('studio');
    if (update === undefined) delete graph.passes[1].update;
    else graph.passes[1].update = update;
    assert(
      inspectGraph(graph).errors.some((e) =>
        ['invalid-pass-update', 'invalid-update-dependency'].includes(e.code)
      )
    );
  }
});

test('resource contract values have usable types, including unresolved alpha and extent', async () => {
  for (const [field, value] of [
    ['format', 7],
    ['space', {}],
    ['alpha', true],
    ['alpha', { status: 'unresolved' }],
    ['clear', []],
    ['extent', 4],
    ['extent', {}],
    ['extent', { basis: 'viewport', scale: [1, -1] }],
  ]) {
    const graph = await load('studio');
    graph.resources[0][field] = value;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'incomplete-resource-contract'));
  }
});

test('read-only data target mappings cannot disappear or become writable', async () => {
  for (const bindings of [
    undefined,
    {},
    {
      webgpu: 'read-write-storage-buffer',
      webgl2: 'uniform-array',
      flutter: 'requires-specialization-or-unavailable',
    },
  ]) {
    const graph = await load('studio');
    if (bindings === undefined) delete graph.data[0].targetBindings;
    else graph.data[0].targetBindings = bindings;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-data-access-mode'));
  }
});

test('blur radius fits the declared read-only weight capacity', async () => {
  for (const radius of [undefined, 0, -1, 1.5, 201, 10000]) {
    const graph = await load('studio');
    if (radius === undefined) delete graph.limits.blurRadius;
    else graph.limits.blurRadius = radius;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'blur-capacity-mismatch'));
  }
});

test('a pass cannot substitute another kernel invalidation policy or drop a dependency', async () => {
  const graph = await load('studio');
  graph.passes[0].update = 'frame-bindings-dirty';
  assert(inspectGraph(graph).errors.some((e) => e.code === 'kernel-invalidation-mismatch'));
  const dep = await load('studio');
  dep.passes[0].update.dependencies = ['source:media', 'uniform:main'];
  assert(inspectGraph(dep).errors.some((e) => e.code === 'kernel-invalidation-mismatch'));
});

test('pass binding keys exactly follow their declared kernel interface', async () => {
  const graph = await load('studio');
  graph.passes[0].bindings.notInKernel = 'media';
  assert(inspectGraph(graph).errors.some((e) => e.code === 'unknown-pass-binding'));
  const omitted = await load('studio');
  omitted.kernels[0].samplers = [];
  assert(inspectGraph(omitted).errors.some((e) => e.code === 'unknown-pass-binding'));
});

test('floating constants stay finite at target f32 precision', async () => {
  for (const value of [1e300, -1e300]) {
    const graph = await load('flutter');
    graph.uniformBlocks[1].fields.find((f) => f.name === 'uGlassColor').binding = {
      kind: 'constant',
      value: [value, 0, 0, 1],
    };
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-constant-uniform'));
  }
});

test('referenced uniform layouts cannot be empty', async () => {
  const graph = await load('studio');
  graph.uniformBlocks[0].fields = [];
  assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-uniform-fields'));
});

test('host-image-filter presentation retains its premultiplied blend contract', async () => {
  for (const blend of [undefined, {}, 'additive']) {
    const graph = await load('flutter');
    if (blend === undefined) delete graph.passes[1].blend;
    else graph.passes[1].blend = blend;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-host-blend'));
  }
});

test('physical intermediate usages cover every sampling and render edge', async () => {
  for (const usages of [undefined, ['render-attachment'], ['texture-binding']]) {
    const graph = await load('studio');
    if (usages === undefined) delete graph.resources[0].usages;
    else graph.resources[0].usages = usages;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'resource-usage-mismatch'));
  }
});

test('fragment passes require a recognized draw domain', async () => {
  const graph = await load('studio');
  graph.passes.forEach((pass) => delete pass.drawDomain);
  assert(inspectGraph(graph).errors.some((e) => e.code === 'missing-draw-domain'));
});

test('application samplers require a resource kind before checking the bound input', async () => {
  const graph = await load('flutter');
  delete graph.kernels[1].samplers[1].resourceKind;
  graph.passes[1].bindings.uGeometryTexture = 'backdrop';
  assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-sampler-contract'));
});

test('unmodeled copy and composite contracts are rejected instead of guessed', async () => {
  for (const kind of ['copy', 'composite']) {
    const graph = await load('studio');
    graph.passes[3].kind = kind;
    delete graph.passes[3].kernel;
    graph.passes[3].bindings = {};
    assert(inspectGraph(graph).errors.some((e) => e.code === 'unknown-pass-kind'));
  }
});

test('pinned shader entry points require an identifier, not blank or malformed text', async () => {
  for (const entryPoint of ['   ', 'fs main', '1main', 'main()']) {
    const graph = await load('studio');
    graph.kernels[0].entryPoint = entryPoint;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'incomplete-kernel-contract'));
  }
});

test('f32 data allocation bounds agree with the declared element count', async () => {
  for (const mutate of [
    (d) => delete d.abi,
    (d) => (d.abi.maxLogicalBytes = 4),
    (d) => (d.maxCount = 4096),
    (d) => (d.abi.minimumBytes = 0),
  ]) {
    const graph = await load('studio');
    mutate(graph.data[0]);
    assert(inspectGraph(graph).errors.some((e) => e.code === 'data-abi-byte-bounds'));
  }
});

test('sampled intermediates require the modeled filter and wrap contracts', async () => {
  for (const field of ['filter', 'wrap']) {
    for (const value of [undefined, null, 7, {}, 'invented-sampling']) {
      const graph = await load('studio');
      if (value === undefined) delete graph.resources[0][field];
      else graph.resources[0][field] = value;
      assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-texture-sampling'));
    }
  }
  const flutter = await load('flutter');
  delete flutter.resources[0].filter;
  assert(inspectGraph(flutter).errors.some((e) => e.code === 'invalid-texture-sampling'));
});

test('matching typos do not invent application texture resource kinds', async () => {
  for (const kind of ['dtaa-texture', 'host-compositor-backdrop', {}, null]) {
    const graph = await load('flutter');
    graph.resources[0].kind = kind;
    graph.kernels[1].samplers[1].resourceKind = kind;
    assert.equal(inspectGraph(graph).valid, false);
  }
  const graph = await load('flutter');
  graph.resources[0].kind = 'dtaa-texture';
  assert(inspectGraph(graph).errors.some((e) => e.code === 'unknown-resource-kind'));
});

test('live coordinates structurally require screen DPR independently of matte DPR', async () => {
  const missing = await load('flutter');
  missing.frameInputs = missing.frameInputs.filter((f) => f.id !== 'screen-device-pixel-ratio');
  assert.equal(inspectGraph(missing).valid, false);
  const disconnected = await load('flutter');
  delete disconnected.coordinateMapping.bindings;
  assert(inspectGraph(disconnected).errors.some((e) => e.code === 'invalid-coordinate-mapping'));
  const wrongSpace = await load('flutter');
  wrongSpace.frameInputs.find((f) => f.id === 'matte-transform').to = 'screen-physical-pixels';
  assert(inspectGraph(wrongSpace).errors.some((e) => e.code === 'coordinate-input-mismatch'));
  for (const mutate of [
    (g) => delete g.coordinateMapping,
    (g) => (g.coordinateMapping.bindings.screenDpr = 'matte-dpr'),
    (g) => (g.coordinateMapping.resource = 'missing'),
    (g) => (g.resources[0].coordinateBindings = ['geometry-local-bounds', 'matte-transform']),
  ]) {
    const graph = await load('flutter');
    mutate(graph);
    assert.equal(inspectGraph(graph).valid, false);
  }
});

test('kernel target profiles bind the pass kind and uniform ABI together', async () => {
  const host = await load('studio');
  host.passes[3].kind = 'host-image-filter';
  host.passes[3].blend = 'premultiplied-source-over';
  assert(inspectGraph(host).errors.some((e) => e.code === 'kernel-pass-profile-mismatch'));
  const fragment = await load('flutter');
  fragment.passes[1].kind = 'fragment';
  fragment.passes[1].drawDomain = 'geometry-matte-bounds';
  assert(inspectGraph(fragment).errors.some((e) => e.code === 'kernel-pass-profile-mismatch'));
  const abi = await load('studio');
  abi.kernels[0].targetProfile = 'flutter-fragment';
  assert(inspectGraph(abi).errors.some((e) => e.code === 'kernel-target-abi-mismatch'));
  for (const profile of [undefined, 'unmodeled-target', null, {}]) {
    const graph = await load('studio');
    if (profile === undefined) delete graph.kernels[0].targetProfile;
    else graph.kernels[0].targetProfile = profile;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'unknown-kernel-target-profile'));
  }
});

test('all reflected uniforms retain exact ordered float-slot ranges', async () => {
  const swapped = await load('flutter');
  const fields = swapped.uniformBlocks[1].fields;
  [fields[1], fields[2]] = [fields[2], fields[1]];
  assert(inspectGraph(swapped).errors.some((e) => e.code === 'reflected-slot-range'));
  for (const range of [undefined, null, {}, { start: 2, count: 1 }, { start: 0, count: 2 }]) {
    const graph = await load('flutter');
    if (range === undefined) delete graph.uniformBlocks[1].fields[1].floatSlotRange;
    else graph.uniformBlocks[1].fields[1].floatSlotRange = range;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'reflected-slot-range'));
  }
  const count = await load('flutter');
  count.uniformBlocks[0].floatSlotCount = 115;
  assert(inspectGraph(count).errors.some((e) => e.code === 'reflected-slot-count'));
  const original = await load('flutter');
  for (const [blockIndex, block] of original.uniformBlocks.entries())
    for (const [fieldIndex] of block.fields.entries()) {
      const graph = structuredClone(original);
      delete graph.uniformBlocks[blockIndex].fields[fieldIndex].floatSlotRange;
      assert(inspectGraph(graph).errors.some((e) => e.code === 'reflected-slot-range'));
    }
  assert.deepEqual(
    original.uniformBlocks.map((b) => b.floatSlotCount),
    [121, 45]
  );
  assert.deepEqual(original.uniformBlocks[0].fields[4].floatSlotRange, { start: 120, count: 1 });
  for (const count of [null, {}, { toString: null }, '2', Infinity]) {
    const graph = structuredClone(original);
    graph.uniformBlocks[0].fields[3].count = count;
    assert.equal(inspectGraph(graph).valid, false);
  }
});

test('pinned sampler identities preserve sharp and blurred inputs at the same resource kind', async () => {
  for (const bindings of [
    { u_bg: 'background', u_blurredBg: 'background' },
    { u_bg: 'blurred', u_blurredBg: 'background' },
    { u_bg: 'blurred', u_blurredBg: 'blurred' },
  ]) {
    const graph = await load('studio');
    graph.passes[3].bindings = bindings;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'sampler-resource-identity'));
  }
  const missing = await load('studio');
  delete missing.kernels[3].samplers[1].resource;
  assert(inspectGraph(missing).errors.some((e) => e.code === 'invalid-sampler-contract'));
  const unknown = await load('studio');
  unknown.kernels[3].samplers[1].resource = 'missing';
  assert(inspectGraph(unknown).errors.some((e) => e.code === 'sampler-resource-identity'));
});

test('application source alternatives are recognized, explicit and used for compatibility', async () => {
  const reconstructed = await load('studio');
  reconstructed.sources[0].sourceKinds = ['owned-image', 'reconstructed-scene'];
  assert(inspectGraph(reconstructed).errors.some((e) => e.code === 'invalid-source-alternatives'));
  const application = (sourceKinds) => ({ kind: 'application-texture', sourceKinds });
  const image = application(['owned-image']);
  const video = application(['owned-video-frame']);
  const both = application(['owned-image', 'owned-video-frame']);
  assert.equal(sourceCompatibility(both, image).compatible, true);
  assert.equal(sourceCompatibility(both, video).compatible, true);
  assert.equal(sourceCompatibility(image, video).compatible, false);
  assert.equal(sourceCompatibility(image, both).compatible, false);
  assert.equal(sourceCompatibility('application-texture', 'application-texture').compatible, false);
  for (const alternatives of [
    undefined,
    [],
    ['owned-image', 'owned-image'],
    ['owned-vdieo-frame'],
    ['reconstructed-scene'],
    [null],
    {},
  ]) {
    const graph = await load('studio');
    if (alternatives === undefined) delete graph.sources[0].sourceKinds;
    else graph.sources[0].sourceKinds = alternatives;
    assert(inspectGraph(graph).errors.some((e) => e.code === 'invalid-source-alternatives'));
    assert.equal(sourceCompatibility(both, application(alternatives)).compatible, false);
    assert.equal(sourceCompatibility(application(alternatives), both).compatible, false);
  }
  assert.equal(sourceCompatibility(both, application(new Array(1))).compatible, false);
  assert.equal(sourceCompatibility(image, 'reconstructed-scene').compatible, false);
  assert.equal(sourceCompatibility('video-frame', video).compatible, false);
  const invalidRequirement = await load('studio');
  delete invalidRequirement.kernels[0].samplers[0].sourceKinds;
  assert(
    inspectGraph(invalidRequirement).errors.some(
      (e) => e.code === 'invalid-sampler-source-alternatives'
    )
  );
  const misplaced = await load('flutter');
  misplaced.sources[0].sourceKinds = ['owned-image'];
  assert(inspectGraph(misplaced).errors.some((e) => e.code === 'invalid-source-alternatives'));
  const mismatch = await load('studio');
  mismatch.kernels[0].samplers[0].sourceKinds = ['owned-image'];
  mismatch.sources[0].sourceKinds = ['owned-video-frame'];
  assert(inspectGraph(mismatch).errors.some((e) => e.code === 'sampler-source-alternatives'));
});

test('host-injected uniform fields require an ImageFilter consumer', async () => {
  const graph = await load('flutter');
  graph.uniformBlocks.find((block) => block.id === 'geometry').fields[0].binding = {
    kind: 'host-injected',
    id: 'ImageFilter.shader.inputSize',
    floatSlots: [0, 1],
  };
  assert(inspectGraph(graph).errors.some((error) => error.code === 'host-uniform-target'));
});

test('indexed sampler declarations preserve their reflected source order', async () => {
  for (const slot of [2, 99]) {
    const graph = await load('flutter');
    graph.kernels.find((kernel) => kernel.id === 'render').samplers[1].slot = slot;
    assert(inspectGraph(graph).errors.some((error) => error.code === 'reflected-sampler-slot'));
  }
  const reordered = await load('flutter');
  reordered.kernels.find((kernel) => kernel.id === 'render').samplers.reverse();
  assert(inspectGraph(reordered).errors.some((error) => error.code === 'reflected-sampler-slot'));
});

test('pinned packed fields cannot exchange same-sized source offsets', async () => {
  const graph = await load('studio');
  const fields = graph.uniformBlocks[0].fields;
  const width = fields.find((field) => field.name === 'u_shapeWidth');
  const height = fields.find((field) => field.name === 'u_shapeHeight');
  [width.offset, height.offset] = [height.offset, width.offset];
  assert.equal(inspectGraph(graph).valid, false);
});

test('a scenario cannot replace a pinned physical intermediate contract with another profile', async () => {
  const graph = await load('studio');
  Object.assign(graph.resources[0], {
    format: 'host-managed-ui-image',
    filter: 'Flutter-FilterQuality.medium',
    wrap: 'shader-clamp-0-1',
  });
  assert.equal(inspectGraph(graph).valid, false);
});

test('same-typed frame producers cannot replace the pinned uniform semantic binding', async () => {
  for (const replacement of ['uTouchPosition', 'uGeometrySize']) {
    const graph = await load('flutter');
    graph.uniformBlocks[1].fields.find((field) => field.name === 'uGeometryOffset').binding.id =
      replacement;
    assert.equal(inspectGraph(graph).valid, false);
  }
  const swapped = await load('flutter');
  const offset = swapped.uniformBlocks[1].fields.find((field) => field.name === 'uGeometryOffset');
  const size = swapped.uniformBlocks[1].fields.find((field) => field.name === 'uGeometrySize');
  [offset.binding, size.binding] = [size.binding, offset.binding];
  assert.equal(inspectGraph(swapped).valid, false);
});

test('mutating both source and sampler claims cannot redefine the pinned live input', async () => {
  const graph = await load('flutter');
  graph.sources[0].kind = 'reconstructed-scene';
  graph.kernels[1].samplers[0].sourceKind = 'reconstructed-scene';
  assert.equal(inspectGraph(graph).valid, false);
});

test('interface facts are immutable and cannot be supplied or replaced by a scenario', async () => {
  const { getInterfaceFacts } = await import('./interface-facts.mjs');
  const graph = await load('studio');
  const facts = getInterfaceFacts(graph.interfaceId);
  assert(Object.isFrozen(facts));
  assert(Object.isFrozen(facts.assertions.uniformBlocks[0].fields[0]));
  assert.throws(() => {
    facts.assertions.uniformBlocks[0].fields[0].offset = 999;
  }, TypeError);
  const forged = structuredClone(facts);
  graph.resources[0].format = 'host-managed-ui-image';
  graph.resources[0].filter = 'Flutter-FilterQuality.medium';
  graph.resources[0].wrap = 'shader-clamp-0-1';
  Object.assign(forged.assertions.resources[0], graph.resources[0]);
  graph.interfaceFacts = forged;
  assert.equal(inspectGraph(graph, forged).valid, false);
  assert.equal(getInterfaceFacts(graph.interfaceId).assertions.resources[0].format, 'rgba16float');
});

test('interface selection binds every kernel to its exact repository commit path and blob', async () => {
  for (const key of ['repo', 'commit', 'path', 'gitBlob']) {
    const graph = await load('studio');
    graph.kernels[0].upstream[key] =
      key === 'repo' ? 'other/project' : key === 'path' ? 'other.wgsl' : 'a'.repeat(40);
    assert.equal(inspectGraph(graph).valid, false);
  }
  const unknown = await load('studio');
  unknown.interfaceId = 'caller-provided';
  assert.equal(inspectGraph(unknown).valid, false);
  const crossProfile = await load('studio');
  crossProfile.interfaceId = (await load('flutter')).interfaceId;
  assert.equal(inspectGraph(crossProfile).valid, false);
});

test('equivalent serialized scenarios select the same independent source facts', async () => {
  const { getInterfaceFacts } = await import('./interface-facts.mjs');
  for (const name of ['studio', 'flutter']) {
    const graph = await load(name);
    const equivalent = JSON.parse(JSON.stringify(graph));
    assert.equal(inspectGraph(equivalent).valid, true);
    assert.equal(inspectGraph(equivalent).execution, 'not-admitted');
    assert.notEqual(
      getInterfaceFacts(graph.interfaceId).assertions.kernels[0],
      equivalent.kernels[0]
    );
  }
  const imageOnly = await load('studio');
  imageOnly.sources[0].sourceKinds = ['owned-image'];
  assert.equal(inspectGraph(imageOnly).valid, true);
});

test('the pinned budgeted matte retains its budget binding and producer contract', async () => {
  const missing = await load('flutter');
  delete missing.resources[0].extent.pixelBudgetBinding;
  assert.equal(inspectGraph(missing).valid, false);
  const renamed = await load('flutter');
  renamed.resources[0].extent.pixelBudgetBinding = 'matte-dpr';
  assert.equal(inspectGraph(renamed).valid, false);
  const wrongType = await load('flutter');
  wrongType.frameInputs.find((input) => input.id === 'geometry-pixel-budget').type = 'f32';
  assert.equal(inspectGraph(wrongType).valid, false);
});

test('same-named optical uniforms keep distinct geometry and render producers', async () => {
  const graph = await load('flutter');
  const optical = graph.uniformBlocks.map((block) =>
    block.fields.find((field) => field.name === 'uOpticalProps')
  );
  assert.deepEqual(
    optical.map((field) => field.binding.id),
    ['geometry.uOpticalProps', 'render.uOpticalProps']
  );
  assert.equal(inspectGraph(graph).valid, true);
  const crossed = structuredClone(graph);
  crossed.uniformBlocks[1].fields.find((field) => field.name === 'uOpticalProps').binding.id =
    'geometry.uOpticalProps';
  assert.equal(inspectGraph(crossed).valid, false);
  const merged = structuredClone(graph);
  for (const block of merged.uniformBlocks)
    block.fields.find((field) => field.name === 'uOpticalProps').binding.id = 'uOpticalProps';
  merged.frameInputs = merged.frameInputs.filter(
    (input) => !['geometry.uOpticalProps', 'render.uOpticalProps'].includes(input.id)
  );
  merged.frameInputs.push({
    id: 'uOpticalProps',
    type: 'vec4<f32>',
    owner: 'application-frame-state',
  });
  assert.equal(inspectGraph(merged).valid, false);
});

test('the pinned Flutter recipe cannot omit its feature and host prerequisites', async () => {
  const absent = await load('flutter');
  delete absent.featurePreconditions;
  assert.equal(inspectGraph(absent).valid, false);
  const empty = await load('flutter');
  empty.featurePreconditions = [];
  assert.equal(inspectGraph(empty).valid, false);
  for (let i = 0; i < 3; i++) {
    const graph = await load('flutter');
    graph.featurePreconditions.splice(i, 1);
    assert.equal(inspectGraph(graph).valid, false);
  }
  const weakened = await load('flutter');
  weakened.featurePreconditions[1].mode = 'excluded';
  assert.equal(inspectGraph(weakened).valid, false);
});

test('jointly blanking a sampler declaration and its binding cannot match a pinned interface', async () => {
  const graph = await load('studio');
  const kernel = graph.kernels.find((entry) => entry.id === 'bg');
  kernel.samplers[0].name = '   ';
  const pass = graph.passes.find((entry) => entry.kernel === 'bg');
  pass.bindings['   '] = pass.bindings.u_bgTexture;
  delete pass.bindings.u_bgTexture;
  assert.equal(inspectGraph(graph).valid, false);
});

test('the fixed shape recipe pins count and record stride independently', async () => {
  const graph = await load('flutter');
  Object.assign(graph.limits, { maxShapes: 14, shapeStrideFloats: 8 });
  assert.equal(inspectGraph(graph).valid, false);
});

test('a coherent replacement pass cannot bypass the selected recipe kernel', async () => {
  const graph = await load('flutter');
  graph.passes[1] = {
    ...structuredClone(graph.passes[0]),
    id: 'render-pass',
    writes: 'presentation',
  };
  assert.equal(inspectGraph(graph).valid, false);
});

test('geometry channels retain the complete pinned normal height and coverage encoding', async () => {
  for (const encoding of [undefined, {}, { RG: 'height', B: 'normal', A: 'opaque' }]) {
    const graph = await load('flutter');
    if (encoding === undefined) delete graph.resources[0].encoding;
    else graph.resources[0].encoding = encoding;
    assert.equal(inspectGraph(graph).valid, false);
  }
});

test('each recipe pins the draw domain of its fragment passes', async () => {
  for (const [name, index, domain] of [
    ['studio', 3, 'geometry-matte-bounds'],
    ['flutter', 0, 'upstream-fullscreen-quad'],
  ]) {
    const graph = await load(name);
    graph.passes[index].drawDomain = domain;
    assert.equal(inspectGraph(graph).valid, false);
  }
});

test('intermediate extents cannot select an unreviewed allocation recipe', async () => {
  const graph = await load('studio');
  graph.resources[0].extent = { basis: 'one-pixel', scale: [0.01, 0.01] };
  assert.equal(inspectGraph(graph).valid, false);
});

test('target requirements cannot drop capabilities required by the fixed recipe', async () => {
  for (const requirements of [['same-frame-topological-order'], ['typo']]) {
    const graph = await load('studio');
    graph.requirements = requirements;
    assert.equal(inspectGraph(graph).valid, false);
  }
});

test('reserved automatic inputs contain exactly the host uniform and sampler inventory', async () => {
  for (const inventory of [
    undefined,
    ['invented'],
    ['uSize'],
    ['uBackgroundTexture'],
    ['uSize', 'uSize', 'uBackgroundTexture'],
  ]) {
    const graph = await load('flutter');
    if (inventory === undefined) delete graph.uniformBlocks[1].reservedAutoInputs;
    else graph.uniformBlocks[1].reservedAutoInputs = inventory;
    assert.equal(inspectGraph(graph).valid, false);
  }
});

test('unsupported variants and correlated recipe overrides cannot add execution fields', async () => {
  for (const mutate of [
    (g) => {
      g.selectedVariant = 'captured-image';
    },
    (g) => {
      g.execution = 'admitted';
    },
    (g) => {
      g.passes[1].overrideKernel = 'geometry';
    },
    (g) => {
      g.resources[0].extent.unbounded = true;
    },
    (g) => {
      g.variants[0].status = 'admitted';
    },
    (g) => {
      g.kernels[0].invalidation = 'frame-bindings-dirty';
      g.passes[0].update = 'frame-bindings-dirty';
    },
  ]) {
    const graph = await load('flutter');
    mutate(graph);
    assert.equal(inspectGraph(graph).valid, false);
  }
  const extra = await load('studio');
  extra.limits.passes = 8;
  extra.resources.push({ ...structuredClone(extra.resources[0]), id: 'extra-target' });
  extra.passes.push({
    ...structuredClone(extra.passes[0]),
    id: 'extra-pass',
    writes: 'extra-target',
  });
  assert.equal(inspectGraph(extra).valid, false);
  const changedOrder = await load('studio');
  changedOrder.passes[3].dependsOn = ['background-pass'];
  assert.equal(inspectGraph(changedOrder).valid, false);
  const reindexed = await load('flutter');
  reindexed.kernels[1].samplers.reverse();
  reindexed.kernels[1].samplers.forEach((sampler, index) => {
    sampler.slot = index;
  });
  assert.equal(inspectGraph(reindexed).valid, false);
});

test('equivalent named collections and capability sets retain the same fixed recipe', async () => {
  for (const name of ['studio', 'flutter']) {
    const graph = await load(name);
    graph.kernels.reverse();
    graph.passes.reverse();
    graph.uniformBlocks.reverse();
    graph.frameInputs.reverse();
    graph.requirements.reverse();
    for (const pass of graph.passes) {
      pass.reads.reverse();
      pass.dependsOn.reverse();
    }
    graph.purpose = 'Equivalent inspection scenario with unchanged execution contract';
    assert.equal(inspectGraph(graph).valid, true);
  }
  const image = await load('studio');
  image.sources[0].sourceKinds = ['owned-image'];
  assert.equal(inspectGraph(image).valid, true);
});

test('every execution leaf and every object extension is checked by the closed recipe', async (t) => {
  let checked = 0;
  // These are reader explanations, never executable selectors or obligations
  // that a renderer can interpret. Everything else in these fixtures is closed.
  const prose = (path) =>
    path[0] === 'purpose' ||
    path[0] === 'caveats' ||
    path.at(-1) === 'obligation' ||
    (path[0] === 'featurePreconditions' && path.at(-1) === 'reason') ||
    (path[0] === 'coordinateMapping' &&
      ['geometryBounds', 'geometrySize', 'matteRasterDpr', 'source'].includes(path[1]));
  for (const name of ['studio', 'flutter']) {
    const original = await load(name);
    const cases = [];
    function walk(value, path = []) {
      if (value && typeof value === 'object') {
        if (!Array.isArray(value)) cases.push({ path, extend: true });
        for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
      } else if (!prose(path)) cases.push({ path, value });
    }
    walk(original);
    for (const entry of cases) {
      const graph = structuredClone(original);
      let node = graph;
      for (const key of entry.extend ? entry.path : entry.path.slice(0, -1)) node = node[key];
      if (entry.extend) node.unreviewedExecutionField = true;
      else
        node[entry.path.at(-1)] =
          typeof entry.value === 'number'
            ? entry.value + 10000
            : typeof entry.value === 'boolean'
              ? !entry.value
              : `${entry.value}__changed`;
      const result = inspectGraph(graph);
      assert.equal(
        result.valid,
        false,
        `${name}:${entry.path.join('.')}${entry.extend ? ' + field' : ''}`
      );
      assert.equal(result.execution, 'not-admitted');
      checked++;
    }
  }
  assert(checked > 700);
  t.diagnostic(`Checked ${checked} execution-leaf and object-extension mutations.`);
});
