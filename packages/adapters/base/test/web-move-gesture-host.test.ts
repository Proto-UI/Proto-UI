import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoveGestureCancelReason, MoveGestureSample } from '@proto.ui/core';
import { createWebMoveGestureHost } from '../src';

function pointer(
  type: string,
  init: PointerEventInit & { clientX?: number; clientY?: number } = {}
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    ...init,
  });
}

function installPointerCapture(target: HTMLElement) {
  const captured = new Set<number>();
  const setPointerCapture = vi.fn((pointerId: number) => captured.add(pointerId));
  const releasePointerCapture = vi.fn((pointerId: number) => captured.delete(pointerId));
  Object.assign(target, {
    setPointerCapture,
    releasePointerCapture,
    hasPointerCapture: (pointerId: number) => captured.has(pointerId),
  });
  return { captured, setPointerCapture, releasePointerCapture };
}

afterEach(() => document.body.replaceChildren());

describe('adapter-base: Web Move Gesture host', () => {
  it('owns one primary contact and reports bounded start, move, and end samples', () => {
    const target = document.createElement('div');
    target.style.touchAction = 'pan-y';
    target.style.userSelect = 'text';
    document.body.append(target);
    const capture = installPointerCapture(target);
    const starts: MoveGestureSample[] = [];
    const moves: MoveGestureSample[] = [];
    const ends: MoveGestureSample[] = [];

    const lease = createWebMoveGestureHost().attach({
      target,
      axis: 'vertical',
      activation: 'immediate',
      onStart: (sample) => starts.push(sample),
      onMove: (sample) => moves.push(sample),
      onEnd: (sample) => ends.push(sample),
      onCancel: () => {},
    });

    expect(target.style.touchAction).toBe('none');
    expect(target.style.userSelect).toBe('none');

    target.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 20 }));
    target.dispatchEvent(pointer('pointerdown', { pointerId: 8, clientX: 99, clientY: 99 }));
    target.dispatchEvent(pointer('pointermove', { clientX: 13, clientY: 28 }));
    target.dispatchEvent(pointer('pointerup', { clientX: 14, clientY: 30 }));

    expect(capture.setPointerCapture).toHaveBeenCalledWith(7);
    expect(capture.setPointerCapture).not.toHaveBeenCalledWith(8);
    expect(capture.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(starts).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      input: 'mouse',
      position: { x: 13, y: 28 },
      delta: { x: 3, y: 8 },
      totalDelta: { x: 3, y: 8 },
    });
    expect(ends[0]).toMatchObject({
      position: { x: 14, y: 30 },
      delta: { x: 1, y: 2 },
      totalDelta: { x: 4, y: 10 },
    });

    lease.dispose();
    expect(target.style.touchAction).toBe('pan-y');
    expect(target.style.userSelect).toBe('text');
  });

  it('cancels active ownership on replacement, host cancellation, detach, and disposal', async () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    installPointerCapture(first);
    installPointerCapture(second);
    const reasons: MoveGestureCancelReason[] = [];
    const binding = (target: HTMLElement) => ({
      target,
      axis: 'both' as const,
      activation: 'immediate' as const,
      onStart: () => {},
      onMove: () => {},
      onEnd: () => {},
      onCancel: (reason: MoveGestureCancelReason) => reasons.push(reason),
    });

    const lease = createWebMoveGestureHost().attach(binding(first));
    first.dispatchEvent(pointer('pointerdown'));
    lease.update(binding(second));
    expect(reasons).toEqual(['target-replaced']);
    expect(first.style.touchAction).toBe('');
    expect(second.style.touchAction).toBe('none');

    second.dispatchEvent(pointer('pointerdown'));
    second.dispatchEvent(pointer('pointercancel'));
    expect(reasons).toEqual(['target-replaced', 'host-cancel']);

    second.dispatchEvent(pointer('pointerdown'));
    second.dispatchEvent(pointer('lostpointercapture'));
    expect(reasons).toEqual(['target-replaced', 'host-cancel', 'lost-ownership']);

    second.dispatchEvent(pointer('pointerdown'));
    second.remove();
    second.dispatchEvent(pointer('pointerup'));
    expect(reasons).toEqual([
      'target-replaced',
      'host-cancel',
      'lost-ownership',
      'target-detached',
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reasons).toEqual([
      'target-replaced',
      'host-cancel',
      'lost-ownership',
      'target-detached',
    ]);

    document.body.append(second);
    second.dispatchEvent(pointer('pointerdown'));
    lease.dispose();
    expect(reasons).toEqual([
      'target-replaced',
      'host-cancel',
      'lost-ownership',
      'target-detached',
      'disposed',
    ]);
    expect(second.style.touchAction).toBe('');
  });

  it('rejects non-primary contacts before acquiring ownership', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const capture = installPointerCapture(target);
    const onStart = vi.fn();
    const lease = createWebMoveGestureHost().attach({
      target,
      axis: 'horizontal',
      activation: 'immediate',
      onStart,
      onMove: () => {},
      onEnd: () => {},
      onCancel: () => {},
    });

    target.dispatchEvent(pointer('pointerdown', { button: 1 }));
    target.dispatchEvent(pointer('pointerdown', { isPrimary: false }));

    expect(onStart).not.toHaveBeenCalled();
    expect(capture.setPointerCapture).not.toHaveBeenCalled();
    lease.dispose();
  });
});
