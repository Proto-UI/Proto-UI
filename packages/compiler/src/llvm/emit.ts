import type { HostOpKind, ModuleIR, PrototypeIR, SsaFunction, SsaInst, SsaType } from '../ir';

export interface LlvmEmitOptions {
  /** Target triple for the LLVM module header. Defaults to wasm32-unknown-unknown for portable kernels. */
  readonly targetTriple?: string;
}

const DATA_LAYOUTS: Readonly<Record<string, string>> = {
  'wasm32-unknown-unknown': 'e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128',
  'x86_64-unknown-linux-gnu':
    'e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128',
};

function sanitizeLlvmName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.$]/g, '_').replace(/^(\d)/, '_$1');
}

function llvmType(t: SsaType): string {
  return t === 'f64' ? 'double' : t;
}

/**
 * Format any JS number as an exact IEEE-754 LLVM double literal so LLVM 22
 * accepts every finite/signed-zero/subnormal float bit-for-bit without rounding.
 */
export function formatLlvmDouble(value: number): string {
  if (Object.is(value, 0)) return '0.0';
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, value, false);
  const hi = view.getUint32(0, false).toString(16).padStart(8, '0');
  const lo = view.getUint32(4, false).toString(16).padStart(8, '0');
  return `0x${hi}${lo}`;
}

function formatConst(type: Exclude<SsaType, 'void'>, value: boolean | number | null): string {
  if (type === 'i1') return value ? 'true' : 'false';
  if (type === 'i32') return String(Number(value ?? 0) | 0);
  if (type === 'f64') return formatLlvmDouble(Number(value ?? 0));
  return 'null';
}

function emitBinOp(
  op: Extract<SsaInst, { op: 'binop' }>['operator'],
  type: 'i1' | 'i32' | 'f64',
  lhs: string,
  rhs: string
): string {
  if (type === 'f64') {
    const map: Record<string, string> = {
      add: 'fadd',
      sub: 'fsub',
      mul: 'fmul',
      div: 'fdiv',
      rem: 'frem',
    };
    return `${map[op] ?? 'fadd'} double ${lhs}, ${rhs}`;
  }
  const map: Record<string, string> = {
    add: 'add',
    sub: 'sub',
    mul: 'mul',
    div: 'sdiv',
    rem: 'srem',
    and: 'and',
    or: 'or',
    xor: 'xor',
  };
  return `${map[op] ?? 'add'} ${type} ${lhs}, ${rhs}`;
}

function emitCmp(
  op: Extract<SsaInst, { op: 'cmp' }>['operator'],
  operandType: 'i1' | 'i32' | 'f64',
  lhs: string,
  rhs: string
): string {
  if (operandType === 'f64') {
    const map: Record<string, string> = {
      eq: 'oeq',
      ne: 'une',
      lt: 'olt',
      le: 'ole',
      gt: 'ogt',
      ge: 'oge',
    };
    return `fcmp ${map[op]} double ${lhs}, ${rhs}`;
  }
  const map: Record<string, string> = {
    eq: 'eq',
    ne: 'ne',
    lt: 'slt',
    le: 'sle',
    gt: 'sgt',
    ge: 'sge',
  };
  return `icmp ${map[op]} ${operandType} ${lhs}, ${rhs}`;
}

function emitFunction(fn: SsaFunction, usedHostOps: Set<HostOpKind>): string {
  const lines: string[] = [];
  if (fn.comment) lines.push(`; ${fn.comment}`);

  const params = fn.params.map((p) => `${llvmType(p.type)} ${p.id}`).join(', ');
  const attrs = fn.pure ? ' nounwind willreturn memory(argmem: read)' : ' nounwind';
  const linkage = fn.exported ? 'define' : 'define internal';
  lines.push(
    `${linkage} ${llvmType(fn.returnType)} @${sanitizeLlvmName(fn.name)}(${params})${attrs} {`
  );

  // Collect pure constants so LLVM IR uses direct immediate operands instead of dummy instructions.
  const consts = new Map<string, string>();
  for (const block of fn.blocks) {
    for (const inst of block.instructions) {
      if (inst.op === 'const') {
        consts.set(inst.result, formatConst(inst.type, inst.value));
      }
    }
  }
  const val = (id: string) => consts.get(id) ?? id;
  let tmp = 0;
  const fresh = (p = 't') => `%__${p}${tmp++}`;

  for (const block of fn.blocks) {
    lines.push(`${block.label}:`);
    for (const inst of block.instructions) {
      switch (inst.op) {
        case 'const':
          break;
        case 'load_prop': {
          const ptr = fresh('pptr');
          lines.push(
            `  ${ptr} = getelementptr inbounds i64, ptr ${val(inst.propsPtr)}, i32 ${inst.slot}`
          );
          if (inst.type === 'i1') {
            const raw = fresh('pb');
            lines.push(`  ${raw} = load i8, ptr ${ptr}, align 8`);
            lines.push(`  ${inst.result} = trunc i8 ${raw} to i1`);
          } else {
            lines.push(`  ${inst.result} = load ${llvmType(inst.type)}, ptr ${ptr}, align 8`);
          }
          break;
        }
        case 'load_state': {
          const ptr = fresh('sptr');
          lines.push(
            `  ${ptr} = getelementptr inbounds i64, ptr ${val(inst.statesPtr)}, i32 ${inst.slot}`
          );
          if (inst.type === 'i1') {
            const raw = fresh('sb');
            lines.push(`  ${raw} = load i8, ptr ${ptr}, align 8`);
            lines.push(`  ${inst.result} = trunc i8 ${raw} to i1`);
          } else {
            lines.push(`  ${inst.result} = load ${llvmType(inst.type)}, ptr ${ptr}, align 8`);
          }
          break;
        }
        case 'store_state': {
          const ptr = fresh('sptr');
          lines.push(
            `  ${ptr} = getelementptr inbounds i64, ptr ${val(inst.statesPtr)}, i32 ${inst.slot}`
          );
          if (inst.valueType === 'i1') {
            const ext = fresh('ext');
            lines.push(`  ${ext} = zext i1 ${val(inst.value)} to i8`);
            lines.push(`  store i8 ${ext}, ptr ${ptr}, align 8`);
          } else {
            lines.push(
              `  store ${llvmType(inst.valueType)} ${val(inst.value)}, ptr ${ptr}, align 8`
            );
          }
          break;
        }
        case 'binop':
          lines.push(
            `  ${inst.result} = ${emitBinOp(inst.operator, inst.type, val(inst.lhs), val(inst.rhs))}`
          );
          break;
        case 'cmp':
          lines.push(
            `  ${inst.result} = ${emitCmp(inst.operator, inst.operandType, val(inst.lhs), val(inst.rhs))}`
          );
          break;
        case 'not':
          lines.push(`  ${inst.result} = xor i1 ${val(inst.operand)}, true`);
          break;
        case 'select':
          lines.push(
            `  ${inst.result} = select i1 ${val(inst.cond)}, ${llvmType(inst.type)} ${val(inst.thenVal)}, ${llvmType(inst.type)} ${val(inst.elseVal)}`
          );
          break;
        case 'phi':
          lines.push(
            `  ${inst.result} = phi ${llvmType(inst.type)} ${inst.incoming
              .map((inc) => `[ ${val(inc.value)}, %${inc.label} ]`)
              .join(', ')}`
          );
          break;
        case 'call': {
          const args = inst.args.map((a) => `${llvmType(a.type)} ${val(a.id)}`).join(', ');
          const callStr = `call ${llvmType(inst.returnType)} @${sanitizeLlvmName(inst.callee)}(${args})`;
          lines.push(inst.result ? `  ${inst.result} = ${callStr}` : `  ${callStr}`);
          break;
        }
        case 'host_op': {
          usedHostOps.add(inst.kind);
          const args = inst.args.map((a) => `${llvmType(a.type)} ${val(a.id)}`).join(', ');
          lines.push(`  call void @pui_host_${inst.kind}(${args})`);
          break;
        }
      }
    }

    const term = block.terminator;
    if (term.op === 'br') {
      lines.push(`  br label %${term.target}`);
    } else if (term.op === 'condbr') {
      lines.push(`  br i1 ${val(term.cond)}, label %${term.thenTarget}, label %${term.elseTarget}`);
    } else if (term.op === 'ret') {
      if (term.type === 'void' || term.value === undefined) lines.push('  ret void');
      else lines.push(`  ret ${llvmType(term.type)} ${val(term.value)}`);
    } else {
      lines.push('  unreachable');
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function emitPrototypeMetadataFunctions(proto: PrototypeIR): string {
  const sym = sanitizeLlvmName(proto.name);
  const parts: string[] = [
    `; --- Prototype: ${proto.name} (tier=${proto.tier}, caps=[${proto.capabilities.join(', ')}]) ---`,
    `define i64 @${sym}_capabilities() nounwind willreturn memory(none) {\nentry:\n  ret i64 ${proto.capabilityMask.toString()}\n}`,
    `define i32 @${sym}_prop_count() nounwind willreturn memory(none) {\nentry:\n  ret i32 ${proto.props.length}\n}`,
    `define i32 @${sym}_state_count() nounwind willreturn memory(none) {\nentry:\n  ret i32 ${proto.states.length}\n}`,
    `define i32 @${sym}_rule_count() nounwind willreturn memory(none) {\nentry:\n  ret i32 ${proto.rules.length}\n}`,
  ];

  // Emit state initializer kernel when prototype declares states.
  if (proto.states.length > 0) {
    const initLines: string[] = [
      `define void @${sym}_init_state(ptr %states) nounwind willreturn memory(argmem: write) {`,
      'entry:',
    ];
    for (const st of proto.states) {
      const ptr = `%s${st.index}`;
      initLines.push(`  ${ptr} = getelementptr inbounds i64, ptr %states, i32 ${st.index}`);
      if (st.ssaType === 'i1') {
        initLines.push(`  store i8 ${st.initialValue ? 1 : 0}, ptr ${ptr}, align 8`);
      } else if (st.ssaType === 'f64') {
        const num = typeof st.initialValue === 'number' ? st.initialValue : 0;
        initLines.push(`  store double ${formatLlvmDouble(num)}, ptr ${ptr}, align 8`);
      } else if (st.ssaType === 'i32') {
        const idx =
          typeof st.initialValue === 'string'
            ? Math.max(0, proto.stringTable.indexOf(st.initialValue))
            : 0;
        initLines.push(`  store i32 ${idx}, ptr ${ptr}, align 8`);
      }
    }
    initLines.push('  ret void', '}');
    parts.push(initLines.join('\n'));
  }

  return parts.join('\n\n');
}

/**
 * Emit a complete, self-contained, LLVM-22-valid `.ll` textual module from Proto SSA IR.
 */
export function emitLlvmIR(mod: ModuleIR, options: LlvmEmitOptions = {}): string {
  const triple = options.targetTriple ?? 'wasm32-unknown-unknown';
  const layout = DATA_LAYOUTS[triple];
  const header: string[] = [
    `; Proto UI Compiler v2 -> LLVM IR (opaque pointers)`,
    `source_filename = ${JSON.stringify(mod.sourceFile)}`,
  ];
  if (layout) header.push(`target datalayout = "${layout}"`);
  header.push(`target triple = "${triple}"`);

  const usedHostOps = new Set<HostOpKind>();
  const sections: string[] = [];

  for (const proto of mod.prototypes) {
    sections.push(emitPrototypeMetadataFunctions(proto));
    for (const fn of proto.functions) {
      sections.push(emitFunction(fn, usedHostOps));
    }
  }
  for (const fn of mod.functions) {
    sections.push(emitFunction(fn, usedHostOps));
  }

  const hostDecls: string[] = [];
  if (usedHostOps.has('emit_event')) hostDecls.push('declare void @pui_host_emit_event(ptr, i32)');
  if (usedHostOps.has('request_update'))
    hostDecls.push('declare void @pui_host_request_update(ptr)');
  if (usedHostOps.has('set_present')) hostDecls.push('declare void @pui_host_set_present(ptr, i1)');
  if (usedHostOps.has('apply_style_rule')) {
    hostDecls.push('declare void @pui_host_apply_style_rule(ptr, i32)');
  }

  return (
    [header.join('\n'), ...(hostDecls.length ? [hostDecls.join('\n')] : []), ...sections].join(
      '\n\n'
    ) + '\n'
  );
}
