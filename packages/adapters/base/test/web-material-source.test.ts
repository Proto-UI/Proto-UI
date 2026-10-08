import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanvasBackdropLease, inspectCanvasBackdrop } from '../src/material/source';
import { createContactCarrier } from '../src/material/contact-carrier';
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
function fixture() {
  const scope = document.createElement('div'),
    canvas = document.createElement('canvas'),
    host = document.createElement('button');
  scope.append(canvas, host);
  document.body.append(scope);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 240));
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(40, 30, 100, 40));
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  const pixels = new Uint8ClampedArray(400 * 240 * 4).fill(255);
  vi.spyOn(canvas, 'getContext').mockReturnValue({ getImageData: () => ({ data: pixels }) } as any);
  const lease = createCanvasBackdropLease(scope, canvas);
  lease.draw(() => {});
  return { scope, canvas, host, lease };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe('visible in-app canvas backdrop lease', () => {
  it('captures the actual visible canvas and samples the same source coordinates', () => {
    const { host, lease, canvas } = fixture();
    expect(lease.current()?.canvas).toBe(canvas);
    expect(lease.current()?.revision).toBe(1);
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      valid: true,
      bounds: [0.1, 0.125, 0.25, 1 / 6],
    });
  });
  it('withdraws before callbacks and recovers at a new revision', () => {
    const { host, lease } = fixture(),
      listener = vi.fn(() => lease.current());
    lease.subscribe(listener);
    lease.revoke();
    expect(listener.mock.results[0].value).toBeNull();
    expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(false);
    lease.draw(() => {});
    expect(lease.current()?.revision).toBe(3);
    lease.dispose();
    expect(lease.current()).toBeNull();
    expect(() => lease.draw(() => {})).toThrow('Retired');
  });
  it('rejects portals, overlap, stale resize/DPR, and composed transforms', () => {
    const { host, lease, scope } = fixture();
    document.body.append(host);
    expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(false);
    scope.append(host);
    const other = document.createElement('div');
    scope.append(other);
    vi.spyOn(other, 'getBoundingClientRect').mockReturnValue(rect(70, 30, 40, 40));
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      reason: 'source-overlapping-content',
    });
    other.remove();
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      reason: 'source-resize-or-dpr-stale',
    });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    document.body.style.transform = 'translateX(1px)';
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      reason: 'source-ancestor-compositing-unavailable',
    });
    document.body.style.transform = '';
  });
  it('rejects a source hidden under opaque intermediate application paint', () => {
    const { host, lease, scope } = fixture(),
      panel = document.createElement('div');
    panel.style.backgroundColor = '#fff';
    scope.append(panel);
    panel.append(host);
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      reason: 'source-painted-ancestor',
    });
  });
});

describe('expanded contact paint source admission', () => {
  it('checks the full paint box without changing source mapping or hitbox', () => {
    const { host, lease } = fixture();
    expect(inspectCanvasBackdrop(host, lease.current(), 9)).toMatchObject({
      valid: true,
      bounds: [0.1, 0.125, 0.25, 1 / 6],
    });
    expect(inspectCanvasBackdrop(host, lease.current(), 31)).toMatchObject({
      valid: false,
      reason: 'source-bounds-unavailable',
    });
  });
  it('rejects content overlapping only the expansion', () => {
    const { host, lease, scope } = fixture();
    const other = document.createElement('div');
    scope.append(other);
    vi.spyOn(other, 'getBoundingClientRect').mockReturnValue(rect(143, 30, 20, 20));
    expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
    expect(inspectCanvasBackdrop(host, lease.current(), 9)).toMatchObject({
      reason: 'source-overlapping-content',
    });
  });
  it('checks clipping above a shadow-root boundary as well as ordinary ancestors', () => {
    const { host, lease, scope } = fixture();
    const outer = document.createElement('div');
    document.body.append(outer);
    outer.attachShadow({ mode: 'open' }).append(scope);
    outer.style.overflow = 'hidden';
    expect(inspectCanvasBackdrop(host, lease.current(), 9)).toMatchObject({
      reason: 'source-expanded-paint-clipped',
    });
  });
  it('rejects zoom and hidden source geometry before an expanded carrier can override visibility', () => {
    const { host, lease, scope } = fixture();
    host.style.visibility = 'hidden';
    expect(inspectCanvasBackdrop(host, lease.current(), 9).valid).toBe(false);
    host.style.visibility = 'visible';
    (scope.style as any).zoom = '2';
    expect(inspectCanvasBackdrop(host, lease.current(), 9).valid).toBe(false);
    (scope.style as any).zoom = '1';
    (scope.style as any).contentVisibility = 'hidden';
    expect(inspectCanvasBackdrop(host, lease.current(), 9).valid).toBe(false);
  });
  it('rejects clipping and paint containment instead of presenting a truncated contour', () => {
    const { host, lease, scope } = fixture();
    scope.style.overflow = 'hidden';
    expect(inspectCanvasBackdrop(host, lease.current(), 9)).toMatchObject({
      reason: 'source-expanded-paint-clipped',
    });
    scope.style.overflow = 'visible';
    host.style.contain = 'paint';
    expect(inspectCanvasBackdrop(host, lease.current(), 9)).toMatchObject({
      reason: 'source-expanded-paint-clipped',
    });
  });
});

// These explicit computed-style and rectangle inputs exercise admission, not
// browser layout or rendered pixels. A pseudo's fixed/absolute painted box can
// reach the material even when its originating element's border box cannot.
describe('authored pseudo source admission (computed-style inputs)', () => {
  function pseudoFixture() {
    const f = fixture(),
      sibling = document.createElement('div');
    sibling.style.position = 'relative';
    f.scope.append(sibling);
    vi.spyOn(sibling, 'getBoundingClientRect').mockReturnValue(rect(260, 30, 20, 20));
    const pseudos: Record<string, Record<string, string>> = {
      '::before': { content: 'none' },
      '::after': { content: 'none' },
    };
    const nativeStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
      element === sibling && pseudo
        ? (pseudos[pseudo] as unknown as CSSStyleDeclaration)
        : nativeStyle(element, pseudo)
    );
    return { ...f, sibling, pseudos };
  }
  const authoredPaint = {
    content: '\"\"',
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'fixed',
    left: '40px',
    top: '30px',
    width: '100px',
    height: '40px',
    backgroundColor: 'rgb(255, 0, 0)',
  };
  it.each(['::before', '::after'])(
    'rejects out-of-box authored %s and recovers when removed',
    (pseudo) => {
      const { host, lease, pseudos } = pseudoFixture();
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      pseudos[pseudo] = { ...authoredPaint };
      expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
        valid: false,
        reason: 'source-authored-pseudo-unavailable',
      });
      pseudos[pseudo].content = 'none';
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
    }
  );
  it('does not hide a visible pseudo behind its hidden originating element', () => {
    const { host, lease, sibling, pseudos } = pseudoFixture();
    sibling.style.visibility = 'hidden';
    pseudos['::after'] = { ...authoredPaint };
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      valid: false,
      reason: 'source-authored-pseudo-unavailable',
    });
  });
  it.each([
    { content: 'none' },
    { content: 'normal' },
    { display: 'none' },
    { visibility: 'hidden' },
    { visibility: 'collapse' },
    { opacity: '0' },
  ])('retains ordinary enhancement for nonpainted pseudo %j', (override) => {
    const { host, lease, pseudos } = pseudoFixture();
    pseudos['::before'] = { ...authoredPaint, ...override };
    expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
  });
  it('does not treat an author-supplied carrier marker as private ownership', () => {
    const { host, lease, sibling, pseudos } = pseudoFixture();
    sibling.setAttribute('data-pui-material-carrier', 'contact-v1');
    pseudos['::before'] = { ...authoredPaint };
    expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
      valid: false,
      reason: 'source-authored-pseudo-unavailable',
    });
  });
  it('retains bounded owned before paint, rejects its overlap and never exempts author after paint', () => {
    const { host, lease, sibling, pseudos } = pseudoFixture();
    sibling.style.isolation = 'isolate';
    const carrier = createContactCarrier(sibling);
    try {
      pseudos['::before'] = {
        ...authoredPaint,
        position: 'absolute',
        left: '0px',
        top: '0px',
        width: '20px',
        height: '20px',
        pointerEvents: 'none',
        zIndex: '-1',
        backgroundImage: 'url("data:image/png;base64,AA==")',
        backgroundSize: '100% 100%',
        backgroundPosition: '0% 0%',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
        backgroundOrigin: 'border-box',
        backgroundClip: 'border-box',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        overflowX: 'visible',
        overflowY: 'visible',
        outlineWidth: '0px',
        outlineStyle: 'none',
        transform: 'none',
      };
      for (const key of ['left', 'top', 'width', 'height'])
        sibling.style.setProperty(`--pui-material-${key}`, pseudos['::before'][key]);
      expect(carrier.valid('data:image/png;base64,AA==')).toBe(true);
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      pseudos['::before'].left = '-220px';
      expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
        valid: false,
        reason: 'source-overlapping-content',
      });
      pseudos['::before'].left = '0px';
      pseudos['::after'] = { ...authoredPaint };
      expect(inspectCanvasBackdrop(host, lease.current())).toMatchObject({
        valid: false,
        reason: 'source-authored-pseudo-unavailable',
      });
      pseudos['::after'].content = 'none';
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
    } finally {
      carrier.release();
    }
  });
});
