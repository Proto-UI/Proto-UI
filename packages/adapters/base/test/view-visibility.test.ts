import { afterEach, describe, expect, it } from 'vitest';
import {
  installViewVisibilityRule,
  PUI_VIEW_DETACHED_ATTR,
  PUI_VIEW_PENDING_ATTR,
  PUI_VIEW_REVEALING_ATTR,
} from '../src';

describe('adapter-base: view visibility', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps a pending host root hidden until the adapter reveals it', () => {
    const root = document.createElement('div');
    root.setAttribute(PUI_VIEW_PENDING_ATTR, '');
    root.style.transition = 'all 5s ease';
    root.style.animation = 'pulse 5s linear';
    document.body.appendChild(root);

    installViewVisibilityRule(document);

    expect(getComputedStyle(root).visibility).toBe('hidden');
    expect(getComputedStyle(root).transition).toBe('none');
    expect(getComputedStyle(root).animation).toBe('none');

    root.setAttribute(PUI_VIEW_REVEALING_ATTR, '');
    root.removeAttribute(PUI_VIEW_PENDING_ATTR);
    expect(getComputedStyle(root).visibility).not.toBe('hidden');
    expect(getComputedStyle(root).transition).toBe('none');
    expect(getComputedStyle(root).animation).toBe('none');

    root.removeAttribute(PUI_VIEW_REVEALING_ATTR);
    expect(getComputedStyle(root).transition).not.toBe('none');
    expect(getComputedStyle(root).animation).not.toBe('none');
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

  it('reveals retained Proto children at their current style without suppressing authored keyframes', () => {
    const parent = document.createElement('div');
    parent.setAttribute(PUI_VIEW_REVEALING_ATTR, 'presence');
    parent.style.animation = 'enter 200ms ease';
    const child = document.createElement('button');
    child.setAttribute('data-pui-root', '');
    child.style.transition = 'background-color 150ms linear';
    child.style.animation = 'pulse 2s linear';
    const authoredChild = document.createElement('span');
    authoredChild.style.transition = 'opacity 100ms ease';
    const separatePortal = child.cloneNode() as HTMLElement;
    parent.append(child, authoredChild);
    document.body.append(parent, separatePortal);
    const originalStyle = child.getAttribute('style');

    installViewVisibilityRule(document);

    expect(getComputedStyle(parent).animation).toBe('enter 200ms ease');
    expect(getComputedStyle(child).transition).toBe('none');
    expect(getComputedStyle(child).animation).toBe('pulse 2s linear');
    expect(getComputedStyle(authoredChild).transition).toBe('opacity 100ms ease');
    expect(getComputedStyle(separatePortal).transition).toBe('background-color 150ms linear');
    expect(child.getAttribute('style')).toBe(originalStyle);

    parent.removeAttribute(PUI_VIEW_REVEALING_ATTR);
    expect(parent.firstElementChild).toBe(child);
    expect(getComputedStyle(child).transition).toBe('background-color 150ms linear');
    expect(getComputedStyle(child).animation).toBe('pulse 2s linear');
    parent.style.backgroundColor = 'red';
    expect(getComputedStyle(child).transition).toBe('background-color 150ms linear');
  });

  it('retains the inner reveal barrier after an outer presence reveal finishes', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const child = document.createElement('button');
    child.setAttribute('data-pui-root', '');
    child.style.transition = 'background-color 150ms linear';
    outer.setAttribute(PUI_VIEW_REVEALING_ATTR, 'presence');
    inner.setAttribute(PUI_VIEW_REVEALING_ATTR, 'presence');
    inner.append(child);
    outer.append(inner);
    document.body.append(outer);
    installViewVisibilityRule(document);

    expect(getComputedStyle(child).transition).toBe('none');
    outer.removeAttribute(PUI_VIEW_REVEALING_ATTR);
    expect(getComputedStyle(child).transition).toBe('none');
    inner.removeAttribute(PUI_VIEW_REVEALING_ATTR);
    expect(getComputedStyle(child).transition).toBe('background-color 150ms linear');
  });

  it.each(['', 'portal'])('keeps the existing non-presence child policy for %j reveal', (kind) => {
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.setAttribute(PUI_VIEW_REVEALING_ATTR, kind);
    child.setAttribute('data-pui-root', '');
    child.style.transition = 'background-color 150ms linear';
    parent.append(child);
    document.body.append(parent);
    installViewVisibilityRule(document);

    expect(getComputedStyle(parent).transition).toBe('none');
    expect(getComputedStyle(child).transition).toBe('background-color 150ms linear');
  });
});
