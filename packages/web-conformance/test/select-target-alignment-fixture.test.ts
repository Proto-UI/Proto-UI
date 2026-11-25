import { act } from 'react';
import { afterEach, expect, it, vi, onTestFinished } from 'vitest';
import {
  mountAlignmentProof,
  unmountAlignmentProof,
  readProofFailure,
} from './fixtures/select-target-alignment-native';

afterEach(async () => {
  try {
    await unmountAlignmentProof();
  } finally {
    vi.restoreAllMocks();
  }
});

async function clickTrigger(trigger: HTMLButtonElement) {
  await act(async () => trigger.click());
}

async function waitForCommittedProof(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {});
    assertion();
  });
}

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
    if (this === document.documentElement) return box(0, 0, window.innerWidth, window.innerHeight);
    if (this.classList.contains('proof-trigger')) return box(180, 240, 180, 36);
    if (this.getAttribute('data-demo-ref') === 'value') return box(193, 248, 50, 20);
    if (this.classList.contains('proof-surface')) return box(0, 0, 180, 106);
    if (this.getAttribute('data-demo-ref')?.startsWith('text-')) return box(13, 37, 50, 20);
    return box(0, 0, 180, 32);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.getAttribute('data-demo-ref')?.startsWith('text-') ? 13 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.classList.contains('proof-surface'))
      return Number.parseFloat(this.parentElement?.style.minWidth ?? '') || 180;
    if (this.classList.contains('proof-viewport')) return this.parentElement!.offsetWidth - 2;
    if (this.classList.contains('proof-item')) return Number.parseFloat(this.style.width) || 180;
    return this.getAttribute('data-demo-ref')?.startsWith('text-') ? 50 : 180;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.classList.contains('proof-trigger')) return 36;
    if (this.classList.contains('proof-item')) return Number.parseFloat(this.style.height) || 32;
    return this.classList.contains('proof-viewport')
      ? 104
      : this.classList.contains('proof-surface')
        ? 106
        : 32;
  });
  // Root geometry describes the page viewport, not the popup's scrollport.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this === document.documentElement) return window.innerWidth;
    return this.offsetWidth - (this.classList.contains('proof-surface') ? 2 : 0);
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.clientWidth;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this === document.documentElement) return window.innerHeight;
    return this.classList.contains('proof-item') ? this.offsetHeight : 104;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.classList.contains('proof-viewport'))
      return (
        8 + Array.from(this.children).reduce((sum, item) => sum + (item as HTMLElement).offsetHeight, 0)
      );
    return this.clientHeight;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.classList.contains('proof-item')
      ? 4 + Number(this.getAttribute('data-collection-index')) * this.offsetHeight
      : 0;
  });
  // Cold content mounts after activation. Supply the computed zero defaults
  // for newly materialized parts before the first geometry measurement.
  const defaults = document.createElement('style');
  defaults.textContent = `
    .proof-item, .proof-viewport, .proof-surface { margin: 0px; }
    .proof-viewport { border-width: 0px; }
  `;
  document.head.append(defaults);
  onTestFinished(() => defaults.remove());
  await mountAlignmentProof();
  const trigger = document.querySelector<HTMLButtonElement>('[data-demo-ref="trigger"]');
  if (!trigger) throw new Error('Missing real trigger');
  expect(trigger.textContent).toContain('Option 1');
  await clickTrigger(trigger);
  await waitForCommittedProof(() => {
    expect(readProofFailure()).toBeNull();
    const frame = document.querySelector<HTMLElement>('[data-demo-ref="frame"]');
    if (!frame) throw new Error('Missing real Content frame');
    expect(frame.style.position).toBe('fixed');
    expect(frame.style.left).toBe('180px');
    expect(['entering', 'entered']).toContain(frame.getAttribute('data-transition-state'));
    expect(frame.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(document.activeElement?.getAttribute('data-demo-ref')).toBe('item-1');
  });
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
    await clickTrigger(trigger);
    await waitForCommittedProof(() => {
      expect(readProofFailure()).toBe(
        omitPart === 'surface'
          ? 'select.structure.missing-or-ambiguous-parts'
          : 'select.structure.missing-or-ambiguous-item-text'
      );
      // Presentation abort leaves the committed Root fact intact.
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const frame = document.querySelector<HTMLElement>('[data-demo-ref="frame"]');
      expect(frame?.hasAttribute('data-pui-view-detached')).toBe(true);
    });
  }
);
