/** Private experimental semantic IR. No TypeScript nodes, source snippets, functions or live handles. */
export const IR_VERSION = 1 as const;

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
  | PrimitiveType
  | 'null'
  | 'void'
  | 'unknown'
  | 'def'
  | 'run'
  | 'render'
  | 'event'
  | 'props'
  | 'focus-options'
  | 'focus'
  | 'accessible'
  | 'function'
  | 'record'
  | 'array'
  | 'template'
  | 'state:boolean'
  | 'state:number'
  | 'state:string';
export type Phase = 'setup' | 'callback' | 'render';

export type Operation =
  | 'hook.asTrigger'
  | 'hook.asFocusable'
  | 'hook.asAccessible'
  | 'props.define'
  | 'props.setDefaults'
  | 'props.watch'
  | 'props.get'
  | 'state.bool'
  | 'state.string'
  | 'state.numberDiscrete'
  | 'state.numberRange'
  | 'state.get'
  | 'state.set'
  | 'expose.state'
  | 'expose.event'
  | 'expose.method'
  | 'expose.emit'
  | 'lifecycle.onCreated'
  | 'lifecycle.onMounted'
  | 'lifecycle.onUpdated'
  | 'lifecycle.onUnmounted'
  | 'lifecycle.onBeforeDispose'
  | 'event.on'
  | 'event.onGlobal'
  | 'event.requestDefaultActionPrevention'
  | 'focus.configure'
  | 'focus.setDisabled'
  | 'focus.focusSelf'
  | 'accessible.state'
  | 'accessible.action'
  | 'accessible.role'
  | 'accessible.nameFromContent'
  | 'render.el'
  | 'render.slot';

export interface ParameterIR {
  name: string;
  type: ValueType;
  optional?: boolean;
}
export interface FunctionIR {
  parameters: ParameterIR[];
  body: StatementIR[];
  phase: Phase;
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
  type: PrimitiveType;
  span: SourceSpan;
}
export type ExposureIR =
  | { name: string; kind: 'state'; type: PrimitiveType; span: SourceSpan }
  | { name: string; kind: 'event'; payload: 'void'; span: SourceSpan }
  | { name: string; kind: 'method'; parameters: ParameterIR[]; span: SourceSpan };

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
  setup: FunctionIR;
  hooks: AuthoredHookIR[];
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
    | 'output-conflict';
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
  profile: 'react-runtime-v1';
  dependencies: {
    name: string;
    version: string;
    role: 'target' | 'host-bridge' | 'semantic-runtime';
  }[];
  provenance: {
    source: PrototypeIR['source'];
    irVersion: typeof IR_VERSION;
    backend: 'react-runtime-v1';
  };
}
