import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as drawer from '../../../prototypes/shadcn/src/drawer';
import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

beforeEach(() => {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes(': reduce)'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
});
afterEach(() => vi.restoreAllMocks());
const settle = async () => {
  await flushVue2();
  await flushVue2();
};

async function mount(controlled: boolean, zeroDuration = false) {
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const Root = adapt(drawer.drawerRoot),
    Trigger = adapt(drawer.drawerTrigger),
    Content = adapt(drawer.drawerContent),
    Close = adapt(drawer.drawerClose),
    Mask = adapt(drawer.drawerMask);
  const accepted = Vue2Any.observable({ open: false });
  let refuse = false;
  const requests: { open: boolean; reason: string }[] = [];
  const App = Vue2Any.extend({
    render(h: any) {
      return h(
        Root,
        {
          ref: 'root',
          attrs: {
            ...(controlled ? { open: accepted.open } : { defaultOpen: false }),
            onOpenChange: (request: { open: boolean; reason: string }) => {
              requests.push(request);
              if (controlled && !refuse) accepted.open = request.open;
            },
          },
        },
        [
          h(Trigger, { ref: 'trigger' }, ['Open']),
          h(Mask),
          h(Content, { ref: 'content', attrs: { maxExtent: { unit: 'logical', value: 200 } } }, [
            h(Close, { ref: 'close' }, ['Close']),
          ]),
        ]
      );
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const vm = new App().$mount();
  host.append(vm.$el);
  await settle();
  const refs = vm.$refs as Record<string, any>;
  return {
    refs,
    requests,
    refuse() {
      refuse = true;
    },
    async click(part: 'trigger' | 'close') {
      refs[part].$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
    },
    async dispose() {
      vm.$destroy();
      host.remove();
      await settle();
    },
  };
}

describe('Vue2 Drawer semantic Escape after reduced-motion remount', () => {
  it.each([false, true])(
    'preserves an accepted Escape request after synchronous leave (controlled=%s)',
    async (controlled) => {
      const f = await mount(controlled);
      try {
        await f.click('trigger');
        await f.click('close');
        await f.click('trigger');
        expect(f.refs.root.getExposes().open.get()).toBe(true);
        expect(f.refs.content.getExposes().transitionState.get()).toBe('entered');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();
        expect(f.requests.filter((request) => request.reason === 'escape')).toEqual([
          expect.objectContaining({ open: false, reason: 'escape' }),
        ]);
        expect(f.refs.root.getExposes().open.get()).toBe(false);
        expect(f.refs.trigger.$el.getAttribute('aria-expanded')).toBe('false');
        expect(f.refs.content.getExposes().transitionState.get()).toBe('closed');
      } finally {
        await f.dispose();
      }
    }
  );
  it.each(['zero-duration', 'unknown-preference'] as const)(
    'preserves semantic Escape through %s synchronous completion',
    async (mode) => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: mode === 'zero-duration' && query.includes(': no-preference)'),
            media: query,
            addEventListener() {},
            removeEventListener() {},
          }) as any
      );
      const f = await mount(false, mode === 'zero-duration');
      try {
        await f.click('trigger');
        await f.click('close');
        await f.click('trigger');
        expect(f.refs.content.getExposes().transitionState.get()).toBe('entered');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();
        expect(f.requests.filter((request) => request.reason === 'escape')).toHaveLength(1);
        expect(f.refs.root.getExposes().open.get()).toBe(false);
      } finally {
        await f.dispose();
      }
    }
  );
  it('restores only the current controlled open fact when the owner refuses Escape', async () => {
    const f = await mount(true);
    try {
      await f.click('trigger');
      await f.click('close');
      await f.click('trigger');
      f.refuse();
      expect(f.refs.content.getExposes().transitionState.get()).toBe('entered');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(f.requests.filter((request) => request.reason === 'escape')).toHaveLength(1);
      expect(f.refs.root.getExposes().open.get()).toBe(true);
      expect(f.refs.trigger.$el.getAttribute('aria-expanded')).toBe('true');
      expect(f.refs.content.getExposes().transitionState.get()).toBe('entered');
    } finally {
      await f.dispose();
    }
  });
});
