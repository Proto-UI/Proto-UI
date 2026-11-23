import { formatDataType, type DataType } from './data-types';
import { ecmaTypeName, emitEcmaIntrinsic } from './ecmascript-values';
import {
  isDataValueType,
  lexicalStoredType,
  type ExpressionIR,
  type FunctionIR,
  type ParameterIR,
  type PrototypeIR,
  type ValueType,
} from './ir';
import {
  memberValueType,
  minimumArgumentCount,
  parameterValueType,
  valueTypeEqual,
  iterableElementType,
  objectFields,
  valueAlternatives,
} from './value-types';
import { traceCallableDemand } from './callable-effects';
import { emitPublicValue, hasPublicCallable } from './native-public-values';

type OrdinaryCall = Extract<ExpressionIR, { kind: 'call' }>;
export interface JavaScriptCallBoundaries {
  calls: ReadonlyMap<OrdinaryCall, { mixed: boolean }>;
  authored: ReadonlySet<FunctionIR>;
}

/** Reuse checked callable provenance; a function's type alone does not prove an escape. */
export function planJavaScriptCallBoundaries(ir: PrototypeIR): JavaScriptCallBoundaries {
  const sites = new Map<OrdinaryCall, { external: boolean; authored: Set<FunctionIR> }>();
  traceCallableDemand(ir, {
    expression() {},
    function() {},
    hook() {},
    opaque() {}, // Validation/admission owns unresolved callable edges, never a runtime fallback.
    call(value, provenance) {
      if (!value.arguments.some((argument) => hasPublicCallable(argument.type))) return;
      let site = sites.get(value);
      if (!site) {
        site = { external: false, authored: new Set() };
        sites.set(value, site);
      }
      site.external ||= provenance.external;
      provenance.authored.forEach((fn) => site!.authored.add(fn));
    },
  });
  const calls = new Map<OrdinaryCall, { mixed: boolean }>();
  const authored = new Set<FunctionIR>();
  for (const [value, site] of sites) {
    if (!site.external) continue;
    calls.set(value, { mixed: site.authored.size > 0 });
    site.authored.forEach((fn) => authored.add(fn));
  }
  return { calls, authored };
}

interface JavaScriptCallBoundaryContext {
  plan: JavaScriptCallBoundaries;
  wrap: string;
  prefix: string;
  isAuthored: string;
}

/** Evaluate the original call before projecting its arguments across the owner boundary. */
function emitJavaScriptExternalCall(
  value: OrdinaryCall,
  emit: (value: ExpressionIR) => string,
  typeName: (type: ValueType) => string,
  typed: boolean,
  context: JavaScriptCallBoundaryContext
): string {
  const target = `${context.prefix}CallTarget`;
  const receiver = `${context.prefix}CallReceiver`;
  const args = `${context.prefix}CallArguments`;
  const cast = (code: string, type: string) =>
    typed ? `(${code} as ${type})` : `/** @type {${type}} */ (${code})`;
  const parameter = (name: string, type: ValueType) =>
    typed ? `${name}: ${typeName(type)}` : name;
  const annotation = (name: string, type: ValueType) =>
    typed ? '' : `/** @param {${typeName(type)}} ${name} */ `;
  let callee = value.callee;
  while (callee.kind === 'narrow') callee = callee.value;
  const member = callee.kind === 'member' || callee.kind === 'element' ? callee : undefined;
  // A member call keeps the original receiver. Extracting only its function
  // would erase JavaScript's Reference receiver; both object and key run once.
  const readTarget = member
    ? cast(
        `(${receiver})${member.optional ? '?.' : ''}[${member.kind === 'member' ? JSON.stringify(member.property) : emit(member.index)}]`,
        typeName(value.callee.type)
      )
    : emit(value.callee);
  const rawArguments = `[${value.arguments.map(emit).join(', ')}]`;
  const argumentType = `[${value.arguments.map((argument) => typeName(argument.type)).join(', ')}]`;
  const projected = `[${value.arguments
    .map((argument, index) => {
      if (value.spread?.[index]) {
        const item = `${context.prefix}SpreadItem`;
        const element = iterableElementType(argument.type)!;
        const projectedItem = emitPublicValue({
          value: item,
          type: element,
          wrap: context.wrap,
          prefix: context.prefix,
          typeName,
          typed,
        });
        return projectedItem === item
          ? `...${args}[${index}]`
          : `...Array.from(${args}[${index}], (${typed ? `${item}: ${typeName(element)}` : item}) => ${projectedItem})`;
      }
      return emitPublicValue({
        value: `${args}[${index}]`,
        type: argument.type,
        wrap: context.wrap,
        prefix: context.prefix,
        typeName,
        typed,
      });
    })
    .join(', ')}]`;
  const expanded = value.spread?.some(Boolean)
    ? `[${value.arguments.map((_, index) => `${value.spread?.[index] ? '...' : ''}${args}[${index}]`).join(', ')}]`
    : args;
  const actualArguments = context.plan.calls.get(value)!.mixed
    ? `${context.isAuthored}(${target}) ? ${expanded} : ${projected}`
    : projected;
  const invocation = `Reflect.apply(${target}, ${member ? receiver : 'undefined'}, ${actualArguments})`;
  const body = `${value.optional ? `if (${target} === null || ${target} === undefined) return undefined; ` : ''}const ${args} = ${cast(rawArguments, argumentType)}; return ${cast(invocation, typeName(value.type))};`;
  const call = `(${annotation(target, value.callee.type)}(${parameter(target, value.callee.type)}) => { ${body} })(${readTarget})`;
  return member
    ? `(${annotation(receiver, member.object.type)}(${parameter(receiver, member.object.type)}) => ${call})(${emit(member.object)})`
    : call;
}

/** Compile-time decisions shared by the JavaScript hosts. No evaluator ships. */
export function formatJavaScriptValueType(
  type: ValueType,
  atom: (type: ValueType) => string,
  stored = false,
  override?: (type: ValueType) => string | undefined
): string {
  const specialized = override?.(type);
  if (specialized !== undefined) return specialized;
  const ordinary = ecmaTypeName(type);
  if (ordinary !== undefined) return ordinary;
  if (isDataValueType(type)) return formatNativeDataType(type, stored);
  if (typeof type === 'string') return atom(type);
  switch (type.kind) {
    case 'value-array':
      return `${type.readonly ? 'ReadonlyArray' : 'Array'}<${formatJavaScriptValueType(type.element, atom, true, override)}>`;
    case 'map':
      return `${type.readonly ? 'ReadonlyMap' : 'Map'}<${formatJavaScriptValueType(type.key, atom, true, override)}, ${formatJavaScriptValueType(type.value, atom, true, override)}>`;
    case 'set':
      return `${type.readonly ? 'ReadonlySet' : 'Set'}<${formatJavaScriptValueType(type.element, atom, true, override)}>`;
    case 'capture':
      return '{ readonly stateHandles?: Readonly<Record<string, unknown>>; readonly getState?: (name: string) => unknown; readonly getMethod?: (name: string) => unknown; readonly getAsHook?: (name: string) => unknown; readonly getAsHookHandle?: (name: string) => unknown; readonly render?: unknown }';
    case 'cell':
      return formatJavaScriptValueType(type.value, atom, true, override);
    case 'value-union': {
      const members = type.members.map(
        (member) => `(${formatJavaScriptValueType(member, atom, true, override)})`
      );
      // Wrap the complete union as well: an arrow return ending in a lone
      // `(undefined) =>` would otherwise parse as a function-type member.
      return members.length ? `(${members.join(' | ')})` : 'never';
    }
    case 'callable': {
      const parameters = emitJavaScriptSignatureParameters(
        type.parameters,
        (value) => formatJavaScriptValueType(value, atom, false, override),
        override
      );
      return `(${parameters}) => ${formatJavaScriptValueType(type.returnType, atom, false, override)}`;
    }
    case 'object':
      return `{ ${type.fields
        .map(
          (field) =>
            `${field.readonly ? 'readonly ' : ''}${JSON.stringify(field.name)}${field.optional ? '?' : ''}: ${formatJavaScriptValueType(field.type, atom, true, override)}`
        )
        .concat(
          type.index
            ? [`[key: string]: ${formatJavaScriptValueType(type.index, atom, true, override)}`]
            : []
        )
        .join('; ')} }`;
  }
}

/** Finite data lists remain readonly; ordinary mutable arrays use value-array. */
function formatNativeDataType(type: DataType, stored = false): string {
  if (type === 'void' && stored) return 'undefined';
  if (typeof type === 'string' || type.kind === 'literal') return formatDataType(type);
  if (type.kind === 'array') return `ReadonlyArray<${formatNativeDataType(type.element, true)}>`;
  // Union members are values: IR void denotes the absent value even when
  // the union is a return type. Only a standalone callable return uses void.
  if (type.kind === 'union')
    return type.members.map((member) => formatNativeDataType(member, true)).join(' | ') || 'never';
  return `{ ${type.fields.map((field) => `${JSON.stringify(field.name)}${field.optional ? '?' : ''}: ${formatNativeDataType(field.type, true)}`).join('; ')} }`;
}

/** Flow refinements were proved by portable IR validation; retain them across emitted syntax. */
export function emitJavaScriptMember(
  value: Extract<ExpressionIR, { kind: 'member' }>,
  emit: (value: ExpressionIR) => string,
  typeName: (type: ValueType) => string,
  typed = true,
  read: (value: ExpressionIR, code: string) => string = (_value, code) => code
): string {
  const type = value.object.type;
  const refinement = type === 'exception' ? '{readonly [key: string]: unknown}' : undefined;
  const object = emit(value.object);
  if (
    typeof type !== 'string' &&
    type.kind === 'capture' &&
    (value.property === 'stateHandles' || value.property === 'render')
  ) {
    const code = `(${object})${value.optional ? '?.' : ''}[${JSON.stringify(value.property)}]`;
    return read(
      value,
      typed
        ? `(${code} as ${typeName(value.type)})`
        : `/** @type {${typeName(value.type)}} */ (${code})`
    );
  }
  const narrowed = !refinement
    ? object
    : typed
      ? `${object} as ${refinement}`
      : `/** @type {${refinement}} */ (${object})`;
  return read(
    value,
    `(${narrowed})${value.optional ? '?.' : ''}[${JSON.stringify(value.property)}]`
  );
}

/** Retain only refinements which differ from the actual lexical declaration. */
export function createJavaScriptValueReader(
  ir: PrototypeIR,
  typeName: (type: ValueType) => string,
  typed = true
) {
  const declarations = new Map<string, ValueType | null>();
  function declare(id: string | undefined, type: ValueType) {
    if (!id) return;
    const existing = declarations.get(id);
    declarations.set(
      id,
      existing === undefined
        ? type
        : existing !== null && valueTypeEqual(existing, type)
          ? existing
          : null
    );
  }
  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (node.kind === 'const')
      declare(node.bindingId as string | undefined, (node.value as ExpressionIR).type);
    if (Array.isArray(node.parameters) && Array.isArray(node.body))
      for (const parameter of node.parameters as ParameterIR[])
        declare(parameter.bindingId, parameterValueType(parameter));
    for (const child of Object.values(node)) visit(child);
  }
  visit(ir.moduleBindings);
  visit(ir.setup);
  visit(ir.hooks);
  return (value: ExpressionIR, code: string): string => {
    let declared: ValueType | null | undefined;
    if (value.kind === 'reference')
      declared = value.bindingId ? declarations.get(value.bindingId) : undefined;
    if (value.kind === 'lexical-read' && value.cell.kind === 'reference') {
      const cell = value.cell.bindingId ? declarations.get(value.cell.bindingId) : undefined;
      declared = cell ? lexicalStoredType(cell) : cell;
    }
    if (value.kind === 'member') {
      try {
        declared = memberValueType(value.object.type, value.property, value.optional);
      } catch {
        /* Native atom member types are emitted by their own boundary. */
      }
    }
    if (!declared || valueTypeEqual(value.type, declared)) return code;
    return typed
      ? `(${code} as ${typeName(value.type)})`
      : `/** @type {${typeName(value.type)}} */ (${code})`;
  };
}

export function emitJavaScriptParameters(
  parameters: readonly ParameterIR[],
  emit: (value: ExpressionIR) => string,
  typeName?: (type: ValueType) => string,
  override?: (type: ValueType) => string | undefined
): string {
  return parameters
    .map(
      (parameter) =>
        `${parameter.rest ? '...' : ''}${parameter.name}${typeName ? `${parameter.optional && !parameter.default ? '?' : ''}: ${formatJavaScriptValueType(parameter.type, typeName, true, override)}` : ''}${parameter.default ? ` = ${emit(parameter.default)}` : ''}`
    )
    .join(', ');
}

/** Types describe default acceptance without evaluating the initializer. */
export function emitJavaScriptSignatureParameters(
  parameters: readonly ParameterIR[],
  typeName: (type: ValueType) => string,
  override?: (type: ValueType) => string | undefined
): string {
  const required = minimumArgumentCount(parameters);
  return parameters
    .map((parameter, index) => {
      const optional = !!(parameter.optional || parameter.default);
      const value = formatJavaScriptValueType(parameter.type, typeName, true, override);
      // Leading defaults still occupy required positions when followed by a
      // required argument. Only the trailing optional suffix may use '?'.
      return `${parameter.rest ? '...' : ''}${parameter.name}${optional && index >= required ? '?' : ''}: ${optional && index < required ? `(${value}) | undefined` : value}`;
    })
    .join(', ');
}

/**
 * A closed invocation proof can exclude a body while its allocation remains
 * observable as an ordinary value. Preserve that allocation and arity. Defaults
 * are evaluated only by a call, so no default expression or host support ships.
 * Unknown calls/escapes invalidate the proof before an emitter reaches here.
 */
export function emitUninvokedJavaScriptFunction(value: FunctionIR, typed = true): string {
  const parameters = value.parameters
    .map(
      (parameter) =>
        `${parameter.rest ? '...' : ''}${parameter.name}${typed ? `${parameter.optional && !parameter.default ? '?' : ''}: ${parameter.rest ? 'unknown[]' : 'unknown'}` : ''}${parameter.default ? ' = undefined' : ''}`
    )
    .join(', ');
  const annotations =
    !typed && value.parameters.length
      ? `/** ${value.parameters.map((parameter) => `@param {unknown} ${parameter.optional && !parameter.default ? `[${parameter.name}]` : parameter.name}`).join(' ')} */ `
      : '';
  return `(${annotations}(${parameters}) => { throw new Error('[Compiler] unreachable authored callable invoked'); })`;
}

function javaScriptLiteral(value: ExpressionIR): { value: unknown } | undefined {
  while (value.kind === 'narrow') value = value.value;
  return value.kind === 'literal'
    ? { value: value.value }
    : value.kind === 'undefined'
      ? { value: undefined }
      : undefined;
}

/** Keep intentional closed-domain comparisons legal in typed native source. */
export function emitJavaScriptBinary(
  value: Extract<ExpressionIR, { kind: 'binary' }>,
  emit: (value: ExpressionIR) => string,
  typed = true
): string {
  const left = javaScriptLiteral(value.left),
    right = javaScriptLiteral(value.right);
  if (value.operator === '??' && left)
    return left.value === null || left.value === undefined ? emit(value.right) : emit(value.left);
  if (value.operator === '===' || value.operator === '!==') {
    // Only syntax literals may be elided. A singleton type on a property or
    // reference still represents an observable read, even after specialization.
    if (left && right)
      return String(
        value.operator === '===' ? left.value === right.value : left.value !== right.value
      );
    const domain = (type: ValueType): readonly unknown[] | undefined => {
      const values: unknown[] = [];
      for (const part of valueAlternatives(type)) {
        if (part === 'null') values.push(null);
        else if (part === 'void') values.push(undefined);
        else if (typeof part !== 'string' && part.kind === 'literal') values.push(part.value);
        else return undefined;
      }
      return values;
    };
    // Ordinary syntax literals may carry a widened primitive type in IR, but
    // still supply their exact value to this one comparison.
    const a = left ? [left.value] : domain(value.left.type),
      b = right ? [right.value] : domain(value.right.type);
    if (typed && a && b && !a.some((item) => b.some((other) => item === other)))
      // This is the actual JavaScript comparison, with its original values and
      // evaluation order. Widening only the comparator's inputs prevents TS2367
      // without deriving runtime truth from a static type or erasing a read.
      // An empty checked domain marks an unreachable flow branch; its emitted
      // operands still retain their declared types and original evaluation.
      return `((left: unknown, right: unknown) => left ${value.operator} right)(${emit(value.left)}, ${emit(value.right)})`;
  }
  return `(${emit(value.left)} ${value.operator} ${emit(value.right)})`;
}

/** Native accessors retain deferred execution; constructing the record never reads it. */
export function emitJavaScriptRecordEntry(
  entry: { key: string; value: ExpressionIR; accessor?: 'get' },
  emit: (value: ExpressionIR) => string,
  typeName?: (type: ValueType) => string,
  typed = true
): string {
  const key = `[${JSON.stringify(entry.key)}]`;
  if (entry.accessor === 'get') {
    if (entry.value.kind !== 'function') throw new Error('Invalid getter callable.');
    const result = typed && typeName ? `: ${typeName(entry.value.function.returnType)}` : '';
    return `get ${key}()${result} { return (${emit(entry.value)})(); }`;
  }
  return `${key}: ${emit(entry.value)}`;
}

export function emitJavaScriptRecord(
  value: Extract<ExpressionIR, { kind: 'record' }>,
  emit: (value: ExpressionIR) => string,
  typeName?: (type: ValueType) => string,
  typed = true
): string {
  return `{ ${value.entries.map((entry) => emitJavaScriptRecordEntry(entry, emit, typeName, typed)).join(', ')} }`;
}

export function emitJavaScriptValue(
  value: ExpressionIR,
  emit: (value: ExpressionIR) => string,
  typeName?: (type: ValueType) => string,
  typed = true,
  callBoundary?: JavaScriptCallBoundaryContext
): string | undefined {
  switch (value.kind) {
    case 'narrow':
      return typeName
        ? typed
          ? `(${emit(value.value)} as ${typeName(value.type)})`
          : `/** @type {${typeName(value.type)}} */ (${emit(value.value)})`
        : emit(value.value);
    case 'member-write':
      return `((${emit(value.object)})[${JSON.stringify(value.property)}] = ${emit(value.value)})`;
    case 'element': {
      const object = emit(value.object);
      // A dynamic string read from a checked finite record is deliberately
      // unknown in IR. Reflect that read-only view in TypeScript without
      // inventing a finite key, changing evaluation, or granting callable data.
      const indexed =
        typeName &&
        value.type === 'unknown' &&
        value.index.type === 'string' &&
        objectFields(value.object.type)
          ? typed
            ? `(${object} as Readonly<Record<string, unknown>>)`
            : `(/** @type {Readonly<Record<string, unknown>>} */ (${object}))`
          : `(${object})`;
      return `${indexed}${value.optional ? '?.' : ''}[${emit(value.index)}]`;
    }
    case 'conditional': {
      const literal = javaScriptLiteral(value.condition);
      // Keep both checked branch types while representing an inert scalar
      // condition as its actual truth value. `void 0 ? ...` is intentional
      // after specialization but TypeScript otherwise diagnoses it as TS2873.
      const condition = literal ? String(!!literal.value) : emit(value.condition);
      return `(${condition} ? ${emit(value.then)} : ${emit(value.otherwise)})`;
    }
    case 'call':
      if (callBoundary?.plan.calls.has(value) && typeName)
        return emitJavaScriptExternalCall(value, emit, typeName, typed, callBoundary);
      return `(${emit(value.callee)})${value.optional ? '?.' : ''}(${value.arguments.map((argument, index) => `${value.spread?.[index] ? '...' : ''}${emit(argument)}`).join(', ')})`;
    case 'object-spread':
      return `({ ${value.parts.map((part) => (part.kind === 'spread' ? `...(${emit(part.value)})` : emitJavaScriptRecordEntry(part, emit, typeName, typed))).join(', ')} })`;
    case 'array-spread':
      return `[${value.parts.map((part) => `${part.spread ? '...' : ''}(${emit(part.value)})`).join(', ')}]`;
    case 'intrinsic': {
      const args = value.arguments.map(emit);
      const ordinary = emitEcmaIntrinsic(value.name, args, value.optional, typed);
      if (ordinary !== undefined) return ordinary;
      if (value.name === 'array.isArray') return `Array.isArray(${args.join(', ')})`;
      if (value.name === 'array.from') return `Array.from(${args.join(', ')})`;
      if (value.name === 'json.stringify') return `JSON.stringify(${args.join(', ')})`;
      if (value.name === 'set.create')
        return `new Set${typed && typeName && typeof value.type !== 'string' && value.type.kind === 'set' ? `<${typeName(value.type.element)}>` : ''}(${args.join(', ')})`;
      if (value.name === 'map.create')
        return `new Map${typed && typeName && typeof value.type !== 'string' && value.type.kind === 'map' ? `<${typeName(value.type.key)}, ${typeName(value.type.value)}>` : ''}()`;
      if (value.name === 'array.filter' && typeName) {
        const filtered = `(${args[0]})${value.optional ? '?.' : '.'}filter(${args.slice(1).join(', ')})`;
        // Source and source-free IR checking derive this element refinement
        // from the callback predicate. The emitted callback's explicit boolean
        // return annotation must not erase that independently checked result.
        return typed
          ? `(${filtered} as ${typeName(value.type)})`
          : `(/** @type {${typeName(value.type)}} */ (${filtered}))`;
      }
      if (/^(array|set|map)\./.test(value.name) && value.name !== 'array.includes')
        return `(${args[0]})${value.optional ? '?.' : '.'}${value.name.slice(value.name.indexOf('.') + 1)}(${args.slice(1).join(', ')})`;
      switch (value.name) {
        case 'number':
          return `Number(${args.join(', ')})`;
        case 'string':
          return `String(${args.join(', ')})`;
        case 'number.isFinite':
          return `Number.isFinite(${args.join(', ')})`;
        case 'math.round':
          return `Math.round(${args[0]})`;
        case 'math.floor':
          return `Math.floor(${args[0]})`;
        case 'object.freeze': {
          const frozen = `Object.freeze(${args.join(', ')})`;
          // The intrinsic's checked result retains literal elements and field
          // permissions. TS's generic array overload otherwise widens those
          // elements before the surrounding declaration can provide context.
          return !typeName
            ? frozen
            : typed
              ? `(${frozen} as ${typeName(value.type)})`
              : `(/** @type {${typeName(value.type)}} */ (${frozen}))`;
        }
        case 'object.assign':
          return `Object.assign(${args.join(', ')})`;
        case 'object.hasOwn':
          return `Object.hasOwn(${args.join(', ')})`;
        case 'array.every':
          return `(${args[0]}).every(${args.slice(1).join(', ')})`;
        case 'array.includes':
          return typed
            ? `(${args[0]} as readonly unknown[]).includes(${args[1]})`
            : `(/** @type {readonly unknown[]} */ (${args[0]})).includes(${args[1]})`;
        case 'typeof':
          return `(typeof ${args[0]})`;
        case 'error':
          return `new Error(${args.join(', ')})`;
      }
    }
    default:
      return undefined;
  }
}

export function emitOptionalOperation(
  value: ExpressionIR,
  emit: (value: ExpressionIR) => string,
  name: string,
  typeName?: (type: ValueType) => string
): string | undefined {
  if (value.kind !== 'operation' || !value.optional || !value.receiver) return undefined;
  const receiver = value.receiver;
  const parameter = typeName ? `${name}: ${typeName(receiver.type)}` : name;
  return `((${parameter}) => ${name} == null ? undefined : ${emit({ ...value, optional: false, receiver: { kind: 'reference', name, type: receiver.type, span: receiver.span } })})(${emit(receiver)})`;
}
