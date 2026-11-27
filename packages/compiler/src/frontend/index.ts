export {
  createProtoProgram,
  getProtoSourceClosure,
  LANGUAGE_VERSION,
  RULE_SET_VERSION,
  COMPILER_VERSION,
  PRELUDE_PATH,
} from './program.ts';
export { analyzeProtoProgram, analyzeProtoFiles, PROTO_RULES } from './analyze.ts';
export { PROTO_TARGETS } from './types.ts';
export type {
  ProtoAnalysis,
  ProtoAnalysisOptions,
  ProtoClosureFile,
  ProtoDiagnostic,
  ProtoDiagnosticCategory,
  ProtoFileAnalysisOptions,
  ProtoMissingSource,
  ProtoProgramOptions,
  ProtoSourceClosure,
  ProtoSourceLocation,
  ProtoTarget,
  ProtoTargetAnalysis,
} from './types.ts';
