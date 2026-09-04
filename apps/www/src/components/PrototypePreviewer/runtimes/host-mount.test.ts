import { describe, expect, it, vi } from 'vitest';

import { claimHostMount, releaseHostMount } from './host-mount';

describe('Previewer host mount lease', () => {
  it('invalidates an older generation when another runtime claims the same host', () => {
    const host = document.createElement('div');
    const first = claimHostMount(host);
    const firstCleanup = vi.fn();
    expect(first.commit(firstCleanup)).toBe(true);

    const second = claimHostMount(host);
    expect(first.isCurrent()).toBe(false);
    expect(firstCleanup).toHaveBeenCalledTimes(1);

    host.textContent = 'vue2';
    const secondCleanup = vi.fn();
    expect(second.commit(secondCleanup)).toBe(true);

    // A delayed first completion may only dispose its own resource; it cannot
    // replace the DOM or the cleanup registered by the current runtime.
    expect(first.commit(vi.fn())).toBe(false);
    expect(host.textContent).toBe('vue2');

    releaseHostMount(host);
    expect(secondCleanup).toHaveBeenCalledTimes(1);
    expect(host.childElementCount).toBe(0);
  });

  it('clears framework mount markers together with the host generation', () => {
    const host = document.createElement('div');
    host.setAttribute('data-v-app', '');

    releaseHostMount(host);

    expect(host.hasAttribute('data-v-app')).toBe(false);
  });
});
