/** Deterministic LCG sampling; report the seed with every generated journey. */
export function generateSequence<T>(seed: number, length: number, alphabet: readonly T[]): T[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Seed must be an unsigned 32-bit integer');
  if (!Number.isSafeInteger(length) || length < 0 || !alphabet.length)
    throw new Error('Sequence requires a nonnegative length and nonempty alphabet');
  let state = seed;
  return Array.from({ length }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return alphabet[Math.floor((state / 0x100000000) * alphabet.length)];
  });
}

/** Deterministic deletion shrinking. The caller decides whether the SAME failure persists. */
export async function minimizeSequence<T>(
  sequence: readonly T[],
  reproduces: (candidate: readonly T[]) => boolean | Promise<boolean>
): Promise<{ sequence: T[]; attempts: number }> {
  let current = [...sequence];
  let attempts = 1;
  if (!(await reproduces(current)))
    throw new Error('Initial sequence does not reproduce the reported failure');
  let chunk = Math.max(1, Math.floor(current.length / 2));
  while (current.length) {
    let changed = false;
    for (let start = 0; start < current.length; start += chunk) {
      const candidate = [...current.slice(0, start), ...current.slice(start + chunk)];
      attempts++;
      if (await reproduces(candidate)) {
        current = candidate;
        changed = true;
        break;
      }
    }
    if (changed) chunk = Math.max(1, Math.min(chunk, current.length));
    else if (chunk === 1) break;
    else chunk = Math.max(1, Math.floor(chunk / 2));
  }
  return { sequence: current, attempts };
}
