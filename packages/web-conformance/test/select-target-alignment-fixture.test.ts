import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  mountAlignmentProof,
  unmountAlignmentProof,
  readProofFailure,
} from './fixtures/select-target-alignment-native';

afterEach(async () => {
  await unmountAlignmentProof();
  vi.restoreAllMocks();
});
it('connects real prototype parts, applies neutral host facts, releases cold entry and focuses selected content', async () => {
  // These injected host facts test Runtime/ownership sequencing, not native pixel layout.
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      right: left + width,
      top,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON() {},
    }) as DOMRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.classList.contains('proof-trigger')) return box(180, 240, 180, 36);
    if (this.getAttribute('data-demo-ref') === 'value') return box(193, 248, 50, 20);
    if (this.classList.contains('proof-surface')) return box(0, 0, 180, 106);
    if (this.getAttribute('data-demo-ref')?.startsWith('text-')) return box(13, 37, 50, 20);
    return box(0, 0, 180, 32);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.classList.contains('proof-viewport')
      ? 104
      : this.classList.contains('proof-surface')
        ? 106
        : 32;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(104);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(104);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.classList.contains('proof-item')
      ? 4 + Number(this.getAttribute('data-collection-index')) * 32
      : 0;
  });
  await mountAlignmentProof();
  const trigger = document.querySelector<HTMLButtonElement>('[data-demo-ref="trigger"]');
  if (!trigger) throw new Error('Missing real trigger');
  expect(trigger.textContent).toContain('Option 1');
  await act(async () => {
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const frame = document.querySelector<HTMLElement>('[data-demo-ref="frame"]');
  if (!frame) throw new Error('Missing real Content frame');
  expect(frame.style.position).toBe('fixed');
  expect(frame.style.left).toBe('180px');
  expect(frame.getAttribute('data-transition-state')).toBe('entered');
  expect(document.activeElement?.getAttribute('data-demo-ref')).toBe('item-1');
});

it('a missing-geometry cold attempt remains cancellable by its real trigger', async () => {
  await mountAlignmentProof();
  const trigger = document.querySelector<HTMLButtonElement>('[data-demo-ref="trigger"]');
  if (!trigger) throw new Error('Missing trigger');
  await act(async () => {
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const frame = document.querySelector<HTMLElement>('[data-demo-ref="frame"]');
  if (!frame) throw new Error('Missing frame');
  expect(frame.getAttribute('data-transition-state')).toBe('preparing');
  await act(async () => {
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(frame.hasAttribute('data-pui-view-detached')).toBe(true);
});

it.each(['surface', 'item-text'] as const)(
  'settled missing %s terminates the proof instead of retaining hidden preparation',
  async (omitPart) => {
    await mountAlignmentProof({ omitPart });
    const trigger = document.querySelector<HTMLButtonElement>('[data-demo-ref="trigger"]');
    if (!trigger) throw new Error('Missing trigger');
    await act(async () => {
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(readProofFailure()).toBe(
      omitPart === 'surface' ? 'missing-or-ambiguous-parts' : 'missing-text'
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const frame = document.querySelector<HTMLElement>('[data-demo-ref="frame"]');
    expect(frame?.hasAttribute('data-pui-view-detached')).toBe(true);
  }
);
