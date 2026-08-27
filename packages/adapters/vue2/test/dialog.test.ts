import { describe, expect, it } from 'vitest';
import {
  dialogClose,
  dialogContent,
  dialogRoot,
  dialogTrigger,
} from '../../../prototypes/base/src/dialog';

import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: base dialog compound protocol', () => {
  it('opens and closes a real dialog family through its trigger and close parts', async () => {
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(dialogRoot);
    const Trigger = adapt(dialogTrigger);
    const Content = adapt(dialogContent, { rootTag: 'section' });
    const Close = adapt(dialogClose);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const App = Vue2Any.extend({
      render(h: any) {
        return h(Root, { attrs: { defaultOpen: false }, ref: 'root' }, [
          h(Trigger, { ref: 'trigger' }, ['Open dialog']),
          h(Content, { ref: 'content' }, [
            h('p', ['Dialog body']),
            h(Close, { ref: 'close' }, ['Close dialog']),
          ]),
        ]);
      },
    });
    const vm = new App().$mount();
    host.appendChild(vm.$el);

    try {
      await flushVue2();
      await flushVue2();
      const refs = vm.$refs as Record<string, any>;
      expect(refs.root?.getExposes().open.get()).toBe(false);
      expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('false');

      refs.trigger?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue2();
      await flushVue2();

      expect(refs.root?.getExposes().open.get()).toBe(true);
      expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('true');
      expect(refs.content?.$el.getAttribute('role')).toBe('dialog');
      expect(refs.content?.$el.textContent).toContain('Dialog body');

      refs.close?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue2();
      await flushVue2();

      expect(refs.root?.getExposes().open.get()).toBe(false);
      expect(refs.trigger?.$el.getAttribute('aria-expanded')).toBe('false');
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
