import { afterEach, expect, it } from 'vitest';
import { createWebOverlayModal } from '../src/web/modal-lock';

const SCROLLBAR_WIDTH = 15;

function stubScrollbarWidth(width: number): () => void {
  const view = document.defaultView!;
  const root = document.documentElement;
  const innerWidth = Object.getOwnPropertyDescriptor(view, 'innerWidth');
  const clientWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
  Object.defineProperty(view, 'innerWidth', { configurable: true, value: 1000 });
  Object.defineProperty(root, 'clientWidth', { configurable: true, value: 1000 - width });
  return () => {
    if (innerWidth) Object.defineProperty(view, 'innerWidth', innerWidth);
    if (clientWidth) Object.defineProperty(root, 'clientWidth', clientWidth);
  };
}

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
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
