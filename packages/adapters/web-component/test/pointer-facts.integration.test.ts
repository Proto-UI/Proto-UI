// @vitest-environment happy-dom
import { AdaptToWebComponent } from '../src';
import { pointerFactsConformance } from '../../base/test/fixtures/pointer-facts-conformance';

pointerFactsConformance('wc', async (prototype) => {
  AdaptToWebComponent(prototype);
  const root = document.createElement(prototype.name);
  document.body.append(root);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  return { root, flush, async dispatch(target, sample) { target.dispatchEvent(sample); }, async unmount() { root.remove(); await flush(); } };
});
