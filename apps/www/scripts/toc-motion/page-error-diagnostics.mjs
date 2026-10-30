/** Bounded diagnostics only; every observed page error remains a failed run. */
export function createPageErrorDiagnostics({ sanitize, fail, limit = 64, textLimit = 16384 }) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(textLimit) || textLimit < 1)
    throw new Error('Invalid page-error diagnostic bounds');
  const report = {
    limit,
    textLimit,
    total: 0,
    dropped: 0,
    entries: [],
    contextAssociation: 'same-page message FIFO; temporal diagnostic, not causal attribution',
  };
  const text = (value) => String(sanitize(String(value ?? ''))).slice(0, textLimit);
  const record = (error, context) => {
    report.total++;
    if (report.entries.length >= limit) {
      report.dropped++;
      if (report.dropped === 1)
        fail('pageerror: further diagnostics capped; see pageErrors.dropped');
      return null;
    }
    const entry = {
      sequence: report.total,
      name: text(error?.name),
      message: text(error?.message ?? error),
      stack: text(error?.stack),
      sourceHead: text(context.sourceHead),
      expectedHead: text(context.expectedHead),
      phase: text(context.phase),
      pageURL: text(context.pageURL),
      observedAtUTC: text(context.observedAtUTC),
      inputContext: null,
      inputContextError: null,
    };
    report.entries.push(entry);
    fail(`pageerror: ${entry.message}`);
    return entry;
  };
  const annotate = (entry, context) => {
    if (!entry || !report.entries.includes(entry)) return;
    entry.inputContext = {
      attribution: text(context?.attribution),
      browserDropped: Number.isInteger(context?.browserDropped) ? context.browserDropped : null,
      phase: text(context?.phase),
      route: text(context?.route),
      sourceURL: text(context?.sourceURL),
      line: Number.isFinite(context?.line) ? context.line : null,
      column: Number.isFinite(context?.column) ? context.column : null,
      lastTrustedInput: context?.lastTrustedInput
        ? {
            type: text(context.lastTrustedInput.type),
            key: text(context.lastTrustedInput.key),
            targetTag: text(context.lastTrustedInput.targetTag),
            timestamp: Number.isFinite(context.lastTrustedInput.timestamp)
              ? context.lastTrustedInput.timestamp
              : null,
          }
        : null,
    };
  };
  return {
    report,
    record,
    annotate,
    contextFailed: (entry, error) => {
      if (entry && report.entries.includes(entry))
        entry.inputContextError = text(error?.message ?? error);
    },
  };
}
