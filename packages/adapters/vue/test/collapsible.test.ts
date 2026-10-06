import { COLLAPSIBLE_PROJECTIONS } from '../../base/test/fixtures/collapsible-projections';
import { createVueAdapter } from '../src';
import { VueAny, flushVue } from './utils/vue';
import {
  collapsibleAdapterConformance,
  type CollapsibleTree,
  type CollapsibleDriver,
} from '../../base/test/fixtures/collapsible-conformance';

const mount: CollapsibleDriver = async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const components = new Map<CollapsibleTree['proto'], any>();
  const refs = new Map<string, any>();
  const errors: unknown[] = [];
  const revision = VueAny.ref(0);
  const render = (node: CollapsibleTree): any => {
    if (!components.has(node.proto)) components.set(node.proto, adapt(node.proto));
    return VueAny.h(
      components.get(node.proto),
      {
        ...node.props,
        key: node.key,
        ref: (handle: any) => refs.set(node.key, handle),
        ...(node.onOpenChange ? { onOpenChange: node.onOpenChange } : {}),
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
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      app.unmount();
      await flushVue();
      host.remove();
    },
  };
};

collapsibleAdapterConformance('vue', mount);
for (const [family, projection] of COLLAPSIBLE_PROJECTIONS) {
  collapsibleAdapterConformance(`vue/${family}`, mount, projection);
}
