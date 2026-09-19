import { definePrototype, tw, type Prototype, type RunHandle } from '@proto.ui/core';
import { describe, expect, it, vi } from 'vitest';

export type ColorSchemeProps = { enabled?: boolean; value?: number };
export type ColorSchemeOptions = {
  autoUpdateOnPropsChange: false;
  getMeta?: (key: string) => unknown;
};
export type ColorSchemeMount = {
  host: HTMLElement;
  act(action: () => void): Promise<void>;
  setProps(props: ColorSchemeProps, concurrent?: () => void): Promise<void>;
  setPresent(present: boolean): Promise<void>;
  update(): Promise<void>;
  unmount(): Promise<void>;
};

function fixture(name: string, detached = false) {
  const calls = {
    setup: 0,
    render: 0,
    mounted: 0,
    unmounted: 0,
    updated: 0,
    watched: [] as number[],
  };
  let run!: RunHandle<ColorSchemeProps>;
  const proto = definePrototype<ColorSchemeProps>({
    name,
    setup(def) {
      calls.setup++;
      def.props.define({
        enabled: { type: 'boolean', default: true },
        value: { type: 'number', default: 1 },
      });
      def.props.watch(['value'], (_run, next) => calls.watched.push(next.value!));
      def.lifecycle.onCreated((next) => {
        run = next;
        if (detached) run.lifecycle.setPresent(false);
      });
      def.lifecycle.onMounted(() => calls.mounted++);
      def.lifecycle.onUnmounted(() => calls.unmounted++);
      def.lifecycle.onUpdated(() => calls.updated++);
      def.expose('view', {
        show: () => run.lifecycle.setPresent(true),
        hide: () => run.lifecycle.setPresent(false),
      });
      def.feedback.style.use(tw('bg-white'));
      def.rule({
        when: (w) => w.all(w.prop('enabled').eq(true), w.meta('colorScheme').eq('dark')),
        intent: (i) => i.feedback.style.use(tw('bg-black')),
      });
      return (renderer) => {
        calls.render++;
        return renderer.el('span', String(renderer.read.props.get().value));
      };
    },
  });
  return {
    proto,
    calls,
  };
}

/** Real framework/Custom Element wiring in happy-dom; token projection is not browser paint. */
export function describeColorSchemeIntegration(
  name: string,
  mount: (
    proto: Prototype<ColorSchemeProps>,
    options: ColorSchemeOptions
  ) => Promise<ColorSchemeMount>
) {
  const root = (view: ColorSchemeMount) => view.host.querySelector<HTMLElement>('[data-pui-root]')!;
  const tokens = (view: ColorSchemeMount) => root(view).getAttribute('data-pui-style');

  async function run(
    suffix: string,
    check: (view: ColorSchemeMount, sample: ReturnType<typeof fixture>) => Promise<void>,
    options: Partial<ColorSchemeOptions> = {},
    detached = false
  ) {
    const html = document.documentElement;
    const oldClass = html.className;
    const oldTheme = html.getAttribute('data-theme');
    html.classList.remove('dark', 'light');
    html.dataset.theme = 'light';
    const sample = fixture(`color-scheme-${name}-${suffix}`, detached);
    const view = await mount(sample.proto, { autoUpdateOnPropsChange: false, ...options });
    try {
      await view.act(() => {});
      await check(view, sample);
    } finally {
      await view.unmount();
      html.className = oldClass;
      if (oldTheme === null) html.removeAttribute('data-theme');
      else html.setAttribute('data-theme', oldTheme);
    }
  }

  describe(`${name}: colorScheme Adapter wiring`, () => {
    it('refreshes mixed Prop/Meta styles without a Proto update or replacing the settled view', async () => {
      await run('default', async (view, { calls }) => {
        expect(tokens(view)).toBe('bg-white');
        const host = root(view);
        const child = host.querySelector('span');
        const before = {
          render: calls.render,
          updated: calls.updated,
          watched: [...calls.watched],
        };
        for (const theme of ['dark', 'light', 'dark']) {
          await view.act(() => {
            document.documentElement.dataset.theme = theme;
          });
          expect(tokens(view)).toBe(theme === 'dark' ? 'bg-black' : 'bg-white');
          expect(root(view)).toBe(host);
          expect(host.querySelector('span')).toBe(child);
          expect({ render: calls.render, updated: calls.updated, watched: calls.watched }).toEqual(
            before
          );
        }
      });
    });

    it('keeps a custom getter sampled instead of pairing it with the default document source', async () => {
      let scheme = 'light';
      const getMeta = vi.fn((key: string) => (key === 'colorScheme' ? scheme : undefined));
      await run(
        'custom',
        async (view) => {
          expect(tokens(view)).toBe('bg-white');
          getMeta.mockClear();
          scheme = 'dark';
          await view.act(() => {
            document.documentElement.dataset.theme = 'dark';
          });
          expect(getMeta).not.toHaveBeenCalled();
          expect(tokens(view)).toBe('bg-white');
          await view.update();
          expect(tokens(view)).toBe('bg-black');
          expect(getMeta).toHaveBeenCalledWith('colorScheme');
        },
        { getMeta }
      );
    });

    it('reads the latest scheme for first mount and remount of the same retained owner', async () => {
      await run(
        'retained',
        async (view, sample) => {
          expect(view.host.querySelector('span')).toBeNull();
          expect(sample.calls.mounted).toBe(0);
          await view.act(() => {
            document.documentElement.dataset.theme = 'dark';
          });
          await view.setPresent(true);
          expect(tokens(view)).toBe('bg-black');
          expect(sample.calls.mounted).toBe(1);
          const oldChild = view.host.querySelector('span');
          await view.setPresent(false);
          expect(view.host.querySelector('span')).toBeNull();
          expect(sample.calls.unmounted).toBe(1);
          await view.act(() => {
            document.documentElement.dataset.theme = 'light';
          });
          await view.setPresent(true);
          expect(tokens(view)).toBe('bg-white');
          expect(view.host.querySelector('span')).not.toBe(oldChild);
          expect(sample.calls.setup).toBe(1);
          expect(sample.calls.mounted).toBe(2);
          await view.act(() => {
            document.documentElement.dataset.theme = 'dark';
          });
          expect(tokens(view)).toBe('bg-black');
        },
        {},
        true
      );
    });

    it('preserves Props watch dispatch and an explicit update after concurrent host/theme changes', async () => {
      await run('props', async (view, { calls }) => {
        expect(root(view).textContent).toBe('1');
        const renders = calls.render;
        await view.act(() => {
          document.documentElement.dataset.theme = 'dark';
        });
        await view.setProps({ enabled: true, value: 2 }, () => {
          document.documentElement.dataset.theme = 'light';
        });
        expect(tokens(view)).toBe('bg-white');
        expect(calls.render).toBe(renders);
        expect(root(view).textContent).toBe('1');
        // Framework presentation may already reach its ordinary callback-safe Props sync.
        expect(calls.watched.every((value) => value === 2)).toBe(true);
        expect(calls.watched.length).toBeLessThanOrEqual(1);
        await view.update();
        expect(calls.watched).toEqual([2]);
        expect(root(view).textContent).toBe('2');
        expect(calls.render).toBeGreaterThan(renders);
        await view.update();
        expect(calls.watched).toEqual([2]);
      });
    });
  });
}
