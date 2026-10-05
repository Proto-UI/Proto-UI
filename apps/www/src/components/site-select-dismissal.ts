/** Application composition owns parent dismissal. The actual public Select
 * request remains the only authority that can change a child dropdown. */
const owners = new WeakMap<HTMLElement, (reason: string) => void>();

export function bindSiteSelectDismissal(owner: HTMLElement, close: (reason: string) => void) {
  owners.set(owner, close);
  return () => {
    if (owners.get(owner) === close) owners.delete(owner);
  };
}

export function closeSiteSelects(scope: ParentNode, reason: string) {
  for (const owner of scope.querySelectorAll<HTMLElement>(
    '[data-site-select-root], [data-projection-control]'
  ))
    owners.get(owner)?.(reason);
}
