import type { DataType } from './data-types';
import type { CallbackContext, SemanticOperation } from './operations';
import type { ContextKeyIR } from './context-declarations';
import type { SourceMapV3 } from './source-map';

/** Portable semantic IR. No TypeScript nodes, executable source snippets or live handles. */
export const IR_VERSION = 3 as const;

export interface SourceSpan {
  file: string;
  start: number;
  end: number;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export type Primitive = string | number | boolean | null;
export type PrimitiveType = 'boolean' | 'number' | 'string';
export type ValueType =
  | DataType
  | 'unknown'
  | 'def'
  | 'run'
  | 'render'
  | 'event'
  | 'props'
  | 'focus-options'
  | 'focus'
  | 'accessible'
  | 'context-key'
  | 'function'
  | 'record'
  | 'array'
  | 'template'
  | 'state:boolean'
  | 'state:number'
  | 'state:string';
export type Phase = 'setup' | 'callback' | 'render';
export type FunctionContext = 'setup' | 'render' | CallbackContext;
export type CompilerProfile =
  | 'react-runtime-v1'
  | 'react-dom-source-v1'
  | 'vue-source-v1'
  | 'vue2-source-v1'
  | 'web-component-source-v1';

export function isDataValueType(type: ValueType): type is DataType {
  return typeof type !== 'string' || ['boolean', 'number', 'string', 'null', 'void'].includes(type);
}

export type Operation = SemanticOperation;

export interface ParameterIR {
  name: string;
  type: ValueType;
  optional?: boolean;
}
export interface FunctionIR {
  parameters: ParameterIR[];
  body: StatementIR[];
  phase: Phase;
  context: FunctionContext;
  returnType: ValueType;
  span: SourceSpan;
}
interface ExpressionBase {
  type: ValueType;
  span: SourceSpan;
}
export type ExpressionIR = ExpressionBase &
  (
    | { kind: 'literal'; value: Primitive }
    | { kind: 'reference'; name: string }
    | { kind: 'context-key'; keyId: string }
    | { kind: 'member'; object: ExpressionIR; property: string; optional: boolean }
    | { kind: 'unary'; operator: '!' | '-' | '+'; operand: ExpressionIR }
    | {
        kind: 'binary';
        operator:
          | '==='
          | '!=='
          | '<'
          | '<='
          | '>'
          | '>='
          | '+'
          | '-'
          | '*'
          | '/'
          | '%'
          | '&&'
          | '||'
          | '??';
        left: ExpressionIR;
        right: ExpressionIR;
      }
    | { kind: 'array'; elements: ExpressionIR[] }
    | { kind: 'record'; entries: { key: string; value: ExpressionIR }[] }
    | {
        kind: 'operation';
        operation: Operation;
        receiver?: ExpressionIR;
        arguments: ExpressionIR[];
      }
    | { kind: 'helper-call'; name: string; arguments: ExpressionIR[] }
    | { kind: 'authored-hook'; hookId: string }
    | { kind: 'function'; function: FunctionIR }
  );

export type StatementIR =
  | { kind: 'const'; name: string; value: ExpressionIR; span: SourceSpan }
  | { kind: 'effect'; expression: ExpressionIR; span: SourceSpan }
  | {
      kind: 'if';
      condition: ExpressionIR;
      then: StatementIR[];
      otherwise: StatementIR[];
      span: SourceSpan;
    }
  | { kind: 'return'; value?: ExpressionIR; span: SourceSpan };

export interface PropIR {
  name: string;
  type: DataType;
  span: SourceSpan;
}
export type ExposureIR =
  | { name: string; kind: 'state'; type: PrimitiveType; span: SourceSpan }
  | { name: string; kind: 'event'; payload: DataType; span: SourceSpan }
  | { name: string; kind: 'method'; parameters: ParameterIR[]; returnType: ValueType; span: SourceSpan };

export interface AuthoredHookIR {
  id: string;
  name: string;
  setup: FunctionIR;
  span: SourceSpan;
}

export interface PrototypeIR {
  schemaVersion: typeof IR_VERSION;
  name: string;
  source: { file: string; exportName: string; sha256: string };
  sourceFiles: readonly { file: string; content: string; sha256: string }[];
  setup: FunctionIR;
  hooks: AuthoredHookIR[];
  contextKeys: ContextKeyIR[];
  props: PropIR[];
  exposes: ExposureIR[];
  /** Required semantic operation families, not an inferred full Adapter support matrix. */
  requirements: string[];
}

export interface CompilerDiagnostic {
  code: string;
  category:
    | 'invalid-input'
    | 'unsupported-input'
    | 'invalid-ir'
    | 'compiler-defect'
    | 'output-conflict'
    | 'output-write';
  message: string;
  span: SourceSpan;
}
export type CompileResult<T> =
  | { ok: true; value: T }
  | { ok: false; diagnostics: CompilerDiagnostic[] };

export interface ParseOptions {
  fileName?: string;
  exportName?: string;
  /** Explicit local source graph. Imports are parsed, never executed. Keys are normalized relative source paths. */
  files?: Readonly<Record<string, string>>;
}

export interface GeneratedModule {
  code: string;
  profile: CompilerProfile;
  sourceMap?: SourceMapV3;
  supportingFiles?: readonly { path: string; contents: string; kind: 'source' | 'style' | 'declaration' }[];
  dependencies: {
    name: string;
    version: string;
    role: 'target' | 'host-bridge' | 'semantic-runtime';
  }[];
  provenance: {
    source: PrototypeIR['source'];
    irVersion: typeof IR_VERSION;
    backend: CompilerProfile;
  };
}
