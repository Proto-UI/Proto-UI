// Reviewed, source-bound interface facts for the two inspection recipes.
// This module never reads scenario JSON or accepts caller-provided fact tables.
// Updating a source revision requires a separate source audit of this registry.
const studioSource = (path, gitBlob) => ({
  repo: 'iyinchao/liquid-glass-studio',
  commit: 'f7b28c36305a862f5cffed3ddd51511cf1204f56',
  path,
  gitBlob,
});
const flutterSource = (path, gitBlob) => ({
  repo: 'sdegenaar/liquid_glass_widgets',
  commit: 'c35d7e115a52e05389dd8d98c6b32d4582931c33',
  path,
  gitBlob,
});

// Source-derived declarations, independently extracted from hash-verified shader blobs.
const STUDIO_MAIN_FIELDS = [
  ['u_resolution', 'vec2f', 0, 8],
  ['u_dpr', 'f32', 8, 4],
  ['_pad0', 'f32', 12, 4],
  ['u_mouse', 'vec2f', 16, 8],
  ['u_mouseSpring', 'vec2f', 24, 8],
  ['u_shapeWidth', 'f32', 32, 4],
  ['u_shapeHeight', 'f32', 36, 4],
  ['u_shapeRadius', 'f32', 40, 4],
  ['u_shapeRoundness', 'f32', 44, 4],
  ['u_mergeRate', 'f32', 48, 4],
  ['u_glareAngle', 'f32', 52, 4],
  ['u_shadowExpand', 'f32', 56, 4],
  ['u_shadowFactor', 'f32', 60, 4],
  ['u_shadowPosition', 'vec2f', 64, 8],
  ['u_bgTextureRatio', 'f32', 72, 4],
  ['u_bgType', 'i32', 76, 4],
  ['u_bgTextureReady', 'i32', 80, 4],
  ['u_showShape1', 'i32', 84, 4],
  ['u_blurRadius', 'i32', 88, 4],
  ['u_blurEdge', 'i32', 92, 4],
  ['u_tint', 'vec4f', 96, 16],
  ['u_refThickness', 'f32', 112, 4],
  ['u_refFactor', 'f32', 116, 4],
  ['u_refDispersion', 'f32', 120, 4],
  ['u_refFresnelRange', 'f32', 124, 4],
  ['u_refFresnelHardness', 'f32', 128, 4],
  ['u_refFresnelFactor', 'f32', 132, 4],
  ['u_glareRange', 'f32', 136, 4],
  ['u_glareHardness', 'f32', 140, 4],
  ['u_glareConvergence', 'f32', 144, 4],
  ['u_glareOppositeFactor', 'f32', 148, 4],
  ['u_glareFactor', 'f32', 152, 4],
  ['u_refDistance', 'f32', 156, 4],
];

const STUDIO_BLUR_FIELDS = [
  ['u_resolution', 'vec2f', 0, 8],
  ['u_blurRadius', 'i32', 8, 4],
  ['_pad', 'i32', 12, 4],
];

const FLUTTER_GEOMETRY_FIELDS = [
  ['uSize', 'vec2<f32>', 0, 2],
  ['uOpticalProps', 'vec4<f32>', 2, 4],
  ['uShapeSettings', 'vec2<f32>', 6, 2],
  ['uShapeData', 'f32', 8, 112, 112],
  ['uNativeEdge', 'f32', 120, 1],
];

const FLUTTER_RENDER_FIELDS = [
  ['uSize', 'vec2<f32>', 0, 2],
  ['uGeometryOffset', 'vec2<f32>', 2, 2],
  ['uGeometrySize', 'vec2<f32>', 4, 2],
  ['uGlassColor', 'vec4<f32>', 6, 4],
  ['uOpticalProps', 'vec4<f32>', 10, 4],
  ['uLightConfig', 'vec3<f32>', 14, 3],
  ['uLightDirection', 'vec2<f32>', 17, 2],
  ['uWhiten', 'f32', 19, 1],
  ['uWhitenGated', 'f32', 20, 1],
  ['uPinchStrength', 'f32', 21, 1],
  ['uBackgroundFallback', 'vec4<f32>', 22, 4],
  ['uCaptureOffset', 'vec2<f32>', 26, 2],
  ['uEdgeConfig', 'vec4<f32>', 28, 4],
  ['uPlatformViewMode', 'f32', 32, 1],
  ['uBodyMode', 'f32', 33, 1],
  ['uTouchPosition', 'vec2<f32>', 34, 2],
  ['uTouchIntensity', 'f32', 36, 1],
  ['uRimConfig', 'vec3<f32>', 37, 3],
  ['uLensModel', 'f32', 40, 1],
  ['uFrost', 'vec4<f32>', 41, 4],
];

function packedBlock(id, bytes, rows) {
  return {
    id,
    abi: 'wgsl-uniform-buffer',
    bytes,
    fields: rows.map(([name, type, offset, bytes]) => ({ name, type, offset, bytes })),
  };
}
function reflectedBlock(id, floatSlotCount, rows) {
  return {
    id,
    abi: 'flutter-reflected-float-slots',
    floatSlotCount,
    fields: rows.map(([name, type, start, size, count]) => ({
      name,
      type,
      ...(count === undefined ? {} : { count }),
      floatSlotRange: { start, count: size },
      // These semantic producer names are the pinned recipe's input roles,
      // not a claim that a runtime provider exists or has executed. Optical
      // props need block-local producers: geometry .w is blend; render .w is
      // refraction scale (the pinned Dart recipe writes 1.0 there).
      binding:
        id === 'render' && name === 'uSize'
          ? { kind: 'host-injected', id: 'ImageFilter.shader.inputSize', floatSlots: [0, 1] }
          : id === 'render' && ['uCaptureOffset', 'uFrost'].includes(name)
            ? { kind: 'constant', value: Array(size).fill(0) }
            : { kind: 'frame-value', id: name === 'uOpticalProps' ? `${id}.${name}` : name },
    })),
  };
}
const texture = (name, resource, resourceKind) => ({
  name,
  ownership: 'application-bound',
  resource,
  resourceKind,
});
const studioKernel = (id, path, blob, block, samplers, dataBindings = []) => ({
  id,
  upstream: studioSource(path, blob),
  license: ['bg', 'main'].includes(id) ? 'blocked-IQ-transitive-provenance' : 'MIT-chain-review',
  execution: 'not-admitted',
  entryPoint: 'fs_main',
  stage: 'fragment',
  targetProfile: 'webgpu-wgsl-fragment',
  samplerBinding: 'named',
  uniformBlocks: [block],
  samplers,
  dataBindings,
});
const flutterKernel = (id, path, blob, profile, samplers) => ({
  id,
  upstream: flutterSource(path, blob),
  license: 'MIT-Tim-Lehmann-and-Sebastian-Degenaar-notices-required',
  execution: 'not-admitted',
  entryPoint: 'main',
  stage: 'fragment',
  targetProfile: profile,
  samplerBinding: 'indexed',
  uniformBlocks: [id],
  samplers,
  dataBindings: [],
});
const flutterBlocks = [
  reflectedBlock('geometry', 121, FLUTTER_GEOMETRY_FIELDS),
  reflectedBlock('render', 45, FLUTTER_RENDER_FIELDS),
];
function flutterFrameInputs() {
  const values = new Map();
  for (const block of flutterBlocks)
    for (const field of block.fields)
      if (field.binding.kind === 'frame-value')
        values.set(field.binding.id, {
          id: field.binding.id,
          type: field.type,
          ...(field.count === undefined ? {} : { count: field.count }),
          owner: 'application-frame-state',
        });
  return [
    {
      id: 'matte-dpr',
      type: 'f32',
      owner: 'adapter-geometry-budget',
      range: 'finite-positive-target-bounded',
    },
    {
      id: 'geometry-pixel-budget',
      type: 'u32',
      owner: 'adapter-resource-budget',
      range: 'finite-positive-target-bounded',
    },
    {
      id: 'geometry-local-bounds',
      type: 'rect<f32>',
      space: 'group-local-logical-pixels',
      owner: 'layout',
    },
    {
      id: 'matte-transform',
      type: 'mat4<f32>',
      from: 'group-local-logical-pixels',
      to: 'screen-logical-pixels',
      owner: 'adapter-layout',
    },
    {
      id: 'enclosing-filter-pass-rect',
      type: 'rect<f32>',
      space: 'screen-physical-pixels',
      owner: 'host-compositor',
    },
    { id: 'screen-device-pixel-ratio', type: 'f32', owner: 'view', distinctFrom: 'matte-dpr' },
    ...values.values(),
  ];
}

// These are the selected inspection recipes, not claims that upstream has only
// one valid pipeline. Changing them requires source evidence and recipe review.
const studioBackgroundUpdate = {
  kind: 'any-dirty',
  dependencies: [
    'source:media',
    'uniform:main',
    'geometry',
    'derived-morph-state',
    'pointer-spring-state',
  ],
};
const unknownColor = { status: 'unresolved' };
const studioUpdates = {
  bg: studioBackgroundUpdate,
  'blur-v': 'upstream-or-blur-parameter-dirty',
  'blur-h': 'upstream-or-blur-parameter-dirty',
  main: 'frame-bindings-dirty',
};
const flutterUpdates = {
  geometry: 'geometry-or-layout-or-optical-profile-dirty',
  render: 'compositor-or-uniform-frame',
};
const studioPass = (id, kernel, reads, writes, dependsOn, bindings, block) => ({
  id,
  kind: 'fragment',
  kernel,
  reads,
  writes,
  dependsOn,
  bindings,
  update: studioUpdates[kernel],
  uniformBlocks: [block],
  drawDomain: 'upstream-fullscreen-quad',
});

const registry = {
  'studio-f7b28c3-four-pass-v1': {
    choices: {
      'graph.sources.media.sourceKinds': { kind: 'nonempty-subset' },
      'graph.limits.passes': { kind: 'integer-range', minimum: 4, maximum: 8 },
    },
    evidenceSources: [
      studioSource('src/App.tsx', 'dd1c0ee0b9377699fd1e212d1b1c06d59cf57042'),
      studioSource('src/utils/GPUUtils.ts', '1effd7c0c4f162ecd2233bb0c3976de33d61698e'),
    ],
    declarationViews: {
      // GPUUtils writes the shared host buffer using the main ABI. Background
      // declares the last, unused f32 as padding; it has the same byte layout.
      backgroundFinalField: { block: 'main', name: '_pad1', offset: 156, bytes: 4, unused: true },
    },
    recipeAssertions: {
      schemaVersion: 1,
      id: 'studio-four-pass-inspection',
      interfaceId: 'studio-f7b28c3-four-pass-v1',
      kernels: Object.entries(studioUpdates).map(([id, invalidation]) => ({ id, invalidation })),
      sources: [
        {
          id: 'media',
          sourceKinds: ['owned-image', 'owned-video-frame'],
          alpha: unknownColor,
          fallback: 'owned-neutral-1px',
          colorSpace: unknownColor,
          orientation: unknownColor,
        },
      ],
      resources: ['background', 'vertical-blur', 'blurred'].map((id) => ({
        id,
        extent: { basis: 'viewport', scale: [1, 1] },
        alpha: unknownColor,
        clear: 'transparent',
        colorSpace: unknownColor,
        orientation: unknownColor,
        observedDepth: {
          webgl2: { format: 'DEPTH_COMPONENT24', usage: 'attached-depth-buffer' },
          webgpu: { format: 'depth24plus', usage: 'allocated-unused-helper-resource' },
        },
      })),
      data: [
        {
          id: 'blur-weights',
          type: 'bounded-array<f32>',
          maxCount: 201,
          targetBindings: {
            webgpu: 'read-only-storage-buffer',
            webgl2: 'uniform-array',
            flutter: 'requires-specialization-or-unavailable',
          },
          abi: { minimumBytes: 16, maxLogicalBytes: 804 },
        },
      ],
      passes: [
        studioPass(
          'background-pass',
          'bg',
          ['media'],
          'background',
          [],
          { u_bgTexture: 'media' },
          'main'
        ),
        studioPass(
          'vertical-blur-pass',
          'blur-v',
          ['background', 'blur-weights'],
          'vertical-blur',
          ['background-pass'],
          { u_prevPassTexture: 'background', u_blurWeights: 'blur-weights' },
          'blur'
        ),
        studioPass(
          'horizontal-blur-pass',
          'blur-h',
          ['vertical-blur', 'blur-weights'],
          'blurred',
          ['vertical-blur-pass'],
          { u_prevPassTexture: 'vertical-blur', u_blurWeights: 'blur-weights' },
          'blur'
        ),
        studioPass(
          'main-pass',
          'main',
          ['background', 'blurred'],
          'presentation',
          ['background-pass', 'horizontal-blur-pass'],
          { u_bg: 'background', u_blurredBg: 'blurred' },
          'main'
        ),
      ],
      requirements: [
        'renderable-filterable-rgba16float',
        'fragment-texture-sampling',
        'bounded-read-only-data-buffer-or-specialized-uniform-array',
        'same-frame-topological-order',
      ],
      limits: { passes: 4, blurRadius: 200, historyFrames: 0, storageWrites: false },
      frameInputs: [],
    },
    assertions: {
      kernels: [
        studioKernel(
          'bg',
          'src/shaders-wgsl/fragment-bg.wgsl',
          'f84212a1aa4e3687fd404218fdd197cce18b2080',
          'main',
          [
            {
              ...texture('u_bgTexture', 'media', 'application-texture'),
              sourceKinds: ['owned-image', 'owned-video-frame'],
            },
          ]
        ),
        studioKernel(
          'blur-v',
          'src/shaders-wgsl/fragment-bg-vblur.wgsl',
          'eabd5091ad5f6166673c01173bad2f2629cadfea',
          'blur',
          [texture('u_prevPassTexture', 'background', 'color-texture')],
          [{ name: 'u_blurWeights', type: 'bounded-array<f32>' }]
        ),
        studioKernel(
          'blur-h',
          'src/shaders-wgsl/fragment-bg-hblur.wgsl',
          'b35758ed6498b3b42d81fd6063b292e6e5a6f603',
          'blur',
          [texture('u_prevPassTexture', 'vertical-blur', 'color-texture')],
          [{ name: 'u_blurWeights', type: 'bounded-array<f32>' }]
        ),
        studioKernel(
          'main',
          'src/shaders-wgsl/fragment-main.wgsl',
          '9063a39f000fcb0fd69848dc4c3e51618f0dc3da',
          'main',
          [
            texture('u_bg', 'background', 'color-texture'),
            texture('u_blurredBg', 'blurred', 'color-texture'),
          ]
        ),
      ],
      uniformBlocks: [
        packedBlock('main', 160, STUDIO_MAIN_FIELDS),
        packedBlock('blur', 16, STUDIO_BLUR_FIELDS),
      ],
      sources: [
        {
          id: 'media',
          kind: 'application-texture',
          format: 'rgba8unorm',
          space: 'normalized-uv',
          freshness: 'provider-frame',
        },
      ],
      resources: ['background', 'vertical-blur', 'blurred'].map((id) => ({
        id,
        kind: 'color-texture',
        format: 'rgba16float',
        filter: 'linear',
        wrap: 'clamp-to-edge',
        space: 'normalized-uv',
        usages: ['render-attachment', 'texture-binding'],
      })),
    },
  },
  'flutter-c35d7e1-live-v1': {
    choices: {
      'graph.limits.passes': { kind: 'integer-range', minimum: 2, maximum: 8 },
    },
    evidenceSources: [
      flutterSource(
        'lib/src/engine/rendering/liquid_glass_render_object.dart',
        'a6e5a7f20e8c717e76f57ad6e0650602ce99235e'
      ),
      flutterSource(
        'lib/src/engine/render_liquid_glass_geometry.dart',
        '1dc6d3e807604bcedcde717d2c1ae18bd8e7f596'
      ),
      flutterSource(
        'lib/src/renderer/fragment_shader_extensions.dart',
        '2c8848abf42f9da668c8c32606e1e6f5b300988d'
      ),
    ],
    recipeAssertions: {
      schemaVersion: 1,
      id: 'flutter-geometry-live-render-inspection',
      interfaceId: 'flutter-c35d7e1-live-v1',
      kernels: Object.entries(flutterUpdates).map(([id, invalidation]) => ({ id, invalidation })),
      sources: [{ id: 'backdrop', colorSpace: unknownColor, orientation: unknownColor }],
      resources: [
        {
          id: 'geometry',
          alpha: 'encoded-SDF-coverage',
          clear: 'kernel-neutral',
          encoding: {
            RG: 'unit-normal-xy mapped -1..1 to 0..1',
            B: 'height normalized by thickness',
            A: 'edge coverage',
          },
          physicalChannelPreservation: 'unverified-provider-obligation',
          coordinateBindings: [
            'geometry-local-bounds',
            'matte-transform',
            'enclosing-filter-pass-rect',
            'screen-device-pixel-ratio',
          ],
          colorSpace: unknownColor,
          orientation: unknownColor,
        },
      ],
      data: [],
      passes: [
        {
          id: 'geometry-pass',
          kind: 'fragment',
          kernel: 'geometry',
          reads: [],
          writes: 'geometry',
          dependsOn: [],
          bindings: {},
          update: flutterUpdates.geometry,
          uniformBlocks: ['geometry'],
          drawDomain: 'geometry-matte-bounds',
        },
        {
          id: 'render-pass',
          kind: 'host-image-filter',
          kernel: 'render',
          reads: ['backdrop', 'geometry'],
          writes: 'presentation',
          dependsOn: ['geometry-pass'],
          bindings: { uBackgroundTexture: 'backdrop', uGeometryTexture: 'geometry' },
          update: flutterUpdates.render,
          blend: 'premultiplied-source-over',
          uniformBlocks: ['render'],
        },
      ],
      uniformBlocks: [{ id: 'render', reservedAutoInputs: ['uSize', 'uBackgroundTexture'] }],
      requirements: [
        'live-compositor-image-filter',
        'fragment-program',
        'geometry-data-channel-preservation',
        'same-frame-source-geometry-coherence',
      ],
      limits: {
        passes: 2,
        maxShapes: 16,
        shapeStrideFloats: 7,
        historyFrames: 0,
        storageWrites: false,
      },
      variants: [
        {
          id: 'captured-image',
          status: 'not-modeled',
          sourceKind: 'application-owned-captured-texture',
          requiredChanges: [
            'replace host-image-filter with direct application fragment draw',
            'manually bind uSize and sampler0 instead of live host injection',
            'provide capture-to-filter transform and explicit frame freshness',
          ],
          qualityChange: 'distinct-from-live-compositor',
        },
      ],
      extensionsNotYetModeled: [
        'optional scoped backdrop blur',
        'frost weight/dstIn/alternate-row compositing',
        'foreground placement stages',
        'morph controller state/velocity producer',
      ],
      coordinateMapping: {
        kind: 'flutter-live-screen-to-pass',
        resource: 'geometry',
        bindings: {
          bounds: 'geometry-local-bounds',
          transform: 'matte-transform',
          screenDpr: 'screen-device-pixel-ratio',
          passRect: 'enclosing-filter-pass-rect',
          matteDpr: 'matte-dpr',
        },
      },
    },
    assertions: {
      kernels: [
        flutterKernel(
          'geometry',
          'shaders/liquid_glass_geometry_blended.frag',
          '3d9457df92f56079d48846613ba3df7ca4c18aa0',
          'flutter-fragment',
          []
        ),
        flutterKernel(
          'render',
          'shaders/liquid_glass_render.frag',
          '03b27d53d670b6642fdbf92783175d5e96c9155d',
          'flutter-impeller-image-filter',
          [
            {
              name: 'uBackgroundTexture',
              ownership: 'host-injected',
              slot: 0,
              sourceKind: 'host-compositor-backdrop',
              resource: 'backdrop',
            },
            { ...texture('uGeometryTexture', 'geometry', 'data-texture'), slot: 1 },
          ]
        ),
      ],
      uniformBlocks: flutterBlocks,
      frameInputs: flutterFrameInputs(),
      // Fixed inspection-recipe exclusions and host prerequisites. These are
      // declared recipe boundaries, not additional upstream shader features.
      featurePreconditions: [
        {
          feature: 'frost-preprocessing',
          mode: 'excluded',
          requires: { uniformBlock: 'render', field: 'uFrost', value: [0, 0, 0, 0] },
        },
        {
          feature: 'live-compositor-input',
          requiredHostUniforms: ['uSize'],
          requiredHostSamplers: { uBackgroundTexture: 0 },
          mode: 'host-required',
        },
        {
          feature: 'captured-background-coordinate-offset',
          mode: 'excluded',
          requires: { uniformBlock: 'render', field: 'uCaptureOffset', value: [0, 0] },
        },
      ],
      sources: [
        {
          id: 'backdrop',
          kind: 'host-compositor-backdrop',
          provider: 'flutter-impeller-ImageFilter.shader',
          format: 'host-managed',
          space: 'filter-local-physical-pixels',
          alpha: 'host-premultiplied',
          freshness: 'compositor-frame',
          reservedSampler: 0,
        },
      ],
      resources: [
        {
          id: 'geometry',
          kind: 'data-texture',
          format: 'host-managed-ui-image',
          filter: 'Flutter-FilterQuality.medium',
          wrap: 'shader-clamp-0-1',
          space: 'geometry-local-pixels',
          extent: {
            basis: 'geometry-local-bounds',
            policy: 'budgeted-matte',
            dprBinding: 'matte-dpr',
            pixelBudgetBinding: 'geometry-pixel-budget',
            marginLogicalPixels: 2,
          },
        },
      ],
    },
  },
};

function collectionKey(entries) {
  return ['id', 'name', 'feature'].find(
    (key) =>
      entries.length &&
      entries.every((entry) => entry && typeof entry === 'object' && typeof entry[key] === 'string')
  );
}

// Combine two independently reviewed constant tables, never scenario input.
// An overlapping source fact and recipe policy must agree; policy cannot replace
// source authority while this module initializes.
function mergeContract(source, recipe) {
  if (source === undefined) return structuredClone(recipe);
  if (recipe === undefined) return structuredClone(source);
  if (Array.isArray(source) && Array.isArray(recipe)) {
    const key = collectionKey(source) ?? collectionKey(recipe);
    if (key)
      return [
        ...source.map((entry) =>
          mergeContract(
            entry,
            recipe.find((other) => other[key] === entry[key])
          )
        ),
        ...recipe
          .filter((entry) => !source.some((other) => other[key] === entry[key]))
          .map((entry) => structuredClone(entry)),
      ];
  } else if (
    source &&
    recipe &&
    typeof source === 'object' &&
    typeof recipe === 'object' &&
    !Array.isArray(source) &&
    !Array.isArray(recipe)
  ) {
    return Object.fromEntries(
      [...new Set([...Object.keys(source), ...Object.keys(recipe)])].map((key) => [
        key,
        mergeContract(source[key], recipe[key]),
      ])
    );
  }
  if (JSON.stringify(source) !== JSON.stringify(recipe))
    throw new Error('Conflicting fixed source and recipe contracts');
  return structuredClone(source);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
for (const facts of Object.values(registry))
  facts.contract = mergeContract(facts.assertions, facts.recipeAssertions);
deepFreeze(registry);

// There is no injection/registration API. The caller receives a recursively
// frozen view, never authority derived from its own scenario declarations.
export function getInterfaceFacts(id) {
  return typeof id === 'string' && Object.hasOwn(registry, id) ? registry[id] : undefined;
}

const setFields = new Set([
  'requirements',
  'reads',
  'dependsOn',
  'uniformBlocks',
  'usages',
  'dependencies',
  'coordinateBindings',
  'reservedAutoInputs',
  'requiredHostUniforms',
  'sourceKinds',
]);
const proseFields = {
  graph: { purpose: 'string', caveats: 'strings' },
  'graph.coordinateMapping': {
    geometryBounds: 'strings',
    geometrySize: 'string',
    matteRasterDpr: 'string',
    source: 'string',
  },
};
function documentationField(path, key, value) {
  const type =
    proseFields[path]?.[key] ??
    (/^graph\.(sources|resources)\.[^.]+\.(alpha|colorSpace|orientation)$/.test(path) &&
    key === 'obligation'
      ? 'string'
      : undefined) ??
    (/^graph\.featurePreconditions\.[^.]+$/.test(path) && key === 'reason' ? 'string' : undefined);
  const text = (item) => typeof item === 'string' && item.trim().length > 0;
  return type === 'string'
    ? text(value)
    : type === 'strings' && Array.isArray(value) && value.every(text);
}

// This is a closed contract for two recipes, not an extensible graph validator.
// Only listed prose and registered choices (source subset and bounded pass
// budget) vary. Pass identity plus fixed dependency edges determine execution
// order; collection order alone does not. inspectGraph separately retains the
// positional ABI checks for reflected fields and indexed sampler declarations.
export function inspectInterfaceFacts(graph) {
  const facts = getInterfaceFacts(graph?.interfaceId);
  if (!facts) return [{ code: 'unknown-source-interface', detail: graph?.interfaceId }];
  const mismatches = [];
  function compare(actual, expected, path) {
    const choice = facts.choices[path];
    if (choice?.kind === 'integer-range') {
      if (!Number.isInteger(actual) || actual < choice.minimum || actual > choice.maximum)
        mismatches.push(path);
      return;
    }
    if (Array.isArray(expected)) {
      if (choice?.kind === 'nonempty-subset') {
        if (
          !Array.isArray(actual) ||
          !actual.length ||
          new Set(actual).size !== actual.length ||
          actual.some((value) => !expected.includes(value))
        )
          mismatches.push(path);
        return;
      }
      if (!Array.isArray(actual) || actual.length !== expected.length) {
        mismatches.push(path);
        return;
      }
      if (
        expected.every((entry) => typeof entry === 'string') &&
        setFields.has(path.split('.').at(-1))
      ) {
        if (
          new Set(actual).size !== actual.length ||
          actual.some((value) => !expected.includes(value))
        )
          mismatches.push(path);
        return;
      }
      const key = collectionKey(expected);
      for (const [index, entry] of expected.entries())
        compare(
          key ? actual.find((value) => value?.[key] === entry[key]) : actual[index],
          entry,
          `${path}.${key ? entry[key] : index}`
        );
    } else if (expected && typeof expected === 'object') {
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) mismatches.push(path);
      else {
        for (const [key, value] of Object.entries(expected))
          compare(actual[key], value, `${path}.${key}`);
        for (const key of Object.keys(actual))
          if (!Object.hasOwn(expected, key) && !documentationField(path, key, actual[key]))
            mismatches.push(`${path}.${key}`);
      }
    } else if (actual !== expected) mismatches.push(path);
  }
  compare(graph, facts.contract, 'graph');
  return mismatches.map((detail) => ({ code: 'source-interface-fact-mismatch', detail }));
}
