import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype, type TemplateChild } from '@proto.ui/core';
let commitChildren: typeof import('../src/commit').commitChildren;
let captureWebComponentCallerFocus: typeof import('../src/owned-relocation').captureWebComponentCallerFocus;
let withWebComponentOwnedRelocation: typeof import('../src/owned-relocation').withWebComponentOwnedRelocation;
let createLogicalInstance: typeof import('../src/platform/instance-tree').createLogicalInstance;
let markProtoInstance: typeof import('../src/platform/instance-tree').markProtoInstance;
let registerNativeFocusReadiness: typeof import('../src/platform/instance-tree').registerNativeFocusReadiness;
let unbindProtoInstance: typeof import('../src/platform/instance-tree').unbindProtoInstance;
async function loadRuntime() {
  vi.resetModules();
  ({ commitChildren } = await import('../src/commit'));
  ({ captureWebComponentCallerFocus, withWebComponentOwnedRelocation } =
    await import('../src/owned-relocation'));
  ({ createLogicalInstance, markProtoInstance, registerNativeFocusReadiness, unbindProtoInstance } =
    await import('../src/platform/instance-tree'));
}

let sequence = 0;
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const slot = { type: { kind: 'slot' } };
const tree = { type: 'section', children: [slot] } as TemplateChild;
function activeLeaf(doc: Document): Element | null {
  let node = doc.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
}
function fixture(shadow = false) {
  const outer = document.createElement('div');
  const caller = document.createElement('div');
  const input = document.createElement('input');
  const other = document.createElement('button');
  const elsewhere = document.createElement('aside');
  input.value = 'preserve selection';
  (shadow ? caller.attachShadow({ mode: 'open' }) : caller).append(input);
  outer.append(caller);
  document.body.append(outer, other, elsewhere);
  input.focus();
  input.setSelectionRange(2, 8, 'backward');
  return { outer, caller, input, other, elsewhere };
}

/**
 * The exact Chrome order observed in native-7251 is: insertBefore entry, input
 * blur/focusout while connected to its old parent, activeElement BODY, then the
 * physical removal. Happy DOM normally emits a different order. This local
 * primitive shim models that observed ordering; it is not native acceptance.
 */
function modelChromeBeforeRemoval(input: HTMLInputElement, caller: Node, throwAfterBlur = false) {
  const events: Array<{
    kind: string;
    connected: boolean;
    active: Element | null;
    parent: Node | null;
    related?: EventTarget | null;
  }> = [];
  const original = Node.prototype.insertBefore;
  let injected = false;
  const onOut = (event: FocusEvent) =>
    events.push({
      kind: 'focusout',
      connected: input.isConnected,
      active: activeLeaf(document),
      parent: caller.parentNode,
      related: event.relatedTarget,
    });
  input.addEventListener('focusout', onOut);
  vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function <T extends Node>(
    this: Node,
    node: T,
    before: Node | null
  ): T {
    if (!injected && node === caller && input.isConnected && activeLeaf(document) === input) {
      injected = true;
      events.push({
        kind: 'before-removal',
        connected: input.isConnected,
        active: activeLeaf(document),
        parent: caller.parentNode,
      });
      input.blur();
      events.push({
        kind: 'after-blur-before-removal',
        connected: input.isConnected,
        active: activeLeaf(document),
        parent: caller.parentNode,
      });
      if (throwAfterBlur) throw new Error('native insertion failed');
    }
    return original.call(this, node, before) as T;
  });
  return {
    events,
    dispose: () => input.removeEventListener('focusout', onOut),
  };
}
function expectObservedChromeOrder(
  trace: ReturnType<typeof modelChromeBeforeRemoval>,
  originalParent: Node,
  input: HTMLInputElement
) {
  expect(trace.events.slice(0, 3)).toEqual([
    {
      kind: 'before-removal',
      connected: true,
      active: input,
      parent: originalParent,
    },
    {
      kind: 'focusout',
      connected: true,
      active: document.body,
      parent: originalParent,
      related: null,
    },
    {
      kind: 'after-blur-before-removal',
      connected: true,
      active: document.body,
      parent: originalParent,
    },
  ]);
}

for (const shadow of [false, true]) {
  it(`retains focus for certified staging with observed Chrome connected-focusout order (shadow=${shadow})`, async () => {
    const { outer, caller, input } = fixture(shadow);
    const trace = modelChromeBeforeRemoval(input, caller);
    await loadRuntime();
    commitChildren(outer, tree, { slotPool: [caller] });
    expectObservedChromeOrder(trace, outer, input);
    expect(caller.parentElement?.tagName).toBe('SECTION');
    expect(input.value).toBe('preserve selection');
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
      2,
      8,
      'backward',
    ]);
    expect(activeLeaf(document)).toBe(input);
    trace.dispose();
  });
}

it('does not treat generic move callbacks or ordinary author blur as certified removal', async () => {
  const { outer, caller, input, elsewhere } = fixture();
  await loadRuntime();
  withWebComponentOwnedRelocation([caller], elsewhere, () => {
    input.blur();
    elsewhere.append(caller);
  });
  expect(document.activeElement).not.toBe(input);
  outer.append(caller);
  input.focus();
  const capture = captureWebComponentCallerFocus([caller]);
  input.blur();
  capture.restore(() => true);
  capture.dispose();
  expect(document.activeElement).not.toBe(input);
});

for (const action of [
  'focus-elsewhere',
  'remove',
  'reparent',
  'remove-and-return',
  'reparent-and-return',
  'disable',
  'inert',
] as const) {
  it(`does not restore after author ${action} during the before-removal focusout`, async () => {
    const { outer, caller, input, other, elsewhere } = fixture();
    const trace = modelChromeBeforeRemoval(input, caller);
    await loadRuntime();
    input.addEventListener(
      'focusout',
      () => {
        if (action === 'focus-elsewhere') other.focus();
        if (action === 'remove' || action === 'remove-and-return') input.remove();
        if (action === 'reparent' || action === 'reparent-and-return') elsewhere.append(input);
        if (action === 'remove-and-return' || action === 'reparent-and-return')
          caller.append(input);
        if (action === 'disable') input.disabled = true;
        if (action === 'inert') caller.setAttribute('inert', '');
      },
      { once: true }
    );
    commitChildren(outer, tree, { slotPool: [caller] });
    expect(trace.events.some((event) => event.kind === 'focusout' && event.connected)).toBe(true);
    expect(activeLeaf(document)).not.toBe(input);
    if (action === 'focus-elsewhere') expect(document.activeElement).toBe(other);
    if (action === 'remove') expect(input.parentNode).toBe(null);
    if (action === 'reparent') expect(input.parentNode).toBe(elsewhere);
    trace.dispose();
  });
}

for (const action of ['reparent-and-return', 'remove-and-return'] as const) {
  it(`does not restore after author ancestor ${action} during connected focusout`, async () => {
    const { outer, caller, input, elsewhere } = fixture();
    const originalParent = outer.parentNode;
    const originalNext = outer.nextSibling;
    const trace = modelChromeBeforeRemoval(input, caller);
    await loadRuntime();
    let authorMutation = 0;
    input.addEventListener(
      'focusout',
      () => {
        authorMutation++;
        expect(input.isConnected).toBe(true);
        if (action === 'reparent-and-return') elsewhere.append(outer);
        else outer.remove();
        originalParent!.insertBefore(outer, originalNext);
        expect(outer.parentNode).toBe(originalParent);
        expect(outer.nextSibling).toBe(originalNext);
        expect(input.parentNode).toBe(caller);
        expect(caller.parentNode).toBe(outer);
      },
      { once: true }
    );
    commitChildren(outer, tree, { slotPool: [caller] });
    expect(authorMutation).toBe(1);
    expectObservedChromeOrder(trace, outer, input);
    expect(outer.parentNode).toBe(originalParent);
    expect(outer.nextSibling).toBe(originalNext);
    expect(caller.parentElement?.tagName).toBe('SECTION');
    expect(input.parentNode).toBe(caller);
    expect(activeLeaf(document)).not.toBe(input);
    trace.dispose();
  });
}

for (const action of ['retire', 'replace'] as const) {
  it(`does not restore into an owner ${action}d by a before-removal event handler`, async () => {
    const { outer, caller, input } = fixture();
    const trace = modelChromeBeforeRemoval(input, caller);
    await loadRuntime();
    const proto = definePrototype({
      name: `chrome-order-owner-${++sequence}`,
      setup: () => (r) => r.slot(),
    });
    const owner = createLogicalInstance(proto);
    markProtoInstance(caller, proto, owner);
    const release = registerNativeFocusReadiness(owner, {
      isReady: () => true,
      subscribe: () => () => {},
    });
    input.addEventListener(
      'focusout',
      () => {
        if (action === 'retire') release();
        else markProtoInstance(caller, proto, createLogicalInstance(proto));
      },
      { once: true }
    );
    commitChildren(outer, tree, { slotPool: [caller] });
    expect(trace.events.some((event) => event.kind === 'focusout' && event.connected)).toBe(true);
    expect(activeLeaf(document)).not.toBe(input);
    trace.dispose();
    release();
    unbindProtoInstance(caller);
  });
}

it('closes staging authority when the native insertion throws before moving the root', async () => {
  const { outer, caller, input } = fixture();
  const trace = modelChromeBeforeRemoval(input, caller, true);
  await loadRuntime();
  expect(() => commitChildren(outer, tree, { slotPool: [caller] })).toThrow(
    'native insertion failed'
  );
  expect(caller.parentNode).toBe(outer);
  trace.dispose();
  vi.restoreAllMocks();
  input.focus();
  const capture = captureWebComponentCallerFocus([caller]);
  input.blur();
  capture.restore(() => true);
  capture.dispose();
  expect(activeLeaf(document)).not.toBe(input);
});

it('never replays selection or steals focus from an author handler during focus restoration', async () => {
  const { outer, caller, input, other } = fixture();
  const trace = modelChromeBeforeRemoval(input, caller);
  await loadRuntime();
  let restored = 0;
  input.addEventListener(
    'focus',
    () => {
      restored++;
      input.value = 'author changed value';
      input.setSelectionRange(1, 4, 'forward');
      other.focus();
    },
    { once: true }
  );
  commitChildren(outer, tree, { slotPool: [caller] });
  expect(restored).toBe(1);
  expect(document.activeElement).toBe(other);
  expect(input.value).toBe('author changed value');
  expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
    1,
    4,
    'forward',
  ]);
  trace.dispose();
});

it('does not read a destination insertBefore override inside the certified operation', async () => {
  const { outer, caller, input } = fixture();
  const trace = modelChromeBeforeRemoval(input, caller);
  await loadRuntime();
  let getterCalls = 0;
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (name: string, options?: ElementCreationOptions) => {
      const node = create(name, options);
      if (name === 'section')
        Object.defineProperty(node, 'insertBefore', {
          configurable: true,
          get() {
            getterCalls++;
            input.blur();
            return Node.prototype.insertBefore;
          },
        });
      return node;
    }
  );
  commitChildren(outer, tree, { slotPool: [caller] });
  expect(getterCalls).toBe(0);
  expect(activeLeaf(document)).toBe(input);
  trace.dispose();
});
