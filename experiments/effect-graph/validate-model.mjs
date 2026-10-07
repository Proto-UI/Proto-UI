import { inspectInterfaceFacts } from './interface-facts.mjs';

const SOURCE_KINDS = [
  'application-texture',
  'host-compositor-backdrop',
  'application-owned-captured-texture',
  'reconstructed-scene',
  'video-frame',
];
const APPLICATION_SOURCE_ALTERNATIVES = ['owned-image', 'owned-video-frame'];
function validSourceAlternatives(value) {
  if (!Array.isArray(value) || !value.length || new Set(value).size !== value.length) return false;
  for (const kind of value) if (!APPLICATION_SOURCE_ALTERNATIVES.includes(kind)) return false;
  return true;
}
const LICENSE_LABELS = new Set([
  'blocked-IQ-transitive-provenance',
  'MIT-chain-review',
  'MIT-Tim-Lehmann-and-Sebastian-Degenaar-notices-required',
]);
const INTERNAL_TEXTURE_KINDS = ['color-texture', 'data-texture'];
const APPLICATION_TEXTURE_KINDS = [
  ...INTERNAL_TEXTURE_KINDS,
  ...SOURCE_KINDS.filter((kind) => kind !== 'host-compositor-backdrop'),
];
const TARGET_PROFILES = new Map([
  [
    'webgpu-wgsl-fragment',
    { pass: 'fragment', abi: 'wgsl-uniform-buffer', samplers: 'named', extension: '.wgsl' },
  ],
  [
    'flutter-fragment',
    {
      pass: 'fragment',
      abi: 'flutter-reflected-float-slots',
      samplers: 'indexed',
      extension: '.frag',
    },
  ],
  [
    'flutter-impeller-image-filter',
    {
      pass: 'host-image-filter',
      abi: 'flutter-reflected-float-slots',
      samplers: 'indexed',
      extension: '.frag',
    },
  ],
]);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
// Inspection-only data model. It neither loads shader code nor grants execution capability.
export function inspectGraph(graph) {
  const errors = [];
  const error = (code, detail) => errors.push({ code, detail });
  const invalid = () => ({ valid: false, errors, execution: 'not-admitted' });
  const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const strings = (value) => Array.isArray(value) && value.every((x) => typeof x === 'string');
  const records = (value) => Array.isArray(value) && value.every(record);
  const alphaContract = (value) =>
    nonempty(value) ||
    (record(value) && value.status === 'unresolved' && nonempty(value.obligation));
  const extentContract = (value) =>
    record(value) &&
    nonempty(value.basis) &&
    (value.scale === undefined ||
      (Array.isArray(value.scale) &&
        value.scale.length === 2 &&
        value.scale.every((x) => Number.isFinite(x) && x > 0))) &&
    (value.policy === undefined || nonempty(value.policy)) &&
    (value.marginLogicalPixels === undefined ||
      (Number.isFinite(value.marginLogicalPixels) && value.marginLogicalPixels >= 0));
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
  if (!record(graph)) error('invalid-graph-record', 'graph');
  if (graph?.schemaVersion !== 1) error('schema-version', 'expected inspection schema 1');
  if (
    ![
      graph?.kernels,
      graph?.sources,
      graph?.resources,
      graph?.data,
      graph?.passes,
      graph?.uniformBlocks,
      graph?.frameInputs,
    ].every(Array.isArray)
  )
    return {
      valid: false,
      errors: [...errors, { code: 'missing-arrays' }],
      execution: 'not-admitted',
    };
  // Validate the shapes consumed below before walking their members. These are
  // inspection diagnostics for plain data, not a sandbox for arbitrary objects.
  for (const key of [
    'kernels',
    'sources',
    'resources',
    'data',
    'passes',
    'uniformBlocks',
    'frameInputs',
  ])
    if (!records(graph[key])) error('invalid-collection-member', key);
  if (
    !strings(graph.requirements) ||
    !graph.requirements.length ||
    !graph.requirements.every(nonempty) ||
    new Set(graph.requirements).size !== graph.requirements.length
  )
    error('invalid-capability-requirements', 'graph');
  if (errors.length) return invalid();
  for (const kernel of graph.kernels) {
    if (!kernel.invalidation) error('missing-kernel-invalidation', kernel.id);
    if (!strings(kernel.uniformBlocks)) error('missing-kernel-uniform-block', kernel.id);
    if (!['named', 'indexed'].includes(kernel.samplerBinding))
      error('invalid-sampler-binding-mode', kernel.id);
    if (
      !records(kernel.dataBindings) ||
      kernel.dataBindings.some(
        (binding) => !nonempty(binding.name) || binding.type !== 'bounded-array<f32>'
      )
    )
      error('invalid-data-binding-contract', kernel.id);
    const samplerSlots = new Set(),
      bindingNames = new Set();
    for (const binding of records(kernel.dataBindings) ? kernel.dataBindings : []) {
      if (bindingNames.has(binding.name)) error('duplicate-binding-name', kernel.id);
      bindingNames.add(binding.name);
    }
    if (!records(kernel.samplers)) error('invalid-sampler-contract', kernel.id);
    else
      for (const [samplerIndex, sampler] of kernel.samplers.entries()) {
        if (bindingNames.has(sampler.name)) error('duplicate-binding-name', kernel.id);
        bindingNames.add(sampler.name);
        if (kernel.samplerBinding === 'indexed') {
          if (sampler.slot !== samplerIndex)
            error('reflected-sampler-slot', `${kernel.id}:${sampler.name}`);
          if (!Number.isInteger(sampler.slot) || sampler.slot < 0 || samplerSlots.has(sampler.slot))
            error('invalid-sampler-slot', kernel.id);
          samplerSlots.add(sampler.slot);
        } else if (sampler.slot !== undefined) error('unexpected-sampler-slot', kernel.id);
        if (
          typeof sampler.name !== 'string' ||
          !sampler.name ||
          !nonempty(sampler.resource) ||
          !['host-injected', 'application-bound'].includes(sampler.ownership) ||
          (sampler.ownership === 'application-bound' &&
            !APPLICATION_TEXTURE_KINDS.includes(sampler.resourceKind)) ||
          (sampler.ownership === 'host-injected' && !SOURCE_KINDS.includes(sampler.sourceKind))
        )
          error('invalid-sampler-contract', kernel.id);
        if (
          sampler.resourceKind === 'application-texture'
            ? !validSourceAlternatives(sampler.sourceKinds)
            : sampler.sourceKinds !== undefined
        )
          error('invalid-sampler-source-alternatives', kernel.id);
      }
  }
  for (const pass of graph.passes) {
    if (!strings(pass.reads) || !strings(pass.dependsOn)) error('incomplete-pass', pass.id);
    if (!strings(pass.uniformBlocks)) error('missing-pass-uniform-block', pass.id);
    if (!record(pass.bindings) || !Object.values(pass.bindings).every((x) => typeof x === 'string'))
      error('invalid-pass-bindings', pass.id);
  }
  for (const block of graph.uniformBlocks) {
    if (!records(block.fields) || !block.fields.length) error('invalid-uniform-fields', block.id);
    else if (
      block.fields.some((field) => typeof field.name !== 'string' || typeof field.type !== 'string')
    )
      error('invalid-uniform', block.id);
    if (block.reservedAutoInputs !== undefined && !strings(block.reservedAutoInputs))
      error('invalid-reserved-inputs', block.id);
  }
  if (graph.featurePreconditions !== undefined) {
    if (!records(graph.featurePreconditions)) error('invalid-feature-preconditions', 'graph');
    else
      for (const condition of graph.featurePreconditions) {
        if (!['excluded', 'host-required'].includes(condition.mode))
          error('invalid-feature-precondition-mode', condition.feature);
        if (
          condition.mode === 'host-required' &&
          (!strings(condition.requiredHostUniforms) ||
            !record(condition.requiredHostSamplers) ||
            !Object.values(condition.requiredHostSamplers).every(
              (slot) => Number.isInteger(slot) && slot >= 0
            ))
        )
          error('invalid-feature-precondition', condition.feature);
        if (
          condition.mode === 'excluded' &&
          (!record(condition.requires) ||
            typeof condition.requires.uniformBlock !== 'string' ||
            typeof condition.requires.field !== 'string' ||
            !Object.hasOwn(condition.requires, 'value'))
        )
          error('invalid-feature-precondition', condition.feature);
      }
  }
  if (errors.length) return invalid();
  const named = (items, label) => {
    const map = new Map();
    for (const item of items) {
      if (!item || !nonempty(item.id) || map.has(item.id)) {
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
    blocks = named(graph.uniformBlocks, 'uniform-blocks'),
    frameInputs = named(graph.frameInputs, 'frame-inputs');
  for (const input of frameInputs.values()) {
    if (!nonempty(input.type) || !nonempty(input.owner)) error('invalid-frame-input', input.id);
    if (
      input.distinctFrom !== undefined &&
      (!frameInputs.has(input.distinctFrom) || input.distinctFrom === input.id)
    )
      error('missing-frame-input', input.id);
  }
  const external = new Set([...graph.sources, ...graph.data].map((x) => x.id));
  for (const k of kernels.values()) {
    const profile = TARGET_PROFILES.get(k.targetProfile);
    if (!profile) error('unknown-kernel-target-profile', k.id);
    else if (
      k.samplerBinding !== profile.samplers ||
      typeof k.upstream?.path !== 'string' ||
      !k.upstream.path.endsWith(profile.extension) ||
      k.uniformBlocks.some((id) => blocks.get(id)?.abi !== profile.abi)
    )
      error('kernel-target-abi-mismatch', k.id);
    if (
      !k.upstream ||
      typeof k.upstream.repo !== 'string' ||
      !/^[^/\s]+\/[^/\s]+$/.test(k.upstream.repo) ||
      !nonempty(k.upstream.path) ||
      k.upstream.path.startsWith('/') ||
      k.upstream.path.split('/').some((part) => !part || part === '.' || part === '..') ||
      typeof k.upstream.commit !== 'string' ||
      typeof k.upstream.gitBlob !== 'string' ||
      !/^[0-9a-f]{40}$/.test(k.upstream.commit) ||
      !/^[0-9a-f]{40}$/.test(k.upstream.gitBlob)
    )
      error('unpinned-kernel', k.id);
    if (!LICENSE_LABELS.has(k.license)) error('unknown-license-gate', k.id);
    if (k.execution !== 'not-admitted') error('unsupported-execution-claim', k.id);
    if (
      k.stage !== 'fragment' ||
      typeof k.entryPoint !== 'string' ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k.entryPoint) ||
      typeof k.license !== 'string' ||
      !k.license
    )
      error('incomplete-kernel-contract', k.id);
    if (!Array.isArray(k.uniformBlocks) || k.uniformBlocks.some((id) => !blocks.has(id)))
      error('missing-kernel-uniform-block', k.id);
  }
  for (const s of graph.sources) {
    if (!SOURCE_KINDS.includes(s.kind)) error('unknown-source-kind', s.id);
    if (
      s.kind === 'application-texture'
        ? !validSourceAlternatives(s.sourceKinds)
        : s.sourceKinds !== undefined
    )
      error('invalid-source-alternatives', s.id);
    if (
      !nonempty(s.space) ||
      !alphaContract(s.alpha) ||
      !nonempty(s.freshness) ||
      !nonempty(s.format)
    )
      error('incomplete-source-contract', s.id);
  }
  for (const r of graph.resources) {
    if (!INTERNAL_TEXTURE_KINDS.includes(r.kind)) error('unknown-resource-kind', r.id);
    if (graph.passes.some((pass) => pass.reads.includes(r.id))) {
      const hostManaged = r.format === 'host-managed-ui-image';
      if (
        r.filter !== (hostManaged ? 'Flutter-FilterQuality.medium' : 'linear') ||
        r.wrap !== (hostManaged ? 'shader-clamp-0-1' : 'clamp-to-edge')
      )
        error('invalid-texture-sampling', r.id);
    }
    for (const key of ['dprBinding', 'pixelBudgetBinding'])
      if (r.extent?.[key] !== undefined && !frameInputs.has(r.extent[key]))
        error('missing-frame-input', `${r.id}:${key}`);
    if (r.coordinateBindings !== undefined) {
      if (!strings(r.coordinateBindings)) error('invalid-coordinate-bindings', r.id);
      else
        for (const id of r.coordinateBindings)
          if (!frameInputs.has(id)) error('missing-frame-input', `${r.id}:${id}`);
    }
    if (
      !nonempty(r.format) ||
      !extentContract(r.extent) ||
      !nonempty(r.space) ||
      !alphaContract(r.alpha) ||
      !nonempty(r.clear)
    )
      error('incomplete-resource-contract', r.id);
  }
  const requiresLiveCoordinates = graph.kernels.some(
    (kernel) => kernel.targetProfile === 'flutter-impeller-image-filter'
  );
  if (requiresLiveCoordinates || graph.coordinateMapping !== undefined) {
    const mapping = graph.coordinateMapping;
    const roles = {
      bounds: { type: 'rect<f32>', space: 'group-local-logical-pixels' },
      transform: {
        type: 'mat4<f32>',
        from: 'group-local-logical-pixels',
        to: 'screen-logical-pixels',
      },
      screenDpr: { type: 'f32', owner: 'view' },
      passRect: { type: 'rect<f32>', space: 'screen-physical-pixels' },
      matteDpr: { type: 'f32', owner: 'adapter-geometry-budget' },
    };
    if (
      !record(mapping) ||
      mapping.kind !== 'flutter-live-screen-to-pass' ||
      !record(mapping.bindings) ||
      Object.keys(roles).some((role) => !nonempty(mapping.bindings[role]))
    )
      error('invalid-coordinate-mapping', 'graph');
    else {
      for (const [role, contract] of Object.entries(roles)) {
        const input = frameInputs.get(mapping.bindings[role]);
        if (!input || Object.entries(contract).some(([key, value]) => input[key] !== value))
          error('coordinate-input-mismatch', role);
      }
      const binding = mapping.bindings;
      const resource = graph.resources.find((r) => r.id === mapping.resource);
      if (
        binding.screenDpr === binding.matteDpr ||
        frameInputs.get(binding.screenDpr)?.distinctFrom !== binding.matteDpr ||
        !resource ||
        resource.extent?.dprBinding !== binding.matteDpr ||
        !strings(resource.coordinateBindings) ||
        ['bounds', 'transform', 'screenDpr', 'passRect'].some(
          (role) => !resource.coordinateBindings.includes(binding[role])
        )
      )
        error('coordinate-input-mismatch', 'resource');
    }
  }
  for (const d of graph.data) {
    if (
      !record(d.abi) ||
      !Number.isSafeInteger(d.abi.minimumBytes) ||
      d.abi.minimumBytes < 1 ||
      !Number.isSafeInteger(d.abi.maxLogicalBytes) ||
      d.abi.maxLogicalBytes !== d.maxCount * 4
    )
      error('data-abi-byte-bounds', d.id);
    if (
      !record(d.targetBindings) ||
      d.targetBindings.webgpu !== 'read-only-storage-buffer' ||
      d.targetBindings.webgl2 !== 'uniform-array' ||
      d.targetBindings.flutter !== 'requires-specialization-or-unavailable'
    )
      error('invalid-data-access-mode', d.id);
    if (
      d.id === 'blur-weights' &&
      (!Number.isInteger(graph.limits?.blurRadius) ||
        graph.limits.blurRadius < 1 ||
        graph.limits.blurRadius >= d.maxCount)
    )
      error('blur-capacity-mismatch', d.id);
    if (
      d.type !== 'bounded-array<f32>' ||
      !Number.isInteger(d.maxCount) ||
      d.maxCount < 1 ||
      d.maxCount > 4096
    )
      error('unbounded-data-buffer', d.id);
  }
  const writers = new Map();
  for (const p of passes.values()) {
    const profile = TARGET_PROFILES.get(kernels.get(p.kernel)?.targetProfile);
    if (profile && p.kind !== profile.pass) error('kernel-pass-profile-mismatch', p.id);
    if (record(p.update) && p.update.kind === 'any-dirty') {
      if (
        !strings(p.update.dependencies) ||
        !p.update.dependencies.length ||
        new Set(p.update.dependencies).size !== p.update.dependencies.length
      )
        error('invalid-pass-update', p.id);
      else
        for (const dep of p.update.dependencies) {
          const valid = dep.startsWith('source:')
            ? graph.sources.some((source) => source.id === dep.slice(7))
            : dep.startsWith('uniform:')
              ? blocks.has(dep.slice(8))
              : ['geometry', 'derived-morph-state', 'pointer-spring-state'].includes(dep);
          if (!valid) error('invalid-update-dependency', `${p.id}:${dep}`);
        }
    } else if (
      ![
        'upstream-or-blur-parameter-dirty',
        'frame-bindings-dirty',
        'geometry-or-layout-or-optical-profile-dirty',
        'compositor-or-uniform-frame',
      ].includes(p.update)
    )
      error('invalid-pass-update', p.id);
    const requiredUpdate = kernels.get(p.kernel)?.invalidation;
    if (
      requiredUpdate !== undefined &&
      (typeof requiredUpdate === 'string'
        ? p.update !== requiredUpdate
        : !record(requiredUpdate) ||
          requiredUpdate.kind !== 'any-dirty' ||
          !strings(requiredUpdate.dependencies) ||
          !record(p.update) ||
          p.update.kind !== 'any-dirty' ||
          !Array.isArray(p.update.dependencies) ||
          requiredUpdate.dependencies.some(
            (dependency) => !p.update.dependencies.includes(dependency)
          ))
    )
      error('kernel-invalidation-mismatch', p.id);
    if (
      p.kind === 'fragment' &&
      !['upstream-fullscreen-quad', 'geometry-matte-bounds'].includes(p.drawDomain)
    )
      error('missing-draw-domain', p.id);
    if (p.kind === 'host-image-filter' && p.blend !== 'premultiplied-source-over')
      error('invalid-host-blend', p.id);
    const interfaceNames = [
      ...(kernels.get(p.kernel)?.samplers ?? []),
      ...(kernels.get(p.kernel)?.dataBindings ?? []),
    ].map((input) => input.name);
    for (const name of Object.keys(p.bindings))
      if (!interfaceNames.includes(name)) error('unknown-pass-binding', `${p.id}:${name}`);
    for (const id of [...p.reads, p.writes]) {
      const resource = graph.resources.find((resource) => resource.id === id);
      if (resource && resource.format !== 'host-managed-ui-image') {
        if (
          !strings(resource.usages) ||
          !resource.usages.includes(id === p.writes ? 'render-attachment' : 'texture-binding')
        )
          error('resource-usage-mismatch', `${p.id}:${id}`);
      }
    }
    if (!['fragment', 'host-image-filter'].includes(p.kind)) error('unknown-pass-kind', p.id);
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
    for (const binding of kernels.get(p.kernel)?.dataBindings ?? []) {
      const bound = graph.data.find((d) => d.id === p.bindings[binding.name]);
      if (!Object.hasOwn(p.bindings, binding.name))
        error('missing-data-binding', `${p.id}:${binding.name}`);
      else if (!bound || bound.type !== binding.type)
        error('data-binding-mismatch', `${p.id}:${binding.name}`);
    }
    for (const sampler of kernels.get(p.kernel)?.samplers ?? []) {
      if (!Object.hasOwn(p.bindings, sampler.name))
        error('missing-sampler-binding', `${p.id}:${sampler.name}`);
      const bound = resources.get(p.bindings?.[sampler.name]);
      if (!resources.has(sampler.resource) || p.bindings[sampler.name] !== sampler.resource)
        error('sampler-resource-identity', `${p.id}:${sampler.name}`);
      if (
        sampler.resourceKind === 'application-texture' &&
        !sourceCompatibility(
          { kind: sampler.resourceKind, sourceKinds: sampler.sourceKinds },
          bound
        ).compatible
      )
        error('sampler-source-alternatives', `${p.id}:${sampler.name}`);
      if (
        sampler.ownership === 'host-injected' &&
        (bound?.kind !== sampler.sourceKind || bound?.reservedSampler !== sampler.slot)
      )
        error('host-sampler-ownership', `${p.id}:${sampler.name}`);
      if (sampler.resourceKind && bound?.kind !== sampler.resourceKind)
        error('sampler-resource-mismatch', `${p.id}:${sampler.name}`);
    }
  }
  if (!writers.has('presentation')) error('missing-presentation-writer', 'graph');
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
    let floatCursor = 0;
    if (!['wgsl-uniform-buffer', 'flutter-reflected-float-slots'].includes(block.abi))
      error('unknown-uniform-abi', block.id);
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
      if (block.abi === 'flutter-reflected-float-slots') {
        const vector = /^(?:vec([234])f|vec([234])<f32>)$/.exec(field.type);
        const width = field.type === 'f32' ? 1 : vector ? Number(vector[1] ?? vector[2]) : null;
        const count = field.count ?? 1;
        const size =
          width !== null && Number.isSafeInteger(count) && count > 0 ? width * count : null;
        const range = field.floatSlotRange;
        if (
          width === null ||
          !Number.isSafeInteger(count) ||
          count < 1 ||
          !record(range) ||
          !Number.isSafeInteger(range.start) ||
          !Number.isSafeInteger(range.count) ||
          range.start !== floatCursor ||
          range.count !== size
        )
          error('reflected-slot-range', `${block.id}:${field.name}`);
        if (width !== null && Number.isSafeInteger(size) && size > 0) floatCursor += size;
        if (
          !record(field.binding) ||
          !['frame-value', 'host-injected', 'constant'].includes(field.binding.kind)
        )
          error('missing-reflected-value-binding', field.name);
        else if (field.binding.kind === 'constant') {
          const vector = /^(?:vec([234])f|vec([234])<f32>)$/.exec(field.type);
          const width = /^(f32|i32|u32)$/.test(field.type)
            ? 1
            : vector
              ? Number(vector[1] ?? vector[2])
              : null;
          const value = field.binding.value;
          const values = width === 1 && field.count === undefined ? [value] : value;
          if (
            width === null ||
            !Array.isArray(values) ||
            values.length !== width * (field.count ?? 1) ||
            !values.every(
              (v) =>
                typeof v === 'number' &&
                Number.isFinite(v) &&
                Number.isFinite(Math.fround(v)) &&
                (field.type === 'i32'
                  ? Number.isInteger(v) && v >= -2147483648 && v <= 2147483647
                  : field.type === 'u32'
                    ? Number.isInteger(v) && v >= 0 && v <= 4294967295
                    : true)
            )
          )
            error('invalid-constant-uniform', field.name);
        }
      }
      if (field.binding?.kind === 'frame-value') {
        const input = frameInputs.get(field.binding.id);
        if (!input || input.type !== field.type || input.count !== field.count)
          error('missing-frame-input', `${block.id}:${field.name}`);
      }
      if (field.binding?.kind === 'host-injected') {
        const consumers = graph.kernels.filter(
          (kernel) => strings(kernel.uniformBlocks) && kernel.uniformBlocks.includes(block.id)
        );
        if (
          !consumers.length ||
          consumers.some((kernel) => kernel.targetProfile !== 'flutter-impeller-image-filter')
        )
          error('host-uniform-target', field.name);
        if (
          block.abi !== 'flutter-reflected-float-slots' ||
          field.binding.id !== 'ImageFilter.shader.inputSize' ||
          field.type !== 'vec2<f32>' ||
          JSON.stringify(field.binding.floatSlots) !== '[0,1]'
        )
          error('host-uniform-slot-contract', field.name);
      }
      if (block.abi === 'flutter-reflected-float-slots' && field.name === 'uShapeData') {
        const { maxShapes, shapeStrideFloats } = graph.limits ?? {};
        if (
          !Number.isInteger(maxShapes) ||
          maxShapes < 1 ||
          !Number.isInteger(shapeStrideFloats) ||
          shapeStrideFloats < 1 ||
          maxShapes * shapeStrideFloats !== field.count
        )
          error('shape-capacity-mismatch', field.name);
      }
      if (
        field.count !== undefined &&
        (!Number.isInteger(field.count) || field.count < 1 || field.count > 4096)
      )
        error('unbounded-uniform-array', field.name);
      if (
        block.abi === 'wgsl-uniform-buffer' ||
        field.offset !== undefined ||
        field.bytes !== undefined
      ) {
        // The pinned packed ABI currently uses only 32-bit scalars/vectors.
        // Do not guess matrix/array stride or reflection from a declared count.
        // WGSL SizeOf: https://www.w3.org/TR/WGSL/#alignment-and-size
        const vector = /^(?:vec([234])f|vec([234])<f32>)$/.exec(field.type);
        const expectedBytes = /^(f32|i32|u32)$/.test(field.type)
          ? 4
          : vector
            ? 4 * Number(vector[1] ?? vector[2])
            : null;
        if (expectedBytes === null || field.count !== undefined)
          error('unsupported-packed-uniform-type', field.name);
        else if (field.bytes !== expectedBytes) error('uniform-byte-size', field.name);
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
    if (
      block.abi === 'flutter-reflected-float-slots' &&
      (!Number.isSafeInteger(block.floatSlotCount) || block.floatSlotCount !== floatCursor)
    )
      error('reflected-slot-count', block.id);
    for (const name of block.reservedAutoInputs ?? []) {
      const uniform = (block.fields ?? []).find((f) => f.name === name);
      if (uniform && uniform.binding?.kind !== 'host-injected')
        error('host-binding-ownership', name);
    }
    const automaticInputs = [
      ...block.fields
        .filter((field) => field.binding?.kind === 'host-injected')
        .map((field) => field.name),
      ...graph.kernels
        .filter((kernel) => kernel.uniformBlocks.includes(block.id))
        .flatMap((kernel) =>
          kernel.samplers
            .filter((sampler) => sampler.ownership === 'host-injected')
            .map((sampler) => sampler.name)
        ),
    ];
    const inventory = block.reservedAutoInputs ?? [];
    if (new Set(inventory).size !== inventory.length)
      error('invalid-reserved-auto-input', block.id);
    for (const name of inventory)
      if (automaticInputs.filter((input) => input === name).length !== 1)
        error('invalid-reserved-auto-input', `${block.id}:${name}`);
    for (const name of automaticInputs)
      if (!inventory.includes(name)) error('missing-reserved-auto-input', `${block.id}:${name}`);
  }
  for (const condition of graph.featurePreconditions ?? []) {
    if (condition.mode === 'host-required') {
      for (const name of condition.requiredHostUniforms) {
        if (
          !graph.uniformBlocks.some((block) =>
            block.fields.some(
              (field) => field.name === name && field.binding?.kind === 'host-injected'
            )
          )
        )
          error('missing-host-uniform', name);
      }
      for (const [name, slot] of Object.entries(condition.requiredHostSamplers)) {
        if (
          !graph.kernels.some((kernel) =>
            kernel.samplers.some(
              (sampler) =>
                sampler.name === name &&
                sampler.ownership === 'host-injected' &&
                sampler.slot === slot
            )
          )
        )
          error('missing-host-sampler', name);
      }
      continue;
    }
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
    !Number.isInteger(graph.limits?.passes) ||
    graph.limits.passes < 1 ||
    graph.limits.passes > 8 ||
    graph.passes.length > graph.limits.passes ||
    graph.passes.length > 8 ||
    graph.limits?.historyFrames !== 0 ||
    graph.limits?.storageWrites !== false
  )
    error(
      'unsupported-graph-budget',
      'first inspection model has no temporal or writeable-storage effects'
    );
  errors.push(...inspectInterfaceFacts(graph));
  return {
    valid: errors.length === 0,
    errors,
    execution: 'not-admitted',
    reasons: [
      'No shader compiled or host source acquired',
      'Target format/ABI/lease/pixel evidence remains required',
      ...graph.kernels
        .filter((k) => typeof k.license === 'string' && k.license.startsWith('blocked'))
        .map((k) => `Unresolved license closure: ${k.id}`),
    ],
  };
}
export function sourceCompatibility(required, provided) {
  const descriptor = (value) => (typeof value === 'string' ? { kind: value } : value);
  required = descriptor(required);
  provided = descriptor(provided);
  if (!SOURCE_KINDS.includes(required?.kind) || !SOURCE_KINDS.includes(provided?.kind))
    return { compatible: false, reason: 'unknown-source-kind' };
  for (const source of [required, provided])
    if (
      source.kind === 'application-texture'
        ? !validSourceAlternatives(source.sourceKinds)
        : source.sourceKinds !== undefined
    )
      return { compatible: false, reason: 'invalid-source-alternatives' };
  if (required.kind !== provided.kind)
    return {
      compatible: false,
      reason: 'source-kind-mismatch; no implicit reconstruction or capture substitution',
    };
  if (
    required.kind === 'application-texture' &&
    provided.sourceKinds.some((kind) => !required.sourceKinds.includes(kind))
  )
    return { compatible: false, reason: 'source-alternative-mismatch' };
  return { compatible: true };
}
