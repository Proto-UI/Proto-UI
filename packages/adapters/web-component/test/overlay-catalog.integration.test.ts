import { AdaptToWebComponent } from '../src';
import {
  overlayCatalogConformance,
  type OverlayTree,
} from '../../base/test/fixtures/overlay-catalog-conformance';

overlayCatalogConformance('wc', async (tree) => {
  const host = document.createElement('div');
  const render = (node: OverlayTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.className = 'user-overlay-class';
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
    async dispatch(target, event) {
      target.dispatchEvent(event);
    },
    flush,
    async unmount() {
      host.remove();
      await flush();
    },
  };
});
