export { parsePrototype } from './parser';
export { compilePrototype, compileFile, writeCompilation } from './compile';
export type { Compilation, CompileOptions, ExclusiveOutputFile } from './compile';
export { emitReact } from './react';
export { validateIR } from './ir-validation';
export { IR_VERSION } from './ir';
export type * from './ir';
export { compareTraces, normalizeTrace, snapshotTrace, TraceRecorder } from './conformance/trace';
export type {
  SemanticCheckpoint,
  TraceValue,
  TraceComparison,
  TraceDifference,
  IdentityNormalization,
} from './conformance/trace';
export { assessCase, runOracleSuite, requireCaseCollection } from './conformance/result';
export type {
  ContractOracle,
  OracleExecution,
  ObservedRun,
  CaseResult,
  CaseStatus,
  FailureKind,
} from './conformance/result';
export { generateSequence, minimizeSequence } from './conformance/sequences';
