import { describe, expect, it } from 'vitest';
import {
  createControlLabelRef,
  isControlLabelRef,
  validateInstanceAssociations,
} from '../src/control-label';
import { isJsonPropsValue } from '../../modules/props/src/kernel/json-value';

describe('dedicated typed instance-association input', () => {
  it.each([undefined, {}])(
    'does not turn an inherited reference into an explicit association: %j',
    (input) => {
      const original = Object.getOwnPropertyDescriptor(Object.prototype, 'controlLabel');
      const ref = createControlLabelRef();
      let actual: unknown;
      try {
        Object.defineProperty(Object.prototype, 'controlLabel', { configurable: true, value: ref });
        actual = validateInstanceAssociations(input).controlLabel;
      } finally {
        if (original) Object.defineProperty(Object.prototype, 'controlLabel', original);
        else Reflect.deleteProperty(Object.prototype, 'controlLabel');
      }
      expect(actual).toBeNull();
    }
  );
  it('rejects an unsupported own key even when it is non-enumerable', () => {
    const input = Object.defineProperty({}, 'hiddenAssociation', { value: null });
    expect(() => validateInstanceAssociations(input)).toThrow(/unsupported association/);
  });
  it('accepts an explicit own reference independently of its enumeration flag', () => {
    const ref = createControlLabelRef();
    const input = Object.defineProperty({}, 'controlLabel', { value: ref });
    expect(validateInstanceAssociations(input).controlLabel).toBe(ref);
  });
  it('retains the original error from an explicit own getter', () => {
    const error = new Error('association source failed');
    const input = Object.defineProperty({}, 'controlLabel', {
      get() {
        throw error;
      },
    });
    let caught: unknown;
    try {
      validateInstanceAssociations(input);
    } catch (failure) {
      caught = failure;
    }
    expect(caught).toBe(error);
  });
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
    expect(validateInstanceAssociations(undefined)).toEqual({ controlLabel: null });
    expect(validateInstanceAssociations({})).toEqual({ controlLabel: null });
    expect(validateInstanceAssociations({ controlLabel: null })).toEqual({ controlLabel: null });
  });
});
