import type { PropDeclIR, StateDeclIR, SsaType } from '../ir';

export function propKindToSsaType(kind: PropDeclIR['kind']): Exclude<SsaType, 'void'> {
  switch (kind) {
    case 'boolean':
      return 'i1';
    case 'number':
      return 'f64';
    case 'string':
    case 'enum':
      return 'i32'; // Interned string/enum ID in LLVM kernel ABI
    default:
      return 'ptr';
  }
}

export function stateKindToSsaType(kind: StateDeclIR['kind']): Exclude<SsaType, 'void'> {
  switch (kind) {
    case 'bool':
      return 'i1';
    case 'number.discrete':
    case 'number.range':
      return 'f64';
    case 'string':
    case 'enum':
      return 'i32';
  }
}

export function internString(table: string[], value: string): number {
  const existing = table.indexOf(value);
  if (existing >= 0) return existing;
  table.push(value);
  return table.length - 1;
}
