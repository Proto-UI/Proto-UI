import { afterEach, expect, it } from 'vitest';
import { createWebOverlayModal } from '../src/web/modal-lock';

const SCROLLBAR_WIDTH = 15;

function stubScrollbarWidth(width: number, removed = true, left = false): () => void {
  const view = document.defaultView!;
  const root = document.documentElement;
  const innerWidth = Object.getOwnPropertyDescriptor(view, 'innerWidth');
  const clientWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
  const clientLeft = Object.getOwnPropertyDescriptor(root, 'clientLeft');
  Object.defineProperty(view, 'innerWidth', { configurable: true, value: 1000 });
  const hidden = () => removed && document.body.style.overflow === 'hidden';
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    get: () => (hidden() ? 1000 : 1000 - width),
  });
  Object.defineProperty(root, 'clientLeft', {
    configurable: true,
    get: () => (left && !hidden() ? width : 0),
  });
  return () => {
    if (innerWidth) Object.defineProperty(view, 'innerWidth', innerWidth);
    if (clientWidth) Object.defineProperty(root, 'clientWidth', clientWidth);
    else Reflect.deleteProperty(root, 'clientWidth');
    if (clientLeft) Object.defineProperty(root, 'clientLeft', clientLeft);
    else Reflect.deleteProperty(root, 'clientLeft');
  };
}

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  document.body.style.removeProperty('padding-left');
});

it('hides body overflow and compensates the removed scrollbar with padding-right', () => {
  restore = stubScrollbarWidth(SCROLLBAR_WIDTH);
  const modal = createWebOverlayModal(document);
  modal.lock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('hidden');
  expect(document.body.style.getPropertyValue('padding-right')).toBe(`${SCROLLBAR_WIDTH}px`);
  modal.unlock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('');
  expect(document.body.style.getPropertyValue('padding-right')).toBe('');
});

it('adds the scrollbar width on top of an existing body padding-right', () => {
  restore = stubScrollbarWidth(SCROLLBAR_WIDTH);
  document.body.style.setProperty('padding-right', '10px');
  const modal = createWebOverlayModal(document);
  modal.lock();
  expect(document.body.style.getPropertyValue('padding-right')).toBe(`${10 + SCROLLBAR_WIDTH}px`);
  modal.unlock();
  expect(document.body.style.getPropertyValue('padding-right')).toBe('10px');
});

it('does not touch padding-right when no scrollbar disappears', () => {
  restore = stubScrollbarWidth(0);
  const modal = createWebOverlayModal(document);
  modal.lock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('hidden');
  expect(document.body.style.getPropertyValue('padding-right')).toBe('');
  modal.unlock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('');
});

it('keeps the lock until the last owner unlocks', () => {
  restore = stubScrollbarWidth(SCROLLBAR_WIDTH);
  const a = createWebOverlayModal(document);
  const b = createWebOverlayModal(document);
  a.lock();
  b.lock();
  a.unlock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('hidden');
  expect(document.body.style.getPropertyValue('padding-right')).toBe(`${SCROLLBAR_WIDTH}px`);
  b.unlock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('');
  expect(document.body.style.getPropertyValue('padding-right')).toBe('');
});

it('restores a pre-existing inline overflow value and priority', () => {
  restore = stubScrollbarWidth(0);
  document.body.style.setProperty('overflow', 'auto', 'important');
  const modal = createWebOverlayModal(document);
  modal.lock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('hidden');
  modal.unlock();
  expect(document.body.style.getPropertyValue('overflow')).toBe('auto');
  expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
});

it('does not double-compensate a root scrollbar or stable gutter that survives body locking', () => {
  restore = stubScrollbarWidth(15, false);
  document.body.style.setProperty('padding-right', '10px', 'important');
  const modal = createWebOverlayModal(document);
  modal.lock();
  expect(document.documentElement.clientWidth).toBe(985);
  expect(document.body.style.getPropertyValue('padding-right')).toBe('10px');
  expect(document.body.style.getPropertyPriority('padding-right')).toBe('important');
  modal.unlock();
  expect(document.body.style.getPropertyValue('padding-right')).toBe('10px');
});
it('compensates an actually removed left scrollbar on the left and preserves both original paddings', () => {
  restore = stubScrollbarWidth(15, true, true);
  document.body.style.setProperty('padding-left', '7px', 'important');
  document.body.style.setProperty('padding-right', '11px');
  const a = createWebOverlayModal(document),
    b = createWebOverlayModal(document);
  a.lock();
  b.lock();
  expect(document.body.style.getPropertyValue('padding-left')).toBe('22px');
  expect(document.body.style.getPropertyPriority('padding-left')).toBe('important');
  expect(document.body.style.getPropertyValue('padding-right')).toBe('11px');
  a.unlock();
  expect(document.body.style.getPropertyValue('padding-left')).toBe('22px');
  b.unlock();
  expect(document.body.style.getPropertyValue('padding-left')).toBe('7px');
  expect(document.body.style.getPropertyPriority('padding-left')).toBe('important');
  expect(document.body.style.getPropertyValue('padding-right')).toBe('11px');
});
