import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContextMenuInputIntent } from '@proto.ui/core';
import { createWebContextMenuInputHost } from '../src';
import { resolveWebInputOriginAnchor } from '../src/web/input-origin-anchor';

const leases: { dispose(): void }[] = [];
function fixture(onIntent?: (intent: ContextMenuInputIntent) => boolean, onCancel?: () => void) {
  const target = document.createElement('button');
  document.body.append(target);
  const intents: ContextMenuInputIntent[] = [];
  const tasks: { callback(): void; cancelled: boolean }[] = [];
  const lease = createWebContextMenuInputHost().attach({
    target,
    disabled: false,
    onIntent(intent) {
      intents.push(intent);
      return onIntent?.(intent) ?? true;
    },
    scheduleDelay(_ms, callback) {
      const task = { callback, cancelled: false };
      tasks.push(task);
      return {
        cancel() {
          task.cancelled = true;
          onCancel?.();
        },
      };
    },
  });
  leases.push(lease);
  return {
    target,
    intents,
    lease,
    tasks,
    fire: () =>
      tasks
        .filter((task) => !task.cancelled)
        .at(-1)
        ?.callback(),
  };
}
function pointer(target: EventTarget, type: string, init: Partial<PointerEventInit> = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 30,
    clientY: 45,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}
function context(target: EventTarget, init: MouseEventInit = {}) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 140,
    clientY: 170,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}
function click(target: EventTarget, detail = 1) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail });
  target.dispatchEvent(event);
  return event;
}
afterEach(() => {
  vi.restoreAllMocks();
  leases.splice(0).forEach((lease) => lease.dispose());
  document.body.replaceChildren();
});

describe('host-local ContextMenu input', () => {
  it('keeps right-click point geometry behind an opaque token, including viewport zero', () => {
    const f = fixture();
    expect(context(f.target).defaultPrevented).toBe(true);
    expect(f.intents[0].origin).toBe('pointer');
    expect(Object.keys(f.intents[0])).toEqual(['origin', 'anchor']);
    expect(Object.keys(f.intents[0].anchor)).toEqual([]);
    expect(Object.isFrozen(f.intents[0].anchor)).toBe(true);
    expect(
      resolveWebInputOriginAnchor(f.intents[0].anchor)?.reference.getBoundingClientRect()
    ).toMatchObject({ x: 140, y: 170, width: 0, height: 0 });
    context(f.target, { clientX: 0, clientY: 0 });
    expect(f.intents[1].origin).toBe('pointer');
    expect(resolveWebInputOriginAnchor(f.intents[0].anchor)).toBeNull();
  });
  it.each([{ key: 'ContextMenu' }, { key: 'F10', shiftKey: true }])(
    'keyboard $key uses element and deduplicates native contextmenu',
    (init) => {
      const f = fixture();
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      f.target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(f.intents[0].origin).toBe('keyboard');
      expect(resolveWebInputOriginAnchor(f.intents[0].anchor)?.reference).toBe(f.target);
      expect(context(f.target, { button: 0, clientX: 0, clientY: 0 }).defaultPrevented).toBe(true);
      expect(f.intents).toHaveLength(1);
      expect(click(f.target).defaultPrevented).toBe(false);
    }
  );
  it('recognizes long-press, suppresses one compatibility click and menu, preserves later contact', () => {
    const f = fixture();
    expect(pointer(f.target, 'pointerdown').defaultPrevented).toBe(false);
    f.fire();
    expect(f.intents[0].origin).toBe('long-press');
    expect(f.tasks).toHaveLength(1); // no timeout while the finger is still held
    expect(
      resolveWebInputOriginAnchor(f.intents[0].anchor)?.reference.getBoundingClientRect()
    ).toMatchObject({ x: 30, y: 45 });
    expect(context(f.target).defaultPrevented).toBe(true);
    pointer(document, 'pointerup');
    expect(click(f.target, 0).defaultPrevented).toBe(false); // accessibility activation
    expect(click(f.target).defaultPrevented).toBe(true);
    expect(click(f.target).defaultPrevented).toBe(false);
    expect(f.intents).toHaveLength(1);
    pointer(f.target, 'pointerdown', { pointerType: 'mouse' });
    expect(click(f.target).defaultPrevented).toBe(false);
  });
  it.each([
    'pointerup',
    'pointercancel',
    'pointermove',
    'second-contact',
    'disabled',
    'dispose',
    'scroll',
    'blur',
  ])('cancels pending long-press on %s, including late timer callbacks', (reason) => {
    const f = fixture();
    pointer(f.target, 'pointerdown');
    const late = f.tasks[0].callback;
    if (reason === 'second-contact')
      pointer(document, 'pointerdown', { pointerId: 2, isPrimary: false });
    else if (reason === 'disabled') f.lease.update({ disabled: true });
    else if (reason === 'dispose') f.lease.dispose();
    else if (reason === 'scroll') document.dispatchEvent(new Event('scroll'));
    else if (reason === 'blur') window.dispatchEvent(new Event('blur'));
    else pointer(document, reason, { clientX: 100 });
    expect(f.tasks[0].cancelled).toBe(true);
    late();
    expect(f.intents).toHaveLength(0);
    expect(click(f.target).defaultPrevented).toBe(false);
  });
  it('detachment invalidates pending work and every issued anchor', async () => {
    const f = fixture();
    context(f.target);
    const anchor = f.intents[0].anchor;
    const invalidated = vi.fn();
    resolveWebInputOriginAnchor(anchor)?.subscribeInvalidation(invalidated);
    pointer(f.target, 'pointerdown');
    f.target.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolveWebInputOriginAnchor(anchor)).toBeNull();
    expect(invalidated).toHaveBeenCalledOnce();
    f.tasks[0].callback();
    expect(f.intents).toHaveLength(1);
  });
  it('does not hijack normal click, rejected intent, repeat, disabled input or a later real click', () => {
    const f = fixture(() => false);
    expect(context(f.target).defaultPrevented).toBe(false);
    expect(resolveWebInputOriginAnchor(f.intents[0].anchor)).toBeNull();
    pointer(f.target, 'pointerdown');
    pointer(document, 'pointerup');
    expect(click(f.target).defaultPrevented).toBe(false);
    f.target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', repeat: true }));
    f.lease.update({ disabled: true });
    context(f.target);
    expect(f.intents).toHaveLength(1);
  });
  it('revokes anchors when disabled and does not revive disposed input', () => {
    const f = fixture();
    context(f.target);
    f.lease.update({ disabled: true });
    expect(resolveWebInputOriginAnchor(f.intents[0].anchor)).toBeNull();
    f.lease.update({ disabled: false });
    context(f.target);
    f.lease.dispose();
    f.lease.update({ disabled: false });
    context(f.target);
    expect(f.intents).toHaveLength(2);
    expect(resolveWebInputOriginAnchor(f.intents[1].anchor)).toBeNull();
  });
  it('keeps nested input ownership with the nearest trigger and cancels on a second contact', () => {
    const outer = fixture();
    const inner = fixture();
    outer.target.append(inner.target);
    context(inner.target);
    expect(inner.intents).toHaveLength(1);
    expect(outer.intents).toHaveLength(0);
    pointer(inner.target, 'pointerdown');
    pointer(inner.target, 'pointerdown', { pointerId: 2 });
    inner.tasks.forEach((task) => task.callback());
    outer.tasks.forEach((task) => task.callback());
    expect(inner.intents).toHaveLength(1);
    expect(outer.intents).toHaveLength(0);
  });
  it('reentrant disposal in a callback revokes its token and leaves no suppression', () => {
    let f: ReturnType<typeof fixture>;
    f = fixture(() => {
      f.lease.dispose();
      return true;
    });
    expect(context(f.target).defaultPrevented).toBe(false);
    expect(resolveWebInputOriginAnchor(f.intents[0].anchor)).toBeNull();
    expect(click(f.target).defaultPrevented).toBe(false);
  });
});

it('a rejected replacement intent preserves the last accepted anchor', () => {
  let accept = true;
  const f = fixture(() => accept);
  context(f.target);
  const accepted = f.intents[0].anchor;
  accept = false;
  context(f.target);
  expect(resolveWebInputOriginAnchor(accepted)).not.toBeNull();
  expect(resolveWebInputOriginAnchor(f.intents[1].anchor)).toBeNull();
});

function adoptIntoFrame(target: HTMLElement) {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const doc = frame.contentDocument!;
  // HappyDOM 15 adoptNode installs a non-configurable own ownerDocument,
  // unlike the browser getter; keep it configurable for repeat-adoption coverage.
  if (!Object.hasOwn(target, 'ownerDocument'))
    Object.defineProperty(target, 'ownerDocument', {
      value: target.ownerDocument,
      configurable: true,
    });
  doc.body.append(doc.adoptNode(target));
  return { doc, win: frame.contentWindow! };
}
describe('same-target document ownership', () => {
  it.each([
    'pointerup',
    'pointercancel',
    'pointermove',
    'second-contact',
    'scroll',
    'blur',
    'hidden',
  ])('rebinds cancellation to the adopted document on %s', (reason) => {
    const f = fixture();
    const next = adoptIntoFrame(f.target);
    f.lease.update({ disabled: false });
    pointer(f.target, 'pointerdown');
    const task = f.tasks.at(-1)!;
    if (reason === 'second-contact') pointer(next.doc, 'pointerdown', { pointerId: 2 });
    else if (reason === 'scroll') next.doc.dispatchEvent(new Event('scroll'));
    else if (reason === 'blur') next.win.dispatchEvent(new Event('blur'));
    else if (reason === 'hidden') {
      Object.defineProperty(next.doc, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      next.doc.dispatchEvent(new Event('visibilitychange'));
    } else pointer(next.doc, reason, { clientX: 100 });
    expect(task.cancelled).toBe(true);
    task.callback();
    expect(f.intents).toHaveLength(0);
  });
  it('revokes old work and anchors while preserving same-document updates', () => {
    const f = fixture();
    context(f.target);
    const old = f.intents[0].anchor;
    const revoked = vi.fn();
    resolveWebInputOriginAnchor(old)!.subscribeInvalidation(revoked);
    pointer(f.target, 'pointerdown');
    const task = f.tasks.at(-1)!;
    f.lease.update({ disabled: false });
    expect(task.cancelled).toBe(false);
    expect(resolveWebInputOriginAnchor(old)).not.toBeNull();
    adoptIntoFrame(f.target);
    f.lease.update({ disabled: false });
    expect(task.cancelled).toBe(true);
    expect(resolveWebInputOriginAnchor(old)).toBeNull();
    expect(revoked).toHaveBeenCalledOnce();
    task.callback();
    expect(f.intents).toHaveLength(1);
  });
  it('removes old listeners over repeated adoption and cleans the final document on dispose', () => {
    const f = fixture();
    const first = adoptIntoFrame(f.target);
    f.lease.update({ disabled: false });
    const second = adoptIntoFrame(f.target);
    f.lease.update({ disabled: false });
    pointer(f.target, 'pointerdown');
    const task = f.tasks.at(-1)!;
    document.dispatchEvent(new Event('scroll'));
    first.doc.dispatchEvent(new Event('scroll'));
    first.win.dispatchEvent(new Event('blur'));
    expect(task.cancelled).toBe(false);
    const removed = vi.spyOn(second.doc, 'removeEventListener');
    const removedWindow = vi.spyOn(second.win, 'removeEventListener');
    f.lease.dispose();
    expect(task.cancelled).toBe(true);
    expect(removed.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointercancel',
        'scroll',
        'visibilitychange',
      ])
    );
    expect(removedWindow).toHaveBeenCalledWith('blur', expect.any(Function));
    f.lease.update({ disabled: false });
    context(f.target);
    task.callback();
    expect(f.intents).toHaveLength(0);
  });
  it('rechecks adoption at target input even before a module refresh', () => {
    const f = fixture();
    context(f.target);
    const old = f.intents[0].anchor;
    const next = adoptIntoFrame(f.target);
    pointer(f.target, 'pointerdown');
    pointer(next.doc, 'pointerup');
    expect(f.tasks.at(-1)!.cancelled).toBe(true);
    expect(resolveWebInputOriginAnchor(old)).toBeNull();
  });
});

it('adoption cancels late hold callbacks before any observer or explicit update', () => {
  const f = fixture();
  pointer(f.target, 'pointerdown');
  const task = f.tasks[0];
  adoptIntoFrame(f.target);
  task.callback();
  expect(task.cancelled).toBe(true);
  expect(f.intents).toHaveLength(0);
});
it('adoption invalidates accepted suppression and observes detachment in the new document', async () => {
  const f = fixture();
  pointer(f.target, 'pointerdown');
  f.fire();
  const old = f.intents[0].anchor;
  const next = adoptIntoFrame(f.target);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(resolveWebInputOriginAnchor(old)).toBeNull();
  expect(click(f.target).defaultPrevented).toBe(false);
  context(f.target);
  const current = f.intents.at(-1)!.anchor;
  f.target.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(resolveWebInputOriginAnchor(current)).toBeNull();
  expect(next.doc.body.children).toHaveLength(0);
});

it('preserves observation acquired by reentrant anchor invalidation during adoption', async () => {
  const f = fixture();
  context(f.target);
  const invalidated = vi.fn();
  resolveWebInputOriginAnchor(f.intents[0].anchor)!.subscribeInvalidation(() => {
    context(f.target);
    resolveWebInputOriginAnchor(f.intents.at(-1)!.anchor)?.subscribeInvalidation(invalidated);
  });
  adoptIntoFrame(f.target);
  f.lease.update({ disabled: false });
  expect(f.intents).toHaveLength(2);
  f.target.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(invalidated).toHaveBeenCalledOnce();
});
it('applies disabled state before adoption invalidation can reenter input', () => {
  const f = fixture();
  context(f.target);
  resolveWebInputOriginAnchor(f.intents[0].anchor)!.subscribeInvalidation(() => context(f.target));
  adoptIntoFrame(f.target);
  f.lease.update({ disabled: true });
  expect(f.intents).toHaveLength(1);
});

it('retains fresh pending observation acquired during old task cancellation on adoption', async () => {
  let reentered = false;
  const f = fixture(undefined, () => {
    if (reentered) return;
    reentered = true;
    pointer(f.target, 'pointerdown');
  });
  pointer(f.target, 'pointerdown');
  adoptIntoFrame(f.target);
  f.lease.update({ disabled: false });
  expect(f.tasks).toHaveLength(2);
  expect(f.tasks[0].cancelled).toBe(true);
  expect(f.tasks[1].cancelled).toBe(false);
  f.target.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.tasks[1].cancelled).toBe(true);
});
it('disposal rejects pending-cancellation and anchor-invalidation reentry', () => {
  const f = fixture(undefined, () => pointer(f.target, 'pointerdown'));
  context(f.target);
  resolveWebInputOriginAnchor(f.intents[0].anchor)!.subscribeInvalidation(() => context(f.target));
  pointer(f.target, 'pointerdown');
  f.lease.dispose();
  expect(f.tasks).toHaveLength(1);
  expect(f.tasks[0].cancelled).toBe(true);
  expect(f.intents).toHaveLength(1);
});
it('observes new-document release during reentrant old-task cancellation', () => {
  let reentered = false;
  const f = fixture(undefined, () => {
    if (reentered) return;
    reentered = true;
    pointer(f.target, 'pointerdown');
    pointer(f.target.ownerDocument, 'pointerup');
  });
  pointer(f.target, 'pointerdown');
  adoptIntoFrame(f.target);
  f.lease.update({ disabled: false });
  expect(f.tasks).toHaveLength(2);
  expect(f.tasks[1].cancelled).toBe(true);
  f.tasks[1].callback();
  expect(f.intents).toHaveLength(0);
});

it.each([undefined, null, false, 0, ''])(
  'dispose removes listeners despite first falsy cancel failure %s',
  (failure) => {
    const f = fixture(undefined, () => {
      throw failure;
    });
    context(f.target);
    resolveWebInputOriginAnchor(f.intents[0].anchor)!.subscribeInvalidation(() => {
      throw new Error('later failure');
    });
    pointer(f.target, 'pointerdown');
    const targetRemove = vi.spyOn(f.target, 'removeEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    let caught = false,
      actual: unknown;
    try {
      f.lease.dispose();
    } catch (error) {
      caught = true;
      actual = error;
    }
    expect(caught).toBe(true);
    expect(actual).toBe(failure);
    expect(targetRemove).toHaveBeenCalledTimes(4);
    expect(documentRemove).toHaveBeenCalledTimes(6);
    expect(windowRemove).toHaveBeenCalledTimes(1);
    expect(() => f.lease.dispose()).not.toThrow();
    expect(targetRemove).toHaveBeenCalledTimes(4);
    vi.restoreAllMocks();
  }
);
it('dispose attempts anchor retirement after observer and timer cleanup throw', () => {
  const first = { cause: 'observer' },
    later = { cause: 'timer' };
  const f = fixture(undefined, () => {
    throw later;
  });
  context(f.target);
  const reference = resolveWebInputOriginAnchor(f.intents[0].anchor)!;
  const invalidated = vi.fn();
  reference.subscribeInvalidation(invalidated);
  pointer(f.target, 'pointerdown');
  vi.spyOn(MutationObserver.prototype, 'disconnect').mockImplementation(() => {
    throw first;
  });
  let actual: unknown;
  try {
    f.lease.dispose();
  } catch (error) {
    actual = error;
  }
  expect(actual).toBe(first);
  expect(f.tasks[0].cancelled).toBe(true);
  expect(invalidated).toHaveBeenCalledOnce();
  expect(resolveWebInputOriginAnchor(f.intents[0].anchor)).toBeNull();
  vi.restoreAllMocks();
});

it('disabled reset retires an anchor despite suppression cancellation failure and permits later reuse', () => {
  const failure = { cause: 'suppression cancellation' };
  const f = fixture(undefined, () => {
    throw failure;
  });
  f.target.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })
  );
  const original = f.intents[0].anchor;
  const invalidated = vi.fn();
  resolveWebInputOriginAnchor(original)!.subscribeInvalidation(invalidated);
  let actual: unknown;
  try {
    f.lease.update({ disabled: true });
  } catch (error) {
    actual = error;
  }
  expect(actual).toBe(failure);
  expect(f.tasks[0].cancelled).toBe(true);
  expect(invalidated).toHaveBeenCalledOnce();
  expect(resolveWebInputOriginAnchor(original)).toBeNull();
  f.lease.update({ disabled: false });
  context(f.target);
  expect(f.intents).toHaveLength(2);
  expect(resolveWebInputOriginAnchor(f.intents[1].anchor)).not.toBeNull();
});
