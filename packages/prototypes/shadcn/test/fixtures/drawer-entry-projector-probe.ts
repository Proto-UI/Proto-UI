/** Test-build observation only. Original host return values and completion calls are preserved. */
export * from '../../../../modules/feedback/src/index';
import { createPresencePresentationProjector as original } from '../../../../modules/feedback/src/index';
import type { PresencePresentationFrame } from '../../../../modules/feedback/src/index';
export function createPresencePresentationProjector(host: Parameters<typeof original>[0]) {
  let current: PresencePresentationFrame | null = null;
  const record = (kind: string, detail: unknown, frame = current) => {
    try {
      const records = ((window as any).__drawerEntryProbe ??= []);
      if (records.length >= 2000) return;
      const selector = frame?.closed.translate
        ? 'wc-shadcn-drawer-content'
        : 'wc-shadcn-drawer-mask';
      const element = document.querySelector(selector) as HTMLElement | null;
      const measure = kind !== 'commit' && kind !== 'project-before';
      const css = element && measure ? getComputedStyle(element) : null;
      records.push({
        kind,
        time: performance.now(),
        phase: frame?.owner.phase,
        attempt: frame?.owner.attempt,
        channel: frame?.closed.translate ? 'content' : 'mask',
        duration: frame?.owner.durationMs,
        detail,
        surface: element
          ? {
              connected: element.isConnected,
              width: css?.width,
              height: css?.height,
              display: css?.display,
              translate: css?.translate,
              boxSizing: css?.boxSizing,
              pendingAncestor: !!element.closest('[data-pui-view-pending]'),
              detachedAncestor: !!element.closest('[data-pui-view-detached]'),
              attributes: Object.fromEntries([...element.attributes].map((a) => [a.name, a.value])),
              rect: measure ? element.getBoundingClientRect().toJSON() : null,
              children: element.childNodes.length,
            }
          : null,
      });
    } catch {
      /* Observation cannot replace a production result or exception. */
    }
  };
  const sink = original({
    ...host,
    environment() {
      const value = host.environment();
      record('environment', value);
      return value;
    },
    project(style, sample, isCurrent) {
      const frame = current;
      record('project-before', { sample }, frame);
      const value = host.project(style, sample, isCurrent);
      record('project-after', { accepted: value }, frame);
      return value;
    },
  });
  return {
    ...sink,
    commit(frame: PresencePresentationFrame) {
      current = frame;
      record('commit', {});
      return sink.commit({
        ...frame,
        complete(binding, outcome) {
          record('complete', { outcome }, frame);
          return frame.complete(binding, outcome);
        },
      });
    },
  };
}
