import { describe, expect, it } from 'vitest';

import { AdapterIds, InternalAdapterIds, selectRuntimeIds } from './registry';

describe('runtime registry', () => {
  it('presents Vue 2 as an official public adapter', () => {
    expect(AdapterIds).toEqual(['wc', 'react', 'vue', 'vue2']);
    expect(InternalAdapterIds).toEqual(['wc', 'react', 'vue', 'vue2']);
  });

  it('uses defaults only for omitted runtime input and fails closed for explicit unsupported input', () => {
    expect(selectRuntimeIds(undefined, ['wc', 'vue2'])).toEqual(['wc', 'vue2']);
    expect(selectRuntimeIds(['vue2'], AdapterIds)).toEqual(['vue2']);
    expect(() => selectRuntimeIds([], AdapterIds)).toThrow(/explicitly requested runtimes/);
    expect(() => selectRuntimeIds(['vue2'], ['wc', 'react', 'vue'])).toThrow(
      /none of the explicitly requested runtimes are permitted: vue2/
    );
  });
});
