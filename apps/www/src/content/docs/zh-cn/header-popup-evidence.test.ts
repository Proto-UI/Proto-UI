import { afterEach, expect, it, vi } from 'vitest';
import { transformSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import {
  headerPopupSettled,
  popupOptionContrast,
  readHeaderPopupPaint,
} from './header-popup-evidence';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('rejects entering, faded and running-animation popup frames', () => {
  document.body.innerHTML =
    '<div style="opacity:1"><div id="popup" style="opacity:1" data-transition-state="entering"></div></div>';
  const popup = document.getElementById('popup')!;
  const getAnimations = vi.fn(() => [] as Animation[]);
  Object.assign(popup, { getAnimations });
  expect(headerPopupSettled(popup)).toBe(false);
  popup.dataset.transitionState = 'entered';
  popup.style.opacity = '0.25';
  expect(headerPopupSettled(popup)).toBe(false);
  popup.style.opacity = '1';
  getAnimations.mockReturnValue([{ playState: 'running' } as Animation]);
  expect(headerPopupSettled(popup)).toBe(false);
  getAnimations.mockReturnValue([{ playState: 'finished' } as Animation]);
  expect(headerPopupSettled(popup)).toBe(true);
  popup.parentElement!.style.opacity = '0.5';
  expect(headerPopupSettled(popup)).toBe(false);
});
it('keeps browser capture callbacks self-contained under TSX name preservation', () => {
  for (const callback of [headerPopupSettled, readHeaderPopupPaint]) {
    const compiled = transformSync(`const probe = ${String(callback)};`, {
      loader: 'ts',
      format: 'cjs',
      keepNames: true,
    }).code;
    const probe = runInNewContext(`${compiled}\nprobe;`);
    expect(String(probe)).not.toMatch(/\b__name\s*\(/);
  }
});
it('distinguishes readable opaque pairs from dark-on-dark failures', () => {
  expect(
    popupOptionContrast([245, 245, 245, 255], [0, 0, 0, 0], [23, 23, 23, 255])
  ).toBeGreaterThan(4.5);
  expect(
    popupOptionContrast([0, 0, 0, 255], [82, 148, 255, 255], [23, 23, 23, 255])
  ).toBeGreaterThan(4.5);
  expect(popupOptionContrast([0, 0, 0, 255], [0, 0, 0, 0], [23, 23, 23, 255])).toBeLessThan(4.5);
});

function popupFixture(prototype = 'shadcn-select-content') {
  document.body.innerHTML = `<div role="listbox" data-projection-prototype="${prototype}"
    data-projection-owner="header-library" data-projection-generation="7"
    data-transition-state="entered" data-pui-style="outer-token"
    style="opacity:1;background-color:transparent;box-shadow:none">
    <div data-projection-prototype="shadcn-select-surface"
      data-projection-owner="header-library" data-projection-generation="7"
      data-pui-style="shadow-md" style="opacity:1;background-color:rgb(23, 23, 23);box-shadow:0px 2px 4px rgb(0, 0, 0)"></div>
  </div>`;
  const popup = document.querySelector('[role="listbox"]')!;
  Object.assign(popup, { getAnimations: () => [] });
  return { popup, surface: popup.firstElementChild! };
}

// Unit-only canvas fixture; native capture still measures real browser pixels.
function canvasFixture() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const context = {
      fillStyle: '',
      fillRect: () => {},
      getImageData: () => ({
        data: new Uint8ClampedArray(
          context.fillStyle === 'rgb(23, 23, 23)' ? [23, 23, 23, 255] : [0, 0, 0, 0]
        ),
      }),
    };
    return context as unknown as CanvasRenderingContext2D;
  });
}

it('reads the current Surface paint while retaining Content lifecycle evidence', () => {
  canvasFixture();
  const { popup, surface } = popupFixture();
  // A nested listbox is a different popup, not a duplicate of our Surface.
  const nested = document.createElement('div');
  nested.setAttribute('role', 'listbox');
  nested.append(surface.cloneNode());
  popup.append(nested);
  const paint = readHeaderPopupPaint(popup);
  expect(paint.backgroundRgba).toEqual([23, 23, 23, 255]);
  expect(paint.shadow).toBe(getComputedStyle(surface).boxShadow);
  expect(paint.shadow).not.toBe(getComputedStyle(popup).boxShadow);
  expect(paint.tokens).toBe('shadow-md');
  expect(paint.paintOwner).toEqual({
    prototype: 'shadcn-select-surface',
    owner: 'header-library',
    generation: '7',
  });
  expect(paint.state).toBe('entered');
  expect(paint.animations).toEqual([]);
});

it.each([
  'missing',
  'duplicate',
  'wrong-owner',
  'wrong-generation',
  'empty-owner',
  'empty-generation',
])('rejects %s Surface ownership before sampling paint', (fault) => {
  const { popup, surface } = popupFixture();
  if (fault === 'missing') surface.remove();
  if (fault === 'duplicate') popup.append(surface.cloneNode());
  if (fault === 'wrong-owner') surface.setAttribute('data-projection-owner', 'other');
  if (fault === 'wrong-generation') surface.setAttribute('data-projection-generation', '6');
  if (fault === 'empty-owner') popup.removeAttribute('data-projection-owner');
  if (fault === 'empty-generation') popup.removeAttribute('data-projection-generation');
  expect(() => readHeaderPopupPaint(popup)).toThrow(
    'Expected one current Shadcn Select Surface for Header popup paint'
  );
});

it('keeps non-Shadcn popup paint on the Content itself', () => {
  canvasFixture();
  const { popup } = popupFixture('brutalist-select-content');
  const paint = readHeaderPopupPaint(popup);
  expect(paint.backgroundRgba).toEqual([0, 0, 0, 0]);
  expect(paint.shadow).toBe('none');
  expect(paint.tokens).toBe('outer-token');
  expect(paint.paintOwner.prototype).toBe('brutalist-select-content');
});
