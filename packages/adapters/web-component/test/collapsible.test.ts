import { COLLAPSIBLE_PROJECTIONS } from '../../base/test/fixtures/collapsible-projections';
import { AdaptToWebComponent, setElementProps } from '../src';
import {
  collapsibleAdapterConformance,
  type CollapsibleTree,
  type CollapsibleDriver,
} from '../../base/test/fixtures/collapsible-conformance';

const mount: CollapsibleDriver = async (tree) => {
  const host = document.createElement('div');
  const elements = new Map<string, any>();
  const render = (node: CollapsibleTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const element = document.createElement(node.proto.name) as any;
    elements.set(node.key, element);
    setElementProps(element, node.props);
    if (node.onOpenChange)
      element.addEventListener('openChange', (event: CustomEvent) => {
        if (event.target === element) node.onOpenChange!(event.detail);
      });
    element.append(...(node.children ?? []).map(render));
    return element;
  };
  const flush = async (action?: () => void) => {
    action?.();
    const update = (nodes: CollapsibleTree[]) => {
      for (const node of nodes) {
        setElementProps(elements.get(node.key), node.props);
        update(node.children ?? []);
      }
    };
    update(tree);
    for (let index = 0; index < 8; index++) await Promise.resolve();
  };
  try {
    host.append(...tree.map(render));
    document.body.append(host);
    await flush();
  } catch (error) {
    host.remove();
    await flush();
    throw error;
  }
  return {
    host,
    exposes: (key) => elements.get(key).getExposes(),
    flush,
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
};

collapsibleAdapterConformance('wc', mount);
for (const [family, projection] of COLLAPSIBLE_PROJECTIONS) {
  collapsibleAdapterConformance(`wc/${family}`, mount, projection);
}
