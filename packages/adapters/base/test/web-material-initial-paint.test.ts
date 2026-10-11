import { initialPaintSceneColors } from '../../../../experiments/material-initial-paint/scene';
import { colorContrast, resolvePaletteColor } from '../src/material/style';
import { webcrypto } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import type { OpticalFrame } from '../src/material/program';
import type { WebMaterialOptions } from '../src/material/sink';
import { createWebMaterialSink } from '../src/material/sink';
import {
  digestBytes,
  digestText,
  INITIAL_PAINT_PROFILE,
  parseInitialPaintReceipt,
  receiptFromAdmittedPaint,
  verifyInitialPaintArtifact,
} from '../src/material/initial-paint-receipt';
import {
  armExperimentalInitialPaintCapture,
  initialPaintPresentation,
  prepareExperimentalInitialPaint,
} from '../src/material/initial-paint-experiment';
import { readInternalInitialPaintLease } from '../src/material/initial-paint-bridge';

const gpu = vi.hoisted(() => ({ render: vi.fn(), clear: vi.fn() }));
const decode = vi.hoisted(() => ({
  ready: null as null | (() => void),
  fail: null as null | (() => void),
  delayed: false,
}));
vi.mock('../src/material/program', () => ({ createWebOpticalProgram: () => gpu }));
vi.mock('../src/material/image-prepare', () => ({
  prepareOpticalImage: (_doc: Document, _source: string, ready: () => void, failed: () => void) => {
    decode.ready = ready;
    decode.fail = failed;
    if (!decode.delayed) ready();
    return () => {};
  },
}));
// Valid opaque PNGs are synthetic protocol fixtures. Mock GPU tests below prove
// ownership and refusal, never optical appearance, WebGL parity, or native CSS.
function png(width: number, height: number, value = 255): string {
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c ^= byte;
      for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (kind: string, bytes: Uint8Array) => {
    const output = Buffer.alloc(bytes.length + 12);
    output.writeUInt32BE(bytes.length);
    output.write(kind, 4);
    output.set(bytes, 8);
    output.writeUInt32BE(crc(output.subarray(4, bytes.length + 8)), bytes.length + 8);
    return output;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1), value);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) raw[y * (width * 4 + 1) + x * 4 + 4] = 255;
  }
  return (
    'data:image/png;base64,' +
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array()),
    ]).toString('base64')
  );
}
const rect = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON() {},
  }) as DOMRect;
function fixture(tag = 'div', attached = true) {
  const scope = document.createElement('div'),
    canvas = document.createElement('canvas'),
    host = document.createElement(tag);
  scope.append(canvas, host);
  if (attached) document.body.append(scope);
  canvas.width = 400;
  canvas.height = 240;
  host.style.color = 'rgb(23, 23, 23)';
  host.style.borderRadius = '12px';
  const targetRect = vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(40, 30, 100, 40));
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 240));
  vi.spyOn(canvas, 'toDataURL').mockReturnValue(png(400, 240));
  const source = {
    revision: 1,
    width: 400,
    height: 240,
    canvas,
    scope,
    pixels: new Uint8Array(400 * 240 * 4).fill(255),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    getImageData: () => ({ data: new Uint8ClampedArray(source.pixels) }),
  } as unknown as CanvasRenderingContext2D);
  let current: typeof source | null = source;
  const listeners = {
    source: new Set<() => void>(),
    preferences: new Set<() => void>(),
    palette: new Set<() => void>(),
  };
  const preferences = {
    reducedMotion: 'no-preference',
    reducedTransparency: 'no-preference',
    contrast: 'no-preference',
    forcedColors: 'none',
  } as const;
  const subscribe = (set: Set<() => void>) => (fn: () => void) => {
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  };
  const options = {
    source: {
      current: () => current,
      subscribe: subscribe(listeners.source),
      draw() {
        throw new Error('Synthetic source has no drawing API');
      },
      revoke() {
        current = null;
        for (const fn of listeners.source) fn();
      },
      dispose() {
        current = null;
        listeners.source.clear();
      },
    },
    preferences: { current: () => preferences, subscribe: subscribe(listeners.preferences) },
    palette: {
      current: () => ({ revision: 1, colors: { background: '#fff', foreground: '#171717' } }),
      subscribe: subscribe(listeners.palette),
    },
  } as WebMaterialOptions;
  const visual: VisualFeedbackFrame = {
    view: 1,
    revision: 1,
    style: { kind: 'tw', tokens: ['bg-background', 'text-foreground', 'rounded-lg'] },
    material: {
      slot: {
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      },
      candidates: [{ intent: 'liquid-glass' }],
    },
  };
  const optical: OpticalFrame = {
    source,
    geometry: {
      width: 100,
      height: 40,
      radius: 12,
      dpr: 1,
      paintOutset: 0,
      bounds: [0.1, 0.125, 0.25, 1 / 6],
    },
    pressed: false,
    variant: 'regular',
    fill: [1, 1, 1, 1],
    foreground: [23 / 255, 23 / 255, 23 / 255, 1],
  };
  const layout = {
    id: 'rest-control',
    viewportWidth: 1000,
    viewportHeight: 800,
    dpr: 1,
    theme: 'light' as const,
  };
  const image = png(100, 40, 238);
  gpu.render.mockReturnValue(image);
  const artifact = async (frame: VisualFeedbackFrame = visual) => {
    const receipt = await receiptFromAdmittedPaint(layout, frame, optical, image);
    const serialized = JSON.stringify(receipt);
    const binding = {
      artifactSha256: await digestText(serialized),
      layoutId: layout.id,
      profile: INITIAL_PAINT_PROFILE,
      serverPaint: receipt.image,
    };
    return { receipt, serialized, binding };
  };
  const show = async (frame: VisualFeedbackFrame = visual) => {
    const artifactValue = await artifact(frame),
      presentation = initialPaintPresentation(artifactValue.receipt, 'rest-host');
    for (const [name, value] of Object.entries(presentation.attributes))
      host.setAttribute(name, value);
    host.style.cssText += ';' + presentation.style;
    return artifactValue;
  };
  const sink = () =>
    createWebMaterialSink(
      host,
      {
        queueStyle: (style) => host.setAttribute('data-pui-style', style.tokens.join(' ')),
        requestFlush() {},
      },
      options
    );
  return {
    host,
    canvas,
    scope,
    source,
    options,
    visual,
    optical,
    layout,
    image,
    artifact,
    show,
    sink,
    targetRect,
    listeners,
    preferences,
    invalidate(kind: keyof typeof listeners) {
      for (const fn of [...listeners[kind]]) fn();
    },
    removeSource() {
      current = null;
      for (const fn of [...listeners.source]) fn();
    },
  };
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  gpu.render.mockReset();
  gpu.clear.mockClear();
  decode.delayed = false;
  decode.ready = null;
  decode.fail = null;
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('internal finite rest seed receipt (synthetic bytes, not optical evidence)', () => {
  it('binds exact serialized artifact, profile, source, geometry and renderer output', async () => {
    const f = fixture(),
      a = await f.artifact();
    expect(await verifyInitialPaintArtifact(a.serialized, a.binding)).toEqual(a.receipt);
    expect(Object.isFrozen(a.receipt.geometry.bounds)).toBe(true);
    await expect(verifyInitialPaintArtifact(a.serialized + ' ', a.binding)).rejects.toThrow(
      'manifest'
    );
    await expect(
      verifyInitialPaintArtifact(a.serialized, { ...a.binding, layoutId: 'different' })
    ).rejects.toThrow('layout-binding');
    const forged = { ...a.receipt, image: { ...a.receipt.image, pngSha256: '0'.repeat(64) } };
    const serialized = JSON.stringify(forged);
    await expect(
      verifyInitialPaintArtifact(serialized, {
        ...a.binding,
        artifactSha256: await digestText(serialized),
        serverPaint: forged.image,
      })
    ).rejects.toThrow('integrity');
  });
  it.each([
    [
      'extra key',
      (r: any) => {
        r.unknown = true;
      },
    ],
    [
      'external image',
      (r: any) => {
        r.image.dataUrl = 'https://example.invalid/image.png';
      },
    ],
    [
      'renderer',
      (r: any) => {
        r.renderer = 'other';
      },
    ],
    [
      'unknown profile',
      (r: any) => {
        r.version = 'unknown';
      },
    ],
    [
      'source dimensions',
      (r: any) => {
        r.source.width++;
      },
    ],
    [
      'output dimensions',
      (r: any) => {
        r.geometry.width++;
      },
    ],
    [
      'paint outset',
      (r: any) => {
        r.geometry.paintOutset = 1;
      },
    ],
    [
      'DPR',
      (r: any) => {
        r.layout.dpr = 4;
      },
    ],
    [
      'duplicate tokens',
      (r: any) => {
        r.tokens.push(r.tokens[0]);
      },
    ],
    [
      'outside source',
      (r: any) => {
        r.geometry.bounds = [0.99, 0.99, 1, 1];
      },
    ],
    [
      'translucent fallback',
      (r: any) => {
        r.fill[3] = 0.5;
      },
    ],
    [
      'oversized source',
      (r: any) => {
        r.source.height = 2049;
      },
    ],
  ])('refuses %s', async (_name, mutate) => {
    const a = await fixture().artifact();
    const r = JSON.parse(a.serialized);
    mutate(r);
    expect(() => parseInitialPaintReceipt(JSON.stringify(r))).toThrow();
  });
  it.each(['pressed', 'contact', 'deformation'])('refuses a %s capture', async (kind) => {
    const f = fixture();
    if (kind === 'pressed') f.optical.pressed = true;
    if (kind === 'contact')
      f.optical.contact = { x: 0.5, y: 0.5, deltaX: 0, deltaY: 0, strength: 1 };
    if (kind === 'deformation')
      (f.visual.material.candidates as Array<(typeof f.visual.material.candidates)[number]>)[0] = {
        intent: 'liquid-glass',
        deformation: { kind: 'press', phase: 'rest' },
      };
    await expect(f.artifact()).rejects.toThrow('static-rest');
  });
  it('refuses source pixels that no longer match the actual owned Canvas', async () => {
    const f = fixture();
    vi.mocked(f.canvas.getContext).mockReturnValue({
      getImageData: () => ({ data: new Uint8ClampedArray(f.source.pixels.length) }),
    } as unknown as CanvasRenderingContext2D);
    await expect(f.artifact()).rejects.toThrow('source-canvas-pixels-mismatch');
  });
  it('snapshots mutable inputs before digest yields', async () => {
    const f = fixture(),
      expectedHash = await digestBytes(f.source.pixels),
      pending = f.artifact();
    f.source.pixels.fill(0);
    f.layout.viewportWidth = 999;
    f.optical.geometry.width = 99;
    (f.visual.style.tokens as string[]).push('extra');
    const result = await pending;
    expect(result.receipt.source.rgbaSha256).toBe(expectedHash);
    expect(result.receipt.layout.viewportWidth).toBe(1000);
    expect(result.receipt.geometry.width).toBe(100);
    expect(result.receipt.tokens).not.toContain('extra');
  });
  it('emits an opaque SSR default and affirmative finite preference/profile gates without layout writes', async () => {
    const a = await fixture().artifact(),
      p = initialPaintPresentation(a.receipt, 'rest-host');
    expect(p.css).toMatch(/^#rest-host\[.*\]\{background-image:none!important/);
    for (const guard of [
      '(width:1000px)',
      '(height:800px)',
      '(resolution:1dppx)',
      '(prefers-reduced-transparency:no-preference)',
      '(prefers-contrast:no-preference)',
      '(forced-colors:none)',
    ])
      expect(p.css).toContain(guard);
    expect(p.css).toContain('(prefers-reduced-transparency:reduce)');
    expect(p.css).toContain(
      `(forced-colors:active){#rest-host[data-pui-initial-seed="${a.receipt.image.pngSha256}"],#rest-host[data-pui-initial-seed="${a.receipt.image.pngSha256}:rejected"]{background-image:none!important;background-color:Canvas!important;color:CanvasText!important`
    );
    expect(p.style).not.toMatch(/(?:^|;)(width|height|padding|display|visibility|opacity):/);
    expect(() => initialPaintPresentation(a.receipt, 'host;bad')).toThrow('host-id');
  });
});

describe('actual internal family producer boundary', () => {
  it('captures the real Liquid Surface rest candidate and renders already-painted server HTML', async () => {
    const { AdaptToWebComponent, setElementProps } =
      await import('@proto.ui/adapter-web-component');
    const { default: surface } = await import('@proto.ui/prototypes-liquid-glass/surface');
    const { renderInitialPaintPage } =
      await import('../../../../experiments/material-initial-paint/render-page.mjs');
    let options: WebMaterialOptions;
    AdaptToWebComponent(surface, {
      registerAs: 'seed-family-control',
      createVisualSink: (host, effects) => createWebMaterialSink(host, effects, options),
    });
    const f = fixture('seed-family-control', false);
    options = f.options;
    const capture = armExperimentalInitialPaintCapture(f.host, f.layout);
    setElementProps(f.host, {
      variant: 'outline',
      radius: 'full',
      border: 'none',
      elevation: 'none',
    });
    document.body.append(f.scope);
    await vi.waitFor(() => expect(f.host.dataset.materialQuality).toBe('self-optical'));
    const artifact = await capture.artifact();
    expect(JSON.parse(artifact.receipt.materialKey).candidates).toEqual([
      { intent: 'liquid-glass', variant: 'regular' },
    ]);
    expect(artifact.receipt.tokens).toContain('rounded-full');
    const html = await renderInitialPaintPage(artifact.serialized, artifact.binding);
    expect(html).toContain('data-seed-source="' + artifact.receipt.source.rgbaSha256 + '"');
    expect(html).toContain(artifact.receipt.source.pngDataUrl);
    expect(html).toContain(artifact.receipt.image.dataUrl);
    const template = document.createElement('template');
    template.innerHTML = html;
    const parsed = template.content;
    expect(parsed.querySelectorAll('a')).toHaveLength(1);
    expect(parsed.querySelector('a')!.getAttribute('href')).toBe('#destination');
    expect(parsed.querySelector('#seed-control')!.getAttribute('role')).toBeNull();
    expect(parsed.querySelector('#seed-control')!.getAttribute('tabindex')).toBeNull();
    expect(parsed.querySelector('#seed-control')!.getAttribute('data-material-quality')).toBeNull();
    expect(parsed.querySelector('#seed-control')!.getAttribute('style')).toContain(
      artifact.receipt.image.dataUrl
    );
    capture.dispose();
    f.host.remove();
  });
});

describe('internal server plane adoption (mock GPU, not native first-frame evidence)', () => {
  it('retains existing SSR pixels through verification and delayed decode; publishes live quality only after decode', async () => {
    const f = fixture(),
      a = await f.show(),
      original = f.host.style.backgroundImage;
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    expect(f.host.style.backgroundImage).toBe(original);
    expect(f.host.dataset.materialQuality).toBeUndefined();
    const prepared = await pending;
    decode.delayed = true;
    const sink = f.sink();
    sink.commit(f.visual);
    expect(gpu.render).toHaveBeenCalledOnce();
    expect(f.host.style.backgroundImage).toBe(original);
    expect(f.host.dataset.materialReason).not.toBe('preparing');
    expect(f.host.dataset.materialQuality).not.toBe('self-optical');
    expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
    decode.ready!();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(f.host.style.backgroundImage).toBe(original);
    sink.release(1);
    prepared.dispose();
    expect(f.host.style.backgroundImage).toBe('');
  });
  it('selects the SSR opaque default when artifact verification fails and never creates a live lease', async () => {
    const f = fixture(),
      a = await f.show();
    await expect(
      prepareExperimentalInitialPaint(
        f.host,
        a.serialized,
        { ...a.binding, artifactSha256: '0'.repeat(64) },
        f.options
      )
    ).rejects.toThrow('manifest');
    expect(f.host.getAttribute('data-pui-initial-seed')).toBe(
      `${a.receipt.image.pngSha256}:rejected`
    );
    expect(readInternalInitialPaintLease(f.host)).toBeNull();
    expect(initialPaintPresentation(a.receipt, 'rest-host').css).toMatch(
      /^#rest-host\[data-pui-initial-seed="[a-f0-9]{64}"\],#rest-host\[data-pui-initial-seed="[a-f0-9]{64}:rejected"\]\{background-image:none!important/
    );
  });
  it('does not let an unregistered arbitrary image bypass the ordinary authored paint guard', async () => {
    const f = fixture();
    await f.show();
    const sink = f.sink();
    sink.commit(f.visual);
    expect(gpu.render).not.toHaveBeenCalled();
    expect(f.host.dataset.materialReason).toBe('external-paint-conflict');
    sink.release(1);
  });
  it('withdraws a differing replay while its live replacement awaits decode', async () => {
    const f = fixture(),
      a = await f.show();
    const prepared = await prepareExperimentalInitialPaint(
      f.host,
      a.serialized,
      a.binding,
      f.options
    );
    gpu.render.mockReturnValue(png(100, 40, 200));
    decode.delayed = true;
    const sink = f.sink();
    sink.commit(f.visual);
    expect(f.host.style.backgroundImage).toBe('none');
    expect(f.host.dataset.materialReason).toBe('initial-paint-replay-mismatch');
    expect(f.host.dataset.materialQuality).not.toBe('self-optical');
    sink.release(1);
    prepared.dispose();
  });
  it.each(['source', 'palette', 'preference', 'geometry', 'tokens', 'foreign paint'])(
    'revokes after %s changes and preserves replacement ownership',
    async (kind) => {
      const f = fixture(),
        a = await f.show(),
        prepared = await prepareExperimentalInitialPaint(
          f.host,
          a.serialized,
          a.binding,
          f.options
        );
      if (kind === 'source') f.removeSource();
      if (kind === 'palette') f.invalidate('palette');
      if (kind === 'preference') {
        Object.assign(f.preferences, { reducedTransparency: 'reduce' });
        f.invalidate('preferences');
      }
      if (kind === 'geometry') {
        f.targetRect.mockReturnValue(rect(40, 30, 101, 40));
        f.invalidate('source');
      }
      if (kind === 'tokens') {
        f.host.setAttribute('data-pui-style', 'bg-other');
        f.invalidate('source');
      }
      if (kind === 'foreign paint') {
        f.host.style.backgroundImage = 'linear-gradient(red,blue)';
        f.invalidate('source');
      }
      expect(readInternalInitialPaintLease(f.host)).toBeNull();
      expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
      expect(f.host.style.backgroundImage).toBe(
        kind === 'foreign paint' ? 'linear-gradient(red, blue)' : ''
      );
      expect(Object.values(f.listeners).every((set) => set.size === 0)).toBe(true);
      prepared.dispose();
    }
  );
  it('refuses simultaneous and ready duplicates without withdrawing the original owner', async () => {
    const f = fixture(),
      a = await f.show(),
      original = f.host.style.backgroundImage;
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow('already-registered');
    const prepared = await pending;
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow('already-registered');
    expect(f.host.style.backgroundImage).toBe(original);
    expect(readInternalInitialPaintLease(f.host)).not.toBeNull();
    prepared.dispose();
  });
  it('cleans earlier subscriptions when a later provider throws', async () => {
    const f = fixture(),
      a = await f.show();
    f.options.preferences!.subscribe = () => {
      throw new Error('subscribe failed');
    };
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow('subscribe failed');
    expect(f.listeners.source.size).toBe(0);
    expect(f.host.style.backgroundImage).toBe('');
  });
  it.each([
    'width',
    'height',
    'DPR',
    'source pixels',
    'missing source',
    'unknown transparency',
    'forced colors',
    'foreground',
    'radius',
    'disconnected',
  ])('refuses initial %s mismatch and withdraws the recognized server plane', async (kind) => {
    const f = fixture(),
      a = await f.show();
    if (kind === 'width')
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 999 });
    if (kind === 'height')
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 799 });
    if (kind === 'DPR')
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    if (kind === 'source pixels') f.source.pixels[0] = 10;
    if (kind === 'missing source') f.removeSource();
    if (kind === 'unknown transparency')
      Object.assign(f.preferences, { reducedTransparency: 'unknown' });
    if (kind === 'forced colors') Object.assign(f.preferences, { forcedColors: 'active' });
    if (kind === 'foreground') f.host.style.color = 'red';
    if (kind === 'radius') f.host.style.borderRadius = '11px';
    if (kind === 'disconnected') f.scope.remove();
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow();
    expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
    expect(f.host.style.backgroundImage).toBe('');
    expect(readInternalInitialPaintLease(f.host)).toBeNull();
  });
  it('does not revive a plane invalidated while its raw pixels are being verified', async () => {
    const f = fixture(),
      a = await f.show();
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let unblock: (() => void) | null = null;
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      if ((data as ArrayBufferView).byteLength === f.source.pixels.length)
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      return original(algorithm, data);
    });
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    const rejected = expect(pending).rejects.toThrow('source-pixels-mismatch');
    await vi.waitFor(() => expect(unblock).not.toBeNull());
    f.removeSource();
    expect(f.host.style.backgroundImage).toBe('');
    unblock!();
    await rejected;
    expect(readInternalInitialPaintLease(f.host)).toBeNull();
    expect(Object.values(f.listeners).every((set) => set.size === 0)).toBe(true);
  });
  it('completes ownership transfer even when a subscription cleanup throws', async () => {
    const f = fixture(),
      a = await f.show();
    f.options.palette.subscribe = () => () => {
      throw new Error('cleanup failed');
    };
    const prepared = await prepareExperimentalInitialPaint(
      f.host,
      a.serialized,
      a.binding,
      f.options
    );
    const sink = f.sink();
    sink.commit(f.visual);
    expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    expect(() => sink.release(1)).toThrow('cleanup failed');
    prepared.dispose();
    expect(f.host.style.backgroundImage).toBe('');
  });
  it('does not revive a released seed when decode resolves late', async () => {
    const f = fixture(),
      a = await f.show(),
      prepared = await prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    decode.delayed = true;
    const sink = f.sink();
    sink.commit(f.visual);
    const late = decode.ready!;
    sink.release(1);
    late();
    expect(f.host.style.backgroundImage).toBe('');
    expect(f.host.dataset.materialQuality).toBeUndefined();
    prepared.dispose();
  });
  it('captures only a sink frame admitted through successful image preparation', async () => {
    const f = fixture(),
      capture = armExperimentalInitialPaintCapture(f.host, f.layout),
      sink = f.sink();
    decode.delayed = true;
    sink.commit(f.visual);
    await expect(capture.artifact()).rejects.toThrow('no-admitted');
    decode.ready!();
    const a = await capture.artifact();
    expect(a.receipt.image.dataUrl).toBe(f.image);
    expect(await verifyInitialPaintArtifact(a.serialized, a.binding)).toEqual(a.receipt);
    capture.dispose();
    sink.release(1);
    await expect(capture.artifact()).rejects.toThrow('no-admitted');
  });
});

// Independent reviewer diagnostics; not candidate implementation changes.
describe('reviewer source/provenance negative controls', () => {
  it('rejects an actual canvas that no longer matches the receipt source RGBA', async () => {
    const f = fixture(),
      a = await f.show();
    vi.mocked(f.canvas.getContext).mockReturnValue({
      getImageData: () => ({ data: new Uint8ClampedArray(f.source.pixels.length).fill(0) }),
    } as unknown as CanvasRenderingContext2D);
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow();
  });
  it('rejects substituted source PNG pixels even after consistent byte-hash recomputation', async () => {
    const f = fixture(),
      a = await f.artifact();
    const forged = JSON.parse(a.serialized);
    forged.source.pngDataUrl = png(400, 240, 0);
    const { pngBytes } = await import('../src/material/initial-paint-receipt');
    forged.source.pngSha256 = await digestBytes(pngBytes(forged.source.pngDataUrl));
    const serialized = JSON.stringify(forged);
    const binding = { ...a.binding, artifactSha256: await digestText(serialized) };
    const presentation = initialPaintPresentation(forged, 'rest-host');
    for (const [name, value] of Object.entries(presentation.attributes))
      f.host.setAttribute(name, value);
    f.host.style.cssText += ';' + presentation.style;
    await expect(
      prepareExperimentalInitialPaint(f.host, serialized, binding, f.options)
    ).rejects.toThrow();
  });
  it('withdraws the seed immediately when source is revoked during artifact hash verification', async () => {
    const f = fixture(),
      a = await f.show();
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let unblock: (() => void) | null = null;
    let first = true;
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      }
      return original(algorithm, data);
    });
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    const rejected = expect(pending).rejects.toThrow('unavailable');
    await vi.waitFor(() => expect(unblock).not.toBeNull());
    f.removeSource();
    const afterRevocation = f.host.style.backgroundImage;
    unblock!();
    await rejected;
    expect(afterRevocation).toBe('');
  });
});

describe('reviewer late lifecycle controls', () => {
  it('does not transfer the same pending preparation into a different owner document', async () => {
    const f = fixture(),
      a = await f.show();
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let unblock: (() => void) | null = null;
    let first = true;
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      }
      return original(algorithm, data);
    });
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    await vi.waitFor(() => expect(unblock).not.toBeNull());
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const other = iframe.contentDocument!,
      otherWindow = iframe.contentWindow!;
    Object.defineProperty(otherWindow, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(otherWindow, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(otherWindow, 'devicePixelRatio', { configurable: true, value: 1 });
    vi.spyOn(otherWindow, 'requestAnimationFrame').mockReturnValue(1);
    other.body.append(other.adoptNode(f.scope));
    f.scope.append(other.adoptNode(f.canvas), other.adoptNode(f.host));
    unblock!();
    await expect(pending).rejects.toThrow();
  });
  it('ignores no revocation when source.subscribe invalidates synchronously and cleans all leases', async () => {
    const f = fixture(),
      a = await f.show();
    const originalSubscribe = f.options.source.subscribe;
    f.options.source.subscribe = (fn) => {
      const stop = originalSubscribe(fn);
      f.removeSource();
      return stop;
    };
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow();
    expect(Object.values(f.listeners).every((set) => set.size === 0)).toBe(true);
  });
});

describe('reviewer claimed seed cross-document guard', () => {
  it.each([false, true])(
    'retires invalid DPR at actual adoption with seed=%s while old RAF is suspended',
    async (seeded) => {
      const f = fixture();
      let prepared: Awaited<ReturnType<typeof prepareExperimentalInitialPaint>> | undefined;
      if (seeded) {
        const a = await f.show();
        prepared = await prepareExperimentalInitialPaint(
          f.host,
          a.serialized,
          a.binding,
          f.options
        );
      }
      const sink = f.sink();
      sink.commit(f.visual);
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      const iframe = document.createElement('iframe');
      document.body.append(iframe);
      const other = iframe.contentDocument!,
        otherWindow = iframe.contentWindow!;
      Object.defineProperty(otherWindow, 'innerWidth', { configurable: true, value: 1000 });
      Object.defineProperty(otherWindow, 'innerHeight', { configurable: true, value: 800 });
      Object.defineProperty(otherWindow, 'devicePixelRatio', { configurable: true, value: 2 });
      vi.spyOn(otherWindow, 'requestAnimationFrame').mockReturnValue(1);
      other.body.append(other.adoptNode(f.scope));
      f.scope.append(other.adoptNode(f.canvas), other.adoptNode(f.host));
      expect(f.host.ownerDocument).toBe(other);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const quality = f.host.dataset.materialQuality;
      sink.release(1);
      prepared?.dispose();
      expect(quality).not.toBe('self-optical');
    }
  );
});

describe('preparation observer ownership regressions', () => {
  it('does not let a late callback from a retired verification subscription withdraw the sink', async () => {
    const f = fixture(),
      a = await f.show();
    const subscribe = f.options.source.subscribe;
    const callbacks: Array<() => void> = [];
    f.options.source.subscribe = (callback) => {
      callbacks.push(callback);
      return subscribe(callback);
    };
    const prepared = await prepareExperimentalInitialPaint(
      f.host,
      a.serialized,
      a.binding,
      f.options
    );
    const sink = f.sink();
    sink.commit(f.visual);
    const image = f.host.style.backgroundImage;
    callbacks[0]();
    expect(f.host.style.backgroundImage).toBe(image);
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    sink.release(1);
    prepared.dispose();
  });
  it.each([false, true])(
    'keeps the sink resize subscription after preparation cleanup with seed=%s',
    async (seeded) => {
      const observers: Array<{ targets: Set<Element>; callback: () => void }> = [];
      const frames: FrameRequestCallback[] = [];
      const Original = window.ResizeObserver;
      Object.defineProperty(window, 'ResizeObserver', {
        configurable: true,
        value: class {
          targets = new Set<Element>();
          constructor(public callback: () => void) {
            observers.push(this);
          }
          observe(target: Element) {
            this.targets.add(target);
          }
          unobserve(target: Element) {
            this.targets.delete(target);
          }
          disconnect() {
            this.targets.clear();
          }
        },
      });
      vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
      const f = fixture();
      let prepared: Awaited<ReturnType<typeof prepareExperimentalInitialPaint>> | undefined;
      try {
        if (seeded) {
          const a = await f.show();
          prepared = await prepareExperimentalInitialPaint(
            f.host,
            a.serialized,
            a.binding,
            f.options
          );
        }
        const sink = f.sink();
        sink.commit(f.visual);
        const active = observers.filter((observer) => observer.targets.has(f.host));
        expect(active).toHaveLength(1);
        f.targetRect.mockReturnValue(rect(40, 30, 120, 40));
        active[0].callback();
        for (const callback of frames.splice(0)) callback(1);
        expect((gpu.render.mock.lastCall![0] as OpticalFrame).geometry.width).toBe(120);
        sink.release(1);
        prepared?.dispose();
        expect(observers.every((observer) => !observer.targets.has(f.host))).toBe(true);
      } finally {
        Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: Original });
      }
    }
  );
});

describe('reviewer repair pending external owner guard', () => {
  it('withdraws its SSR selector when an author replaces paint during artifact hashing', async () => {
    const f = fixture(),
      a = await f.show();
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let unblock: (() => void) | null = null;
    let first = true;
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      }
      return original(algorithm, data);
    });
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    const rejected = expect(pending).rejects.toThrow('unavailable');
    await vi.waitFor(() => expect(unblock).not.toBeNull());
    f.host.style.backgroundImage = 'linear-gradient(red,blue)';
    f.invalidate('source');
    unblock!();
    await rejected;
    expect(f.host.style.backgroundImage).toBe('linear-gradient(red, blue)');
    expect(readInternalInitialPaintLease(f.host)).toBeNull();
    expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
  });
});

describe('reviewer repair existing replacement marker', () => {
  it('does not remove an already replaced marker on early missing-source rejection', async () => {
    const f = fixture(),
      a = await f.show();
    f.host.setAttribute('data-pui-initial-seed', 'author-plane');
    f.host.style.backgroundImage = 'linear-gradient(red,blue)';
    f.removeSource();
    await expect(
      prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options)
    ).rejects.toThrow();
    expect(f.host.getAttribute('data-pui-initial-seed')).toBe('author-plane');
    expect(f.host.style.backgroundImage).toBe('linear-gradient(red, blue)');
  });
});

describe('pending server tuple replacement coverage', () => {
  const replacements = [
    ['background-image', 'linear-gradient(red, blue)'],
    ['background-color', 'rgb(1, 2, 3)'],
    ['background-origin', 'content-box'],
    ['background-clip', 'padding-box'],
    ['background-size', '25% 25%'],
    ['background-repeat', 'repeat'],
  ] as const;
  for (const phase of ['before', 'during'] as const)
    it.each(replacements)(
      `preserves %s replaced ${phase} verification and clears only its selector`,
      async (name, value) => {
        const f = fixture(),
          a = await f.show();
        let unblock: (() => void) | null = null;
        if (phase === 'before') f.host.style.setProperty(name, value);
        else {
          const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
          let first = true;
          vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(
            async (algorithm, data) => {
              if (first) {
                first = false;
                await new Promise<void>((resolve) => {
                  unblock = resolve;
                });
              }
              return digest(algorithm, data);
            }
          );
        }
        const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
        const rejected = expect(pending).rejects.toThrow();
        if (phase === 'during') {
          await vi.waitFor(() => expect(unblock).not.toBeNull());
          f.host.style.setProperty(name, value);
          f.invalidate('source');
          unblock!();
        }
        await rejected;
        expect(f.host.style.getPropertyValue(name)).toBe(value);
        expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
        expect(readInternalInitialPaintLease(f.host)).toBeNull();
      }
    );
  it('keeps a replacement marker when verification itself rejects', async () => {
    const f = fixture(),
      a = await f.show();
    f.host.setAttribute('data-pui-initial-seed', 'author-plane');
    await expect(
      prepareExperimentalInitialPaint(
        f.host,
        a.serialized,
        { ...a.binding, artifactSha256: '0'.repeat(64) },
        f.options
      )
    ).rejects.toThrow();
    expect(f.host.getAttribute('data-pui-initial-seed')).toBe('author-plane');
  });
});

it('never leaves an SSR fallback selector targeting a foreign marker or a claimed live plane', async () => {
  const f = fixture(),
    a = await f.show(),
    p = initialPaintPresentation(a.receipt, 'rest-host');
  const defaultSelector = p.css.slice(0, p.css.indexOf('{'));
  expect(f.host.matches(defaultSelector)).toBe(true);
  f.host.setAttribute('data-pui-initial-seed', a.receipt.image.pngSha256 + ':rejected');
  expect(f.host.matches(defaultSelector)).toBe(true);
  f.host.setAttribute('data-pui-initial-seed', 'author-plane');
  expect(f.host.matches(defaultSelector)).toBe(false);
  f.host.removeAttribute('data-pui-initial-seed');
  expect(f.host.matches(defaultSelector)).toBe(false);
  expect(p.css).not.toContain('#rest-host{');
});

describe('reviewer exact owner malformed proof', () => {
  it.each(['json', 'shape'])(
    'selects opaque SSR state after own %s proof rejects',
    async (kind) => {
      const f = fixture(),
        a = await f.show();
      const serialized =
        kind === 'json'
          ? a.serialized + 'broken'
          : JSON.stringify({ ...a.receipt, unexpected: true });
      await expect(
        prepareExperimentalInitialPaint(f.host, serialized, a.binding, f.options)
      ).rejects.toThrow();
      expect(readInternalInitialPaintLease(f.host)).toBeNull();
      expect(f.host.getAttribute('data-pui-initial-seed')).not.toBe(a.receipt.image.pngSha256);
    }
  );
});

describe('trusted server owner and fallible proof rejection matrix', () => {
  const failures = [
    'no payload',
    'undefined payload',
    'null payload',
    'malformed JSON',
    'unknown receipt field',
    'wrong receipt profile',
    'manifest hash',
    'missing manifest hash',
    'layout binding',
    'manifest profile',
    'unknown manifest field',
    'digest rejection',
  ] as const;
  for (const owner of ['own', 'foreign', 'author style'] as const)
    it.each(failures)(
      `${owner}: %s rejects without stealing paint or leaving listeners`,
      async (failure) => {
        const f = fixture(),
          a = await f.show();
        if (owner === 'foreign') f.host.setAttribute('data-pui-initial-seed', 'author-plane');
        if (owner === 'author style') f.host.style.backgroundImage = 'linear-gradient(red, blue)';
        const originalStyle = f.host.getAttribute('style');
        let serialized = a.serialized,
          binding = { ...a.binding };
        if (failure === 'no payload') serialized = '';
        if (failure === 'undefined payload') serialized = undefined as unknown as string;
        if (failure === 'null payload') serialized = null as unknown as string;
        if (failure === 'malformed JSON') serialized += 'bad';
        if (failure === 'unknown receipt field')
          serialized = JSON.stringify({ ...a.receipt, unknown: true });
        if (failure === 'wrong receipt profile')
          serialized = JSON.stringify({ ...a.receipt, version: 'unknown' });
        if (failure === 'manifest hash') binding.artifactSha256 = '0'.repeat(64);
        if (failure === 'missing manifest hash')
          binding = { ...binding, artifactSha256: undefined } as unknown as typeof binding;
        if (failure === 'layout binding') binding.layoutId = 'different-layout';
        if (failure === 'manifest profile')
          binding = { ...binding, profile: 'unknown' } as unknown as typeof binding;
        if (failure === 'unknown manifest field')
          binding = { ...binding, unknown: true } as typeof binding;
        if (failure === 'digest rejection')
          vi.spyOn(globalThis.crypto.subtle, 'digest').mockRejectedValue(
            new Error('digest rejected')
          );
        await expect(
          prepareExperimentalInitialPaint(f.host, serialized, binding, f.options)
        ).rejects.toThrow();
        expect(readInternalInitialPaintLease(f.host)).toBeNull();
        expect(Object.values(f.listeners).every((set) => set.size === 0)).toBe(true);
        if (owner === 'own')
          expect(f.host.getAttribute('data-pui-initial-seed')).toBe(
            a.receipt.image.pngSha256 + ':rejected'
          );
        if (owner === 'foreign') {
          expect(f.host.getAttribute('data-pui-initial-seed')).toBe('author-plane');
          expect(f.host.getAttribute('style')).toBe(originalStyle);
        }
        if (owner === 'author style') {
          expect(f.host.hasAttribute('data-pui-initial-seed')).toBe(false);
          expect(f.host.style.backgroundImage).toBe('linear-gradient(red, blue)');
        }
      }
    );
  it('uses the synchronously captured manifest and owner across an asynchronous digest', async () => {
    const f = fixture(),
      a = await f.show();
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let first = true,
      unblock: (() => void) | null = null;
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      }
      return original(algorithm, data);
    });
    const pending = prepareExperimentalInitialPaint(f.host, a.serialized, a.binding, f.options);
    await vi.waitFor(() => expect(unblock).not.toBeNull());
    a.binding.artifactSha256 = '0'.repeat(64);
    a.binding.serverPaint = { dataUrl: png(100, 40, 0), pngSha256: '0'.repeat(64) };
    unblock!();
    const prepared = await pending;
    expect(prepared.receipt.image.pngSha256).toBe(a.receipt.image.pngSha256);
    prepared.dispose();
  });
  it('rejects a proof whose output differs from the independent build-side plane', async () => {
    const f = fixture(),
      a = await f.artifact();
    await expect(
      verifyInitialPaintArtifact(a.serialized, {
        ...a.binding,
        serverPaint: { dataUrl: png(100, 40, 0), pngSha256: a.receipt.image.pngSha256 },
      })
    ).rejects.toThrow('server-plane-binding');
  });
});

describe('real WC seed handoff investigation', () => {
  it('records a real Surface first frame before subsequent seeded admission', async () => {
    const { AdaptToWebComponent, setElementProps } =
      await import('@proto.ui/adapter-web-component');
    const { default: surface } = await import('@proto.ui/prototypes-liquid-glass/surface');
    const { THEME } = await import('../../../prototypes/liquid-glass/src/theme');
    let f: ReturnType<typeof fixture>;
    const frames: VisualFeedbackFrame[] = [];
    AdaptToWebComponent(surface, {
      registerAs: 'seed-probe-defined',
      createVisualSink: (host, effects) => {
        const sink = createWebMaterialSink(host, effects, f.options);
        return {
          commit(frame) {
            frames.push(frame);
            sink.commit(frame);
          },
          release(view) {
            sink.release(view);
          },
        };
      },
    });
    f = fixture('seed-probe-defined', false);
    f.options.palette.current = () => ({ revision: 1, colors: THEME.light });
    f.host.style.color = 'rgb(29, 29, 31)';
    setElementProps(f.host, {
      variant: 'outline',
      radius: 'full',
      border: 'none',
      elevation: 'none',
    });
    document.body.append(f.scope);

    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(frames).toHaveLength(1);
    expect(frames[0].style.tokens).toEqual([
      'rounded-full',
      'border-0',
      'bg-background',
      'text-foreground',
    ]);
    f.scope.remove();
  });
});

describe('WC acquisition preserves the registered initial plane (synthetic layout/GPU)', () => {
  it('keeps an admitted seed through the real Surface mount transaction and delayed decode', async () => {
    const { AdaptToWebComponent, setElementProps } =
      await import('@proto.ui/adapter-web-component');
    const { default: surface } = await import('@proto.ui/prototypes-liquid-glass/surface');
    let f: ReturnType<typeof fixture>;
    const Constructor = AdaptToWebComponent(surface, {
      registerAs: 'seed-transaction-control',
      createVisualSink: (host, effects) => createWebMaterialSink(host, effects, f.options),
    });
    f = fixture('seed-transaction-control', false);
    setElementProps(f.host, {
      variant: 'outline',
      radius: 'full',
      border: 'none',
      elevation: 'none',
    });
    const a = await f.show({
      ...f.visual,
      style: {
        kind: 'tw',
        tokens: ['rounded-full', 'border-0', 'bg-background', 'text-foreground'],
      },
      material: {
        ...f.visual.material,
        candidates: [{ intent: 'liquid-glass', variant: 'regular' }],
      },
    });
    // Hold only the custom-element connection callback to model the native
    // unknown-element SSR phase on happy-dom without its upgrade replacement.
    // Preparation observes a genuinely connected host; no guard is stubbed.
    const prototype = Constructor.prototype as unknown as HTMLElement & {
      connectedCallback(): void;
    };
    const connect = prototype.connectedCallback;
    const held = vi.spyOn(prototype, 'connectedCallback').mockImplementation(() => {});
    document.body.append(f.scope);
    const prepared = await prepareExperimentalInitialPaint(
      f.host,
      a.serialized,
      a.binding,
      f.options
    );
    held.mockRestore();
    const lease = readInternalInitialPaintLease(f.host)!;
    const retire = vi.spyOn(lease, 'retire');
    decode.delayed = true;
    connect.call(f.host);
    expect(retire).not.toHaveBeenCalled();
    expect(f.host.style.backgroundImage).toContain(a.receipt.image.dataUrl);
    expect(f.host.dataset.materialReason).not.toBe('preparing');
    expect(f.host.dataset.materialQuality).not.toBe('self-optical');
    decode.ready!();
    expect(f.host.dataset.materialQuality).toBe('self-optical');
    // A real later source revocation must still synchronously withdraw paint.
    f.removeSource();
    expect(f.host.style.backgroundImage).toBe('none');
    f.scope.remove();
    prepared.dispose();
  });
});

describe('finite initial-paint scene contrast inputs', () => {
  const foreground = resolvePaletteColor('#f5f5f7', {})!;
  const factors = [0.6425, 0.6425, 0.662];
  const modeledPixel = (hex: string, highlight: number) => {
    const source = resolvePaletteColor(hex, {})!;
    return [
      source[0] * factors[0] + highlight,
      source[1] * factors[1] + highlight,
      source[2] * factors[2] + highlight,
      1,
    ] as const;
  };

  it('retains the exact bright dark source as an unsafe native control', () => {
    const scene = initialPaintSceneColors('dark', true);
    expect(scene).toEqual({
      bands: ['#132138', '#235968', '#4b3b73', '#ae626b'],
      centre: '#7bafae',
    });
    expect(colorContrast(modeledPixel(scene.centre, 0), foreground)).toBeGreaterThan(4.5);
    // An ordinary highlight is enough to invalidate the old positive fixture.
    expect(colorContrast(modeledPixel(scene.centre, 0.08), foreground)).toBeLessThan(4.5);
  });

  it('gives the dark continuity source modeled headroom without asserting native admission', () => {
    const scene = initialPaintSceneColors('dark');
    for (const hex of [...scene.bands, scene.centre]) {
      // The fixed shader's two highlights sum to at most .18 in the modeled
      // engine; add three bytes of filtering/readback headroom. Native readPixels still
      // decides admission, including the inherited reversed-edge smoothstep.
      expect(colorContrast(modeledPixel(hex, 0.18 + 3 / 255), foreground)).toBeGreaterThan(4.5);
    }
  });

  it('preserves light pixels even when the negative-control query is present', () => {
    const expected = {
      bands: ['#d1e6fa', '#82c5c7', '#b6ace3', '#f1b5bf'],
      centre: '#e8e3ac',
    };
    expect(initialPaintSceneColors('light')).toEqual(expected);
    expect(initialPaintSceneColors('light', true)).toEqual(expected);
  });
});
