// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPointerSampleField } from '../src/events/pointer-sample';
import { createWebProtoEventRouter } from '../src/events/web-event-router';
import { createWebMoveGestureHost } from '../src/gestures/web-move-gesture-host';
import {
  beginDirectionalClickContact,
  observeDirectionalPointerUp,
  suppressDirectionalClick,
} from '../src/gestures/web-move-click-arbitration';
import type { MoveGestureSample } from '@proto.ui/core';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release();
  vi.clearAllTimers();
  vi.useRealTimers();
});
function target() {
  const node = document.createElement('button');
  document.body.append(node);
  cleanup.push(() => node.remove());
  return node;
}
function pointer(type: string, init: PointerEventInit = {}) {
  return new PointerEvent(type, {
    pointerId: 41,
    pointerType: 'mouse',
    button: 0,
    buttons: 0,
    isPrimary: true,
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    ...init,
  });
}
function unreadableType(event: PointerEvent) {
  Object.defineProperty(event, 'pointerType', {
    get: () => {
      throw new Error('unreadable kind');
    },
  });
  return event;
}

describe('private pointer reads preserve facts and existing gesture ownership', () => {
  for (const field of ['pointerType', 'buttons'] as const) {
    it(`${field}: distinguishes readable missing data from a failed read, once per extraction`, () => {
      expect(readPointerSampleField({}, field)).toEqual({ readable: true, value: undefined });
      const readUndefined = vi.fn(() => undefined);
      const readable = Object.defineProperty({}, field, { get: readUndefined });
      expect(readPointerSampleField(readable, field)).toEqual({ readable: true, value: undefined });
      expect(readUndefined).toHaveBeenCalledTimes(1);
      const readFailure = vi.fn(() => {
        throw new Error('unavailable');
      });
      const unreadable = Object.defineProperty({}, field, { get: readFailure });
      expect(readPointerSampleField(unreadable, field)).toEqual({
        readable: false,
        value: undefined,
      });
      expect(readFailure).toHaveBeenCalledTimes(1);
    });
  }

  it('does not acquire a directional click claim from an unreadable kind', () => {
    vi.useFakeTimers();
    const node = target();
    expect(() =>
      beginDirectionalClickContact(node, unreadableType(pointer('pointerdown')))
    ).not.toThrow();
    observeDirectionalPointerUp(node, pointer('pointerup'));
    expect(suppressDirectionalClick(node, pointer('click', { detail: 1 }))).toBe(false);
  });
  it('does not consume a click whose kind read failed, preserving an unconsumed valid claim', () => {
    vi.useFakeTimers();
    const node = target();
    beginDirectionalClickContact(node, pointer('pointerdown'));
    observeDirectionalPointerUp(node, pointer('pointerup'));
    const unreadable = unreadableType(pointer('click', { detail: 1 }));
    expect(() => suppressDirectionalClick(node, unreadable)).not.toThrow();
    expect(suppressDirectionalClick(node, unreadable)).toBe(false);
    expect(suppressDirectionalClick(node, pointer('click', { detail: 1 }))).toBe(true);
  });
  it('retains the existing readable missing-kind click fallback instead of treating it as a failed read', () => {
    vi.useFakeTimers();
    const node = target();
    beginDirectionalClickContact(node, pointer('pointerdown'));
    observeDirectionalPointerUp(node, pointer('pointerup'));
    const click = pointer('click', { detail: 1 });
    Object.defineProperty(click, 'pointerType', { value: undefined });
    expect(suppressDirectionalClick(node, click)).toBe(true);
  });

  for (const activation of ['immediate', 'directional'] as const) {
    for (const scope of ['root', 'global'] as const) {
      it(`${activation}/${scope}: unreadable down declines new gesture ownership but delivers unknown author facts`, () => {
        const node = target();
        const router = createWebProtoEventRouter({
          rootEl: node,
          globalEl: window,
          isEnabled: () => true,
        });
        cleanup.push(() => router.dispose());
        const received: unknown[] = [];
        (scope === 'root' ? router.rootTarget : router.globalTarget).addEventListener(
          'pointer.down',
          (event) => received.push((event as CustomEvent<unknown>).detail)
        );
        const shouldStart = vi.fn(() => true);
        const onStart = vi.fn();
        const onEnd = vi.fn();
        const onCancel = vi.fn();
        const lease = createWebMoveGestureHost().attach({
          target: node,
          axis: 'horizontal',
          activation,
          shouldStart,
          onStart,
          onMove: () => {},
          onEnd,
          onCancel,
        });
        cleanup.push(() => lease.dispose());
        const event = unreadableType(pointer('pointerdown'));
        expect(() => node.dispatchEvent(event)).not.toThrow();
        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({
          type: 'pointer.down',
          pointerType: 'unknown',
          pointerButtons: 'none',
        });
        expect(shouldStart).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
        expect(onEnd).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
      });
    }
    it(`${activation}: a previously accepted session keeps its input without adding a terminal kind read`, () => {
      const node = target();
      const starts: MoveGestureSample[] = [];
      const ends: MoveGestureSample[] = [];
      const cancel = vi.fn();
      const lease = createWebMoveGestureHost().attach({
        target: node,
        axis: 'horizontal',
        activation,
        onStart: (sample) => starts.push(sample),
        onMove: () => {},
        onEnd: (sample) => ends.push(sample),
        onCancel: cancel,
      });
      cleanup.push(() => lease.dispose());
      node.dispatchEvent(pointer('pointerdown'));
      node.dispatchEvent(pointer('pointermove', { clientX: 8 }));
      const read = vi.fn(() => {
        throw new Error('terminal kind is not an existing gesture reader');
      });
      const up = pointer('pointerup', { clientX: 10 });
      Object.defineProperty(up, 'pointerType', { get: read });
      expect(() => node.dispatchEvent(up)).not.toThrow();
      expect(starts).toHaveLength(1);
      expect(ends).toHaveLength(1);
      expect(ends[0].input).toBe('mouse');
      expect(cancel).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    });
  }
});
