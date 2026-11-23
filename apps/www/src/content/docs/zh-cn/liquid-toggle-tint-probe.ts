/** Test-page-only direct-program controls. This bypasses no provider guard: it
 * does not ask for provider admission at all. Its visible owned canvases prove
 * only the first-party GPU algorithm, never four-runtime/public-page acceptance. */
import {
  createWebOpticalProgram,
  type OpticalFrame,
  type OpticalGeometry,
} from '../../../../../../packages/adapters/base/src/material/program';
import {
  colorContrast,
  type OpaqueRgba,
} from '../../../../../../packages/adapters/base/src/material/style';
import { THEME } from '../../../../../../packages/prototypes/liquid-glass/src/theme';

const SOURCE_KINDS = [
  'dark-detail',
  'dark-detail-inverted',
  'black',
  'white',
  'gray',
  'red',
  'green',
  'blue',
  'high-frequency',
] as const;
const PHASES = ['static', 'rest', 'pressed', 'release'] as const;
type SourceKind = (typeof SOURCE_KINDS)[number];
const CONTROL_NAMES = ['neutral', 'tinted', 'zeroRefraction'] as const;
const PROGRAM_NAMES = [...CONTROL_NAMES, 'sharedInterleaved'] as const;
type ProgramName = (typeof PROGRAM_NAMES)[number];
type ControlName = (typeof CONTROL_NAMES)[number] | 'interleavedNeutral' | 'interleavedTint';

function rgba(hex: string): OpaqueRgba {
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16) / 255;
  return [channel(1), channel(3), channel(5), 1];
}
async function digest(bytes: Uint8Array | Uint8ClampedArray) {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function decode(uri: string) {
  const image = new Image();
  image.src = uri;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      image.decode(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tint probe decode deadline')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  const canvas = new OffscreenCanvas(image.width, image.height),
    context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: context.getImageData(0, 0, image.width, image.height).data,
  };
}
type Decoded = Awaited<ReturnType<typeof decode>>;
function contentOffsets(image: Decoded, geometry: OpticalGeometry) {
  const outset = geometry.paintOutset ?? 0;
  const offsets: number[] = [];
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const hostX = ((x + 0.5) / image.width) * (geometry.width + 2 * outset) - outset,
        hostY = ((y + 0.5) / image.height) * (geometry.height + 2 * outset) - outset;
      // Fixed text-content ROI, away from the border and contact shadow.
      if (hostX >= 20 && hostX < 140 && hostY >= 10 && hostY < 38)
        offsets.push((y * image.width + x) * 4);
    }
  return offsets;
}
function statistics(image: Decoded, frame: OpticalFrame) {
  const offsets = contentOffsets(image, frame.geometry),
    colors = new Set<string>(),
    sum = [0, 0, 0];
  let validPixels = 0,
    opaquePixels = 0,
    blueDominantPixels = 0,
    minimumContrast = Infinity;
  for (const at of offsets) {
    const alpha = image.data[at + 3];
    if (alpha > 0) validPixels++;
    // Unlike the production snapshot's conservative alpha composition, this
    // controlled diagnostic requires every content sample to be fully opaque.
    if (alpha !== 255) continue;
    opaquePixels++;
    const rgb = Array.from(image.data.slice(at, at + 3));
    for (let channel = 0; channel < 3; channel++) sum[channel] += rgb[channel];
    colors.add(rgb.join(','));
    if (rgb[2] > rgb[1] && rgb[1] > rgb[0]) blueDominantPixels++;
    minimumContrast = Math.min(
      minimumContrast,
      colorContrast([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1], frame.foreground)
    );
  }
  return {
    contentRoi: { left: 20, top: 10, right: 140, bottom: 38 },
    contentPixels: offsets.length,
    validPixels,
    opaquePixels,
    nonopaquePixels: offsets.length - opaquePixels,
    minForegroundContrast: opaquePixels > 0 ? minimumContrast : null,
    foreground: frame.foreground,
    uniqueColors: colors.size,
    meanRgb: opaquePixels > 0 ? sum.map((value) => value / opaquePixels) : null,
    blueDominantFraction: opaquePixels > 0 ? blueDominantPixels / opaquePixels : null,
  };
}
function difference(a: Decoded, b: Decoded, geometry: OpticalGeometry) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Tint probe geometry changed');
  let validPixels = 0,
    changedPixels = 0,
    absoluteRgbDifference = 0,
    changedAlphaPixels = 0;
  for (const at of contentOffsets(a, geometry)) {
    if (a.data[at + 3] !== b.data[at + 3]) changedAlphaPixels++;
    if (a.data[at + 3] !== 255 || b.data[at + 3] !== 255) continue;
    validPixels++;
    const delta =
      Math.abs(a.data[at] - b.data[at]) +
      Math.abs(a.data[at + 1] - b.data[at + 1]) +
      Math.abs(a.data[at + 2] - b.data[at + 2]);
    if (delta > 0) changedPixels++;
    absoluteRgbDifference += delta;
  }
  return {
    validPixels,
    changedPixels,
    changedAlphaPixels,
    absoluteRgbDifference,
    changedFraction: validPixels > 0 ? changedPixels / validPixels : null,
    meanAbsoluteChannelDifference:
      validPixels > 0 ? absoluteRgbDifference / (3 * validPixels) : null,
  };
}
function sourcePixels(kind: SourceKind, width: number, height: number) {
  const pixels = new Uint8Array(width * height * 4);
  const solid: Partial<Record<SourceKind, number[]>> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    gray: [128, 128, 128],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const tile = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
      const rgb =
        solid[kind] ??
        (kind === 'high-frequency'
          ? [x, tile ? 240 : 24, y * 2]
          : tile === Number(kind === 'dark-detail-inverted')
            ? [8, 16, 32]
            : [64, 70, 76]);
      pixels.set([...rgb, 255], (y * width + x) * 4);
    }
  return pixels;
}
type RenderedControl = {
  status: 'rendered';
  uri: string;
  width: number;
  height: number;
  decodedSha256: string;
  statistics: ReturnType<typeof statistics>;
};
type RejectedControl = { status: 'rejected'; reason: string };
export type LiquidToggleTintProbeRecord = {
  sourceKind: SourceKind;
  theme: 'light' | 'dark';
  phase: (typeof PHASES)[number];
  sourceRevision: number;
  sourceSha256: string;
  sourcePng: string;
  sourceUnchanged: boolean;
  frameUnchanged: boolean;
  fixedTime: 0;
  geometry: OpticalGeometry;
  contact: OpticalFrame['contact'];
  fill: OpaqueRgba;
  foreground: OpaqueRgba;
  expectedTintProfile: string;
  controls: Record<ControlName, RenderedControl | RejectedControl>;
  sharedNeutralVsIsolated: ReturnType<typeof difference> | null;
  sharedTintVsIsolated: ReturnType<typeof difference> | null;
  neutralVsTint: ReturnType<typeof difference> | null;
  tintVsZeroRefraction: ReturnType<typeof difference> | null;
  invertedSourceVsOriginal: ReturnType<typeof difference> | null;
};

export async function runLiquidToggleTintProbe(host: HTMLElement) {
  host.replaceChildren();
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = 256;
  sourceCanvas.height = 128;
  sourceCanvas.setAttribute('aria-label', 'Fixed owned diagnostic source');
  host.append(sourceCanvas);
  const programs = Object.fromEntries(
    PROGRAM_NAMES.map((name) => {
      const figure = document.createElement('figure'),
        caption = document.createElement('figcaption'),
        canvas = document.createElement('canvas');
      caption.textContent = name;
      canvas.setAttribute('aria-label', `Algorithm-only ${name}`);
      figure.append(caption, canvas);
      host.append(figure);
      return [
        name,
        {
          canvas,
          program: createWebOpticalProgram(
            canvas,
            name === 'zeroRefraction' ? 'zero-refraction' : null
          ),
        },
      ];
    })
  ) as Record<
    ProgramName,
    { canvas: HTMLCanvasElement; program: ReturnType<typeof createWebOpticalProgram> }
  >;
  host.scrollIntoView({ block: 'start' });
  const sourceContext = sourceCanvas.getContext('2d')!;
  const records: LiquidToggleTintProbeRecord[] = [];
  const darkOriginals = new Map<string, Decoded>();
  let gpu: {
    vendor: unknown;
    renderer: unknown;
    version: unknown;
    shadingLanguageVersion: unknown;
  } | null = null;
  try {
    for (const [index, kind] of SOURCE_KINDS.entries()) {
      const pixels = sourcePixels(kind, sourceCanvas.width, sourceCanvas.height);
      sourceContext.putImageData(
        new ImageData(Uint8ClampedArray.from(pixels), sourceCanvas.width, sourceCanvas.height),
        0,
        0
      );
      const source = Object.freeze({
        revision: index + 1,
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        pixels,
        canvas: sourceCanvas,
        scope: host,
      });
      const sourceSha256 = await digest(pixels),
        sourcePng = sourceCanvas.toDataURL('image/png');
      for (const theme of ['light', 'dark'] as const)
        for (const phase of PHASES) {
          const frame: OpticalFrame = {
            source,
            geometry: {
              width: 160,
              height: 48,
              radius: 24,
              dpr: 1,
              bounds: [0.1, 0.2, 0.625, 0.375],
              paintOutset: phase === 'static' ? 0 : 14,
            },
            pressed: phase === 'pressed',
            variant: 'regular',
            tint: 'style-fill',
            fill: rgba(THEME[theme].primary),
            foreground: rgba(THEME[theme]['primary-foreground']),
            ...(phase === 'static'
              ? {}
              : {
                  contact: {
                    x: 0.4,
                    y: 0.6,
                    deltaX: 0.3,
                    deltaY: -0.2,
                    strength: phase === 'pressed' ? 1 : phase === 'release' ? 0.5 : 0,
                  },
                }),
          };
          const frameSignature = JSON.stringify({ ...frame, source: sourceSha256 });
          const controls = {} as LiquidToggleTintProbeRecord['controls'];
          const decoded: Partial<Record<ControlName, Decoded>> = {};
          // The document pool shares a program across neutral and tinted controls.
          // Exercise that interleaving too; isolated programs alone hid recompile churn.
          for (const name of [...CONTROL_NAMES, 'interleavedNeutral', 'interleavedTint'] as const) {
            try {
              const { tint: _tint, ...neutralFrame } = frame;
              const program =
                programs[
                  name === 'interleavedTint' || name === 'interleavedNeutral'
                    ? 'sharedInterleaved'
                    : name
                ].program;
              const uri = program.render(
                name === 'neutral' || name === 'interleavedNeutral' ? neutralFrame : frame
              );
              const image = await decode(uri);
              decoded[name] = image;
              controls[name] = {
                status: 'rendered',
                uri,
                width: image.width,
                height: image.height,
                decodedSha256: await digest(image.data),
                statistics: statistics(image, frame),
              };
            } catch (error) {
              // A neutral/white-foreground unsafe result is a real rejection,
              // never a missing PNG presented as a successful pixel control.
              controls[name] = {
                status: 'rejected',
                reason: error instanceof Error ? error.message : String(error),
              };
            }
          }
          const originalKey = `${theme}/${phase}`;
          if (kind === 'dark-detail' && decoded.tinted)
            darkOriginals.set(originalKey, decoded.tinted);
          const original = darkOriginals.get(originalKey);
          records.push({
            sourceKind: kind,
            theme,
            phase,
            sourceRevision: source.revision,
            sourceSha256,
            sourcePng,
            sourceUnchanged: sourceSha256 === (await digest(pixels)),
            frameUnchanged: frameSignature === JSON.stringify({ ...frame, source: sourceSha256 }),
            fixedTime: 0,
            geometry: frame.geometry,
            contact: frame.contact,
            fill: frame.fill,
            foreground: frame.foreground,
            expectedTintProfile:
              phase === 'static' ? 'pui-regular-style-tint-6' : 'pui-regular-style-tint-contact-6',
            controls,
            sharedNeutralVsIsolated:
              decoded.interleavedNeutral && decoded.neutral
                ? difference(decoded.interleavedNeutral, decoded.neutral, frame.geometry)
                : null,
            sharedTintVsIsolated:
              decoded.interleavedTint && decoded.tinted
                ? difference(decoded.interleavedTint, decoded.tinted, frame.geometry)
                : null,
            neutralVsTint:
              decoded.neutral && decoded.tinted
                ? difference(decoded.neutral, decoded.tinted, frame.geometry)
                : null,
            tintVsZeroRefraction:
              decoded.tinted && decoded.zeroRefraction
                ? difference(decoded.tinted, decoded.zeroRefraction, frame.geometry)
                : null,
            invertedSourceVsOriginal:
              kind === 'dark-detail-inverted' && original && decoded.tinted
                ? difference(original, decoded.tinted, frame.geometry)
                : null,
          });
        }
    }
    const gl = programs.tinted.canvas.getContext('webgl');
    if (gl)
      gpu = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      };
    return {
      scope: 'algorithm-only direct GPU controls; no provider admission or four-runtime acceptance',
      isolatedRenderAttempts: records.length * 3,
      interleavedRenderAttempts: records.length * 2,
      interleaving:
        'interleavedNeutral and interleavedTint use one context/program owner, with identical inputs to the isolated neutral and tinted controls; finite static/contact profiles must compile once and share current source uploads',
      frozenInputs:
        'same source object/revision/bytes, geometry, contact, fill, foreground and fixed shader time for each matched comparison; only tint mode or zero-refraction diagnostic changes',
      gpu,
      records,
      programMetrics: Object.fromEntries(
        PROGRAM_NAMES.map((name) => [name, programs[name].program.inspect()])
      ),
    };
  } finally {
    for (const { program } of Object.values(programs)) program.dispose();
  }
}
