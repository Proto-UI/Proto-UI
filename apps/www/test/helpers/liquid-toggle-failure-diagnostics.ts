import type { CDPSession, ConsoleMessage, Locator, Page } from 'playwright-core';
// The script's main() is guarded by its exact entry path; importing these
// helpers launches neither a browser nor a server.
import { deadline, inputProbe, INPUT_PREFIX } from '../../scripts/diagnose-select-click';

/** Locator timeout covers resolution, not a stalled renderer-side evaluate.
 * Keep a Node-side bound around the complete optional diagnostic read. */
export function readLiquidToggleTriggerFacts(trigger: Pick<Locator, 'evaluate'>) {
  return deadline(
    'pre-click-trigger-facts',
    () =>
      trigger.evaluate(
        (element) => ({
          tag: element.localName,
          role: element.getAttribute('role'),
          expanded: element.getAttribute('aria-expanded'),
          disabled: element.getAttribute('aria-disabled'),
          controls: element.getAttribute('aria-controls'),
        }),
        undefined,
        { timeout: 1000 }
      ),
    1000
  );
}

export type LiquidToggleDiagnosticStage = {
  locale: string;
  runtime?: string;
  stage: string;
};
type Stamp = LiquidToggleDiagnosticStage & { at: number };
type InputFact = {
  sequence: number;
  type: string;
  trusted: boolean;
  wallTime: number;
  performanceTime: number;
  phase: number;
  tag: string | null;
  role: string | null;
  expanded: string | null;
};
type PausedEvent = {
  callFrames: Array<{
    functionName: string;
    url: string;
    location: { scriptId: string; lineNumber: number };
  }>;
};
const inputTypes = new Set([
  'pointerover',
  'pointerenter',
  'pointermove',
  'pointerdown',
  'mousedown',
  'focusin',
  'pointerup',
  'mouseup',
  'click',
]);

function inputFact(value: unknown): InputFact | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.type !== 'string' ||
    !inputTypes.has(v.type) ||
    typeof v.trusted !== 'boolean' ||
    !['sequence', 'wallTime', 'performanceTime', 'phase'].every(
      (key) => typeof v[key] === 'number' && Number.isFinite(v[key])
    ) ||
    !['tag', 'role', 'expanded'].every(
      (key) => v[key] === null || (typeof v[key] === 'string' && v[key].length <= 120)
    )
  )
    return null;
  // Whitelist primitives: console payloads cannot smuggle arbitrary objects.
  return {
    sequence: v.sequence as number,
    type: v.type,
    trusted: v.trusted,
    wallTime: v.wallTime as number,
    performanceTime: v.performanceTime as number,
    phase: v.phase as number,
    tag: v.tag as string | null,
    role: v.role as string | null,
    expanded: v.expanded as string | null,
  };
}

/** Test-only, failure diagnostics. The caller owns the Page/CDP lifecycle and
 * must rethrow its original test error. No action or assertion is replaced.
 * The reused passive DOM probe expires with the owned page; dispose removes
 * node-side listeners and disables this helper's Debugger instrumentation. */
export function attachLiquidToggleFailureDiagnostics(
  page: Pick<Page, 'on' | 'off' | 'evaluate'>,
  cdp: Pick<CDPSession, 'on' | 'off' | 'send'>,
  initial: LiquidToggleDiagnosticStage,
  options: { timeoutMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 3000)
    throw new RangeError('Diagnostic timeout must be finite and between 1 and 3000 ms.');
  let current = { ...initial };
  const stamp = (): Stamp => ({ ...current, at: Date.now() });
  const state = {
    acceptance: false as const,
    limitation:
      'Passive input logging and Debugger instrumentation may perturb execution. Failure-only stacks are diagnostic, not functional acceptance or proof of the first invalidating callback.',
    stages: [stamp()],
    inputEvents: [] as Array<Stamp & { input: InputFact }>,
    pageErrors: [] as Array<Stamp & { error: string }>,
    operations: [] as Array<
      Stamp & { operation: string; outcome: 'completed' | 'failed'; error?: string }
    >,
    failure: null as (Stamp & { error: string }) | null,
    pausedStack: null as Array<{ functionName: string; url: string; lineNumber: number }> | null,
    disposed: false,
  };
  const scripts = new Map<string, string>();
  let initialized: Promise<void> | undefined;
  let collection: Promise<ReturnType<typeof receipt>> | undefined;
  let disposal: Promise<void> | undefined;
  let debuggerAttempted = false;
  let pauseRequested = false;
  let waitingForPause: (() => void) | undefined;
  let lateResume: Promise<boolean> | undefined;
  const receipt = () => structuredClone(state);

  const operation = async (name: string, work: () => Promise<unknown>) => {
    const started = stamp();
    try {
      await deadline(name, work, timeoutMs);
      if (state.operations.length < 40)
        state.operations.push({ ...started, operation: name, outcome: 'completed' });
      return true;
    } catch (error) {
      if (state.operations.length < 40)
        state.operations.push({
          ...started,
          operation: name,
          outcome: 'failed',
          error: String(error).slice(0, 4000),
        });
      return false;
    }
  };
  const onConsole = (message: ConsoleMessage) => {
    if (state.inputEvents.length >= 60) return;
    const text = message.text();
    if (!text.startsWith(INPUT_PREFIX) || text.length > 2000) return;
    try {
      const input = inputFact(JSON.parse(text.slice(INPUT_PREFIX.length)));
      if (input) state.inputEvents.push({ ...stamp(), input });
    } catch {
      /* Malformed console output is not a diagnostic observation. */
    }
  };
  const onPageError = (error: Error) => {
    if (state.pageErrors.length < 20)
      state.pageErrors.push({ ...stamp(), error: String(error).slice(0, 4000) });
  };
  const onScript = (event: { scriptId: string; url: string }) => {
    if (scripts.size < 2000) scripts.set(event.scriptId, event.url.slice(0, 2048));
  };
  const onPaused = (event: PausedEvent) => {
    if (pauseRequested && !state.pausedStack) {
      state.pausedStack = event.callFrames.slice(0, 40).map((frame) => ({
        functionName: frame.functionName.slice(0, 256),
        url: (frame.url || scripts.get(frame.location.scriptId) || '').slice(0, 2048),
        // CDP line numbers are zero-based; retain that protocol convention.
        lineNumber: frame.location.lineNumber,
      }));
    }
    if (waitingForPause) waitingForPause();
    else if (!lateResume)
      lateResume = operation('late-pause-resume', () => cdp.send('Debugger.resume'));
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  cdp.on('Debugger.scriptParsed', onScript);
  cdp.on('Debugger.paused', onPaused);

  return {
    /** Call after navigation and before the first real public interaction. */
    init(): Promise<void> {
      if (state.disposed) return Promise.resolve();
      return (initialized ??= (async () => {
        debuggerAttempted = true;
        await operation('debugger-enable', () => cdp.send('Debugger.enable'));
        await operation('passive-input-probe', () => page.evaluate(`(${inputProbe.toString()})()`));
      })());
    },
    stage(next: Partial<LiquidToggleDiagnosticStage> & { stage: string }): void {
      if (state.disposed) return;
      current = { ...current, ...next };
      if (state.stages.length < 80) state.stages.push(stamp());
    },
    receipt,
    /** Never replaces or throws over the caller's original functional error. */
    collectFailure(error: unknown): Promise<ReturnType<typeof receipt>> {
      if (!state.failure) state.failure = { ...stamp(), error: String(error) };
      return (collection ??= (async () => {
        if (!state.disposed && debuggerAttempted) {
          pauseRequested = true;
          const paused = new Promise<void>((resolve) => {
            waitingForPause = resolve;
          });
          try {
            await operation('failure-pause-and-stack', async () => {
              await cdp.send('Debugger.pause');
              await paused;
            });
          } finally {
            waitingForPause = undefined;
            // Attempt even if pause acknowledgement/event never arrived.
            await operation('failure-resume', () => cdp.send('Debugger.resume'));
          }
        }
        return receipt();
      })());
    },
    dispose(): Promise<void> {
      return (disposal ??= (async () => {
        if (collection) await collection;
        if (debuggerAttempted) {
          if (pauseRequested) await operation('dispose-resume', () => cdp.send('Debugger.resume'));
          await operation('debugger-disable', () => cdp.send('Debugger.disable'));
        }
        if (lateResume) await lateResume;
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
        cdp.off('Debugger.scriptParsed', onScript);
        cdp.off('Debugger.paused', onPaused);
        scripts.clear();
        state.disposed = true;
      })());
    },
  };
}
