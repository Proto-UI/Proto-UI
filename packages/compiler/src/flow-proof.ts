import type { ExpressionIR, FunctionIR } from './ir';
import { objectFields, valueAlternatives } from './value-types';
import { OPERATION_RULES, type SemanticOperation } from './operations';

export interface FlowMark {
  calls: number;
  heap: number;
  cell: number;
}

export interface FlowSnapshot {
  readonly calls: number;
  readonly heap: number;
  readonly cells: ReadonlyMap<string, number>;
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

/** A known synchronous read-only body cannot invalidate its caller's observations. */
export function functionCanMutateFlow(
  fn: FunctionIR | undefined,
  args: readonly ExpressionIR[]
): boolean {
  if (!fn) return true;
  const inspect = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(inspect);
    const node = value as Record<string, unknown>;
    if (node.kind === 'function') return false;
    if (
      [
        'call',
        'helper-call',
        'authored-hook',
        'lexical-write',
        'lexical-update',
        'member-write',
      ].includes(String(node.kind))
    )
      return true;
    if (
      node.kind === 'intrinsic' &&
      ['array.every', 'object.assign', 'string'].includes(String(node.name))
    )
      return true;
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
  return (
    inspect(fn.body) ||
    fn.parameters.some(
      (parameter, index) =>
        parameter.default &&
        (!args[index] || valueAlternatives(args[index].type).includes('void')) &&
        inspect(parameter.default)
    )
  );
}

/** Per-function observations; mutually exclusive branches have distinct effect histories. */
export class FlowProof {
  private calls = 0;
  private heap = 0;
  private readonly cells = new Map<string, number>();
  private readonly observations = new WeakMap<object, FlowMark>();
  constructor(private readonly writtenFields: ReadonlySet<string>) {}

  snapshot(): FlowSnapshot {
    return { calls: this.calls, heap: this.heap, cells: new Map(this.cells) };
  }
  restore(snapshot: FlowSnapshot): void {
    this.calls = snapshot.calls;
    this.heap = snapshot.heap;
    this.cells.clear();
    for (const [key, value] of snapshot.cells) this.cells.set(key, value);
  }
  /** Conservatively account for effects on either continuing alternative. */
  join(base: FlowSnapshot, a: FlowSnapshot, b: FlowSnapshot): void {
    this.calls = a.calls + b.calls - base.calls;
    this.heap = a.heap + b.heap - base.heap;
    this.cells.clear();
    for (const key of new Set([...base.cells.keys(), ...a.cells.keys(), ...b.cells.keys()]))
      this.cells.set(
        key,
        (a.cells.get(key) ?? 0) + (b.cells.get(key) ?? 0) - (base.cells.get(key) ?? 0)
      );
  }

  mark(key: string): FlowMark {
    return { calls: this.calls, heap: this.heap, cell: this.cells.get(key) ?? 0 };
  }
  call(): void {
    this.calls++;
    this.heap++;
  }
  writeHeap(): void {
    this.heap++;
  }
  writeCell(key: string): void {
    this.cells.set(key, (this.cells.get(key) ?? 0) + 1);
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
    const mark = this.observations.get(from);
    if (mark) this.observations.set(to, mark);
  }
  current = (value: ExpressionIR): boolean => {
    const subject = this.subject(value),
      mark = this.observations.get(value);
    return (
      !subject ||
      !mark ||
      ((!subject.cell || !this.cellChanged(mark, subject.key)) &&
        (!subject.heap || !this.heapChanged(mark)))
    );
  };
}
