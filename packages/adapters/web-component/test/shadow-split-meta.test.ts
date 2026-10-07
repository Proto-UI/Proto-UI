import { describe, expect, it, vi } from 'vitest';

import {
  createShadowColorSchemeEnvironmentOwner,
  type ShadowColorSchemeSource,
} from '../src/shadow-color-scheme-environment';
import { createShadowSplitMetaGetter } from '../src/shadow-split-meta';

describe('Shadow split meta composition', () => {
  it('reserves colorScheme for the retained environment without consulting the base getter', () => {
    let colorScheme: 'light' | 'dark' = 'light';
    const listeners = new Set<() => void>();
    const source: ShadowColorSchemeSource = {
      get: () => colorScheme,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const owner = createShadowColorSchemeEnvironmentOwner(
      document.createElement('x-shadow-split-meta'),
      source
    );
    const baseGetMeta = vi.fn(() => 'base-dark');
    const getMeta = createShadowSplitMetaGetter({ environment: owner, baseGetMeta });

    expect(getMeta('colorScheme')).toBe('light');
    expect(baseGetMeta).not.toHaveBeenCalled();

    colorScheme = 'dark';
    for (const listener of listeners) listener();

    expect(getMeta('colorScheme')).toBe('dark');
    expect(baseGetMeta).not.toHaveBeenCalled();

    owner.dispose();
  });

  it('delegates every non-reserved key unchanged and exactly once', () => {
    const environment = { colorScheme: 'dark' as const };
    const baseGetMeta = vi.fn((key: string) => ({ key, owner: 'base' }));
    const getMeta = createShadowSplitMetaGetter({ environment, baseGetMeta });

    expect(getMeta('reducedMotion')).toEqual({ key: 'reducedMotion', owner: 'base' });
    expect(baseGetMeta).toHaveBeenCalledTimes(1);
    expect(baseGetMeta).toHaveBeenCalledWith('reducedMotion');
  });
});
