import type { Behavior, ComponentIR, ExternIR, SourceSpan } from './component-ir.ts';
import { checkBehavior, type BehaviorFacts } from './validation/behavior.ts';
import { checkDependencies } from './validation/dependencies.ts';
import { ComponentIRDiagnostic, reject } from './validation/diagnostic.ts';
import { findCycle, type References } from './validation/graph.ts';
import { checkSurface } from './validation/surface.ts';
import { indexUnit, type BodyDeclarations, type UnitDeclarations } from './validation/unit.ts';
import type { Declarations } from './validation/value.ts';

export { ComponentIRDiagnostic, unsupportedHostName } from './validation/diagnostic.ts';
export {
  GeneratedVerificationError,
  verifyGenerated,
  type GeneratedFinding,
  type GeneratedFindingKind,
  type GeneratedVerification,
} from './validation/generated.ts';
import { GeneratedVerificationError, verifyGenerated } from './validation/generated.ts';

export interface ValidateOptions {
  /**
   * Run the read-only Stage 1 structural verification for generated compositions.
   * A control with no observable consequence on any path rejects the unit; other
   * findings are available from verifyGenerated. Off by default.
   */
  readonly verifyGenerated?: boolean;
}

export interface ReachedExtern {
  readonly extern: ExternIR;
  readonly source: SourceSpan;
  readonly callPath: readonly string[];
}

function callPath(owner: string, callers: ReadonlyMap<string, string | undefined>): string[] {
  const path = [owner];
  let caller = callers.get(owner);
  while (caller !== undefined) {
    path.push(caller);
    caller = callers.get(caller);
  }
  return path.reverse();
}

function fromCallSite(
  diagnostic: ComponentIRDiagnostic,
  owner: string,
  callers: ReadonlyMap<string, string | undefined>
): ComponentIRDiagnostic {
  return callers.get(owner) === undefined ? diagnostic : diagnostic.withCallPath(callPath(owner, callers));
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
  declarations: BodyDeclarations, unit: UnitDeclarations, children: References, reached: Map<string, ReachedExtern>
): ComponentIRDiagnostic | undefined {
  const { body, functions } = declarations;
  const surface = checkSurface(declarations, unit, children);
  const callers = new Map<string, string | undefined>();
  for (const created of body.created) callers.set(created, undefined);
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
    // A start reaches the owned task without adding its future reads to this segment.
    for (const task of result.starts.keys()) {
      if (!callers.has(task)) callers.set(task, key);
    }
    for (const [id, source] of result.awaits) {
      if (!reached.has(id)) {
        reached.set(id, { extern: declarations.externs.get(id)!, source, callPath: [body.id, ...callPath(key, callers), id] });
      }
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

/** Admit the entire linked wire and identify the target bindings required by its public roots. */
export function validateComponent(ir: ComponentIR, options: ValidateOptions = {}): readonly ReachedExtern[] {
  const unit = indexUnit(ir);
  const graph = new Map<string, References>();
  const reached = new Map<string, ReachedExtern>();
  let missing: ComponentIRDiagnostic | undefined;
  // Every linked body has a public native binding and can be mounted independently.
  for (const [id, declarations] of unit.bodies) {
    const children: References = new Map();
    const unsupported = checkBody(declarations, unit, children, reached);
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
  if (options.verifyGenerated) {
    const verification = verifyGenerated(ir);
    if (verification.rejected) throw new GeneratedVerificationError(verification.findings);
  }
  return [...reached.values()];
}
