/** Public app-side composition. Calendar never acquires a Select dependency. */
export interface CalendarCaptionState<Value> {
  get(): Value;
  subscribe(listener: () => void): () => void;
}

export interface CalendarCaptionSource {
  month: CalendarCaptionState<string>;
  disabled: CalendarCaptionState<boolean>;
  /** True means a request was emitted, not that a controlled owner committed it. */
  requestMonth(month: string): boolean;
}

export interface CalendarCaptionControl {
  /** Supply the control's controlled value, preserving its other owner props. */
  setValue(value: string): void;
  setDisabled(disabled: boolean): void;
}

export interface CalendarCaptionTargets {
  month: CalendarCaptionControl;
  year: CalendarCaptionControl;
}

export interface CalendarCaptionBinding {
  /** Month option values are decimal 1–12 (zero-padding is also accepted). */
  requestMonth(value: string): boolean;
  /** Year option values are four-digit Gregorian years, including leading zeros. */
  requestYear(value: string): boolean;
  sync(): void;
  dispose(): void;
}

const splitMonth = (month: string) => /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);

/**
 * Bind any two controlled controls to Calendar's public exposed state/methods.
 * The application supplies option ranges and labels. Both controls always read
 * the canonical month; requests do not optimistically claim owner acceptance.
 * No DOM, clock, Select anatomy, or framework lifecycle is installed here.
 */
export function bindCalendarCaption(
  source: CalendarCaptionSource,
  targets: CalendarCaptionTargets
): CalendarCaptionBinding {
  let disposed = false;
  let syncing = false;
  let requesting = false;
  const subscriptions: Array<() => void> = [];

  function sync() {
    if (disposed || syncing) return;
    syncing = true;
    try {
      // Target setters may synchronously update an owner. Re-read the source
      // after each pass instead of treating subscription payloads as authority.
      let beforeMonth: string;
      let beforeDisabled: boolean;
      do {
        beforeMonth = source.month.get();
        beforeDisabled = source.disabled.get();
        const parts = splitMonth(beforeMonth);
        const disabled = beforeDisabled || !parts;
        targets.month.setDisabled(disabled);
        if (disposed) return;
        targets.year.setDisabled(disabled);
        if (disposed) return;
        targets.month.setValue(parts ? String(Number(parts[2])) : '');
        if (disposed) return;
        targets.year.setValue(parts?.[1] ?? '');
      } while (
        !disposed &&
        (source.month.get() !== beforeMonth || source.disabled.get() !== beforeDisabled)
      );
    } finally {
      syncing = false;
    }
  }

  function request(value: string, field: 'month' | 'year'): boolean {
    // A controlled target may echo a setter through its change callback. That
    // is synchronization, not a fresh user proposal; suppress recursive writes.
    if (disposed || syncing || requesting) return false;
    const current = source.month.get();
    const parts = splitMonth(current);
    const valid =
      typeof value === 'string' &&
      (field === 'month' ? /^(?:0?[1-9]|1[0-2])$/.test(value) : /^\d{4}$/.test(value));
    if (!parts || !valid || source.disabled.get()) {
      sync();
      return false;
    }
    const next =
      field === 'month' ? `${parts[1]}-${value.padStart(2, '0')}` : `${value}-${parts[2]}`;
    if (next === current) {
      sync();
      return false;
    }
    requesting = true;
    try {
      return source.requestMonth(next);
    } finally {
      requesting = false;
      // Refusals, synchronous acceptance, and pending asynchronous decisions
      // all restore from the same canonical source. Later commits subscribe in.
      sync();
    }
  }

  const binding: CalendarCaptionBinding = {
    requestMonth: (value) => request(value, 'month'),
    requestYear: (value) => request(value, 'year'),
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    },
  };
  try {
    subscriptions.push(source.month.subscribe(sync));
    subscriptions.push(source.disabled.subscribe(sync));
    sync();
  } catch (error) {
    binding.dispose();
    throw error;
  }
  return binding;
}
