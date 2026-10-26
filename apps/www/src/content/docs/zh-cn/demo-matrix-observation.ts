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

/** Keep the original S4 startup predicate; retain its first short-circuit miss. */
export function observeS4Startup(): boolean {
  const previews = [...document.querySelectorAll('[data-previewer-id]')];
  const failure: {
    first?: {
      previewer: Element;
      host: Element | null;
      index: number;
      inited: string | null;
      children: number | null;
    };
  } = {};
  const ready =
    previews.length > 0 &&
    previews.every((previewer, index) => {
      const inited = previewer.getAttribute('data-inited');
      // Preserve the original short circuit: an uninitialized previewer does
      // not query its host merely to produce diagnostics.
      const host = inited === '1' ? previewer.querySelector('.host') : null;
      const children = inited === '1' ? (host?.childElementCount ?? 0) : null;
      const result = inited === '1' && children !== null && children > 0;
      if (!result) failure.first = { previewer, host, index, inited, children };
      return result;
    });
  try {
    const row = {
      timeOrigin: globalThis.performance.timeOrigin,
      pageMs: globalThis.performance.now(),
      dateNow: Date.now(),
      count: previews.length,
      ready,
      firstMissing: failure.first
        ? {
            previewerId: failure.first.previewer.getAttribute('data-previewer-id'),
            index: failure.first.index,
            inited: failure.first.inited,
            hostChildren: failure.first.children,
          }
        : null,
      firstMissingOwner: failure.first
        ? {
            demoId: failure.first.previewer.getAttribute('data-demo-id'),
            prototypeId: failure.first.previewer.getAttribute('data-prototype-id'),
            declaredRuntime: failure.first.previewer.getAttribute('data-initial-runtime'),
            projectionMode: failure.first.previewer.getAttribute('data-projection-mode'),
            projectionState: failure.first.previewer.getAttribute('data-projection-state'),
            mounting: failure.first.previewer.getAttribute('data-mounting'),
            hostTag: failure.first.host?.tagName ?? null,
            hostOwner:
              failure.first.host
                ?.closest('[data-previewer-id]')
                ?.getAttribute('data-previewer-id') ?? null,
            startupPending:
              failure.first.host?.hasAttribute('data-previewer-startup-pending') ?? null,
            hostOwnInert: failure.first.host?.hasAttribute('inert') ?? null,
            hostText: failure.first.host?.textContent?.slice(0, 512) ?? null,
          }
        : null,
    };
    const key = JSON.stringify([row.count, row.ready, row.firstMissing, row.firstMissingOwner]);
    const target = window as any;
    const journal = (target.__puiS4Startup ??= {
      samples: 0,
      changes: [],
      dropped: 0,
      lastKey: '',
      last: null,
    });
    journal.samples++;
    journal.last = row;
    if (key !== journal.lastKey) {
      journal.lastKey = key;
      if (journal.changes.length < 32) {
        journal.changes.push(row);
        // Stream only the same bounded changes; the original last sample remains.
        console.info('[S4 startup change]', JSON.stringify(row));
      } else journal.dropped++;
    }
  } catch {
    // Diagnostics cannot change the original readiness result.
  }
  return ready;
}

/** Passive pre-navigation observation only; no whole-matrix scan or layout read. */
export function installS4InitJournal(): void {
  if (window.top !== window) return;
  const state = {
    deliveryCount: 0,
    observedRecords: 0,
    examinedRecords: 0,
    skippedBatchRecords: 0,
    ignoredTargets: 0,
    emitted: 0,
    droppedEmits: 0,
    observerErrors: 0,
    stoppedAtCap: false,
    last: null as Record<string, unknown> | null,
  };
  let observer: MutationObserver | null = null;
  const emit = (stage: string, facts: Record<string, unknown> = {}) => {
    try {
      if (state.emitted >= 128) {
        state.droppedEmits++;
        return;
      }
      state.emitted++;
      const row = {
        stage,
        ordinal: state.emitted,
        timeOrigin: globalThis.performance.timeOrigin,
        pageMs: globalThis.performance.now(),
        dateNow: Date.now(),
        readyState: document.readyState,
        ...facts,
      };
      state.last = row;
      if (state.emitted === 128) {
        state.stoppedAtCap = true;
        observer?.disconnect();
      }
      console.info('[S4 init observation]', JSON.stringify(row));
    } catch {
      state.observerErrors++;
    }
  };
  try {
    Object.defineProperty(window, '__puiS4InitJournal', {
      configurable: true,
      value: state,
    });
    observer = new MutationObserver((records) => {
      state.deliveryCount++;
      state.observedRecords += records.length;
      const count = Math.min(records.length, 8);
      state.skippedBatchRecords += records.length - count;
      for (let index = 0; index < count; index++) {
        try {
          state.examinedRecords++;
          const record = records[index]!;
          const target = record.target;
          if (!(target instanceof Element)) continue;
          const previewer = target.hasAttribute('data-previewer-id');
          const host = target.classList.contains('host');
          if (!previewer && !host) {
            state.ignoredTargets++;
            continue;
          }
          // A host's direct parent is the preview wrapper, not its owning root.
          const root = target.closest('[data-previewer-id]');
          emit('mutation-delivery', {
            rootId: root?.getAttribute('data-previewer-id') ?? null,
            rootInited: root?.getAttribute('data-inited') ?? null,
            rootProjectionState: root?.getAttribute('data-projection-state') ?? null,
            delivery: state.deliveryCount,
            batchIndex: index,
            batchSize: records.length,
            type: record.type,
            attribute: record.attributeName,
            targetTag: target.tagName,
            targetClass: target.getAttribute('class'),
            parentClass: target.parentElement?.getAttribute('class') ?? null,
            previewerId: target.getAttribute('data-previewer-id'),
            parentPreviewerId: target.parentElement?.getAttribute('data-previewer-id') ?? null,
            demoId: target.getAttribute('data-demo-id'),
            inited: target.getAttribute('data-inited'),
            mounting: target.getAttribute('data-mounting'),
            lazy: target.getAttribute('data-lazy'),
            lazyObserved: target.getAttribute('data-lazy-observed'),
            projectionState: target.getAttribute('data-projection-state'),
            hostChildren: host ? target.childElementCount : null,
          });
        } catch {
          state.observerErrors++;
        }
        if (state.stoppedAtCap) break;
      }
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-inited',
        'data-mounting',
        'data-lazy-observed',
        'data-projection-state',
      ],
    });
    document.addEventListener('DOMContentLoaded', () => emit('domcontentloaded'), { once: true });
    window.addEventListener('load', () => emit('load'), { once: true });
    emit('installed');
  } catch {
    state.observerErrors++;
    try {
      observer?.disconnect();
    } catch {
      state.observerErrors++;
    }
    emit('setup-unavailable');
  }
}
