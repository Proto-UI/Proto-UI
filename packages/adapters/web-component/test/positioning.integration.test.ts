import { AdaptToWebComponent } from '../src';
import {
  positioningAdapterConformance,
  type PositioningTree,
} from '../../base/test/fixtures/positioning-conformance';

positioningAdapterConformance('wc', async (tree) => {
  const host = document.createElement('div');
  const render = (node: PositioningTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.className = 'user-positioning-class';
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
