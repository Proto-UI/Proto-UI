// @vitest-environment happy-dom
import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';
import { pointerFactsConformance } from '../../base/test/fixtures/pointer-facts-conformance';

// Retain the existing real Vue2.extend mount path. Its legacy test utility is
// not evidence of strict Vue2Runtime signature compatibility.
pointerFactsConformance('vue2', async (prototype) => {
  const mounted = createMountedVue2Adapter(prototype);
  if (!mounted.root) { mounted.unmount(); throw new Error('Vue2 author fixture did not mount a physical Proto root'); }
  return { root: mounted.root, async flush() { await flushVue2(); await flushVue2(); }, async dispatch(target, sample) { target.dispatchEvent(sample); }, async unmount() { mounted.unmount(); await flushVue2(); } };
});
