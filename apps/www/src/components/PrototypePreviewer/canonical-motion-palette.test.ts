import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanonicalMotionPalette } from './canonical-motion-palette';
import { SHADCN_MOTION_PALETTE } from '../../generated/shadcn-motion-palette';
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function fixture(shadow = false) {
  const owner = document.createElement('div');
  document.body.append(owner);
  const el = document.createElement('span');
  (shadow ? owner.attachShadow({ mode: 'open' }) : owner).append(el);
  let mode: 'light' | 'dark' = 'light';
  const overrides = new Map<string, string>();
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    () =>
      ({
        getPropertyValue: (name: string) =>
          overrides.get(name) ??
          SHADCN_MOTION_PALETTE[mode].expectedInputs[
            name.slice(6) as keyof typeof SHADCN_MOTION_PALETTE.light.expectedInputs
          ] ??
          '',
      }) as CSSStyleDeclaration
  );
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as any
  );
  return {
    owner,
    el,
    overrides,
    dark() {
      mode = 'dark';
      owner.classList.add('dark');
    },
  };
}
describe('canonical typed theme authority', () => {
  it.each([false, true])('accepts generated source including Shadow ancestry %s', (shadow) => {
    const h = fixture(shadow);
    const source = createCanonicalMotionPalette(h.el);
    expect(source.current().colors.primary).toEqual(SHADCN_MOTION_PALETTE.light.colors.primary);
    expect(source.current().diagnostics).toEqual([]);
    h.dark();
    expect(source.current().colors.input).toEqual([1, 1, 1, 0.15]);
  });
  it('revalidates silent CSSOM-like input changes on every current without deriving override colors', () => {
    const h = fixture();
    const source = createCanonicalMotionPalette(h.el);
    const before = source.current();
    h.overrides.set('--pui-primary', 'red');
    const changed = source.current();
    expect(changed.revision).toBeGreaterThan(before.revision);
    expect(changed.colors.primary).toBeUndefined();
    expect(changed.diagnostics).toContain('theme-source-mismatch:primary');
    expect(changed.colors.input).toEqual(before.colors.input);
    h.overrides.delete('--pui-primary');
    expect(source.current().colors.primary).toEqual(before.colors.primary);
  });
  it('normalizes whitespace but conservatively settles other serialization', () => {
    const h = fixture();
    const source = createCanonicalMotionPalette(h.el);
    h.overrides.set(
      '--pui-primary',
      '  ' + SHADCN_MOTION_PALETTE.light.expectedInputs.primary.replace(/ /g, '  ') + ' '
    );
    expect(source.current().colors.primary).toBeDefined();
    h.overrides.set('--pui-primary', 'rgb(20,20,20)');
    expect(source.current().colors.primary).toBeUndefined();
  });
  it('subscribes to source changes, ignores its own paint mutations, stops cleanly, and never polls idle', async () => {
    const h = fixture();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const source = createCanonicalMotionPalette(h.el);
    source.current();
    const invalidate = vi.fn();
    const off = source.subscribe(invalidate);
    h.el.style.backgroundColor = 'red';
    await Promise.resolve();
    expect(invalidate).not.toHaveBeenCalled();
    h.dark();
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(raf).not.toHaveBeenCalled();
    off();
    h.owner.classList.remove('dark');
    await Promise.resolve();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
