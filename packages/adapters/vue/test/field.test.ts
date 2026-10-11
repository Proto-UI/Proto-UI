import { createVueAdapter } from '../src';
import { VueAny, flushVue } from './utils/vue';
import {
  fieldAdapterConformance,
  type FieldTree,
} from '../../base/test/fixtures/field-conformance';

fieldAdapterConformance('vue', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const components = new Map<FieldTree['proto'], any>();
  const refs = new Map<string, any>();
  const errors: unknown[] = [];
  const revision = VueAny.ref(0);
  const render = (node: FieldTree): any => {
    if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
    return VueAny.h(
      components.get(node.proto),
      {
        ...node.props,
        key: node.key,
        ref: (handle: any) => refs.set(node.key, handle),
        ...(node.onValidationRequest ? { onValidationRequest: node.onValidationRequest } : {}),
      },
      () => (node.children ?? []).map(render)
    );
  };
  const app = VueAny.createApp({
    render() {
      revision.value;
      return VueAny.h('div', tree.map(render));
    },
  });
  app.config.errorHandler = (error: unknown) => {
    errors.push(error);
  };
  const flush = async (action?: () => void) => {
    action?.();
    revision.value += 1;
    await flushVue();
    await flushVue();
    if (errors.length) throw errors[0];
  };
  try {
    app.mount(host);
    await flush();
  } catch (error) {
    app.unmount();
    host.remove();
    await flushVue();
    throw error;
  }
  return {
    host,
    exposes: (key) => refs.get(key).getExposes(),
    flush,
    async click(target) {
      (() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 }));
      return target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 }));
    })();
    },
    async unmount() {
      app.unmount();
      await flushVue();
      host.remove();
    },
  };
});
