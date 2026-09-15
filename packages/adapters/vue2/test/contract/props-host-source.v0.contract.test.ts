import { describeAdapterPropsHostSourceConformance } from '../../../base/test-utils/props-host-source';
import { createVue2Adapter } from '../../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from '../utils/vue2';

describeAdapterPropsHostSourceConformance({
  adapterName: 'adapter-vue2',
  watchValuesAfterHostUpdate: [2],
  async mount(proto, props) {
    const Component = createVue2Adapter(Vue2RuntimeAny)(proto, { autoUpdateOnPropsChange: false });
    const state = Vue2Any.observable({ props: { ...props } });
    const host = document.createElement('div');
    document.body.append(host);
    const Root = Vue2Any.extend({
      render(h: (type: unknown, data: unknown) => unknown) {
        return h(Component, { attrs: state.props, ref: 'target' });
      },
    });
    const vm = new Root().$mount();
    host.append(vm.$el);
    await flushVue2();
    return {
      async updateHostProps(next) {
        state.props = { ...next };
        await flushVue2();
      },
      async syncRuntime() {
        vm.$refs.target.update();
        await flushVue2();
      },
      readRenderedValue() {
        return host.firstElementChild?.textContent ?? null;
      },
      async unmount() {
        vm.$destroy();
        await flushVue2();
        host.remove();
      },
    };
  },
});
