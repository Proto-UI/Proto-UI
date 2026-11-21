/** Test-only browser init script. Keep it self-contained for Playwright serialization. */
export function installProminentTintPreferenceProbe() {
  const original = window.matchMedia.bind(window),
    records: { query: string; real: MediaQueryList; proxy: EventTarget }[] = [];
  let unknown: string | null = null;
  window.matchMedia = ((query: string) => {
    const real = original(query),
      proxy = new EventTarget() as EventTarget & Partial<MediaQueryList>;
    Object.defineProperties(proxy, {
      matches: {
        get: () => (unknown && query.startsWith(`(${unknown}:`) ? false : real.matches),
      },
      media: { get: () => real.media },
      onchange: { value: null, writable: true },
    });
    (proxy as any).addListener = (listener: EventListener) =>
      proxy.addEventListener('change', listener);
    (proxy as any).removeListener = (listener: EventListener) =>
      proxy.removeEventListener('change', listener);
    real.addEventListener('change', () => proxy.dispatchEvent(new Event('change')));
    records.push({ query, real, proxy });
    return proxy as MediaQueryList;
  }) as typeof window.matchMedia;
  (window as any).tintUnknownPreference = (value: string | null) => {
    const previous = unknown;
    const matches = (record: (typeof records)[number], feature: string | null) =>
      feature && record.query.startsWith(`(${feature}:`) ? false : record.real.matches;
    // Freeze both membership and the effective-value delta before notifying.
    // Resolution listeners re-register matchMedia and must never be triggered
    // by a synthetic preference transition. Restoring the previous feature is
    // part of the same delta, including a direct switch to another feature.
    const changed = [...records].filter(
      (record) => matches(record, previous) !== matches(record, value)
    );
    unknown = value;
    for (const record of changed) record.proxy.dispatchEvent(new Event('change'));
  };
}

export type TintRunnerFailure = { errors?: { message?: string; stack?: string }[] };
// Observation summaries precede context cleanup and the runner's outcome.
// They cannot truthfully advertise a terminal pass, even if their write succeeds.
export const PROMINENT_TINT_OBSERVATION_PROGRESS = {
  progress: 'observations-collected',
  terminal: false,
  outcomeAuthority: 'Vitest result and results.json coverage; this summary is not a verdict',
} as const;

export async function awaitProminentTintCheckpoint(
  name: string,
  checkpoint: () => Promise<void>,
  isRunning: () => boolean
) {
  await checkpoint();
  if (!isRunning()) throw new Error(`Prominent tint case ended during checkpoint: ${name}`);
}

export type TintCaseTransitions = {
  running(): Promise<void>;
  completed(): Promise<void>;
  failed(error: unknown): Promise<void>;
};
/** Reconcile runner timeouts, which race rather than reject the case body. */
export async function runProminentTintCase(
  run: () => Promise<void>,
  onFailed: (callback: (result: TintRunnerFailure) => Promise<void>) => void,
  transitions: TintCaseTransitions
) {
  let failed = false;
  const fail = async (error: unknown) => {
    if (failed) return;
    failed = true;
    await transitions.failed(error);
  };
  // Vitest's timeout races the test promise. It does not reject `run()`;
  // register before the first await and latch failure before persisting it.
  onFailed(({ errors }) =>
    fail(
      new Error(
        errors?.map((error) => error.stack ?? error.message).join('\n') ||
          'Native case failed in the test runner'
      )
    )
  );
  try {
    await transitions.running();
    if (failed) return;
    await run();
    if (!failed) await transitions.completed();
  } catch (error) {
    await fail(error);
    throw error;
  }
}

export type TintSyntheticCancelProbe = {
  target: {
    dispatchEvent(type: string, eventInit: Record<string, unknown>): Promise<void>;
  };
  mouse: {
    move(x: number, y: number): Promise<void>;
    up(): Promise<void>;
  };
  assertCancelled(): Promise<void>;
  assertReleasedOutside(): Promise<void>;
};

/** Test-only injected cancellation, not a browser/OS-generated pointer cancel.
 * DOM dispatch does not end Playwright's native held-button session. */
export async function runProminentTintSyntheticCancel(probe: TintSyntheticCancelProbe) {
  await probe.target.dispatchEvent('pointercancel', {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 0,
  });
  await probe.assertCancelled();
  // The native button is still down. Release away from its original target so
  // cleanup cannot generate an unrelated click after the synthetic cancel.
  await probe.mouse.move(0, 0);
  await probe.mouse.up();
  await probe.assertReleasedOutside();
}
