import type { ExpressionIR, FunctionIR, PrototypeIR, SourceSpan, ValueType } from './ir';
import { arrayEveryCallbackParameters, objectFields, valueAlternatives } from './value-types';
import { OPERATION_RULES, type SemanticOperation } from './operations';
import { traceCallableDemand } from './callable-effects';

export interface FlowMark {
  calls: number;
  heap: number;
  cell: number;
}

/** Only executable checked nodes participate; retained source and type views do not. */
export function writtenMemberFields(value: unknown): ReadonlySet<string> {
  const fields = new Set<string>();
  const visited = new Set<object>();
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.kind === 'member-write' && typeof node.property === 'string')
      fields.add(node.property);
    if (node.kind === 'intrinsic' && node.name === 'object.assign' && Array.isArray(node.arguments))
      for (const source of node.arguments.slice(1) as ExpressionIR[])
        if (source?.kind === 'record' && Array.isArray(source.entries))
          for (const entry of source.entries)
            if (typeof entry?.key === 'string') fields.add(entry.key);
    for (const [key, child] of Object.entries(node))
      if (!['type', 'span', 'sourceFiles', 'captures'].includes(key)) inspect(child);
  };
  inspect(value);
  return fields;
}

type FlowFunctions = FunctionIR | readonly FunctionIR[];
type FlowFunctionResolver = (call: ExpressionIR) => FlowFunctions | undefined;
const readonlyTraversal = new Set([
  'array.every',
  'array.some',
  'array.filter',
  'array.find',
  'array.findIndex',
  'array.map',
  'array.flatMap',
  'array.forEach',
  'array.reduce',
]);
function scalarCoercion(type: ValueType): boolean {
  return valueAlternatives(type).every((member) =>
    typeof member === 'string'
      ? ['string', 'number', 'boolean', 'null', 'void'].includes(member)
      : member.kind === 'literal'
  );
}

/** A known synchronous read-only body cannot invalidate its caller's observations.
 * Unknown targets, recursive argument changes and writes outside local cells
 * remain conservative. Callable types or member spellings never prove purity. */
export function functionCanMutateFlow(
  fn: FlowFunctions | undefined,
  args: readonly ExpressionIR[],
  resolve?: FlowFunctionResolver,
  active = new Set<FunctionIR>()
): boolean {
  if (!fn) return true;
  if (Array.isArray(fn))
    return !fn.length || fn.some((target) => functionCanMutateFlow(target, args, resolve, active));
  const body = fn as FunctionIR;
  if (active.has(body)) return true;
  fn = body;
  active.add(fn);
  const localCells = new Set<string>();
  const localFunctions = new Map<string, FunctionIR>();
  const declarationKey = (value: { name: string; bindingId?: string }) =>
    value.bindingId ?? value.name;
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.kind === 'function') return;
    if (node.kind === 'const' && node.value && typeof node.value === 'object') {
      const value = node.value as ExpressionIR;
      if (value.kind === 'lexical-cell')
        localCells.add(declarationKey(node as unknown as { name: string; bindingId?: string }));
      if (value.kind === 'function') {
        localFunctions.set(String(node.bindingId ?? node.name), value.function);
        return;
      }
    }
    for (const [key, child] of Object.entries(node))
      if (!['type', 'span', 'captures'].includes(key)) collect(child);
  };
  collect(fn.body);
  const resolveCallable = (callee: ExpressionIR): FlowFunctions | undefined => {
    if (callee.kind === 'function') return callee.function;
    if (callee.kind !== 'reference') return undefined;
    const local = localFunctions.get(declarationKey(callee));
    if (local) return local;
    const index = fn.parameters.findIndex(
      (parameter) => declarationKey(parameter) === declarationKey(callee)
    );
    if (index >= 0 && args[index]?.kind === 'function')
      return (args[index] as Extract<ExpressionIR, { kind: 'function' }>).function;
    return undefined;
  };
  const resolveCall: FlowFunctionResolver = (call) => {
    // A complete store proof takes precedence over lexical conveniences. An
    // explicit empty set means unresolved/foreign, not "try a same-name local".
    const proven = resolve?.(call);
    if (proven !== undefined) return proven;
    if (call.kind === 'call') {
      const known = resolveCallable(call.callee);
      if (known) return known;
    }
    return undefined;
  };
  const inspect = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(inspect);
    const node = value as Record<string, unknown>;
    if (node.kind === 'function') return false;
    if (node.kind === 'call' || node.kind === 'helper-call') {
      const call = node as unknown as Extract<ExpressionIR, { kind: 'call' | 'helper-call' }>;
      return (
        (call.kind === 'call' && inspect(call.callee)) ||
        call.arguments.some(inspect) ||
        functionCanMutateFlow(resolveCall(call), call.arguments, resolveCall, active)
      );
    }
    if (node.kind === 'lexical-write' || node.kind === 'lexical-update') {
      const cell = node.cell as ExpressionIR;
      if (cell.kind === 'reference' && localCells.has(declarationKey(cell)))
        return node.value !== undefined && inspect(node.value);
      return true;
    }
    if (['authored-hook', 'member-write'].includes(String(node.kind))) return true;
    if (node.kind === 'intrinsic') {
      const intrinsic = node as unknown as Extract<ExpressionIR, { kind: 'intrinsic' }>;
      if (intrinsic.arguments.some(inspect)) return true;
      if (readonlyTraversal.has(intrinsic.name)) {
        const callback = intrinsic.arguments[1];
        if (!callback || !intrinsic.arguments[0]) return true;
        let parameters: ReturnType<typeof arrayEveryCallbackParameters>;
        try {
          parameters = arrayEveryCallbackParameters(intrinsic.arguments[0].type);
          if (intrinsic.name === 'array.reduce') {
            const accumulator = intrinsic.arguments[2]?.type ?? parameters[0].type;
            parameters = [{ name: 'accumulator', type: accumulator }, ...parameters];
          }
        } catch {
          return true;
        }
        // Analysis-only operands retain whether defaults can run. They are not
        // executable IR and never supply callable provenance for an element.
        const callbackArgs: ExpressionIR[] = parameters.map((parameter, index) => ({
          kind: 'reference',
          name: `<traversal:${index}>`,
          type: parameter.type,
          span: intrinsic.span,
        }));
        return functionCanMutateFlow(
          resolve?.(intrinsic) ?? resolveCallable(callback),
          callbackArgs,
          resolveCall,
          active
        );
      }
      if (intrinsic.name === 'string' || intrinsic.name === 'number')
        return intrinsic.arguments.some((argument) => !scalarCoercion(argument.type));
      if (
        intrinsic.name === 'console.warn' ||
        intrinsic.name === 'object.assign' ||
        /^(array\.(push|shift|pop|sort)|set\.(add|delete|clear)|map\.(set|delete|clear))$/.test(
          intrinsic.name
        )
      )
        return true;
      return false;
    }
    if (
      node.kind === 'operation' &&
      OPERATION_RULES[node.operation as SemanticOperation]?.effects.some((effect) =>
        ['write', 'signal', 'request-update'].includes(effect.kind)
      )
    )
      return true;
    return Object.entries(node).some(
      ([key, child]) => !['type', 'span', 'captures'].includes(key) && inspect(child)
    );
  };
  const mutates =
    inspect(fn.body) ||
    fn.parameters.some(
      (parameter, index) =>
        parameter.default &&
        (!args[index] || valueAlternatives(args[index].type).includes('void')) &&
        inspect(parameter.default)
    );
  active.delete(fn);
  return mutates;
}

/** Source identity is stable across candidate and strict lowering. Call sites
 * sharing a span (including generic specializations) must all earn the proof. */
export function callSiteKey(span: SourceSpan): string {
  return JSON.stringify([span.file, span.start, span.end]);
}

/** Recompute closed invocation facts from actual declaration/argument stores.
 * This consumes no parser-provided purity flag or retained source annotation. */
export function deriveReadonlyCallSites(ir: PrototypeIR): ReadonlySet<string> {
  type Site = { closed: boolean; targets: Set<FunctionIR> };
  const sites = new Map<ExpressionIR, Site>();
  let complete = true;
  const observe = (
    value: ExpressionIR,
    provenance: { closed: boolean; external: boolean; authored: readonly FunctionIR[] }
  ) => {
    let site = sites.get(value);
    if (!site) sites.set(value, (site = { closed: true, targets: new Set() }));
    site.closed &&= provenance.closed && !provenance.external;
    for (const fn of provenance.authored) site.targets.add(fn);
  };
  try {
    traceCallableDemand(ir, {
      expression() {},
      function() {},
      hook() {},
      opaque(reason) {
        if (reason !== 'recursive-call') complete = false;
      },
      call: observe,
      traversal: observe,
    });
  } catch {
    return new Set();
  }
  if (!complete) return new Set();
  const helpers = new Map<string, FunctionIR>();
  for (const binding of ir.moduleBindings ?? [])
    if (binding.kind === 'const' && binding.value.kind === 'function')
      helpers.set(binding.name, binding.value.function);
  const resolve: FlowFunctionResolver = (value) => {
    if (value.kind === 'helper-call') return helpers.get(value.name);
    const site = sites.get(value);
    return site?.closed && site.targets.size ? [...site.targets] : [];
  };
  const result = new Set<string>(),
    rejected = new Set<string>();
  for (const [value, site] of sites) {
    if (value.kind !== 'call') continue;
    const key = callSiteKey(value.span);
    if (
      !site.closed ||
      !site.targets.size ||
      functionCanMutateFlow([...site.targets], value.arguments, resolve)
    )
      rejected.add(key);
    else result.add(key);
  }
  for (const key of rejected) result.delete(key);
  return result;
}

/** Per-function observations. Branch maps share effects; nested function creation does not. */
export class FlowProof {
  private calls = 0;
  private heap = 0;
  private readonly cells = new Map<string, number>();
  private readonly observations = new WeakMap<object, FlowMark>();
  constructor(
    private readonly writtenFields: ReadonlySet<string>,
    private readonly clock = { next: 0 },
    private readonly parent?: FlowProof
  ) {}

  /** Alternative branches inherit observations without sharing mutable clocks. */
  fork(): FlowProof {
    const branch = new FlowProof(this.writtenFields, this.clock, this);
    branch.calls = this.calls;
    branch.heap = this.heap;
    for (const [key, version] of this.cells) branch.cells.set(key, version);
    return branch;
  }
  /** Only normally continuing branches belong in this join. Unique versions
   * prevent a sibling write from accidentally matching another branch's mark. */
  join(branches: readonly FlowProof[]): FlowProof {
    const joined = this.fork();
    for (const branch of branches) {
      if (branch.clock !== this.clock) throw new Error('Cannot join unrelated flow proofs.');
      joined.calls = Math.max(joined.calls, branch.calls);
      joined.heap = Math.max(joined.heap, branch.heap);
      for (const [key, version] of branch.cells)
        joined.cells.set(key, Math.max(joined.cells.get(key) ?? 0, version));
    }
    return joined;
  }

  mark(key: string): FlowMark {
    return { calls: this.calls, heap: this.heap, cell: this.cells.get(key) ?? 0 };
  }
  call(): void {
    this.calls = this.heap = ++this.clock.next;
  }
  writeHeap(): void {
    this.heap = ++this.clock.next;
  }
  writeCell(key: string): void {
    this.cells.set(key, ++this.clock.next);
  }
  cellChanged(mark: FlowMark, key: string): boolean {
    return mark.calls !== this.calls || mark.cell !== (this.cells.get(key) ?? 0);
  }
  heapChanged(mark: FlowMark): boolean {
    return mark.heap !== this.heap;
  }

  private subject(value: ExpressionIR): { key: string; cell: boolean; heap: boolean } | undefined {
    if (value.kind === 'reference')
      return { key: value.bindingId ?? value.name, cell: false, heap: false };
    if (value.kind === 'lexical-read' && value.cell.kind === 'reference')
      return { key: value.cell.bindingId ?? value.cell.name, cell: true, heap: false };
    if (value.kind === 'member') {
      const root = this.subject(value.object);
      if (!root) return undefined;
      const mutable = valueAlternatives(value.object.type).some((type) => {
        const field = objectFields(type)?.find((field) => field.name === value.property);
        return field !== undefined && (!field.readonly || this.writtenFields.has(field.name));
      });
      return { ...root, heap: root.heap || mutable };
    }
    return undefined;
  }

  observe(value: ExpressionIR): void {
    const subject = this.subject(value);
    if (subject) this.observations.set(value, this.mark(subject.key));
  }
  copyObservation(from: object, to: object): void {
    const mark = this.observation(from);
    if (mark) this.observations.set(to, mark);
  }
  private observation(value: object): FlowMark | undefined {
    for (let proof: FlowProof | undefined = this; proof; proof = proof.parent) {
      const mark = proof.observations.get(value);
      if (mark) return mark;
    }
    return undefined;
  }
  current = (value: ExpressionIR): boolean => {
    const subject = this.subject(value),
      mark = this.observation(value);
    return (
      !subject ||
      !mark ||
      ((!subject.cell || !this.cellChanged(mark, subject.key)) &&
        (!subject.heap || !this.heapChanged(mark)))
    );
  };
}
