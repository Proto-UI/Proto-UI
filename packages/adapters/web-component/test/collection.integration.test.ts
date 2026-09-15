import { AdaptToWebComponent } from '../src';
import {
  collectionAdapterConformance,
  type CollectionTree,
} from '../../base/test/fixtures/collection-conformance';
collectionAdapterConformance('wc', async (tree) => {
  const host = document.createElement('div');
  document.body.append(host);
  const render = (node: CollectionTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.append(...(node.children ?? []).map(render));
    return el;
  };
  const flush = async (action?: () => void) => {
    action?.();
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  // Each replacement follows terminal custom-element owner teardown. Retained-owner
  // reorder and repeatable view epochs have separate Runtime/module evidence.
  const update = async (next: CollectionTree[]) => {
    host.replaceChildren();
    await flush();
    host.append(...next.map(render));
    await flush();
  };
  await update(tree);
  return {
    host,
    flush,
    update,
    async click(el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
});
