/**
 * Sealing of the external portals that a projection generation owns.
 *
 * A projected generation can own an open popup (Select, Dropdown, ...) that
 * the Prototype renders outside its mount. Those portal roots carry the
 * generation's coordinates, so a generation that is leaving must seal them
 * before the next paint: an open popup that outlives its owner stays
 * interactive and focus-reachable.
 *
 * The seal is reversible. It records the exact previous values of the root
 * and restores them when the generation becomes visible again.
 */

type InlineStyleSnapshot = Readonly<{
  value: string;
  priority: string;
}>;

type ExternalPortalVisibilitySnapshot = Readonly<{
  inert: boolean;
  ariaHidden: string | null;
  visibility: InlineStyleSnapshot;
  pointerEvents: InlineStyleSnapshot;
}>;

const externalPortalVisibilitySnapshots = new WeakMap<
  HTMLElement,
  ExternalPortalVisibilitySnapshot
>();

function inlineStyleSnapshot(element: HTMLElement, property: string): InlineStyleSnapshot {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(
  element: HTMLElement,
  property: string,
  snapshot: InlineStyleSnapshot
): void {
  if (snapshot.value) element.style.setProperty(property, snapshot.value, snapshot.priority);
  else element.style.removeProperty(property);
}

export function lockExternalPortalRoot(root: HTMLElement): void {
  if (!externalPortalVisibilitySnapshots.has(root)) {
    externalPortalVisibilitySnapshots.set(root, {
      inert: root.inert,
      ariaHidden: root.getAttribute('aria-hidden'),
      visibility: inlineStyleSnapshot(root, 'visibility'),
      pointerEvents: inlineStyleSnapshot(root, 'pointer-events'),
    });
  }
  root.inert = true;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('visibility', 'hidden', 'important');
  root.style.setProperty('pointer-events', 'none', 'important');
}

export function unlockExternalPortalRoot(root: HTMLElement): void {
  const snapshot = externalPortalVisibilitySnapshots.get(root);
  if (!snapshot) return;
  root.inert = snapshot.inert;
  if (snapshot.ariaHidden === null) root.removeAttribute('aria-hidden');
  else root.setAttribute('aria-hidden', snapshot.ariaHidden);
  restoreInlineStyle(root, 'visibility', snapshot.visibility);
  restoreInlineStyle(root, 'pointer-events', snapshot.pointerEvents);
  externalPortalVisibilitySnapshots.delete(root);
}

export function externalProjectionPortalRoots(
  mount: HTMLElement,
  ownerId: string,
  generation?: number
): HTMLElement[] {
  const generationValue = generation === undefined ? undefined : String(generation);
  const ownsGeneration = (element: Element): boolean =>
    element.getAttribute('data-projection-owner') === ownerId &&
    (generationValue === undefined ||
      element.getAttribute('data-projection-generation') === generationValue);
  const sameOwnedGeneration = (left: Element, right: Element): boolean =>
    left.getAttribute('data-projection-owner') === right.getAttribute('data-projection-owner') &&
    left.getAttribute('data-projection-generation') ===
      right.getAttribute('data-projection-generation');
  const selector = /^[A-Za-z0-9_-]+$/.test(ownerId)
    ? `[data-projection-owner="${ownerId}"][data-projection-generation]`
    : '[data-projection-owner][data-projection-generation]';
  const externalSurfaces = Array.from(
    mount.ownerDocument.querySelectorAll<HTMLElement>(selector)
  ).filter(
    (element) => !mount.contains(element) && !element.contains(mount) && ownsGeneration(element)
  );

  return externalSurfaces.filter((surface) => {
    let ancestor = surface.parentElement;
    // Consumer shells may publish the same owner/generation as their mount.
    // They are never external portals, nor roots of a genuine sibling portal.
    while (ancestor && !mount.contains(ancestor) && !ancestor.contains(mount)) {
      if (sameOwnedGeneration(surface, ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

export function removeExternalGenerationSurfaces(
  mount: HTMLElement,
  ownerId: string,
  generation: number
): void {
  for (const root of externalProjectionPortalRoots(mount, ownerId, generation)) {
    externalPortalVisibilitySnapshots.delete(root);
    root.remove();
  }
}

/**
 * The portal roots that belong to a projection control's own dropdown.
 *
 * A control trigger owns the popup it controls through `aria-controls`, so
 * the portal root that renders that popup is the control's own surface and
 * not a child content surface. The relation is read from the DOM: the
 * controlled popup is the trigger's own popup, and the portal root is the
 * projected surface inside that popup.
 */
function controlOwnedPortalRoots(
  mount: HTMLElement,
  ownerId: string,
  generation: number,
  roots: readonly HTMLElement[]
): Set<HTMLElement> {
  const owned = new Set<HTMLElement>();
  if (roots.length === 0) return owned;
  const document = mount.ownerDocument;
  const generationValue = String(generation);
  const triggers = mount.querySelectorAll<HTMLElement>(
    `[data-projection-control][data-projection-generation="${generationValue}"] [aria-controls]`
  );
  for (const trigger of triggers) {
    const controls = trigger.getAttribute('aria-controls');
    if (!controls) continue;
    for (const id of controls.split(/\s+/)) {
      if (!id) continue;
      const controlled = document.getElementById(id);
      if (!controlled) continue;
      for (const root of roots) {
        if (root === controlled || root.contains(controlled) || controlled.contains(root)) {
          owned.add(root);
        }
      }
    }
  }
  return owned;
}

/**
 * Seal every open external portal of one generation.
 *
 * A programmatic switch request must seal the outgoing generation's portals
 * in the request's own turn, before the switch is applied. The control's own
 * dropdown is excluded: the control closes it in the same turn as its value
 * change, and sealing it there would cancel that close and lose its focus
 * handback.
 */
export function sealExternalProjectionPortals(
  mount: HTMLElement,
  ownerId: string,
  generation: number
): void {
  const roots = externalProjectionPortalRoots(mount, ownerId, generation);
  if (roots.length === 0) return;
  const controlOwned = controlOwnedPortalRoots(mount, ownerId, generation, roots);
  for (const root of roots) {
    if (controlOwned.has(root)) continue;
    lockExternalPortalRoot(root);
  }
}
