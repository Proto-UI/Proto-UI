export function resolveWebFocusEntryTarget(
  container: HTMLElement,
  config: { strategy: 'self' | 'descendant-first'; fallback: 'self' | 'none' },
  isNativelyFocusable: (target: HTMLElement) => boolean
): HTMLElement | null {
  if (config.strategy === 'descendant-first') {
    const descendant = findFirstTabbableDescendant(container, isNativelyFocusable);
    if (descendant) return descendant;
  }

  if (config.fallback === 'self') return container;
  return null;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(',');

function findFirstTabbableDescendant(
  container: HTMLElement,
  isNativelyFocusable: (target: HTMLElement) => boolean
): HTMLElement | null {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return (
    candidates.find((candidate) =>
      isTabbableDescendant(container, candidate, isNativelyFocusable)
    ) ?? null
  );
}

function isTabbableDescendant(
  container: HTMLElement,
  el: HTMLElement,
  isNativelyFocusable: (target: HTMLElement) => boolean
): boolean {
  if (el === container) return false;
  if (!container.contains(el)) return false;
  if (el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  if (el.hasAttribute('disabled')) return false;
  // tabindex cannot make a hidden input or an unassociated image-map area usable.
  if (el.tagName.toLowerCase() === 'input' && (el as HTMLInputElement).type === 'hidden')
    return false;
  if (el.tagName.toLowerCase() === 'area' && !isNativelyFocusable(el)) return false;
  const ariaDisabled = el.getAttribute('aria-disabled');
  if (ariaDisabled === 'true') return false;
  const tabIndexAttr = el.getAttribute('tabindex');
  if (tabIndexAttr !== null && Number(tabIndexAttr) < 0) return false;
  return isNativelyFocusable(el) || tabIndexAttr !== null || el.isContentEditable;
}
