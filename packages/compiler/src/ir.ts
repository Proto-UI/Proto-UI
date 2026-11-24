import type { DataType } from './data-types';
import type { CallbackContext, SemanticOperation } from './operations';
import type { ContextKeyIR } from './context-declarations';
import type { SourceMapV3 } from './source-map';
import type { RuleDeclarationIR } from './rule-declarations';
import type { StyleTokenHandle } from './style-plan';
import type { ObservableSemantics } from './observable-semantics';
import type { GpuiNativeSdkIdentity } from './gpui-native-sdk';
import type { CompilerBuildIdentity } from './compiler-build';
import type { EcmaIntrinsicName } from './ecmascript-values';

/** Portable semantic IR. No TypeScript nodes, executable source snippets or live handles. */
export const IR_VERSION = 8 as const;

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
  'run-lifecycle',
  'decoration-target',
  'decoration-style',
  'control-label',
  'control-label-handle',
  'control-label-request',
  'focus-entry',
  'focus-roving',
  'focus-scope',
  'focus-scope-key',
  'focus-roving-key',
  'anatomy-family',
  'anatomy-part',
  'public-expose',
  'public-method',
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
  'native-link',
  'axis-input',
  'table-structure',
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
  'observed:number',
  'observed:string',
  'delay-task',
  'presence-owner',
  'presentation-owner-ref',
  'presentation-owner-writer',
  'presentation-view-binding',
] as const;
export type ModuleCapabilityType = (typeof MODULE_CAPABILITY_TYPES)[number];
/** Ordinary lexical values retain structure without becoming public JSON data. */
export type StructuredValueType =
  | {
      kind: 'callable';
      parameters: ParameterIR[];
      returnType: ValueType;
      /** Checked finite-key return signatures on synthesized capture getters. */
      lookup?: { key: string; type: ValueType }[];
    }
  | { kind: 'value-array'; element: ValueType; readonly?: boolean; minimumLength?: number }
  | { kind: 'set'; element: ValueType; readonly?: boolean }
  | { kind: 'map'; key: ValueType; value: ValueType; readonly?: boolean }
  | {
      kind: 'object';
      fields: {
        name: string;
        type: ValueType;
        optional?: boolean;
        readonly?: boolean;
        /** Reading invokes the stored zero-argument callable, never object creation. */
        accessor?: 'get';
      }[];
      index?: ValueType;
    }
  | { kind: 'value-union'; members: ValueType[] }
  | { kind: 'cell'; value: ValueType };
export type CaptureValueType = { kind: 'capture'; hookId: string };
export type ValueType =
  | DataType
  | StructuredValueType
  | CaptureValueType
  | `lexical:${PrimitiveType}`
  | ModuleCapabilityType
  | `nullable:${ModuleCapabilityType}`
  | `optional:${ModuleCapabilityType}`
  | 'unknown'
  | 'exception'
  | 'regexp'
  | 'intl-number-format'
  | 'def'
  | 'run'
  | 'authored-result'
  | 'render'
  | 'event'
  | 'event-control'
  | 'event-or-control'
  | 'host-event'
  | 'a11y-value-event'
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
  return typeof type === 'string'
    ? ['boolean', 'number', 'string', 'null', 'void'].includes(type)
    : ['literal', 'record', 'array', 'union'].includes(type.kind);
}

/** Compiler-private storage identity, never a semantic State or public capability. */
export function lexicalValueType(type: ValueType): PrimitiveType | undefined {
  if (type === 'lexical:boolean') return 'boolean';
  if (type === 'lexical:number') return 'number';
  if (type === 'lexical:string') return 'string';
  return undefined;
}

export function lexicalStoredType(type: ValueType): ValueType | undefined {
  return typeof type !== 'string' && type.kind === 'cell' ? type.value : lexicalValueType(type);
}

/** The setup boundary adapts a checked callable to render; creation alone does not. */
export function isSetupResultType(type: ValueType): boolean {
  if (type === 'function' || type === 'void') return true;
  if (typeof type === 'string') return false;
  if (type.kind === 'value-union' || type.kind === 'union')
    return type.members.every(isSetupResultType);
  return (
    type.kind === 'callable' &&
    type.parameters.length <= 1 &&
    (type.parameters.length === 0 || type.parameters[0].type === 'render')
  );
}

/** Public identity-bearing snapshots are not JSON and do not grant setup or Run authority. */
export function isPublicValueType(type: ValueType): boolean {
  if (isDataValueType(type)) return true;
  if (typeof type !== 'string') {
    if (type.kind === 'object')
      return (
        type.index === undefined &&
        type.fields.every((field) => !field.accessor && isPublicValueType(field.type))
      );
    if (type.kind === 'callable')
      return (
        type.parameters.every(
          (parameter) => !hasCaptureLookup(parameter.type) && isPublicValueType(parameter.type)
        ) && isPublicValueType(type.returnType)
      );
    if (type.kind === 'value-union') return type.members.every(isPublicValueType);
    if (type.kind === 'value-array') return isPublicValueType(type.element);
    return false;
  }
  const name = type.replace(/^(nullable|optional):/, '');
  return [
    'context-key',
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
    'presentation-owner-ref',
  ].includes(name);
}

/** Key-dependent getter results require a captured callable, not a host input promise. */
export function hasCaptureLookup(type: ValueType): boolean {
  if (typeof type === 'string') return false;
  if (type.kind === 'callable')
    return (
      type.lookup !== undefined ||
      type.parameters.some((parameter) => hasCaptureLookup(parameter.type)) ||
      hasCaptureLookup(type.returnType)
    );
  if (type.kind === 'object')
    return (
      type.fields.some((field) => hasCaptureLookup(field.type)) ||
      (type.index !== undefined && hasCaptureLookup(type.index))
    );
  if (type.kind === 'value-union') return type.members.some(hasCaptureLookup);
  if (type.kind === 'cell') return hasCaptureLookup(type.value);
  return false;
}

export function isCapabilityAssignable(actual: ValueType, expected: ValueType): boolean {
  // An identity-only join grants neither payload members nor control operations.
  if (expected === 'event-or-control') return actual === 'event' || actual === 'event-control';
  if (typeof expected !== 'string' || !/^(nullable|optional):/.test(expected)) return false;
  return (
    actual === expected.slice(expected.indexOf(':') + 1) ||
    actual === (expected.startsWith('nullable:') ? 'null' : 'void')
  );
}

/** Public State method surface from Core's Owned/Borrowed/Observed contract. */
export function stateHandleHasMethod(type: ValueType, name: string): boolean | undefined {
  if (typeof type !== 'string' || !/^(state|borrowed|observed):(boolean|number|string)$/.test(type))
    return undefined;
  if (name === 'get') return true;
  if (name === 'watch') return !type.startsWith('state:');
  if (name === 'set' || name === 'setDefault') return !type.startsWith('observed:');
  return undefined;
}

export type Operation = SemanticOperation;

export interface ParameterIR {
  name: string;
  type: ValueType;
  optional?: boolean;
  rest?: boolean;
  bindingId?: string;
  /** Evaluated at invocation, left to right, only for missing/undefined arguments. */
  default?: ExpressionIR;
}
export interface FunctionIR {
  parameters: ParameterIR[];
  body: StatementIR[];
  phase: Phase;
  context: FunctionContext;
  returnType: ValueType;
  captures?: { bindingId: string; name: string; storage: 'value' | 'cell' }[];
  span: SourceSpan;
}
interface ExpressionBase {
  type: ValueType;
  span: SourceSpan;
}
export type ExpressionIR = ExpressionBase &
  (
    | { kind: 'literal'; value: Primitive }
    | { kind: 'undefined' }
    | { kind: 'narrow'; value: ExpressionIR }
    | { kind: 'reference'; name: string; bindingId?: string }
    | { kind: 'lexical-cell'; value: ExpressionIR }
    | { kind: 'lexical-read'; cell: ExpressionIR }
    | { kind: 'lexical-write'; cell: ExpressionIR; value: ExpressionIR }
    | { kind: 'lexical-update'; cell: ExpressionIR; delta: 1 | -1; prefix: boolean }
    | { kind: 'context-key'; keyId: string }
    | { kind: 'static-capability'; declarationId: string }
    | { kind: 'style-handle'; handle: StyleTokenHandle }
    | {
        kind: 'rule';
        declaration: RuleDeclarationIR;
        receiver: ExpressionIR;
        states: readonly { id: string; value: ExpressionIR }[];
        styles?: readonly { id: string; value: ExpressionIR }[];
        targets?: readonly { id: string; value: ExpressionIR }[];
      }
    | { kind: 'member'; object: ExpressionIR; property: string; optional: boolean }
    | { kind: 'member-write'; object: ExpressionIR; property: string; value: ExpressionIR }
    | { kind: 'element'; object: ExpressionIR; index: ExpressionIR; optional: boolean }
    | { kind: 'conditional'; condition: ExpressionIR; then: ExpressionIR; otherwise: ExpressionIR }
    | {
        kind: 'call';
        callee: ExpressionIR;
        arguments: ExpressionIR[];
        optional: boolean;
        spread?: boolean[];
      }
    | {
        kind: 'intrinsic';
        name:
          | EcmaIntrinsicName
          | 'number.isFinite'
          | 'math.round'
          | 'math.floor'
          | 'string'
          | 'object.freeze'
          | 'object.assign'
          | 'object.hasOwn'
          | 'array.every'
          | 'array.includes'
          | 'array.some'
          | 'array.filter'
          | 'array.find'
          | 'array.findIndex'
          | 'array.map'
          | 'array.flatMap'
          | 'array.forEach'
          | 'array.slice'
          | 'array.from'
          | 'array.sort'
          | 'array.reduce'
          | 'array.push'
          | 'array.shift'
          | 'array.pop'
          | 'array.join'
          | 'array.isArray'
          | 'json.stringify'
          | 'set.create'
          | 'set.add'
          | 'set.has'
          | 'set.delete'
          | 'set.clear'
          | 'map.create'
          | 'map.get'
          | 'map.set'
          | 'map.has'
          | 'map.delete'
          | 'map.clear'
          | 'array.at'
          | 'typeof'
          | 'error';
        arguments: ExpressionIR[];
        /** Nullish collection receivers skip the call and its arguments. */
        optional?: boolean;
      }
    | {
        kind: 'object-spread';
        parts: (
          | { kind: 'spread'; value: ExpressionIR }
          | { kind: 'entry'; key: string; value: ExpressionIR; accessor?: 'get' }
        )[];
      }
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
          | 'in'
          | '&&'
          | '||'
          | '??';
        left: ExpressionIR;
        right: ExpressionIR;
      }
    | { kind: 'array'; elements: ExpressionIR[] }
    | { kind: 'array-spread'; parts: { spread: boolean; value: ExpressionIR }[] }
    | { kind: 'record'; entries: { key: string; value: ExpressionIR; accessor?: 'get' }[] }
    | {
        kind: 'operation';
        operation: Operation;
        receiver?: ExpressionIR;
        /** Nullish receiver returns undefined without evaluating arguments. */
        optional?: boolean;
        /** Independently checked registration schema, retained across demand pruning. */
        inputPayloadType?: 'event' | 'host-event' | 'a11y-value-event';
        arguments: ExpressionIR[];
      }
    | { kind: 'helper-call'; name: string; arguments: ExpressionIR[]; spread?: boolean[] }
    | { kind: 'authored-hook'; hookId: string; arguments?: ExpressionIR[] }
    | { kind: 'function'; function: FunctionIR }
  );

export type StatementIR =
  | {
      kind: 'const';
      name: string;
      bindingId?: string;
      value: ExpressionIR;
      /** Original structural position of a hoisted local function declaration. */
      declarationPosition?: number;
      span: SourceSpan;
    }
  | { kind: 'effect'; expression: ExpressionIR; span: SourceSpan }
  | { kind: 'while'; condition: ExpressionIR; body: StatementIR[]; span: SourceSpan }
  | {
      kind: 'for-of';
      name: string;
      bindingId?: string;
      iterable: ExpressionIR;
      body: StatementIR[];
      span: SourceSpan;
    }
  | {
      kind: 'if';
      condition: ExpressionIR;
      then: StatementIR[];
      otherwise: StatementIR[];
      span: SourceSpan;
    }
  | { kind: 'throw'; value: ExpressionIR; span: SourceSpan }
  | {
      kind: 'try';
      body: StatementIR[];
      catch?: { name?: string; body: StatementIR[] };
      finally?: StatementIR[];
      span: SourceSpan;
    }
  | { kind: 'return'; value?: ExpressionIR; span: SourceSpan };

/** Abrupt completion in this synchronous statement subset, including throws. */
export function statementsTerminate(body: readonly StatementIR[]): boolean {
  return body.some(
    (statement) =>
      statement.kind === 'return' ||
      statement.kind === 'throw' ||
      (statement.kind === 'if' &&
        statementsTerminate(statement.then) &&
        statementsTerminate(statement.otherwise)) ||
      (statement.kind === 'try' &&
        ((statement.finally !== undefined && statementsTerminate(statement.finally)) ||
          (statementsTerminate(statement.body) &&
            (!statement.catch || statementsTerminate(statement.catch.body)))))
  );
}

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
  kind?: 'as-hook' | 'hook';
  mode?: 'once' | 'multiple' | 'configurable';
  /** Caller input, retained even when setup/configure omit their options parameter. */
  optionsType?: ValueType;
  setup: FunctionIR;
  projectHandle?: FunctionIR;
  configure?: FunctionIR;
  capture?: HookCaptureIR;
  span: SourceSpan;
}
export interface HookCaptureIR {
  states: { name: string; type: ValueType; valueType?: DataType; definite?: boolean }[];
  methods: { name: string; type: Extract<ValueType, { kind: 'callable' }> }[];
  children: { id: string; name: string }[];
  events?: string[];
}

export interface PrototypeIR {
  schemaVersion: typeof IR_VERSION;
  name: string;
  source: { file: string; exportName: string; sha256: string };
  sourceFiles: readonly { file: string; content: string; sha256: string }[];
  setup: FunctionIR;
  hooks: AuthoredHookIR[];
  /** Reached source-module bindings, shared by instances of this compiled artifact. */
  moduleBindings?: Extract<StatementIR, { kind: 'const' }>[];
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
  /** Bare source import identities resolved by the file loader into the closed graph. */
  sourceImports?: Readonly<Record<string, string>>;
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
    compilerBuild?: CompilerBuildIdentity;
    irVersion: typeof IR_VERSION;
    backend: CompilerProfile;
    /** Reconstructable compile-time support selection, checked against emitted file bytes. */
    nativeSupport?: {
      version: 2;
      id: string;
      features: readonly string[];
      inputs?: readonly { file: string; sha256: string }[];
    };
    /** Expected native SDK bytes; file checking/publication verifies shared references. */
    nativeSdk?: GpuiNativeSdkIdentity & { path: string; bundled: boolean };
    /** Statically selected package exports and the package manifests that selected them. */
    sourceResolution?: {
      version: 1;
      imports: Readonly<Record<string, string>>;
      packages: readonly { manifest: string; sha256: string }[];
    };
    observableSemantics?: ObservableSemantics;
    /** Explicit consumer CSS dependency, only for the internal WC SSR experiment. */
    styleEnvironment?: {
      id: string;
      artifact: string;
      sha256: string;
      requiredCustomProperties: readonly string[];
    };
  };
}
