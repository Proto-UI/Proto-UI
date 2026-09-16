import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import {
  ruleWebAdapterConformance,
  type RuleWebProps,
} from '../../base/test/fixtures/rule-expose-state-web-conformance';
ruleWebAdapterConformance('vue', async (proto) => {
  const host = document.createElement('div');
  document.body.append(host);
  const Component = createVueAdapter(VueAny)(proto),
    props = VueAny.ref({});
  const app = VueAny.createApp({
    render: () => VueAny.h(Component, { ...props.value, class: 'rule-user-class' }),
  });
  app.mount(host);
  return {
    host,
    async setProps(next: RuleWebProps) {
      props.value = next;
      await flushVue();
    },
    async flush() {
      await flushVue();
      await flushVue();
    },
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      app.unmount();
      await flushVue();
      host.remove();
    },
  };
});
