import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hoverCardContent,
  hoverCardRoot,
  hoverCardTrigger,
} from '../../../prototypes/base/src/hover-card';

import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny } from './utils/vue2';

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
  await Vue2Any.nextTick();
  await Promise.resolve();
  await Vue2Any.nextTick();
}

afterEach(() => vi.useRealTimers());

describe('adapter-vue2: base hover-card compound protocol', () => {
  it('opens and closes from trigger focus using root-owned delays', async () => {
    vi.useFakeTimers();
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(hoverCardRoot);
    const Trigger = adapt(hoverCardTrigger);
    const Content = adapt(hoverCardContent);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const App = Vue2Any.extend({
      render(h: any) {
        return h(Root, { attrs: { openDelay: 20, closeDelay: 30 }, ref: 'root' }, [
          h(Trigger, { ref: 'trigger' }, ['Hover me']),
          h(Content, { ref: 'content' }, ['Preview']),
        ]);
      },
    });
    const vm = new App().$mount();
    host.appendChild(vm.$el);

    try {
      await advance(0);
      const refs = vm.$refs as Record<string, any>;
      refs.trigger?.$el.focus();
      await advance(19);
      expect(refs.root?.getExposes().open.get()).toBe(false);

      await advance(1);
      expect(refs.root?.getExposes().open.get()).toBe(true);
      expect(refs.content?.getExposes().open.get()).toBe(true);

      refs.trigger?.$el.blur();
      await advance(29);
      expect(refs.root?.getExposes().open.get()).toBe(true);

      await advance(1);
      expect(refs.root?.getExposes().open.get()).toBe(false);
      expect(refs.content?.getExposes().open.get()).toBe(false);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
