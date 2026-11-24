import { createVue2Adapter } from '../src/adapt';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';
import { materialReservationConformance } from '../../base/test/fixtures/material-reservation-conformance';

materialReservationConformance('vue2', async (owner, target, duplicate) => {
  const host = document.createElement('div');
  document.body.append(host);
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const Owner = adapt(owner),
    Target = adapt(target);
  const App = Vue2Any.extend({
    render(h: any) {
      return h(Owner, { ref: 'owner' }, [
        h(Target, {}, [h('b', {}, 'borrowed target')]),
        ...(duplicate ? [h(Target, {}, ['second target'])] : []),
      ]);
    },
  });
  const vm = new App().$mount();
  host.append(vm.$el);
  const settle = async (action: () => void) => {
    action();
    await flushVue2();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushVue2();
  };
  await settle(() => {});
  let mounted = true;
  return {
    host,
    update: () => settle(() => vm.$refs.owner.update()),
    async unmount() {
      if (!mounted) return;
      mounted = false;
      await settle(() => vm.$destroy());
      host.remove();
    },
  };
});
