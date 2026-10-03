// Build-time specialization only. This file never evaluates upstream JavaScript or GPU code.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const DECLARATION_ID = 'experimental/material-owned-texture-v1';
const root = new URL('./', import.meta.url);
const modules = JSON.parse(readFileSync(new URL('modules.json', root), 'utf8'));
const knownTargets = ['webgl-es100', 'webgpu', 'gpui', 'flutter', 'qt', 'generic-wc'];
const keys = (value, names) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...names].sort().join('|');
const finite = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const deny = (code, detail, kind = 'invalid') => ({
  kind,
  execution: 'not-admitted',
  diagnostics: [{ code, detail }],
});

function readKernel(index, name) {
  const text = readFileSync(new URL(`kernels/${name}`, root), 'utf8');
  if (createHash('sha256').update(text).digest('hex') !== modules[index].sourceLiteralSha256)
    throw new Error(`Audited kernel bytes changed: ${name}`);
  return text;
}

export function compileMaterialDeclarations(declarations, target) {
  if (!knownTargets.includes(target)) return deny('unknown-target', target, 'unsupported');
  if (!Array.isArray(declarations) || declarations.length !== 1)
    return deny(
      'declaration-cardinality',
      'Exactly one declared material is required',
      'unsupported'
    );
  const declaration = declarations[0];
  if (declaration?.id !== DECLARATION_ID)
    return deny('unconsumed-module', declaration?.id ?? 'missing', 'unsupported');
  const c = declaration.config;
  if (
    !keys(c, ['version', 'preset', 'source', 'shape', 'fallback', 'bindings']) ||
    c.version !== 1 ||
    c.preset !== 'liquidgl-owned-surface-v1'
  )
    return deny('unsupported-config', 'Only the named versioned finite preset is understood');
  if (
    !keys(c.source, ['kind', 'slot']) ||
    c.source.kind !== 'owned-texture' ||
    c.source.slot !== 'scene'
  )
    return deny('source-kind-mismatch', 'This profile cannot acquire live or reconstructed DOM');
  if (
    !keys(c.shape, ['kind', 'radius']) ||
    c.shape.kind !== 'rounded-rect' ||
    !finite(c.shape.radius, 0, 128)
  )
    return deny('invalid-shape', 'A bounded shared radius is required');
  if (
    !Array.isArray(c.fallback) ||
    c.fallback.length !== 4 ||
    ![0, 1, 2, 3].every((i) => Object.hasOwn(c.fallback, i) && finite(c.fallback[i], 0, 1)) ||
    c.fallback[3] !== 1
  )
    return deny('incomplete-fallback', 'Fully opaque authored RGBA is required');
  if (
    !keys(c.bindings, ['pressed', 'disabled']) ||
    c.bindings.pressed !== 'pressed' ||
    c.bindings.disabled !== 'disabled'
  )
    return deny(
      'unsupported-state-binding',
      'The current profile binds only declared Base Button boolean state'
    );
  if (target !== 'webgl-es100')
    return deny(
      'target-not-implemented',
      `${target} has no backend for this private profile`,
      'unsupported'
    );
  const vertex = readKernel(0, 'lens.vert');
  const fragment = readKernel(1, 'lens.frag');
  const declared = [...fragment.matchAll(/uniform\s+(\w+)\s+(\w+)\s*;/g)].map((m) => [m[1], m[2]]);
  if (JSON.stringify(declared) !== JSON.stringify(modules[1].uniforms))
    throw new Error('Audited uniform manifest drift');
  const rows = [
    ['u_tex', 'sampler2D', '0'],
    ['u_resolution', 'vec2', 'frame.viewport'],
    ['u_textureResolution', 'vec2', 'frame.textureSize'],
    ['u_bounds', 'vec4', 'frame.bounds'],
    ['u_refraction', 'float', '0.01'],
    ['u_aberration', 'float', '0'],
    ['u_bevelDepth', 'float', 'frame.pressed && !frame.disabled ? 0.10 : 0.08'],
    ['u_bevelWidth', 'float', '0.15'],
    ['u_frost', 'float', '0'],
    [
      'u_radius',
      'float',
      `Math.min(${c.shape.radius} * frame.dpr, frame.boxSize[0]/2, frame.boxSize[1]/2)`,
    ],
    ['u_time', 'float', '0'],
    ['u_specular', 'bool', '0'],
    ['u_revealProgress', 'float', '1'],
    ['u_revealType', 'int', '0'],
    ['u_tiltX', 'float', '0'],
    ['u_tiltY', 'float', '0'],
    ['u_magnify', 'float', '1'],
    ['u_subpixel', 'vec2', 'frame.subpixel'],
    ['u_boxSize', 'vec2', 'frame.boxSize'],
    ['u_tint', 'vec4', '[1,1,1,0]'],
    ['u_stack', 'sampler2D', '1'],
    ['u_stackMapping', 'vec4', '[0,0,0,0]'],
    ['u_stackRegion', 'vec4', '[0,0,0,0]'],
    ['u_interaction', 'vec4', '[0.5,0.5,0,0]'],
    ['u_interactionRadius', 'float', '0'],
    ['u_shadow', 'sampler2D', '2'],
    ['u_shadowMapping', 'vec4', '[0,0,0,0]'],
  ];
  if (JSON.stringify(rows.map(([name, type]) => [type, name])) !== JSON.stringify(declared))
    throw new Error('Finite writer ABI drift');
  const methods = {
    sampler2D: 'uniform1i',
    bool: 'uniform1i',
    int: 'uniform1i',
    float: 'uniform1f',
    vec2: 'uniform2fv',
    vec4: 'uniform4fv',
  };
  const writer = `// Generated direct calls. No runtime graph, CSS or Rule interpreter.\nexport function writeFrame(gl, locations, frame) {\n  validateFrame(frame);\n${rows.map(([name, type, expression]) => `  gl.${methods[type]}(locations.${name}, ${expression});`).join('\n')}\n}\n${readFileSync(new URL('frame-validation.mjs', root), 'utf8')}`;
  const resourcePlan = {
    source: {
      kind: 'owned-texture',
      slot: 'scene',
      format: 'rgba8',
      alpha: 'opaque',
      coordinates: 'top-left physical pixels',
      colorSpace: 'srgb-encoded-no-parity-claim',
    },
    neutralTextures: [
      { slot: 1, rgba: [0, 0, 0, 0], extent: [1, 1] },
      { slot: 2, rgba: [0, 0, 0, 0], extent: [1, 1] },
    ],
    pass: {
      kind: 'fragment',
      count: 1,
      output: 'clipped-surface',
      reads: [0, 1, 2],
      viewport: 'frame.viewport',
      blend: 'one/one-minus-src-alpha',
    },
    limits: {
      surfaces: 1,
      maxTextureDimension: 2048,
      maxSourceTexels: 1048576,
      maxSurfaceTexels: 1048576,
      historyFrames: 0,
    },
    geometry: {
      radiusSource: 'material declaration',
      logicalRadius: c.shape.radius,
      hostBorderRadius: 'same resolved and clamped radius',
    },
    fallback: { rgba: [...c.fallback], reasonRequired: true },
    stateBindings: { ...c.bindings },
    unsupported: [
      'live-compositor-backdrop',
      'reconstructed-scene',
      'multiple-surfaces',
      'shadow',
      'stacking',
      'fluid-anchor',
      'morph',
      'native-targets',
    ],
  };
  const license = readFileSync(new URL('kernels/LICENSE', root), 'utf8');
  const notice = `Extracted without shader modification from naughtyduk/liquidGL 3.0.0\nCommit 88f681ab7035fd55b04f63edff1841e32c4199e9, scripts/liquidGL.js\nGit blob b76e6872bf1c93ecacff646d09a77f5ce5f24ddb\nCopyright (c) NaughtyDuk. MIT; full terms and asset exclusion in LICENSE.\nProto-UI modifications: separately authored finite ABI writer/resource plan; no shader changes.\n`;
  return {
    kind: 'generated',
    execution: 'not-admitted',
    target,
    diagnostics: [
      {
        code: 'host-commit-unimplemented',
        detail: 'Source/ABI generation does not commit a visual frame',
      },
    ],
    resourcePlan,
    uniformABI: rows.map(([name, type]) => ({ name, type, method: methods[type] })),
    files: {
      'lens.vert': vertex,
      'lens.frag': fragment,
      'uniforms.mjs': writer,
      'resource-plan.json': JSON.stringify(resourcePlan, null, 2) + '\n',
      LICENSE: license,
      NOTICE: notice,
    },
  };
}
