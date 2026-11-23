import { definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asInputRoot, type InputRootProps } from '../../../../prototypes/base/src/input/root.proto';

type InstanceHandle = DefHandle<InputRootProps> | RunHandle<InputRootProps>;
const distinctHandles = (left: InstanceHandle, right: InstanceHandle) => left !== right;

// The official editor renders an empty template while TextControl supplies the
// native editing surface. Borrowing its render is ordinary authored composition.
export default definePrototype<InputRootProps>({
  name: 'official-input-delegated-render',
  modules: asInputRoot.modules,
  setup(def) {
    const inherited = asInputRoot();
    let current: RunHandle<InputRootProps> | null = null;
    def.lifecycle.onMounted((run) => {
      current = run;
    });
    def.expose.method('sameRun', () => {
      const run = current;
      return run !== null && run === current && distinctHandles(run, def);
    });
    return inherited.render;
  },
});
