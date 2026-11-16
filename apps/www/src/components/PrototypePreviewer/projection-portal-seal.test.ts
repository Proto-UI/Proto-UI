import { afterEach, describe, expect, it } from 'vitest';

import {
  externalProjectionPortalRoots,
  sealExternalProjectionPortals,
  unlockExternalPortalRoot,
} from './projection-portal-seal';

function portalRoot(ownerId: string, generation: number): HTMLElement {
  const root = document.createElement('section');
  root.dataset.projectionOwner = ownerId;
  root.dataset.projectionGeneration = String(generation);
  document.body.append(root);
  return root;
}

function controlBox(mount: HTMLElement, generation: number, popupId: string): void {
  const control = document.createElement('div');
  control.dataset.projectionControl = 'family';
  control.dataset.projectionGeneration = String(generation);
  const trigger = document.createElement('button');
  trigger.setAttribute('aria-controls', popupId);
  control.append(trigger);
  mount.append(control);
}

describe('Projection external portal sealing', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('seals one generation portal and restores its previous values on unlock', () => {
    const mount = document.createElement('div');
    document.body.append(mount);
    const portal = portalRoot('seal-owner', 3);
    portal.setAttribute('aria-hidden', 'false');

    sealExternalProjectionPortals(mount, 'seal-owner', 3);

    expect(portal.inert).toBe(true);
    expect(portal.getAttribute('aria-hidden')).toBe('true');
    expect(portal.style.visibility).toBe('hidden');
    expect(portal.style.pointerEvents).toBe('none');

    unlockExternalPortalRoot(portal);

    expect(portal.inert).toBe(false);
    expect(portal.getAttribute('aria-hidden')).toBe('false');
    expect(portal.style.visibility).toBe('');
    expect(portal.style.pointerEvents).toBe('');
  });

  it('leaves the control own dropdown open and seals a child content portal', () => {
    const mount = document.createElement('div');
    document.body.append(mount);
    controlBox(mount, 3, 'family-popup');
    const dropdown = portalRoot('seal-owner', 3);
    const dropdownPopup = document.createElement('div');
    dropdownPopup.id = 'family-popup';
    dropdown.append(dropdownPopup);
    const child = portalRoot('seal-owner', 3);

    sealExternalProjectionPortals(mount, 'seal-owner', 3);

    expect(dropdown.inert).toBe(false);
    expect(dropdown.hasAttribute('aria-hidden')).toBe(false);
    expect(dropdown.style.visibility).toBe('');
    expect(child.inert).toBe(true);
    expect(child.getAttribute('aria-hidden')).toBe('true');
  });

  it('never seals a portal of another generation or another owner', () => {
    const mount = document.createElement('div');
    document.body.append(mount);
    const nextGeneration = portalRoot('seal-owner', 4);
    const otherOwner = portalRoot('other-owner', 3);

    sealExternalProjectionPortals(mount, 'seal-owner', 3);

    expect(nextGeneration.inert).toBe(false);
    expect(otherOwner.inert).toBe(false);
    expect(externalProjectionPortalRoots(mount, 'seal-owner', 3)).toEqual([]);
  });
});
