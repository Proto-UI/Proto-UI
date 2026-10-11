import { expect, it } from 'vitest';
import { collectCollapsibleFocusFailure } from './collapsible-focus-observation';

it('distinguishes a real focus mismatch without changing focus or admission', () => {
  const previewer = document.createElement('div');
  previewer.dataset.previewerId = 'focus-observation';
  previewer.dataset.projectionRuntime = 'vue2';
  previewer.dataset.projectionState = 'ready';
  const button = document.createElement('button');
  button.textContent = 'Disclosure';
  const foreign = document.createElement('button');
  foreign.id = 'other-focus-owner';
  previewer.append(button, foreign);
  document.body.append(previewer);
  try {
    foreign.focus();
    const mismatch = collectCollapsibleFocusFailure(button);
    expect(mismatch.focused).toBe(false);
    expect(mismatch.active?.id).toBe('other-focus-owner');
    expect(document.activeElement).toBe(foreign);
    expect(mismatch.runtime).toBe('vue2');
    (
      previewer as HTMLElement & { __puiCollapsibleLastPointerTarget?: Element }
    ).__puiCollapsibleLastPointerTarget = foreign;
    expect(collectCollapsibleFocusFailure(button).pointerTargetIsExpected).toBe(false);
    foreign.remove();
    expect(collectCollapsibleFocusFailure(button).pointerTarget?.connected).toBe(false);
    button.focus();
    expect(collectCollapsibleFocusFailure(button).focused).toBe(true);
    button.setAttribute('data-pui-view-pending', '');
    button.setAttribute('inert', '');
    const pending = collectCollapsibleFocusFailure(button);
    expect(pending.expected?.pendingAncestor).toBe(true);
    expect(pending.expected?.inertAncestor).toBe(true);
    expect(button.hasAttribute('data-pui-view-pending')).toBe(true);
  } finally {
    previewer.remove();
  }
});
