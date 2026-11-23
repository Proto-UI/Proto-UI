/** Test-route-only optical diagnosis. Never a product profile or author extension.
 * The sole candidate is analytically rejected over a continuous full-domain ramp.
 * Extra canvases, texture copies, draws, readbacks and mean uniform exist only here.
 */
import {
  createWebOpticalProgram,
  type OpticalFrame,
} from '../../../../../../packages/adapters/base/src/material/program';
import { vertex } from '../../../../../../packages/adapters/base/src/material/liquidgl-kernel.generated';
import {
  styleTintFragment,
  styleTintContactFragment,
  styleTintProfile,
  styleTintContactProfile,
  styleTintEnvelope,
  styleTintLightForeground,
} from '../../../../../../packages/adapters/base/src/material/style-tint-profile';
import {
  colorContrast,
  opaqueRgba,
  type OpaqueRgba,
} from '../../../../../../packages/adapters/base/src/material/style';
import type { TintCell, TintRect } from './liquid-prominent-tint-metrics';
import {
  TINT_PROFILE4_FIXTURE,
  tintProfile4Fragment,
  tintProfile4ContactFragment,
} from './liquid-tint-profile4-fixture';

export const TINT_STAGE_POLICY = Object.freeze({
  version: 'tint4-stage-continuous-tone-1',
  candidateGeneralTransfer: 'rejected-analytically',
  expectedCompleteDiagnosticStatus: 'diagnostic-rejected-on-continuous-tone',
  productAccepted: false,
  executionScope: 'historical-profile4-replay-on-current-profile6-host',
  currentProductValidation: false,
  statistic:
    'same-frame GPU postlighting clamped encoded luma; exact inShape == 1; includes foreground backing',
  packing:
    'round(value / range * 65535) in RG bytes, B exact shape-opaque, A finite in-range; top-down PNG',
  packedToneRange: 1,
  packedPostlightRange: 2,
  // Storage plus conservative transfer/packing arithmetic allowance. This is not
  // a bound on inherited optical sampling/GLSL arithmetic or perceptual fidelity.
  toneError: 0.5 / 65535 + 2 ** -16,
  targetError: 0.5 / 65535 + 2 ** -16,
  minimumHighpPrecision: 23,
  maximumCarrierPixels: 65536,
  maximumSourcePixels: 131072,
  maximumFrames: 60,
  rampDomains: [
    [0, 255],
    [16, 80],
    [224, 254],
  ],
  originalHead: '2b8757f4516da60d3a3b31e9ec4df7401b3d3195',
  originalTree: 'bf899df185407f326a43dca40f2a65f9a20dcab0',
  shaderSha256: {
    static: '1ad0356cc23940e6f50d6e63db167588ace5750e83638ead5ae7506597312e7d',
    contact: '83cacf5404ddefb6680b0b9efa7818c21de42252561a85b4a539833744e453cb',
  },
} as const);
export type FrozenTintFrame = {
  sourceOrigin: 'archived-first-party-input' | 'predeclared-generated-ramp';
  id: string;
  control: 'neutral' | 'tinted' | 'opaque';
  phase: number;
  theme: string;
  part: string;
  content: string;
  head: string;
  tree: string;
  source: { revision: number; width: number; height: number; pixelSha256: string; rect: TintRect };
  geometry: TintRect;
  raster: { clip: TintRect; hostOffset: { x: number; y: number } };
  cells: TintCell[];
  exclusions: TintRect[];
  outset: number;
  profile: string | null;
  contactPhase: string | null;
  fill: number[];
  foreground: number[];
  files: Record<string, { file: string; sha256: string; bytes: number }>;
};
export type StageInput = { frame: FrozenTintFrame; pngs: Record<string, string> };
type Uniform = { method: 'uniform1f' | 'uniform1i' | 'uniform2fv' | 'uniform4fv'; value: number[] };
export type FrameBinding = {
  id: string;
  sourceRevision: number;
  sourceSha256: string;
  preparedSha256: string;
  frameSha256: string;
  uniformSha256: string;
  maskSha256: string;
  profile: string;
};
export function assertSameStageFrame(actual: FrameBinding, expected: FrameBinding) {
  for (const name of Object.keys(expected) as (keyof FrameBinding)[])
    if (actual[name] !== expected[name]) throw new Error(`tint-stage-stale-${name}`);
}
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const encodeTintStage = (n: number) =>
  n <= 0.0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - 0.055;
export function mapTintStage(t: number, m: number, b: number, light: boolean) {
  if (![t, m, b].every(Number.isFinite) || t < 0 || t > 1 || m < 0 || m > 1 || b <= 0 || b >= 1)
    throw new Error('tint-stage-invalid-transfer-input');
  const low = light ? 0 : b,
    high = light ? b : 1;
  const baseline = light ? b * t : b + (1 - b) * t;
  const raw = (light ? b * m : b + (1 - b) * m) + (t - m);
  return { baseline, raw, candidate: clamp(raw, low, high), low: raw < low, high: raw > high };
}
export function decodeTintStage(pixels: ArrayLike<number>, range: number) {
  if (pixels.length % 4 !== 0 || !(range > 0)) throw new Error('tint-stage-invalid-packed-data');
  const values: number[] = [],
    mask: boolean[] = [];
  for (let at = 0; at < pixels.length; at += 4) {
    if (![0, 255].includes(pixels[at + 2])) throw new Error('tint-stage-nonbinary-shape-mask');
    const opaque = pixels[at + 2] === 255;
    if (opaque && pixels[at + 3] !== 255) throw new Error('tint-stage-packed-overflow');
    values.push(((pixels[at] * 256 + pixels[at + 1]) / 65535) * range);
    mask.push(opaque);
  }
  return { values, mask };
}
export function observedTintStageMean(values: readonly number[], mask: readonly boolean[]) {
  if (values.length !== mask.length || !mask.some(Boolean))
    throw new Error('tint-stage-empty-or-stale-mask');
  let sum = 0,
    n = 0;
  values.forEach((v, i) => {
    if (mask[i]) {
      if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error('tint-stage-invalid-tone');
      sum += v;
      n++;
    }
  });
  return { value: Math.fround(sum / n), samples: n, error: TINT_STAGE_POLICY.toneError + 2 ** -24 };
}
export type VetoSample = {
  tone: number;
  oldTarget: number;
  newTarget: number;
  low: boolean;
  high: boolean;
  opaque: boolean;
};
function confirmedTintEndpoint(
  s: VetoSample,
  mean: number,
  bound: number,
  light: boolean,
  side: 'low' | 'high'
) {
  const mapped = mapTintStage(s.tone, mean, bound, light);
  const endpoint = side === 'low' ? (light ? 0 : bound) : light ? bound : 1;
  const margin = side === 'low' ? endpoint - mapped.raw : mapped.raw - endpoint;
  return (
    s.opaque &&
    s[side] &&
    margin > 2 * TINT_STAGE_POLICY.toneError + TINT_STAGE_POLICY.targetError &&
    Math.abs(s.newTarget - endpoint) <= TINT_STAGE_POLICY.targetError
  );
}
/** Equal RGB alone is never evidence. Require ordered varying tone/old target,
 * native endpoint flags, analytic clamp margins and resolved packed precision.
 * Adjacent packed ties are allowed (narrow byte ramps repeat columns). A
 * contiguous confirmed endpoint interval needs nondecreasing observed order and
 * endpoint tone/old-target spans exceeding paired error bars; it does not claim
 * every neighboring byte/packed sample was distinguishable. */
export function continuousTintVeto(
  samples: readonly VetoSample[],
  mean: number,
  bound: number,
  light: boolean,
  direction: 1 | -1
) {
  if (samples.some((s) => ![s.tone, s.oldTarget, s.newTarget].every(Number.isFinite)))
    throw new Error('tint-stage-invalid-veto-sample');
  const e = TINT_STAGE_POLICY.toneError,
    q = TINT_STAGE_POLICY.targetError;
  let unresolved = 0;
  const intervals: {
    start: number;
    end: number;
    side: string;
    toneSpan: number;
    oldSpan: number;
  }[] = [];
  const observed = samples.filter((s) => s.opaque);
  const toneSpan = observed.length
    ? Math.max(...observed.map((s) => s.tone)) - Math.min(...observed.map((s) => s.tone))
    : 0;
  const oldTargetSpan = observed.length
    ? Math.max(...observed.map((s) => s.oldTarget)) - Math.min(...observed.map((s) => s.oldTarget))
    : 0;
  const observation = { toneSpan, oldTargetSpan, samples: observed.length, direction };
  if (toneSpan <= 2 * e || oldTargetSpan <= 2 * q)
    return { verdict: 'inconclusive-precision', intervals, unresolved: 1, observation };
  if (
    observed.some(
      (s, i) =>
        i > 0 &&
        (direction * (s.tone - observed[i - 1].tone) < -2 * e ||
          direction * (s.oldTarget - observed[i - 1].oldTarget) < -2 * q)
    )
  )
    return { verdict: 'inconclusive-unordered-observation', intervals, unresolved: 1, observation };
  for (const side of ['low', 'high'] as const) {
    let start = -1;
    const finish = (end: number) => {
      if (start >= 0 && end > start) {
        const a = samples[start],
          z = samples[end],
          dt = direction * (z.tone - a.tone),
          dq = direction * (z.oldTarget - a.oldTarget);
        if (dt > 2 * e && dq > 2 * q)
          intervals.push({ start, end, side, toneSpan: dt, oldSpan: dq });
        else unresolved++;
      }
      start = -1;
    };
    samples.forEach((s, i) => {
      const confirmed = confirmedTintEndpoint(s, mean, bound, light, side);
      if (
        !confirmed ||
        (start >= 0 && direction * (s.tone - samples[i - 1].tone) < -2 * e) ||
        (start >= 0 && direction * (s.oldTarget - samples[i - 1].oldTarget) < -2 * q)
      )
        finish(i - 1);
      if (confirmed && start < 0) start = i;
    });
    finish(samples.length - 1);
  }
  return {
    verdict: intervals.length
      ? 'rejected-continuous-tone'
      : unresolved
        ? 'inconclusive-precision'
        : 'no-confirmed-veto-in-this-ramp',
    intervals,
    unresolved,
    observation,
  };
}
export function assertMonotonicRamp(values: readonly number[], direction: 1 | -1) {
  if (
    values.length < 2 ||
    !values.every(Number.isFinite) ||
    !values.some((v) => v !== values[0]) ||
    values.some((v, i) => i > 0 && direction * (v - values[i - 1]) < 0)
  )
    throw new Error('tint-stage-invalid-monotonic-control');
}
const MAIN = '        void main(){';
const DETAIL = '          vec3 styleTintDetail = clamp(final.rgb, 0.0, 1.0);';
const TARGET = `          float styleTintTargetCode = mix(
            styleTintBoundCode + (1.0 - styleTintBoundCode) * styleTintTone,
            styleTintBoundCode * styleTintTone, u_styleTintLightForeground);`;
const DECODE = '          float styleTintTarget = styleTintLinear(vec3(styleTintTargetCode)).r;';
function replaceOnce(source: string, anchor: string, replacement: string) {
  if (source.split(anchor).length !== 2) throw new Error('tint-stage-shader-anchor-drift');
  return source.replace(anchor, replacement);
}
const PACK = `
        uniform float u_tintStageMean;
        vec4 tintStagePack(float value, float range, float shape) {
          float integer = floor(clamp(value / range, 0.0, 1.0) * 65535.0 + 0.5);
          return vec4(floor(integer / 256.0), mod(integer, 256.0), shape == 1.0 ? 255.0 : 0.0,
                      (value >= 0.0 && value <= range) ? 255.0 : 0.0) / 255.0;
        }
`;
const CANDIDATE = `          float tintStageRaw = mix(
            styleTintBoundCode + (1.0 - styleTintBoundCode) * u_tintStageMean,
            styleTintBoundCode * u_tintStageMean, u_styleTintLightForeground) + (styleTintTone - u_tintStageMean);
          float tintStageLow = mix(styleTintBoundCode, 0.0, u_styleTintLightForeground);
          float tintStageHigh = mix(1.0, styleTintBoundCode, u_styleTintLightForeground);
          float styleTintTargetCode = clamp(tintStageRaw, tintStageLow, tintStageHigh);`;
export const TINT_STAGE_KINDS = [
  'baseline',
  'postlight-r',
  'postlight-g',
  'postlight-b',
  'tone',
  'input-clamp',
  'old-target',
  'new-target',
  'target-clamp',
  'candidate',
] as const;
export type TintStageKind = (typeof TINT_STAGE_KINDS)[number];
export function tintStageShader(kind: TintStageKind, contact = true) {
  if (!TINT_STAGE_KINDS.includes(kind)) throw new Error('tint-stage-unknown-stage');
  let source = contact ? tintProfile4ContactFragment : tintProfile4Fragment;
  for (const anchor of [MAIN, DETAIL, TARGET, DECODE])
    if (source.split(anchor).length !== 2) throw new Error('tint-stage-shader-anchor-drift');
  if (kind === 'baseline') return source;
  source = replaceOnce(source, MAIN, PACK + MAIN);
  if (kind.startsWith('postlight-'))
    return replaceOnce(
      source,
      DETAIL,
      `          gl_FragColor = tintStagePack(final.${kind.slice(-1)}, 2.0, inShape); return;\n` +
        DETAIL
    );
  if (kind === 'input-clamp')
    return replaceOnce(
      source,
      DETAIL,
      `          gl_FragColor = vec4(any(lessThan(final.rgb, vec3(0.0))) ? 1.0 : 0.0, any(greaterThan(final.rgb, vec3(1.0))) ? 1.0 : 0.0, inShape == 1.0 ? 1.0 : 0.0, 1.0); return;\n` +
        DETAIL
    );
  if (kind === 'tone')
    return replaceOnce(
      source,
      TARGET,
      '          gl_FragColor = tintStagePack(styleTintTone, 1.0, inShape); return;\n' + TARGET
    );
  if (kind === 'old-target')
    return replaceOnce(
      source,
      DECODE,
      '          gl_FragColor = tintStagePack(styleTintTargetCode, 1.0, inShape); return;\n' +
        DECODE
    );
  source = replaceOnce(source, TARGET, CANDIDATE);
  if (kind === 'new-target')
    return replaceOnce(
      source,
      DECODE,
      '          gl_FragColor = tintStagePack(styleTintTargetCode, 1.0, inShape); return;\n' +
        DECODE
    );
  if (kind === 'target-clamp')
    return replaceOnce(
      source,
      DECODE,
      `          gl_FragColor = vec4(tintStageRaw < tintStageLow ? 1.0 : 0.0, tintStageRaw > tintStageHigh ? 1.0 : 0.0, inShape == 1.0 ? 1.0 : 0.0, 1.0); return;\n` +
        DECODE
    );
  return source;
}
export async function tintStageHash(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    (v) => v.toString(16).padStart(2, '0')
  ).join('');
}
function readback(gl: WebGLRenderingContext, width: number, height: number) {
  const data = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  if (gl.getError() !== gl.NO_ERROR || gl.isContextLost())
    throw new Error('tint-stage-readback-failed');
  return data;
}
function topDown(data: Uint8Array, width: number, height: number) {
  const copy = new Uint8Array(data.length);
  for (let y = 0; y < height; y++)
    copy.set(data.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4);
  return copy;
}
function rawPng(data: Uint8Array, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas.toDataURL('image/png');
}
async function decodePng(uri: string) {
  if (!uri.startsWith('data:image/png;base64,')) throw new Error('tint-stage-nonlocal-png');
  const image = new Image();
  image.src = uri;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return {
    image,
    canvas,
    width: image.width,
    height: image.height,
    data: new Uint8Array(ctx.getImageData(0, 0, image.width, image.height).data),
  };
}
function pngBytes(uri: string) {
  return Uint8Array.from(atob(uri.split(',')[1]), (c) => c.charCodeAt(0));
}
function assertBytes(a: Uint8Array, b: Uint8Array, reason: string) {
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) throw new Error(reason);
}
export function verifyTintStageSafety(
  data: ArrayLike<number>,
  fill: OpaqueRgba,
  foreground: OpaqueRgba
) {
  const envelope = styleTintEnvelope(fill, foreground);
  let n = 0,
    minimum = Infinity;
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3];
    if (alpha === 255) n++;
    if (alpha < 250) continue;
    for (const background of alpha === 255 ? [0] : [0, 1]) {
      const composite: OpaqueRgba = [
        data[at] / 255 + (1 - alpha / 255) * background,
        data[at + 1] / 255 + (1 - alpha / 255) * background,
        data[at + 2] / 255 + (1 - alpha / 255) * background,
        1,
      ];
      const contrast = colorContrast(composite, envelope.worstForeground);
      minimum = Math.min(minimum, contrast);
      if (
        composite.slice(0, 3).some((v) => v > 1) ||
        contrast < 4.5 ||
        styleTintLightForeground(composite, envelope.worstForeground) !== envelope.lightForeground
      )
        throw new Error('tint-stage-rendered-contrast-unsafe');
    }
  }
  if (!n) throw new Error('tint-stage-empty-opaque-output');
  return {
    minimumContrast: minimum,
    opaqueSamples: n,
    worstForeground: envelope.worstForeground,
    polarity: envelope.lightForeground ? 'light' : 'dark',
    luminanceBound: envelope.luminanceBound,
  };
}

/** Exact-source, single-pipeline substitution. A drifted host must fail before
 * any diagnostic draw, never silently compile current production as history. */
export function createTintStageHistoricalSubstitution(
  host: { profile: string; fragment: string; vertex: string },
  contact = true
) {
  const expectedHost = contact ? 'pui-regular-style-tint-contact-6' : 'pui-regular-style-tint-6';
  const historical = contact ? tintProfile4ContactFragment : tintProfile4Fragment;
  const uniforms = (source: string) =>
    [
      ...source.matchAll(
        /\buniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+\w+(?:\s*\[[^\]]+\])?\s*;/g
      ),
    ]
      .map((match) => match[0].replace(/\s+/g, ' '))
      .sort();
  if (host.profile !== expectedHost || host.fragment === historical)
    throw new Error('tint-stage-current-host-profile-drift');
  // Profile 6 owns one additional source-budget uniform. The complete frozen
  // profile-4 shader has no such location: uniform4fv(null, ...) is ignored by
  // WebGL and the capture records only locations actually used by history.
  // Refuse every other schema difference instead of silently substituting it.
  const currentUniforms = uniforms(host.fragment);
  const sourceBudget = 'uniform vec4 u_styleTintSourceTone;';
  if (
    currentUniforms.filter((uniform) => uniform === sourceBudget).length !== 1 ||
    JSON.stringify(currentUniforms.filter((uniform) => uniform !== sourceBudget)) !==
      JSON.stringify(uniforms(historical))
  )
    throw new Error('tint-stage-historical-uniform-schema-drift');
  const counts = { vertex: 0, fragment: 0 };
  return {
    source(kind: 'vertex' | 'fragment', source: string) {
      if (kind !== 'vertex' && kind !== 'fragment')
        throw new Error('tint-stage-unexpected-shader-type');
      if (source !== host[kind] || counts[kind] !== 0)
        throw new Error(`tint-stage-current-${kind}-source-or-count-drift`);
      counts[kind]++;
      return kind === 'fragment' ? historical : source;
    },
    complete() {
      if (counts.vertex !== 1 || counts.fragment !== 1)
        throw new Error('tint-stage-historical-substitution-count-drift');
      return {
        vertexSources: counts.vertex,
        fragmentReplacements: counts.fragment,
        unusedAdapterUniforms: ['u_styleTintSourceTone'],
      };
    },
  };
}
export type TintStageKernelReceipt = {
  scope: string;
  currentProductValidation: boolean;
  currentAdapter: { profile: string; requestedFragmentSha256: string };
  compiledKernel: { profile: string; fragmentSha256: string; head: string; tree: string };
  vertexSha256: string;
  vertexSources: number;
  fragmentReplacements: number;
  unusedAdapterUniforms: string[];
};
/** A historical replay cannot become profile6 evidence by changing a label. */
export function assertTintStageHistoricalKernelReceipt(receipt?: TintStageKernelReceipt) {
  if (
    !receipt ||
    receipt.scope !== TINT_STAGE_POLICY.executionScope ||
    receipt.currentProductValidation !== false ||
    receipt.currentAdapter?.profile !== 'pui-regular-style-tint-contact-6' ||
    !/^[a-f0-9]{64}$/.test(receipt.currentAdapter.requestedFragmentSha256) ||
    receipt.currentAdapter.requestedFragmentSha256 === TINT_PROFILE4_FIXTURE.contact.sha256 ||
    receipt.compiledKernel?.profile !== TINT_PROFILE4_FIXTURE.contact.profile ||
    receipt.compiledKernel.fragmentSha256 !== TINT_PROFILE4_FIXTURE.contact.sha256 ||
    receipt.compiledKernel.head !== TINT_PROFILE4_FIXTURE.head ||
    receipt.compiledKernel.tree !== TINT_PROFILE4_FIXTURE.tree ||
    !/^[a-f0-9]{64}$/.test(receipt.vertexSha256) ||
    receipt.vertexSources !== 1 ||
    receipt.fragmentReplacements !== 1 ||
    JSON.stringify(receipt.unusedAdapterUniforms) !== JSON.stringify(['u_styleTintSourceTone'])
  )
    throw new Error('tint-stage-not-historical-profile4-evidence');
}

/** Wrap only this owned canvas context. No WebGL prototype or host provider patch.
 * The current adapter supplies preparation/uniforms; its profile6 fragment is
 * replaced before compilation. These draws validate only the historical kernel. */
function captureProduction(frame: OpticalFrame) {
  const substitution = createTintStageHistoricalSubstitution(
    {
      profile: frame.contact ? styleTintContactProfile : styleTintProfile,
      fragment: frame.contact ? styleTintContactFragment : styleTintFragment,
      vertex,
    },
    !!frame.contact
  );
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) throw new Error('tint-stage-webgl-unavailable');
  const locations = new Map<WebGLUniformLocation, string>(),
    uniforms: Record<string, Uniform> = {};
  let prepared: Uint8Array | null = null,
    textureUnit = gl.TEXTURE0,
    readbackCalls = 0,
    uploadedBytes = 0;
  const shaders: string[] = [],
    requestedShaders: string[] = [],
    restores: (() => void)[] = [];
  const wrap = (
    name: string,
    observe: (args: any[], result: any) => void,
    before?: (args: any[]) => void
  ) => {
    const original = (gl as any)[name];
    (gl as any)[name] = function (...args: any[]) {
      before?.(args);
      const result = original.apply(gl, args);
      observe(args, result);
      return result;
    };
    restores.push(() => {
      (gl as any)[name] = original;
    });
  };
  wrap('getUniformLocation', (args, result) => {
    if (result) locations.set(result, args[1]);
  });
  wrap('activeTexture', (args) => {
    textureUnit = args[0];
  });
  wrap(
    'shaderSource',
    (args) => shaders.push(args[1]),
    (args) => {
      const kind = gl.getShaderParameter(args[0], gl.SHADER_TYPE);
      if (kind !== gl.VERTEX_SHADER && kind !== gl.FRAGMENT_SHADER)
        throw new Error('tint-stage-unexpected-shader-type');
      requestedShaders.push(args[1]);
      args[1] = substitution.source(kind === gl.VERTEX_SHADER ? 'vertex' : 'fragment', args[1]);
    }
  );
  wrap(
    'drawArrays',
    () => {},
    () => {
      substitution.complete();
    }
  );
  wrap('readPixels', () => {
    readbackCalls++;
  });
  wrap('texImage2D', (args) => {
    if (args[8] instanceof Uint8Array) uploadedBytes += args[8].byteLength;
    if (
      textureUnit === gl.TEXTURE0 &&
      args.length === 9 &&
      args[3] === frame.source.width &&
      args[4] === frame.source.height &&
      args[8] instanceof Uint8Array
    )
      prepared = new Uint8Array(args[8]);
  });
  for (const method of ['uniform1f', 'uniform1i', 'uniform2fv', 'uniform4fv'] as const)
    wrap(method, (args) => {
      const name = locations.get(args[0]);
      if (!name) return;
      uniforms[name] = {
        method,
        value: (typeof args[1] === 'number' ? [args[1]] : Array.from(args[1] as number[])).map(
          (v) => (method === 'uniform1i' ? v : Math.fround(v))
        ),
      };
    });
  const program = createWebOpticalProgram(canvas);
  try {
    const png = program.render(frame);
    const replacementCounts = substitution.complete();
    const productionInternalReadbacks = readbackCalls;
    if (!prepared) throw new Error('tint-stage-missing-actual-prefilter');
    const activeProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    for (const [location, name] of locations) {
      const expected = uniforms[name];
      if (!expected) continue;
      const actual = gl.getUniform(activeProgram, location);
      const values =
        typeof actual === 'number' || typeof actual === 'boolean'
          ? [Number(actual)]
          : Array.from(actual as number[]);
      if (JSON.stringify(values) !== JSON.stringify(expected.value))
        throw new Error(`tint-stage-upload-readback-mismatch-${name}`);
    }
    return {
      canvas,
      gl,
      png,
      pixels: readback(gl, canvas.width, canvas.height),
      prepared: prepared as Uint8Array,
      uniforms,
      shaders,
      requestedShaders,
      replacementCounts,
      metrics: program.inspect(),
      productionInternalReadbacks,
      captureReadbacks: readbackCalls - productionInternalReadbacks,
      uploadedBytes,
      dither: gl.isEnabled(gl.DITHER),
      dispose: () => program.dispose(),
    };
  } catch (error) {
    const stagePngs: Record<string, string> = {};
    try {
      if (canvas.width && canvas.height)
        stagePngs['production-failed-carrier'] = canvas.toDataURL('image/png');
    } catch {
      /* A lost context may have no image. */
    }
    if (prepared) stagePngs.prepared = rawPng(prepared, frame.source.width, frame.source.height);
    const failure = error instanceof Error ? error : new Error(String(error));
    Object.assign(failure, {
      tintStagePartial: {
        stagePngs,
        uniformUploads: uniforms,
        requestedShaderSources: requestedShaders,
        submittedShaderSources: shaders,
        productionMetrics: program.inspect(),
        productionDimensions: [canvas.width, canvas.height],
      },
    });
    program.dispose();
    throw failure;
  } finally {
    for (const restore of restores.reverse()) restore();
  }
}

export function applyTintStageDither(
  gl: Pick<WebGLRenderingContext, 'DITHER' | 'enable' | 'disable'>,
  kind: TintStageKind,
  productionDither: boolean
) {
  if ((kind === 'baseline' || kind === 'candidate') && productionDither) gl.enable(gl.DITHER);
  else gl.disable(gl.DITHER);
}

function createStageCanvas(
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  prepared: Uint8Array,
  uniforms: Record<string, Uniform>,
  productionDither: boolean
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) throw new Error('tint-stage-webgl-unavailable');
  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  if (!precision || precision.precision < TINT_STAGE_POLICY.minimumHighpPrecision)
    throw new Error(
      `tint-stage-inconclusive-highp-precision:${JSON.stringify(precision ? { precision: precision.precision, rangeMin: precision.rangeMin, rangeMax: precision.rangeMax } : null)}`
    );
  const channelBits = [gl.RED_BITS, gl.GREEN_BITS, gl.BLUE_BITS, gl.ALPHA_BITS].map((parameter) =>
    gl.getParameter(parameter)
  );
  if (channelBits.some((bits) => bits !== 8))
    throw new Error(`tint-stage-inconclusive-framebuffer-format:${JSON.stringify(channelBits)}`);
  const buffer = gl.createBuffer()!,
    textures: WebGLTexture[] = [],
    programs = new Map<string, WebGLProgram>();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  for (let unit = 0; unit < 3; unit++) {
    const texture = gl.createTexture()!;
    textures.push(texture);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR);
    for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      unit ? 1 : sourceWidth,
      unit ? 1 : sourceHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      unit ? new Uint8Array(4) : prepared
    );
  }
  function draw(kind: TintStageKind, mean = 0) {
    let program = programs.get(kind);
    if (!program) {
      program = gl!.createProgram()!;
      for (const [type, source] of [
        [gl!.VERTEX_SHADER, vertex],
        [gl!.FRAGMENT_SHADER, tintStageShader(kind)],
      ] as const) {
        const shader = gl!.createShader(type)!;
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS))
          throw new Error(`tint-stage-compile-${kind}: ${gl!.getShaderInfoLog(shader)}`);
        gl!.attachShader(program, shader);
        gl!.deleteShader(shader);
      }
      gl!.linkProgram(program);
      if (!gl!.getProgramParameter(program, gl!.LINK_STATUS))
        throw new Error(`tint-stage-link-${kind}`);
      programs.set(kind, program);
    }
    gl!.viewport(0, 0, width, height);
    gl!.useProgram(program);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    const attribute = gl!.getAttribLocation(program, 'a_position');
    gl!.enableVertexAttribArray(attribute);
    gl!.vertexAttribPointer(attribute, 2, gl!.FLOAT, false, 0, 0);
    for (const [name, { method, value }] of Object.entries(uniforms)) {
      const location = gl!.getUniformLocation(program, name);
      if (method === 'uniform1f') gl!.uniform1f(location, value[0]);
      else if (method === 'uniform1i') gl!.uniform1i(location, value[0]);
      else if (method === 'uniform2fv') gl!.uniform2fv(location, value);
      else gl!.uniform4fv(location, value);
    }
    const meanLocation = gl!.getUniformLocation(program, 'u_tintStageMean');
    gl!.uniform1f(meanLocation, mean);
    if (meanLocation && gl!.getUniform(program, meanLocation) !== Math.fround(mean))
      throw new Error('tint-stage-stale-mean-upload');
    applyTintStageDither(gl!, kind, productionDither);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.disable(gl!.BLEND);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    const raw = readback(gl!, width, height);
    return { raw, top: topDown(raw, width, height), png: canvas.toDataURL('image/png') };
  }
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    draw,
    metadata: {
      precision: {
        precision: precision.precision,
        rangeMin: precision.rangeMin,
        rangeMax: precision.rangeMax,
      },
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      format: 'RGBA/UNSIGNED_BYTE',
      channelBits,
      productionDither,
      packedStageDither: false,
      opticalArithmeticError:
        'not proven; exact baseline replay and native target interval checks required',
      stageSemantics:
        'finite shader derivatives; early returns may change compiler optimization; not hidden registers of the production compiled program',
      admissionScope: 'frozen owned OpticalFrame only; DOM/provider admission not rerun',
    },
    dispose() {
      programs.forEach((p) => gl!.deleteProgram(p));
      textures.forEach((t) => gl!.deleteTexture(t));
      gl!.deleteBuffer(buffer);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
export function tintTextureCosts(
  samples: readonly VetoSample[],
  width: number,
  height: number,
  oldPixels: ArrayLike<number>,
  newPixels: ArrayLike<number>,
  mapping: { mean: number; bound: number; light: boolean }
) {
  if (
    samples.length !== width * height ||
    oldPixels.length !== width * height * 4 ||
    newPixels.length !== oldPixels.length
  )
    throw new Error('tint-stage-stale-texture-mask');
  const clipped = samples.map((s) => s.opaque && (s.low || s.high));
  const equal = (data: ArrayLike<number>, a: number, b: number) =>
    [0, 1, 2].every((c) => data[a * 4 + c] === data[b * 4 + c]);
  const visited = new Set<number>(),
    components: { size: number; firstPixel: number; endpoint: string }[] = [];
  let newFlatRgbEdges = 0,
    rawClampedEdges = 0,
    resolvedClampedEdges = 0,
    uncertainOrUninformativeClampedEdges = 0,
    opaqueSamples = 0;
  samples.forEach((s, i) => {
    if (!s.opaque) return;
    opaqueSamples++;
    for (const j of [
      (i % width) + 1 < width ? i + 1 : -1,
      i + width < samples.length ? i + width : -1,
    ]) {
      if (j < 0 || !samples[j].opaque) continue;
      if (!equal(oldPixels, i, j) && equal(newPixels, i, j)) newFlatRgbEdges++;
      if (clipped[i] && clipped[j] && s.low === samples[j].low) {
        rawClampedEdges++;
        const side = s.low ? 'low' : 'high';
        if (
          confirmedTintEndpoint(s, mapping.mean, mapping.bound, mapping.light, side) &&
          confirmedTintEndpoint(samples[j], mapping.mean, mapping.bound, mapping.light, side) &&
          Math.abs(s.tone - samples[j].tone) > 2 * TINT_STAGE_POLICY.toneError &&
          Math.abs(s.oldTarget - samples[j].oldTarget) > 2 * TINT_STAGE_POLICY.targetError
        )
          resolvedClampedEdges++;
        else uncertainOrUninformativeClampedEdges++;
      }
    }
    if (!clipped[i] || visited.has(i)) return;
    const queue = [i];
    visited.add(i);
    for (let at = 0; at < queue.length; at++) {
      const k = queue[at];
      for (const j of [
        k % width ? k - 1 : -1,
        (k % width) + 1 < width ? k + 1 : -1,
        k - width,
        k + width,
      ])
        if (
          j >= 0 &&
          j < samples.length &&
          clipped[j] &&
          !visited.has(j) &&
          samples[j].low === s.low &&
          equal(newPixels, i, j)
        ) {
          visited.add(j);
          queue.push(j);
        }
    }
    components.push({ size: queue.length, firstPixel: i, endpoint: s.low ? 'low' : 'high' });
  });
  return {
    domain: 'entire exact shape-opaque carrier, 4-connected equal candidate RGB; no ROI selection',
    newFlatRgbEdgesInterpretation:
      'raw quantized RGB diagnostic; may include ordinary quantization and is never itself a continuous-tone veto',
    opaqueSamples,
    lowClipPixels: samples.filter((s) => s.opaque && s.low).length,
    highClipPixels: samples.filter((s) => s.opaque && s.high).length,
    newFlatRgbEdges,
    rawClampedEdges,
    resolvedClampedEdges,
    uncertainOrUninformativeClampedEdges,
    observedComponentsAreNotPrecisionVerdicts: true,
    components,
    largestPlateau: Math.max(0, ...components.map((c) => c.size)),
    clipMap: Uint8Array.from(
      samples.flatMap((s) => [
        s.opaque && s.low ? 255 : 0,
        s.opaque && s.high ? 255 : 0,
        s.opaque ? 255 : 0,
        255,
      ])
    ),
  };
}
async function cropCarrier(uri: string, frame: FrozenTintFrame) {
  const decoded = await decodePng(uri),
    canvas = document.createElement('canvas');
  canvas.width = frame.raster.clip.width;
  canvas.height = frame.raster.clip.height;
  const sx = decoded.width / (frame.geometry.width + 2 * frame.outset),
    sy = decoded.height / (frame.geometry.height + 2 * frame.outset);
  canvas
    .getContext('2d')!
    .drawImage(
      decoded.image,
      (frame.outset - frame.raster.hostOffset.x) * sx,
      (frame.outset - frame.raster.hostOffset.y) * sy,
      canvas.width * sx,
      canvas.height * sy,
      0,
      0,
      canvas.width,
      canvas.height
    );
  return {
    width: canvas.width,
    height: canvas.height,
    data: Array.from(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data),
    png: canvas.toDataURL('image/png'),
  };
}
export function failedTintStageResult<T extends Record<string, any>>(partial: T, error: unknown) {
  return {
    ...partial,
    status: 'failed' as const,
    failure: error instanceof Error ? error.message : String(error),
    candidateGeneralTransfer: TINT_STAGE_POLICY.candidateGeneralTransfer,
    currentProductValidation: false as const,
    productAccepted: false as const,
  };
}
export async function runTintStageFrame(input: StageInput) {
  const partial: Record<string, any> = {
    id: input.frame.id,
    control: input.frame.control,
    sourceOrigin: input.frame.sourceOrigin,
    evidenceKind: input.frame.control === 'tinted' ? 'native-diagnostic' : 'archived-reference',
    inputPngs: input.frame.files,
    stagePngs: {},
    stageReceipts: {},
    productAccepted: false,
  };
  try {
    return await executeTintStageFrame(input, partial);
  } catch (error) {
    const capture = (error as { tintStagePartial?: Record<string, any> })?.tintStagePartial;
    return failedTintStageResult(capture ? { ...partial, ...capture } : partial, error);
  }
}
async function executeTintStageFrame(input: StageInput, partial: Record<string, any>) {
  if (
    !['archived-first-party-input', 'predeclared-generated-ramp'].includes(input.frame.sourceOrigin)
  )
    throw new Error('tint-stage-source-origin-missing');
  const start = performance.now(),
    { frame, pngs } = input;
  if (
    frame.head !== TINT_STAGE_POLICY.originalHead ||
    frame.tree !== TINT_STAGE_POLICY.originalTree
  )
    throw new Error('tint-stage-original-source-drift');
  for (const [role, file] of Object.entries(frame.files)) {
    if (!pngs[role] || (await tintStageHash(pngBytes(pngs[role]))) !== file.sha256)
      throw new Error(`tint-stage-input-png-mismatch-${role}`);
  }
  const source = await decodePng(pngs.source);
  const sourceHash = await tintStageHash(source.data);
  if (
    source.width !== frame.source.width ||
    source.height !== frame.source.height ||
    sourceHash !== frame.source.pixelSha256
  )
    throw new Error('tint-stage-source-pixel-mismatch');
  if (source.width * source.height > TINT_STAGE_POLICY.maximumSourcePixels)
    throw new Error('tint-stage-source-budget');
  const sourceCrop = await decodePng(pngs['source-crop']);
  const sourceImage = {
    width: sourceCrop.width,
    height: sourceCrop.height,
    data: Array.from(sourceCrop.data),
  };
  if (!opaqueRgba(frame.fill) || !opaqueRgba(frame.foreground))
    throw new Error('tint-stage-invalid-palette');
  const fill = frame.fill,
    foreground = frame.foreground;
  if (frame.control !== 'tinted') {
    const role = frame.control === 'neutral' ? 'interior-plane' : 'subject';
    const archived = await decodePng(pngs[role]);
    return {
      id: frame.id,
      control: frame.control,
      sourceImage,
      material: {
        width: archived.width,
        height: archived.height,
        data: Array.from(archived.data),
        png: pngs[role],
      },
      sourceOrigin: frame.sourceOrigin,
      originalHead: frame.sourceOrigin === 'archived-first-party-input' ? frame.head : null,
      originalTree: frame.sourceOrigin === 'archived-first-party-input' ? frame.tree : null,
      kernelSource: { head: frame.head, tree: frame.tree },
      inputPngs: frame.files,
      status: 'historical-own-geometry-reference-not-new-gpu',
      evidenceKind: 'archived-reference',
      productAccepted: false,
      milliseconds: performance.now() - start,
    };
  }
  if (frame.contactPhase !== 'rest') throw new Error('tint-stage-only-frozen-rest');
  if (frame.profile !== TINT_PROFILE4_FIXTURE.contact.profile)
    throw new Error('tint-stage-historical-input-profile-mismatch');
  if (
    (await tintStageHash(tintProfile4ContactFragment)) !== TINT_STAGE_POLICY.shaderSha256.contact ||
    (await tintStageHash(tintProfile4Fragment)) !== TINT_STAGE_POLICY.shaderSha256.static
  )
    throw new Error('tint-stage-shader-hash-drift');
  const optical: OpticalFrame = {
    source: {
      revision: frame.source.revision,
      width: source.width,
      height: source.height,
      pixels: source.data,
      canvas: source.canvas,
      scope: document.createElement('div'),
    },
    geometry: {
      width: frame.geometry.width,
      height: frame.geometry.height,
      radius: Math.min(frame.geometry.width, frame.geometry.height) / 2,
      paintOutset: frame.outset,
      dpr: 1,
      bounds: [
        (frame.geometry.x - frame.source.rect.x) / frame.source.rect.width,
        (frame.geometry.y - frame.source.rect.y) / frame.source.rect.height,
        frame.geometry.width / frame.source.rect.width,
        frame.geometry.height / frame.source.rect.height,
      ],
    },
    pressed: false,
    contact: { x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 0 },
    variant: 'regular',
    fill,
    foreground,
    ...(frame.control === 'tinted' ? { tint: 'style-fill' as const } : {}),
  };
  const actual = captureProduction(optical);
  try {
    const kernelExecution: TintStageKernelReceipt = {
      scope: TINT_STAGE_POLICY.executionScope,
      currentProductValidation: false,
      currentAdapter: {
        profile: styleTintContactProfile,
        requestedFragmentSha256: await tintStageHash(styleTintContactFragment),
      },
      compiledKernel: {
        profile: TINT_PROFILE4_FIXTURE.contact.profile,
        fragmentSha256: await tintStageHash(tintProfile4ContactFragment),
        head: TINT_PROFILE4_FIXTURE.head,
        tree: TINT_PROFILE4_FIXTURE.tree,
      },
      vertexSha256: await tintStageHash(vertex),
      ...actual.replacementCounts,
    };
    assertTintStageHistoricalKernelReceipt(kernelExecution);
    const width = actual.canvas.width,
      height = actual.canvas.height;
    if (width * height > TINT_STAGE_POLICY.maximumCarrierPixels)
      throw new Error('tint-stage-carrier-budget');
    const material = await cropCarrier(actual.png, frame);
    const common = {
      id: frame.id,
      control: frame.control,
      sourceOrigin: frame.sourceOrigin,
      originalHead: frame.sourceOrigin === 'archived-first-party-input' ? frame.head : null,
      originalTree: frame.sourceOrigin === 'archived-first-party-input' ? frame.tree : null,
      kernelSource: { head: frame.head, tree: frame.tree },
      kernelExecution,
      currentProductValidation: false,
      inputPngs: frame.files,
      sourceImage,
      material,
      productAccepted: false,
      geometry: optical.geometry,
      sourceRevision: optical.source.revision,
      sourceSha256: sourceHash,
      uniformUploads: actual.uniforms,
      productionMetrics: actual.metrics,
      productionMetricsScope: 'current-host-program-with-historical-profile4-fragment',
      productionReadback: {
        compiledProfile: TINT_PROFILE4_FIXTURE.contact.profile,
        sha256: await tintStageHash(actual.pixels),
        width,
        height,
        rowOrder: 'bottom-up',
        format: 'RGBA/UNSIGNED_BYTE',
        alpha: 'premultiplied',
      },
    };
    Object.assign(partial, common);
    partial.stagePngs['production-carrier'] = actual.png;
    if (
      actual.shaders.length !== 2 ||
      !actual.shaders.includes(tintProfile4ContactFragment) ||
      !actual.shaders.includes(vertex) ||
      actual.requestedShaders.length !== 2 ||
      !actual.requestedShaders.includes(styleTintContactFragment) ||
      !actual.requestedShaders.includes(vertex)
    )
      throw new Error('tint-stage-production-profile-mismatch');
    const stagePngs: Record<string, string> = {
      prepared: rawPng(actual.prepared, source.width, source.height),
      'production-carrier': actual.png,
    };
    const receipts: Record<string, unknown> = {};
    partial.stagePngs = stagePngs;
    partial.stageReceipts = receipts;
    const stage = createStageCanvas(
      width,
      height,
      source.width,
      source.height,
      actual.prepared,
      actual.uniforms,
      actual.dither
    );
    try {
      partial.gpu = stage.metadata;
      const frameIdentity = await tintStageHash(
        JSON.stringify({
          id: frame.id,
          revision: frame.source.revision,
          geometry: optical.geometry,
          fill,
          foreground,
          contact: optical.contact,
          profile: frame.profile,
        })
      );
      const uniformHash = await tintStageHash(JSON.stringify(actual.uniforms));
      let draws = 0;
      const collect = async (kind: TintStageKind, mean = 0) => {
        const value = stage.draw(kind, mean);
        draws++;
        // Packed stages always have opaque storage, independent of shape alpha.
        stagePngs[kind] = ['baseline', 'candidate'].includes(kind)
          ? value.png
          : rawPng(value.top, width, height);
        receipts[kind] = {
          width,
          height,
          frameSha256: frameIdentity,
          uniformSha256: uniformHash,
          sourceSha256: sourceHash,
          dither: kind === 'baseline' || kind === 'candidate' ? actual.dither : false,
          shaderSha256: await tintStageHash(tintStageShader(kind)),
          rawBottomUpSha256: await tintStageHash(value.raw),
          topDownSha256: await tintStageHash(value.top),
          meanUniform:
            kind === 'candidate' || kind === 'new-target' || kind === 'target-clamp'
              ? Math.fround(mean)
              : null,
        };
        return value;
      };
      const baseline = await collect('baseline');
      assertBytes(actual.pixels, baseline.raw, 'tint-stage-baseline-mismatch');
      partial.baselineReplay = 'byte-identical-raw-premultiplied-bottom-up';
      const toneStage = await collect('tone'),
        tone = decodeTintStage(toneStage.top, 1);
      const opaqueMask = Uint8Array.from(tone.mask, (b) => (b ? 255 : 0)),
        maskHash = await tintStageHash(opaqueMask);
      const binding: FrameBinding = {
        id: frame.id,
        sourceRevision: frame.source.revision,
        sourceSha256: sourceHash,
        preparedSha256: await tintStageHash(actual.prepared),
        frameSha256: frameIdentity,
        uniformSha256: uniformHash,
        maskSha256: maskHash,
        profile: frame.profile,
      };
      const observedMean = {
        ...observedTintStageMean(tone.values, tone.mask),
        binding: { ...binding },
      };
      assertSameStageFrame(observedMean.binding, binding);
      partial.binding = binding;
      partial.observedMean = observedMean;
      const stages: Record<string, Awaited<ReturnType<typeof collect>>> = { tone: toneStage };
      for (const kind of [
        'postlight-r',
        'postlight-g',
        'postlight-b',
        'input-clamp',
        'old-target',
        'new-target',
        'target-clamp',
        'candidate',
      ] as const) {
        assertSameStageFrame(observedMean.binding, binding);
        const value = await collect(kind, observedMean.value);
        stages[kind] = value;
        if (kind === 'candidate') continue;
        const decoded = decodeTintStage(value.top, kind.startsWith('postlight-') ? 2 : 1);
        if (decoded.mask.some((v, i) => v !== tone.mask[i]))
          throw new Error(`tint-stage-mask-drift-${kind}`);
      }
      const oldTarget = decodeTintStage(stages['old-target'].top, 1).values,
        newTarget = decodeTintStage(stages['new-target'].top, 1).values;
      const envelope = styleTintEnvelope(fill, foreground),
        boundCode = encodeTintStage(envelope.luminanceBound);
      const samples: VetoSample[] = tone.values.map((t, i) => ({
        tone: t,
        oldTarget: oldTarget[i],
        newTarget: newTarget[i],
        opaque: tone.mask[i],
        low: stages['target-clamp'].top[i * 4] === 255,
        high: stages['target-clamp'].top[i * 4 + 1] === 255,
      }));
      let unresolvedTargetIntervals = 0;
      for (const s of samples)
        if (s.opaque) {
          const analytic = mapTintStage(
            s.tone,
            observedMean.value,
            boundCode,
            envelope.lightForeground
          );
          const error = 2 * TINT_STAGE_POLICY.toneError + TINT_STAGE_POLICY.targetError;
          if (
            Math.abs(analytic.baseline - s.oldTarget) > error ||
            Math.abs(analytic.candidate - s.newTarget) > error
          )
            throw new Error('tint-stage-target-arithmetic-mismatch');
          const lo = envelope.lightForeground ? 0 : boundCode,
            hi = envelope.lightForeground ? boundCode : 1;
          if (Math.abs(analytic.raw - lo) <= error || Math.abs(analytic.raw - hi) <= error)
            unresolvedTargetIntervals++;
          else if (analytic.low !== s.low || analytic.high !== s.high)
            throw new Error('tint-stage-clamp-flag-mismatch');
        }
      const costs = tintTextureCosts(samples, width, height, baseline.top, stages.candidate.top, {
        mean: observedMean.value,
        bound: boundCode,
        light: envelope.lightForeground,
      });
      stagePngs['whole-shape-clipping-map'] = rawPng(costs.clipMap, width, height);
      const { clipMap: _, ...costSummary } = costs;
      const candidate = await cropCarrier(stagePngs.candidate, frame);
      // Each row may be inspected later. Continuous-veto registration is fixed
      // separately below; real-background costs always use every shape pixel.
      return {
        ...common,
        evidenceKind: 'native-diagnostic',
        status: 'collected-native-diagnostic',
        candidateGeneralTransfer: TINT_STAGE_POLICY.candidateGeneralTransfer,
        material,
        candidate,
        binding,
        baselineReplay: 'byte-identical-raw-premultiplied-bottom-up',
        observedMean,
        safety: {
          baseline: verifyTintStageSafety(baseline.raw, fill, foreground),
          candidate: verifyTintStageSafety(stages.candidate.raw, fill, foreground),
        },
        gpu: stage.metadata,
        precision: {
          toneError: TINT_STAGE_POLICY.toneError,
          targetError: TINT_STAGE_POLICY.targetError,
          unresolvedTargetIntervals,
          unresolvedIsNotPass: true,
        },
        costs: costSummary,
        stagePngs,
        stageReceipts: receipts,
        postlightInputClamp: {
          lowPixels: samples.filter((s, i) => s.opaque && stages['input-clamp'].top[i * 4] === 255)
            .length,
          highPixels: samples.filter(
            (s, i) => s.opaque && stages['input-clamp'].top[i * 4 + 1] === 255
          ).length,
        },
        rampObservation: { width, height, samples },
        boundCode,
        lightForeground: envelope.lightForeground,
        diagnosticCost: {
          stageDraws: draws,
          stageReadbacks: draws,
          productionInternalReadbacks: actual.productionInternalReadbacks,
          captureReadbacks: actual.captureReadbacks,
          totalReadbacks: draws + actual.productionInternalReadbacks + actual.captureReadbacks,
          preparedBytesPerUpload: actual.prepared.length,
          preparedTextureUploads: 2,
          productionUploadedBytes: actual.uploadedBytes,
          stageUploadedBytes: actual.prepared.length + 8,
          totalUploadedBytes: actual.uploadedBytes + actual.prepared.length + 8,
          maximumLiveWebGLContexts: 2,
          productionDraws: actual.metrics.renders,
          totalDrawsIncludingProduction: draws + actual.metrics.renders,
          totalDiagnosticWallMilliseconds: performance.now() - start,
        },
      };
    } finally {
      stage.dispose();
    }
  } finally {
    actual.dispose();
  }
}
export const TINT_STAGE_RAMPS = TINT_STAGE_POLICY.rampDomains.flatMap(([low, high]) =>
  ([1, -1] as const).flatMap((direction) =>
    [true, false].map((lightForeground) => ({
      id: `ramp-${low}-${high}-${direction === 1 ? 'forward' : 'reverse'}-${lightForeground ? 'light' : 'dark'}-foreground`,
      low,
      high,
      direction,
      lightForeground,
    }))
  )
);
export type TintStageRamp = (typeof TINT_STAGE_RAMPS)[number];
type TintStageNativeReceipt = {
  evidenceKind?: string;
  status?: string;
  ramp?: { id: string };
  veto?: { verdict: string; intervals: readonly { side: string }[] };
  kernelExecution?: TintStageKernelReceipt;
};
/** Analytic rejection is unconditional; an observed native rejection is not.
 * Archived controls never count toward the 16 frozen + 12 ramp GPU obligations.
 */
export function summarizeTintStageNativeStatus(
  frozenTintedIds: readonly string[],
  coverage: Readonly<Record<string, { status: string; executed?: boolean }>>,
  results: ReadonlyMap<string, TintStageNativeReceipt>
) {
  const isHistorical = (result?: TintStageNativeReceipt) => {
    try {
      assertTintStageHistoricalKernelReceipt(result?.kernelExecution);
      return true;
    } catch {
      return false;
    }
  };
  const expectedIds = [...frozenTintedIds, ...TINT_STAGE_RAMPS.map((ramp) => ramp.id)];
  const allExpectedGpuEvidenceComplete =
    frozenTintedIds.length === 16 &&
    new Set(expectedIds).size === 28 &&
    expectedIds.every((id) => {
      const result = results.get(id);
      return (
        coverage[id]?.status === 'passed' &&
        coverage[id]?.executed === true &&
        result?.evidenceKind === 'native-diagnostic' &&
        result.status === 'collected-native-diagnostic' &&
        isHistorical(result)
      );
    });
  const allFullDomainEndpointVetoesConfirmed = TINT_STAGE_RAMPS.filter(
    (ramp) => ramp.low === 0 && ramp.high === 255
  ).every((ramp) => {
    const result = results.get(ramp.id);
    return (
      coverage[ramp.id]?.status === 'passed' &&
      coverage[ramp.id]?.executed === true &&
      result?.evidenceKind === 'native-diagnostic' &&
      result.status === 'collected-native-diagnostic' &&
      isHistorical(result) &&
      result.ramp?.id === ramp.id &&
      result.veto?.verdict === 'rejected-continuous-tone' &&
      ['low', 'high'].every((side) =>
        result.veto!.intervals.some((interval) => interval.side === side)
      )
    );
  });
  return {
    candidateStatus:
      allExpectedGpuEvidenceComplete && allFullDomainEndpointVetoesConfirmed
        ? TINT_STAGE_POLICY.expectedCompleteDiagnosticStatus
        : 'incomplete-native-diagnostic',
    allExpectedGpuEvidenceComplete,
    allFullDomainEndpointVetoesConfirmed,
  };
}
export async function runTintStageRamp(request: TintStageRamp) {
  const declared = TINT_STAGE_RAMPS.find((r) => r.id === request.id);
  if (!declared || JSON.stringify(declared) !== JSON.stringify(request))
    throw new Error('tint-stage-unregistered-ramp');
  const width = 256,
    height = 64;
  // Fixed 256 columns, one byte level per column on the full ramp; narrower
  // domains use nearest integer byte interpolation. Registration never fitted.
  const values = Array.from({ length: width }, (_, x) =>
    Math.round(
      request.low +
        ((request.high - request.low) * (request.direction === 1 ? x : width - 1 - x)) / (width - 1)
    )
  );
  assertMonotonicRamp(values, request.direction);
  const data = Uint8Array.from(
    Array.from({ length: height }, () => values.flatMap((v) => [v, v, v, 255])).flat()
  );
  const source = rawPng(data, width, height),
    fill = request.lightForeground ? [0, 97 / 255, 204 / 255, 1] : [0.9, 0.94, 1, 1],
    foreground = request.lightForeground ? [1, 1, 1, 1] : [0, 0, 0, 1];
  const frame: FrozenTintFrame = {
    id: request.id,
    sourceOrigin: 'predeclared-generated-ramp',
    control: 'tinted',
    phase: 0,
    theme: 'synthetic',
    part: 'kernel',
    content: 'continuous-ramp',
    head: TINT_STAGE_POLICY.originalHead,
    tree: TINT_STAGE_POLICY.originalTree,
    source: {
      revision: 1,
      width,
      height,
      pixelSha256: await tintStageHash(data),
      rect: { x: 0, y: 0, width, height },
    },
    geometry: { x: 0, y: 0, width, height },
    raster: { clip: { x: 0, y: 0, width, height }, hostOffset: { x: 0, y: 0 } },
    cells: [],
    exclusions: [],
    outset: 0,
    profile: TINT_PROFILE4_FIXTURE.contact.profile,
    contactPhase: 'rest',
    fill,
    foreground,
    files: {
      source: {
        file: `${request.id}-source.png`,
        sha256: await tintStageHash(pngBytes(source)),
        bytes: pngBytes(source).length,
      },
      'source-crop': {
        file: `${request.id}-source.png`,
        sha256: await tintStageHash(pngBytes(source)),
        bytes: pngBytes(source).length,
      },
    },
  };
  const result = await runTintStageFrame({ frame, pngs: { source, 'source-crop': source } });
  if (result.status === 'failed') return { ...result, ramp: request, sourcePng: source };
  if (
    !('rampObservation' in result) ||
    !result.rampObservation ||
    !('observedMean' in result) ||
    !result.observedMean
  )
    throw new Error('tint-stage-ramp-incomplete');
  // Interior centre row excludes the radius+one pixel at each end. The actual
  // postlighting observed range is reported, never equated to input 0..255.
  const y = 32,
    left = 33,
    right = 223;
  const samples: VetoSample[] = result.rampObservation.samples.slice(
    y * width + left,
    y * width + right
  );
  const veto = continuousTintVeto(
    samples,
    result.observedMean.value,
    result.boundCode!,
    result.lightForeground!,
    request.direction
  );
  return {
    ...result,
    ramp: request,
    sourcePng: source,
    registeredObservation: {
      x: left,
      y,
      width: right - left,
      height: 1,
      adjacency: 'horizontal immediate neighbors; contiguous intervals; direction predeclared',
      sourceWidth: width,
      sourceHeight: height,
      postlightToneMin: Math.min(...samples.map((s) => s.tone)),
      postlightToneMax: Math.max(...samples.map((s) => s.tone)),
    },
    veto,
  };
}
