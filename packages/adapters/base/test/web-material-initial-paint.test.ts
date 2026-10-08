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
  const artifact = async () => {
    const receipt = await receiptFromAdmittedPaint(layout, visual, optical, image);
    const serialized = JSON.stringify(receipt);
    const binding = {
      artifactSha256: await digestText(serialized),
      layoutId: layout.id,
      profile: INITIAL_PAINT_PROFILE,
    };
    return { receipt, serialized, binding };
  };
  const show = async () => {
    const artifactValue = await artifact(),
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
      '(forced-colors:active){#rest-host{background-image:none!important;background-color:Canvas!important;color:CanvasText!important'
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
    expect(f.host.getAttribute('data-pui-initial-seed')).toBe('rejected');
    expect(readInternalInitialPaintLease(f.host)).toBeNull();
    expect(initialPaintPresentation(a.receipt, 'rest-host').css).toMatch(
      /^#rest-host\[data-pui-initial-seed\]\{background-image:none!important/
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
