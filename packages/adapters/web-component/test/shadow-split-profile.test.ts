import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, delay, tw, type RunHandle } from '@proto.ui/core';
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
import * as hostSessions from '../src/runtime/session';
import * as moduleWiring from '../src/runtime/modules';

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
  // C-RULE-COLOR-SCHEME-0001 C/D/G/K and D-WEB-COMPONENT-SHADOW-STYLE-0001 E/I/K:
  // main's document invalidation pair must not be attached to the split reader.
  it.each(['default', 'explicit', 'explicit-with-base'] as const)(
    'keeps Light document leases separate from the %s split environment across views',
    async (mode) => {
      const html = document.documentElement;
      const oldClass = html.className;
      const oldTheme = html.getAttribute('data-theme');
      const ownerSpy = vi.spyOn(moduleWiring, 'createWebComponentOwnerModules');
      const viewSpy = vi.spyOn(moduleWiring, 'createWebComponentModules');
      const listeners = new Set<() => void>();
      let scheme: 'light' | 'dark' = 'light';
      const source: ShadowColorSchemeSource = {
        get: () => scheme,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
      const baseMeta = vi.fn(() => 'base');
      const runs: RunHandle<{ enabled?: boolean }>[] = [];
      const renders = [0, 0];
      const hosts: (HTMLElement & { getExposes(): unknown })[] = [];
      const setPresent = (present: boolean) =>
        hosts.forEach((el) => {
          (el.getExposes() as { view: { setPresent(present: boolean): void } }).view.setPresent(
            present
          );
        });
      const settle = async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await flush();
      };
      const tokens = (el: HTMLElement) =>
        (el.shadowRoot?.querySelector('[part="surface"]') ?? el).getAttribute('data-pui-style');
      try {
        html.classList.remove('dark', 'light');
        html.dataset.theme = 'light';
        for (const index of [0, 1]) {
          const proto = definePrototype<{ enabled?: boolean }>({
            name: name(),
            setup(def) {
              def.props.define({ enabled: { type: 'boolean', default: true } });
              def.feedback.style.use(tw('bg-primary'));
              def.rule({
                when: (w) => w.all(w.prop('enabled').eq(true), w.meta('colorScheme').eq('dark')),
                intent: (i) => i.feedback.style.use(tw('bg-secondary')),
              });
              def.lifecycle.onCreated((run) => {
                runs[index] = run;
              });
              def.expose('view', {
                setPresent: (present: boolean) => runs[index].lifecycle.setPresent(present),
              });
              return (r) => {
                renders[index]++;
                return r.slot();
              };
            },
          });
          const C = AdaptToWebComponent(
            proto,
            index === 0
              ? {}
              : {
                  shadow: {
                    ...shadow,
                    styleArtifact: renderProtoShadowSplitStyleArtifact([
                      'bg-primary',
                      'bg-secondary',
                    ]),
                    ...(mode === 'default' ? {} : { colorSchemeSource: source }),
                  },
                  ...(mode === 'explicit-with-base' ? { getMeta: baseMeta } : {}),
                }
          );
          const el = new C();
          hosts.push(el);
          document.body.append(el);
        }
        await settle();
        const [light, splitHost] = hosts;
        const lightOwner = ownerSpy.mock.calls.find(([args]) => args.el === light)![0];
        expect(lightOwner.colorSchemeSource?.getter).toBe(lightOwner.getMeta);
        expect(lightOwner.colorSchemeSource).toBeDefined();
        const splitOwner = ownerSpy.mock.calls.find(([args]) => args.el === splitHost)![0];
        expect(splitOwner.colorSchemeSource?.getter).toBe(splitOwner.getMeta);
        const before = [...renders];
        html.dataset.theme = 'dark';
        await settle();
        expect(tokens(light)).toBe('bg-secondary');
        expect(splitHost.getAttribute('data-pui-color-scheme')).toBe(
          mode === 'default' ? 'dark' : 'light'
        );
        expect(runs[1].meta!.get('colorScheme')).toBe(mode === 'default' ? 'dark' : 'light');
        expect(tokens(splitHost)).toBe(mode === 'default' ? 'bg-secondary' : 'bg-primary');
        expect(renders).toEqual(before);
        if (mode !== 'default') {
          scheme = 'dark';
          listeners.forEach((listener) => listener());
          expect(splitHost.getAttribute('data-pui-color-scheme')).toBe('dark');
          expect(runs[1].meta!.get('colorScheme')).toBe('dark');
          await settle();
          expect(tokens(splitHost)).toBe('bg-secondary');
          expect(listeners.size).toBe(1);
        }
        // Do not assert new reactive mixed-Rule equivalence for Shadow. Reattach
        // must still sample its retained environment and use the current surface.
        setPresent(false);
        await settle();
        const surface = splitHost.shadowRoot!.querySelector('[part="surface"]');
        html.dataset.theme = 'light';
        await settle();
        if (mode !== 'default') expect(listeners.size).toBe(1);
        setPresent(true);
        await settle();
        expect(tokens(light)).toBe('bg-primary');
        expect(tokens(splitHost)).toBe(mode === 'default' ? 'bg-primary' : 'bg-secondary');
        expect(splitHost.shadowRoot!.querySelector('[part="surface"]')).toBe(surface);
        for (const [args] of viewSpy.mock.calls) {
          if (args.el === light) {
            expect(args.getMeta).toBe(lightOwner.getMeta);
            expect(args.colorSchemeSource).toBe(lightOwner.colorSchemeSource);
          } else if (args.el === splitHost) {
            expect(args.colorSchemeSource).toBe(splitOwner.colorSchemeSource);
          }
        }
        expect(baseMeta.mock.calls.some((args) => (args as unknown[])[0] === 'colorScheme')).toBe(
          false
        );
        hosts.forEach((el) => el.remove());
        await settle();
        expect(listeners.size).toBe(0);
        expect(splitHost.hasAttribute('data-pui-color-scheme')).toBe(false);
        document.body.append(...hosts);
        await settle();
        expect(tokens(light)).toBe('bg-primary');
        expect(tokens(splitHost)).toBe(mode === 'default' ? 'bg-primary' : 'bg-secondary');
        expect(splitHost.shadowRoot!.querySelector('[part="surface"]')).not.toBe(surface);
        if (mode !== 'default') expect(listeners.size).toBe(1);
      } finally {
        hosts.forEach((el) => el.remove());
        await settle();
        ownerSpy.mockRestore();
        viewSpy.mockRestore();
        html.className = oldClass;
        if (oldTheme === null) html.removeAttribute('data-theme');
        else html.setAttribute('data-theme', oldTheme);
      }
    }
  );

  it.each(['onUnmounted', 'onBeforeDispose'] as const)(
    'serializes a real reentrant reconnect during %s',
    async (checkpoint) => {
      let host!: HTMLElement;
      let setups = 0;
      const disposed: number[] = [];
      const listeners = new Set<() => void>();
      const proto = definePrototype({
        name: name(),
        setup(def) {
          const generation = ++setups;
          def.feedback.style.use(tw('p-2'));
          def.lifecycle[checkpoint](() => {
            if (generation === 1) document.body.append(host);
          });
          def.lifecycle.onBeforeDispose(() => {
            disposed.push(generation);
          });
          return (r) => r.slot();
        },
      });
      const C = AdaptToWebComponent(proto, {
        shadow: {
          ...shadow,
          colorSchemeSource: {
            get: () => 'light',
            subscribe(listener) {
              listeners.add(listener);
              return () => {
                listeners.delete(listener);
              };
            },
          },
        },
        schedule: (task) => task(),
      });
      host = new C();
      host.textContent = 'retained consumer';
      document.body.append(host);
      const first = (host as any)._splitResources;
      host.remove();
      await flush();
      try {
        expect(host.isConnected).toBe(true);
        expect(setups).toBe(2);
        expect(disposed).toEqual([1]);
        const second = (host as any)._splitResources;
        expect(second).not.toBe(first);
        expect(second.surface.element.isConnected).toBe(true);
        expect(second.artifact.stylesheet.element.parentNode).toBe(host.shadowRoot);
        expect(listeners.size).toBe(1);
        expect(() => (host as any).update()).not.toThrow();
      } finally {
        host.remove();
        await flush();
      }
      expect(disposed).toEqual([1, 2]);
      expect(listeners.size).toBe(0);
    }
  );

  it.each([true, false])(
    'waits for asynchronous host-session disposal (still connected: %s)',
    async (remainConnected) => {
      // Exercise the Promise-returning Adapter session boundary deterministically.
      // Current Runtime force-disposal normally finishes synchronously; this seam
      // does not claim that real Presence transitions delay terminal teardown.
      let finish!: () => void;
      const gate = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const createSession = hostSessions.createWebComponentHostSession;
      const sessionSpy = vi
        .spyOn(hostSessions, 'createWebComponentHostSession')
        .mockImplementationOnce((args) => {
          const session = createSession(args);
          return { ...session, dispose: () => gate.then(() => session.dispose()) };
        });
      let setups = 0;
      let scheme: 'light' | 'dark' = 'light';
      const listeners = new Set<() => void>();
      const allListeners: (() => void)[] = [];
      const C = AdaptToWebComponent(
        definePrototype({
          name: name(),
          setup(def) {
            setups++;
            def.feedback.style.use(tw('p-2'));
            return (r) => r.slot();
          },
        }),
        {
          shadow: {
            ...shadow,
            colorSchemeSource: {
              get: () => scheme,
              subscribe(listener) {
                listeners.add(listener);
                allListeners.push(listener);
                return () => {
                  listeners.delete(listener);
                };
              },
            },
          },
          schedule: (task) => task(),
        }
      );
      const host = new C();
      try {
        document.body.append(host);
        const first = (host as any)._splitResources;
        host.remove();
        await flush(); // confirmed terminal disposal requested, deliberately unsettled
        document.body.append(host);
        host.remove();
        document.body.append(host); // coalesce reconnect attempts during disposal
        await flush();
        expect(setups).toBe(1);
        setElementProps(host, { surfaceClassName: 'latest' });
        if (!remainConnected) host.remove();
        scheme = 'dark';
        finish();
        await flush();
        if (!remainConnected) {
          expect(setups).toBe(1);
          expect(listeners.size).toBe(0);
          expect((host as any)._splitResources).toBeNull();
          document.body.append(host);
          await flush();
        }
        const second = (host as any)._splitResources;
        expect(setups).toBe(2);
        expect(second).not.toBe(first);
        expect(second.surface).not.toBe(first.surface);
        expect(second.artifact).not.toBe(first.artifact);
        expect(second.environment).not.toBe(first.environment);
        expect(host.shadowRoot!.querySelectorAll('style')).toHaveLength(1);
        expect(second.surface.element.isConnected).toBe(true);
        expect(second.surface.element.classList.contains('latest')).toBe(true);
        expect(second.artifact.stylesheet.element.parentNode).toBe(host.shadowRoot);
        expect(listeners.size).toBe(1);
        expect(host.getAttribute('data-pui-color-scheme')).toBe('dark');
        scheme = 'light';
        allListeners[0](); // a retained predecessor listener has lost write authority
        first.dispose(); // duplicate late cleanup cannot affect the successor
        expect(host.getAttribute('data-pui-color-scheme')).toBe('dark');
        expect(second.surface.element.isConnected).toBe(true);
        expect(listeners.size).toBe(1);
        allListeners[1]();
        expect(host.getAttribute('data-pui-color-scheme')).toBe('light');
        expect(() => host.update()).not.toThrow();
        await flush();
        expect(second.surface.element.isConnected).toBe(true);
      } finally {
        finish();
        await flush();
        host.remove();
        await flush();
        sessionSpy.mockRestore();
      }
    }
  );
  it('cancels failed onCreated work before reconnecting a fresh generation', async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    let generation = 0;
    const proto = definePrototype({
      name: name(),
      setup(def) {
        const id = ++generation;
        def.lifecycle.onCreated(() => {
          delay(20, () => events.push(`delay:${id}`));
          if (id === 1) throw new Error('creation canary');
        });
        def.lifecycle.onBeforeDispose(() => events.push(`dispose:${id}`));
        return () => null;
      },
    });
    const C = AdaptToWebComponent(proto, { shadow });
    const host = new C();
    try {
      expect(() => (host as any).connectedCallback()).toThrow('creation canary');
      expect(host.shadowRoot!.childNodes).toHaveLength(0);
      expect(events).toEqual(['dispose:1']);
      document.body.append(host);
      await flush();
      await vi.advanceTimersByTimeAsync(50);
      expect(events).toEqual(['dispose:1', 'delay:2']);
      host.remove();
      await flush();
      expect(events).toEqual(['dispose:1', 'delay:2', 'dispose:2']);
    } finally {
      host.remove();
      await flush();
      vi.useRealTimers();
    }
  });
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
