import { describe, expect, it } from 'vitest';
import {
  createControlLabelRef,
  isControlLabelRef,
  validateInstanceAssociations,
} from '../src/control-label';
import { isJsonPropsValue } from '../../modules/props/src/kernel/json-value';

describe('dedicated typed instance-association input', () => {
  it('preserves a public opaque reference without admitting it as JSON Props', () => {
    const ref = createControlLabelRef();
    expect(isControlLabelRef(ref)).toBe(true);
    expect(isJsonPropsValue(ref)).toBe(false);
    expect(validateInstanceAssociations({ controlLabel: ref }).controlLabel).toBe(ref);
    expect(() => JSON.stringify(ref)).toThrow(/cannot be serialized/);
  });
  it.each([{}, 'control-a', { id: 'a' }, [], new Date(), () => {}])(
    'rejects a cloned, serializable or foreign reference %j',
    (ref) => {
      expect(() => validateInstanceAssociations({ controlLabel: ref })).toThrow(
        /public opaque reference/
      );
    }
  );
  it.each([{ other: {} }, { controlLabel: null, other: null }, [], null, '{"controlLabel":"a"}'])(
    'rejects unknown keys and implicit attribute/static lowering %j',
    (input) => {
      expect(() => validateInstanceAssociations(input)).toThrow();
    }
  );
  it('accepts only explicit clearing or omission in an otherwise valid channel', () => {
    expect(validateInstanceAssociations(undefined)).toEqual({});
    expect(validateInstanceAssociations({})).toEqual({ controlLabel: null });
    expect(validateInstanceAssociations({ controlLabel: null })).toEqual({ controlLabel: null });
  });
});
