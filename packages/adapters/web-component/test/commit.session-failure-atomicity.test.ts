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

  it('does not remove a caller reparented by its disconnection callback during a no-slot commit', () => {
    let showSlot = true;
    let armed = false;
    let moved = false;
    const destination = document.createElement('aside');
    const callerName = `x-reparented-caller-${nextName++}`;
    customElements.define(
      callerName,
      class extends HTMLElement {
        disconnectedCallback() {
          if (!armed || moved) return;
          moved = true;
          destination.append(this);
        }
      }
    );
    const prototype: Prototype = {
      name: `x-slot-reparent-update-${nextName++}`,
      setup() {
        return (r) => (showSlot ? r.slot() : r.el('p', 'no slot'));
      },
    };
    AdaptToWebComponent(prototype);
    const host = document.createElement(prototype.name) as HTMLElement & { update(): void };
    const caller = document.createElement(callerName);
    host.append(caller);
    document.body.append(destination, host);
    armed = true;
    showSlot = false;
    host.update();
    expect(caller.parentNode).toBe(destination);
    expect(caller.isConnected).toBe(true);
    expect(host.textContent).toBe('no slot');
  });

  it('does not reclaim a caller whose ancestor moved to an external detached tree during commit', () => {
    let showSlot = true;
    let armed = false;
    let moved = false;
    const destination = document.createDocumentFragment();
    const callerName = `x-reparented-ancestor-caller-${nextName++}`;
    customElements.define(
      callerName,
      class extends HTMLElement {
        disconnectedCallback() {
          if (!armed || moved) return;
          moved = true;
          destination.append(this.parentNode!);
        }
      }
    );
    const prototype: Prototype = {
      name: `x-slot-ancestor-reparent-update-${nextName++}`,
      setup() {
        return (r) => (showSlot ? r.el('section', r.slot()) : r.el('p', 'no slot'));
      },
    };
    AdaptToWebComponent(prototype);
    const host = document.createElement(prototype.name) as HTMLElement & { update(): void };
    const caller = document.createElement(callerName);
    host.append(caller);
    document.body.append(host);
    const originalParent = caller.parentNode;
    armed = true;
    showSlot = false;
    host.update();
    expect(destination.firstChild).toBe(originalParent);
    expect(caller.parentNode).toBe(originalParent);
    expect(destination.contains(caller)).toBe(true);
    expect(host.textContent).toBe('no slot');
  });
});
