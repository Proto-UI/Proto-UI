import { AdaptToWebComponent } from '../src';
import {
  boundaryAdapterConformance,
  type BoundaryTree,
} from '../../base/test/fixtures/boundary-conformance';

boundaryAdapterConformance('wc', async (tree) => {
  const host = document.createElement('div');
  const render = (node: BoundaryTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.className = 'user-boundary-class';
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
    async press(target) {
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
});
