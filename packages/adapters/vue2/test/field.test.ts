import { createVue2Adapter } from '../src';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import {
  fieldAdapterConformance,
  type FieldTree,
} from '../../base/test/fixtures/field-conformance';

fieldAdapterConformance('vue2', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const components = new Map<FieldTree['proto'], any>();
  const errors: unknown[] = [];
  const App = Vue2Any.extend({
    errorCaptured(error: unknown) {
      errors.push(error);
      return false;
    },
    render(h: any) {
      const render = (node: FieldTree): any => {
        if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
        return h(
          components.get(node.proto),
          {
            attrs: node.props,
            key: node.key,
            ref: node.key,
            ...(node.onValidationRequest
              ? { on: { validationRequest: node.onValidationRequest } }
              : {}),
          },
          (node.children ?? []).map(render)
        );
      };
      return h('div', {}, tree.map(render));
    },
  });
  const vm = new App();
  const flush = async (action?: () => void) => {
    action?.();
    vm.$forceUpdate();
    await flushVue2();
    await flushVue2();
    if (errors.length) throw errors[0];
  };
  try {
    vm.$mount();
    host.append(vm.$el);
    await flush();
  } catch (error) {
    vm.$destroy();
    host.remove();
    await flushVue2();
    throw error;
  }
  return {
    host,
    exposes: (key) => vm.$refs[key].getExposes(),
    flush,
    async click(target) {
      (() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      return target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 }));
    })();
    },
    async unmount() {
      vm.$destroy();
      await flushVue2();
      host.remove();
    },
  };
});
