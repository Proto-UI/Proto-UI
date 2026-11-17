import { callableEffectIssue } from './callable-effects';
import { FlowProof, functionCanMutateFlow, writtenMemberFields, type FlowMark } from './flow-proof';
import { types as nodeTypes } from 'node:util';
import { eventPayloadMemberType, eventValueJoin } from './event-types';
import { createHash } from 'node:crypto';
import { CompilerRejection, reject } from './diagnostics';
import {
  IR_VERSION,
  MODULE_CAPABILITY_TYPES,
  isDataValueType,
  isPublicValueType,
  isCapabilityAssignable,
  lexicalValueType,
  lexicalStoredType,
  isSetupResultType,
  type CompileResult,
  type FunctionContext,
  type ExpressionIR,
  type FunctionIR,
  type ModuleDeclarationIR,
  type Phase,
  type PrototypeIR,
  type SourceSpan,
  type StaticCapabilityIR,
  type ValueType,
} from './ir';
import {
  OPERATION_RULES,
  operationCallbackRule,
  operationArgumentRule,
  operationResultType,
  argumentData,
  argumentValue,
  validateOperationArguments,
  validateOperationPhase,
  isTemplateChildType,
  capabilityMemberType,
  capabilityBinaryType,
  stateValue,
  stateDeclarationData,
  finiteStringKeys,
  type ArgumentRule,
  type CallbackContext,
  type OperationBindings,
  type OperationRule,
  type SemanticOperation,
} from './operations';
import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';
import {
  inferBinaryType,
  inferUnaryType,
  memberDataType,
  conditionRefinements,
  stablePredicate,
  invalidateHeapFlow,
} from './expression-types';
import { sourceName } from './source-resolution';
import { lowerRulePlan } from './rule-plan';
import { assertTwTokenV0 } from '../../core/src/spec/feedback/tokens';
import { acceptsValue } from './data-types';
import type { RuleCondition, RuleDeclarationIR } from './rule-declarations';
import {
  valueTypeEqual,
  valueAssignable,
  joinValueTypes,
  objectFields,
  objectValueType,
  memberValueType,
  functionValueType,
  checkedCall,
  minimumArgumentCount,
  intrinsicResult,
  parameterValueType,
  canNarrowValue,
  valueAlternatives,
} from './value-types';
import { derivePrototypeCaptures } from './capture-analysis';
import { HOOK_API_TYPE, HOOK_TOOLS_TYPE } from './core-value-types';

const CAPABILITIES = new Set([
  'unknown',
  'def',
  'run',
  'render',
  'event',
  'event-control',
  'event-or-control',
  'host-event',
  'props',
  'focus',
  'accessible',
  'context-key',
  'style-handle',
  'style-disposer',
  'template-props',
  'rule-handle',
  'function',
  'record',
  'array',
  'template',
  'state:boolean',
  'observed:boolean',
  'state:number',
  'state:string',
  'lexical:boolean',
  'lexical:number',
  'lexical:string',
  'exception',
  ...MODULE_CAPABILITY_TYPES,
]);
CAPABILITIES.add('authored-result');
const CONTEXTS = new Set([
  'setup',
  'render',
  'helper',
  'event',
  'props-watch',
  'context-watch',
  'context-update',
  'state-watch',
  'collection-meta',
  'positioning',
  'control-label-target',
  'created',
  'mounted',
  'updated',
  'unmounted',
  'before-dispose',
  'expose-method',
]);
const RESERVED = new Set(
  'await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield'.split(
    ' '
  )
);
const FALLBACK: SourceSpan = {
  file: '<ir>',
  start: 0,
  end: 0,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

export function validIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !RESERVED.has(value)
  );
}
function bad(message: string, location: SourceSpan = FALLBACK): never {
  return reject('PUI2002', message, location, 'invalid-ir');
}
function object(value: unknown, allowed?: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    bad('IR requires plain data records.');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (allowed && !allowed.includes(key))) bad('Unknown IR field.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable)
      bad('IR accessors/non-data fields are forbidden.');
  }
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length)
    bad('IR requires a dense array.');
  if (Object.getPrototypeOf(value) !== Array.prototype && Object.getPrototypeOf(value) !== null)
    bad('IR array subclasses are forbidden.');
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key))
      bad('IR arrays cannot have custom properties.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable)
      bad('IR arrays cannot contain accessors.');
  }
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, i)) bad('IR arrays cannot be sparse.');
  return value;
}
function staticRecord(value: unknown, location: SourceSpan): Record<string, unknown> {
  const active = new Set<object>(),
    checked = new Set<object>();
  function visit(item: unknown): void {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!item || typeof item !== 'object')
      bad('Static declarations require finite JSON data.', location);
    if (active.has(item)) bad('Static declarations cannot contain cycles.', location);
    if (checked.has(item)) return;
    active.add(item);
    const children = Array.isArray(item) ? array(item) : Object.values(object(item));
    for (const child of children) visit(child);
    active.delete(item);
    checked.add(item);
  }
  const result = object(value);
  visit(result);
  return result;
}
function validateStaticConfig(
  kind: string,
  config: Record<string, unknown>,
  location: SourceSpan
): void {
  if (kind === 'a11y-ref') {
    if (Object.keys(config).length)
      bad('A11y semantic references have no configuration.', location);
    return;
  }
  if (kind === 'focus-scope-key' || kind === 'focus-roving-key') {
    if (
      Object.entries(config).some(
        ([key, value]) => !['kind', 'debugLabel'].includes(key) || typeof value !== 'string'
      )
    )
      bad('Focus key metadata supports only kind and debugLabel strings.', location);
    return;
  }
  object(config, ['roles', 'relations', 'profiles']);
  const roles = object(config.roles);
  if (!Object.hasOwn(roles, 'root')) bad('Anatomy family must define a root role.', location);
  function cardinality(value: unknown, base?: Record<string, unknown>): Record<string, unknown> {
    const declaration = object(value, ['min', 'max']);
    const min = declaration.min ?? base?.min,
      max = declaration.max ?? base?.max;
    if (
      typeof min !== 'number' ||
      min < 0 ||
      (max !== '*' && (typeof max !== 'number' || max < min))
    )
      bad('Invalid Anatomy role cardinality.', location);
    if (
      base &&
      (min < Number(base.min) ||
        (base.max !== '*' && (max === '*' || Number(max) > Number(base.max))))
    )
      bad('Anatomy profile cannot relax family cardinality.', location);
    return { min, max };
  }
  function requires(value: unknown): void {
    if (value === undefined) return;
    for (const item of array(value)) {
      const requirement = object(item, ['kind', 'name']);
      if (requirement.kind !== 'hook' || typeof requirement.name !== 'string' || !requirement.name)
        bad('Anatomy requirements need a nonempty hook name.', location);
    }
  }
  function relations(value: unknown): void {
    if (value === undefined) return;
    for (const item of array(value)) {
      const relation = object(item, ['kind', 'parent', 'child']);
      if (
        relation.kind !== 'contains' ||
        typeof relation.parent !== 'string' ||
        typeof relation.child !== 'string' ||
        !Object.hasOwn(roles, relation.parent) ||
        !Object.hasOwn(roles, relation.child)
      )
        bad('Anatomy relations must contain declared roles.', location);
    }
  }
  const limits = new Map<string, Record<string, unknown>>();
  for (const [name, value] of Object.entries(roles)) {
    const role = object(value, ['cardinality', 'requires']);
    limits.set(name, cardinality(role.cardinality));
    requires(role.requires);
  }
  relations(config.relations);
  if (config.profiles !== undefined)
    for (const value of Object.values(object(config.profiles))) {
      const profile = object(value, ['roles', 'relations']);
      if (profile.roles !== undefined)
        for (const [name, value] of Object.entries(object(profile.roles))) {
          if (!limits.has(name)) bad('Anatomy profile references an undeclared role.', location);
          const role = object(value, ['cardinality', 'requires']);
          if (role.cardinality !== undefined) cardinality(role.cardinality, limits.get(name));
          requires(role.requires);
        }
      relations(profile.relations);
    }
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) bad('IR requires a nonempty string.');
  return value;
}
function safeFile(value: unknown): string {
  const file = text(value);
  try {
    if (sourceName(file) !== file) bad('IR source paths must be canonical relative identities.');
  } catch (error) {
    if (error instanceof CompilerRejection)
      bad('IR source paths must remain within the declared source graph.');
    throw error;
  }
  return file;
}
function span(value: unknown): SourceSpan {
  const record = object(value, ['file', 'start', 'end', 'line', 'column', 'endLine', 'endColumn']);
  safeFile(record.file);
  for (const key of ['start', 'end', 'line', 'column', 'endLine', 'endColumn']) {
    const n = record[key];
    if (
      typeof n !== 'number' ||
      !Number.isSafeInteger(n) ||
      n < (key === 'start' || key === 'end' ? 0 : 1)
    )
      bad('Invalid IR source position.');
  }
  const result = record as unknown as SourceSpan;
  if (
    result.end < result.start ||
    result.endLine < result.line ||
    (result.endLine === result.line && result.endColumn < result.column)
  )
    bad('Reversed IR source span.');
  return result;
}
function valueType(value: unknown, location = FALLBACK): ValueType {
  if (typeof value === 'string' && CAPABILITIES.has(value)) return value as ValueType;
  if (
    typeof value === 'string' &&
    /^(nullable|optional):/.test(value) &&
    (MODULE_CAPABILITY_TYPES as readonly string[]).includes(value.slice(value.indexOf(':') + 1))
  )
    return value as ValueType;
  if (value && typeof value === 'object') {
    const type = object(value);
    if (type.kind === 'capture') {
      object(type, ['kind', 'hookId']);
      return { kind: 'capture', hookId: text(type.hookId) };
    }
    if (type.kind === 'cell') {
      object(type, ['kind', 'value']);
      return { kind: 'cell', value: valueType(type.value, location) };
    }
    if (type.kind === 'value-union') {
      object(type, ['kind', 'members']);
      return joinValueTypes(array(type.members).map((member) => valueType(member, location)));
    }
    if (type.kind === 'object') {
      object(type, ['kind', 'fields', 'index']);
      // Only the opaque JsonObject/HookApi store view is implemented. Typed
      // index signatures need dynamic public projection and are not admitted.
      if (type.index !== undefined && type.index !== 'unknown')
        bad('Indexed object values only admit the unknown internal-store view.', location);
      const names = new Set<string>();
      return {
        kind: 'object',
        ...(type.index !== undefined ? { index: valueType(type.index, location) } : {}),
        fields: array(type.fields).map((item) => {
          const field = object(item, ['name', 'type', 'optional', 'readonly']);
          const name = text(field.name);
          if (
            names.has(name) ||
            (field.optional !== undefined && typeof field.optional !== 'boolean') ||
            (field.readonly !== undefined && typeof field.readonly !== 'boolean')
          )
            bad('Invalid object value field.', location);
          names.add(name);
          return {
            name,
            type: valueType(field.type, location),
            ...(field.optional ? { optional: true } : {}),
            ...(field.readonly ? { readonly: true } : {}),
          };
        }),
      };
    }
    if (type.kind === 'callable') {
      object(type, ['kind', 'parameters', 'returnType']);
      return {
        kind: 'callable',
        parameters: array(type.parameters).map((item) => {
          const parameter = object(item, ['name', 'type', 'optional']);
          if (
            !validIdentifier(parameter.name) ||
            (parameter.optional !== undefined && typeof parameter.optional !== 'boolean')
          )
            bad('Invalid callable parameter.', location);
          return {
            name: parameter.name,
            type: valueType(parameter.type, location),
            ...(parameter.optional ? { optional: true } : {}),
          };
        }),
        returnType: valueType(type.returnType, location),
      };
    }
  }
  try {
    return parseDataType(value);
  } catch (error) {
    if (error instanceof TypeError) bad(error.message, location);
    throw error;
  }
}
function sameType(a: ValueType, b: ValueType): boolean {
  return valueTypeEqual(a, b);
}

/** Historical event labels may be corrected only in a proven covariant result. */
function matchesLegacyControlResult(recorded: ValueType, proven: ValueType): boolean {
  if (sameType(recorded, proven)) return true;
  if (recorded === 'event' && (proven === 'event-control' || proven === 'event-or-control'))
    return true;
  if (
    typeof recorded !== 'string' &&
    recorded.kind === 'callable' &&
    typeof proven !== 'string' &&
    proven.kind === 'callable'
  )
    return (
      sameType({ ...recorded, returnType: proven.returnType }, proven) &&
      matchesLegacyControlResult(recorded.returnType, proven.returnType)
    );
  return false;
}
function assignable(a: ValueType, b: ValueType): boolean {
  return (
    valueAssignable(a, b) ||
    (b === 'template' && isTemplateChildType(a)) ||
    isCapabilityAssignable(a, b) ||
    (isDataValueType(a) && isDataValueType(b) && isAssignable(a, b))
  );
}
function dataAction(location: SourceSpan, action: () => DataType): DataType {
  try {
    return action();
  } catch (error) {
    if (error instanceof TypeError) bad(error.message, location);
    throw error;
  }
}
function valueAction(location: SourceSpan, action: () => ValueType): ValueType {
  try {
    return action();
  } catch (error) {
    if (error instanceof TypeError) bad(error.message, location);
    throw error;
  }
}
const EXPRESSION_FIELDS = [
  'kind',
  'type',
  'span',
  'value',
  'name',
  'object',
  'property',
  'optional',
  'operator',
  'operand',
  'left',
  'right',
  'elements',
  'entries',
  'operation',
  'receiver',
  'arguments',
  'hookId',
  'keyId',
  'declarationId',
  'function',
  'handle',
  'declaration',
  'states',
  'cell',
  'delta',
  'prefix',
  'bindingId',
  'callee',
  'condition',
  'then',
  'otherwise',
  'parts',
  'index',
];
/** Validate the complete data graph before any semantic read or normalization.
 * In particular, unused fields cannot smuggle an accessor into a later copy.
 */
function assertDataGraph(input: unknown): void {
  const active = new Set<object>(),
    checked = new Set<object>();
  function visit(value: unknown): void {
    if (
      value === null ||
      value === undefined ||
      ['string', 'boolean', 'number'].includes(typeof value)
    )
      return;
    if (typeof value !== 'object' || nodeTypes.isProxy(value))
      bad('IR requires inert non-proxy data.');
    if (active.has(value)) bad('IR data cannot contain cycles.');
    if (checked.has(value)) return;
    const isArray = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== (isArray ? Array.prototype : Object.prototype))
      bad('IR contains a foreign prototype.');
    active.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') bad('IR symbol fields are forbidden.');
      const descriptor = descriptors[key];
      if (!('value' in descriptor) || (!descriptor.enumerable && !(isArray && key === 'length')))
        bad('IR accessors/non-data fields are forbidden.');
      visit(descriptor.value);
    }
    if (isArray) array(value);
    active.delete(value);
    checked.add(value);
  }
  visit(input);
}
const EXPRESSION_KIND_FIELDS: Readonly<Record<string, readonly string[]>> = {
  literal: ['value'],
  undefined: [],
  narrow: ['value'],
  reference: ['name', 'bindingId'],
  'lexical-cell': ['value'],
  'lexical-read': ['cell'],
  'lexical-write': ['cell', 'value'],
  'lexical-update': ['cell', 'delta', 'prefix'],
  'context-key': ['keyId'],
  'static-capability': ['declarationId'],
  'style-handle': ['handle'],
  rule: ['declaration', 'receiver', 'states'],
  member: ['object', 'property', 'optional'],
  'member-write': ['object', 'property', 'value'],
  element: ['object', 'index', 'optional'],
  conditional: ['condition', 'then', 'otherwise'],
  call: ['callee', 'arguments', 'optional'],
  intrinsic: ['name', 'arguments'],
  'object-spread': ['parts'],
  unary: ['operator', 'operand'],
  binary: ['operator', 'left', 'right'],
  array: ['elements'],
  record: ['entries'],
  function: ['function'],
  'helper-call': ['name', 'arguments'],
  'authored-hook': ['hookId', 'arguments'],
  operation: ['operation', 'receiver', 'optional', 'arguments'],
};
const STATEMENT_KIND_FIELDS: Readonly<Record<string, readonly string[]>> = {
  const: ['name', 'bindingId', 'value'],
  effect: ['expression'],
  if: ['condition', 'then', 'otherwise'],
  throw: ['value'],
  try: ['body', 'catch', 'finally'],
  return: ['value'],
};
function exactKindFields(
  node: Record<string, unknown>,
  kinds: Readonly<Record<string, readonly string[]>>,
  base: readonly string[]
): void {
  if (typeof node.kind !== 'string' || !Object.hasOwn(kinds, node.kind))
    bad('Unknown IR node kind.');
  object(node, [...base, ...kinds[node.kind]]);
}

interface Parameter {
  name: string;
  type: ValueType;
  optional?: boolean;
  bindingId?: string;
  stateData?: DataType;
  default?: ExpressionIR;
  origin: object;
}
interface Binding {
  uninitializedParameter?: boolean;
  uninitializedLexical?: boolean;
  type: ValueType;
  origin: object;
  helper?: FunctionIR;
  helperOrigin?: object;
  keyId?: string;
  bindingId?: string;
  stateData?: DataType;
  narrowed?: ValueType;
  predicate?: ExpressionIR;
  flowBase?: ValueType;
  flowAt?: FlowMark;
}
type Scope = Map<string, Binding>;

export function validateIR(input: unknown): CompileResult<PrototypeIR> {
  try {
    assertDataGraph(input);
    const writtenFields = writtenMemberFields(input);
    let flow = new FlowProof(writtenFields);

    const replacements = new Map<object, Record<string, unknown>>();
    const provenExpressions = new Map<object, ValueType>();
    const provenReturns = new Map<object, ValueType>();
    // Target walkers memoize by FunctionIR identity. A shared function must not
    // denote different lexical helper closures in different occurrences.
    const provenCaptures = new Map<object, ReadonlyMap<string, Binding>>();
    const captureFrames: {
      outer: Scope;
      parameters: ReadonlySet<string>;
      captures: Map<string, Binding>;
    }[] = [];
    function readBinding(name: string, scope: Scope): Binding | undefined {
      const binding = scope.get(name);
      // Parameters/local declarations may shadow an outer name. Aliases preserve
      // their value origin; record the immutable entry binding, not local narrowing.
      for (const frame of captureFrames) {
        const captured = frame.outer.get(name);
        if (
          !frame.parameters.has(name) &&
          binding &&
          captured &&
          binding.origin === captured.origin
        )
          frame.captures.set(name, captured);
      }
      return binding;
    }
    function refinedScope(scope: Scope, condition: ExpressionIR, truth: boolean): Scope {
      normalizeFlow(scope);
      const result = new Map(scope);
      if (condition.kind === 'reference') {
        const binding = scope.get(condition.name);
        if (binding?.predicate && !lexicalStoredType(binding.type))
          return refinedScope(scope, binding.predicate, truth);
      }
      for (const [name, type] of conditionRefinements(condition, truth, flow.current)) {
        const binding = result.get(name);
        if (binding)
          result.set(name, {
            ...binding,
            flowAt: flow.mark(binding.bindingId ?? name),
            ...(lexicalStoredType(binding.type)
              ? { narrowed: type }
              : { type, flowBase: binding.flowBase ?? binding.type }),
          });
      }
      return result;
    }
    function normalizeFlow(scope: Scope): void {
      for (const [name, binding] of scope) {
        const mark = binding.flowAt;
        if (!mark) continue;
        const key = binding.bindingId ?? name,
          stored = lexicalStoredType(binding.type);
        if (stored && flow.cellChanged(mark, key))
          scope.set(name, { ...binding, narrowed: undefined, flowAt: flow.mark(key) });
        else if (flow.heapChanged(mark))
          scope.set(name, {
            ...binding,
            ...(stored
              ? {
                  narrowed: binding.narrowed
                    ? invalidateHeapFlow(binding.narrowed, stored, writtenFields)
                    : undefined,
                }
              : {
                  type: invalidateHeapFlow(
                    binding.type,
                    binding.flowBase ?? binding.type,
                    writtenFields
                  ),
                }),
            flowAt: flow.mark(key),
          });
      }
    }
    function invalidateFlow(scope: Scope, cells: boolean, allFields = false): void {
      if (cells) flow.call();
      else flow.writeHeap();
      for (const [name, binding] of scope) {
        const original = binding.flowBase ?? binding.type;
        const fields = allFields
          ? new Set(objectFields(original)?.map((field) => field.name))
          : writtenFields;
        const stored = lexicalStoredType(binding.type);
        if (stored)
          scope.set(name, {
            ...binding,
            narrowed: cells
              ? undefined
              : binding.narrowed
                ? invalidateHeapFlow(binding.narrowed, stored, fields)
                : undefined,
          });
        else if (binding.flowBase)
          scope.set(name, { ...binding, type: invalidateHeapFlow(binding.type, original, fields) });
      }
    }
    function sameCapture(a: Binding, b: Binding): boolean {
      if (!sameType(a.type, b.type) || a.keyId !== b.keyId) return false;
      return a.helperOrigin || b.helperOrigin
        ? a.helperOrigin !== undefined && a.helperOrigin === b.helperOrigin
        : a.origin === b.origin;
    }
    function replaceField(node: object, field: string, value: unknown): void {
      replacements.set(node, { ...replacements.get(node), [field]: value });
    }
    // Copy only after data safety has been established; descriptor values never invoke getters.
    function canonicalCopy<T>(value: T, copies = new Map<object, unknown>()): T {
      if (!value || typeof value !== 'object') return value;
      if (copies.has(value)) return copies.get(value) as T;
      const output: unknown[] | Record<string, unknown> = Array.isArray(value)
        ? []
        : Object.create(Object.getPrototypeOf(value));
      copies.set(value, output);
      flow.copyObservation(value, output);
      const changes = replacements.get(value);
      for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        const child = changes && Object.hasOwn(changes, key) ? changes[key] : descriptor.value;
        Object.defineProperty(output, key, {
          value: canonicalCopy(child, copies),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return output as T;
    }
    const root = object(input, [
      'schemaVersion',
      'name',
      'source',
      'sourceFiles',
      'setup',
      'hooks',
      'contextKeys',
      'staticDeclarations',
      'moduleDeclarations',
      'moduleBindings',
      'props',
      'exposes',
      'requirements',
    ]);
    if (root.schemaVersion !== IR_VERSION)
      reject('PUI2001', 'Unsupported private IR schema version.', FALLBACK, 'invalid-ir');
    text(root.name);
    const source = object(root.source, ['file', 'exportName', 'sha256']);
    const entry = safeFile(source.file);
    text(source.exportName);
    if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256))
      bad('Invalid source digest.');
    const sourceFiles = new Map<string, string>();
    for (const value of array(root.sourceFiles)) {
      const file = object(value, ['file', 'content', 'sha256']);
      const name = safeFile(file.file);
      if (sourceFiles.has(name) || typeof file.content !== 'string')
        bad('Duplicate or invalid source file.');
      if (file.sha256 !== createHash('sha256').update(file.content).digest('hex'))
        bad('Source file digest does not match its recorded content.');
      sourceFiles.set(name, file.content);
    }
    if (!sourceFiles.has(entry)) bad('Entry is missing from recorded source graph.');
    const graphDigest = createHash('sha256')
      .update(JSON.stringify([...sourceFiles].sort(([a], [b]) => a.localeCompare(b))))
      .digest('hex');
    if (source.sha256 !== graphDigest) bad('Source graph digest does not match recorded inputs.');
    const props = new Map<string, DataType>();
    for (const value of array(root.props)) {
      const prop = object(value, ['name', 'type', 'span']);
      const name = text(prop.name),
        location = span(prop.span),
        type = valueType(prop.type, location);
      if (props.has(name) || !isDataValueType(type) || type === 'void')
        bad('Invalid or duplicate prop metadata.', location);
      props.set(name, type);
    }
    const keys = new Map<string, DataType>();
    for (const value of array(root.contextKeys)) {
      const key = object(value, ['id', 'name', 'type', 'span']);
      const id = text(key.id);
      text(key.name);
      const type = valueType(key.type, span(key.span));
      if (keys.has(id) || !isDataValueType(type)) bad('Invalid context key metadata.');
      const members = typeof type !== 'string' && type.kind === 'union' ? type.members : [type];
      if (members.some((member) => typeof member === 'string' || member.kind !== 'record'))
        bad('Context keys must declare JSON object values.');
      keys.set(id, type);
    }
    const exposures = new Map<string, Record<string, unknown>>();
    for (const value of array(root.exposes)) {
      const exposure = object(value, [
        'name',
        'kind',
        'type',
        'payload',
        'parameters',
        'returnType',
        'span',
      ]);
      const name = text(exposure.name),
        location = span(exposure.span);
      if (exposures.has(name)) bad('Duplicate expose metadata.', location);
      if (exposure.kind === 'state') {
        if (!['boolean', 'number', 'string'].includes(String(exposure.type)))
          bad('Invalid exposed state type.', location);
      } else if (exposure.kind === 'value') {
        if (!isPublicValueType(valueType(exposure.type, location)))
          bad('Invalid public Expose value boundary.', location);
      } else if (exposure.kind === 'event') {
        if (!isDataValueType(valueType(exposure.payload, location)))
          bad('Outward event payload must be serializable data.', location);
      } else if (exposure.kind === 'method') {
        parameters(exposure.parameters);
        if (!isPublicValueType(valueType(exposure.returnType, location)))
          bad('Exposed methods cannot return setup or execution-scope capabilities.', location);
      } else bad('Invalid exposure kind.', location);
      exposures.set(name, exposure);
    }
    const staticCapabilities = new Map<string, StaticCapabilityIR>();
    for (const value of array(root.staticDeclarations)) {
      const capability = object(value, ['id', 'kind', 'name', 'config', 'span']);
      const id = text(capability.id),
        location = span(capability.span);
      if (
        !['anatomy-family', 'focus-scope-key', 'focus-roving-key', 'a11y-ref'].includes(
          String(capability.kind)
        )
      )
        bad('Invalid static capability kind.', location);
      text(capability.name);
      const config = staticRecord(capability.config, location);
      if (staticCapabilities.has(id)) bad('Duplicate static capability declaration.', location);
      validateStaticConfig(String(capability.kind), config, location);
      staticCapabilities.set(id, capability as unknown as StaticCapabilityIR);
    }
    const moduleDeclarations = new Map<string, ModuleDeclarationIR>();
    for (const value of array(root.moduleDeclarations)) {
      const declaration = object(value, ['id', 'config', 'span']);
      const id = text(declaration.id),
        location = span(declaration.span);
      if (moduleDeclarations.has(id)) bad('Duplicate Module declaration.', location);
      const config = staticRecord(declaration.config, location);
      if (id === '@proto.ui/text-control/declaration') {
        if (
          Object.keys(config).some((key) => !['content', 'lineMode', 'engine'].includes(key)) ||
          config.content !== 'plain-text' ||
          !['single', 'multiline'].includes(String(config.lineMode)) ||
          config.engine !== 'host'
        )
          bad(
            'Text Control requires content plain-text, lineMode single or multiline, and engine host.',
            location
          );
      } else if (id === '@proto.ui/image-view/declaration') {
        if (
          Object.keys(config).some(
            (key) => !['source', 'alternativeText', 'a11yMode', 'fit'].includes(key)
          ) ||
          typeof config.source !== 'string' ||
          typeof config.alternativeText !== 'string' ||
          !['informative', 'decorative'].includes(String(config.a11yMode)) ||
          !['contain', 'cover', 'fill'].includes(String(config.fit))
        )
          bad(
            'Image View requires source/alternativeText strings, informative or decorative a11yMode, and contain/cover/fill fit.',
            location
          );
      } else bad('Unknown Module declaration.', location);
      moduleDeclarations.set(id, declaration as unknown as ModuleDeclarationIR);
    }
    const hooks = array(root.hooks).map((value) =>
      object(value, [
        'id',
        'name',
        'kind',
        'mode',
        'optionsType',
        'setup',
        'projectHandle',
        'configure',
        'capture',
        'span',
      ])
    );
    const hookIds = new Set<string>();
    for (const hook of hooks) {
      const id = text(hook.id);
      text(hook.name);
      span(hook.span);
      if (hook.kind !== undefined && hook.kind !== 'as-hook' && hook.kind !== 'hook')
        bad('Invalid authored hook kind.');
      if (
        hook.mode !== undefined &&
        !['once', 'multiple', 'configurable'].includes(String(hook.mode))
      )
        bad('Invalid authored hook mode.');
      if (hook.kind !== 'hook' && hook.mode !== undefined && hook.mode !== 'once')
        bad('An as-hook installs once per owner.');
      if (hook.kind === 'hook') valueType(hook.optionsType, span(hook.span));
      else if (hook.optionsType !== undefined) bad('As-hooks have no invocation options.');
      if (hook.capture !== undefined) {
        const capture = object(hook.capture, ['states', 'methods', 'children']);
        for (const item of array(capture.states)) {
          const state = object(item, ['name', 'type', 'valueType']);
          text(state.name);
          if (!stateValue(valueType(state.type)))
            bad('Capture State metadata requires a State capability.');
          if (state.valueType !== undefined && !isDataValueType(valueType(state.valueType)))
            bad('Capture State value schema must be data.');
        }
        for (const item of array(capture.methods)) {
          const method = object(item, ['name', 'type']);
          text(method.name);
          const type = valueType(method.type);
          if (typeof type === 'string' || type.kind !== 'callable')
            bad('Capture method metadata requires a callable signature.');
        }
        for (const item of array(capture.children)) {
          const child = object(item, ['id', 'name']);
          text(child.id);
          text(child.name);
        }
      }
      if (hookIds.has(id)) bad('Duplicate authored hook identity.');
      hookIds.add(id);
    }
    for (const requirement of array(root.requirements)) text(requirement);
    const active = new Set<object>();
    function parameters(value: unknown): Parameter[] {
      const names = new Set<string>();
      let optionalSeen = false;
      return array(value).map((item) => {
        const param = object(item, ['name', 'type', 'optional', 'bindingId', 'default']);
        if (
          !validIdentifier(param.name) ||
          names.has(param.name) ||
          (param.optional !== undefined && typeof param.optional !== 'boolean')
        )
          bad('Invalid function parameter.');
        if (optionalSeen && param.optional !== true && param.default === undefined)
          bad('Required parameter follows an optional parameter.');
        optionalSeen ||= param.optional === true && param.default === undefined;
        names.add(param.name);
        return {
          name: param.name,
          type: valueType(param.type),
          origin: param,
          ...(param.optional === true ? { optional: true } : {}),
          ...(param.bindingId !== undefined ? { bindingId: text(param.bindingId) } : {}),
          ...(param.default !== undefined ? { default: param.default as ExpressionIR } : {}),
        };
      });
    }
    function fn(value: unknown, outer: Scope, expectedPhase?: Phase): FunctionIR {
      const func = object(value, [
        'parameters',
        'body',
        'phase',
        'context',
        'returnType',
        'captures',
        'span',
      ]);
      const location = span(func.span),
        phase = String(func.phase) as Phase,
        context = String(func.context) as FunctionContext;
      if (
        !['setup', 'callback', 'render'].includes(phase) ||
        (expectedPhase && phase !== expectedPhase) ||
        !CONTEXTS.has(context) ||
        (context !== 'helper' &&
          (phase !== 'callback' ? context !== phase : context === 'setup' || context === 'render'))
      )
        bad('Function phase/context mismatch.', location);
      if (expectedPhase === 'setup' && context !== 'setup')
        bad('Function phase/context mismatch.', location);
      const params = parameters(func.parameters);
      let declaredReturn = valueType(func.returnType, location);
      if (
        context === 'setup' &&
        (params.length > 1 || (params.length === 1 && params[0].type !== 'def'))
      )
        bad('Setup signature must receive its definition handle.', location);
      if (context === 'setup' && !isSetupResultType(declaredReturn))
        bad('Setup must return a render function or void.', location);
      const previousFlow = flow;
      flow = new FlowProof(writtenFields);
      const scope: Scope = new Map(
        [...outer].map(([name, binding]) => [
          name,
          {
            ...binding,
            narrowed: undefined,
            uninitializedParameter: false,
            uninitializedLexical: false,
          },
        ])
      );
      invalidateFlow(scope, false);
      for (const parameter of params)
        scope.set(parameter.name, {
          type: parameterValueType(parameter),
          origin: parameter.origin,
          bindingId: parameter.bindingId,
          uninitializedParameter: true,
        });
      const returns: ValueType[] = [],
        captures = new Map<string, Binding>();
      captureFrames.push({
        outer,
        parameters: new Set(params.map((parameter) => parameter.name)),
        captures,
      });
      let terminal: boolean;
      try {
        for (const parameter of params) {
          if (
            parameter.default !== undefined &&
            !assignable(expression(parameter.default, scope, phase, context, true), parameter.type)
          )
            bad('Parameter default does not satisfy its declared type.', location);
          scope.set(parameter.name, {
            type: parameterValueType(parameter),
            origin: parameter.origin,
            ...(parameter.bindingId ? { bindingId: parameter.bindingId } : {}),
          });
        }
        terminal = statements(func.body, scope, phase, context, returns);
      } finally {
        captureFrames.pop();
        flow = previousFlow;
      }
      if (func.captures !== undefined) {
        const ids = new Set<string>();
        for (const item of array(func.captures)) {
          const capture = object(item, ['bindingId', 'name', 'storage']);
          const id = text(capture.bindingId),
            name = text(capture.name),
            binding = captures.get(name);
          if (
            ids.has(id) ||
            !binding ||
            binding.bindingId !== id ||
            capture.storage !== (lexicalStoredType(binding.type) ? 'cell' : 'value')
          )
            bad('Capture must identify the resolved lexical binding.', location);
          ids.add(id);
        }
        if (ids.size !== captures.size)
          bad('Capture metadata must include every captured binding.', location);
      }
      const priorCaptures = provenCaptures.get(func);
      if (
        priorCaptures &&
        (priorCaptures.size !== captures.size ||
          [...captures].some(
            ([name, binding]) =>
              !priorCaptures.has(name) || !sameCapture(priorCaptures.get(name)!, binding)
          ))
      )
        bad('Shared IR function has inconsistent lexical capture provenance.', location);
      provenCaptures.set(func, captures);
      if (!terminal) returns.push('void');
      // IR5 producers historically labelled control values as event. Normalize only
      // a result proven by this function's validated body, never from a supplied label.
      const inferredEventReturn = eventValueJoin(returns);
      if (
        declaredReturn === 'event' &&
        inferredEventReturn !== undefined &&
        inferredEventReturn !== 'event'
      ) {
        declaredReturn = inferredEventReturn;
        replaceField(func, 'returnType', declaredReturn);
      } else if (
        returns.length &&
        !sameType(declaredReturn, returns[0]) &&
        returns.every((type) => sameType(type, returns[0])) &&
        matchesLegacyControlResult(declaredReturn, returns[0])
      ) {
        declaredReturn = returns[0];
        replaceField(func, 'returnType', declaredReturn);
      }
      if (!returns.every((type) => assignable(type, declaredReturn)))
        bad('Function returns do not satisfy recorded result type.', location);
      const priorReturn = provenReturns.get(func);
      if (priorReturn !== undefined && !sameType(priorReturn, declaredReturn))
        bad('Shared IR function has inconsistent result provenance.', location);
      provenReturns.set(func, declaredReturn);
      return (replacements.has(func)
        ? { ...func, returnType: declaredReturn }
        : func) as unknown as FunctionIR;
    }
    function helperContext(helper: FunctionIR, context: FunctionContext, phase: Phase): void {
      const inspect = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(inspect);
          return;
        }
        const node = value as Record<string, unknown>;
        if (node.kind === 'function') return;
        if (node.kind === 'operation') {
          const issues = validateOperationPhase(
            String(node.operation),
            phase,
            phase === 'callback' ? (context as CallbackContext) : undefined
          );
          if (issues.length) bad(issues[0].message, span(node.span));
        }
        for (const [key, child] of Object.entries(node))
          if (key !== 'span' && key !== 'type') inspect(child);
      };
      inspect(helper.body);
    }
    function expression(
      value: unknown,
      scope: Scope,
      phase: Phase,
      context: FunctionContext,
      allowFunction = false,
      argumentRule?: ArgumentRule,
      lexical?: 'create' | 'reference'
    ): ValueType {
      normalizeFlow(scope);
      const node = object(value, EXPRESSION_FIELDS),
        location = span(node.span);
      exactKindFields(node, EXPRESSION_KIND_FIELDS, ['kind', 'type', 'span']);
      if (active.has(node)) bad('Cyclic IR expression.', location);
      active.add(node);
      try {
        let type: ValueType;
        switch (node.kind) {
          case 'undefined':
            type = 'void';
            break;
          case 'narrow': {
            const source = expression(node.value, scope, phase, context, true),
              target = valueType(node.type, location);
            // Only use literal/nominal evidence after recursively validating the
            // complete source expression and all its declared types above.
            if (
              !canNarrowValue(source, target) &&
              !valueAssignable(argumentValue(node.value as ExpressionIR), target)
            )
              bad('Type narrowing cannot grant unproven data or capability authority.', location);
            type = target;
            break;
          }
          case 'literal':
            if (
              (node.value !== null &&
                !['boolean', 'number', 'string'].includes(typeof node.value)) ||
              (typeof node.value === 'number' && !Number.isFinite(node.value))
            )
              bad('IR literals must be finite primitives.', location);
            const recordedLiteral = valueType(node.type, location);
            type =
              typeof recordedLiteral !== 'string' &&
              recordedLiteral.kind === 'literal' &&
              recordedLiteral.value === node.value
                ? recordedLiteral
                : node.value === null
                  ? 'null'
                  : (typeof node.value as ValueType);
            break;
          case 'reference':
            if (!validIdentifier(node.name) || !scope.has(node.name))
              bad('Unbound IR reference.', location);
            if (scope.get(String(node.name))?.uninitializedParameter)
              bad(
                'A parameter default cannot read its current or a later uninitialized parameter.',
                location
              );
            if (scope.get(String(node.name))?.uninitializedLexical)
              bad('A lexical binding cannot be read before its initialization.', location);
            type = readBinding(node.name, scope)!.type;
            if (
              node.bindingId !== undefined &&
              readBinding(node.name, scope)!.bindingId !== text(node.bindingId)
            )
              bad('Reference binding identity mismatch.', location);
            if (lexicalStoredType(type) && lexical !== 'reference')
              bad('Lexical storage identities cannot escape through value references.', location);
            break;
          case 'lexical-cell': {
            if (lexical !== 'create')
              bad('Lexical storage must be declared by a binding.', location);
            const initial = expression(node.value, scope, phase, context);
            const recorded = valueType(node.type, location);
            if (typeof recorded !== 'string' && recorded.kind === 'cell') {
              if (
                !assignable(initial, recorded.value) &&
                !assignable(argumentData(node.value as ExpressionIR) ?? initial, recorded.value)
              )
                bad('Lexical initializer does not satisfy its storage type.', location);
              type = recorded;
            } else {
              if (initial !== 'boolean' && initial !== 'number' && initial !== 'string')
                bad('Primitive lexical storage requires a scalar initializer.', location);
              type = `lexical:${initial}`;
            }
            break;
          }
          case 'lexical-read':
          case 'lexical-write':
          case 'lexical-update': {
            const target = object(node.cell, EXPRESSION_FIELDS);
            if (target.kind !== 'reference')
              bad('Lexical access needs a declared storage binding.', location);
            const storage = expression(
              target,
              scope,
              phase,
              context,
              false,
              undefined,
              'reference'
            );
            const scalar = lexicalStoredType(storage);
            if (!scalar) bad('Lexical access cannot mutate a value or semantic handle.', location);
            if (node.kind === 'lexical-write') {
              const value = expression(node.value, scope, phase, context);
              if (!assignable(value, scalar)) bad('Lexical write type mismatch.', location);
              const binding = readBinding(String(target.name), scope)!;
              flow.writeCell(binding.bindingId ?? String(target.name));
              scope.set(String(target.name), {
                ...binding,
                narrowed: undefined,
                flowAt: flow.mark(binding.bindingId ?? String(target.name)),
              });
            } else if (node.kind === 'lexical-update') {
              const binding = readBinding(String(target.name), scope)!;
              flow.writeCell(binding.bindingId ?? String(target.name));
              if (
                scalar !== 'number' ||
                (node.delta !== 1 && node.delta !== -1) ||
                typeof node.prefix !== 'boolean'
              )
                bad(
                  'Lexical update requires a number, unit delta and explicit prefix flag.',
                  location
                );
            }
            type =
              node.kind === 'lexical-read'
                ? (readBinding(String(target.name), scope)?.narrowed ?? scalar)
                : scalar;
            break;
          }
          case 'static-capability':
            const declarationId = text(node.declarationId);
            if (!staticCapabilities.has(declarationId))
              bad('Unknown static capability declaration.', location);
            type = staticCapabilities.get(declarationId)!.kind;
            break;
          case 'context-key':
            if (!keys.has(text(node.keyId))) bad('Unknown context declaration identity.', location);
            type = 'context-key';
            break;
          case 'style-handle': {
            const handle = object(node.handle, ['kind', 'tokens']);
            if (handle.kind !== 'tw')
              bad('Only checked portable token handles are admitted.', location);
            for (const token of array(handle.tokens)) {
              if (typeof token !== 'string') bad('Style token must be a string.', location);
              try {
                assertTwTokenV0(token, 'compiler IR');
              } catch (error) {
                bad(error instanceof Error ? error.message : String(error), location);
              }
            }
            type = 'style-handle';
            break;
          }
          case 'rule': {
            if (phase !== 'setup' || expression(node.receiver, scope, phase, context) !== 'def')
              bad('Rule declarations are setup-only.', location);
            const declaration = node.declaration as RuleDeclarationIR;
            const plan = lowerRulePlan([declaration], location);
            if (!plan.ok) bad(plan.diagnostics[0].message, location);
            const stateTypes = new Map<string, DataType>();
            for (const item of array(node.states)) {
              const state = object(item, ['id', 'value']),
                id = text(state.id);
              const handleType = expression(state.value, scope, phase, context);
              const primitive = stateValue(handleType);
              if (stateTypes.has(id) || !primitive) bad('Invalid Rule state reference.', location);
              stateTypes.set(id, primitive);
            }
            for (const dependency of declaration.deps) {
              if (
                dependency.kind === 'prop'
                  ? !props.has(dependency.key)
                  : !stateTypes.has(dependency.id)
              )
                bad('Rule dependency does not resolve to a declared source.', dependency.span);
            }
            const check = (condition: RuleCondition): void => {
              if (condition.type === 'eq') {
                const valueType =
                  condition.left.type === 'prop'
                    ? props.get(condition.left.key)
                    : stateTypes.get(condition.left.id);
                if (!valueType || !acceptsValue(valueType, condition.right))
                  bad('Rule literal does not match its source type.', condition.span);
              } else if (condition.type === 'not') check(condition.expr);
              else if (condition.type === 'all' || condition.type === 'any')
                condition.exprs.forEach(check);
            };
            check(declaration.when);
            type = 'rule-handle';
            break;
          }
          case 'array': {
            const types = array(node.elements).map((item) =>
              expression(item, scope, phase, context)
            );
            if (types.every(isDataValueType))
              type = { kind: 'array', element: parseDataType({ kind: 'union', members: types }) };
            else if (types.every((type) => type === 'a11y-ref')) type = 'a11y-ref-list';
            else if (types.every(isTemplateChildType)) type = 'array';
            else bad('Data arrays cannot contain semantic handles.', location);
            break;
          }
          case 'record': {
            const recorded = valueType(node.type, location);
            if (typeof recorded !== 'string' && recorded.kind === 'object') {
              const fields: Extract<ValueType, { kind: 'object' }>['fields'] = [];
              const names = new Set<string>();
              for (const item of array(node.entries)) {
                const entry = object(item, ['key', 'value']),
                  name = text(entry.key);
                if (names.has(name)) bad('Duplicate IR record key.', location);
                names.add(name);
                fields.push({ name, type: expression(entry.value, scope, phase, context, true) });
              }
              type = { kind: 'object', fields };
              break;
            }
            const fields: { name: string; type: DataType }[] = [],
              names = new Set<string>();
            let templateProps = false,
              moduleConfig = false;
            for (const item of array(node.entries)) {
              const entry = object(item, ['key', 'value']),
                name = text(entry.key);
              if (names.has(name)) bad('Duplicate IR record key.', location);
              names.add(name);
              const fieldRule = argumentRule?.fields?.[name];
              const field = expression(
                entry.value,
                scope,
                phase,
                context,
                !!fieldRule?.callback,
                fieldRule
              );
              if (!isDataValueType(field)) {
                if (phase === 'render' && name === 'style' && field === 'style-handle')
                  templateProps = true;
                else if (
                  ['def', 'run', 'render'].includes(String(field)) ||
                  (field === 'function' && !fieldRule?.callback)
                )
                  bad(
                    'Configuration records cannot contain execution-scope handles or escaping callbacks.',
                    location
                  );
                else moduleConfig = true;
              } else fields.push({ name, type: field });
            }
            if (templateProps && names.size !== 1)
              bad('TemplateProps supports only one style handle.', location);
            type = moduleConfig
              ? 'module-config'
              : templateProps
                ? 'template-props'
                : { kind: 'record', fields };
            break;
          }
          case 'unary': {
            const operand = expression(node.operand, scope, phase, context);
            if (node.operator === '!' && !isDataValueType(operand)) {
              type = 'boolean';
              break;
            }
            if (!isDataValueType(operand)) bad('Unary operators require data.', location);
            type = dataAction(location, () => inferUnaryType(String(node.operator), operand));
            break;
          }
          case 'binary': {
            const left = expression(node.left, scope, phase, context);
            const rightScope =
              node.operator === '&&' || node.operator === '||'
                ? refinedScope(scope, node.left as ExpressionIR, node.operator === '&&')
                : scope;
            const right = expression(node.right, rightScope, phase, context);
            const capabilityType = capabilityBinaryType(String(node.operator), left, right);
            if (capabilityType) {
              type = capabilityType;
              break;
            }
            if (
              ['&&', '||', '??'].includes(String(node.operator)) &&
              (!isDataValueType(left) || !isDataValueType(right))
            ) {
              const retained = valueAlternatives(left).filter((type) =>
                node.operator === '??'
                  ? type !== 'null' && type !== 'void'
                  : node.operator === '&&'
                    ? type === 'null' || type === 'void' || type === 'boolean'
                    : type !== 'null' && type !== 'void'
              );
              type = joinValueTypes([...retained, right]);
              break;
            }
            if (
              (node.operator === '===' || node.operator === '!==') &&
              (!isDataValueType(left) || !isDataValueType(right))
            ) {
              type = 'boolean';
              break;
            }
            if (!isDataValueType(left) || !isDataValueType(right))
              bad('Binary operators require data.', location);
            type = dataAction(location, () => inferBinaryType(String(node.operator), left, right));
            break;
          }
          case 'member': {
            const owner = expression(node.object, scope, phase, context),
              key = text(node.property);
            if (typeof node.optional !== 'boolean')
              bad('IR member optionality must be explicit.', location);
            if (
              typeof owner !== 'string' &&
              (owner.kind === 'union' || owner.kind === 'value-union')
            ) {
              type = valueAction(location, () =>
                joinValueTypes(
                  valueAlternatives(owner).map((member) => {
                    if (member === 'null' || member === 'void') {
                      if (node.optional) return 'void';
                      throw new TypeError('Nullish member receiver.');
                    }
                    const capability = capabilityMemberType(member, key, node.optional as boolean);
                    if (capability !== undefined) return capability;
                    if (member === 'props' && props.has(key)) return props.get(key)!;
                    if (member === 'exception') return 'exception';
                    return memberValueType(member, key, node.optional as boolean);
                  })
                )
              );
              break;
            }
            const capabilityType = capabilityMemberType(owner, key, node.optional as boolean);
            if (capabilityType !== undefined) type = capabilityType;
            else if (owner === 'exception') type = 'exception';
            else if (owner === 'props' && props.has(key)) type = props.get(key)!;
            else if (eventPayloadMemberType(owner, key) !== undefined)
              type = eventPayloadMemberType(owner, key)!;
            else if (isDataValueType(owner))
              type = dataAction(location, () =>
                memberDataType(owner, key, { optional: node.optional as boolean })
              );
            else
              type = valueAction(location, () =>
                memberValueType(owner, key, node.optional as boolean)
              );
            break;
          }
          case 'member-write': {
            const owner = expression(node.object, scope, phase, context),
              key = text(node.property);
            const field =
              objectFields(owner)?.find((field) => field.name === key) ??
              (typeof owner !== 'string' && owner.kind === 'object' && owner.index !== undefined
                ? { name: key, type: owner.index }
                : undefined);
            if (!field || field.readonly)
              bad('Member writes require a declared mutable ordinary field.', location);
            const written = expression(node.value, scope, phase, context, true);
            if (!assignable(written, field.type)) bad('Member write type mismatch.', location);
            type = written;
            invalidateFlow(scope, false, true);
            break;
          }
          case 'element': {
            const owner = expression(node.object, scope, phase, context),
              index = expression(node.index, scope, phase, context);
            if (typeof node.optional !== 'boolean')
              bad('Element access optionality must be explicit.', location);
            if (typeof owner !== 'string' && owner.kind === 'array' && index === 'number')
              type = joinValueTypes([owner.element, 'void']);
            else if (
              typeof owner !== 'string' &&
              owner.kind === 'object' &&
              owner.index !== undefined &&
              index === 'string'
            )
              type = joinValueTypes([owner.index, 'void']);
            else if (objectFields(owner) && index === 'string')
              // A finite field list does not close a structural record's runtime key set.
              type = 'unknown';
            else bad('Dynamic indexing requires an ordinary array or record.', location);
            break;
          }
          case 'conditional': {
            expression(node.condition, scope, phase, context);
            const branch = (truth: boolean): Scope => {
              const result = new Map(scope);
              return refinedScope(result, node.condition as ExpressionIR, truth);
            };
            type = joinValueTypes([
              expression(node.then, branch(true), phase, context, true),
              expression(node.otherwise, branch(false), phase, context, true),
            ]);
            break;
          }
          case 'call': {
            if (typeof node.optional !== 'boolean')
              bad('Call optionality must be explicit.', location);
            const callee = expression(node.callee, scope, phase, context, true);
            const args = array(node.arguments).map((argument) =>
              expression(argument, scope, phase, context, true)
            );
            type = valueAction(location, () =>
              checkedCall(
                callee,
                args.map((type) =>
                  type === 'props'
                    ? { kind: 'record', fields: [...props].map(([name, type]) => ({ name, type })) }
                    : type
                ),
                node.optional as boolean
              )
            );
            const calleeNode = object(node.callee, EXPRESSION_FIELDS);
            const helper =
              calleeNode.kind === 'reference'
                ? readBinding(String(calleeNode.name), scope)?.helper
                : undefined;
            if (helper && context !== 'helper') helperContext(helper, context, phase);
            if (
              functionCanMutateFlow(
                helper ??
                  (calleeNode.kind === 'function'
                    ? (calleeNode.function as FunctionIR)
                    : undefined),
                node.arguments as ExpressionIR[]
              )
            )
              invalidateFlow(scope, true);
            break;
          }
          case 'intrinsic': {
            const args = array(node.arguments).map((argument) =>
              expression(argument, scope, phase, context, true)
            );
            type = valueAction(location, () => intrinsicResult(text(node.name), args));
            if (node.name === 'array.every') invalidateFlow(scope, true);
            break;
          }
          case 'object-spread': {
            const fields = new Map<
              string,
              Extract<ValueType, { kind: 'object' }>['fields'][number]
            >();
            for (const item of array(node.parts)) {
              const part = object(item, ['kind', 'key', 'value']);
              const value = expression(part.value, scope, phase, context, true);
              if (part.kind === 'entry') {
                const name = text(part.key);
                fields.set(name, { name, type: value });
              } else if (part.kind === 'spread' && part.key === undefined) {
                const source = objectFields(value);
                if (!source) bad('Object spread requires a checked ordinary record.', location);
                for (const { readonly: _readonly, ...field } of source)
                  fields.set(field.name, field);
              } else bad('Invalid object spread part.', location);
            }
            type = objectValueType([...fields.values()]);
            break;
          }
          case 'function': {
            const checked = fn(node.function, scope);
            const recorded = valueType(node.type, location);
            if (typeof recorded !== 'string' && recorded.kind === 'callable')
              type = functionValueType(checked);
            else {
              if (!allowFunction)
                bad('Untyped escaping function values are unsupported.', location);
              type = 'function';
            }
            break;
          }
          case 'helper-call': {
            if (!validIdentifier(node.name)) bad('Invalid helper name.', location);
            const binding = readBinding(node.name, scope);
            if (binding?.uninitializedLexical)
              bad('A lexical binding cannot be read before its initialization.', location);
            const helper = binding?.helper;
            if (!helper) bad('Unknown or recursive helper call.', location);
            const args = array(node.arguments),
              signature = functionValueType(helper),
              required = minimumArgumentCount(signature.parameters);
            if (args.length < required || args.length > helper.parameters.length)
              bad('Helper argument count mismatch.', location);
            args.forEach((argument, index) => {
              // Validate the entire expression and its declared type before
              // using literal contents as evidence for the helper parameter.
              const actual = expression(argument, scope, phase, context);
              const expected = helper.parameters[index].type;
              const supplied: ValueType =
                actual === 'props'
                  ? { kind: 'record', fields: [...props].map(([name, type]) => ({ name, type })) }
                  : (argumentData(argument as ExpressionIR) ?? actual);
              if (
                !(actual === 'void' && signature.parameters[index].optional) &&
                !assignable(actual, expected) &&
                !assignable(supplied, expected)
              )
                bad('Helper argument type mismatch.', location);
            });
            if (context !== 'helper') helperContext(helper, context, phase);
            type = helper.returnType;
            if (functionCanMutateFlow(helper, node.arguments as ExpressionIR[]))
              invalidateFlow(scope, true);
            break;
          }
          case 'authored-hook':
            if ((phase !== 'setup' && context !== 'helper') || !hookIds.has(text(node.hookId)))
              bad('Invalid authored-hook call.', location);
            const hook = hooks.find((hook) => hook.id === node.hookId)!;
            const hookArgs = node.arguments === undefined ? [] : array(node.arguments);
            hookArgs.forEach((argument) => {
              const actual = expression(argument, scope, phase, context, true);
              if (
                hook.kind === 'hook' &&
                actual !== 'void' &&
                !assignable(actual, valueType(hook.optionsType, location))
              )
                bad('Hook options do not satisfy its declared caller input.', location);
            });
            if (hook.kind !== 'hook' && hookArgs.length)
              bad('As-hooks do not accept invocation options.', location);
            if (hook.kind === 'hook' && hookArgs.length > 1)
              bad('A hook accepts at most one options argument.', location);
            type = hook.projectHandle
              ? valueType(object(hook.projectHandle).returnType, location)
              : hook.capture
                ? { kind: 'capture', hookId: String(hook.id) }
                : 'authored-result';
            break;
          case 'operation': {
            const operation = text(node.operation);
            if (!Object.hasOwn(OPERATION_RULES, operation))
              bad('Unknown semantic operation.', location);
            const rule: OperationRule = OPERATION_RULES[operation as SemanticOperation];
            const issues = validateOperationPhase(
              operation,
              phase,
              phase === 'callback' ? (context as CallbackContext) : undefined
            );
            if (issues.length && context !== 'helper') bad(issues[0].message, location);
            let receiver =
              node.receiver === undefined
                ? undefined
                : expression(node.receiver, scope, phase, context);
            if (node.optional !== undefined && typeof node.optional !== 'boolean')
              bad('Optional operation flag must be boolean.', location);
            const receiverWasNullish = receiver !== undefined && node.optional === true;
            if (
              receiverWasNullish &&
              typeof receiver !== 'string' &&
              receiver?.kind === 'value-union'
            )
              receiver = joinValueTypes(
                receiver.members.filter((type) => type !== 'null' && type !== 'void')
              );
            const captureReceiver =
              receiver && typeof receiver !== 'string' && receiver.kind === 'capture'
                ? receiver
                : undefined;
            if (captureReceiver) receiver = 'authored-result';
            const args = array(node.arguments),
              bindings: OperationBindings = {
                declaredEvents: new Set(
                  [...exposures].filter(([, entry]) => entry.kind === 'event').map(([name]) => name)
                ),
                propNames: new Set(props.keys()),
                stateValueType: stateValue(receiver),
                stateDataType:
                  (node.receiver as ExpressionIR | undefined)?.kind === 'reference'
                    ? scope.get(
                        (node.receiver as Extract<ExpressionIR, { kind: 'reference' }>).name
                      )?.stateData
                    : undefined,
                ...(phase === 'callback' ? { callbackContext: context as CallbackContext } : {}),
              };
            if (captureReceiver) {
              const owner = hooks.find((hook) => hook.id === captureReceiver.hookId);
              if (!owner?.capture)
                bad('Capture operation requires a checked hook capture.', location);
              bindings.capture = owner.capture as import('./ir').HookCaptureIR;
              const key = args[0] as ExpressionIR | undefined;
              bindings.captureKey =
                key?.kind === 'literal' && typeof key.value === 'string' ? key.value : undefined;
              bindings.childHandles = new Map(
                hooks.map((hook) => [
                  String(hook.id),
                  hook.projectHandle
                    ? valueType(object(hook.projectHandle).returnType)
                    : { kind: 'capture', hookId: String(hook.id) },
                ])
              );
            }
            const first = args[0] ? object(args[0], EXPRESSION_FIELDS) : undefined;
            if (first?.kind === 'context-key')
              bindings.contextValueType = keys.get(text(first.keyId));
            else if (first && valueType(first.type, location) === 'context-key')
              bindings.contextValueType = { kind: 'object', fields: [], index: 'unknown' };
            if (operation === 'event.on' || operation === 'event.onGlobal') {
              if (first?.kind !== 'literal' || typeof first.value !== 'string')
                bad('Input registrations require static types.', location);
              bindings.inputPayloadType = first.value.startsWith('host:') ? 'host-event' : 'event';
            }
            if (operation === 'expose.emit' || operation === 'expose.method') {
              if (operation === 'expose.emit') {
                const names = first
                  ? finiteStringKeys(first as unknown as ExpressionIR)
                  : undefined;
                if (!names) bad('Emit requires finite declared event keys.', location);
                const types = names.map((name) => {
                  const exposure = exposures.get(name);
                  if (!exposure || exposure.kind !== 'event')
                    bad('Emit requires a declared outward event.', location);
                  return valueType(exposure.payload, location) as DataType;
                });
                if (!types.every((type) => sameType(type, types[0])))
                  bad('Dynamic events require one shared payload signature.', location);
                bindings.eventPayloadType = types[0];
              } else {
                if (first?.kind !== 'literal' || typeof first.value !== 'string')
                  bad('Expose method requires a static declared key.', location);
                const exposure = exposures.get(first.value);
                if (!exposure || exposure.kind !== 'method')
                  bad('Expose method must have recorded signature.', location);
                bindings.methodParameters = parameters(exposure.parameters);
                bindings.methodReturnType = valueType(exposure.returnType, location);
              }
            }
            args.forEach((argument, index) => {
              const callback = operationCallbackRule(operation, index);
              const record = object(argument, EXPRESSION_FIELDS);
              exactKindFields(record, EXPRESSION_KIND_FIELDS, ['kind', 'type', 'span']);
              if (callback && (!callback.acceptsValue || record.kind === 'function')) {
                const callbackType = valueType(record.type, location);
                if (typeof callbackType !== 'string' && callbackType.kind === 'callable') {
                  expression(
                    argument,
                    scope,
                    phase,
                    context,
                    true,
                    operationArgumentRule(operation, index)
                  );
                  return;
                }
                if (record.kind !== 'function' || valueType(record.type, location) !== 'function')
                  bad('Operation requires a checked callback.', location);
                const checked = fn(record.function, scope, callback.phase);
                const expectedContext =
                  callback.contextFrom === 'caller' ? context : callback.context;
                if (checked.context !== expectedContext)
                  bad('Callback origin cannot grant another lifecycle authority.', location);
              } else
                expression(
                  argument,
                  scope,
                  phase,
                  context,
                  false,
                  operationArgumentRule(operation, index)
                );
            });
            const argumentIssues = validateOperationArguments(
              operation,
              args as never,
              receiver,
              bindings
            );
            if (argumentIssues.length) bad(argumentIssues[0].message, location);
            if (operation === 'expose.state') {
              const exposure =
                first?.kind === 'literal' ? exposures.get(String(first.value)) : undefined;
              const handle = args[1] ? object(args[1], EXPRESSION_FIELDS) : undefined;
              if (
                !exposure ||
                exposure.kind !== 'state' ||
                !handle ||
                stateValue(valueType(handle.type, location)) !== exposure.type
              )
                bad('Exposed state metadata does not match declared source.', location);
            }
            if (operation === 'expose.value') {
              const exposure =
                first?.kind === 'literal' ? exposures.get(String(first.value)) : undefined;
              const value = args[1] ? object(args[1], EXPRESSION_FIELDS) : undefined;
              if (
                !exposure ||
                exposure.kind !== 'value' ||
                !value ||
                !sameType(valueType(exposure.type, location), valueType(value.type, location))
              )
                bad('Exposed value metadata does not match its declared source.', location);
            }
            type = operationResultType(operation, receiver, bindings)!;
            if (type === undefined) bad('Semantic operation has unresolved result type.', location);
            if (receiverWasNullish) type = joinValueTypes([type, 'void']);
            if (
              OPERATION_RULES[operation as SemanticOperation].effects.some((effect) =>
                ['write', 'signal', 'request-update'].includes(effect.kind)
              )
            )
              invalidateFlow(scope, true);
            break;
          }
          default:
            bad('Unknown IR expression kind.', location);
        }
        const priorType = provenExpressions.get(node);
        if (priorType !== undefined && !sameType(priorType, type))
          bad('Shared IR expression has inconsistent provenance.', location);
        provenExpressions.set(node, type);
        const recordedType = valueType(node.type, location);
        if (!sameType(recordedType, type) && matchesLegacyControlResult(recordedType, type))
          replaceField(node, 'type', type);
        else if (!sameType(recordedType, type)) bad('IR expression type mismatch.', location);
        flow.observe(node as unknown as ExpressionIR);
        return type;
      } finally {
        active.delete(node);
      }
    }
    function statements(
      value: unknown,
      scope: Scope,
      phase: Phase,
      context: FunctionContext,
      returns: ValueType[]
    ): boolean {
      let terminal = false;
      // Lexical slots exist before execution; their initializers retain source order/TDZ.
      for (const item of array(value)) {
        const declaration = object(item);
        if (declaration.kind !== 'const' || !validIdentifier(declaration.name)) continue;
        const initializer = object(declaration.value, EXPRESSION_FIELDS);
        if (scope.has(declaration.name)) continue;
        scope.set(declaration.name, {
          type: valueType(initializer.type),
          origin: declaration,
          uninitializedLexical: true,
          ...(declaration.bindingId !== undefined
            ? { bindingId: text(declaration.bindingId) }
            : {}),
          ...(initializer.kind === 'function'
            ? {
                helper: initializer.function as FunctionIR,
                helperOrigin: initializer.function as object,
              }
            : {}),
        });
      }
      for (const item of array(value)) {
        const node = object(item, [
            'kind',
            'span',
            'name',
            'value',
            'expression',
            'condition',
            'then',
            'otherwise',
            'body',
            'catch',
            'finally',
            'bindingId',
          ]),
          location = span(node.span);
        exactKindFields(node, STATEMENT_KIND_FIELDS, ['kind', 'span']);
        // Still validate unreachable syntax, but it cannot change a helper's reachable result.
        const reachableReturns = terminal ? [] : returns;
        if (active.has(node)) bad('Cyclic IR statements.', location);
        active.add(node);
        try {
          switch (node.kind) {
            case 'const': {
              if (
                !validIdentifier(node.name) ||
                (scope.has(node.name) && scope.get(node.name)!.origin !== node)
              )
                bad('Invalid/rebound local identifier.', location);
              const val = object(node.value, EXPRESSION_FIELDS),
                type = expression(
                  val,
                  scope,
                  phase,
                  context,
                  val.kind === 'function',
                  undefined,
                  'create'
                );
              const alias = val.kind === 'reference' ? scope.get(String(val.name)) : undefined;
              scope.set(node.name, {
                ...alias,
                type,
                origin: alias?.origin ?? node,
                uninitializedLexical: false,
                stateData: stateDeclarationData(val as unknown as ExpressionIR) ?? alias?.stateData,
                predicate:
                  (val.kind === 'binary' || val.kind === 'unary') &&
                  stablePredicate(val as unknown as ExpressionIR)
                    ? (val as unknown as ExpressionIR)
                    : alias?.predicate,
                ...(node.bindingId !== undefined ? { bindingId: text(node.bindingId) } : {}),
                ...(val.kind === 'function'
                  ? { helper: fn(val.function, scope), helperOrigin: val.function as object }
                  : {}),
              });
              break;
            }
            case 'effect':
              expression(node.expression, scope, phase, context);
              break;
            case 'if': {
              expression(node.condition, scope, phase, context);
              const branch = (truth: boolean): Scope => {
                const next = new Map(scope);
                return refinedScope(next, canonicalCopy(node.condition) as ExpressionIR, truth);
              };
              const thenScope = branch(true),
                elseScope = branch(false);
              const a = statements(node.then, thenScope, phase, context, reachableReturns),
                b = statements(node.otherwise, elseScope, phase, context, reachableReturns);
              const continuing = a ? elseScope : b ? thenScope : undefined;
              if (continuing)
                for (const name of scope.keys()) scope.set(name, continuing.get(name)!);
              else
                for (const [name, binding] of scope) {
                  const stored = lexicalStoredType(binding.type);
                  if (stored)
                    scope.set(name, {
                      ...binding,
                      narrowed: joinValueTypes([
                        thenScope.get(name)?.narrowed ?? stored,
                        elseScope.get(name)?.narrowed ?? stored,
                      ]),
                    });
                }
              terminal ||= a && b;
              break;
            }
            case 'return':
              reachableReturns.push(
                node.value === undefined
                  ? 'void'
                  : expression(node.value, scope, phase, context, phase === 'setup')
              );
              terminal = true;
              break;
            case 'throw': {
              const type = expression(node.value, scope, phase, context);
              if (!isDataValueType(type) && type !== 'exception')
                bad('Thrown values must be admitted data or a caught exception.', location);
              terminal = true;
              break;
            }
            case 'try': {
              if (node.catch === undefined && node.finally === undefined)
                bad('Try requires catch or finally.', location);
              const branchReturns: ValueType[] = [];
              const bodyTerminal = statements(
                node.body,
                new Map(scope),
                phase,
                context,
                branchReturns
              );
              invalidateFlow(scope, true);
              let catchTerminal = true;
              if (node.catch !== undefined) {
                const caught = object(node.catch, ['name', 'body']);
                const catchScope = new Map(scope);
                if (caught.name !== undefined) {
                  if (!validIdentifier(caught.name) || catchScope.has(caught.name))
                    bad('Invalid/rebound catch binding.', location);
                  catchScope.set(caught.name, { type: 'exception', origin: caught });
                }
                catchTerminal = statements(caught.body, catchScope, phase, context, branchReturns);
              }
              const finalReturns: ValueType[] = [];
              const finalTerminal =
                node.finally === undefined
                  ? false
                  : statements(node.finally, new Map(scope), phase, context, finalReturns);
              if (!finalTerminal) reachableReturns.push(...branchReturns);
              reachableReturns.push(...finalReturns);
              terminal ||= finalTerminal || (bodyTerminal && catchTerminal);
              invalidateFlow(scope, true);
              break;
            }
            default:
              bad('Unknown IR statement.', location);
          }
        } finally {
          active.delete(node);
        }
      }
      return terminal;
    }
    const moduleScope: Scope = new Map();
    if (root.moduleBindings !== undefined) {
      for (const value of array(root.moduleBindings)) {
        const binding = object(value, ['kind', 'name', 'bindingId', 'value', 'span']);
        if (binding.kind !== 'const')
          bad('Module scope admits only static bindings.', span(binding.span));
        const initializer = object(binding.value, EXPRESSION_FIELDS);
        const storage = lexicalStoredType(valueType(initializer.type, span(binding.span)));
        if (storage !== undefined && !isDataValueType(storage))
          bad(
            'Shared module storage requires finite data; owner closures and capabilities cannot escape into module storage.',
            span(binding.span)
          );
        let scalar =
          initializer.kind === 'lexical-cell'
            ? object(initializer.value, EXPRESSION_FIELDS)
            : initializer;
        while (scalar.kind === 'narrow') scalar = object(scalar.value, EXPRESSION_FIELDS);
        if (
          initializer.kind !== 'function' &&
          scalar.kind !== 'literal' &&
          !(
            scalar.kind === 'unary' &&
            (scalar.operator === '+' || scalar.operator === '-') &&
            object(scalar.operand, EXPRESSION_FIELDS).kind === 'literal'
          )
        )
          bad(
            'Shared module initializers admit only static functions and scalar data; mutable callable or capability containers cannot escape an owner.',
            span(binding.span)
          );
      }
      statements(root.moduleBindings, moduleScope, 'setup', 'helper', []);
    }
    for (const hook of hooks) {
      const setup = fn(hook.setup, moduleScope, hook.kind === 'hook' ? undefined : 'setup');
      if (
        setup.phase !== 'setup' ||
        (setup.parameters.length && setup.parameters[0].type !== 'def')
      )
        bad('Authored hook setup must receive its definition handle.', setup.span);
      if (hook.kind === 'hook') {
        const expected: ValueType[] = [
          'def',
          valueType(hook.optionsType, setup.span),
          HOOK_API_TYPE,
        ];
        if (
          setup.context !== 'helper' ||
          setup.parameters.length > 3 ||
          setup.parameters.some((parameter, index) => !sameType(parameter.type, expected[index])) ||
          !isSetupResultType(setup.returnType)
        )
          bad(
            'Hook setup receives def, options, and its per-installation API and returns render or void.',
            setup.span
          );
      }
      if (hook.projectHandle !== undefined) {
        if (hook.kind === 'hook') bad('Only as-hooks project captured results.');
        const project = fn(hook.projectHandle, moduleScope);
        const input = project.parameters[0]?.type;
        if (
          project.phase !== 'setup' ||
          project.context !== 'helper' ||
          project.parameters.length > 1 ||
          (input !== undefined &&
            input !== 'authored-result' &&
            !(typeof input !== 'string' && input.kind === 'capture' && input.hookId === hook.id))
        )
          bad('Projection receives its captured result during setup.', project.span);
      }
      if (hook.configure !== undefined) {
        if (hook.kind !== 'hook') bad('Only hooks have a configure lifecycle.');
        const configure = fn(hook.configure, moduleScope);
        if (
          configure.phase !== 'setup' ||
          configure.context !== 'helper' ||
          configure.returnType !== 'void'
        )
          bad('Hook configure runs synchronously during setup.', configure.span);
        const expected: ValueType[] = [
          HOOK_API_TYPE,
          valueType(hook.optionsType, configure.span),
          HOOK_TOOLS_TYPE,
        ];
        if (
          configure.parameters.length > 3 ||
          configure.parameters.some(
            (parameter, index) => !sameType(parameter.type, expected[index])
          )
        )
          bad(
            'Hook configure receives its per-installation API, options, and configure tools.',
            configure.span
          );
      }
    }
    fn(root.setup, moduleScope, 'setup');
    const result = replacements.size
      ? (canonicalCopy(input) as PrototypeIR)
      : (input as PrototypeIR);
    let captures: ReturnType<typeof derivePrototypeCaptures>;
    try {
      captures = derivePrototypeCaptures(result);
    } catch (error) {
      if (error instanceof CompilerRejection) bad(error.diagnostic.message, error.diagnostic.span);
      throw error;
    }
    for (const hook of result.hooks)
      if (hook.capture && JSON.stringify(captures.get(hook.id)) !== JSON.stringify(hook.capture))
        bad(
          'Hook capture metadata does not match its checked closed-graph installations.',
          hook.setup.span
        );
    const effect = callableEffectIssue(result);
    if (effect) bad(effect.message, effect.span);
    return { ok: true, value: result };
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI2002',
          category: 'invalid-ir',
          message: `Invalid IR: ${error instanceof Error ? error.message : String(error)}`,
          span: FALLBACK,
        },
      ],
    };
  }
}
