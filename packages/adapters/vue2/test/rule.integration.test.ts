import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import { ruleAdapterConformance, type RuleProps } from '../../base/test/fixtures/rule-conformance';
ruleAdapterConformance('vue2', async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const Component = createVue2Adapter(Vue2RuntimeAny)(proto);
  const App = Vue2Any.extend({
    data: () => ({ input: {} }),
    render(this: any, h: any) {
      return h(Component, { attrs: this.input, class: 'rule-user-class' });
    },
  });
  const vm = new App().$mount();
  host.append(vm.$el);
  return {
    host,
    async setProps(next: RuleProps) {
      vm.input = next;
      await flushVue2();
    },
    async flush() {
      await flushVue2();
      await flushVue2();
    },
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      vm.$destroy();
      await flushVue2();
      host.remove();
    },
  };
});
