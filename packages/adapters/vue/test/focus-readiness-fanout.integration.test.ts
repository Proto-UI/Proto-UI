import * as tree from '../src/platform/instance-tree';
import { createMountedVueAdapter, flushVue } from './utils/vue';
import { focusReadinessFanoutConformance } from '../../base/test/fixtures/focus-readiness-fanout-conformance';
focusReadinessFanoutConformance('vue', tree, async (proto) => {
  const mounted = createMountedVueAdapter(proto);
  await flushVue();
  await flushVue();
  return {
    get root() {
      return mounted.host.firstElementChild as HTMLElement;
    },
    getExposes: () => mounted.vm.getExposes(),
    act: async (callback) => {
      callback();
      await flushVue();
      await flushVue();
    },
    unmount: async () => mounted.unmount(),
  };
});
