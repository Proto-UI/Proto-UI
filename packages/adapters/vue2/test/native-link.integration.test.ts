import { activationTurn } from '../../../modules/native-link/test/no-network';
import { expect, it, vi } from 'vitest';
import { linkFixture } from '../../../modules/native-link/test/fixture';
import { createVue2Adapter } from '../src';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from './utils/vue2';

it('Vue2 selects a real anchor with native activation and prop replacement', async () => {
  const observe = vi.fn();
  const Component = createVue2Adapter(Vue2RuntimeAny)(linkFixture({ observe }));
  const host = document.createElement('div');
  document.body.append(host);
  const vm = new Vue2Any({
    data: () => ({ input: { href: '#one', target: '_blank', rel: 'external' } }),
    render(h: any) {
      return h(Component, { attrs: this.input });
    },
  }).$mount();
  host.append(vm.$el);
  await flushVue2();
  const anchor = vm.$el as HTMLAnchorElement;
  try {
    expect(anchor.localName).toBe('a');
    expect(anchor.textContent).toBe('Link text');
    expect(anchor.getAttribute('href')).toBe('#one');
    expect(anchor.rel).toBe('external noopener');
    const event = new MouseEvent('click', { cancelable: true, metaKey: true });
    anchor.dispatchEvent(event);
    await activationTurn();
    await flushVue2();
    expect(event.defaultPrevented).toBe(false);
    expect(observe).toHaveBeenCalledOnce();
    vm.input = { href: '#two', disabled: true };
    await flushVue2();
    expect(anchor.hasAttribute('href')).toBe(false);
    expect(anchor.hasAttribute('target')).toBe(false);
    vm.input = { href: '#three' };
    await flushVue2();
    expect(anchor.getAttribute('href')).toBe('#three');
  } finally {
    vm.$destroy();
    host.remove();
  }
  expect(anchor.hasAttribute('href')).toBe(false);
});
