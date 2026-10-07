import * as tree from '../src/platform/instance-tree';
import { createMountedVue2Adapter, flushVue2, Vue2Any } from './utils/vue2';
import { focusReadinessFanoutConformance } from '../../base/test/fixtures/focus-readiness-fanout-conformance';
focusReadinessFanoutConformance('vue2', tree, async (proto) => {
  const mounted = createMountedVue2Adapter(proto);
  await flushVue2();
  return {
    get root() {
      return mounted.host.firstElementChild as HTMLElement;
    },
    getExposes: () => mounted.vm.getExposes(),
    act: async (callback) => {
      callback();
      await Vue2Any.nextTick();
      await Promise.resolve();
      await Vue2Any.nextTick();
    },
    unmount: async () => mounted.unmount(),
  };
});
