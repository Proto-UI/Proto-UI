import { activationTurn } from '../../../modules/native-link/test/no-network';
import { expect, it, vi } from 'vitest';
import { linkFixture } from '../../../modules/native-link/test/fixture';
import { createMountedReactAdapter } from './utils/fake-react';

it('React selects a real anchor, replaces portable props, retains native defaults and cleans up', async () => {
  const observe = vi.fn();
  const mounted = createMountedReactAdapter(linkFixture({ observe }), {
    href: '#one',
    target: '_blank',
    rel: 'external',
  });
  const anchor = mounted.root as HTMLAnchorElement;
  expect(anchor.localName).toBe('a');
  expect(anchor.textContent).toBe('Link text');
  expect(anchor.getAttribute('href')).toBe('#one');
  expect(anchor.rel).toBe('external noopener');
  const event = new MouseEvent('click', { cancelable: true, ctrlKey: true });
  anchor.dispatchEvent(event);
  await activationTurn();
  await Promise.resolve();
  expect(event.defaultPrevented).toBe(false);
  expect(observe).toHaveBeenCalledWith({
    href: '#one',
    target: '_blank',
    rel: 'external noopener',
    modified: true,
  });
  mounted.update({ href: '#two', disabled: true });
  expect(anchor.hasAttribute('href')).toBe(false);
  expect(anchor.hasAttribute('target')).toBe(false);
  const disabled = new MouseEvent('click', { cancelable: true });
  anchor.dispatchEvent(disabled);
  expect(disabled.defaultPrevented).toBe(true);
  mounted.update({ href: '#three' });
  expect(anchor.getAttribute('href')).toBe('#three');
  mounted.unmount();
  expect(anchor.hasAttribute('href')).toBe(false);
  anchor.dispatchEvent(new MouseEvent('click'));
  await Promise.resolve();
  expect(observe).toHaveBeenCalledOnce();
});
