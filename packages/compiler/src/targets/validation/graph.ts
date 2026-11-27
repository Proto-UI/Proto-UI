import type { SourceSpan } from '../component-ir.ts';

export type References = Map<string, SourceSpan>;

export interface Cycle {
  readonly path: readonly string[];
  readonly source: SourceSpan;
}

/** Return the first back edge and the actual cycle it closes. Only edges between
 * supplied nodes belong to this graph. CFG callers can restrict roots to entry. */
export function findCycle(
  graph: ReadonlyMap<string, References>,
  roots: Iterable<string> = graph.keys()
): Cycle | undefined {
  const done = new Set<string>();
  const active = new Map<string, number>();
  const stack: { id: string; edges: Iterator<[string, SourceSpan]> }[] = [];

  function enter(id: string, edges: References): void {
    active.set(id, stack.length);
    stack.push({ id, edges: edges.entries() });
  }

  for (const root of roots) {
    if (done.has(root)) continue;
    const first = graph.get(root);
    if (!first) continue;
    enter(root, first);
    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      const next = frame.edges.next();
      if (next.done) {
        done.add(frame.id);
        active.delete(frame.id);
        stack.pop();
        continue;
      }
      const [id, source] = next.value;
      const start = active.get(id);
      if (start !== undefined) return { path: [...stack.slice(start).map((item) => item.id), id], source };
      const children = graph.get(id);
      if (children && !done.has(id)) enter(id, children);
    }
  }
  return undefined;
}
