import type {
  HostOpKind,
  SsaBasicBlock,
  SsaBinOp,
  SsaCmpOp,
  SsaFunction,
  SsaInst,
  SsaParam,
  SsaTerminator,
  SsaType,
} from './types';

/** Ergonomic SSA IR builder guaranteeing unique SSA value names and well-formed blocks. */
export class SsaBuilder {
  private nextId = 0;
  private readonly blocks: SsaBasicBlock[] = [];
  private current: SsaBasicBlock;

  constructor(
    private readonly name: string,
    private readonly params: readonly SsaParam[],
    private readonly returnType: SsaType,
    private readonly options: { exported?: boolean; pure?: boolean; comment?: string } = {}
  ) {
    this.current = this.createBlock('entry');
  }

  fresh(prefix = 'v'): string {
    return `%${prefix}${this.nextId++}`;
  }

  createBlock(label: string): SsaBasicBlock {
    const block: SsaBasicBlock = {
      label,
      instructions: [],
      terminator: { op: 'unreachable' },
    };
    this.blocks.push(block);
    return block;
  }

  positionAt(block: SsaBasicBlock): void {
    this.current = block;
  }

  currentBlock(): SsaBasicBlock {
    return this.current;
  }

  emit(inst: SsaInst): void {
    this.current.instructions.push(inst);
  }

  constI1(value: boolean): string {
    const result = this.fresh('c');
    this.emit({ op: 'const', result, type: 'i1', value });
    return result;
  }

  constI32(value: number): string {
    const result = this.fresh('c');
    this.emit({ op: 'const', result, type: 'i32', value: value | 0 });
    return result;
  }

  constF64(value: number): string {
    const result = this.fresh('c');
    this.emit({ op: 'const', result, type: 'f64', value });
    return result;
  }

  loadProp(
    propsPtr: string,
    slot: number,
    propName: string,
    type: Exclude<SsaType, 'void'>
  ): string {
    const result = this.fresh('prop');
    this.emit({ op: 'load_prop', result, type, propsPtr, slot, propName });
    return result;
  }

  loadState(
    statesPtr: string,
    slot: number,
    stateName: string,
    type: Exclude<SsaType, 'void'>
  ): string {
    const result = this.fresh('st');
    this.emit({ op: 'load_state', result, type, statesPtr, slot, stateName });
    return result;
  }

  storeState(
    statesPtr: string,
    slot: number,
    value: string,
    valueType: Exclude<SsaType, 'void'>
  ): void {
    this.emit({ op: 'store_state', statesPtr, slot, value, valueType });
  }

  binop(operator: SsaBinOp, type: 'i1' | 'i32' | 'f64', lhs: string, rhs: string): string {
    const result = this.fresh(operator);
    this.emit({ op: 'binop', result, operator, type, lhs, rhs });
    return result;
  }

  cmp(operator: SsaCmpOp, operandType: 'i1' | 'i32' | 'f64', lhs: string, rhs: string): string {
    const result = this.fresh('cmp');
    this.emit({ op: 'cmp', result, operator, operandType, lhs, rhs });
    return result;
  }

  not(operand: string): string {
    const result = this.fresh('not');
    this.emit({ op: 'not', result, operand });
    return result;
  }

  fneg(operand: string): string {
    const result = this.fresh('neg');
    this.emit({ op: 'fneg', result, operand });
    return result;
  }

  select(type: Exclude<SsaType, 'void'>, cond: string, thenVal: string, elseVal: string): string {
    const result = this.fresh('sel');
    this.emit({ op: 'select', result, type, cond, thenVal, elseVal });
    return result;
  }

  phi(
    type: Exclude<SsaType, 'void'>,
    incoming: readonly { readonly label: string; readonly value: string }[]
  ): string {
    const result = this.fresh('phi');
    this.emit({ op: 'phi', result, type, incoming });
    return result;
  }

  call(
    callee: string,
    returnType: SsaType,
    args: readonly { readonly id: string; readonly type: Exclude<SsaType, 'void'> }[]
  ): string | undefined {
    const result = returnType === 'void' ? undefined : this.fresh('call');
    this.emit({ op: 'call', result, callee, returnType, args });
    return result;
  }

  hostOp(
    kind: HostOpKind,
    args: readonly { readonly id: string; readonly type: Exclude<SsaType, 'void'> }[]
  ): void {
    this.emit({ op: 'host_op', kind, args });
  }

  terminate(terminator: SsaTerminator): void {
    this.current.terminator = terminator;
  }

  br(target: string): void {
    this.terminate({ op: 'br', target });
  }

  condbr(cond: string, thenTarget: string, elseTarget: string): void {
    this.terminate({ op: 'condbr', cond, thenTarget, elseTarget });
  }

  ret(value?: string): void {
    this.terminate(
      value !== undefined
        ? { op: 'ret', value, type: this.returnType }
        : { op: 'ret', type: 'void' }
    );
  }

  build(): SsaFunction {
    return {
      name: this.name,
      params: this.params,
      returnType: this.returnType,
      blocks: this.blocks,
      ...this.options,
    };
  }
}
