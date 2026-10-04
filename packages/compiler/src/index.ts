export { parsePrototype } from './parser';
export { compilePrototype, compileFile, compilationArtifacts, writeCompilation, diffCompilation } from './compile';
export type { Compilation, CompileOptions, FileCompileOptions, ExclusiveOutputFile } from './compile';
export { emitReact } from './react';
export { emitReactSource } from './react-source';
export { emitVueSource } from './vue-source';
export { emitVue2Source } from './vue2-source';
export { emitWebComponentSource } from './web-component-source';
export { emitGpuiSource } from './gpui-source';
export { gpuiNativeSdkFiles, GPUI_NATIVE_SDK_PATH, GPUI_NATIVE_SDK_VERSION } from './gpui-native-sdk';
export { emitQtSource } from './qt-source';
export { emitFlutterSource } from './flutter-source';
export { TARGET_PROFILES, resolveTargetProfile, checkTargetOperations } from './targets';
export type * from './targets';
export { parseDataType, dataTypeEqual, isAssignable, inferDataType, acceptsValue, formatDataType } from './data-types';
export type { DataType } from './data-types';
export { inferUnaryType, inferBinaryType, memberDataType } from './expression-types';
export { OPERATION_RULES, validateOperationPhase, validateOperationArguments, validateOperationCallback } from './operations';
export type * from './operations';
export { compileProject, CompilerProject } from './project';
export type * from './project';
export { watchProject } from './watch';
export type * from './watch';
export { writeArtifactSet } from './artifact-output';
export type { OutputArtifact, ArtifactDiff } from './artifact-output';
export { buildSourceMap } from './source-map';
export type * from './source-map';
export { buildNativeStaticDeclarations } from './native-static-declarations';
export type * from './native-static-declarations';
export { runCompilerCli } from './cli';
export { formatCompilerDiagnostic, formatCompilerDiagnostics, diagnosticsJson } from './diagnostic-format';
export { verifyConsumerClosure } from './consumer-closure';
export type * from './consumer-closure';
export { extractContextKeyDeclaration } from './context-declarations';
export { extractRuleDeclaration, extractRuleStyleHandle } from './rule-declarations';
export { lowerRulePlan, evaluateRulePlan } from './rule-plan';
export { evaluateStylePlan, diffStyleProjection } from './style-plan';
export type * from './style-plan';
export { CaseRegistry } from './conformance/registry';
export type * from './conformance/registry';
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
