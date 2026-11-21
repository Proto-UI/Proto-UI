import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeLiquidToggleSnapshot } from './liquid-toggle-snapshot';
import { observeOwnedMaterialPaint } from './material-paint-observation';

const imageA = 'url("data:image/png;base64,AAAA")';
const imageB = 'url("data:image/png;base64,BBBB")';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});
function fixture(onDecode: (call: number) => void | Promise<void> = () => {}) {
  const host = document.createElement('button');
  host.setAttribute('aria-pressed', 'false');
  host.setAttribute('aria-disabled', 'false');
  host.setAttribute('data-pui-material-carrier', 'contact-v1');
  host.style.setProperty('--pui-material-image', imageA);
  Object.assign(host.dataset, {
    materialQuality: 'self-optical',
    materialReason: 'rendered',
    materialSource: 'visible-app-canvas',
    materialFrame: '1',
    materialSourceRevision: '7',
    materialPhase: 'rest',
    materialContact: 'held',
    materialMotion: 'press',
    materialProfile: 'liquidgl-v2-contact-canvas-1',
    materialContactSession: '1',
  });
  document.body.append(host);
  const css = {
    backgroundColor: 'rgb(0, 0, 0)',
    color: 'rgb(255, 255, 255)',
    backgroundImage: 'none',
    borderTopLeftRadius: '9999px',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    borderTopColor: 'rgb(255, 255, 255)',
    textDecorationLine: 'none',
    boxShadow: 'none',
    opacity: '1',
    pointerEvents: 'auto',
    backdropFilter: 'none',
    getPropertyValue: (name: string) =>
      ({
        '--pui-primary': 'rgb(0, 97, 204)',
        '--pui-primary-foreground': 'rgb(255, 255, 255)',
        '--pui-secondary': 'rgb(255, 255, 255)',
        '--pui-secondary-foreground': 'rgb(29, 29, 31)',
      })[name] ?? 'rgb(255, 255, 255)',
  };
  const pseudo = {
    backgroundImage: imageA,
    content: '""',
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: '-1',
    visibility: 'visible',
    opacity: '1',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    left: '-10px',
    top: '-10px',
    width: '118px',
    height: '58px',
  };
  let rect = new DOMRect(40, 50, 100, 40);
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => rect);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (_el, part) => (part ? pseudo : css) as unknown as CSSStyleDeclaration
  );
  vi.stubGlobal('CSS', { supports: () => true });
  const pixels = {
    at: (x: number, _y: number): number[] => (x % 2 ? [20, 40, 60, 255] : [80, 100, 120, 255]),
  };
  class Canvas {
    constructor(
      public width: number,
      public height: number
    ) {}
    getContext() {
      const ctx = {
        fillStyle: '',
        clearRect() {},
        fillRect() {},
        drawImage() {},
        getImageData: () => {
          if (this.width === 1 && this.height === 1) {
            const values = ctx.fillStyle.match(/[\d.]+/g)!.map(Number);
            return {
              data: new Uint8ClampedArray([
                ...values.slice(0, 3),
                values.length > 3 ? values[3] * 255 : 255,
              ]),
            };
          }
          const data = new Uint8ClampedArray(this.width * this.height * 4);
          for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++)
              data.set(pixels.at(x, y), (y * this.width + x) * 4);
          return { data };
        },
      };
      return ctx;
    }
  }
  vi.stubGlobal('OffscreenCanvas', Canvas);
  const decode = vi.fn(async () => {
    await onDecode(decode.mock.calls.length);
  });
  const imageSize = { width: 118, height: 58 };
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      get width() {
        return this.src.includes('BBBB') ? 218 : imageSize.width;
      }
      get height() {
        return imageSize.height;
      }
      decode = decode;
    }
  );
  return {
    host,
    css,
    pseudo,
    decode,
    pixels,
    imageSize,
    updateImage() {
      pseudo.backgroundImage = imageB;
      host.style.setProperty('--pui-material-image', imageB);
      host.dataset.materialFrame = '2';
      host.dataset.materialSourceRevision = '8';
    },
    resize() {
      rect = new DOMRect(40, 50, 110, 40);
      pseudo.width = '130px';
      pseudo.left = '-11px';
      pseudo.top = '-11px';
      pseudo.height = '60px';
    },
  };
}
describe('Liquid Toggle immutable committed snapshot (modeled decode timing, not native paint)', () => {
  it('rejects mixed pre-decode image and live post-decode CSS by resampling the new commit', async () => {
    const f = fixture((call) => {
      if (call === 1) f.updateImage();
    });
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.image).toBe(imageB);
    expect(facts.carrier.image).toBe(facts.image);
    expect(facts.receipt).toMatchObject({ frame: '2', sourceRevision: '8' });
    expect(facts.paint.image).toBe(facts.image);
    expect(facts.paint.committed).toBe(true);
    expect(facts.pixels?.width).toBe(218);
    expect(f.decode).toHaveBeenCalledTimes(2);
  });
  it('captures receipt, CSS and paint on the same stable commit', async () => {
    const f = fixture();
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.image).toBe(imageA);
    expect(facts.receipt).toMatchObject({ frame: '1', sourceRevision: '7' });
    expect(facts.paint).toMatchObject(observeOwnedMaterialPaint(f.host));
    expect(facts.snapshot).toEqual({ attempts: 1, verifiedAfterDecode: true });
    expect(f.decode).toHaveBeenCalledOnce();
  });
  it.each(['idle', 'hover', 'focus'])(
    'registers the neutral %s content inside the full declared contact footprint',
    async () => {
      const f = fixture();
      f.host.dataset.materialContact = 'rest';
      f.pixels.at = (x, y) =>
        x >= 22 && x < 96 && y >= 18 && y < 40 ? [0, 97, 204, 255] : [255, 255, 255, 32];
      for (const profile of ['liquidgl-v2-contact-canvas-1', 'pui-regular-style-tint-contact-5']) {
        f.host.dataset.materialProfile = profile;
        Object.assign(f.pseudo, { left: '-10px', top: '-10px', width: '118px', height: '58px' });
        const facts = await observeLiquidToggleSnapshot(f.host);
        expect(facts.paint).toMatchObject(observeOwnedMaterialPaint(f.host));
        expect(facts.paint).toMatchObject({
          committed: true,
          geometryMatches: true,
          paintOutset: 9,
        });
        expect(facts.snapshot.verifiedAfterDecode).toBe(true);
        expect(facts.pixels!.content).toMatchObject({
          contentPixels: 74 * 22,
          opaquePixels: 74 * 22,
          partialAlphaPixels: 0,
          transparentPixels: 0,
        });
        expect(facts.pixels!.tint.meanRgb).toEqual([0, 97, 204]);
        Object.assign(f.pseudo, { left: '-1px', top: '-1px', width: '100px', height: '40px' });
        expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
      }
    }
  );
  it.each([
    ['held', 'rest'],
    ['held', 'pressed'],
    ['release', 'rest'],
    ['rest', 'pressed'],
  ])('keeps expanded pixel registration for contact=%s phase=%s', async (contact, phase) => {
    const f = fixture();
    f.host.dataset.materialContact = contact;
    f.host.dataset.materialPhase = phase;
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.paint).toMatchObject(observeOwnedMaterialPaint(f.host));
    expect(facts.paint).toMatchObject({ committed: true, paintOutset: 9 });
    expect(facts.pixels!.content.contentPixels).toBe(74 * 22);
    Object.assign(f.pseudo, { left: '-1px', top: '-1px', width: '100px', height: '40px' });
    expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
  });
  it('rejects a collapsed neutral carrier, unknown state and a scaled carrier', async () => {
    const f = fixture();
    f.host.dataset.materialContact = 'rest';
    Object.assign(f.pseudo, { left: '-1px', top: '-1px', width: '100px', height: '40px' });
    expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
    Object.assign(f.pseudo, { left: '-10px', top: '-10px', width: '118px', height: '58px' });
    f.host.dataset.materialContact = 'unknown';
    f.host.dataset.materialPhase = 'pressed';
    expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
    f.host.dataset.materialContact = 'held';
    f.host.dataset.materialPhase = 'unknown';
    expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
    f.host.dataset.materialPhase = 'rest';
    Object.assign(f.pseudo, { left: '-19px', top: '-19px', width: '236px', height: '116px' });
    expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
  });
  it.each(['', 'unknown', 'pui-regular-style-tint-5', 'liquidgl-v2-app-canvas-1'])(
    'does not infer pointer-contact commitment from profile %j and expanded pixels',
    async (profile) => {
      const f = fixture();
      f.host.dataset.materialProfile = profile;
      expect((await observeLiquidToggleSnapshot(f.host)).paint.committed).toBe(false);
    }
  );
  it('measures a nonempty content ROI against the foreground from that exact receipt', async () => {
    const f = fixture();
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.pixels!.content).toMatchObject({
      roi: { left: 13, top: 9, right: 87, bottom: 31 },
      contentPixels: 74 * 22,
      validPixels: 74 * 22,
      opaquePixels: 74 * 22,
      partialAlphaPixels: 0,
      transparentPixels: 0,
      foreground: [255, 255, 255, 255],
    });
    expect(facts.pixels!.content.minForegroundContrast).toBeGreaterThanOrEqual(4.5);
    expect(facts.pixels!.tint).toMatchObject({
      meanRgb: [50, 70, 90],
      primary: [0, 97, 204, 255],
      blueDominantFraction: 1,
    });
  });
  it('excludes the outer carrier shadow from content contrast and tint statistics', async () => {
    const f = fixture();
    f.pixels.at = (x, y) =>
      x >= 22 && x < 96 && y >= 18 && y < 40 ? [0, 97, 204, 255] : [255, 255, 255, 32];
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.pixels!.content.partialAlphaPixels).toBe(0);
    expect(facts.pixels!.content.minForegroundContrast).toBeGreaterThanOrEqual(4.5);
    expect(facts.pixels!.tint.meanRgb).toEqual([0, 97, 204]);
    expect(facts.pixels!.tint.meanAbsoluteDistanceToPrimary).toBe(0);
  });
  it('does not use transparent host fallback contrast as optical contrast', async () => {
    const f = fixture();
    f.css.backgroundColor = 'rgba(0, 0, 0, 0)';
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.fallbackContrast).toBeNull();
    expect(facts.pixels!.content.minForegroundContrast).toBeGreaterThanOrEqual(4.5);
  });
  it('composites partial alpha conservatively instead of treating dark decoded RGB as opaque', async () => {
    const f = fixture();
    f.pixels.at = () => [0, 0, 0, 128];
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.pixels!.content.validPixels).toBeGreaterThan(0);
    expect(facts.pixels!.content.partialAlphaPixels).toBe(facts.pixels!.content.validPixels);
    expect(facts.pixels!.content.minForegroundContrast).toBeLessThan(4.5);
  });
  it('does not pass transparent pixels or an empty content ROI by vacuous minimum', async () => {
    const f = fixture();
    f.pixels.at = () => [0, 97, 204, 0];
    const transparent = await observeLiquidToggleSnapshot(f.host);
    expect(transparent.pixels!.content.validPixels).toBe(0);
    expect(transparent.pixels!.content.minForegroundContrast).toBe(1);
    expect(transparent.pixels!.tint.meanRgb).toBeNull();
    f.css.paddingLeft = '100px';
    const empty = await observeLiquidToggleSnapshot(f.host);
    expect(empty.pixels!.content.contentPixels).toBe(0);
    expect(empty.pixels!.content.minForegroundContrast).toBeNull();
    expect(empty.pixels!.tint.blueDominantFraction).toBeNull();
  });
  it('retries a changed foreground and never pairs old pixels with the old foreground', async () => {
    const f = fixture((call) => {
      if (call === 1) f.css.color = 'rgb(0, 0, 0)';
    });
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.pixels!.content.foreground).toEqual([0, 0, 0, 255]);
    expect(facts.pixels!.content.minForegroundContrast).toBeLessThan(4.5);
    expect(f.decode).toHaveBeenCalledTimes(2);
  });
  it('detects a new receipt even when the encoded image is unchanged', async () => {
    const f = fixture((call) => {
      if (call === 1) {
        f.host.dataset.materialFrame = '2';
        f.host.setAttribute('aria-pressed', 'true');
        f.css.textDecorationLine = 'underline';
      }
    });
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.receipt.frame).toBe('2');
    expect(facts.active).toBe('true');
    expect(facts.underline).toBe('underline');
    expect(f.decode).toHaveBeenCalledTimes(2);
  });
  it('rechecks CSS and source receipts even when the image and frame counter are unchanged', async () => {
    const f = fixture((call) => {
      if (call === 1) {
        f.css.boxShadow = 'rgb(0, 0, 0) 0px 1px 2px';
        f.host.dataset.materialSourceRevision = '8';
      }
    });
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.receipt.frame).toBe('1');
    expect(facts.receipt.sourceRevision).toBe('8');
    expect(facts.shadow).toBe(f.css.boxShadow);
    expect(f.decode).toHaveBeenCalledTimes(2);
  });
  it('retries a superseded decode error but only accepts the replacement current snapshot', async () => {
    const f = fixture((call) => {
      if (call === 1) {
        f.updateImage();
        throw new Error('superseded image decode failed');
      }
    });
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.image).toBe(imageB);
    expect(facts.pixels?.width).toBe(218);
    expect(f.decode).toHaveBeenCalledTimes(2);
  });
  it('is self-contained when serialized like a Playwright evaluate callback', async () => {
    const f = fixture();
    const serialized = new Function(
      `return (${observeLiquidToggleSnapshot.toString()});`
    )() as typeof observeLiquidToggleSnapshot;
    const facts = await serialized(f.host);
    expect(facts.paint.committed).toBe(true);
    expect(facts.receipt.frame).toBe('1');
    expect(f.decode).toHaveBeenCalledOnce();
  });
  it('rechecks geometry instead of attaching later paint bounds to earlier CSS', async () => {
    const f = fixture((call) => {
      if (call === 1) f.resize();
    });
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.width).toBe(110);
    expect(facts.paint.hostGeometry.width).toBe(110);
    expect(facts.paint.geometryMatches).toBe(true);
    expect(f.decode).toHaveBeenCalledTimes(2);
  });
  it('does not turn a stable uncommitted carrier into accepted optical evidence', async () => {
    const f = fixture();
    f.pseudo.backgroundImage = imageB;
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.paint.committed).toBe(false);
    expect(f.decode).toHaveBeenCalledOnce();
  });
  it.each([
    { backgroundImage: 'none' },
    { backgroundImage: imageB },
    { left: '-9px' },
    { width: '100px' },
    { height: 'auto' },
    { content: '"author content"' },
    { position: 'relative' },
    { pointerEvents: 'auto' },
    { zIndex: '1' },
    { visibility: 'hidden' },
    { opacity: '0' },
    { backgroundSize: 'auto' },
    { backgroundRepeat: 'repeat' },
  ])('retains shared observer rejection for corrupted carrier %j', async (patch) => {
    const f = fixture();
    Object.assign(f.pseudo, patch);
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.paint).toMatchObject(observeOwnedMaterialPaint(f.host));
    expect(facts.paint.committed).toBe(false);
    expect(facts.snapshot.attempts).toBe(1);
  });
  it.each(['unknown-marker', 'duplicate-host-paint'])(
    'retains shared observer rejection for %s',
    async (condition) => {
      const f = fixture();
      if (condition === 'unknown-marker') f.host.setAttribute('data-pui-material-carrier', 'other');
      else f.css.backgroundImage = imageA;
      const facts = await observeLiquidToggleSnapshot(f.host);
      expect(facts.paint).toMatchObject(observeOwnedMaterialPaint(f.host));
      expect(facts.paint.committed).toBe(false);
      expect(facts.snapshot.attempts).toBe(1);
    }
  );
  it('keeps a stable decode error rather than retrying it away', async () => {
    const failure = new Error('corrupt committed image');
    const f = fixture(() => {
      throw failure;
    });
    await expect(observeLiquidToggleSnapshot(f.host)).rejects.toBe(failure);
    expect(f.decode).toHaveBeenCalledOnce();
  });
  it('fails boundedly when every decoded snapshot is superseded', async () => {
    const f = fixture((call) => {
      f.host.dataset.materialFrame = String(call + 1);
    });
    await expect(observeLiquidToggleSnapshot(f.host)).rejects.toThrow('did not stabilize after 4');
    expect(f.decode).toHaveBeenCalledTimes(4);
  });
  it('bounds a decode that never settles', async () => {
    vi.useFakeTimers();
    const f = fixture(() => new Promise(() => {}));
    const reading = observeLiquidToggleSnapshot(f.host);
    const rejected = expect(reading).rejects.toThrow('decode deadline');
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('observes ordinary fallback without fabricating a decoded image or commit', async () => {
    const f = fixture();
    f.host.removeAttribute('data-pui-material-carrier');
    f.host.dataset.materialQuality = 'opaque-fallback';
    const facts = await observeLiquidToggleSnapshot(f.host);
    expect(facts.image).toBe('none');
    expect(facts.paint.committed).toBe(false);
    expect(facts.pixels).toBeNull();
    expect(facts.snapshot).toEqual({ attempts: 1, verifiedAfterDecode: false });
    expect(f.decode).not.toHaveBeenCalled();
  });
});
