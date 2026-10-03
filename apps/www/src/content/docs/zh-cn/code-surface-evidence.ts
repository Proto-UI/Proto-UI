export type CodeSurfaceGenerationFacts = {
  view: string | null;
  runtime: string | null;
  family: string | null;
  surfaceCount: number;
  hosts: {
    generation: string | null;
    state: string | null;
    family: string | null;
    runtime: string | null;
    inert: boolean;
    ariaHidden: string | null;
    pointerEvents: string;
  }[];
};

export function codeSurfaceOwnershipIssues(facts: CodeSurfaceGenerationFacts): string[] {
  const issues: string[] = [];
  if (facts.hosts.filter((host) => host.state === 'active').length > 1)
    issues.push('Multiple active code generations');
  if (facts.hosts.some((host) => host.pointerEvents !== 'none'))
    issues.push('Passive code paint has pointer authority');
  if (
    facts.hosts.some(
      (host) => host.state !== 'active' && (!host.inert || host.ariaHidden !== 'true')
    )
  )
    issues.push('Uncommitted code generation is exposed');
  return issues;
}

export function codeSurfaceSettled(
  facts: CodeSurfaceGenerationFacts,
  runtime: string,
  family: string
): boolean {
  const [host] = facts.hosts;
  return (
    codeSurfaceOwnershipIssues(facts).length === 0 &&
    facts.view === 'ready' &&
    facts.runtime === runtime &&
    facts.family === family &&
    facts.surfaceCount === 1 &&
    facts.hosts.length === 1 &&
    host.state === 'active' &&
    host.runtime === runtime &&
    host.family === family &&
    Boolean(host.generation)
  );
}

export type NativeCodeSelectionGeometry = {
  token: { x: number; y: number; width: number; height: number };
  pre: { left: number; width: number; scrollLeft: number; scrollWidth: number };
};
/** One native wheel places the word away from the scroll edge before selection.
 * It does not choose the selected payload or retry a failed drag. */
export function nativeCodeSelectionScrollTarget(facts: NativeCodeSelectionGeometry): number {
  return Math.max(
    0,
    Math.min(
      facts.pre.scrollWidth - facts.pre.width,
      facts.pre.scrollLeft +
        facts.token.x +
        facts.token.width / 2 -
        (facts.pre.left + facts.pre.width / 2)
    )
  );
}
export function nativeCodeSelectionHasGutter(facts: NativeCodeSelectionGeometry): boolean {
  return (
    facts.token.x >= facts.pre.left + 16 &&
    facts.token.x + facts.token.width <= facts.pre.left + facts.pre.width - 16
  );
}
