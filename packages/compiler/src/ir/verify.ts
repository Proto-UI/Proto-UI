import { diagnostic, type CompilerDiagnostic } from '../diagnostics';
import { PROTO_IR_VERSION, type ModuleIR, type SsaFunction, type SsaType } from './types';

function instResultType(
  inst: SsaFunction['blocks'][number]['instructions'][number]
): SsaType | undefined {
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
    case 'call':
      return inst.result ? inst.returnType : undefined;
    case 'store_state':
    case 'host_op':
      return undefined;
  }
}

/** Lightweight structural & SSA invariant verifier (not a duplicate TS typechecker). */
export function verifySsaFunction(fn: SsaFunction): CompilerDiagnostic[] {
  const issues: CompilerDiagnostic[] = [];
  const push = (msg: string) => issues.push(diagnostic('PUI_IR001', 'ir', `${fn.name}: ${msg}`));

  if (fn.blocks.length === 0) {
    push('SSA function must contain at least an entry basic block.');
    return issues;
  }

  const blockLabels = new Set<string>();
  const defs = new Map<string, SsaType>();
  for (const param of fn.params) {
    if (defs.has(param.id)) push(`Duplicate parameter SSA id ${param.id}.`);
    defs.set(param.id, param.type);
  }

  for (const block of fn.blocks) {
    if (blockLabels.has(block.label)) push(`Duplicate basic block label ${block.label}.`);
    blockLabels.add(block.label);
    for (const inst of block.instructions) {
      const res = 'result' in inst ? inst.result : undefined;
      const resType = instResultType(inst);
      if (res) {
        if (defs.has(res)) push(`Duplicate SSA definition ${res} in block ${block.label}.`);
        if (resType) defs.set(res, resType);
      }
    }
  }

  const requireOperand = (id: string, expected: SsaType | undefined, ctx: string) => {
    const actual = defs.get(id);
    if (!actual) {
      push(`Undefined SSA value ${id} in ${ctx}.`);
    } else if (expected && actual !== expected) {
      push(`Type mismatch for ${id} in ${ctx}: expected ${expected}, got ${actual}.`);
    }
  };

  for (const block of fn.blocks) {
    let seenNonPhi = false;
    for (const inst of block.instructions) {
      if (inst.op === 'phi') {
        if (seenNonPhi) push(`Phi instruction ${inst.result} must precede non-phi instructions.`);
        for (const inc of inst.incoming) {
          if (!blockLabels.has(inc.label)) push(`Phi references unknown block ${inc.label}.`);
          requireOperand(inc.value, inst.type, `phi ${inst.result}`);
        }
        continue;
      }
      seenNonPhi = true;
      switch (inst.op) {
        case 'const':
          break;
        case 'load_prop':
          requireOperand(inst.propsPtr, 'ptr', `load_prop ${inst.result}`);
          break;
        case 'load_state':
          requireOperand(inst.statesPtr, 'ptr', `load_state ${inst.result}`);
          break;
        case 'store_state':
          requireOperand(inst.statesPtr, 'ptr', 'store_state');
          requireOperand(inst.value, inst.valueType, 'store_state');
          break;
        case 'binop':
          requireOperand(inst.lhs, inst.type, `binop ${inst.result}`);
          requireOperand(inst.rhs, inst.type, `binop ${inst.result}`);
          break;
        case 'cmp':
          requireOperand(inst.lhs, inst.operandType, `cmp ${inst.result}`);
          requireOperand(inst.rhs, inst.operandType, `cmp ${inst.result}`);
          break;
        case 'not':
          requireOperand(inst.operand, 'i1', `not ${inst.result}`);
          break;
        case 'select':
          requireOperand(inst.cond, 'i1', `select ${inst.result}`);
          requireOperand(inst.thenVal, inst.type, `select ${inst.result}`);
          requireOperand(inst.elseVal, inst.type, `select ${inst.result}`);
          break;
        case 'call':
          for (const arg of inst.args) requireOperand(arg.id, arg.type, `call ${inst.callee}`);
          break;
        case 'host_op':
          for (const arg of inst.args) requireOperand(arg.id, arg.type, `host_op ${inst.kind}`);
          break;
      }
    }

    const term = block.terminator;
    if (term.op === 'br') {
      if (!blockLabels.has(term.target)) push(`Branch to unknown block ${term.target}.`);
    } else if (term.op === 'condbr') {
      requireOperand(term.cond, 'i1', `condbr in ${block.label}`);
      if (!blockLabels.has(term.thenTarget)) push(`Branch to unknown block ${term.thenTarget}.`);
      if (!blockLabels.has(term.elseTarget)) push(`Branch to unknown block ${term.elseTarget}.`);
    } else if (term.op === 'ret') {
      if (fn.returnType === 'void') {
        if (term.value !== undefined) push(`Void function returns value ${term.value}.`);
      } else {
        if (term.value === undefined) push(`Non-void function returns void.`);
        else requireOperand(term.value, fn.returnType, `ret in ${block.label}`);
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
        `Unsupported IR version ${String(mod.irVersion)}; expected ${PROTO_IR_VERSION}.`
      )
    );
  }
  const fnNames = new Set<string>();
  const checkFn = (fn: SsaFunction) => {
    if (fnNames.has(fn.name)) {
      issues.push(diagnostic('PUI_IR003', 'ir', `Duplicate SSA function ${fn.name}.`));
    }
    fnNames.add(fn.name);
    issues.push(...verifySsaFunction(fn));
  };
  for (const fn of mod.functions) checkFn(fn);
  for (const proto of mod.prototypes) {
    for (const fn of proto.functions) checkFn(fn);
  }
  return issues;
}
