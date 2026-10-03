import { CompilerRejection, reject } from './diagnostics';
import {
  IR_VERSION,
  type CompileResult,
  type PrototypeIR,
  type SourceSpan,
  type ValueType,
} from './ir';
import { OPERATION_RULES } from './operations';

const TYPES: readonly string[] = [
  'boolean',
  'number',
  'string',
  'null',
  'void',
  'unknown',
  'def',
  'run',
  'render',
  'event',
  'props',
  'focus-options',
  'focus',
  'accessible',
  'function',
  'record',
  'array',
  'template',
  'state:boolean',
  'state:number',
  'state:string',
];
const BINARY: readonly string[] = [
  '===',
  '!==',
  '<',
  '<=',
  '>',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&&',
  '||',
  '??',
];
const RESERVED: readonly string[] = [
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
];
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
    typeof value === 'string' &&
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) &&
    !RESERVED.includes(value)
  );
}

function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    reject('PUI2002', 'IR requires plain data records.', FALLBACK, 'invalid-ir');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key))
      reject('PUI2002', 'Unknown IR field.', FALLBACK, 'invalid-ir');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable)
      reject('PUI2002', 'IR accessors/non-data fields are forbidden.', FALLBACK, 'invalid-ir');
  }
  // The record shape and absence of accessors were checked above.
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length)
    reject('PUI2002', 'IR requires a dense array.', FALLBACK, 'invalid-ir');
  for (let index = 0; index < value.length; index++)
    if (!Object.hasOwn(value, index))
      reject('PUI2002', 'IR arrays cannot be sparse.', FALLBACK, 'invalid-ir');
  return value;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value)
    reject('PUI2002', 'IR requires a nonempty string.', FALLBACK, 'invalid-ir');
  return value;
}

function span(value: unknown): SourceSpan {
  const record = object(value, ['file', 'start', 'end', 'line', 'column', 'endLine', 'endColumn']);
  const file = text(record.file);
  if (/^(?:\/|\\|[A-Za-z]:)/.test(file))
    reject('PUI2002', 'IR source locations must be relative.', FALLBACK, 'invalid-ir');
  for (const key of ['start', 'end', 'line', 'column', 'endLine', 'endColumn']) {
    const number = record[key];
    if (
      typeof number !== 'number' ||
      !Number.isSafeInteger(number) ||
      number < (key === 'start' || key === 'end' ? 0 : 1)
    )
      reject('PUI2002', 'Invalid IR source position.', FALLBACK, 'invalid-ir');
  }
  // All SourceSpan fields have been validated by the data schema above.
  const checked = record as unknown as SourceSpan;
  if (checked.end < checked.start || checked.endLine < checked.line)
    reject('PUI2002', 'Reversed IR source span.', FALLBACK, 'invalid-ir');
  return checked;
}

interface Binding {
  type: string;
  helper?: { parameters: string[]; phase: string };
}

export function validateIR(input: unknown): CompileResult<PrototypeIR> {
  try {
    const root = object(input, [
      'schemaVersion',
      'name',
      'source',
      'setup',
      'hooks',
      'props',
      'exposes',
      'requirements',
    ]);
    if (root.schemaVersion !== IR_VERSION)
      reject('PUI2001', 'Unsupported private IR schema version.', FALLBACK, 'invalid-ir');
    text(root.name);
    const source = object(root.source, ['file', 'exportName', 'sha256']);
    text(source.file);
    text(source.exportName);
    if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256))
      reject('PUI2002', 'Invalid source digest.', FALLBACK, 'invalid-ir');
    const props = new Map<string, string>();
    for (const value of array(root.props)) {
      const prop = object(value, ['name', 'type', 'span']);
      const name = text(prop.name);
      if (props.has(name) || !['boolean', 'number', 'string'].includes(String(prop.type)))
        reject('PUI2002', 'Invalid or duplicate prop metadata.', span(prop.span), 'invalid-ir');
      span(prop.span);
      props.set(name, String(prop.type));
    }
    const hookIds = new Set<string>();
    const hooks = array(root.hooks).map((value) => {
      const hook = object(value, ['id', 'name', 'setup', 'span']);
      const id = text(hook.id);
      if (hookIds.has(id))
        reject('PUI2002', 'Duplicate authored hook identity.', span(hook.span), 'invalid-ir');
      hookIds.add(id);
      text(hook.name);
      span(hook.span);
      return hook;
    });
    const active = new Set<object>();
    function parameters(value: unknown): { name: string; type: string; optional: boolean }[] {
      const seen = new Set<string>();
      return array(value).map((item) => {
        const parameter = object(item, ['name', 'type', 'optional']);
        if (
          !validIdentifier(parameter.name) ||
          seen.has(parameter.name) ||
          !TYPES.includes(String(parameter.type)) ||
          (parameter.optional !== undefined && typeof parameter.optional !== 'boolean')
        )
          reject('PUI2002', 'Invalid function parameter.', FALLBACK, 'invalid-ir');
        seen.add(parameter.name);
        return {
          name: parameter.name,
          type: String(parameter.type),
          optional: parameter.optional === true,
        };
      });
    }
    function fn(
      value: unknown,
      outer: Map<string, Binding>,
      expectedPhase?: string
    ): { parameters: string[]; phase: string } {
      const func = object(value, ['parameters', 'body', 'phase', 'span']);
      const location = span(func.span);
      const phase = String(func.phase);
      if (
        !['setup', 'callback', 'render'].includes(phase) ||
        (expectedPhase && phase !== expectedPhase)
      )
        reject('PUI2002', 'Function phase mismatch.', location, 'invalid-ir');
      const params = parameters(func.parameters);
      if (
        phase === 'setup' &&
        (params.length > 1 || (params.length === 1 && params[0].type !== 'def'))
      )
        reject(
          'PUI2002',
          'Setup signature must receive its definition handle.',
          location,
          'invalid-ir'
        );
      const scope = new Map(outer);
      for (const parameter of params) scope.set(parameter.name, { type: parameter.type });
      statements(func.body, scope, phase);
      return { parameters: params.map((parameter) => parameter.type), phase };
    }
    function expression(
      value: unknown,
      scope: Map<string, Binding>,
      phase: string,
      allowFunction = false
    ): string {
      const node = object(value, [
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
        'function',
      ]);
      const location = span(node.span);
      if (active.has(node)) reject('PUI2002', 'Cyclic IR expression.', location, 'invalid-ir');
      active.add(node);
      let type: string;
      switch (node.kind) {
        case 'literal':
          if (
            (node.value !== null && !['boolean', 'number', 'string'].includes(typeof node.value)) ||
            (typeof node.value === 'number' && !Number.isFinite(node.value))
          )
            reject(
              'PUI2002',
              'IR literals must be finite primitive values.',
              location,
              'invalid-ir'
            );
          type = node.value === null ? 'null' : typeof node.value;
          break;
        case 'reference': {
          if (!validIdentifier(node.name) || !scope.has(node.name))
            reject('PUI2002', 'Unbound IR reference.', location, 'invalid-ir');
          type = scope.get(node.name)!.type;
          break;
        }
        case 'array':
          for (const item of array(node.elements)) expression(item, scope, phase);
          type = 'array';
          break;
        case 'record': {
          const keys = new Set<string>();
          for (const value of array(node.entries)) {
            const entry = object(value, ['key', 'value']);
            const key = text(entry.key);
            if (keys.has(key))
              reject('PUI2002', 'Duplicate IR record key.', location, 'invalid-ir');
            keys.add(key);
            expression(entry.value, scope, phase);
          }
          type = 'record';
          break;
        }
        case 'unary':
          if (!['!', '+', '-'].includes(String(node.operator)))
            reject('PUI2002', 'Unsupported IR unary operator.', location, 'invalid-ir');
          expression(node.operand, scope, phase);
          type = node.operator === '!' ? 'boolean' : 'number';
          break;
        case 'binary': {
          if (!BINARY.includes(String(node.operator)))
            reject('PUI2002', 'Unsupported IR binary operator.', location, 'invalid-ir');
          const left = expression(node.left, scope, phase);
          expression(node.right, scope, phase);
          type = ['===', '!==', '<', '<=', '>', '>='].includes(String(node.operator))
            ? 'boolean'
            : left;
          break;
        }
        case 'member': {
          const owner = expression(node.object, scope, phase);
          const key = text(node.property);
          if (typeof node.optional !== 'boolean')
            reject('PUI2002', 'IR member optionality must be explicit.', location, 'invalid-ir');
          if (owner === 'focus' && ['focused', 'focusVisible', 'focusable'].includes(key))
            type = 'state:boolean';
          else if (owner === 'props' && props.has(key)) type = props.get(key)!;
          else if (owner === 'event' && ['key', 'type', 'control'].includes(key))
            type = key === 'control' ? 'event' : 'string';
          else if (
            owner === 'event' &&
            ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'repeat'].includes(key)
          )
            type = 'boolean';
          else if (owner === 'focus-options' && ['reason', 'preventScroll'].includes(key))
            type = key === 'reason' ? 'string' : 'boolean';
          else reject('PUI2002', 'Unsupported IR property access.', location, 'invalid-ir');
          break;
        }
        case 'function':
          if (!allowFunction)
            reject('PUI2002', 'Escaping function values are unsupported.', location, 'invalid-ir');
          fn(node.function, scope);
          type = 'function';
          break;
        case 'helper-call': {
          if (!validIdentifier(node.name))
            reject('PUI2002', 'Invalid helper name.', location, 'invalid-ir');
          const helper = scope.get(node.name)?.helper;
          if (!helper || helper.phase !== phase)
            reject(
              'PUI2002',
              'Unknown, recursive or wrong-phase helper call.',
              location,
              'invalid-ir'
            );
          const args = array(node.arguments);
          if (args.length !== helper.parameters.length)
            reject('PUI2002', 'Helper argument count mismatch.', location, 'invalid-ir');
          args.forEach((arg, index) => {
            const actual = expression(arg, scope, phase);
            if (helper.parameters[index] !== 'unknown' && actual !== helper.parameters[index])
              reject('PUI2002', 'Helper argument type mismatch.', location, 'invalid-ir');
          });
          type = 'void';
          break;
        }
        case 'authored-hook':
          if (phase !== 'setup' || !hookIds.has(String(node.hookId)))
            reject('PUI2002', 'Invalid authored-hook call.', location, 'invalid-ir');
          type = 'void';
          break;
        case 'operation': {
          const operation = text(node.operation);
          if (!Object.hasOwn(OPERATION_RULES, operation))
            reject('PUI2002', 'Unknown semantic operation.', location, 'invalid-ir');
          // The closed operation registry established this key.
          const rule = OPERATION_RULES[operation as keyof typeof OPERATION_RULES];
          if (!rule.phases.includes(phase as 'setup' | 'callback' | 'render'))
            reject('PUI2002', 'Operation phase mismatch.', location, 'invalid-ir');
          const receiver =
            node.receiver === undefined ? 'void' : expression(node.receiver, scope, phase);
          if (
            rule.receiver.startsWith('state:')
              ? !receiver.startsWith('state:')
              : receiver !== rule.receiver
          )
            reject('PUI2002', 'Operation receiver mismatch.', location, 'invalid-ir');
          const args = array(node.arguments);
          if (args.length < rule.min || args.length > rule.max)
            reject('PUI2002', 'Operation argument count mismatch.', location, 'invalid-ir');
          args.forEach((arg, index) => {
            if (rule.callback?.at === index) {
              const callback = object(arg, ['kind', 'type', 'span', 'function']);
              if (callback.kind !== 'function' || callback.type !== 'function')
                reject(
                  'PUI2002',
                  'Operation requires an explicit checked callback.',
                  location,
                  'invalid-ir'
                );
              span(callback.span);
              fn(callback.function, scope, rule.callback.phase);
            } else expression(arg, scope, phase);
          });
          type = operation === 'state.get' ? receiver.slice('state:'.length) : rule.result;
          break;
        }
        default:
          reject('PUI2002', 'Unknown IR expression kind.', location, 'invalid-ir');
      }
      if (node.type !== type)
        reject('PUI2002', 'IR expression type mismatch.', location, 'invalid-ir');
      active.delete(node);
      return type;
    }
    function statements(value: unknown, scope: Map<string, Binding>, phase: string): void {
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
        ]);
        const location = span(node.span);
        if (active.has(node)) reject('PUI2002', 'Cyclic IR statements.', location, 'invalid-ir');
        active.add(node);
        switch (node.kind) {
          case 'const': {
            if (!validIdentifier(node.name) || scope.has(node.name))
              reject('PUI2002', 'Invalid/rebound local identifier.', location, 'invalid-ir');
            const value = object(node.value, [
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
              'function',
            ]);
            const type = expression(value, scope, phase, value.kind === 'function');
            scope.set(node.name, {
              type,
              ...(value.kind === 'function' ? { helper: fn(value.function, scope) } : {}),
            });
            break;
          }
          case 'effect':
            expression(node.expression, scope, phase);
            break;
          case 'if':
            expression(node.condition, scope, phase);
            statements(node.then, new Map(scope), phase);
            statements(node.otherwise, new Map(scope), phase);
            break;
          case 'return':
            if (node.value !== undefined) expression(node.value, scope, phase, phase === 'setup');
            break;
          default:
            reject('PUI2002', 'Unknown IR statement.', location, 'invalid-ir');
        }
        active.delete(node);
      }
    }
    const exposures = new Set<string>();
    for (const value of array(root.exposes)) {
      const exposure = object(value, ['name', 'kind', 'type', 'payload', 'parameters', 'span']);
      const name = text(exposure.name);
      const location = span(exposure.span);
      if (exposures.has(name))
        reject('PUI2002', 'Duplicate expose metadata.', location, 'invalid-ir');
      exposures.add(name);
      if (exposure.kind === 'state') {
        if (!['boolean', 'number', 'string'].includes(String(exposure.type)))
          reject('PUI2002', 'Invalid exposed state type.', location, 'invalid-ir');
      } else if (exposure.kind === 'event') {
        if (exposure.payload !== 'void')
          reject('PUI2002', 'Unsupported event payload.', location, 'invalid-ir');
      } else if (exposure.kind === 'method') parameters(exposure.parameters);
      else reject('PUI2002', 'Invalid exposure kind.', location, 'invalid-ir');
    }
    for (const requirement of array(root.requirements)) text(requirement);
    for (const hook of hooks) fn(hook.setup, new Map(), 'setup');
    fn(root.setup, new Map(), 'setup');
    // Structural, lexical, phase and operation schemas above establish the private IR type.
    return { ok: true, value: input as PrototypeIR };
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
