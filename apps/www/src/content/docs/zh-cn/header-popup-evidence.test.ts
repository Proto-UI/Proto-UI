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
