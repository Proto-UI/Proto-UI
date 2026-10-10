import { describe, expect, it } from 'vitest';
import { SlotProjector } from '../src/slot-projector';
import { createOwnedVisualSurface, isOwnedVisualNode } from '../src/visual-surface';

describe('slot pool and private visual ownership', () => {
  it('excludes cached owned visuals while retaining caller identity through adoption and replacement', () => {
    // C-HOST-SURFACE-PROJECTION-0001-E: private presentation nodes cannot
    // become application slot input. Attributes alone do not establish ownership.
    const host = document.createElement('div');
    const author = document.createElement('span');
    author.dataset.puiVisual = 'author-owned';
    const oldVisual = document.createElement('canvas');
    host.append(author);
    const surface = createOwnedVisualSurface(host, host);
    surface.mount(oldVisual);
    const projector = new SlotProjector(host);
    // Explicit stale-cache harness: collection must revalidate current ownership.
    projector.projected = [oldVisual, author];
    expect(projector.collectSlotPoolBeforeCommit()).toEqual([author]);
    expect(oldVisual.parentNode).toBe(host);
    expect(author.parentNode).toBeNull();

    host.append(author);
    projector.afterCommit({ owned: new WeakSet(), projected: [author], enableMO: false });
    const adopted = document.implementation.createHTMLDocument('adopted');
    adopted.body.append(adopted.adoptNode(host));
    expect(projector.collectSlotPoolBeforeCommit()).toEqual([author]);
    expect(isOwnedVisualNode(host, oldVisual)).toBe(true);
    expect(oldVisual.parentNode).toBe(host);
    surface.release(oldVisual);
    expect(isOwnedVisualNode(host, oldVisual)).toBe(false);
    expect(oldVisual.parentNode).toBeNull();

    const nextVisual = adopted.createElement('canvas');
    surface.mount(nextVisual);
    host.append(author);
    projector.afterCommit({ owned: new WeakSet(), projected: [author], enableMO: false });
    expect(projector.collectSlotPoolBeforeCommit()).toEqual([author]);
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild).toBe(nextVisual);
    surface.release(nextVisual);
    projector.disconnect();
    expect(host.childNodes).toHaveLength(0);
    expect(author.parentNode).toBeNull();
    expect(oldVisual.parentNode).toBeNull();
  });
});
