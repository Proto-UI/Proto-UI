import {
  createLogicalInstance,
  markProtoInstance,
  unbindProtoInstance,
  registerNativeFocusReadiness,
} from '../src/platform/instance-tree';
import {
  claimWebComponentOwnedRelocation,
  isWebComponentOwnedRelocating,
  withWebComponentOwnedRelocation,
} from '../src/owned-relocation';
import { afterEach, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
let sequence = 0;
afterEach(() => document.body.replaceChildren());
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};
it('parent Template recommit retains the live caller child decoration owner', async () => {
  let setups = 0,
    renders = 0;
  const child = definePrototype({
    name: `owned-slot-child-${++sequence}`,
    setup(def) {
      setups++;
      const target = def.feedback.style.declareDecoration();
      def.feedback.style.to(target).use(tw('bg-black'));
      return (r) => {
        renders++;
        return [r.decoration(target), r.slot()];
      };
    },
  });
  const parent = definePrototype({
    name: `owned-slot-parent-${++sequence}`,
    setup() {
      return (r) => r.el('section', r.slot());
    },
  });
  AdaptToWebComponent(child);
  AdaptToWebComponent(parent);
  const host = document.createElement(parent.name) as HTMLElement & { update(): void },
    nested = document.createElement(child.name);
  const input = document.createElement('input');
  input.value = 'retain';
  nested.append(input);
  host.append(nested);
  document.body.append(host);
  await settle();
  const leaf = nested.querySelector('[data-pui-owned-decoration]');
  expect(leaf).not.toBeNull();
  const before = renders;
  input.focus();
  input.setSelectionRange(1, 4, 'backward');
  host.update();
  await settle();
  expect(setups).toBe(1);
  expect(renders).toBe(before);
  expect(nested.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
  expect(nested.querySelector('input')).toBe(input);
  expect(input.value).toBe('retain');
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
    1,
    4,
    'backward',
  ]);
});

it('changed child blueprints remain rejected rather than silently reusing a structural view', async () => {
  let changed = false;
  const proto = definePrototype({
    name: `owned-slot-explicit-${++sequence}`,
    setup(def) {
      const target = def.feedback.style.declareDecoration();
      return (r) => [r.decoration(target), changed ? r.el('section', r.slot()) : r.slot()];
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name) as HTMLElement & {
    update(): void;
    setProps(props: Record<string, unknown>): void;
  };
  document.body.append(host);
  await settle();
  const leaf = host.firstChild;
  changed = true;
  expect(() => host.update()).toThrow('decoration structural rebind unsupported');
  expect(host.firstChild).toBe(leaf);
  expect(() => host.setProps({ unused: 'changed' })).toThrow(
    'decoration structural rebind unsupported'
  );
  expect(host.firstChild).toBe(leaf);
});

it('authenticates the whole destination ancestry and permanently consumes a reconnect allowance', () => {
  const origin = document.createElement('div'),
    destination = document.createElement('section'),
    other = document.createElement('aside'),
    root = document.createElement('div'),
    child = document.createElement('span');
  root.append(child);
  origin.append(root);
  document.body.append(origin, destination, other);
  withWebComponentOwnedRelocation([root], destination, () => {
    expect(isWebComponentOwnedRelocating(child)).toBe(false);
    destination.append(root);
    const receipt = claimWebComponentOwnedRelocation(child);
    expect(receipt?.()).toBe(true);
    other.append(destination);
    expect(receipt?.()).toBe(false);
    document.body.append(destination);
    expect(receipt?.()).toBe(false);
    other.append(child);
    expect(isWebComponentOwnedRelocating(child)).toBe(false);
    root.append(child);
    expect(claimWebComponentOwnedRelocation(child)).toBeNull();
    expect(receipt?.()).toBe(false);
  });
  expect(isWebComponentOwnedRelocating(child)).toBe(false);
});
it('nested moves cannot renew an already consumed outer reconnect receipt', () => {
  const origin = document.createElement('div'),
    destination = document.createElement('section'),
    nested = document.createElement('aside'),
    root = document.createElement('div');
  origin.append(root);
  document.body.append(origin, destination, nested);
  withWebComponentOwnedRelocation([root], destination, () => {
    destination.append(root);
    const outer = claimWebComponentOwnedRelocation(root);
    expect(outer?.()).toBe(true);
    withWebComponentOwnedRelocation([root], nested, () => {
      nested.append(root);
      expect(claimWebComponentOwnedRelocation(root)?.()).toBe(true);
      expect(outer?.()).toBe(false);
    });
    destination.append(root);
    expect(claimWebComponentOwnedRelocation(root)).toBeNull();
    expect(outer?.()).toBe(false);
  });
  expect(isWebComponentOwnedRelocating(root)).toBe(false);
});
it('foreign documents and throwing moves cannot retain relocation authority', () => {
  const origin = document.createElement('div'),
    destination = document.createElement('section'),
    root = document.createElement('div');
  origin.append(root);
  document.body.append(origin, destination);
  expect(() =>
    withWebComponentOwnedRelocation([root], destination, () => {
      destination.append(root);
      expect(claimWebComponentOwnedRelocation(root)?.()).toBe(true);
      throw new Error('move failed');
    })
  ).toThrow('move failed');
  expect(isWebComponentOwnedRelocating(root)).toBe(false);
  const foreign = document.implementation.createHTMLDocument();
  withWebComponentOwnedRelocation([root], destination, () => {
    foreign.adoptNode(root);
    expect(claimWebComponentOwnedRelocation(root)).toBeNull();
  });
  expect(isWebComponentOwnedRelocating(root)).toBe(false);
});

it('a reentrant author same-parent reconnect cannot reuse the adapter allowance', () => {
  const origin = document.createElement('div'),
    destination = document.createElement('section');
  document.body.append(origin, destination);
  const observations: boolean[] = [];
  let reenter = false;
  class Probe extends HTMLElement {
    connectedCallback() {
      const receipt = claimWebComponentOwnedRelocation(this);
      if (!reenter) return;
      observations.push(!!receipt?.());
      if (receipt) {
        this.parentNode!.appendChild(this);
        observations.push(receipt());
      }
    }
  }
  const name = `owned-slot-reentry-${++sequence}`;
  customElements.define(name, Probe);
  const host = document.createElement(name);
  origin.append(host);
  reenter = true;
  withWebComponentOwnedRelocation([host], destination, () => destination.append(host));
  expect(observations).toEqual([true, false, false]);
  expect(isWebComponentOwnedRelocating(host)).toBe(false);
});

it('cleans up partially acquired authority when a caller descendant accessor throws', () => {
  const destination = document.createElement('section'),
    root = document.createElement('div');
  document.body.append(destination);
  destination.append(root);
  Object.defineProperty(root, 'shadowRoot', {
    configurable: true,
    get() {
      throw new Error('caller accessor');
    },
  });
  expect(() => withWebComponentOwnedRelocation([root], destination, () => {})).toThrow(
    'caller accessor'
  );
  expect(isWebComponentOwnedRelocating(root)).toBe(false);
  delete (root as any).shadowRoot;
});

it('a queued disconnected connect reaction consumes rather than preserves its move allowance', async () => {
  let renders = 0;
  const proto = definePrototype({
    name: `owned-slot-disconnected-${++sequence}`,
    setup() {
      return (r) => {
        renders++;
        return r.slot();
      };
    },
  });
  AdaptToWebComponent(proto);
  const origin = document.createElement('div'),
    destination = document.createElement('section');
  const child = document.createElement(proto.name) as HTMLElement & { connectedCallback(): void };
  origin.append(child);
  document.body.append(origin, destination);
  await settle();
  const before = renders;
  withWebComponentOwnedRelocation([child], destination, () => {
    child.remove();
    // Model a queued original reaction after an earlier ancestor callback detached it.
    child.connectedCallback();
    destination.append(child);
  });
  await settle();
  expect(renders).toBeGreaterThan(before);
  expect(isWebComponentOwnedRelocating(child)).toBe(false);
});

it('transport restores native text selection but does not steal deliberate author focus or blur', () => {
  const origin = document.createElement('div'),
    destination = document.createElement('section');
  const input = document.createElement('input'),
    other = document.createElement('button');
  input.value = 'preserve';
  origin.append(input);
  document.body.append(origin, destination, other);
  input.focus();
  input.setSelectionRange(1, 5, 'backward');
  withWebComponentOwnedRelocation([input], destination, () => destination.append(input));
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
    1,
    5,
    'backward',
  ]);
  withWebComponentOwnedRelocation([input], origin, () => {
    origin.append(input);
    other.focus();
  });
  expect(document.activeElement).toBe(other);
  input.focus();
  withWebComponentOwnedRelocation([input], destination, () => {
    input.blur();
    destination.append(input);
  });
  expect(document.activeElement).not.toBe(input);
});
it('does not restore a removed, disabled, inert or author-reparented focused target', () => {
  for (const mode of ['removed', 'disabled', 'inert', 'reparented']) {
    const origin = document.createElement('div'),
      destination = document.createElement('section'),
      elsewhere = document.createElement('aside'),
      input = document.createElement('input');
    origin.append(input);
    document.body.append(origin, destination, elsewhere);
    input.focus();
    withWebComponentOwnedRelocation([input], destination, () => {
      destination.append(input);
      if (mode === 'removed') input.remove();
      if (mode === 'disabled') input.disabled = true;
      if (mode === 'inert') destination.setAttribute('inert', '');
      if (mode === 'reparented') elsewhere.append(input);
    });
    expect(document.activeElement, mode).not.toBe(input);
    document.body.replaceChildren();
  }
});
it('captures open-shadow active chains while retaining the original native input and selection', () => {
  const origin = document.createElement('div'),
    destination = document.createElement('section'),
    host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' }),
    input = document.createElement('input');
  input.value = 'shadow caller';
  shadow.append(input);
  origin.append(host);
  document.body.append(origin, destination);
  input.focus();
  input.setSelectionRange(2, 6, 'forward');
  withWebComponentOwnedRelocation([host], destination, () => destination.append(host));
  expect(document.activeElement).toBe(host);
  expect(shadow.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
    2,
    6,
    'forward',
  ]);
});

it('does not restore focus into a retired, replaced or revoked logical owner', () => {
  for (const mode of ['retired', 'replaced', 'revoked']) {
    const origin = document.createElement('div'),
      destination = document.createElement('section'),
      host = document.createElement('div'),
      input = document.createElement('input');
    host.append(input);
    origin.append(host);
    document.body.append(origin, destination);
    const proto = definePrototype({
        name: `focus-owner-${++sequence}`,
        setup() {
          return (r) => r.slot();
        },
      }),
      owner = createLogicalInstance(proto);
    markProtoInstance(host, proto, owner);
    const release = registerNativeFocusReadiness(owner, {
      isReady: () => true,
      subscribe: () => () => {},
    });
    input.focus();
    withWebComponentOwnedRelocation([host], destination, () => {
      destination.append(host);
      if (mode === 'retired') release();
      if (mode === 'replaced') markProtoInstance(host, proto, createLogicalInstance(proto));
      if (mode === 'revoked') {
        claimWebComponentOwnedRelocation(host);
        claimWebComponentOwnedRelocation(host);
      }
    });
    expect(document.activeElement, mode).not.toBe(input);
    release();
    unbindProtoInstance(host);
    document.body.replaceChildren();
  }
});
it('focus restoration never replays selection over author type, value, selection or location changes', () => {
  for (const mode of ['type', 'selection', 'reparent']) {
    const origin = document.createElement('div'),
      destination = document.createElement('section'),
      elsewhere = document.createElement('aside'),
      input = document.createElement('input');
    input.value = 'initial value';
    origin.append(input);
    document.body.append(origin, destination, elsewhere);
    input.focus();
    input.setSelectionRange(1, 5);
    let handled = false;
    input.addEventListener(
      'focus',
      () => {
        if (handled) return;
        handled = true;
        if (mode === 'type') input.type = 'number';
        if (mode === 'selection') {
          input.value = 'author value';
          input.setSelectionRange(2, 3);
        }
        if (mode === 'reparent') {
          elsewhere.append(input);
          input.focus();
        }
      },
      { once: true }
    );
    expect(() =>
      withWebComponentOwnedRelocation([input], destination, () => destination.append(input))
    ).not.toThrow();
    if (mode === 'type') expect(input.type).toBe('number');
    if (mode === 'selection') {
      expect(input.value).toBe('author value');
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 3]);
    }
    if (mode === 'reparent') expect(input.parentNode).toBe(elsewhere);
    document.body.replaceChildren();
  }
});
