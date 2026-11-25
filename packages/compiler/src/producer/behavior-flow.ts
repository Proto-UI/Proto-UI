import ts from 'typescript';
import type {
  Binding,
  Block,
  Edge,
  Instruction,
  TaggedCase,
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
interface Refinement {
  readonly payload: Operand;
  readonly tag?: string;
}
interface DraftBlock {
  readonly id: string;
  readonly origin: ts.Node;
  readonly params: Binding[];
  readonly instructions: Instruction[];
  readonly incoming: Incoming[];
  readonly imports: Map<Slot, Binding>;
  /** Only a match on this exact immutable operand establishes a payload proof. */
  readonly payloads: Map<Operand, Refinement>;
  end?: Terminator;
}
interface Slot {
  readonly block: DraftBlock;
  readonly binding: Binding;
  readonly literalText?: string;
}
export type Operand = { type: ValueType; value: Value } | { type: ValueType; slot: Slot };

export interface PresenceTest {
  readonly subject: Operand;
  readonly payloadType: ValueType;
  readonly presentOnTrue: boolean;
}

export interface TagTest {
  readonly subject: Operand;
  readonly cases: readonly TaggedCase[];
  readonly tag: string;
  readonly presentOnTrue: boolean;
}

export type MatchTest = PresenceTest | TagTest;
export type Condition = Operand | MatchTest;

export interface SwitchDispatch {
  readonly tagged?: { readonly subject: Operand; readonly cases: readonly TaggedCase[]; readonly labels: ReadonlyMap<string, number> };
  readonly selector: Operand;
  readonly fallback: number;
  readonly tests: readonly { readonly index: number; readonly node: ts.CaseClause; readonly value: Value }[];
}

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
  private readonly switches: ((node: ts.BreakStatement) => void)[] = [];
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

  private block(node: ts.Node, role: string, payloads?: ReadonlyMap<Operand, Refinement>): DraftBlock {
    const block: DraftBlock = {
      id: this.binding(node, `block/${role}`, role, 'unit').id,
      origin: node,
      params: [],
      instructions: [],
      incoming: [],
      imports: new Map(),
      payloads: new Map(payloads),
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

  parameter(binding: Binding): Operand {
    return { type: binding.type, slot: { block: this.blocks[0]!, binding } };
  }

  suspend(node: ts.AwaitExpression, external: Binding, args: readonly Value[]): Operand {
    const next = this.block(node, 'resume', this.current.payloads);
    const result = this.binding(node, 'await-result', 'result', external.type);
    next.params.push(result);
    this.terminate({ kind: 'await', extern: external.id, args, resume: this.edge(this.current, next), source: this.source.span(node) });
    this.current = next;
    return { type: result.type, slot: { block: next, binding: result } };
  }

  refinement(subject: Operand): Refinement | undefined {
    return this.current.payloads.get(subject);
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
      case 'literal-text':
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

  private match(node: ts.Node, subject: Operand, cases: readonly TaggedCase[]): DraftBlock[] {
    const blocks = cases.map(({ tag, payload }) => {
      const block = this.block(node, JSON.stringify(['case', tag]), this.current.payloads);
      const binding = this.binding(node, JSON.stringify(['case-payload', tag]), 'payload', payload);
      block.params.push(binding);
      block.payloads.set(subject, { tag, payload: { type: payload, slot: { block, binding } } });
      return block;
    });
    this.terminate({ kind: 'match', value: this.value(subject), source: this.source.span(node),
      cases: cases.map(({ tag }, i) => ({ tag, to: this.edge(this.current, blocks[i]!) })) });
    return blocks;
  }

  private merge(node: ts.Node, role: string, blocks: readonly DraftBlock[]): DraftBlock {
    if (blocks.length === 1) return blocks[0]!;
    const merged = this.block(node, role, blocks[0]?.payloads);
    for (const [subject, payload] of merged.payloads) {
      if (blocks.some(block => block.payloads.get(subject) !== payload)) merged.payloads.delete(subject);
    }
    for (const block of blocks) this.jump(block, merged, node);
    return merged;
  }

  breakSwitch(node: ts.BreakStatement): void {
    const leave = this.switches.at(-1);
    if (node.label || !leave) return this.source.missing(node, 'producer/break-target', 'This break needs its resolved enclosing control target.');
    leave(node);
  }

  switchStatement(node: ts.SwitchStatement, dispatch: SwitchDispatch, lower: (clause: ts.CaseOrDefaultClause) => void): void {
    const clauses = node.caseBlock.clauses;
    const incoming: DraftBlock[][] = Array.from({ length: clauses.length + 1 }, () => []);
    if (dispatch.tagged) {
      const { subject, cases, labels } = dispatch.tagged;
      const blocks = this.match(node, subject, cases);
      cases.forEach(({ tag }, index) => incoming[labels.get(tag) ?? dispatch.fallback]!.push(blocks[index]!));
    } else {
      for (const test of dispatch.tests) {
        const condition: Operand = { type: 'bool', value: { kind: 'binary', op: 'equal', left: this.value(dispatch.selector), right: test.value } };
        const [yes, no] = this.fork(test.node, condition);
        incoming[test.index]!.push(yes);
        this.current = no;
      }
      incoming[dispatch.fallback]!.push(this.current);
    }
    const exits = incoming[clauses.length]!;
    this.switches.push(at => {
      // End this branch immediately; the fresh block carries its facts to the common exit.
      const exit = this.block(at, 'break', this.current.payloads);
      this.jump(this.current, exit, at);
      exits.push(exit);
    });
    try {
      for (const [index, clause] of clauses.entries()) {
        const entries = incoming[index]!;
        if (!entries.length) continue;
        this.current = this.merge(clause, 'case-entry', entries);
        lower(clause);
        if (!this.terminated) incoming[index + 1]!.push(this.current);
      }
    } finally {
      this.switches.pop();
    }
    if (exits.length) this.current = this.merge(node, 'switch-exit', exits);
  }

  private fork(node: ts.Node, condition: Condition): [DraftBlock, DraftBlock] {
    if ('cases' in condition) {
      const blocks = this.match(node, condition.subject, condition.cases);
      const index = condition.cases.findIndex(arm => arm.tag === condition.tag);
      const selected = blocks[index]!;
      const other = this.merge(node, 'other-tags', blocks.filter((_, i) => i !== index));
      return condition.presentOnTrue ? [selected, other] : [other, selected];
    }
    const yes = this.block(node, 'yes', this.current.payloads);
    const no = this.block(node, 'no', this.current.payloads);
    const source = this.source.span(node);
    if ('subject' in condition) {
      const present = condition.presentOnTrue ? yes : no;
      const omitted = condition.presentOnTrue ? no : yes;
      const binding = this.binding(node, 'present-value', 'presentValue', condition.payloadType);
      present.params.push(binding);
      present.payloads.set(condition.subject, { payload: { type: binding.type, slot: { block: present, binding } } });
      // The receiver supplies the payload as the first present parameter. Only
      // normal SSA transfers are added to this edge's explicit argument list.
      this.terminate({
        kind: 'presence',
        source,
        value: this.value(condition.subject),
        present: this.edge(this.current, present),
        omitted: this.edge(this.current, omitted),
      });
    } else {
      requireDomain(this.source, node, condition.type, 'bool');
      this.terminate({
        kind: 'branch',
        source,
        condition: this.value(condition),
        yes: this.edge(this.current, yes),
        no: this.edge(this.current, no),
      });
    }
    return [yes, no];
  }

  private join(node: ts.Node, role: string, left: DraftBlock, right: DraftBlock): DraftBlock {
    const block = this.block(node, role);
    for (const [subject, payload] of left.payloads) {
      if (right.payloads.get(subject) === payload) block.payloads.set(subject, payload);
    }
    return block;
  }

  private jump(from: DraftBlock, to: DraftBlock, origin: ts.Node, args?: Value[]): void {
    from.end = { kind: 'jump', source: this.source.span(origin), to: this.edge(from, to, args) };
  }

  branch(
    node: ts.IfStatement | ts.ConditionalExpression,
    condition: Condition,
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
    const join = this.join(node, 'continue', yesExit, this.current);
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
    condition: Condition,
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
    const join = this.join(node, 'result', leftExit, this.current);
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
