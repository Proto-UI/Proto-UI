// @vitest-environment happy-dom
import { createMountedVueAdapter, flushVue } from './utils/vue';
import { pointerFactsConformance } from '../../base/test/fixtures/pointer-facts-conformance';

// Preserve the existing real Vue mount path. The legacy utility's type boundary
// is not evidence of strict VueRuntime signature compatibility.
pointerFactsConformance('vue', async (prototype) => {
  const mounted = createMountedVueAdapter(prototype);
  if (!(mounted.root instanceof HTMLElement)) {
    mounted.unmount();
    throw new Error('Vue author fixture did not mount a physical Proto root');
  }
  return {
    root: mounted.root,
    async flush() {
      await flushVue();
      await flushVue();
    },
    async dispatch(target, sample) {
      target.dispatchEvent(sample);
    },
    async unmount() {
      mounted.unmount();
      await flushVue();
    },
  };
});
