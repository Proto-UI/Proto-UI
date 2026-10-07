// Record caught renderer failures as well as uncaught page exceptions.
export function recordBrowserSignal(report, type, text) {
  report.browserSignals.push({ type, text });
  const expectedFallback =
    type === 'warning' &&
    text === 'liquidGL: WebGPU/WebGL not available – falling back to CSS backdrop-filter.';
  if (
    type === 'pageerror' ||
    type === 'error' ||
    (type === 'warning' &&
      !expectedFallback &&
      /liquidGL|shader|program link|device.*lost|context.*lost/i.test(text))
  )
    report.errors.push(`${type}: ${text}`);
}
