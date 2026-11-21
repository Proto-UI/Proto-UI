import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCanvasBackdropLease,
  inspectCanvasBackdrop,
} from '../../../../../../packages/adapters/base/src/material/source';
import { contactPaintOutset } from '../../../../../../packages/adapters/base/src/material/contact-profile';
import { appendLiquidHoverOverlapPaint } from './liquid-hover-fixture';

// Real admission implementation, injected geometry from a62 native receipts.
// This is a deterministic fixture regression, not browser/layout/GPU evidence.
const pageSource = readFileSync('apps/www/src/pages/en/test/liquid-glass-hover.astro', 'utf8');
const sceneCss = readFileSync(
  'apps/www/src/components/PrototypePreviewer/preview-material-scene.css',
  'utf8'
);
const sceneStyles: HTMLStyleElement[] = [];
const authoredReserve = Number(
  pageSource.match(/scene\.mount\.style\.paddingBottom = '(\d+)px'/)?.[1] ?? 0
);
const tightSource = pageSource.match(
  /if \(id === 'accordion-tight'\)([\s\S]*?)\n\s*scene\.pause/
)?.[1];
const authoredTightReserve = Number(
  tightSource?.match(/scene\.mount\.style\.paddingBottom = '(\d+)px'/)?.[1] ?? authoredReserve
);
const cases = [
  ['button', 130.546875, 38],
  ['toggle', 148.6875, 38],
  ['collapsible', 416, 46],
  ['select', 141.953125, 38],
  ['dropdown', 153.921875, 38],
] as const;
const rect = (x: number, y: number, w: number, h: number) => new DOMRect(x, y, w, h);
function layout(width: number, height: number, reserve: number, edge = false) {
  const scope = document.createElement('div');
  const canvas = document.createElement('canvas');
  const mount = document.createElement('div');
  const subject = document.createElement('button');
  const destination = document.createElement('div');
  destination.dataset.materialOverlayMount = '';
  destination.style.height = '0px';
  mount.append(subject);
  scope.append(canvas, mount, destination);
  document.body.append(scope);
  const inset = edge ? 0 : 48;
  const sourceHeight = height + reserve + inset * 2;
  vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 512, sourceHeight));
  vi.spyOn(subject, 'getBoundingClientRect').mockReturnValue(rect(inset, inset, width, height));
  vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue(
    rect(inset, inset, 416, height + reserve)
  );
  // Existing scene destination is real flow at mount.bottom, even at zero height.
  vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue(
    rect(inset, inset + height + reserve, 416, 0)
  );
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    getImageData: () => ({ data: new Uint8ClampedArray(512 * sourceHeight * 4).fill(255) }),
  } as any);
  const lease = createCanvasBackdropLease(scope, canvas);
  lease.draw(() => {});
  return { subject, scope, lease, outset: contactPaintOutset(width, height) };
}

// 0c07f62 native wc/react light/dark receipts agree on these tight rectangles:
// source (752, 51.90625, 512x196), subject (801, 100.90625, 414x50),
// Item (800, 99.90625, 416x52), destination (800, 199.90625, 416x0).
// The Item's one-pixel border contributes flow height; it is not a claim that
// source admission rejects ancestor borders. Current scene CSS makes an empty
// destination transparent. The repaired fixture supplies actual visible paint
// through its own helper, keeping these recorded flow rectangles unchanged.
function accordionLayout(reserve: number, inset = 0, visiblePaint = true) {
  const stylesheet = document.createElement('style');
  stylesheet.textContent = sceneCss;
  document.head.append(stylesheet);
  sceneStyles.push(stylesheet);
  const scope = document.createElement('div');
  const canvas = document.createElement('canvas');
  const mount = document.createElement('div');
  const item = document.createElement('div');
  const heading = document.createElement('div');
  const inner = document.createElement('div');
  const subject = document.createElement('button');
  const content = document.createElement('div');
  const destination = document.createElement('div');
  // Preserve the measured border width without defining ancestor-border paint
  // admission as a positive guarantee; the visible-border gap is diagnostic below.
  item.style.border = '1px solid transparent';
  content.style.display = 'none';
  destination.dataset.materialOverlayMount = '';
  destination.style.height = '0px';
  const paint = visiblePaint ? appendLiquidHoverOverlapPaint(destination) : null;
  inner.append(subject);
  heading.append(inner);
  item.append(heading, content);
  mount.append(item);
  scope.append(canvas, mount, destination);
  document.body.append(scope);
  const width = 414 - inset * 2;
  const height = 50;
  const sourceHeight = 148 + reserve + inset * 2;
  const subjectRect = rect(801 + inset, 100.90625 + inset, width, height);
  const destinationRect = rect(800, 151.90625 + inset * 2 + reserve, 416, 0);
  vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(752, 51.90625, 512, sourceHeight));
  vi.spyOn(subject, 'getBoundingClientRect').mockReturnValue(subjectRect);
  for (const element of [inner, heading])
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
      rect(801, 100.90625, 414, height + inset * 2)
    );
  vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(
    rect(800, 99.90625, 416, height + 2 + inset * 2)
  );
  vi.spyOn(mount, 'getBoundingClientRect').mockReturnValue(
    rect(800, 99.90625, 416, height + 2 + inset * 2 + reserve)
  );
  vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue(destinationRect);
  if (paint)
    vi.spyOn(paint, 'getBoundingClientRect').mockReturnValue(
      rect(destinationRect.left, destinationRect.top, 416, parseFloat(paint.style.height))
    );
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    getImageData: () => ({ data: new Uint8ClampedArray(512 * sourceHeight * 4).fill(255) }),
  } as any);
  const lease = createCanvasBackdropLease(scope, canvas);
  lease.draw(() => {});
  return {
    subject,
    item,
    lease,
    subjectRect,
    destinationRect,
    destination,
    paint,
    gap: destinationRect.top - subjectRect.bottom,
    outset: contactPaintOutset(width, height),
  };
}
afterEach(() => {
  document.body.replaceChildren();
  for (const stylesheet of sceneStyles.splice(0)) stylesheet.remove();
  vi.restoreAllMocks();
});
describe('hover positive fixture keeps the portal destination beyond the contact footprint', () => {
  for (const [part, width, height] of cases) {
    it(`${part}: unchanged guard admits the authored positive layout`, () => {
      const f = layout(width, height, authoredReserve);
      expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
        valid: true,
      });
      expect(authoredReserve).toBeGreaterThan(f.outset);
    });
    it(`${part}: a62 zero-reserve destination still rejects expanded paint`, () => {
      const f = layout(width, height, 0);
      expect(inspectCanvasBackdrop(f.subject, f.lease.current(), 0).valid).toBe(true);
      expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
        valid: false,
        reason: 'source-overlapping-content',
      });
    });
  }
  it('keeps a genuinely overlapping neighboring box rejected after positive reserve', () => {
    const f = layout(130, 38, authoredReserve);
    const neighbor = document.createElement('span');
    f.scope.append(neighbor);
    vi.spyOn(neighbor, 'getBoundingClientRect').mockReturnValue(rect(180, 48, 8, 38));
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: false,
      reason: 'source-overlapping-content',
    });
  });
  it('keeps the deliberate source-edge negative rejected after reserve', () => {
    const f = layout(130, 38, authoredReserve, true);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: false,
      reason: 'source-bounds-unavailable',
    });
  });
});

describe('Accordion tight negative retains actual destination overlap', () => {
  it('reproduces the current empty destination exemption instead of calling it visible paint', () => {
    const f = accordionLayout(authoredTightReserve, 0, false);
    expect(f.destination.matches(':empty')).toBe(true);
    expect(getComputedStyle(f.destination).opacity).toBe('0');
    expect(f.gap).toBe(1);
    expect(f.outset).toBe(35);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: true,
    });
  });
  it('requires the real fixture paint with current scene CSS and restores the exemption on removal', () => {
    expect(tightSource).toContain('appendLiquidHoverOverlapPaint(destination)');
    const f = accordionLayout(authoredTightReserve);
    expect(f.destination.matches(':empty')).toBe(false);
    expect(Number(getComputedStyle(f.destination).opacity || '1')).toBe(1);
    expect(f.paint!.getAttribute('aria-hidden')).toBe('true');
    expect(f.paint!.style.pointerEvents).toBe('none');
    expect(f.paint!.style.backgroundColor).toBe('currentcolor');
    expect(f.paint!.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(f.paint!.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), 0).valid).toBe(true);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: false,
      reason: 'source-overlapping-content',
    });
    f.paint!.remove();
    expect(getComputedStyle(f.destination).opacity).toBe('0');
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: true,
    });
  });
  it('correctly admits the observed 0c07f62 49px gap, which is no longer negative', () => {
    const f = accordionLayout(48);
    expect(f.outset).toBe(35);
    expect(f.gap).toBe(49);
    expect(f.destinationRect.top).toBeGreaterThan(f.subjectRect.bottom + f.outset);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: true,
    });
  });
  it('rejects the authored tight destination at 1px only for the expanded footprint', () => {
    const f = accordionLayout(authoredTightReserve);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), 0).valid).toBe(true);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: false,
      reason: 'source-overlapping-content',
    });
    expect(authoredTightReserve).toBe(0);
    expect(f.outset).toBe(35);
    expect(f.gap).toBe(1);
    expect(f.destinationRect.left).toBeLessThan(f.subjectRect.right + f.outset);
    expect(f.destinationRect.right).toBeGreaterThan(f.subjectRect.left - f.outset);
    expect(f.destinationRect.top).toBeGreaterThan(f.subjectRect.bottom);
    expect(f.destinationRect.top).toBeLessThan(f.subjectRect.bottom + f.outset);
  });
  it('keeps the normal 40px inset and 48px reserve admitted with an 89px gap', () => {
    const f = accordionLayout(authoredReserve, 40);
    expect(authoredReserve).toBe(48);
    expect(f.outset).toBe(28);
    expect(f.gap).toBe(89);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: true,
    });
  });
  it('retains the historical normal inset without reserve as a distinct admitted control', () => {
    const f = accordionLayout(0, 40);
    expect(f.outset).toBe(28);
    expect(f.gap).toBe(41);
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: true,
    });
  });
  it('diagnoses the ancestor-border coverage gap separately from opaque ancestor rejection', () => {
    const f = accordionLayout(48);
    f.item.style.borderColor = 'rgb(120, 120, 120)';
    // Diagnostic only: do not require a future source guard to keep admitting
    // ancestor border paint. A tighter guard may legitimately reject this case.
    console.info(
      'known-coverage-gap: ancestor border-only source admission (not an acceptance guarantee)',
      inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)
    );
    f.item.style.backgroundColor = 'rgb(255, 255, 255)';
    expect(inspectCanvasBackdrop(f.subject, f.lease.current(), f.outset)).toMatchObject({
      valid: false,
      reason: 'source-painted-ancestor',
    });
  });
});
