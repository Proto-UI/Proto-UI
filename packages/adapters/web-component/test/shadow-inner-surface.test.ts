import { describe, expect, it } from 'vitest';

import { createShadowInnerSurface } from '../src/shadow-inner-surface';
import { createShadowOwnerShell } from '../src/shadow-owner-shell';
import { createShadowStylesheetOwner } from '../src/shadow-stylesheet-owner';

function createShell() {
  const host = document.createElement('x-shadow-inner-surface');
  return createShadowOwnerShell(host.attachShadow({ mode: 'open' }));
}

describe('adapter-web-component Shadow inner surface', () => {
  it('retains an equivalent slot-only view until detach, without retaining changed content', () => {
    const surface = createShadowInnerSurface(createShell());
    const first = document.createElement('slot');
    surface.replaceRenderedChildren([first]);
    surface.replaceRenderedChildren([document.createElement('slot')]);
    expect(surface.element.firstChild).toBe(first);
    expect(surface.hasOnlyRenderedNode(first)).toBe(true);
    surface.clearRenderedChildren();
    const next = document.createElement('slot');
    surface.replaceRenderedChildren([next]);
    expect(surface.element.firstChild).toBe(next);
    const changed = document.createElement('span');
    surface.replaceRenderedChildren([changed]);
    expect(surface.element.firstChild).toBe(changed);
    expect(next.parentNode).toBeNull();
    surface.dispose();
  });
  it('retains one stable surface while replacing view-epoch children', () => {
    const shell = createShell();
    const surface = createShadowInnerSurface(shell);
    const element = surface.element;
    const first = document.createElement('span');
    const second = document.createElement('button');

    surface.replaceRenderedChildren([first]);
    expect(surface.hasOnlyRenderedNode(first)).toBe(true);

    surface.clearRenderedChildren();
    expect(element.parentNode).toBe(shell.root);
    expect(element.childNodes).toHaveLength(0);

    surface.replaceRenderedChildren([second]);
    expect(surface.element).toBe(element);
    expect(surface.hasOnlyRenderedNode(second)).toBe(true);
    expect(first.parentNode).toBeNull();
  });

  it('deduplicates by ShadowRoot and coexists with owner-lived stylesheet resources', () => {
    const shell = createShell();
    const stylesheet = createShadowStylesheetOwner(shell, 'div { box-sizing: border-box; }');
    const surface = createShadowInnerSurface(shell);
    const sameSurface = createShadowInnerSurface(shell);

    expect(sameSurface).toBe(surface);
    expect(Array.from(shell.root.childNodes)).toEqual([stylesheet.element, surface.element]);

    const child = document.createTextNode('epoch');
    surface.replaceRenderedChildren([child]);
    surface.clearRenderedChildren();

    expect(Array.from(shell.root.childNodes)).toEqual([stylesheet.element, surface.element]);
  });

  it('removes the surface and its view contents at terminal disposal', () => {
    const shell = createShell();
    const surface = createShadowInnerSurface(shell);
    const child = document.createElement('span');
    surface.replaceRenderedChildren([child]);

    surface.dispose();
    surface.dispose();

    expect(surface.element.parentNode).toBeNull();
    expect(surface.element.childNodes).toHaveLength(0);
    expect(child.parentNode).toBeNull();
    expect(() => surface.clearRenderedChildren()).toThrow(/shadow-inner:disposed/);

    const nextSurface = createShadowInnerSurface(shell);
    expect(nextSurface).not.toBe(surface);
    expect(nextSurface.element).not.toBe(surface.element);
    expect(nextSurface.element.parentNode).toBe(shell.root);
  });
});
