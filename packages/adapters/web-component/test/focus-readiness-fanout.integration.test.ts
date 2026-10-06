import * as tree from '../src/platform/instance-tree';
import { AdaptToWebComponent } from '../src';
import { focusReadinessFanoutConformance } from '../../base/test/fixtures/focus-readiness-fanout-conformance';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
focusReadinessFanoutConformance('wc', tree, async (proto) => {
  AdaptToWebComponent(proto);
  const root = document.createElement(proto.name) as HTMLElement & { getExposes(): any };
  document.body.append(root);
  await flush();
  return {
    root,
    getExposes: () => root.getExposes(),
    act: async (callback) => {
      callback();
      await flush();
    },
    unmount: async () => {
      root.remove();
      await flush();
    },
  };
});
