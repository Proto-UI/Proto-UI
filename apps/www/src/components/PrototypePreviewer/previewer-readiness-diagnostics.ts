type RuntimeCounters = { dependenciesCompleted: number; admissionsCompleted: number; rendersCompleted: number };
type ReadinessDiagnostics = {
  runtimes: Record<string, RuntimeCounters>;
  queue: { active: number; pending: number; peakActive: number; peakPending: number; samples: number };
};

declare global {
  interface Window {
    __puiMatrixReadinessDiagnostics?: ReadinessDiagnostics;
  }
}

/** Installed before navigation by the opt-in Matrix observer; never enables itself. */
export function recordPreviewerCompletion(
  document: Document,
  runtime: string,
  phase: keyof RuntimeCounters
): void {
  const diagnostics = document.defaultView?.__puiMatrixReadinessDiagnostics;
  if (!diagnostics) return;
  if (runtime !== 'wc' && runtime !== 'react' && runtime !== 'vue' && runtime !== 'vue2') return;
  const counters = (diagnostics.runtimes[runtime] ??= {
    dependenciesCompleted: 0,
    admissionsCompleted: 0,
    rendersCompleted: 0,
  });
  counters[phase] += 1;
}

export function recordPreviewerQueue(document: Document, active: number, pending: number): void {
  const diagnostics = document.defaultView?.__puiMatrixReadinessDiagnostics;
  if (!diagnostics) return;
  const queue = diagnostics.queue;
  queue.active = active;
  queue.pending = pending;
  queue.peakActive = Math.max(queue.peakActive, active);
  queue.peakPending = Math.max(queue.peakPending, pending);
  queue.samples += 1;
}
