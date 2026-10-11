import { activationTurn } from '../../../modules/native-link/test/no-network';
import { expect, it, vi } from 'vitest';
import { linkFixture } from '../../../modules/native-link/test/fixture';
import { createVueAdapter } from '../src';
import { VueAny, flushVue } from './utils/vue';

it('Vue selects and keeps one real anchor across full property replacements', async () => {
  const observe = vi.fn();
  const Component = createVueAdapter(VueAny)(linkFixture({ observe }));
  const props = VueAny.ref({ href: '#one', target: '_blank', rel: 'external' });
  const host = document.createElement('div');
  document.body.append(host);
  const app = VueAny.createApp({ setup: () => () => VueAny.h(Component, props.value) });
  app.mount(host);
  await flushVue();
  const anchor = host.firstElementChild as HTMLAnchorElement;
  try {
    expect(anchor.localName).toBe('a');
    expect(anchor.textContent).toBe('Link text');
    expect(anchor.getAttribute('href')).toBe('#one');
    expect(anchor.rel).toBe('external noopener');
    const event = new MouseEvent('click', { cancelable: true });
    anchor.dispatchEvent(event);
    await activationTurn();
    await flushVue();
    expect(event.defaultPrevented).toBe(false);
    expect(observe).toHaveBeenCalledOnce();
    props.value = { href: '#two', disabled: true };
    await flushVue();
    expect(host.firstElementChild).toBe(anchor);
    expect(anchor.hasAttribute('href')).toBe(false);
    expect(anchor.hasAttribute('target')).toBe(false);
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    props.value = { href: '#three' };
    await flushVue();
    expect(anchor.getAttribute('href')).toBe('#three');
  } finally {
    app.unmount();
    host.remove();
  }
  expect(anchor.hasAttribute('href')).toBe(false);
});
