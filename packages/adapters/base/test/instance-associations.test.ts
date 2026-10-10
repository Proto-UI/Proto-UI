import { describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { withoutInstanceAssociations } from '../src/host/instance-associations';
describe('Adapter association input boundary', () => {
  it('removes only the dedicated input even if custom getProps forwards it', () => {
    const input = {
      label: 'a',
      value: 2,
      instanceAssociations: { controlLabel: createControlLabelRef() },
    };
    expect(withoutInstanceAssociations(input)).toEqual({ label: 'a', value: 2 });
    expect(input.instanceAssociations).toBeDefined();
  });
  it('retains ordinary Props identity when there is nothing to remove', () => {
    const input = { label: 'a' };
    expect(withoutInstanceAssociations(input)).toBe(input);
  });
});
