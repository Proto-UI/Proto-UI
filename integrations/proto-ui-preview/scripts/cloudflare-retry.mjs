export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return 0;
  const trimmed = value.trim();
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) {
    return Math.max(0, Math.ceil(Number(trimmed) * 1000));
  }
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export function boundedRetryDelay(attempt, minimum, deadline, now = Date.now()) {
  const exponential = Math.min(8_000, 500 * 2 ** (attempt - 1));
  const remaining = Math.max(0, deadline - now);
  return Math.min(Math.max(minimum, exponential), remaining);
}
