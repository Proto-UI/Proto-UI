import type { ModuleIR } from '../ir/types';
import { verifyModuleIR } from '../ir/verify';
import { err, type CompileResult, type CompilerDiagnostic } from '../diagnostics';
import { invokeLlvmBuilder } from './toolchain';

export interface LlvmEmitOptions {
  readonly targetTriple?: string;
}

export class LlvmEmissionError extends Error {
  constructor(readonly diagnostics: readonly CompilerDiagnostic[]) {
    super(diagnostics.map((entry) => entry.code + ': ' + entry.message).join('\n'));
    this.name = 'LlvmEmissionError';
  }
}

/** Preserve values that JSON's ordinary numeric representation cannot carry. */
function encodeScalar(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { $number: 'nan' };
    if (value === Infinity) return { $number: '+infinity' };
    if (value === -Infinity) return { $number: '-infinity' };
    if (Object.is(value, -0)) return { $number: '-zero' };
  }
  return value;
}

/**
 * Construct a real LLVM Module through the native LLVM API and print that module.
 * JSON is a compile-time transport for typed SSA; no emitted program reads it.
 */
export function emitLlvmIRResult(
  mod: ModuleIR,
  options: LlvmEmitOptions = {}
): CompileResult<string> {
  const issues = verifyModuleIR(mod);
  if (issues.length) return err(issues);
  return invokeLlvmBuilder(
    JSON.stringify(
      {
        protocolVersion: 1,
        targetTriple: options.targetTriple ?? 'wasm32-unknown-unknown',
        module: mod,
      },
      encodeScalar
    )
  );
}

export function emitLlvmIR(mod: ModuleIR, options: LlvmEmitOptions = {}): string {
  const result = emitLlvmIRResult(mod, options);
  if (!result.ok) throw new LlvmEmissionError(result.diagnostics);
  return result.value;
}
