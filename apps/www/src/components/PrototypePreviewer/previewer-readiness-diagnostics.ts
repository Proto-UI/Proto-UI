type RuntimeCounters = { dependenciesCompleted: number; admissionsCompleted: number; rendersCompleted: number };
type ReadinessDiagnostics = {
  runtimes: Record<string, RuntimeCounters>;
  queue: { active: number; pending: number; peakActive: number; peakPending: number; samples: number };
  renderPhases?: RenderPhaseReceipt[];
  drain?: { scheduled: number; entered: number; lastScheduledAt: number; lastEnteredAt: number };
};

type RenderPhaseReceipt = {
  runtime: string;
  previewerId: string | null;
  phase: string;
  startedAt: number;
  updatedAt: number;
  transitions: { phase: string; at: number }[];
};

const renderPhases = new WeakMap<HTMLElement, RenderPhaseReceipt>();

export function recordPreviewerDrain(document: Document, phase: 'scheduled' | 'entered'): void {
  const view = document.defaultView;
  const diagnostics = view?.__puiMatrixReadinessDiagnostics;
  if (!diagnostics) return;
  const drain = (diagnostics.drain ??= {
    scheduled: 0, entered: 0, lastScheduledAt: 0, lastEnteredAt: 0,
  });
  drain[phase] += 1;
  if (phase === 'scheduled') drain.lastScheduledAt = view!.performance.now();
  else drain.lastEnteredAt = view!.performance.now();
}

/** Opt-in observations only: no readiness, ownership or admission decisions. */
export function recordPreviewerRenderPhase(host: HTMLElement, runtime: string, phase: string): void {
  const diagnostics = host.ownerDocument.defaultView?.__puiMatrixReadinessDiagnostics;
  if (!diagnostics) return;
  const at = host.ownerDocument.defaultView!.performance.now();
  let receipt = renderPhases.get(host);
  if (!receipt) {
    receipt = {
      runtime,
      previewerId: host.closest<HTMLElement>('[data-previewer-id]')?.dataset.previewerId ?? null,
      phase, startedAt: at, updatedAt: at, transitions: [],
    };
    renderPhases.set(host, receipt);
    (diagnostics.renderPhases ??= []).push(receipt);
  }
  receipt.phase = phase;
  receipt.updatedAt = at;
  receipt.transitions.push({ phase, at });
}

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
