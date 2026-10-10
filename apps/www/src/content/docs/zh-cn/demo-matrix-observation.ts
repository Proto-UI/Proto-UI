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

/** Read-only diagnostic facts. This does not participate in readiness or admission. */
export function collectMatrixReadinessDiagnostics(runtimeCount: number) {
  const roots = [...document.querySelectorAll<HTMLElement>('[data-previewer-id]')];
  const demos = document.querySelectorAll('.demo-matrix__item').length;
  const unavailable = document.querySelectorAll('.demo-matrix__adapter[data-unavailable]').length;
  const row = (root: HTMLElement) => {
    const host = root.querySelector<HTMLElement>('.host');
    const previewError = host?.textContent?.includes('[Preview Error]') === true;
    const activeGenerations = host
      ? Array.from(host.children).filter(
          (child) => child.getAttribute('data-projection-generation-state') === 'active'
        ).length
      : 0;
    const hostReady =
      !!host &&
      (previewError ||
        (root.dataset.projectionMode === 'fixed-family'
          ? root.dataset.projectionState === 'ready' && activeGenerations > 0
          : host.childElementCount > 0));
    return {
      demoId: root.closest<HTMLElement>('.demo-matrix__item')?.id ?? null,
      adapter: root.closest('.demo-matrix__adapter')?.getAttribute('aria-label') ?? null,
      previewerId: root.dataset.previewerId ?? null,
      initialized: root.dataset.inited === '1',
      projectionMode: root.dataset.projectionMode ?? null,
      projectionState: root.dataset.projectionState ?? null,
      hostPresent: !!host,
      hostChildCount: host?.childElementCount ?? 0,
      activeGenerations,
      hostReady,
      previewError: previewError ? (host?.textContent ?? '').slice(0, 2000) : null,
    };
  };
  const rows = roots.map(row);
  const uninitialized = rows.filter((value) => !value.initialized);
  const notReady = rows.filter((value) => !value.hostReady);
  const errors = rows.filter((value) => value.previewError !== null);
  return {
    demos,
    runtimeCount,
    unavailable,
    expectedPreviewers: demos * runtimeCount - unavailable,
    previewers: roots.length,
    initialized: roots.filter((root) => root.dataset.inited === '1').length,
    hostCount: document.querySelectorAll('[data-previewer-id] .host').length,
    uninitializedCount: uninitialized.length,
    notReadyCount: notReady.length,
    uninitializedRows: uninitialized.slice(0, 1000),
    notReadyRows: notReady.slice(0, 1000),
    previewErrors: errors.slice(0, 1000),
    truncated: uninitialized.length > 1000 || notReady.length > 1000 || errors.length > 1000,
  };
}
