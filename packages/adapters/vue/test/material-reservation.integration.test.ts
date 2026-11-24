import { createVueAdapter } from '../src/adapt';
import { VueAny, flushVue } from './utils/vue';
import { materialReservationConformance } from '../../base/test/fixtures/material-reservation-conformance';

materialReservationConformance('vue', async (owner, target, duplicate) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVueAdapter(VueAny);
  const Owner = adapt(owner),
    Target = adapt(target);
  const ref = VueAny.ref(null);
  const app = VueAny.createApp({
    render: () =>
      VueAny.h(Owner, { ref }, () => [
        VueAny.h(Target, {}, () => VueAny.h('b', {}, 'borrowed target')),
        ...(duplicate ? [VueAny.h(Target, {}, () => 'second target')] : []),
      ]),
  });
  const settle = async (action: () => void) => {
    action();
    await flushVue();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushVue();
  };
  await settle(() => app.mount(host));
  let mounted = true;
  return {
    host,
    update: () => settle(() => ref.value.update()),
    async unmount() {
      if (!mounted) return;
      mounted = false;
      await settle(() => app.unmount());
      host.remove();
    },
  };
});
