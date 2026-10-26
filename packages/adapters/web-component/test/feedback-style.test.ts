import { describe, it, expect } from 'vitest';
import {
  applyFeedbackStyleTokensToHost,
  applyStyleTokensToHost,
  createOwnedTwTokenApplier,
} from '../src/feedback-style';

describe('adapter-web-component: owned tw tokens applier', () => {
  it('does not restore an external overlap its owner explicitly removed', () => {
    const host = document.createElement('div');
    host.setAttribute('data-pui-style', 'external-token w-full');
    const applier = createOwnedTwTokenApplier(host);
    applier.apply(['w-full']);
    host.setAttribute('data-pui-style', 'external-token');
    applier.apply(['w-full']);
    expect(host.getAttribute('data-pui-style')).toBe('external-token w-full');
    applier.clear();
    expect(host.getAttribute('data-pui-style')).toBe('external-token');
  });
  it('apply adds tokens to data-pui-style and does not touch user classes', () => {
    const host = document.createElement('div');
    host.className = 'user-a user-b';

    const applier = createOwnedTwTokenApplier(host);
    applier.apply(['opacity-50', 'bg-red-500']);

    expect(host.classList.contains('user-a')).toBe(true);
    expect(host.classList.contains('user-b')).toBe(true);
    expect(host.classList.contains('opacity-50')).toBe(false);
    expect(host.classList.contains('bg-red-500')).toBe(false);
    expect(host.getAttribute('data-pui-style')).toBe('opacity-50 bg-red-500');
  });

  it('replace removes old owned tokens and adds new ones', () => {
    const host = document.createElement('div');
    host.className = 'user-a';

    const applier = createOwnedTwTokenApplier(host);

    applier.apply(['bg-red-500', 'opacity-50']);
    expect(host.getAttribute('data-pui-style')).toBe('bg-red-500 opacity-50');

    applier.apply(['bg-blue-500']); // replace
    expect(host.getAttribute('data-pui-style')).toBe('bg-blue-500');

    // user class preserved
    expect(host.classList.contains('user-a')).toBe(true);
  });

  it('preserves tokens owned by other internal sources when replacing or clearing', () => {
    const host = document.createElement('div');
    host.setAttribute('data-pui-style', 'external-token');

    applyStyleTokensToHost(host, ['inline-flex', 'rounded-md']);
    const clearFeedback = applyFeedbackStyleTokensToHost(host, ['opacity-50']);

    expect(host.getAttribute('data-pui-style')?.split(/\s+/)).toEqual([
      'external-token',
      'inline-flex',
      'rounded-md',
      'opacity-50',
    ]);

    clearFeedback();

    expect(host.getAttribute('data-pui-style')?.split(/\s+/)).toEqual([
      'external-token',
      'inline-flex',
      'rounded-md',
    ]);

    applyStyleTokensToHost(host, ['inline-flex']);

    expect(host.getAttribute('data-pui-style')?.split(/\s+/)).toEqual([
      'external-token',
      'inline-flex',
    ]);
  });

  it('keeps duplicated tokens while another owner still owns them', () => {
    const host = document.createElement('div');
    const base = createOwnedTwTokenApplier(host);
    const transient = createOwnedTwTokenApplier(host);

    base.apply(['inline-flex', 'opacity-50']);
    transient.apply(['opacity-50', 'bg-red-500']);

    expect(host.getAttribute('data-pui-style')?.split(/\s+/)).toEqual([
      'inline-flex',
      'opacity-50',
      'bg-red-500',
    ]);

    transient.clear();

    expect(host.getAttribute('data-pui-style')?.split(/\s+/)).toEqual([
      'inline-flex',
      'opacity-50',
    ]);
  });

  it('apply([]) clears all owned tokens', () => {
    const host = document.createElement('div');
    host.className = 'user-a';

    const applier = createOwnedTwTokenApplier(host);
    applier.apply(['bg-red-500', 'opacity-50']);
    applier.apply([]);

    expect(host.hasAttribute('data-pui-style')).toBe(false);
    expect(host.classList.contains('user-a')).toBe(true);
  });

  it('idempotent: applying same tokens does not change owned set', () => {
    const host = document.createElement('div');
    const applier = createOwnedTwTokenApplier(host);

    applier.apply(['bg-red-500', 'bg-red-500', '']);
    const owned1 = Array.from(applier.getOwned());

    applier.apply(['bg-red-500']);
    const owned2 = Array.from(applier.getOwned());

    expect(owned1).toEqual(owned2);
    expect(owned2).toEqual(['bg-red-500']);
    expect(host.getAttribute('data-pui-style')).toBe('bg-red-500');
  });
});
