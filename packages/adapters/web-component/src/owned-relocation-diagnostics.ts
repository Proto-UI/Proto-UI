// Internal evidence recorder. No package export, author facade or callback hook.
// Disabled in normal use; the native evidence fixture alone enables this buffer.
type Fact = string | number | boolean | null;
type Entry = { sequence: number; time: number; capture: number; phase: string; fact?: Fact };
let entries: Entry[] | null = null;
let sequence = 0;
let captures = 0;
let phase = 'idle';
export function setOwnedRelocationDiagnostics(enabled: boolean): void {
  entries = enabled ? [] : null;
  sequence = 0;
  captures = 0;
  phase = 'idle';
}
export function recordOwnedRelocationDiagnostic(capture: number, event: string, fact?: Fact): void {
  if (!entries) return;
  entries.push({
    sequence: ++sequence,
    time: performance.now(),
    capture,
    phase: `${phase}:${event}`,
    fact,
  });
  if (entries.length > 2048) entries.shift();
}
export function beginOwnedRelocationDiagnostic(): number {
  return entries ? ++captures : 0;
}
export function setOwnedRelocationDiagnosticPhase(next: string): string {
  const previous = phase;
  if (entries) phase = next;
  return previous;
}
export function readOwnedRelocationDiagnostics() {
  return { phase, entries: entries?.map((entry) => ({ ...entry })) ?? [] };
}
