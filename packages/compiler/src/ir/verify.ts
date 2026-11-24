import { diagnostic, type CompilerDiagnostic } from '../diagnostics';
import {
  PROTO_IR_VERSION,
  type HostOpKind,
  type ModuleIR,
  type SsaFunction,
  type SsaInst,
  type SsaType,
} from './types';

interface Definition {
  readonly type: SsaType;
  readonly block?: string;
  readonly index: number;
}

const HOST_SIGNATURES: Readonly<Record<HostOpKind, readonly SsaType[]>> = {
  emit_event: ['ptr', 'i32'],
  request_update: ['ptr'],
  set_present: ['ptr', 'i1'],
  apply_style_rule: ['ptr', 'i32'],
};

function resultType(inst: SsaInst): SsaType | undefined {
  switch (inst.op) {
    case 'const':
    case 'load_prop':
    case 'load_state':
    case 'binop':
    case 'select':
    case 'phi':
      return inst.type;
    case 'cmp':
    case 'not':
      return 'i1';
    case 'fneg':
      return 'f64';
    case 'call':
      return inst.result ? inst.returnType : undefined;
    case 'store_state':
    case 'host_op':
      return undefined;
  }
}

function successors(fn: SsaFunction, label: string): readonly string[] {
  const term = fn.blocks.find((block) => block.label === label)?.terminator;
  if (term?.op === 'br') return [term.target];
  if (term?.op === 'condbr') return [term.thenTarget, term.elseTarget];
  return [];
}

/**
 * Verify compiler-owned SSA structure, types, CFG edges and dominance.
 * This checks lowering/pass invariants; it does not replace source-language checking.
 */
export function verifySsaFunction(
  fn: SsaFunction,
  functions: ReadonlyMap<string, SsaFunction> = new Map([[fn.name, fn]])
): CompilerDiagnostic[] {
  const issues: CompilerDiagnostic[] = [];
  const push = (message: string) =>
    issues.push(diagnostic('PUI_IR001', 'ir', fn.name + ': ' + message));
  if (fn.blocks.length === 0) {
    push('SSA function must contain an entry basic block.');
    return issues;
  }

  const blocks = new Map(fn.blocks.map((block) => [block.label, block]));
  if (blocks.size !== fn.blocks.length) push('Basic block labels must be unique.');
  const definitions = new Map<string, Definition>();
  const define = (id: string, definition: Definition) => {
    if (definitions.has(id)) push('Duplicate SSA definition ' + id + '.');
    definitions.set(id, definition);
  };
  for (const param of fn.params) define(param.id, { type: param.type, index: -1 });
  for (const block of fn.blocks) {
    block.instructions.forEach((inst, index) => {
      const type = resultType(inst);
      if ('result' in inst && inst.result && type) {
        define(inst.result, { type, block: block.label, index });
      }
    });
  }

  // Keep edge multiplicity: condbr may have the same destination on both arms.
  const predecessors = new Map<string, Map<string, number>>();
  for (const label of blocks.keys()) predecessors.set(label, new Map());
  for (const block of fn.blocks) {
    for (const target of successors(fn, block.label)) {
      const incoming = predecessors.get(target);
      if (!incoming) {
        push('Branch from ' + block.label + ' to unknown block ' + target + '.');
      } else {
        incoming.set(block.label, (incoming.get(block.label) ?? 0) + 1);
      }
    }
  }
  const entry = fn.blocks[0].label;
  if (predecessors.get(entry)?.size) push('The entry block cannot have predecessors.');
  const reachable = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const label = queue.pop()!;
    if (reachable.has(label) || !blocks.has(label)) continue;
    reachable.add(label);
    queue.push(...successors(fn, label));
  }
  const dominators = new Map<string, Set<string>>();
  for (const label of reachable) {
    dominators.set(label, label === entry ? new Set([entry]) : new Set(reachable));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const label of reachable) {
      if (label === entry) continue;
      const parents = [...predecessors.get(label)!.keys()].filter((p) => reachable.has(p));
      const next = new Set<string>(parents.length ? dominators.get(parents[0])! : []);
      for (const parent of parents.slice(1)) {
        for (const candidate of next) {
          if (!dominators.get(parent)!.has(candidate)) next.delete(candidate);
        }
      }
      next.add(label);
      const previous = dominators.get(label)!;
      if (next.size !== previous.size || [...next].some((v) => !previous.has(v))) {
        dominators.set(label, next);
        changed = true;
      }
    }
  }

  const operand = (
    id: string,
    expected: SsaType,
    context: string,
    block: string,
    index: number
  ) => {
    const definition = definitions.get(id);
    if (!definition) {
      push('Undefined SSA value ' + id + ' in ' + context + '.');
      return;
    }
    if (definition.type !== expected) {
      push(
        'Type mismatch for ' +
          id +
          ' in ' +
          context +
          ': expected ' +
          expected +
          ', got ' +
          definition.type +
          '.'
      );
    }
    if (!definition.block) return;
    if (definition.block === block) {
      if (definition.index >= index) {
        push('Definition of ' + id + ' does not precede its use in ' + context + '.');
      }
    } else if (reachable.has(block) && !dominators.get(block)?.has(definition.block)) {
      push('Definition of ' + id + ' does not dominate its use in ' + context + '.');
    }
  };
  const slot = (value: number, context: string) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      push(context + ' slot must be a non-negative safe integer.');
    }
  };

  for (const block of fn.blocks) {
    let seenNonPhi = false;
    block.instructions.forEach((inst, index) => {
      const use = (id: string, type: SsaType, context: string = inst.op) =>
        operand(id, type, context, block.label, index);
      if (inst.op === 'phi') {
        if (seenNonPhi) push('Phi instructions must precede all other instructions.');
        const expected = predecessors.get(block.label)!;
        const incoming = new Map<string, number>();
        const incomingValues = new Map<string, string>();
        for (const edge of inst.incoming) {
          incoming.set(edge.label, (incoming.get(edge.label) ?? 0) + 1);
          const previous = incomingValues.get(edge.label);
          if (previous !== undefined && previous !== edge.value) {
            push('Duplicate phi edges from ' + edge.label + ' must carry the same value.');
          }
          incomingValues.set(edge.label, edge.value);
          const parent = blocks.get(edge.label);
          if (!parent) push('Phi references unknown predecessor ' + edge.label + '.');
          else
            operand(
              edge.value,
              inst.type,
              'phi ' + inst.result,
              edge.label,
              parent.instructions.length
            );
        }
        if (
          inst.incoming.length === 0 ||
          incoming.size !== expected.size ||
          [...expected].some(([label, count]) => incoming.get(label) !== count)
        ) {
          push('Phi ' + inst.result + ' incoming edges must exactly match CFG predecessors.');
        }
        return;
      }
      seenNonPhi = true;
      switch (inst.op) {
        case 'const':
          if (
            (inst.type === 'i1' && typeof inst.value !== 'boolean') ||
            (inst.type === 'f64' && typeof inst.value !== 'number') ||
            (inst.type === 'i32' &&
              (typeof inst.value !== 'number' ||
                !Number.isInteger(inst.value) ||
                inst.value < -2147483648 ||
                inst.value > 2147483647)) ||
            (inst.type === 'ptr' && inst.value !== null)
          ) {
            push('Constant ' + inst.result + ' has an invalid value for ' + inst.type + '.');
          }
          break;
        case 'load_prop':
          use(inst.propsPtr, 'ptr');
          slot(inst.slot, inst.op);
          break;
        case 'load_state':
          use(inst.statesPtr, 'ptr');
          slot(inst.slot, inst.op);
          break;
        case 'store_state':
          use(inst.statesPtr, 'ptr');
          use(inst.value, inst.valueType);
          slot(inst.slot, inst.op);
          if (fn.pure) push('Pure function cannot store state.');
          break;
        case 'binop':
          use(inst.lhs, inst.type);
          use(inst.rhs, inst.type);
          if (
            (inst.type === 'i1' && !['and', 'or', 'xor'].includes(inst.operator)) ||
            (inst.type === 'f64' && ['and', 'or', 'xor'].includes(inst.operator))
          ) {
            push('Invalid ' + inst.type + ' binary operation ' + inst.operator + '.');
          }
          break;
        case 'cmp':
          use(inst.lhs, inst.operandType);
          use(inst.rhs, inst.operandType);
          break;
        case 'not':
          use(inst.operand, 'i1');
          break;
        case 'fneg':
          use(inst.operand, 'f64');
          break;
        case 'select':
          use(inst.cond, 'i1');
          use(inst.thenVal, inst.type);
          use(inst.elseVal, inst.type);
          break;
        case 'call': {
          for (const arg of inst.args) use(arg.id, arg.type, 'call ' + inst.callee);
          const callee = functions.get(inst.callee);
          if (!callee) push('Call references unknown function ' + inst.callee + '.');
          else {
            if (
              callee.returnType !== inst.returnType ||
              callee.params.length !== inst.args.length ||
              callee.params.some((p, i) => p.type !== inst.args[i]?.type)
            ) {
              push('Call to ' + inst.callee + ' does not match its declared signature.');
            }
            if (fn.pure && !callee.pure) push('Pure function calls impure ' + inst.callee + '.');
          }
          if ((inst.returnType === 'void') !== (inst.result === undefined)) {
            push('Call result must be present exactly when its return type is non-void.');
          }
          break;
        }
        case 'host_op': {
          const signature = HOST_SIGNATURES[inst.kind];
          for (const arg of inst.args) use(arg.id, arg.type, 'host_op ' + inst.kind);
          if (
            signature.length !== inst.args.length ||
            signature.some((type, i) => type !== inst.args[i]?.type)
          ) {
            push('Host operation ' + inst.kind + ' has an invalid signature.');
          }
          if (fn.pure) push('Pure function cannot invoke a host operation.');
          break;
        }
      }
    });
    const term = block.terminator;
    if (term.op === 'condbr') {
      operand(term.cond, 'i1', 'condbr', block.label, block.instructions.length);
    } else if (term.op === 'ret') {
      if (term.type !== fn.returnType) push('Return instruction type differs from function type.');
      if (fn.returnType === 'void') {
        if (term.value !== undefined) push('Void function cannot return a value.');
      } else if (term.value === undefined) {
        push('Non-void function must return a value.');
      } else {
        operand(term.value, fn.returnType, 'return', block.label, block.instructions.length);
      }
    }
  }
  return issues;
}

export function verifyModuleIR(mod: ModuleIR): CompilerDiagnostic[] {
  const issues: CompilerDiagnostic[] = [];
  if (mod.irVersion !== PROTO_IR_VERSION) {
    issues.push(
      diagnostic(
        'PUI_IR002',
        'ir',
        'Unsupported IR version ' + String(mod.irVersion) + '; expected ' + PROTO_IR_VERSION + '.'
      )
    );
  }
  const functions = new Map<string, SsaFunction>();
  const all = [...mod.functions, ...mod.prototypes.flatMap((proto) => proto.functions)];
  for (const fn of all) {
    if (functions.has(fn.name)) {
      issues.push(diagnostic('PUI_IR003', 'ir', 'Duplicate SSA function ' + fn.name + '.'));
    }
    functions.set(fn.name, fn);
  }
  for (const fn of all) issues.push(...verifySsaFunction(fn, functions));
  return issues;
}
