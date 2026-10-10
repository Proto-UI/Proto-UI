import type { DataType } from './data-types';
import type { CallbackContext, SemanticOperation } from './operations';
import type { ContextKeyIR } from './context-declarations';
import type { SourceMapV3 } from './source-map';
import type { RuleDeclarationIR } from './rule-declarations';
import type { StyleTokenHandle } from './style-plan';

/** Portable semantic IR. No TypeScript nodes, executable source snippets or live handles. */
export const IR_VERSION = 5 as const;

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
export type StaticValue =
  | Primitive
  | readonly StaticValue[]
  | { readonly [key: string]: StaticValue };
export type AnatomyFamilyIR = {
  debugName: string;
  roles: Readonly<
    Record<
      string,
      {
        cardinality: { min: number; max: number | '*' };
        requires?: readonly { kind: string; name: string }[];
      }
    >
  >;
  relations?: readonly { kind: string; parent: string; child: string }[];
};
export interface ModuleDeclarationIR {
  id: string;
  config: Readonly<Record<string, StaticValue>>;
  span: SourceSpan;
}
export interface StaticCapabilityIR {
  id: string;
  kind: 'anatomy-family' | 'focus-scope-key' | 'focus-roving-key' | 'a11y-ref';
  name: string;
  config: Readonly<Record<string, StaticValue>>;
  span: SourceSpan;
}
export const MODULE_CAPABILITY_TYPES = [
  'focus-entry',
  'focus-roving',
  'focus-scope',
  'focus-scope-key',
  'focus-roving-key',
  'anatomy-family',
  'anatomy-part',
  'anatomy-parts',
  'anatomy-order',
  'collection',
  'collection-item',
  'boundary',
  'hit-participation',
  'positioning',
  'overlay',
  'scroll',
  'text-control',
  'image-view',
  'table-structure',
  'transition',
  'scroll-axis',
  'scroll-follow',
  'table-states',
  'table-snapshot',
  'table-row',
  'table-cell',
  'table-diagnostic',
  'table-row-list',
  'table-cell-list',
  'table-diagnostic-list',
  'a11y-ref-list',
  'collection-snapshot',
  'collection-snapshot-list',
  'a11y-ref',
  'subscription-disposer',
  'binding-disposer',
  'host-target',
  'module-config',
  'boundary-outside-event',
  'boundary-sample',
  'borrowed:boolean',
  'borrowed:number',
  'borrowed:string',
  'state-event:boolean',
  'state-event:number',
  'state-event:string',
  'state-next:boolean',
  'state-next:number',
  'state-next:string',
  'state-disconnect',
  'transition-controls',
  'transition-action',
  'observed:number',
  'observed:string',
] as const;
export type ModuleCapabilityType = (typeof MODULE_CAPABILITY_TYPES)[number];
export type ValueType =
  | DataType
  | ModuleCapabilityType
  | `nullable:${ModuleCapabilityType}`
  | `optional:${ModuleCapabilityType}`
  | 'unknown'
  | 'def'
  | 'run'
  | 'render'
  | 'event'
  | 'host-event'
  | 'props'
  | 'focus'
  | 'accessible'
  | 'context-key'
  | 'style-handle'
  | 'style-disposer'
  | 'template-props'
  | 'rule-handle'
  | 'function'
  | 'record'
  | 'array'
  | 'template'
  | 'state:boolean'
  | 'observed:boolean'
  | 'state:number'
  | 'state:string';
export type Phase = 'setup' | 'callback' | 'render';
export type FunctionContext = 'setup' | 'render' | CallbackContext;
export type CompilerProfile =
  | 'react-runtime-v1'
  | 'react-dom-source-v1'
  | 'vue-source-v1'
  | 'vue2-source-v1'
  | 'web-component-source-v1'
  | 'gpui-source-v1'
  | 'qt-source-v1'
  | 'flutter-source-v1'
  | 'react-dom-ssr-v1'
  | 'vue-ssr-v1'
  | 'vue2-ssr-v1'
  | 'web-component-ssr-v1';

export function isDataValueType(type: ValueType): type is DataType {
  return typeof type !== 'string' || ['boolean', 'number', 'string', 'null', 'void'].includes(type);
}

/** Public identity-bearing snapshots are not JSON and do not grant setup or Run authority. */
export function isPublicValueType(type: ValueType): boolean {
  if (isDataValueType(type)) return true;
  const name = type.replace(/^(nullable|optional):/, '');
  return [
    'a11y-ref',
    'a11y-ref-list',
    'table-snapshot',
    'table-row',
    'table-cell',
    'table-diagnostic',
    'table-row-list',
    'table-cell-list',
    'table-diagnostic-list',
    'collection-snapshot',
    'collection-snapshot-list',
    'transition-controls',
    'transition-action',
  ].includes(name);
}

export function isCapabilityAssignable(actual: ValueType, expected: ValueType): boolean {
  if (typeof expected !== 'string' || !/^(nullable|optional):/.test(expected)) return false;
  return (
    actual === expected.slice(expected.indexOf(':') + 1) ||
    actual === (expected.startsWith('nullable:') ? 'null' : 'void')
  );
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
    | { kind: 'static-capability'; declarationId: string }
    | { kind: 'style-handle'; handle: StyleTokenHandle }
    | {
        kind: 'rule';
        declaration: RuleDeclarationIR;
        receiver: ExpressionIR;
        states: readonly { id: string; value: ExpressionIR }[];
      }
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
  | { name: string; kind: 'value'; type: ValueType; span: SourceSpan }
  | { name: string; kind: 'event'; payload: DataType; span: SourceSpan }
  | {
      name: string;
      kind: 'method';
      parameters: ParameterIR[];
      returnType: ValueType;
      span: SourceSpan;
    };

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
  staticDeclarations: StaticCapabilityIR[];
  moduleDeclarations: ModuleDeclarationIR[];
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
  supportingFiles?: readonly {
    path: string;
    contents: string;
    kind: 'source' | 'style' | 'declaration';
  }[];
  dependencies: {
    name: string;
    version: string;
    role: 'target' | 'host-bridge' | 'semantic-runtime';
  }[];
  provenance: {
    source: PrototypeIR['source'];
    irVersion: typeof IR_VERSION;
    backend: CompilerProfile;
    /** Explicit consumer CSS dependency, only for the internal WC SSR experiment. */
    styleEnvironment?: {
      id: string;
      artifact: string;
      sha256: string;
      requiredCustomProperties: readonly string[];
    };
  };
}
