import ts from 'typescript';
import type {
  Binding,
  Block,
  Edge,
  Instruction,
  Terminator,
  Value,
  ValueType,
} from '../targets/component-ir.ts';
import { requireDomain } from './behavior-types.ts';
import type { SourceContext } from './source.ts';

interface Incoming {
  readonly from: DraftBlock;
  readonly args: Value[];
}
interface DraftBlock {
  readonly id: string;
  readonly origin: ts.Node;
  readonly params: Binding[];
  readonly instructions: Instruction[];
  readonly incoming: Incoming[];
  readonly imports: Map<Slot, Binding>;
  end?: Terminator;
}
interface Slot {
  readonly block: DraftBlock;
  readonly binding: Binding;
  readonly literalText?: string;
}
export type Operand = { type: ValueType; value: Value } | { type: ValueType; slot: Slot };

export function knownText(operand: Operand): string | undefined {
  return 'slot' in operand
    ? operand.slot.literalText
    : operand.value.kind === 'text'
      ? operand.value.value
      : undefined;
}

/** Locals in the receiver have block scope. Thread the original immutable value
 * along its actual predecessor edges only when a later block references it. */
export class BehaviorFlow {
  private readonly source: SourceContext;
  private readonly owner: Binding;
  private readonly blocks: DraftBlock[] = [];
  private current: DraftBlock;
  readonly entry: string;

  constructor(source: SourceContext, owner: Binding, origin: ts.Node) {
    this.source = source;
    this.owner = owner;
    this.current = this.block(origin, 'entry');
    this.entry = this.current.id;
  }

  binding(node: ts.Node, role: string, name: string, type: ValueType): Binding {
    return this.source.binding(node, JSON.stringify(['behavior', this.owner.id, role]), name, type);
  }

  private block(node: ts.Node, role: string): DraftBlock {
    const block: DraftBlock = {
      id: this.binding(node, `block/${role}`, role, 'unit').id,
      origin: node,
      params: [],
      instructions: [],
      incoming: [],
      imports: new Map(),
    };
    this.blocks.push(block);
    return block;
  }

  private edge(from: DraftBlock, to: DraftBlock, args: Value[] = []): Edge {
    to.incoming.push({ from, args });
    return { block: to.id, args };
  }

  private readIn(slot: Slot, block: DraftBlock): Value {
    if (slot.block === block) return { kind: 'local', id: slot.binding.id };
    let param = block.imports.get(slot);
    if (!param) {
      if (!block.incoming.length) {
        return this.source.missing(
          block.origin,
          'producer/local-dominance',
          'This lexical value is unavailable on an incoming control-flow path.'
        );
      }
      param = this.binding(
        block.origin,
        JSON.stringify(['incoming', block.id, slot.binding.id]),
        slot.binding.name,
        slot.binding.type
      );
      block.imports.set(slot, param);
      block.params.push(param);
      for (const incoming of block.incoming) incoming.args.push(this.readIn(slot, incoming.from));
    }
    return { kind: 'local', id: param.id };
  }

  value(operand: Operand): Value {
    return 'slot' in operand ? this.readIn(operand.slot, this.current) : operand.value;
  }

  define(node: ts.Node, binding: Binding, operand: Operand): Operand {
    requireDomain(this.source, node, operand.type, binding.type);
    this.current.instructions.push({
      kind: 'let',
      source: this.source.span(node),
      binding,
      value: this.value(operand),
    });
    const text = knownText(operand);
    return {
      type: binding.type,
      slot: { block: this.current, binding, ...(text === undefined ? {} : { literalText: text }) },
    };
  }

  /** Snapshot a computed operand before lowering a later sibling. The later
   * expression may split control flow, and its evaluation follows this one. */
  retain(node: ts.Node, operand: Operand): Operand {
    if ('slot' in operand) return operand;
    switch (operand.value.kind) {
      case 'bool':
      case 'number':
      case 'text':
      case 'tokens':
      case 'local':
        return operand;
      default:
        return this.define(node, this.binding(node, 'operand', 'value', operand.type), operand);
    }
  }

  instruction(op: Instruction): void {
    this.current.instructions.push(op);
  }
  terminate(end: Terminator): void {
    this.current.end = end;
  }
  get terminated(): boolean {
    return this.current.end !== undefined;
  }

  private fork(node: ts.Node, condition: Operand): [DraftBlock, DraftBlock] {
    requireDomain(this.source, node, condition.type, 'bool');
    const yes = this.block(node, 'yes');
    const no = this.block(node, 'no');
    this.terminate({
      kind: 'branch',
      source: this.source.span(node),
      condition: this.value(condition),
      yes: this.edge(this.current, yes),
      no: this.edge(this.current, no),
    });
    return [yes, no];
  }

  private jump(from: DraftBlock, to: DraftBlock, origin: ts.Node, args?: Value[]): void {
    from.end = { kind: 'jump', source: this.source.span(origin), to: this.edge(from, to, args) };
  }

  branch(
    node: ts.IfStatement | ts.ConditionalExpression,
    condition: Operand,
    thenBody: () => void,
    elseBody: () => void
  ): void {
    const [yes, no] = this.fork(node, condition);
    this.current = yes;
    thenBody();
    const yesExit = this.current;
    this.current = no;
    elseBody();
    if (yesExit.end) return;
    if (this.current.end) {
      this.current = yesExit;
      return;
    }
    const join = this.block(node, 'continue');
    this.jump(yesExit, join, ts.isIfStatement(node) ? node.thenStatement : node.whenTrue);
    this.jump(
      this.current,
      join,
      ts.isIfStatement(node) ? (node.elseStatement ?? node) : node.whenFalse
    );
    this.current = join;
  }

  choose(
    node: ts.ConditionalExpression,
    condition: Operand,
    arm: (expression: ts.Expression) => Operand
  ): Operand {
    const [yes, no] = this.fork(node, condition);
    this.current = yes;
    const left = arm(node.whenTrue);
    const leftValue = this.value(left);
    const leftExit = this.current;
    this.current = no;
    const right = arm(node.whenFalse);
    requireDomain(this.source, node.whenFalse, right.type, left.type);
    const rightValue = this.value(right);
    const join = this.block(node, 'result');
    const binding = this.binding(node, 'result-value', 'result', left.type);
    join.params.push(binding);
    this.jump(leftExit, join, node.whenTrue, [leftValue]);
    this.jump(this.current, join, node.whenFalse, [rightValue]);
    this.current = join;
    return { type: binding.type, slot: { block: join, binding } };
  }

  finish(): readonly Block[] {
    return this.blocks.map(({ id, params, instructions, end }) => {
      if (!end) throw new Error(`Unterminated behavior block ${id}.`);
      return { id, params, instructions, end };
    });
  }
}
