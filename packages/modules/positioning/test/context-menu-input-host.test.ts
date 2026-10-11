import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContextMenuInputIntent } from '@proto.ui/core';
import { createWebContextMenuInputHost } from '../src';
import { resolveWebInputOriginAnchor } from '../src/web/input-origin-anchor';

const leases: { dispose(): void }[] = [];
function fixture(onIntent?: (intent: ContextMenuInputIntent) => boolean) {
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
