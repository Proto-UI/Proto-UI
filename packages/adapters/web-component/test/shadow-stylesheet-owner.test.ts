import { describe, expect, it } from 'vitest';

import { createShadowOwnerShell } from '../src/shadow-owner-shell';
import { createShadowStylesheetOwner } from '../src/shadow-stylesheet-owner';

function createShell() {
  const host = document.createElement('x-shadow-stylesheet-owner');
  return createShadowOwnerShell(host.attachShadow({ mode: 'open' }));
}

describe('adapter-web-component Shadow stylesheet owner', () => {
  it('deduplicates one owner per ShadowRoot and updates its stable style element', () => {
    const shell = createShell();
    const owner = createShadowStylesheetOwner(shell, ':host { color: red; }');
    const element = owner.element;

    const sameRootShell = createShadowOwnerShell(shell.root);
    const sameOwner = createShadowStylesheetOwner(sameRootShell, ':host { color: blue; }');
    expect(sameOwner).toBe(owner);
    expect(sameOwner.element).toBe(element);
    expect(sameOwner.cssText).toBe(':host { color: blue; }');
    expect(element.textContent).toBe(':host { color: blue; }');
    expect(shell.root.querySelectorAll('[data-pui-shadow-stylesheet]')).toHaveLength(1);

    sameOwner.update(':host { color: blue; }');
    expect(sameOwner.element).toBe(element);
    expect(shell.root.querySelectorAll('[data-pui-shadow-stylesheet]')).toHaveLength(1);
  });

  it('survives view-epoch replacement and restores its owned node if displaced', () => {
    const shell = createShell();
    const owner = createShadowStylesheetOwner(
      shell,
      '[data-pui-style] { box-sizing: border-box; }'
    );
    const first = document.createElement('div');
    const second = document.createElement('span');

    shell.replaceRenderedChildren([first]);
    shell.clearRenderedChildren();
    shell.replaceRenderedChildren([second]);

    expect(shell.root.firstChild).toBe(owner.element);
    expect(shell.root.lastChild).toBe(second);

    owner.element.remove();
    owner.update(owner.cssText);
    expect(shell.root.firstChild).toBe(owner.element);
    expect(shell.root.lastChild).toBe(second);
  });

  it('cleans up terminal ownership idempotently and permits a later owner generation', () => {
    const shell = createShell();
    const owner = createShadowStylesheetOwner(shell, ':host { display: block; }');

    owner.dispose();
    owner.dispose();

    expect(owner.element.parentNode).toBeNull();
    expect(shell.root.querySelector('[data-pui-shadow-stylesheet]')).toBeNull();
    expect(() => owner.update('')).toThrow(/disposed Shadow stylesheet owner/);

    const nextOwner = createShadowStylesheetOwner(shell, ':host { display: inline; }');
    expect(nextOwner).not.toBe(owner);
    expect(nextOwner.element).not.toBe(owner.element);
    expect(shell.root.querySelectorAll('[data-pui-shadow-stylesheet]')).toHaveLength(1);
  });
});
