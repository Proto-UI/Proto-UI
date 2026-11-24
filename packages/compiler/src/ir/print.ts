import type { ModuleIR, PrototypeIR, SsaFunction, SsaInst, SsaTerminator } from './types';

function formatInst(inst: SsaInst): string {
  switch (inst.op) {
    case 'const':
      return `${inst.result} = const.${inst.type} ${String(inst.value)}`;
    case 'load_prop':
      return `${inst.result} = load.prop.${inst.type} ${inst.propsPtr}[${inst.slot}] ; ${inst.propName}`;
    case 'load_state':
      return `${inst.result} = load.state.${inst.type} ${inst.statesPtr}[${inst.slot}] ; ${inst.stateName}`;
    case 'store_state':
      return `store.state.${inst.valueType} ${inst.statesPtr}[${inst.slot}], ${inst.value}`;
    case 'binop':
      return `${inst.result} = ${inst.operator}.${inst.type} ${inst.lhs}, ${inst.rhs}`;
    case 'cmp':
      return `${inst.result} = cmp.${inst.operator}.${inst.operandType} ${inst.lhs}, ${inst.rhs}`;
    case 'not':
      return `${inst.result} = not.i1 ${inst.operand}`;
    case 'select':
      return `${inst.result} = select.${inst.type} ${inst.cond}, ${inst.thenVal}, ${inst.elseVal}`;
    case 'phi':
      return `${inst.result} = phi.${inst.type} ${inst.incoming
        .map((i) => `[${i.value}, %${i.label}]`)
        .join(', ')}`;
    case 'call': {
      const args = inst.args.map((a) => `${a.type} ${a.id}`).join(', ');
      const callExpr = `call.${inst.returnType} @${inst.callee}(${args})`;
      return inst.result ? `${inst.result} = ${callExpr}` : callExpr;
    }
    case 'host_op': {
      const args = inst.args.map((a) => `${a.type} ${a.id}`).join(', ');
      return `host.${inst.kind}(${args})`;
    }
  }
}

function formatTerminator(term: SsaTerminator): string {
  switch (term.op) {
    case 'br':
      return `br %${term.target}`;
    case 'condbr':
      return `condbr ${term.cond}, %${term.thenTarget}, %${term.elseTarget}`;
    case 'ret':
      return term.value !== undefined ? `ret.${term.type} ${term.value}` : 'ret.void';
    case 'unreachable':
      return 'unreachable';
  }
}

export function printSsaFunction(fn: SsaFunction): string {
  const lines: string[] = [];
  if (fn.comment) lines.push(`; ${fn.comment}`);
  const params = fn.params.map((p) => `${p.type} ${p.id}`).join(', ');
  const attrs = [fn.exported ? 'export' : '', fn.pure ? 'pure' : ''].filter(Boolean).join(' ');
  lines.push(`func ${attrs ? `${attrs} ` : ''}@${fn.name}(${params}) -> ${fn.returnType} {`);
  for (const block of fn.blocks) {
    lines.push(`${block.label}:`);
    for (const inst of block.instructions) {
      lines.push(`  ${formatInst(inst)}`);
    }
    lines.push(`  ${formatTerminator(block.terminator)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

export function printPrototypeIR(proto: PrototypeIR): string {
  const lines: string[] = [
    `prototype @${proto.name} (export=${proto.exportName}, tier=${proto.tier}, capmask=0x${proto.capabilityMask.toString(16)}) {`,
    `  capabilities: [${proto.capabilities.join(', ')}]`,
  ];
  if (proto.props.length) {
    lines.push(
      `  props: [${proto.props.map((p) => `${p.name}:${p.kind}${p.defaultValue !== undefined ? `=${JSON.stringify(p.defaultValue)}` : ''}`).join(', ')}]`
    );
  }
  if (proto.states.length) {
    lines.push(
      `  states: [${proto.states.map((s) => `${s.name}:${s.kind}${s.initialValue !== undefined ? `=${JSON.stringify(s.initialValue)}` : ''}`).join(', ')}]`
    );
  }
  if (proto.exposes.length) {
    lines.push(`  exposes: [${proto.exposes.map((e) => `${e.name}:${e.kind}`).join(', ')}]`);
  }
  if (proto.hooks.length) {
    lines.push(`  hooks: [${proto.hooks.map((h) => `${h.name}(${h.kind})`).join(', ')}]`);
  }
  if (proto.staticStyleTokens.length) {
    lines.push(`  styles: [${proto.staticStyleTokens.join(' ')}]`);
  }
  if (proto.rules.length) {
    lines.push(`  rules: ${proto.rules.length}`);
  }
  lines.push(`  render: ${proto.render.kind}`);
  for (const fn of proto.functions) {
    lines.push('');
    lines.push(
      printSsaFunction(fn)
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n')
    );
  }
  lines.push('}');
  return lines.join('\n');
}

export function printModuleIR(mod: ModuleIR): string {
  const parts: string[] = [`; Proto UI SSA IR v${mod.irVersion}`, `; source: ${mod.sourceFile}`];
  for (const proto of mod.prototypes) {
    parts.push('', printPrototypeIR(proto));
  }
  for (const fn of mod.functions) {
    parts.push('', printSsaFunction(fn));
  }
  return parts.join('\n') + '\n';
}
