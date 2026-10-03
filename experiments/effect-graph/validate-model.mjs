// Inspection-only data model. It neither loads shader code nor grants execution capability.
export function inspectGraph(graph) {
  const errors = [];
  const error = (code, detail) => errors.push({ code, detail });
  const seen = new WeakSet();
  function plain(value, path = 'graph') {
    if (typeof value === 'number' && !Number.isFinite(value)) error('nonfinite', path);
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
    if (typeof value !== 'object') {
      error('nonserializable', path);
      return;
    }
    if (seen.has(value)) {
      error('object-cycle', path);
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) error('sparse-array', path);
        else plain(value[i], `${path}[${i}]`);
      }
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        error('host-object', path);
      for (const [key, child] of Object.entries(value)) {
        if (['shaderSource', 'nativeHandle', 'gpuDevice', 'canvas', 'callback'].includes(key))
          error('host-escape', `${path}.${key}`);
        plain(child, `${path}.${key}`);
      }
    }
    seen.delete(value);
  }
  plain(graph);
  if (graph?.schemaVersion !== 1) error('schema-version', 'expected inspection schema 1');
  if (
    ![
      graph?.kernels,
      graph?.sources,
      graph?.resources,
      graph?.data,
      graph?.passes,
      graph?.uniformBlocks,
    ].every(Array.isArray)
  )
    return {
      valid: false,
      errors: [...errors, { code: 'missing-arrays' }],
      execution: 'not-admitted',
    };
  const named = (items, label) => {
    const map = new Map();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || map.has(item.id)) {
        error('duplicate-or-invalid-id', label);
        continue;
      }
      map.set(item.id, item);
    }
    return map;
  };
  const kernels = named(graph.kernels, 'kernels'),
    resources = named([...graph.sources, ...graph.resources, ...graph.data], 'resources'),
    passes = named(graph.passes, 'passes'),
    blocks = named(graph.uniformBlocks, 'uniform-blocks');
  const external = new Set([...graph.sources, ...graph.data].map((x) => x.id));
  for (const k of kernels.values()) {
    if (
      !k.upstream ||
      !/^[0-9a-f]{40}$/.test(k.upstream.commit) ||
      !/^[0-9a-f]{40}$/.test(k.upstream.gitBlob)
    )
      error('unpinned-kernel', k.id);
    if (k.execution !== 'not-admitted') error('unsupported-execution-claim', k.id);
    if (k.stage !== 'fragment' || !k.entryPoint || !k.license)
      error('incomplete-kernel-contract', k.id);
    if (!Array.isArray(k.uniformBlocks) || k.uniformBlocks.some((id) => !blocks.has(id)))
      error('missing-kernel-uniform-block', k.id);
  }
  for (const s of graph.sources) {
    if (
      ![
        'application-texture',
        'host-compositor-backdrop',
        'application-owned-captured-texture',
        'reconstructed-scene',
        'video-frame',
      ].includes(s.kind)
    )
      error('unknown-source-kind', s.id);
    if (!s.space || !s.alpha || !s.freshness || !s.format)
      error('incomplete-source-contract', s.id);
  }
  for (const r of graph.resources)
    if (!r.format || !r.extent || !r.space || !r.alpha || !r.clear)
      error('incomplete-resource-contract', r.id);
  for (const d of graph.data)
    if (
      d.type !== 'bounded-array<f32>' ||
      !Number.isInteger(d.maxCount) ||
      d.maxCount < 1 ||
      d.maxCount > 4096
    )
      error('unbounded-data-buffer', d.id);
  const writers = new Map();
  for (const p of passes.values()) {
    if (!['fragment', 'host-image-filter', 'copy', 'composite'].includes(p.kind))
      error('unknown-pass-kind', p.id);
    if (['fragment', 'host-image-filter'].includes(p.kind) && !kernels.has(p.kernel))
      error('missing-kernel', p.id);
    if (p.writes !== 'presentation' && !resources.has(p.writes)) error('unknown-output', p.id);
    if (external.has(p.writes)) error('external-source-write', p.id);
    if (
      !Array.isArray(p.uniformBlocks) ||
      p.uniformBlocks.some((id) => !blocks.has(id)) ||
      (kernels.get(p.kernel)?.uniformBlocks ?? []).some((id) => !p.uniformBlocks?.includes(id))
    )
      error('missing-pass-uniform-block', p.id);
    if (writers.has(p.writes)) error('multiple-writers', p.writes);
    else writers.set(p.writes, p.id);
    if (!Array.isArray(p.reads) || !Array.isArray(p.dependsOn)) {
      error('incomplete-pass', p.id);
      continue;
    }
    if (p.reads.includes(p.writes)) error('current-target-feedback', p.id);
    for (const r of p.reads) if (!resources.has(r)) error('unknown-input', `${p.id}:${r}`);
    for (const d of p.dependsOn) if (!passes.has(d)) error('unknown-dependency', `${p.id}:${d}`);
    for (const r of Object.values(p.bindings ?? {}))
      if (!p.reads.includes(r)) error('undeclared-sampling', `${p.id}:${r}`);
    for (const sampler of kernels.get(p.kernel)?.samplers ?? []) {
      const bound = resources.get(p.bindings?.[sampler.name]);
      if (
        sampler.ownership === 'host-injected' &&
        (bound?.kind !== sampler.sourceKind || bound?.reservedSampler !== sampler.slot)
      )
        error('host-sampler-ownership', `${p.id}:${sampler.name}`);
      if (sampler.resourceKind && bound?.kind !== sampler.resourceKind)
        error('sampler-resource-mismatch', `${p.id}:${sampler.name}`);
    }
  }
  const completed = new Set(),
    active = new Set();
  function visit(id) {
    if (active.has(id)) {
      error('pass-cycle', id);
      return;
    }
    if (completed.has(id) || !passes.has(id)) return;
    active.add(id);
    for (const d of passes.get(id).dependsOn ?? []) visit(d);
    active.delete(id);
    completed.add(id);
  }
  for (const id of passes.keys()) visit(id);
  function depends(id, wanted, seen = new Set()) {
    if (seen.has(id) || !passes.has(id)) return false;
    seen.add(id);
    return (passes.get(id).dependsOn ?? []).some((d) => d === wanted || depends(d, wanted, seen));
  }
  for (const p of passes.values())
    for (const input of p.reads ?? []) {
      const writer = writers.get(input);
      if (!external.has(input) && !writer) error('missing-resource-producer', `${p.id}:${input}`);
      if (writer && writer !== p.id && !depends(p.id, writer))
        error('missing-read-after-write-order', `${p.id}:${input}`);
    }
  for (const block of graph.uniformBlocks) {
    const names = new Set(),
      intervals = [];
    if (block.abi === 'wgsl-uniform-buffer' && (!Number.isInteger(block.bytes) || block.bytes < 1))
      error('missing-block-size', block.id);
    for (const field of block.fields ?? []) {
      if (
        !field.name ||
        names.has(field.name) ||
        !/^(f32|i32|u32|vec[234]f|vec[234]<f32>|mat[234]<f32>)$/.test(field.type)
      )
        error('invalid-uniform', block.id);
      names.add(field.name);
      if (
        field.count !== undefined &&
        (!Number.isInteger(field.count) || field.count < 1 || field.count > 4096)
      )
        error('unbounded-uniform-array', field.name);
      if (field.offset !== undefined) {
        if (
          !Number.isInteger(field.offset) ||
          !Number.isInteger(field.bytes) ||
          field.offset < 0 ||
          field.bytes < 1 ||
          field.offset + field.bytes > block.bytes
        )
          error('uniform-out-of-bounds', field.name);
        for (const [a, b] of intervals)
          if (field.offset < b && field.offset + field.bytes > a)
            error('uniform-overlap', field.name);
        intervals.push([field.offset, field.offset + field.bytes]);
      }
    }
    for (const name of block.reservedAutoInputs ?? []) {
      const uniform = (block.fields ?? []).find((f) => f.name === name);
      if (uniform && uniform.binding?.kind !== 'host-injected')
        error('host-binding-ownership', name);
    }
  }
  for (const condition of graph.featurePreconditions ?? []) {
    if (condition.mode !== 'excluded') continue;
    const requirement = condition.requires;
    const field = blocks
      .get(requirement?.uniformBlock)
      ?.fields?.find((f) => f.name === requirement.field);
    if (
      field?.binding?.kind !== 'constant' ||
      JSON.stringify(field.binding.value) !== JSON.stringify(requirement.value)
    )
      error('disabled-feature-precondition', condition.feature);
  }
  if (
    graph.passes.length > 8 ||
    graph.limits?.historyFrames !== 0 ||
    graph.limits?.storageWrites !== false
  )
    error(
      'unsupported-graph-budget',
      'first inspection model has no temporal or writeable-storage effects'
    );
  return {
    valid: errors.length === 0,
    errors,
    execution: 'not-admitted',
    reasons: [
      'No shader compiled or host source acquired',
      'Target format/ABI/lease/pixel evidence remains required',
      ...graph.kernels
        .filter((k) => k.license.startsWith('blocked'))
        .map((k) => `Unresolved license closure: ${k.id}`),
    ],
  };
}
export function sourceCompatibility(required, provided) {
  return required === provided
    ? { compatible: true }
    : {
        compatible: false,
        reason: 'source-kind-mismatch; no implicit reconstruction or capture substitution',
      };
}
