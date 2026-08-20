import { describeAdapterPropsHostSourceConformance } from '../../../base/test-utils/props-host-source';
import { createVueAdapter } from '../../src/adapt';
import { flushVue, VueAny } from '../utils/vue';

describeAdapterPropsHostSourceConformance({
  adapterName: 'adapter-vue',
  // Vue's component-updated lifecycle reaches a callback-safe runtime sync
  // point after invalidation. That may dispatch Props watchers, but it still
  // must not schedule a Proto render commit when auto-update is disabled.
  watchValuesAfterHostUpdate: [2],
  async mount(proto, props) {
    const adapter = createVueAdapter(VueAny);
    const Component = adapter(proto, { autoUpdateOnPropsChange: false });
    const host = document.createElement('div');
    const state = VueAny.reactive({ ...props });
    const adapterRef = VueAny.ref(null);

    document.body.appendChild(host);

    const Root = VueAny.defineComponent({
      setup() {
        return () => VueAny.h(Component, { ...state, ref: adapterRef });
      },
    });

    const app = VueAny.createApp(Root);
    app.mount(host);
    await flushVue();

    return {
      async updateHostProps(nextProps) {
        for (const key of Object.keys(state)) {
          if (!(key in nextProps)) delete state[key];
        }
        Object.assign(state, nextProps);
        await flushVue();
      },
      async syncRuntime() {
        adapterRef.value?.update();
        await flushVue();
      },
      readRenderedValue() {
        return host.firstElementChild?.textContent ?? null;
      },
      async unmount() {
        app.unmount();
        await flushVue();
        host.remove();
      },
    };
  },
});
