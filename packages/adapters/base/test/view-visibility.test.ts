import { afterEach, describe, expect, it } from 'vitest';
import { installViewVisibilityRule, PUI_VIEW_DETACHED_ATTR, PUI_VIEW_PENDING_ATTR } from '../src';

describe('adapter-base: view visibility', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps a pending host root hidden until the adapter reveals it', () => {
    const root = document.createElement('div');
    root.setAttribute(PUI_VIEW_PENDING_ATTR, '');
    document.body.appendChild(root);

    installViewVisibilityRule(document);

    expect(getComputedStyle(root).visibility).toBe('hidden');

    root.removeAttribute(PUI_VIEW_PENDING_ATTR);
    expect(getComputedStyle(root).visibility).not.toBe('hidden');
  });

  it('takes a detached host root and its subtree out of paint', () => {
    const root = document.createElement('div');
    root.setAttribute(PUI_VIEW_DETACHED_ATTR, '');
    const child = document.createElement('span');
    child.textContent = 'authored child';
    root.appendChild(child);
    document.body.appendChild(root);

    installViewVisibilityRule(document);

    // The exclusion comes from the attribute's own projection, so a styled
    // prototype never has to add a rule of its own to get it.
    expect(getComputedStyle(root).display).toBe('none');
    // The child stays in the tree; it is the ancestor that is out of paint.
    expect(root.contains(child)).toBe(true);

    root.removeAttribute(PUI_VIEW_DETACHED_ATTR);
    expect(getComputedStyle(root).display).not.toBe('none');
  });
});
