import { describe, expect, it } from 'vitest';
import { isControlLabelRef } from '@proto.ui/core';
import { createDemoAssociationScope } from './demo-associations';
import { assertDemoSpec } from './demo-types';

describe('data-only demo association lowering', () => {
  it('prunes only retired keys while retaining live association identity', () => {
    const scope = createDemoAssociationScope();
    const retained = scope.resolve({ controlLabel: 'keep' });
    const retired = scope.resolve({ controlLabel: 'retire' });
    scope.reconcile(['keep']);
    expect(scope.resolve({ controlLabel: 'keep' })).toBe(retained);
    expect(scope.resolve({ controlLabel: 'retire' })).not.toBe(retired);
    scope.reconcile([]);
    expect(scope.resolve({ controlLabel: 'keep' })).not.toBe(retained);
    scope.dispose();
    expect(() => scope.reconcile([])).toThrow(/disposed/);
  });
  it('materializes stable public references inside one render but never across renders', () => {
    const one = createDemoAssociationScope();
    const two = createDemoAssociationScope();
    const a = one.resolve({ controlLabel: 'updates' })!;
    expect(isControlLabelRef(a.controlLabel)).toBe(true);
    expect(one.resolve({ controlLabel: 'updates' })).toBe(a);
    expect(two.resolve({ controlLabel: 'updates' })!.controlLabel).not.toBe(a.controlLabel);
    one.dispose();
    expect(() => one.resolve({ controlLabel: 'updates' })).toThrow(/disposed/);
    two.dispose();
  });
  it('allows data-only association keys without putting opaque values in demo Props', () => {
    expect(() =>
      assertDemoSpec({
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'base-label-root',
          associations: { controlLabel: 'updates' },
          props: { naming: true, activation: true },
        },
      })
    ).not.toThrow();
    expect(() =>
      assertDemoSpec({
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'base-label-root',
          props: { instanceAssociations: { controlLabel: 'updates' } },
        },
      })
    ).toThrow(/node.associations/);
  });
  it.each([
    { controlLabel: '' },
    { controlLabel: ' ' },
    { controlLabel: {} },
    { controlLabel: 'a', other: 'b' },
  ])('rejects invalid association key %j', (keys) => {
    const scope = createDemoAssociationScope();
    expect(() => scope.resolve(keys as any)).toThrow();
    scope.dispose();
  });
});
