import {
  encodeCapabilityMask,
  type CapabilityName,
  type ModuleIR,
  type PrototypeIR,
  type SsaBasicBlock,
  type SsaFunction,
  type SsaInst,
  type SsaTerminator,
} from './types';

export interface SsaPassStats {
  readonly instructionsBefore: number;
  readonly instructionsAfter: number;
  readonly blocksBefore: number;
  readonly blocksAfter: number;
  readonly foldedConstants: number;
  readonly eliminatedInstructions: number;
  readonly eliminatedBlocks: number;
}

function isPureInst(inst: SsaInst): boolean {
  switch (inst.op) {
    case 'const':
    case 'load_prop':
    case 'load_state':
    case 'binop':
    case 'cmp':
    case 'not':
    case 'select':
    case 'phi':
      return true;
    case 'store_state':
    case 'host_op':
    case 'call':
      return false;
  }
}

function usedOperands(inst: SsaInst): string[] {
  switch (inst.op) {
    case 'const':
      return [];
    case 'load_prop':
      return [inst.propsPtr];
    case 'load_state':
      return [inst.statesPtr];
    case 'store_state':
      return [inst.statesPtr, inst.value];
    case 'binop':
    case 'cmp':
      return [inst.lhs, inst.rhs];
    case 'not':
      return [inst.operand];
    case 'select':
      return [inst.cond, inst.thenVal, inst.elseVal];
    case 'phi':
      return inst.incoming.map((inc) => inc.value);
    case 'call':
    case 'host_op':
      return inst.args.map((a) => a.id);
  }
}

function terminatorOperands(term: SsaTerminator): string[] {
  if (term.op === 'condbr') return [term.cond];
  if (term.op === 'ret' && term.value !== undefined) return [term.value];
  return [];
}

function evalBinOp(
  op: Extract<SsaInst, { op: 'binop' }>['operator'],
  type: 'i1' | 'i32' | 'f64',
  a: boolean | number,
  b: boolean | number
): boolean | number | undefined {
  if (type === 'i1') {
    const ba = Boolean(a);
    const bb = Boolean(b);
    if (op === 'and') return ba && bb;
    if (op === 'or') return ba || bb;
    if (op === 'xor') return ba !== bb;
    return undefined;
  }
  const na = Number(a);
  const nb = Number(b);
  let out: number;
  switch (op) {
    case 'add':
      out = na + nb;
      break;
    case 'sub':
      out = na - nb;
      break;
    case 'mul':
      out = na * nb;
      break;
    case 'div':
      if (type === 'i32' && (nb | 0) === 0) return undefined;
      out = type === 'i32' ? Math.trunc(na / nb) : na / nb;
      break;
    case 'rem':
      if (type === 'i32' && (nb | 0) === 0) return undefined;
      out = na % nb;
      break;
    case 'and':
      out = (na | 0) & (nb | 0);
      break;
    case 'or':
      out = na | 0 | (nb | 0);
      break;
    case 'xor':
      out = (na | 0) ^ (nb | 0);
      break;
  }
  return type === 'i32' ? out | 0 : out;
}

function evalCmp(
  op: Extract<SsaInst, { op: 'cmp' }>['operator'],
  a: boolean | number,
  b: boolean | number
): boolean {
  const na = typeof a === 'boolean' ? (a ? 1 : 0) : a;
  const nb = typeof b === 'boolean' ? (b ? 1 : 0) : b;
  switch (op) {
    case 'eq':
      return na === nb;
    case 'ne':
      return na !== nb;
    case 'lt':
      return na < nb;
    case 'le':
      return na <= nb;
    case 'gt':
      return na > nb;
    case 'ge':
      return na >= nb;
  }
}

/**
 * Target-independent SSA optimization pass:
 * 1. Constant folding + algebraic identities (true && x, false || x, not(const), select(const))
 * 2. Constant branch folding (condbr(const) -> br)
 * 3. Unreachable basic block pruning + phi incoming cleanup
 * 4. Backward liveness dead-instruction elimination (DCE)
 */
export function optimizeSsaFunction(fn: SsaFunction): {
  fn: SsaFunction;
  stats: SsaPassStats;
} {
  const blocksBefore = fn.blocks.length;
  const instructionsBefore = fn.blocks.reduce((sum, b) => sum + b.instructions.length, 0);

  let foldedConstants = 0;
  const consts = new Map<string, boolean | number | null>();
  const aliases = new Map<string, string>();
  const resolve = (id: string): string => {
    let cur = id;
    while (aliases.has(cur)) cur = aliases.get(cur)!;
    return cur;
  };

  let blocks: SsaBasicBlock[] = fn.blocks.map((block) => ({
    label: block.label,
    instructions: block.instructions.map((inst) => ({ ...inst })),
    terminator: { ...block.terminator },
  }));

  // Fixed-point constant folding & algebraic simplification (max 4 passes).
  for (let round = 0; round < 4; round++) {
    let changed = false;
    for (const block of blocks) {
      const nextInsts: SsaInst[] = [];
      for (const raw of block.instructions) {
        const inst = rewriteInstOperands(raw, resolve);
        if (inst.op === 'const') {
          consts.set(inst.result, inst.value);
          nextInsts.push(inst);
          continue;
        }
        if (inst.op === 'not') {
          const cv = consts.get(inst.operand);
          if (typeof cv === 'boolean') {
            consts.set(inst.result, !cv);
            nextInsts.push({ op: 'const', result: inst.result, type: 'i1', value: !cv });
            foldedConstants++;
            changed = true;
            continue;
          }
        }
        if (inst.op === 'binop') {
          const lv = consts.get(inst.lhs);
          const rv = consts.get(inst.rhs);
          if (
            (typeof lv === 'boolean' || typeof lv === 'number') &&
            (typeof rv === 'boolean' || typeof rv === 'number')
          ) {
            const folded = evalBinOp(inst.operator, inst.type, lv, rv);
            if (folded !== undefined) {
              consts.set(inst.result, folded);
              nextInsts.push({
                op: 'const',
                result: inst.result,
                type: inst.type,
                value: folded,
              });
              foldedConstants++;
              changed = true;
              continue;
            }
          }
          if (inst.type === 'i1' && inst.operator === 'and') {
            if (lv === false || rv === false) {
              consts.set(inst.result, false);
              nextInsts.push({ op: 'const', result: inst.result, type: 'i1', value: false });
              foldedConstants++;
              changed = true;
              continue;
            }
            if (lv === true) {
              aliases.set(inst.result, inst.rhs);
              foldedConstants++;
              changed = true;
              continue;
            }
            if (rv === true) {
              aliases.set(inst.result, inst.lhs);
              foldedConstants++;
              changed = true;
              continue;
            }
          }
          if (inst.type === 'i1' && inst.operator === 'or') {
            if (lv === true || rv === true) {
              consts.set(inst.result, true);
              nextInsts.push({ op: 'const', result: inst.result, type: 'i1', value: true });
              foldedConstants++;
              changed = true;
              continue;
            }
            if (lv === false) {
              aliases.set(inst.result, inst.rhs);
              foldedConstants++;
              changed = true;
              continue;
            }
            if (rv === false) {
              aliases.set(inst.result, inst.lhs);
              foldedConstants++;
              changed = true;
              continue;
            }
          }
        }
        if (inst.op === 'cmp') {
          const lv = consts.get(inst.lhs);
          const rv = consts.get(inst.rhs);
          if (
            (typeof lv === 'boolean' || typeof lv === 'number') &&
            (typeof rv === 'boolean' || typeof rv === 'number')
          ) {
            const folded = evalCmp(inst.operator, lv, rv);
            consts.set(inst.result, folded);
            nextInsts.push({ op: 'const', result: inst.result, type: 'i1', value: folded });
            foldedConstants++;
            changed = true;
            continue;
          }
        }
        if (inst.op === 'select') {
          const cv = consts.get(inst.cond);
          if (typeof cv === 'boolean') {
            aliases.set(inst.result, cv ? inst.thenVal : inst.elseVal);
            foldedConstants++;
            changed = true;
            continue;
          }
          if (inst.thenVal === inst.elseVal) {
            aliases.set(inst.result, inst.thenVal);
            foldedConstants++;
            changed = true;
            continue;
          }
        }
        nextInsts.push(inst);
      }
      block.instructions.splice(0, block.instructions.length, ...nextInsts);
      block.terminator = rewriteTerminatorOperands(block.terminator, resolve);
      if (block.terminator.op === 'condbr') {
        const cv = consts.get(block.terminator.cond);
        if (typeof cv === 'boolean') {
          block.terminator = {
            op: 'br',
            target: cv ? block.terminator.thenTarget : block.terminator.elseTarget,
          };
          foldedConstants++;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Prune unreachable blocks from entry.
  const blockMap = new Map(blocks.map((b) => [b.label, b]));
  const reachable = new Set<string>();
  const queue = blocks.length ? [blocks[0].label] : [];
  while (queue.length) {
    const label = queue.shift()!;
    if (reachable.has(label)) continue;
    reachable.add(label);
    const blk = blockMap.get(label);
    if (!blk) continue;
    if (blk.terminator.op === 'br') queue.push(blk.terminator.target);
    else if (blk.terminator.op === 'condbr') {
      queue.push(blk.terminator.thenTarget, blk.terminator.elseTarget);
    }
  }
  blocks = blocks.filter((b) => reachable.has(b.label));
  for (const block of blocks) {
    for (let i = 0; i < block.instructions.length; i++) {
      const inst = block.instructions[i];
      if (inst.op === 'phi') {
        const live = inst.incoming.filter((inc) => reachable.has(inc.label));
        block.instructions[i] = { ...inst, incoming: live };
      }
    }
  }

  // Backward liveness DCE.
  const defToInst = new Map<string, SsaInst>();
  const live = new Set<SsaInst>();
  const worklist: SsaInst[] = [];

  for (const block of blocks) {
    for (const inst of block.instructions) {
      if ('result' in inst && inst.result) defToInst.set(inst.result, inst);
      if (!isPureInst(inst)) {
        live.add(inst);
        worklist.push(inst);
      }
    }
  }
  const markVal = (id: string) => {
    const def = defToInst.get(id);
    if (def && !live.has(def)) {
      live.add(def);
      worklist.push(def);
    }
  };
  for (const block of blocks) {
    for (const id of terminatorOperands(block.terminator)) markVal(id);
  }
  while (worklist.length) {
    const inst = worklist.pop()!;
    for (const id of usedOperands(inst)) markVal(id);
  }

  for (const block of blocks) {
    const kept = block.instructions.filter((inst) => live.has(inst));
    block.instructions.splice(0, block.instructions.length, ...kept);
  }

  const blocksAfter = blocks.length;
  const instructionsAfter = blocks.reduce((sum, b) => sum + b.instructions.length, 0);

  return {
    fn: { ...fn, blocks },
    stats: {
      instructionsBefore,
      instructionsAfter,
      blocksBefore,
      blocksAfter,
      foldedConstants,
      eliminatedInstructions: Math.max(0, instructionsBefore - instructionsAfter),
      eliminatedBlocks: Math.max(0, blocksBefore - blocksAfter),
    },
  };
}

function rewriteInstOperands(inst: SsaInst, resolve: (id: string) => string): SsaInst {
  switch (inst.op) {
    case 'const':
      return inst;
    case 'load_prop':
      return { ...inst, propsPtr: resolve(inst.propsPtr) };
    case 'load_state':
      return { ...inst, statesPtr: resolve(inst.statesPtr) };
    case 'store_state':
      return {
        ...inst,
        statesPtr: resolve(inst.statesPtr),
        value: resolve(inst.value),
      };
    case 'binop':
      return { ...inst, lhs: resolve(inst.lhs), rhs: resolve(inst.rhs) };
    case 'cmp':
      return { ...inst, lhs: resolve(inst.lhs), rhs: resolve(inst.rhs) };
    case 'not':
      return { ...inst, operand: resolve(inst.operand) };
    case 'select':
      return {
        ...inst,
        cond: resolve(inst.cond),
        thenVal: resolve(inst.thenVal),
        elseVal: resolve(inst.elseVal),
      };
    case 'phi':
      return {
        ...inst,
        incoming: inst.incoming.map((inc) => ({ label: inc.label, value: resolve(inc.value) })),
      };
    case 'call':
    case 'host_op':
      return { ...inst, args: inst.args.map((a) => ({ ...a, id: resolve(a.id) })) };
  }
}

function rewriteTerminatorOperands(
  term: SsaTerminator,
  resolve: (id: string) => string
): SsaTerminator {
  if (term.op === 'condbr') return { ...term, cond: resolve(term.cond) };
  if (term.op === 'ret' && term.value !== undefined) return { ...term, value: resolve(term.value) };
  return term;
}

const HOOK_CAPABILITY_MAP: Readonly<Record<string, CapabilityName>> = {
  asTrigger: 'trigger',
  asFocusable: 'focus',
  asFocusEntry: 'focus',
  asFocusScope: 'focus',
  asFocusRoving: 'focus',
  asAccessible: 'accessible',
  asControlLabel: 'controlLabel',
  asAnatomy: 'anatomy',
  asCollection: 'collection',
  asCollectionItem: 'collection',
  asOverlay: 'overlay',
  asBoundary: 'boundary',
  asHitParticipation: 'hitParticipation',
  asPositioning: 'positioning',
  asScrollSurface: 'scroll',
  asTextControl: 'textControl',
  asImageView: 'imageView',
  asTableStructure: 'tableStructure',
  asNativeLink: 'nativeLink',
  asAxisInput: 'axisInput',
  asPresence: 'presence',
};

export function computePrototypeCapabilities(
  proto: Omit<PrototypeIR, 'capabilities' | 'capabilityMask'>
): { capabilities: CapabilityName[]; capabilityMask: bigint } {
  const caps = new Set<CapabilityName>();
  if (proto.props.length > 0) caps.add('props');
  if (proto.states.length > 0) caps.add('state');
  if (proto.exposes.length > 0) caps.add('expose');
  if (proto.events.length > 0) caps.add('event');
  if (proto.lifecycle.length > 0) caps.add('lifecycle');
  if (proto.contexts.length > 0) caps.add('context');
  if (proto.staticStyleTokens.length > 0) caps.add('style');
  if (proto.rules.length > 0) {
    caps.add('rule');
    caps.add('style');
  }
  if (proto.render.kind !== 'default-slot') caps.add('render');
  for (const hook of proto.hooks) {
    const mapped = HOOK_CAPABILITY_MAP[hook.name];
    if (mapped) caps.add(mapped);
    else if (hook.kind === 'authored') caps.add('authoredHooks');
  }
  const capabilities = [...caps].sort();
  return { capabilities, capabilityMask: encodeCapabilityMask(capabilities) };
}

export function optimizeModuleIR(mod: ModuleIR): {
  ir: ModuleIR;
  stats: SsaPassStats;
} {
  let instructionsBefore = 0;
  let instructionsAfter = 0;
  let blocksBefore = 0;
  let blocksAfter = 0;
  let foldedConstants = 0;
  let eliminatedInstructions = 0;
  let eliminatedBlocks = 0;

  const merge = (s: SsaPassStats) => {
    instructionsBefore += s.instructionsBefore;
    instructionsAfter += s.instructionsAfter;
    blocksBefore += s.blocksBefore;
    blocksAfter += s.blocksAfter;
    foldedConstants += s.foldedConstants;
    eliminatedInstructions += s.eliminatedInstructions;
    eliminatedBlocks += s.eliminatedBlocks;
  };

  const optFn = (fn: SsaFunction) => {
    const res = optimizeSsaFunction(fn);
    merge(res.stats);
    return res.fn;
  };

  const functions = mod.functions.map(optFn);
  const prototypes = mod.prototypes.map((proto) => ({
    ...proto,
    functions: proto.functions.map(optFn),
  }));

  return {
    ir: { ...mod, functions, prototypes },
    stats: {
      instructionsBefore,
      instructionsAfter,
      blocksBefore,
      blocksAfter,
      foldedConstants,
      eliminatedInstructions,
      eliminatedBlocks,
    },
  };
}
