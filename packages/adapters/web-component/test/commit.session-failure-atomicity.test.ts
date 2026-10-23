import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent } from '../src';
import type { Prototype } from '@proto.ui/core';

let nextName = 0;
afterEach(() => document.body.replaceChildren());

describe('WC session failed blueprint preserves projected caller content', () => {
  it('rejects an invalid update without detaching the existing caller slot pool', async () => {
    let invalid = false;
    const prototype: Prototype = {
      name: `x-slot-reject-update-${nextName++}`,
      setup() {
        return (r) => [
          r.el('section', r.slot()),
          ...(invalid ? [{ type: { kind: 'prototype', name: 'forbidden' } } as any] : []),
        ];
      },
    };
    AdaptToWebComponent(prototype);
    const host = document.createElement(prototype.name) as HTMLElement & { update(): void };
    const input = document.createElement('input');
    input.value = 'unchanged';
    const tail = document.createTextNode('caller-tail');
    host.append(input, tail);
    document.body.append(host);
    await Promise.resolve();
    const parent = input.parentNode;
    const original = [...host.childNodes];
    input.focus();
    input.setSelectionRange(1, 5, 'backward');
    invalid = true;
    expect(() => host.update()).toThrow('PrototypeRef');
    expect([...host.childNodes]).toEqual(original);
    expect(input.parentNode).toBe(parent);
    expect(tail.parentNode).toBe(parent);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(5);
    expect(input.selectionDirection).toBe('backward');
    invalid = false;
    host.update();
    expect(host.querySelector('input')).toBe(input);
    expect(host.textContent).toBe('caller-tail');
  });
});
