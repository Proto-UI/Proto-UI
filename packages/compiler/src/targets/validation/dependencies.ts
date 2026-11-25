import type { ComponentIR, SourceSpan } from '../component-ir.ts';
import { viewBindings } from '../view.ts';
import type { BehaviorFacts } from './behavior.ts';
import { reject } from './diagnostic.ts';
import { findCycle, type Cycle, type References } from './graph.ts';
import { resolve } from './structure.ts';
import type { Declarations } from './value.ts';

interface ReadSite {
  readonly source: SourceSpan;
  readonly via?: string;
}

type Reads = Map<string, Map<string, ReadSite>>;

/** Propagate actual reads along reverse call edges. Invalidation declarations may
 * overapproximate a function and are never evidence that an initializer reads a field. */
function actualReads(facts: ReadonlyMap<string, BehaviorFacts>): Reads {
  const reads: Reads = new Map();
  const callers = new Map<string, References>();
  const pending: { fn: string; field: string }[] = [];
  for (const [fn, body] of facts) {
    const local = new Map<string, ReadSite>();
    reads.set(fn, local);
    for (const [field, source] of body.reads) {
      local.set(field, { source });
      pending.push({ fn, field });
    }
    for (const [callee, source] of body.calls) {
      let incoming = callers.get(callee);
      if (!incoming) {
        incoming = new Map();
        callers.set(callee, incoming);
      }
      incoming.set(fn, source);
    }
  }
  while (pending.length) {
    const { fn, field } = pending.pop()!;
    const incoming = callers.get(fn);
    if (!incoming) continue;
    for (const [caller, source] of incoming) {
      const local = reads.get(caller)!;
      if (local.has(field)) continue;
      local.set(field, { source, via: fn });
      pending.push({ fn: caller, field });
    }
  }
  return reads;
}

function readPath(reads: Reads, fn: string, field: string): string[] {
  const path = [fn];
  let next = reads.get(fn)!.get(field)!.via;
  while (next !== undefined) {
    path.push(next);
    next = reads.get(next)!.get(field)!.via;
  }
  path.push(field);
  return path;
}

/** Find a concrete cycle through this particular derivation. Checking for a
 * path back to its binding distinguishes a recursive helper it merely calls. */
function cycleThrough(graph: ReadonlyMap<string, References>, root: string): Cycle | undefined {
  const parents = new Map<string, string | undefined>([[root, undefined]]);
  for (const caller of parents.keys()) {
    for (const [callee, source] of graph.get(caller)!) {
      if (callee === root) {
        const path = [root];
        let node: string | undefined = caller;
        while (node !== undefined) {
          path.push(node);
          node = parents.get(node);
        }
        return { path: path.reverse(), source };
      }
      if (!parents.has(callee)) parents.set(callee, caller);
    }
  }
  return undefined;
}

function describePath(path: readonly string[], declarations: Declarations): string {
  return path
    .map((key) => {
      const binding =
        declarations.functions.get(key)?.binding ?? declarations.values.get(key)?.binding;
      return binding && binding.name !== key
        ? `${JSON.stringify(binding.name)} (${JSON.stringify(key)})`
        : JSON.stringify(key);
    })
    .join(' -> ');
}

export function checkDependencies(
  ir: ComponentIR,
  declarations: Declarations,
  facts: ReadonlyMap<string, BehaviorFacts>,
  reached: Iterable<string>
): void {
  const declared = new Map<string, Set<string>>();
  const calls = new Map<string, References>();
  for (const fn of ir.behaviors) {
    const dependencies = new Set<string>();
    for (const dep of fn.dependencies) {
      resolve(
        declarations.values,
        dep,
        'Declared read dependency',
        fn.binding.source,
        fn.binding.id
      );
      if (dependencies.has(dep)) {
        reject(
          'duplicate-binding',
          fn.binding.source,
          `The dependency summary repeats ${JSON.stringify(dep)}. List each read binding once.`,
          [fn.binding.id, dep]
        );
      }
      dependencies.add(dep);
    }
    declared.set(fn.binding.id, dependencies);
    calls.set(fn.binding.id, facts.get(fn.binding.id)!.calls);
  }
  const recursion = findCycle(calls, reached);
  if (recursion) {
    const derived = new Set(ir.projections.map((projection) => projection.fn));
    for (const binding of viewBindings(ir.view)) {
      if (binding.role !== 'activate') derived.add(binding.fn);
    }
    // The usual acyclic path requires only the linear graph walk above. For an
    // error, prefer the cycle through a known derivation even when the first
    // DFS back edge belongs to some other ordinary recursive helper.
    const hit = recursion.path.find((key) => derived.has(key));
    let cycle = hit !== undefined ? recursion : undefined;
    for (const root of derived) {
      if (cycle) break;
      cycle = cycleThrough(calls, root);
    }
    if (cycle) {
      reject(
        'derived-cycle',
        cycle.source,
        `Pure derivation dependency cycle ${describePath(cycle.path, declarations)}. Remove the circular read or express intentional feedback through an action.`,
        cycle.path
      );
    }
  }

  const reads = actualReads(facts);
  const available = new Set(ir.props.map((prop) => prop.id));
  for (const field of ir.fields) {
    for (const [key, site] of reads.get(field.init)!) {
      if (available.has(key)) continue;
      const path = [field.binding.id, ...readPath(reads, field.init, key)];
      reject(
        'initialization-order',
        site.source,
        `Initializer reads a field before it is initialized (${describePath(path, declarations)}). Initialize its source field first.`,
        path
      );
    }
    available.add(field.binding.id);
  }
  for (const [fn, fields] of reads) {
    const dependencies = declared.get(fn)!;
    for (const [field, site] of fields) {
      if (dependencies.has(field)) continue;
      const path = readPath(reads, fn, field);
      reject(
        'dependency-missing',
        site.source,
        `The dependency summary for ${JSON.stringify(fn)} omits the read ${describePath(path, declarations)}. Include ${JSON.stringify(field)} in its declared dependencies.`,
        path
      );
    }
  }
  if (recursion) {
    reject(
      'recursive-helper',
      recursion.source,
      `Lowering the ordinary recursive helper chain ${describePath(recursion.path, declarations)} requires recursive-call support in this target slice.`,
      recursion.path
    );
  }
}
