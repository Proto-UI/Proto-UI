import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createCanonicalMotionPalette } from './canonical-motion-palette';
import { SHADCN_MOTION_PALETTE } from '../../generated/shadcn-motion-palette';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-shadcn/switch';
import { collectProtoStyleTokens } from '../../../../../packages/cli/src/services/prototype-style-tokens';
import { renderProtoShadowSplitStyleArtifact } from '../../../../../packages/cli/src/services/proto-style-css';
let styleArtifact: ReturnType<typeof renderProtoShadowSplitStyleArtifact>;
beforeAll(async () => {
  const tokens = await collectProtoStyleTokens('packages/prototypes/shadcn/src/switch');
  styleArtifact = renderProtoShadowSplitStyleArtifact(
    tokens.map((token) => {
      if (typeof token !== 'string') throw new TypeError('Expected a collected style token string');
      return token;
    })
  );
});
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
    (surface) =>
      ({
        getPropertyValue: (name: string) =>
          !surface.isConnected
            ? ''
            : (overrides.get(name) ??
              SHADCN_MOTION_PALETTE[mode].expectedInputs[
                name.slice(6) as keyof typeof SHADCN_MOTION_PALETTE.light.expectedInputs
              ] ??
              ''),
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

describe('canonical palette source availability', () => {
  it.each([false, true])(
    'does not invent palette authority before connection, shadow=%s',
    (shadow) => {
      const h = fixture(shadow);
      h.owner.remove();
      const source = createCanonicalMotionPalette(h.el);
      vi.mocked(window.getComputedStyle).mockClear();
      const first = source.current();
      expect(first.colors).toEqual({});
      expect(first.diagnostics).toEqual(['theme-source-unavailable:detached']);
      expect(source.current().revision).toBe(first.revision);
      expect(window.getComputedStyle).not.toHaveBeenCalled();
      document.body.append(h.owner);
      const connected = source.current();
      expect(connected.revision).toBeGreaterThan(first.revision);
      expect(connected.colors.primary).toEqual(SHADCN_MOTION_PALETTE.light.colors.primary);
      expect(connected.diagnostics).toEqual([]);
    }
  );

  it.each([false, true])(
    'drops previous colors while detached and revalidates real overrides, shadow=%s',
    (shadow) => {
      const h = fixture(shadow);
      const source = createCanonicalMotionPalette(h.el);
      const before = source.current();
      h.owner.remove();
      h.dark();
      h.overrides.set('--pui-primary', 'rgb(10 20 30)');
      vi.mocked(window.getComputedStyle).mockClear();
      const detached = source.current();
      expect(detached.revision).toBeGreaterThan(before.revision);
      expect(detached.colors).toEqual({});
      expect(detached.diagnostics).toEqual(['theme-source-unavailable:detached']);
      expect(source.current().revision).toBe(detached.revision);
      expect(window.getComputedStyle).not.toHaveBeenCalled();
      document.body.append(h.owner);
      const restored = source.current();
      expect(restored.revision).toBeGreaterThan(detached.revision);
      expect(restored.colors.primary).toBeUndefined();
      expect(restored.colors.input).toEqual(SHADCN_MOTION_PALETTE.dark.colors.input);
      expect(restored.diagnostics).toEqual(['theme-source-mismatch:primary']);
      h.overrides.delete('--pui-primary');
      expect(source.current().colors.primary).toEqual(SHADCN_MOTION_PALETTE.dark.colors.primary);
      expect(before.colors.primary).toEqual(SHADCN_MOTION_PALETTE.light.colors.primary);
    }
  );

  it('keeps every connected missing or wrong role strict, including hidden surfaces', () => {
    const h = fixture();
    h.owner.hidden = true;
    const source = createCanonicalMotionPalette(h.el);
    for (const role of Object.keys(SHADCN_MOTION_PALETTE.light.colors)) {
      for (const value of ['', 'not-a-canonical-input']) {
        h.overrides.set('--pui-' + role, value);
        const current = source.current();
        expect(current.colors[role]).toBeUndefined();
        expect(current.diagnostics).toEqual(['theme-source-mismatch:' + role]);
        h.overrides.delete('--pui-' + role);
      }
    }
  });

  it('propagates a connected source exception without replacing the last good revision', () => {
    const h = fixture();
    const source = createCanonicalMotionPalette(h.el);
    const before = source.current();
    const read = vi.mocked(window.getComputedStyle).getMockImplementation()!;
    const failure = new Error('source read failed');
    vi.mocked(window.getComputedStyle).mockImplementation(() => {
      throw failure;
    });
    expect(() => source.current()).toThrow(failure);
    vi.mocked(window.getComputedStyle).mockImplementation(read);
    expect(source.current()).toEqual(before);
  });

  it('disposes before queued real mutations and tolerates repeated cleanup after a source exception', async () => {
    const h = fixture();
    const source = createCanonicalMotionPalette(h.el);
    source.current();
    const invalidate = vi.fn();
    const off = source.subscribe(invalidate);
    const read = vi.mocked(window.getComputedStyle).getMockImplementation()!;
    vi.mocked(window.getComputedStyle).mockImplementation(() => {
      throw new Error('source read failed');
    });
    expect(() => source.current()).toThrow('source read failed');
    h.dark(); // Queue the real observer while subscribed, then retire before delivery.
    off();
    off();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(invalidate).not.toHaveBeenCalled();
    vi.mocked(window.getComputedStyle).mockImplementation(read);
    h.owner.classList.remove('dark');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(invalidate).not.toHaveBeenCalled();
  });
});

let lifecycleId = 0;
function realSwitchFixture(shadow: boolean) {
  const originalComputedStyle = window.getComputedStyle.bind(window);
  // Happy DOM does not model inherited custom properties across Shadow boundaries.
  // Only that input is simulated for split surfaces; Document uses real CSS below.
  if (shadow)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const actual = originalComputedStyle(element, pseudo);
      return new Proxy(actual, {
        get(target, key) {
          if (key === 'getPropertyValue')
            return (name: string) => {
              if (!name.startsWith('--pui-')) return target.getPropertyValue(name);
              if (!element.isConnected) return '';
              let node: Element | null = element;
              let dark = false;
              while (node) {
                if (node.classList.contains('dark')) {
                  dark = true;
                  break;
                }
                if (node.classList.contains('light')) break;
                const root = node.getRootNode();
                node = node.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
              }
              const facts = SHADCN_MOTION_PALETTE[dark ? 'dark' : 'light'];
              return facts.expectedInputs[name.slice(6) as keyof typeof facts.expectedInputs] ?? '';
            };
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const bindings: {
    surface: HTMLElement;
    source: ReturnType<typeof createCanonicalMotionPalette>;
    reads: number;
    invalidations: number;
    cleanups: number;
  }[] = [];
  const reasons: string[] = [];
  const options = {
    residentMotion: {
      palette(surface: HTMLElement) {
        const source = createCanonicalMotionPalette(surface);
        const binding = { surface, source, reads: 0, invalidations: 0, cleanups: 0 };
        bindings.push(binding);
        return {
          current() {
            binding.reads++;
            return source.current();
          },
          subscribe(invalidate: () => void) {
            const off = source.subscribe(() => {
              binding.invalidations++;
              invalidate();
            });
            return () => {
              binding.cleanups++;
              off();
            };
          },
        };
      },
      diagnostics(next: readonly string[]) {
        reasons.push(...next);
      },
    },
    ...(shadow
      ? { shadow: { mode: 'open' as const, presentation: 'split' as const, styleArtifact } }
      : {}),
  };
  const id = ++lifecycleId;
  const style = document.createElement('style');
  style.textContent = (['light', 'dark'] as const)
    .map(
      (mode) =>
        `.${mode} palette-lifecycle-root-${id}, .${mode} palette-lifecycle-thumb-${id} {` +
        Object.entries(SHADCN_MOTION_PALETTE[mode].expectedInputs)
          .map(([role, value]) => `--pui-${role}:${value};`)
          .join('') +
        '}'
    )
    .join('\n');
  document.head.append(style);
  const Root = AdaptToWebComponent(
    { ...switchRoot, name: 'palette-lifecycle-root-' + id },
    options
  );
  const Thumb = AdaptToWebComponent(
    { ...switchThumb, name: 'palette-lifecycle-thumb-' + id },
    options
  );
  const root = new Root() as HTMLElement & { getExposes(): any };
  const thumb = new Thumb();
  root.append(thumb);
  setElementProps(root, { checked: true });
  const light = document.createElement('section'),
    dark = document.createElement('section');
  light.className = 'light';
  dark.className = 'dark';
  document.body.append(light, dark);
  light.append(root);
  return { root, thumb, light, dark, bindings, reasons, style };
}

async function settleLifecycle() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

describe('canonical palette with real Switch and Web Component lifecycle (DOM harness)', () => {
  it.each([false, true])(
    'retires an async detached view and freshly binds on reattach, shadow=%s',
    async (shadow) => {
      const h = realSwitchFixture(shadow);
      try {
        await settleLifecycle();
        expect(h.root.getExposes().checked.get()).toBe(true);
        expect(h.bindings).toHaveLength(2);
        const old = [...h.bindings];
        h.root.classList.add('queued-before-retirement');
        h.root.remove();
        // Exercise the real subscriber/runtime synchronously before terminal retirement.
        // Chrome's queued mutation order is covered by the native consumer artifact.
        document.dispatchEvent(new Event('pui-theme-change'));
        expect(h.reasons).toContain('theme-source-unavailable:detached');
        for (const binding of old) {
          expect(binding.source.current().colors).toEqual({});
          expect(binding.source.current().diagnostics).toEqual([
            'theme-source-unavailable:detached',
          ]);
        }
        await settleLifecycle();
        expect(old.map((binding) => binding.cleanups)).toEqual([1, 1]);
        const retiredInvalidations = old.map((binding) => binding.invalidations);
        h.dark.append(h.root);
        await settleLifecycle();
        expect(h.root.getExposes().checked.get()).toBe(true);
        expect(h.bindings).toHaveLength(4);
        for (const binding of h.bindings.slice(2)) {
          expect(binding.source.current().colors.primary).toEqual(
            SHADCN_MOTION_PALETTE.dark.colors.primary
          );
          expect(binding.source.current().diagnostics).toEqual([]);
        }
        h.root.classList.add('queued-theme-observation');
        await settleLifecycle();
        expect(old.map((binding) => binding.invalidations)).toEqual(retiredInvalidations);
        expect(h.reasons.filter((reason) => reason.startsWith('theme-source-mismatch:'))).toEqual(
          []
        );
      } finally {
        h.root.remove();
        await settleLifecycle();
        h.light.remove();
        h.dark.remove();
        h.style.remove();
      }
    }
  );

  it('rejects a real connected theme override after reattach without reusing canonical colors', async () => {
    const h = realSwitchFixture(false);
    try {
      await settleLifecycle();
      h.root.remove();
      await settleLifecycle();
      h.dark.append(h.root);
      await settleLifecycle();
      const binding = [...h.bindings].reverse().find((entry) => entry.surface === h.root)!;
      const before = binding.source.current();
      expect(before.diagnostics).toEqual([]);
      expect(before.colors.primary).toEqual(SHADCN_MOTION_PALETTE.dark.colors.primary);
      h.root.style.setProperty('--pui-primary', 'red');
      document.dispatchEvent(new Event('pui-theme-change'));
      const overridden = binding.source.current();
      expect(overridden.revision).toBeGreaterThan(before.revision);
      expect(overridden.colors.primary).toBeUndefined();
      expect(overridden.diagnostics).toEqual(['theme-source-mismatch:primary']);
      expect(h.reasons).toContain('theme-source-mismatch:primary');
    } finally {
      h.root.remove();
      await settleLifecycle();
      h.light.remove();
      h.dark.remove();
      h.style.remove();
    }
  });

  it.each([false, true])(
    'preserves the same owner across a same-tick move and checks the new ancestor theme, shadow=%s',
    async (shadow) => {
      const h = realSwitchFixture(shadow);
      try {
        await settleLifecycle();
        const checked = h.root.getExposes().checked;
        const original = [...h.bindings];
        const revisions = original.map((binding) => binding.source.current().revision);
        h.root.remove();
        h.dark.append(h.root);
        await settleLifecycle();
        expect(checked.get()).toBe(true);
        expect(h.root.getExposes().checked).toBe(checked);
        expect(h.bindings).toEqual(original);
        expect(original.map((binding) => binding.cleanups)).toEqual([0, 0]);
        original.forEach((binding, index) => {
          const current = binding.source.current();
          expect(current.colors.primary).toEqual(SHADCN_MOTION_PALETTE.dark.colors.primary);
          expect(current.revision).toBeGreaterThan(revisions[index]);
          expect(current.diagnostics).toEqual([]);
        });
      } finally {
        h.root.remove();
        await settleLifecycle();
        h.light.remove();
        h.dark.remove();
        h.style.remove();
      }
    }
  );
});
