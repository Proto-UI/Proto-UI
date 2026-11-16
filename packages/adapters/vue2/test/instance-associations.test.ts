import { describe, expect, it, vi } from 'vitest';
import Vue from 'vue';
import { createControlLabelRef, validateInstanceAssociations } from '@proto.ui/core';
import { normalizeVue2InstanceAssociations } from '../src/instance-associations';

const observable = Vue.observable;

describe('Vue2 instance association wrapper normalization', () => {
  it('accepts a genuinely observed wrapper without widening Core admission', () => {
    const ref = createControlLabelRef();
    const input = observable({ controlLabel: ref });
    expect(Object.getOwnPropertyDescriptor(input, '__ob__')?.enumerable).toBe(false);
    expect(() => validateInstanceAssociations(input)).toThrow(/unsupported association/);
    const normalized = normalizeVue2InstanceAssociations(input, observable);
    expect(normalized.controlLabel).toBe(ref);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Reflect.ownKeys(normalized)).toEqual(['controlLabel']);
  });

  it('preserves the original controlLabel getter receiver and error', () => {
    const input = observable({});
    const ref = createControlLabelRef();
    let receiver: unknown;
    Object.defineProperty(input, 'controlLabel', {
      configurable: true,
      get() {
        receiver = this;
        return ref;
      },
    });
    expect(normalizeVue2InstanceAssociations(input, observable).controlLabel).toBe(ref);
    expect(receiver).toBe(input);
    const failure = new Error('original association getter');
    Object.defineProperty(input, 'controlLabel', {
      get() {
        throw failure;
      },
    });
    let caught: unknown;
    try {
      normalizeVue2InstanceAssociations(input, observable);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
  });

  it('rejects fake, stolen, enumerable and accessor observer metadata', () => {
    const ref = createControlLabelRef();
    const genuine = observable({ controlLabel: ref });
    const observer = Object.getOwnPropertyDescriptor(genuine, '__ob__')!.value;
    const fake = { controlLabel: ref };
    Object.defineProperty(fake, '__ob__', { value: { value: fake } });
    const stolen = Object.defineProperty({ controlLabel: ref }, '__ob__', { value: observer });
    const enumerable = observable({ controlLabel: ref });
    Object.defineProperty(enumerable, '__ob__', { enumerable: true });
    const getter = vi.fn(() => observer);
    const accessor = Object.defineProperty({ controlLabel: ref }, '__ob__', { get: getter });
    for (const input of [fake, stolen, enumerable, accessor])
      expect(() => normalizeVue2InstanceAssociations(input, observable)).toThrow(
        /unsupported association/
      );
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects all other own keys and symbols on real observed wrappers', () => {
    const ref = createControlLabelRef();
    const unknown = observable({ controlLabel: ref });
    Object.defineProperty(unknown, 'hiddenAssociation', { value: null });
    const symbolic = observable({ controlLabel: ref });
    Object.defineProperty(symbolic, Symbol('association'), { value: null });
    expect(() => normalizeVue2InstanceAssociations(unknown, observable)).toThrow();
    expect(() => normalizeVue2InstanceAssociations(symbolic, observable)).toThrow();
    expect(() => normalizeVue2InstanceAssociations(observable([]), observable)).toThrow();
  });

  it('does not ignore observation metadata without the owning Vue runtime', () => {
    const input = observable({ controlLabel: createControlLabelRef() });
    expect(() => normalizeVue2InstanceAssociations(input, undefined)).toThrow();
    expect(normalizeVue2InstanceAssociations(undefined, undefined)).toEqual({
      controlLabel: null,
    });
  });
});
