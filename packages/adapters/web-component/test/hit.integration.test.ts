import { AdaptToWebComponent } from '../src';
import { hitAdapterConformance, type HitTree } from '../../base/test/fixtures/hit-conformance';

hitAdapterConformance('wc', async (tree) => {
  const host = document.createElement('div');
  const render = (node: HitTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.className = 'user-hit-class';
    el.append(...(node.children ?? []).map(render));
    return el;
  };
  host.append(...tree.map(render));
  document.body.append(host);
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    flush,
    async unmount() {
      host.remove();
      await flush();
    },
  };
});
