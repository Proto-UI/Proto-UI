import type { Behavior, ComponentIR } from './component-ir.ts';
import { checkBehavior, type BehaviorFacts } from './validation/behavior.ts';
import { checkDependencies } from './validation/dependencies.ts';
import { ComponentIRDiagnostic, reject } from './validation/diagnostic.ts';
import { findCycle, type References } from './validation/graph.ts';
import { checkSurface } from './validation/surface.ts';
import { indexUnit, type BodyDeclarations, type UnitDeclarations } from './validation/unit.ts';
import type { Declarations } from './validation/value.ts';

export { ComponentIRDiagnostic, unsupportedHostName } from './validation/diagnostic.ts';

function fromCallSite(
  diagnostic: ComponentIRDiagnostic,
  owner: string,
  callers: ReadonlyMap<string, string | undefined>
): ComponentIRDiagnostic {
  let caller = callers.get(owner);
  if (caller === undefined) return diagnostic;
  const path = [owner];
  while (caller !== undefined) {
    path.push(caller);
    caller = callers.get(caller);
  }
  return diagnostic.withCallPath(path.reverse());
}

function checkReachedBehavior(
  fn: Behavior,
  declarations: Declarations,
  callers: ReadonlyMap<string, string | undefined>
): BehaviorFacts {
  try {
    return checkBehavior(fn, declarations);
  } catch (error) {
    if (!(error instanceof ComponentIRDiagnostic) || error.code !== 'illegal-effect') throw error;
    throw fromCallSite(error, fn.binding.id, callers);
  }
}

function checkBody(
  declarations: BodyDeclarations, unit: UnitDeclarations, children: References
): ComponentIRDiagnostic | undefined {
  const { body, functions } = declarations;
  const surface = checkSurface(declarations, unit, children);
  const callers = new Map<string, string | undefined>();
  for (const binding of surface.view) callers.set(binding.fn, undefined);
  for (const field of body.fields) callers.set(field.init, undefined);
  for (const provider of body.provides) callers.set(provider.fn, undefined);
  for (const projection of body.projections) callers.set(projection.fn, undefined);
  for (const action of body.actions) callers.set(action.fn, undefined);

  // Function IDs are local to this body. Retain their actual caller for diagnostics.
  const facts = new Map<string, BehaviorFacts>();
  for (const key of callers.keys()) {
    const result = checkReachedBehavior(functions.get(key)!, declarations, callers);
    facts.set(key, result);
    for (const callee of result.calls.keys()) {
      if (!callers.has(callee)) callers.set(callee, key);
    }
  }
  for (const fn of body.behaviors) {
    if (!facts.has(fn.binding.id)) facts.set(fn.binding.id, checkBehavior(fn, declarations));
  }
  const dependencyMissing = checkDependencies(body, declarations, facts, callers.keys(), surface.view);
  if (dependencyMissing || surface.missing) return dependencyMissing ?? surface.missing;
  for (const fn of callers.keys()) {
    const unsupported = facts.get(fn)!.missing;
    if (unsupported) return fromCallSite(unsupported, fn, callers);
  }
  return undefined;
}

/** Admit the entire linked wire before either target constructs or writes an artifact. */
export function validateComponent(ir: ComponentIR): void {
  const unit = indexUnit(ir);
  const graph = new Map<string, References>();
  let missing: ComponentIRDiagnostic | undefined;
  // Every linked body has a public native binding and can be mounted independently.
  for (const [id, declarations] of unit.bodies) {
    const children: References = new Map();
    const unsupported = checkBody(declarations, unit, children);
    missing ??= unsupported;
    graph.set(id, children);
  }
  const cycle = findCycle(graph);
  if (cycle) {
    const parent = cycle.path[cycle.path.length - 2]!;
    const child = cycle.path[cycle.path.length - 1]!;
    reject('component-cycle', cycle.source,
      `The unconditional child invocation from ${JSON.stringify(parent)} to ${JSON.stringify(child)} closes the component cycle ${cycle.path.map((id) => JSON.stringify(id)).join(' -> ')}. Lowering this cyclic composition requires recursive child support.`,
      cycle.path);
  }
  if (missing) throw missing;
}
