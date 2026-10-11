/** Dev-server dynamic import in demo-renderer, not a parser/defer script.
 * Keep navigation and the real Header bootstrap running while React projection
 * materialization waits. Unknown/bundled paths fail the held-request assertion. */
export function isQuickStartReactRuntime(url: string): boolean {
  return new URL(url).pathname.endsWith(
    '/src/components/PrototypePreviewer/runtimes/react-runtime.ts'
  );
}

export interface OwnershipTrace {
  kind: string;
  at: number;
  fragmentTarget?: string | null;
  menuReady?: boolean;
  active?: { tag: string };
  target?: { tag: string };
  applicationOwnership?: {
    focused: boolean;
    codeSame: boolean;
    textRetained: boolean;
    selectionSame: boolean;
  };
}

/** Classify the measured early-input boundary; never treats final focus loss
 * as a successful end-to-end ownership result. */
export function earlyOwnershipBoundaryIsNative(
  trace: OwnershipTrace[],
  owner: 'menu' | 'content-link'
): boolean {
  const dcl = trace.findIndex((event) => event.kind === 'DOMContentLoaded');
  if (dcl < 0) return false;
  const boundary = trace[dcl];
  const ownership = boundary.applicationOwnership;
  if (
    boundary.fragmentTarget !== null ||
    !boundary.menuReady ||
    !ownership ||
    !ownership.focused ||
    !ownership.codeSame ||
    !ownership.textRetained ||
    !ownership.selectionSame
  )
    return false;
  const before = trace.slice(0, dcl);
  const blurs = before.filter((event) => event.kind === 'focusout');
  if (owner === 'content-link' && blurs.length !== 0) return false;
  if (owner === 'menu') {
    if (blurs.length !== 1 || blurs[0].target?.tag !== 'summary') return false;
    const handoff = before
      .slice(before.indexOf(blurs[0]) + 1)
      .find((event) => event.kind === 'focusin');
    if (!handoff?.applicationOwnership?.focused) return false;
  }
  const after = trace.slice(dcl + 1);
  const firstBlur = after.findIndex((event) => event.kind === 'focusout');
  return (
    firstBlur >= 0 &&
    after[firstBlur].fragmentTarget === '_top' &&
    after[firstBlur].active?.tag === 'body' &&
    !after.slice(0, firstBlur + 1).some((event) => ['focus-call', 'blur-call'].includes(event.kind))
  );
}
