// Browser-evaluated observations: keep these functions self-contained so
// Playwright can serialize them without importing page-side dependencies.
export type InteractiveFact = { role: string; name: string };

export function matrixHostsReady(): boolean {
  const hosts = [...document.querySelectorAll<HTMLElement>('[data-previewer-id] .host')];
  return (
    hosts.length > 0 &&
    hosts.every((host) => {
      const root = host.closest<HTMLElement>('[data-previewer-id]');
      // Let the existing error assertion report failed mounting, rather than
      // turning a rendered error into an unexplained readiness timeout.
      if (host.textContent?.includes('[Preview Error]')) return true;
      if (root?.dataset.projectionMode === 'fixed-family') {
        return (
          root.dataset.projectionState === 'ready' &&
          Array.from(host.children).some(
            (child) => child.getAttribute('data-projection-generation-state') === 'active'
          )
        );
      }
      return host.childElementCount > 0;
    })
  );
}

export function collectMatrixInteractiveFacts(
  interactiveRoles: readonly string[]
): Record<string, InteractiveFact[][]> {
  const roles = new Set<string>(interactiveRoles);
  const accessibleName = (element: HTMLElement): string => {
    const labelledBy = element.getAttribute('aria-labelledby');
    const labelledText = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
      : '';
    return (
      element.getAttribute('aria-label') ||
      labelledText ||
      element.getAttribute('title') ||
      element.textContent ||
      ''
    )
      .trim()
      .replace(/\s+/g, ' ');
  };
  const visible = (element: HTMLElement): boolean => {
    // Hidden projection candidates remain laid out for framework preparation.
    if (element.closest('[data-projection-generation-state="staging"]')) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
    );
  };

  const result: Record<string, InteractiveFact[][]> = {};
  document.querySelectorAll<HTMLElement>('.demo-matrix__item').forEach((item) => {
    const grids = Array.from(item.children).filter((child) =>
      child.classList.contains('demo-matrix__adapters')
    );
    result[item.id] = grids
      .flatMap((grid) => Array.from(grid.children))
      .filter((child) => child.matches('.demo-matrix__adapter:not([data-unavailable])'))
      .map((adapter) =>
        Array.from(adapter.querySelectorAll<HTMLElement>('[role],button,input,select,textarea'))
          .filter((element) => {
            const role = element.getAttribute('role');
            return (
              ((role && roles.has(role)) ||
                ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) &&
              visible(element)
            );
          })
          .map((element) => ({
            role: element.getAttribute('role') || element.tagName.toLowerCase(),
            name: accessibleName(element),
          }))
      );
  });
  return result;
}
