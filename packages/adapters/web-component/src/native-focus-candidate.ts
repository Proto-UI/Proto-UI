// Adapter-owned native candidate policy. This reads only current DOM facts;
// it neither samples style nor invokes a supplied callback. Its exact identity
// bounds the optional descendant-existence preflight in focus-scope-targets.
export function isWebComponentNativeFocusCandidate(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'iframe') {
    return true;
  }
  if (tag === 'input') return (el as HTMLInputElement).type !== 'hidden';
  if (tag === 'a') return el.hasAttribute('href');
  if (tag === 'area') {
    const map = el.closest('map');
    if (!el.hasAttribute('href') || !map?.name || !el.isConnected) return false;
    for (const image of el.ownerDocument.querySelectorAll('img[usemap]')) {
      if (
        image.getAttribute('usemap') === `#${map.name}` &&
        !image.closest('[hidden],[inert],[aria-hidden="true"]')
      )
        return true;
    }
    return false;
  }
  if (tag === 'audio' || tag === 'video') return el.hasAttribute('controls');
  if (tag === 'summary') {
    const parent = el.parentElement;
    if (parent?.tagName.toLowerCase() !== 'details') return false;
    for (const child of parent.children) {
      if (child.tagName.toLowerCase() === 'summary') return child === el;
    }
  }
  return false;
}
