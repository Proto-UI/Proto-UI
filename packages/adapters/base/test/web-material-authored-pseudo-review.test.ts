import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanvasBackdropLease, inspectCanvasBackdrop } from '../src/material/source';
import {
  createContactCarrier,
  contactCarrierBounds,
  hasAuthoredPseudoPaint,
} from '../src/material/contact-carrier';
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
  it.each([
    ['outline', { outlineWidth: '240px', outlineStyle: 'solid' }],
    ['padding', { paddingRight: '200px' }],
    ['border', { borderRightWidth: '200px', borderRightStyle: 'solid' }],
    [
      'text overflow',
      { content: '\"A very long authored text string\"', whiteSpace: 'nowrap', fontSize: '300px' },
    ],
    ['margin', { marginLeft: '100px' }],
  ])('must reject overridden owned before: %s', (_name, override) => {
    const { host, lease, sibling, pseudos } = pseudoFixture();
    vi.mocked(sibling.getBoundingClientRect).mockReturnValue(rect(10, 30, 20, 20));
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
      expect(carrier.valid(undefined as any)).toBe(false);
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      const original = { ...pseudos['::before'] };
      Object.assign(pseudos['::before'], override);
      expect(carrier.valid('data:image/png;base64,AA==')).toBe(false);
      console.log(
        JSON.stringify({
          probe: _name,
          carrierValid: carrier.valid('data:image/png;base64,AA=='),
          authoredPaint: hasAuthoredPseudoPaint(sibling),
          bounds: contactCarrierBounds(sibling),
          admission: inspectCanvasBackdrop(host, lease.current()),
        })
      );
      const overriddenAdmission = inspectCanvasBackdrop(host, lease.current());
      pseudos['::before'] = original;
      expect(carrier.valid('data:image/png;base64,AA==')).toBe(true);
      expect(carrier.valid(undefined as any)).toBe(false);
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      expect(overriddenAdmission.valid).toBe(false);
    } finally {
      carrier.release();
    }
  });
  it('keeps a hidden ordinary sibling with no generated paint eligible', () => {
    const { host, lease, sibling } = pseudoFixture();
    vi.mocked(sibling.getBoundingClientRect).mockReturnValue(rect(40, 30, 20, 20));
    expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(false);
    sibling.style.visibility = 'hidden';
    expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
  });
  it('must reject visible owned before on visibility-hidden origin', () => {
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
      pseudos['::before'].left = '-220px';
      sibling.style.setProperty('--pui-material-left', '-220px');
      expect(carrier.valid('data:image/png;base64,AA==')).toBe(true);
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(false);
      sibling.style.visibility = 'hidden';
      expect(carrier.valid('data:image/png;base64,AA==')).toBe(true);
      console.log(
        JSON.stringify({
          probe: 'hidden owned origin',
          bounds: contactCarrierBounds(sibling),
          admission: inspectCanvasBackdrop(host, lease.current()),
        })
      );
      const hiddenAdmission = inspectCanvasBackdrop(host, lease.current());
      sibling.style.display = 'none';
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      sibling.style.display = 'block';
      sibling.style.opacity = '0';
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      sibling.style.opacity = '1';
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(false);
      pseudos['::before'].left = '0px';
      sibling.style.setProperty('--pui-material-left', '0px');
      expect(carrier.valid('data:image/png;base64,AA==')).toBe(true);
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(true);
      pseudos['::before'].left = '-220px';
      sibling.style.setProperty('--pui-material-left', '-220px');
      sibling.style.visibility = 'visible';
      expect(inspectCanvasBackdrop(host, lease.current()).valid).toBe(false);
      expect(hiddenAdmission.valid).toBe(false);
    } finally {
      carrier.release();
    }
  });
});
