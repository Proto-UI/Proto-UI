import { describe, expect, it } from 'vitest';
import {
  scrollAreaRoot,
  scrollAreaScrollbar,
  scrollAreaThumb,
  scrollAreaViewport,
} from '../../../prototypes/base/src/scroll-area';

import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

describe('adapter-vue2: base scroll area compound protocol', () => {
  it('mounts a viewport with composed host projection and attached anatomy parts', async () => {
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(scrollAreaRoot);
    const Viewport = adapt(scrollAreaViewport, { scrollProjection: 'composed' });
    const Scrollbar = adapt(scrollAreaScrollbar);
    const Thumb = adapt(scrollAreaThumb);
    const host = document.createElement('div');
    document.body.appendChild(host);

    const App = Vue2Any.extend({
      render(h: any) {
        return h(Root, { ref: 'root' }, [
          h(Viewport, { ref: 'viewport' }, [h('div', { style: { height: '240px' } }, ['Body'])]),
          h(Scrollbar, { attrs: { orientation: 'vertical' }, ref: 'scrollbar' }, [
            h(Thumb, { ref: 'thumb' }),
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

      expect(refs.viewport?.$el.dataset.puiScrollProjection).toBe('composed');
      expect(refs.viewport?.getExposes().scrollAxes.get()).toBe('both');
      expect(refs.viewport?.getExposes().scrollProjection.get()).toBe('composed');
      expect(refs.scrollbar?.getExposes().orientation.get()).toBe('vertical');
      expect(refs.viewport?.$el.textContent).toContain('Body');
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
