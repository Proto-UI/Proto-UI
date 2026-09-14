import { AdaptToWebComponent } from '../src';
import {
  feedbackAdapterConformance,
  type FeedbackTree,
} from '../../base/test/fixtures/feedback-conformance';

feedbackAdapterConformance('wc', async (tree) => {
  const host = document.createElement('div');
  const render = (node: FeedbackTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto);
    const el = document.createElement(node.proto.name);
    el.className = 'user-feedback-class';
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
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
});
