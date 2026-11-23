/** Additive test-route-only diagnosis. No production profile, source admission,
 * component interaction or appearance acceptance is established by this module. */
import {
  createWebOpticalProgram,
  type OpticalFrame,
  type OpticalGeometry,
} from '../../../../../../packages/adapters/base/src/material/program';
import {
  styleTintFragment,
  styleTintContactFragment,
} from '../../../../../../packages/adapters/base/src/material/style-tint-profile';
import { opaqueRgba } from '../../../../../../packages/adapters/base/src/material/style';
import {
  TINT_STAGE_POLICY,
  tintStageHash,
  verifyTintStageSafety,
  type FrozenTintFrame,
} from './liquid-tint-stage-diagnostic';

export const REFRACTION_POLICY = Object.freeze({
  version: 'test-visible-refraction-3-profile6-capability-bound',
  productAccepted: false,
  evidenceKind: 'scripted-renderer-sequence',
  sourceAdmissionProved: false,
  nativeDpr: 1,
  maximumFixtures: 8,
  maximumFrames: 64,
  maximumDraws: 144,
  maximumMilliseconds: 12 * 60_000,
  maximumSourcePixels: 131072,
  baselineTree: '20bb2794c8ef1f71f6fac1ec649e033677c818cf',
  baselineMeaning:
    'historical profile5 increment input tree; not profile6, archived image origin or fresh GPU evidence',
  profile6BaselineHead: '49fc3ac3a5df6f6850795f25503940c5a2d0f2e8',
  profile6BaselineTree: '0d8d72af9c46232f38be26f7aaa73ec293b668c0',
  profile6ObservedFailureHead: '9b6448e339a474bca6a8fbaae4ad8c24c522a84c',
  shaderSha256: {
    static: '3ea77d2ca49dcc55fcb5155bdfa022268af628205e24b21a3bddfb45b2af675d',
    contact: '258d6bcfb58b828656561897289f7710600e8b041625235073bb62ae0f36da10',
  },
  comparison: 'same-source same-geometry same-float32-uniform strict-offset-zero',
  uncertainty: 'bounded correspondence resolution/ambiguity, not a statistical confidence interval',
  appearanceThreshold: null,
  preferenceAdmissionProved: false,
  matcher: {
    patchRadiusCss: 4,
    searchRadiusCss: 24,
    sampleStrideCss: 12,
    minimumNcc: 0.975,
    ambiguityGap: 0.015,
    forwardBackwardCss: 0.75,
    resolutionCss: 0.75,
  },
});
const rest = Object.freeze({ x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 0 });
export const REFRACTION_SEQUENCE = Object.freeze([
  { id: 'rest-before', milliseconds: 0, sourceShiftRasterX: 0, contact: rest },
  { id: 'press', milliseconds: 50, sourceShiftRasterX: 0, contact: { ...rest, strength: 0.5 } },
  { id: 'held', milliseconds: 120, sourceShiftRasterX: 0, contact: { ...rest, strength: 1 } },
  {
    id: 'drag-held',
    milliseconds: 180,
    sourceShiftRasterX: 0,
    contact: { ...rest, x: 0.65, deltaX: 0.55, strength: 1 },
  },
  { id: 'release', milliseconds: 240, sourceShiftRasterX: 0, contact: { ...rest, strength: 0.35 } },
  { id: 'rest-after', milliseconds: 360, sourceShiftRasterX: 0, contact: rest },
  { id: 'source-shift-only', milliseconds: 420, sourceShiftRasterX: 6, contact: rest },
] as const);
export type RefractionImage = { width: number; height: number; data: Uint8Array };
export type RefractionRegion = {
  x: number;
  y: number;
  band: 'edge' | 'interior';
  sector: string;
  centerDepthCss: number;
};
export type RefractionRequest = {
  frame: FrozenTintFrame;
  sourcePng: string;
  sourceKind: 'structured' | 'archived';
  sequenceIndex: number;
  staticProfile?: boolean;
};
const EARLY_OFFSET = 'vec2 offset = refractDir * offsetAmt * centreBlend;';
const FINAL_OFFSET = 'vec2 offset = finalOffset;';
const REFRACTED = 'vec2 refracted = mapped + offset - tiltOffset;';
const CHROMA = 'vec2 chroma = offset * u_aberration;';
// Preserve character positions so a comment can never supply a replacement anchor.
const shaderCode = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (comment) => comment.replace(/[^\r\n]/g, ' '));
/** The shader's magnification, chroma sampler branch, shape and lighting survive.
 * With zero offset, chroma is zero without changing u_aberration or its branch. */
export function strictWarpOffShader(source: string) {
  const code = shaderCode(source),
    earlyCount = code.split(EARLY_OFFSET).length - 1,
    finalCount = code.split(FINAL_OFFSET).length - 1;
  if (earlyCount + finalCount !== 1) throw new Error('refraction-unique-offset-required');
  const anchor = finalCount ? FINAL_OFFSET : EARLY_OFFSET,
    at = code.indexOf(anchor),
    tail = code.slice(at + anchor.length),
    mains = [...code.matchAll(/\bvoid\s+main\s*\(\s*\)\s*\{/g)];
  if (
    mains.length !== 1 ||
    mains[0].index >= at ||
    /\bsampleSource\s*\(|\btexture2D\s*\(\s*u_tex\b/.test(code.slice(mains[0].index, at)) ||
    code.split(REFRACTED).length !== 2 ||
    code.split(CHROMA).length !== 2 ||
    code.indexOf(REFRACTED) <= at ||
    code.indexOf(CHROMA) <= code.indexOf(REFRACTED) ||
    (code.match(/\boffset\b/g) ?? []).length !== 3 ||
    /\boffset\b/.test(code.replace(anchor, '').replace(REFRACTED, '').replace(CHROMA, ''))
  )
    throw new Error('refraction-offset-use-drift');
  if (finalCount) {
    const finalAssignment = 'finalOffset = oldOffset + budgetLambda * budgetDelta;';
    if (
      code.split('vec2 finalOffset = oldOffset;').length !== 2 ||
      code.split(finalAssignment).length !== 2 ||
      code.indexOf(finalAssignment) >= at ||
      /\bfinalOffset\b/.test(tail) ||
      !tail.trimStart().startsWith(REFRACTED)
    )
      throw new Error('refraction-final-offset-order-drift');
  } else if (/\b(?:finalOffset|oldOffset|budgetDelta|budgetLambda)\b/.test(code)) {
    throw new Error('refraction-early-offset-profile-drift');
  }
  return source.slice(0, at) + 'vec2 offset = vec2(0.0);' + source.slice(at + anchor.length);
}

type Observation<T> = { status: 'available'; value: T } | { status: 'unavailable'; reason: string };
function observe<T>(read: () => T, valid: (value: T) => boolean): Observation<T> {
  try {
    const value = read();
    return valid(value)
      ? { status: 'available', value }
      : { status: 'unavailable', reason: 'missing-or-invalid-query-result' };
  } catch (error) {
    return { status: 'unavailable', reason: String(error) };
  }
}
const validString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const PRECISION_SELECTION =
  /#ifdef\s+GL_FRAGMENT_PRECISION_HIGH\s+precision highp float;\s+#else\s+precision mediump float;\s+#endif/;
const probeSources = {
  control: 'precision mediump float;\nvoid main() { gl_FragColor = vec4(0.0); }',
  highp:
    '#ifndef GL_FRAGMENT_PRECISION_HIGH\nrefraction_expected_highp_branch_missing\n#endif\nprecision mediump float;\nvoid main() { gl_FragColor = vec4(0.0); }',
  mediump:
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nrefraction_expected_mediump_branch_missing\n#endif\nprecision mediump float;\nvoid main() { gl_FragColor = vec4(0.0); }',
};
/** Test-only, compile-only controls on the SAME context as the material draw.
 * No probe program, draw, uniform, texture or production shader is changed.
 * Precision reports alone do not identify a preprocessor branch. */
export async function collectRefractionCapabilities(gl: WebGLRenderingContext) {
  const stringParameter = (parameter: number) =>
    observe(() => gl.getParameter(parameter) as string, validString);
  const precision = (kind: number) =>
    observe(
      () => {
        const value = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, kind);
        return value
          ? {
              rangeMin: value.rangeMin,
              rangeMax: value.rangeMax,
              precision: value.precision,
              supported: value.precision > 0,
            }
          : null;
      },
      (value) =>
        value !== null &&
        [value.rangeMin, value.rangeMax, value.precision].every(
          (n) => Number.isInteger(n) && n >= 0
        )
    );
  const debugExtension = observe(
    () => gl.getExtension('WEBGL_debug_renderer_info'),
    (value) =>
      value !== null &&
      value !== undefined &&
      Number.isInteger(value.UNMASKED_RENDERER_WEBGL) &&
      Number.isInteger(value.UNMASKED_VENDOR_WEBGL)
  );
  const debugRenderer =
    debugExtension.status === 'available'
      ? {
          status: 'available' as const,
          renderer: stringParameter(debugExtension.value!.UNMASKED_RENDERER_WEBGL),
          vendor: stringParameter(debugExtension.value!.UNMASKED_VENDOR_WEBGL),
        }
      : { status: 'unavailable' as const, reason: debugExtension.reason };
  const probes = await Promise.all(
    Object.entries(probeSources).map(async ([branch, source]) => {
      let shader: WebGLShader | null = null;
      const compiled = observe(
        () => {
          shader = gl.createShader(gl.FRAGMENT_SHADER);
          if (!shader) throw new Error('refraction-probe-shader-unavailable');
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          return gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
        },
        (value) => typeof value === 'boolean'
      );
      const log = shader
        ? observe(
            () => gl.getShaderInfoLog(shader!),
            (value) => typeof value === 'string'
          )
        : null;
      if (shader) gl.deleteShader(shader);
      return { branch, sourceSha256: await tintStageHash(source), compiled, log };
    })
  );
  const compiled = (name: string) => {
    const observed = probes.find((p) => p.branch === name)!.compiled;
    return observed.status === 'available' ? observed.value : null;
  };
  const contextLost = observe(
    () => gl.isContextLost(),
    (value) => typeof value === 'boolean'
  );
  const selectedBranch =
    contextLost.status === 'available' && !contextLost.value && compiled('control') === true
      ? compiled('highp') === true && compiled('mediump') === false
        ? 'highp'
        : compiled('highp') === false && compiled('mediump') === true
          ? 'mediump'
          : 'unknown'
      : 'unknown';
  return {
    scope: 'same-owned-material-canvas-context',
    requestedContext: 'webgl',
    version: stringParameter(gl.VERSION),
    shadingLanguageVersion: stringParameter(gl.SHADING_LANGUAGE_VERSION),
    renderer: stringParameter(gl.RENDERER),
    vendor: stringParameter(gl.VENDOR),
    fragmentPrecision: {
      HIGH_FLOAT: precision(gl.HIGH_FLOAT),
      MEDIUM_FLOAT: precision(gl.MEDIUM_FLOAT),
    },
    debugRenderer,
    contextLost,
    branchProbe: {
      method: 'same-context-complementary-preprocessor-compile-controls',
      selectedBranch,
      status: selectedBranch === 'unknown' ? 'unknown' : 'identified',
      probes,
      draws: 0,
      interpretation:
        'Compiler conditional selection only; no probe draw, arithmetic accuracy or real-device performance claim',
    },
  };
}

/** Bind the compile observation to the actual submitted production fragment. */
export async function bindRefractionCapability(
  capabilities: Awaited<ReturnType<typeof collectRefractionCapabilities>>,
  originalSource: string,
  actualSource: string,
  compiled: boolean | null,
  linked: boolean | null
) {
  const branch = capabilities.branchProbe.selectedBranch,
    sourceGuardRecognized =
      PRECISION_SELECTION.test(shaderCode(actualSource)) &&
      !/^\s*#\s*(?:define|undef)\s+GL_FRAGMENT_PRECISION_HIGH\b/m.test(shaderCode(actualSource)),
    identified =
      sourceGuardRecognized && compiled === true && linked === true && branch !== 'unknown';
  return {
    capabilitySha256: await tintStageHash(JSON.stringify(capabilities)),
    originalShaderSha256: await tintStageHash(originalSource),
    actualShaderSha256: await tintStageHash(actualSource),
    sourceGuardRecognized,
    compiled,
    linked,
    status: identified ? 'identified' : 'unknown',
    selectedPrecisionBranch: identified ? branch : 'unknown',
    offsetControl: /\bvec2 offset = vec2\(0\.0\);/.test(shaderCode(actualSource))
      ? 'strict-final-offset-zero'
      : [FINAL_OFFSET, EARLY_OFFSET].some((anchor) => shaderCode(actualSource).includes(anchor))
        ? 'production-offset'
        : 'unknown',
    refractionBranch:
      identified && shaderCode(originalSource).includes(FINAL_OFFSET)
        ? branch === 'highp'
          ? 'profile5-budgeted-shoulder'
          : 'profile5-retained-old-offset'
        : 'unknown',
    interpretation:
      'Same-context compile selection bound to submitted fragment and link status; no claim that every fragment reaches the offset expression',
  };
}
/** Predeclared moderate-tone straight grid plus asymmetric rectangular landmarks.
 * Fixed before rendering or measurement; no noise or response-dependent contrast. */
export function structuredRefractionSource(
  width: number,
  height: number,
  dpr = 1
): RefractionImage {
  const data = new Uint8Array(width * height * 4);
  const landmarks = [
    [19, 17, 9, 7],
    [46, 29, 12, 5],
    [75, 47, 7, 11],
    [103, 15, 8, 9],
    [137, 37, 11, 7],
    [174, 23, 6, 12],
    [211, 51, 13, 6],
    [252, 31, 8, 10],
    [291, 62, 11, 7],
  ];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const xx = x / dpr,
        yy = y / dpr;
      let color = [201, 210, 222];
      if (Math.floor(xx) % 23 < 2) color = [118, 137, 164];
      if (Math.floor(yy) % 17 < 2) color = [145, 157, 178];
      for (const [lx, ly, w, h] of landmarks)
        if (xx >= lx && xx < lx + w && yy % 71 >= ly && yy % 71 < ly + h) color = [94, 115, 143];
      const at = (y * width + x) * 4;
      data.set([...color, 255], at);
    }
  return { width, height, data };
}
export function refractionRegions(
  geometry: OpticalGeometry,
  exclusions: { x: number; y: number; width: number; height: number }[]
): RefractionRegion[] {
  const { width, height, radius, dpr } = geometry,
    outset = geometry.paintOutset ?? 0;
  const regions: RefractionRegion[] = [];
  for (let y = 5; y < height - 4; y += 6)
    for (let x = 5; x < width - 4; x += 12) {
      const qx = Math.max(Math.abs(x - width / 2) - width / 2 + radius, 0),
        qy = Math.max(Math.abs(y - height / 2) - height / 2 + radius, 0);
      const depth = Math.min(
        x,
        width - x,
        y,
        height - y,
        radius ? radius - Math.hypot(qx, qy) : Infinity
      );
      if (
        depth < 1 ||
        exclusions.some(
          (r) => x + 4 >= r.x && x - 4 <= r.x + r.width && y + 4 >= r.y && y - 4 <= r.y + r.height
        )
      )
        continue;
      regions.push({
        x: (x + outset) * dpr,
        y: (y + outset) * dpr,
        band: depth <= 8 ? 'edge' : 'interior',
        centerDepthCss: depth,
        sector: `${Math.floor((3 * x) / width)}:${y < height / 2 ? 'top' : 'bottom'}`,
      });
    }
  return regions;
}
const median = (values: number[]) =>
  values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0;
function luma(image: RefractionImage) {
  const out = new Float32Array(image.width * image.height);
  for (let i = 0; i < out.length; i++)
    out[i] =
      image.data[i * 4] * 0.2126 + image.data[i * 4 + 1] * 0.7152 + image.data[i * 4 + 2] * 0.0722;
  return out;
}
function sample(a: Float32Array, w: number, x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    dx = x - ix,
    dy = y - iy;
  return (
    (a[iy * w + ix] * (1 - dx) + a[iy * w + ix + 1] * dx) * (1 - dy) +
    (a[(iy + 1) * w + ix] * (1 - dx) + a[(iy + 1) * w + ix + 1] * dx) * dy
  );
}
function patch(image: RefractionImage, light: Float32Array, x: number, y: number, dpr: number) {
  const r = REFRACTION_POLICY.matcher.patchRadiusCss * dpr;
  if (x - r < 0 || y - r < 0 || x + r + 1 >= image.width || y + r + 1 >= image.height) return null;
  const values: number[] = [];
  for (let dy = -r; dy <= r; dy += dpr)
    for (let dx = -r; dx <= r; dx += dpr) {
      const px = Math.floor(x + dx),
        py = Math.floor(y + dy);
      for (const iy of [py, py + 1])
        for (const ix of [px, px + 1])
          if (image.data[(iy * image.width + ix) * 4 + 3] !== 255) return null;
      values.push(sample(light, image.width, x + dx, y + dy));
    }
  const mean = values.reduce((a, b) => a + b, 0) / values.length,
    norm = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0));
  if (norm / Math.sqrt(values.length) < 1) return null;
  return values.map((v) => (v - mean) / norm);
}
function findPatch(
  source: RefractionImage,
  target: RefractionImage,
  sl: Float32Array,
  tl: Float32Array,
  x: number,
  y: number,
  dpr: number
) {
  const a = patch(source, sl, x, y, dpr);
  if (!a) return null;
  const candidates: { dx: number; dy: number; score: number }[] = [];
  const score = (dx: number, dy: number) => {
    const b = patch(target, tl, x + dx * dpr, y + dy * dpr, dpr);
    if (!b) return;
    candidates.push({ dx, dy, score: a.reduce((s, v, i) => s + v * b[i], 0) });
  };
  const radius = REFRACTION_POLICY.matcher.searchRadiusCss;
  for (let dy = -radius; dy <= radius; dy += 1)
    for (let dx = -radius; dx <= radius; dx += 1) score(dx, dy);
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const coarse = candidates[0];
  for (let dy = coarse.dy - 1; dy <= coarse.dy + 1; dy += 0.5)
    for (let dx = coarse.dx - 1; dx <= coarse.dx + 1; dx += 0.5)
      if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) score(dx, dy);
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const competitor = candidates.find((c) => Math.hypot(c.dx - best.dx, c.dy - best.dy) > 2);
  const ambiguity = competitor ? best.score - competitor.score : 1;
  const plateau = candidates.filter((c) => best.score - c.score < 0.003);
  const uncertainty = Math.max(
    REFRACTION_POLICY.matcher.resolutionCss,
    ...plateau.map((c) => Math.hypot(c.dx - best.dx, c.dy - best.dy))
  );
  if (
    best.score < REFRACTION_POLICY.matcher.minimumNcc ||
    ambiguity < REFRACTION_POLICY.matcher.ambiguityGap ||
    uncertainty > 1.5 ||
    Math.abs(best.dx) >= radius ||
    Math.abs(best.dy) >= radius
  )
    return null;
  return { ...best, ambiguity, uncertainty };
}
/** Normalized spatial correspondence; no RGB difference is called refraction.
 * Full affine registration (translation, rotation, scale and shear) is fitted out. Untextured, ambiguous, nonopaque,
 * out-of-range and inconsistent patches remain explicitly unmeasured. */
export function measureRefractionCorrespondence(
  a: RefractionImage,
  b: RefractionImage,
  regions: RefractionRegion[],
  dpr = 1
) {
  if (!Number.isFinite(dpr) || dpr <= 0) throw new Error('refraction-invalid-dpr');
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    a.data.length !== a.width * a.height * 4 ||
    b.data.length !== b.width * b.height * 4
  )
    throw new Error('refraction-invalid-dimensions');
  const al = luma(a),
    bl = luma(b),
    tracks: any[] = [];
  for (const r of regions) {
    const forward = findPatch(a, b, al, bl, r.x, r.y, dpr);
    if (!forward) continue;
    const back = findPatch(b, a, bl, al, r.x + forward.dx * dpr, r.y + forward.dy * dpr, dpr);
    if (!back) continue;
    const closure = Math.hypot(forward.dx + back.dx, forward.dy + back.dy);
    if (closure > REFRACTION_POLICY.matcher.forwardBackwardCss) continue;
    tracks.push({
      ...r,
      dx: forward.dx,
      dy: forward.dy,
      ncc: forward.score,
      ambiguity: forward.ambiguity,
      uncertaintyCss: Math.max(forward.uncertainty, back.uncertainty, closure),
    });
  }
  const n = tracks.length,
    mean = (key: string) => tracks.reduce((sum, t) => sum + t[key], 0) / Math.max(1, n);
  const cx = mean('x') / dpr,
    cy = mean('y') / dpr,
    tx = mean('dx'),
    ty = mean('dy');
  let xx = 0,
    xy = 0,
    yy = 0,
    xdx = 0,
    ydx = 0,
    xdy = 0,
    ydy = 0;
  for (const t of tracks) {
    const x = t.x / dpr - cx,
      y = t.y / dpr - cy;
    xx += x * x;
    xy += x * y;
    yy += y * y;
    xdx += x * (t.dx - tx);
    ydx += y * (t.dx - tx);
    xdy += x * (t.dy - ty);
    ydy += y * (t.dy - ty);
  }
  const determinant = xx * yy - xy * xy,
    affineIdentifiable = determinant > 1e-6;
  const coefficients = affineIdentifiable
    ? [
        (xdx * yy - ydx * xy) / determinant,
        (ydx * xx - xdx * xy) / determinant,
        (xdy * yy - ydy * xy) / determinant,
        (ydy * xx - xdy * xy) / determinant,
      ]
    : [0, 0, 0, 0];
  for (const t of tracks) {
    const x = t.x / dpr - cx,
      y = t.y / dpr - cy;
    t.nonrigidCss = Math.hypot(
      t.dx - (tx + coefficients[0] * x + coefficients[1] * y),
      t.dy - (ty + coefficients[2] * x + coefficients[3] * y)
    );
    t.resolvedLowerCss = Math.max(0, t.nonrigidCss - t.uncertaintyCss);
  }
  const nonrigidRmsCss = Math.sqrt(
    tracks.reduce((sum, t) => sum + t.nonrigidCss ** 2, 0) / Math.max(1, n)
  );
  const enough = affineIdentifiable && n >= 6 && new Set(tracks.map((t) => t.sector)).size >= 3;
  const resolved =
    enough &&
    tracks.filter((t) => t.resolvedLowerCss > 0).length >= 3 &&
    nonrigidRmsCss > 1.2 * median(tracks.map((t) => t.uncertaintyCss));
  const bands = Object.fromEntries(
    ['edge', 'interior'].map((band) => {
      const selected = tracks.filter((t) => t.band === band);
      return [
        band,
        {
          status:
            selected.length < 6 ? 'insufficient-spatial-signal' : 'sampled-correspondences-only',
          planned: regions.filter((r) => r.band === band).length,
          accepted: selected.length,
          centerDepthCss: selected.length
            ? [
                Math.min(...selected.map((t) => t.centerDepthCss)),
                Math.max(...selected.map((t) => t.centerDepthCss)),
              ]
            : null,
          nonrigidRmsCss: selected.length
            ? Math.sqrt(selected.reduce((sum, t) => sum + t.nonrigidCss ** 2, 0) / selected.length)
            : null,
          medianUncertaintyCss: selected.length
            ? median(selected.map((t) => t.uncertaintyCss))
            : null,
        },
      ];
    })
  );
  return {
    verdict: !enough
      ? 'insufficient-spatial-signal'
      : resolved
        ? 'resolved-nonrigid-correspondence'
        : 'no-resolved-nonrigid-displacement',
    support: {
      outerRimCss: [0, 4],
      outerRimStatus: 'unmeasured-by-correspondence',
      patchRequires: 'fully opaque 9 by 9 CSS-pixel support',
      fullShapeAbsenceProved: false,
    },
    plannedTracks: regions.length,
    acceptedTracks: n,
    rejectedTracks: regions.length - n,
    nonrigidRmsCss: enough ? nonrigidRmsCss : null,
    affineRegistration: {
      translationCss: [tx, ty],
      centerCss: [cx, cy],
      displacementCoefficients: coefficients,
      identifiable: affineIdentifiable,
    },
    bands,
    tracks,
    productAccepted: false,
  };
}
export function refractionCollectionBudget(observedDraws: number, now: number, deadline: number) {
  if (
    !Number.isInteger(observedDraws) ||
    observedDraws < 0 ||
    observedDraws > REFRACTION_POLICY.maximumDraws
  )
    throw new Error('refraction-material-draw-budget-exhausted');
  if (![now, deadline].every(Number.isFinite) || now >= deadline)
    throw new Error('refraction-12-minute-budget-exhausted');
  return Math.min(15_000, deadline - now);
}
export function terminalRefractionCoverage<T extends { status: string; executed?: boolean }>(
  coverage: Record<string, T>
) {
  return Object.fromEntries(
    Object.entries(coverage).map(([id, row]) => [
      id,
      {
        ...row,
        status:
          row.status === 'running'
            ? 'interrupted'
            : row.status === 'not-run'
              ? 'blocked'
              : row.status,
      },
    ])
  );
}
export function summarizeRefractionCoverage(
  ids: string[],
  coverage: Record<string, { status: string; executed?: boolean }>
) {
  const records = ids.map((id) => coverage[id]);
  const executed = records.filter((r) => r?.executed === true).length;
  return {
    status:
      records.length && records.every((r) => r?.status === 'passed' && r.executed === true)
        ? 'collected-native-diagnostic'
        : executed === 0 && records.every((r) => r?.status === 'blocked')
          ? 'blocked-before-native-execution'
          : 'incomplete-native-diagnostic',
    planned: ids.length,
    executed,
    productAccepted: false,
  };
}
export function summarizeRefractionSequence(records: Record<string, any>) {
  const observations = REFRACTION_SEQUENCE.map((step) => {
    const row = records[step.id];
    return {
      id: step.id,
      scriptTimestampMs: step.milliseconds,
      status: row?.status ?? 'missing',
      sourceSha256: row?.sourceSha256 ?? null,
      materialHashes: Object.fromEntries(
        ['baseline', 'strict-warp-off'].map((mode) => [
          mode,
          row?.captures?.find((capture: any) => capture.mode === mode)?.rawReadbackSha256 ?? null,
        ])
      ),
    };
  });
  if (
    observations.some(
      (row) =>
        row.status !== 'collected-native-diagnostic' ||
        !row.materialHashes.baseline ||
        !row.materialHashes['strict-warp-off']
    )
  )
    return {
      status: 'incomplete',
      observations,
      restRestored: null,
      isolatedSourceTranslation: null,
      productAccepted: false,
    };
  const before = records['rest-before'],
    after = records['rest-after'],
    shifted = records['source-shift-only'];
  const sameRenderInputs = (a: any, b: any) =>
    JSON.stringify(a.geometry) === JSON.stringify(b.geometry) &&
    JSON.stringify(a.sequence.contact) === JSON.stringify(b.sequence.contact) &&
    ['baseline', 'strict-warp-off'].every((mode) => {
      const ac = a.captures.find((c: any) => c.mode === mode),
        bc = b.captures.find((c: any) => c.mode === mode);
      return (
        ac.shaderPath === bc.shaderPath &&
        JSON.stringify(ac.uniforms) === JSON.stringify(bc.uniforms)
      );
    });
  const restRestored =
    before.sourceSha256 === after.sourceSha256 &&
    sameRenderInputs(before, after) &&
    JSON.stringify(observations[0].materialHashes) ===
      JSON.stringify(observations[5].materialHashes);
  const isolatedSourceTranslation =
    after.sourceSha256 !== shifted.sourceSha256 && sameRenderInputs(after, shifted);
  return {
    status: restRestored && isolatedSourceTranslation ? 'complete' : 'failed',
    observations,
    restRestored,
    isolatedSourceTranslation,
    interpretation:
      'held/drag/release hashes are observations, not a minimum visible magnitude or real interaction claim',
    productAccepted: false,
  };
}
function topDown(data: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < h; y++)
    out.set(data.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  return out;
}
function imageCanvas(image: RefractionImage) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas
    .getContext('2d')!
    .putImageData(
      new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
      0,
      0
    );
  return canvas;
}
function translated(image: RefractionImage, dx: number) {
  const data = new Uint8Array(image.data.length);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + Math.max(0, x - dx)) * 4;
      data.set(image.data.subarray(from, from + 4), (y * image.width + x) * 4);
    }
  return { ...image, data };
}
async function decode(uri: string) {
  const image = new Image();
  image.src = uri;
  await image.decode();
  const c = document.createElement('canvas');
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return {
    width: c.width,
    height: c.height,
    data: new Uint8Array(ctx.getImageData(0, 0, c.width, c.height).data),
  };
}
type Mode = 'baseline' | 'strict-warp-off' | 'zero-aberration' | 'total-zero-refraction';
/** Only the owned context instance is instrumented. All methods are restored. */
async function capture(frame: OpticalFrame, mode: Mode) {
  const canvas = document.createElement('canvas'),
    gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
  if (!gl) throw new Error('refraction-webgl-unavailable');
  const capabilities = await collectRefractionCapabilities(gl);
  const restores: (() => void)[] = [],
    locations = new Map<WebGLUniformLocation, string>(),
    uniforms: Record<string, unknown> = {},
    floatReadback: Record<string, unknown> = {},
    optimizedOut: string[] = [],
    shaders: {
      shader: WebGLShader;
      original: string;
      actual: string;
      kind: number;
      compiled: boolean | null;
    }[] = [];
  let readbacks = 0,
    draws = 0,
    prepared: Uint8Array | undefined,
    unit = gl.TEXTURE0,
    renderFailure: string | null = null,
    png: string | null = null;
  const wrap = (name: string, fn: (original: any, args: any[]) => any) => {
    const original = (gl as any)[name];
    (gl as any)[name] = (...args: any[]) => fn(original, args);
    restores.push(() => {
      (gl as any)[name] = original;
    });
  };
  wrap('shaderSource', (original, args) => {
    const kind = gl.getShaderParameter(args[0], gl.SHADER_TYPE),
      source = args[1];
    if (kind === gl.FRAGMENT_SHADER) {
      const expected = frame.contact ? styleTintContactFragment : styleTintFragment;
      if (source !== expected) throw new Error('refraction-baseline-shader-drift');
      if (mode === 'strict-warp-off') args[1] = strictWarpOffShader(source);
    }
    shaders.push({ shader: args[0], original: source, actual: args[1], kind, compiled: null });
    return original.apply(gl, args);
  });
  wrap('compileShader', (original, args) => {
    const result = original.apply(gl, args),
      receipt = shaders.find((s) => s.shader === args[0]);
    if (receipt) {
      const compiled = gl.getShaderParameter(args[0], gl.COMPILE_STATUS);
      receipt.compiled = typeof compiled === 'boolean' ? compiled : null;
    }
    return result;
  });
  wrap('getUniformLocation', (original, args) => {
    const result = original.apply(gl, args);
    if (result) locations.set(result, args[1]);
    else optimizedOut.push(args[1]);
    return result;
  });
  for (const name of ['uniform1f', 'uniform1i', 'uniform2fv', 'uniform4fv'])
    wrap(name, (original, args) => {
      const key = locations.get(args[0]);
      if (key)
        uniforms[key] = {
          method: name,
          value: (typeof args[1] === 'number' ? [args[1]] : Array.from(args[1])).map((v: any) =>
            name === 'uniform1i' ? v : Math.fround(v)
          ),
        };
      return original.apply(gl, args);
    });
  wrap('activeTexture', (original, args) => {
    unit = args[0];
    return original.apply(gl, args);
  });
  wrap('texImage2D', (original, args) => {
    if (
      unit === gl.TEXTURE0 &&
      args.length === 9 &&
      args[3] === frame.source.width &&
      args[4] === frame.source.height &&
      args[8] instanceof Uint8Array
    )
      prepared = new Uint8Array(args[8]);
    return original.apply(gl, args);
  });
  wrap('drawArrays', (original, args) => {
    draws++;
    return original.apply(gl, args);
  });
  wrap('readPixels', (original, args) => {
    readbacks++;
    return original.apply(gl, args);
  });
  const expectedShaderHash = frame.contact
    ? REFRACTION_POLICY.shaderSha256.contact
    : REFRACTION_POLICY.shaderSha256.static;
  if (
    (await tintStageHash(frame.contact ? styleTintContactFragment : styleTintFragment)) !==
    expectedShaderHash
  ) {
    for (const restore of restores.reverse()) restore();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    throw new Error('refraction-frozen-shader-hash-drift');
  }
  const program = createWebOpticalProgram(
    canvas,
    mode === 'zero-aberration'
      ? 'zero-aberration'
      : mode === 'total-zero-refraction'
        ? 'zero-refraction'
        : null
  );
  try {
    try {
      png = program.render(frame);
    } catch (error) {
      renderFailure = String(error);
    }
    const productionReadbacks = readbacks;
    const raw = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)
      throw new Error('refraction-readback-failed');
    if (!prepared) throw new Error('refraction-missing-prepared-source');
    const active = gl.getParameter(gl.CURRENT_PROGRAM);
    for (const [location, name] of locations) {
      const expected = uniforms[name] as any;
      if (!expected) continue;
      const actual = gl.getUniform(active, location),
        values =
          typeof actual === 'number' || typeof actual === 'boolean'
            ? [Number(actual)]
            : Array.from(actual as number[]);
      floatReadback[name] = values;
      if (JSON.stringify(values) !== JSON.stringify(expected.value))
        throw new Error(`refraction-uniform-readback-${name}`);
    }
    const image = {
      width: canvas.width,
      height: canvas.height,
      data: topDown(raw, canvas.width, canvas.height),
    };
    let safety: unknown;
    try {
      safety = verifyTintStageSafety(raw, frame.fill, frame.foreground);
    } catch (error) {
      safety = { failure: String(error) };
      renderFailure ??= String(error);
    }
    return {
      mode,
      status: renderFailure ? 'render-refused' : 'rendered',
      renderFailure,
      image,
      png: png ?? canvas.toDataURL('image/png'),
      pngRole: renderFailure
        ? 'refused-frame-debug-native-canvas-encoding'
        : 'successful-native-material-canvas-encoding',
      preparedSha256: await tintStageHash(prepared),
      rawReadbackSha256: await tintStageHash(raw),
      rawReadback: Array.from(raw),
      rawReadbackLayout: 'bottom-up premultiplied RGBA8',
      topDownSha256: await tintStageHash(image.data),
      uniforms,
      floatReadback,
      optimizedOut,
      capabilities,
      shaders: await Promise.all(
        shaders.map(async (s) => ({
          kind: s.kind,
          originalSha256: await tintStageHash(s.original),
          actualSha256: await tintStageHash(s.actual),
          compiled: s.compiled,
          capabilityBinding:
            s.kind === gl.FRAGMENT_SHADER
              ? await bindRefractionCapability(
                  capabilities,
                  s.original,
                  s.actual,
                  s.compiled,
                  active ? gl.getProgramParameter(active, gl.LINK_STATUS) : null
                )
              : null,
        }))
      ),
      shaderPath: frame.contact ? 'styleTintContactFragment' : 'styleTintFragment',
      productionReadbacks,
      captureReadbacks: readbacks - productionReadbacks,
      draws,
      metrics: program.inspect(),
      safety,
    };
  } finally {
    for (const restore of restores.reverse()) restore();
    program.dispose();
  }
}
function assertMatched(
  a: Awaited<ReturnType<typeof capture>>,
  b: Awaited<ReturnType<typeof capture>>
) {
  if (
    a.preparedSha256 !== b.preparedSha256 ||
    a.image.width !== b.image.width ||
    a.image.height !== b.image.height
  )
    throw new Error('refraction-unmatched-source-or-geometry');
  // Optimization may remove uniforms used solely in the zeroed expression. Every
  // surviving readback must equal production; removed names remain in receipt.
  for (const [name, value] of Object.entries(b.uniforms))
    if (JSON.stringify(value) !== JSON.stringify(a.uniforms[name]))
      throw new Error(`refraction-unmatched-uniform-${name}`);
  const magnify = (b.floatReadback.u_magnify as number[] | undefined)?.[0];
  if (!(magnify && magnify > 1)) throw new Error('refraction-magnification-control-drift');
  if (
    a.shaderPath === 'styleTintContactFragment' &&
    !((b.floatReadback.u_aberration as number[] | undefined)?.[0]! > 0)
  )
    throw new Error('refraction-aberration-branch-control-drift');
  for (let i = 3; i < a.image.data.length; i += 4)
    if (a.image.data[i] !== b.image.data[i]) throw new Error('refraction-unmatched-shape');
}
async function contextPng(source: RefractionImage, png: string, frame: FrozenTintFrame) {
  const c = imageCanvas(source),
    ctx = c.getContext('2d')!,
    image = new Image();
  image.src = png;
  await image.decode();
  const sx = source.width / frame.source.rect.width,
    sy = source.height / frame.source.rect.height;
  ctx.drawImage(
    image,
    (frame.geometry.x - frame.source.rect.x - frame.outset) * sx,
    (frame.geometry.y - frame.source.rect.y - frame.outset) * sy,
    (frame.geometry.width + 2 * frame.outset) * sx,
    (frame.geometry.height + 2 * frame.outset) * sy
  );
  return c.toDataURL();
}
export async function runVisibleRefractionFrame(request: RefractionRequest) {
  const started = performance.now(),
    { frame, sourceKind } = request,
    step = REFRACTION_SEQUENCE[request.sequenceIndex];
  if (window.devicePixelRatio !== 1) throw new Error('refraction-native-dpr-must-be-one');
  if (
    !step ||
    (request.staticProfile && request.sequenceIndex !== 0) ||
    !['structured', 'archived'].includes(sourceKind) ||
    frame.control !== 'tinted' ||
    frame.content !== 'text' ||
    !['button', 'submit'].includes(frame.part) ||
    !['light', 'dark'].includes(frame.theme)
  )
    throw new Error('refraction-invalid-fixed-case');
  if (
    frame.head !== TINT_STAGE_POLICY.originalHead ||
    frame.tree !== TINT_STAGE_POLICY.originalTree
  )
    throw new Error('refraction-frozen-provenance-drift');
  if (!opaqueRgba(frame.fill) || !opaqueRgba(frame.foreground))
    throw new Error('refraction-invalid-palette');
  const bytes = Uint8Array.from(atob(request.sourcePng.split(',')[1]), (c) => c.charCodeAt(0));
  if ((await tintStageHash(bytes)) !== frame.files.source.sha256)
    throw new Error('refraction-source-png-drift');
  const archived = await decode(request.sourcePng);
  if (
    archived.width !== frame.source.width ||
    archived.height !== frame.source.height ||
    (await tintStageHash(archived.data)) !== frame.source.pixelSha256
  )
    throw new Error('refraction-source-pixels-drift');
  if (archived.width * archived.height > REFRACTION_POLICY.maximumSourcePixels)
    throw new Error('refraction-source-budget');
  const original =
    sourceKind === 'structured'
      ? structuredRefractionSource(archived.width, archived.height)
      : archived;
  const source = step.sourceShiftRasterX ? translated(original, step.sourceShiftRasterX) : original;
  const geometry: OpticalGeometry = {
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
  };
  const regions = refractionRegions(geometry, frame.exclusions);
  // Hash the fixed source/ROI binding before any render or measured response.
  const sourceSha256 = await tintStageHash(source.data),
    regionsSha256 = await tintStageHash(JSON.stringify(regions));
  const optical: OpticalFrame = {
    source: {
      revision: frame.source.revision + (step.sourceShiftRasterX ? 1 : 0),
      width: source.width,
      height: source.height,
      pixels: source.data,
      canvas: imageCanvas(source),
      scope: document.createElement('div'),
    },
    geometry,
    pressed: false,
    ...(request.staticProfile ? {} : { contact: step.contact }),
    variant: 'regular',
    tint: 'style-fill',
    fill: frame.fill,
    foreground: frame.foreground,
  };
  const modes: Mode[] = [
    'baseline',
    'strict-warp-off',
    ...(!request.staticProfile && request.sequenceIndex === 0
      ? (['zero-aberration', 'total-zero-refraction'] as Mode[])
      : []),
  ];
  const captures: Awaited<ReturnType<typeof capture>>[] = [];
  for (const mode of modes) captures.push(await capture(optical, mode));
  const [baseline, off] = captures;
  assertMatched(baseline, off);
  const measurement =
    baseline.status === 'rendered' && off.status === 'rendered'
      ? measureRefractionCorrespondence(off.image, baseline.image, regions)
      : null;
  const frameBindingSha256 = await tintStageHash(
    JSON.stringify({
      sourceSha256,
      geometry,
      regionsSha256,
      contact: optical.contact ?? null,
      fill: optical.fill,
      foreground: optical.foreground,
      variant: optical.variant,
      tint: optical.tint,
    })
  );
  const pngs: Record<string, string> = { source: imageCanvas(source).toDataURL() };
  for (const c of captures) {
    pngs[c.mode] = c.png;
    pngs[`${c.mode}-context`] = await contextPng(source, c.png, frame);
  }
  return {
    status: captures.some((c) => c.status !== 'rendered')
      ? 'render-refused'
      : 'collected-native-diagnostic',
    evidenceKind: 'scripted-renderer-sequence',
    productAccepted: false,
    sourceAdmissionProved: false,
    componentInteractionProved: false,
    preferenceAdmissionProved: false,
    sourceKind,
    frameId: frame.id,
    sequence: request.staticProfile ? 'fixed-static-profile' : step,
    scriptTimestampMs: step.milliseconds,
    sourceTranslation: {
      rasterPixelsX: step.sourceShiftRasterX,
      cssPixelsX: (step.sourceShiftRasterX * frame.source.rect.width) / source.width,
      units: 'source raster pixels converted by frozen CSS-rect/raster ratio',
    },
    wallClockTimestamp: new Date().toISOString(),
    actualTimestampMs: performance.now(),
    elapsedMilliseconds: performance.now() - started,
    nativeDpr: 1,
    sourceSha256,
    frameBindingSha256,
    originalSourceSha256: await tintStageHash(original.data),
    archivedSource: frame.source,
    rendererSourceRevision: optical.source.revision,
    rendererSourceRevisionKind:
      'synthetic diagnostic snapshot revision; unchanged across contact-only states',
    originalHead: frame.head,
    originalTree: frame.tree,
    originalProvenanceMeaning:
      'archived source image/frame inputs only; not the candidate profile6 shader origin',
    executedShaderProvenance: {
      profile: request.staticProfile
        ? 'pui-regular-style-tint-6'
        : 'pui-regular-style-tint-contact-6',
      expectedSha256: request.staticProfile
        ? REFRACTION_POLICY.shaderSha256.static
        : REFRACTION_POLICY.shaderSha256.contact,
      candidateBinding:
        'official collector candidate SHA/tree and patch hash in this frame receipt',
      originalSourceAndActualControlHashes: 'captures[].shaders[]',
    },
    geometry,
    regions,
    regionsSha256,
    measurement,
    controlPurity: 'strict-offset-zero-only; magnification and aberration branch retained',
    explanatoryControls:
      'total-zero changes magnification/bevel/refraction/aberration together; zero-aberration changes R/B from single taps to shared five-tap sampling; neither isolates bending or chromatic displacement',
    contextImageMeaning:
      'synthetic source-raster context plus decoded native canvas PNG mapped by frozen CSS/raster ratio; not component screenshot',
    foregroundMeaning:
      'same semantic foreground uniform/contrast test; material-only images contain no component glyph',
    captures: captures.map(({ image, png, ...receipt }) => ({
      ...receipt,
      width: image.width,
      height: image.height,
    })),
    pngs,
  };
}
