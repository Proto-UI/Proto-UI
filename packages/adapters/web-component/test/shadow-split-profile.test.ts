import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { declareImageView } from '@proto.ui/module-image-view';
import {
  AdaptToWebComponent,
  setElementProps,
  type ShadowColorSchemeSource,
  type WebComponentShadowSplitOptions,
} from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { checkboxRoot, checkboxIndicator } from '../../../prototypes/shadcn/src/checkbox';

const artifact = renderProtoShadowSplitStyleArtifact([
  'flex',
  'p-2',
  'bg-primary',
  'dark:border-2',
]);
const shadow: WebComponentShadowSplitOptions = {
  mode: 'open',
  presentation: 'split',
  styleArtifact: artifact,
};
let serial = 0;
const name = () => `s1-public-${++serial}`;
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

// D-WEB-COMPONENT-SHADOW-PROFILE-0001 G-J; D-WEB-COMPONENT-SHADOW-STYLE-0001 K/N.
describe('public WC Shadow split profile', () => {
  it('atomically routes Root and normalized surface props with owner-generation lifetime', async () => {
    let run!: RunHandle<any>;
    let setup = 0;
    let scheme: 'light' | 'dark' = 'light';
    const listeners = new Set<() => void>();
    const source: ShadowColorSchemeSource = {
      get: () => scheme,
      subscribe(cb) {
        listeners.add(cb);
        return () => {
          listeners.delete(cb);
        };
      },
    };
    const baseMeta = vi.fn(() => 'base');
    const proto = definePrototype({
      name: name(),
      setup(def) {
        setup++;
        def.feedback.style.use(tw('flex p-2 bg-primary'));
        def.rule({
          when: (w) => w.meta('colorScheme').eq('dark'),
          intent: (i) => i.feedback.style.use(tw('border-2')),
        });
        def.lifecycle.onCreated((r) => {
          run = r;
        });
        def.expose('view', {
          show: () => run.lifecycle.setPresent(true),
          hide: () => run.lifecycle.setPresent(false),
        });
        return (r) => r.slot();
      },
    });
    const C = AdaptToWebComponent(proto, {
      shadow: { ...shadow, colorSchemeSource: source },
      getMeta: baseMeta,
      schedule: (task) => task(),
    });
    const el = new C();
    setElementProps(el, {
      className: 'consumer-host',
      surfaceClassName: 'consumer-surface',
      surfaceStyle: { backgroundColor: 'red' },
    });
    el.textContent = 'Slot content';
    expect(el.shadowRoot!.childNodes).toHaveLength(0);
    expect(listeners.size).toBe(0);
    expect(el.className).toBe('consumer-host');
    document.body.append(el);
    await flush();
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;
    const style = el.shadowRoot!.querySelector('style');
    expect(surface).not.toBeNull();
    expect(style).not.toBeNull();
    expect(surface.style.backgroundColor).toBe('red');
    expect(surface.className).toBe('consumer-surface');
    expect(surface.getAttribute('data-pui-style')).toContain('p-2');
    expect(el.hasAttribute('data-pui-style')).toBe(false);
    expect(el.classList.contains('pui-host-root')).toBe(false);
    expect(el.getAttribute('data-pui-split-root-style')).toContain('p-2');
    expect(run.meta!.get('colorScheme')).toBe('light');
    baseMeta.mockClear();
    expect(run.meta!.get('custom')).toBe('base');
    expect(baseMeta).toHaveBeenCalledTimes(1);
    expect(baseMeta).toHaveBeenCalledWith('custom');
    expect(surface.querySelector('slot')!.assignedNodes()[0]).toBe(el.firstChild);
    expect(listeners.size).toBe(1);
    scheme = 'dark';
    listeners.forEach((cb) => cb());
    expect(el.getAttribute('data-pui-color-scheme')).toBe('dark');
    expect(run.meta!.get('colorScheme')).toBe('dark');
    expect(baseMeta.mock.calls.some((args) => (args as unknown[])[0] === 'colorScheme')).toBe(
      false
    );
    const exposed = el.getExposes() as any;
    exposed.view.hide();
    await flush();
    expect(surface.childNodes).toHaveLength(0);
    expect(el.shadowRoot!.querySelector('style')).toBe(style);
    expect(el.hasAttribute('data-pui-split-root-style')).toBe(false);
    exposed.view.show();
    await flush();
    expect(el.shadowRoot!.querySelector('[part="surface"]')).toBe(surface);
    expect(surface.querySelector('slot')).not.toBeNull();
    const destination = document.createElement('div');
    document.body.append(destination);
    destination.append(el);
    await flush();
    expect(setup).toBe(1);
    expect(listeners.size).toBe(1);
    el.remove();
    await flush();
    expect(listeners.size).toBe(0);
    expect(el.shadowRoot!.childNodes).toHaveLength(0);
    expect(surface.className).toBe('');
    expect(surface.style.backgroundColor).toBe('');
    expect(el.hasAttribute('data-pui-color-scheme')).toBe(false);
    document.body.append(el);
    await flush();
    expect(setup).toBe(2);
    expect(listeners.size).toBe(1);
    expect(run.meta!.get('colorScheme')).toBe('dark');
    const nextSurface = el.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;
    expect(nextSurface).not.toBe(surface);
    expect(nextSurface.style.backgroundColor).toBe('red');
    setElementProps(el, {});
    expect(nextSurface.className).toBe('');
    expect(nextSurface.style.backgroundColor).toBe('');
  });

  it.each([
    null,
    {},
    { mode: 'closed', presentation: 'split', styleArtifact: artifact },
    { ...shadow, extra: true },
    { ...shadow, styleArtifact: Promise.resolve(artifact) },
    { ...shadow, colorSchemeSource: { get: (): string => 'dark' } },
  ])('rejects invalid configuration before registration: %j', (invalid) => {
    const proto = definePrototype({ name: name(), setup() {} });
    expect(() => AdaptToWebComponent(proto, { shadow: invalid as any })).toThrow(/shadow|Shadow/);
    expect(customElements.get(proto.name)).toBeUndefined();
  });

  it('rejects image declarations before registration', () => {
    for (const declaration of [
      declareImageView({
        source: 'src',
        alternativeText: 'alt',
        a11yMode: 'informative',
        fit: 'contain',
      }),
    ]) {
      const proto = definePrototype({ name: name(), modules: [declaration], setup() {} });
      expect(() => AdaptToWebComponent(proto, { shadow })).toThrow(/image-view/);
      expect(customElements.get(proto.name)).toBeUndefined();
    }
  });

  it.each(['setup', 'token', 'source'] as const)(
    'cleans a failed %s activation and permits fresh reconnect',
    async (failure) => {
      let fail = true;
      const listeners = new Set<() => void>();
      const proto = definePrototype({
        name: name(),
        setup(def) {
          if (fail && failure === 'setup') throw new Error('setup canary');
          def.feedback.style.use(tw(fail && failure === 'token' ? 'translate-x-2' : 'p-2'));
          return (r) => r.slot();
        },
      });
      const C = AdaptToWebComponent(proto, {
        shadow: {
          ...shadow,
          colorSchemeSource: {
            get: () => 'light',
            subscribe(cb) {
              if (fail && failure === 'source') throw new Error('source canary');
              listeners.add(cb);
              return () => {
                listeners.delete(cb);
              };
            },
          },
        },
        schedule: (task) => task(),
      });
      const el = new C();
      // Invoke the native callback directly to assert fail-fast errors (DOM CE reactions report them).
      expect(() => (el as any).connectedCallback()).toThrow(
        failure === 'token' ? /translate-x-2/ : /canary/
      );
      await flush();
      expect(listeners.size).toBe(0);
      expect(el.shadowRoot!.childNodes).toHaveLength(0);
      expect(el.hasAttribute('data-pui-color-scheme')).toBe(false);
      expect(el.hasAttribute('data-pui-split-root-style')).toBe(false);
      fail = false;
      document.body.append(el);
      await flush();
      expect(el.shadowRoot!.querySelector('[part="surface"]')).not.toBeNull();
      expect(listeners.size).toBe(1);
    }
  );

  it('composes complete Shadcn Checkbox Root + Indicator with real Context and one input owner', async () => {
    const closure = await collectProtoStyleTokens('packages/prototypes/shadcn/src/checkbox');
    const profile = {
      ...shadow,
      styleArtifact: renderProtoShadowSplitStyleArtifact(closure as string[]),
    };
    const Root = AdaptToWebComponent(checkboxRoot, { shadow: profile, registerAs: name() });
    const Indicator = AdaptToWebComponent(checkboxIndicator, {
      shadow: profile,
      registerAs: name(),
    });
    const root = new Root(),
      indicator = new Indicator();
    root.append(indicator, 'Accept terms');
    document.body.append(root);
    await flush();
    const change = vi.fn();
    root.addEventListener('checkedChange', change);
    expect(root.getAttribute('role')).toBe('checkbox');
    expect(indicator.shadowRoot!.querySelector('svg')).toBeNull();
    root.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(indicator.shadowRoot!.querySelector('path')?.getAttribute('d')).toBe('m20 6-11 11-5-5');
    expect(change).toHaveBeenCalledTimes(1);
    expect(indicator.hasAttribute('tabindex')).toBe(false);
    expect(root.shadowRoot!.querySelector('[part="surface"]')!.hasAttribute('role')).toBe(false);
    setElementProps(root, { indeterminate: true });
    root.update();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(indicator.shadowRoot!.querySelector('path')?.getAttribute('d')).toBe('M5 12h14');
    setElementProps(root, { disabled: true });
    root.update();
    root.click();
    await flush();
    expect(change).toHaveBeenCalledTimes(1);
    root.remove();
    await flush();
    root.click();
    expect(change).toHaveBeenCalledTimes(1);
    expect(root.shadowRoot!.childNodes).toHaveLength(0);
    expect(indicator.shadowRoot!.childNodes).toHaveLength(0);
  });

  it('retains the previous complete projection on a rejected post-mount patch', async () => {
    let run!: RunHandle<any>;
    let clicks = 0;
    const proto = definePrototype({
      name: name(),
      setup(def) {
        def.feedback.style.use(tw('p-2'));
        def.lifecycle.onCreated((r) => {
          run = r;
        });
        def.event.on('press.commit', () => {
          clicks++;
        });
        def.expose('invalidPatch', () => run.feedback.style.patch(tw('translate-x-2')));
        return (r) => r.slot();
      },
    });
    const C = AdaptToWebComponent(proto, { shadow, schedule: (task) => task() });
    const el = new C();
    document.body.append(el);
    await flush();
    const before = el.shadowRoot!.innerHTML;
    const rootStyle = el.getAttribute('data-pui-split-root-style');
    expect(() => (el.getExposes() as any).invalidPatch()).toThrow(/translate-x-2/);
    expect(el.shadowRoot!.innerHTML).toBe(before);
    expect(el.getAttribute('data-pui-split-root-style')).toBe(rootStyle);
    // A move's update must not be mistaken for a first-owner activation failure.
    expect(() => (el as any).connectedCallback()).toThrow(/translate-x-2/);
    expect(el.shadowRoot!.innerHTML).toBe(before);
    expect(el.getAttribute('data-pui-split-root-style')).toBe(rootStyle);
    el.click();
    expect(clicks).toBe(1);
    el.remove();
    await flush();
    expect(el.shadowRoot!.childNodes).toHaveLength(0);
  });

  it.each([false, true])(
    'supports synchronous controlled Checkbox updates from an outward event (split=%s)',
    async (split) => {
      const closure = await collectProtoStyleTokens('packages/prototypes/shadcn/src/checkbox');
      const Root = AdaptToWebComponent(checkboxRoot, {
        registerAs: name(),
        shadow: split && {
          ...shadow,
          styleArtifact: renderProtoShadowSplitStyleArtifact(closure as string[]),
        },
      });
      const root = new Root();
      setElementProps(root, { checked: false });
      document.body.append(root);
      await flush();
      const errors: unknown[] = [];
      const capture = (event: ErrorEvent) => {
        errors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', capture);
      root.addEventListener('checkedChange', (event) => {
        setElementProps(root, {
          checked: (event as CustomEvent<{ checked: boolean }>).detail.checked,
        });
        root.update();
      });
      try {
        root.click();
        await flush();
        expect(errors).toEqual([]);
        expect(root.getAttribute('aria-checked')).toBe('true');
      } finally {
        window.removeEventListener('error', capture);
      }
    }
  );
});
