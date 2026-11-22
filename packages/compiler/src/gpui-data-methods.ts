import { portableDataMethods } from './portable-data-methods';
import type { PrototypeIR } from './ir';

/** Prove the existing GPUI data surface; invocation still belongs to a live owner. */
export function gpuiDataMethods(ir: PrototypeIR) {
  return portableDataMethods(ir, { sameSourceFileOnly: true });
}
