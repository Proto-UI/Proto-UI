import { formatDataType, type DataType } from './data-types';
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
    .map((argument, index) =>
      emitPublicValue({
        value: `${args}[${index}]`,
        type: argument.type,
        wrap: context.wrap,
        prefix: context.prefix,
        typeName,
        typed,
      })
    )
    .join(', ')}]`;
  const actualArguments = context.plan.calls.get(value)!.mixed
    ? `${context.isAuthored}(${target}) ? ${args} : ${projected}`
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
  atom: (type: ValueType) => string
): string {
  if (isDataValueType(type)) return formatNativeDataType(type);
  if (typeof type === 'string') return atom(type);
  switch (type.kind) {
    case 'capture':
      return '{ readonly getState?: (name: string) => unknown; readonly getMethod?: (name: string) => unknown; readonly getAsHook?: (name: string) => unknown; readonly getAsHookHandle?: (name: string) => unknown }';
    case 'cell':
      return formatJavaScriptValueType(type.value, atom);
    case 'value-union':
      return (
        type.members.map((member) => `(${formatJavaScriptValueType(member, atom)})`).join(' | ') ||
        'never'
      );
    case 'callable': {
      const required = minimumArgumentCount(type.parameters);
      const parameters = type.parameters.map((parameter, index) => {
        const optional = !!(parameter.optional || parameter.default);
        const value = formatJavaScriptValueType(parameter.type, atom);
        // A leading default still occupies a required argument position. Its
        // type accepts undefined; only the trailing optional suffix uses '?'.
        return `${parameter.name}${optional && index >= required ? '?' : ''}: ${optional && index < required ? `(${value}) | undefined` : value}`;
      });
      return `(${parameters.join(', ')}) => ${formatJavaScriptValueType(type.returnType, atom)}`;
    }
    case 'object':
      return `{ ${type.fields
        .map(
          (field) =>
            `${field.readonly ? 'readonly ' : ''}${JSON.stringify(field.name)}${field.optional ? '?' : ''}: ${formatJavaScriptValueType(field.type, atom)}`
        )
        .concat(type.index ? [`[key: string]: ${formatJavaScriptValueType(type.index, atom)}`] : [])
        .join('; ')} }`;
  }
}

/** Portable data lists are readable values; the language has no mutable array authority. */
function formatNativeDataType(type: DataType): string {
  if (typeof type === 'string' || type.kind === 'literal') return formatDataType(type);
  if (type.kind === 'array') return `ReadonlyArray<${formatNativeDataType(type.element)}>`;
  if (type.kind === 'union') return type.members.map(formatNativeDataType).join(' | ') || 'never';
  return `{ ${type.fields.map((field) => `${JSON.stringify(field.name)}${field.optional ? '?' : ''}: ${formatNativeDataType(field.type)}`).join('; ')} }`;
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
  typeName?: (type: ValueType) => string
): string {
  return parameters
    .map(
      (parameter) =>
        `${parameter.name}${typeName ? `${parameter.optional && !parameter.default ? '?' : ''}: ${typeName(parameter.type)}` : ''}${parameter.default ? ` = ${emit(parameter.default)}` : ''}`
    )
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
        `${parameter.name}${typed ? `${parameter.optional && !parameter.default ? '?' : ''}: unknown` : ''}${parameter.default ? ' = undefined' : ''}`
    )
    .join(', ');
  const annotations =
    !typed && value.parameters.length
      ? `/** ${value.parameters.map((parameter) => `@param {unknown} ${parameter.optional && !parameter.default ? `[${parameter.name}]` : parameter.name}`).join(' ')} */ `
      : '';
  return `${annotations}(${parameters}) => { throw new Error('[Compiler] unreachable authored callable invoked'); }`;
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
    case 'element':
      return `(${emit(value.object)})${value.optional ? '?.' : ''}[${emit(value.index)}]`;
    case 'conditional':
      return `(${emit(value.condition)} ? ${emit(value.then)} : ${emit(value.otherwise)})`;
    case 'call':
      if (callBoundary?.plan.calls.has(value) && typeName)
        return emitJavaScriptExternalCall(value, emit, typeName, typed, callBoundary);
      return `(${emit(value.callee)})${value.optional ? '?.' : ''}(${value.arguments.map(emit).join(', ')})`;
    case 'object-spread':
      return `({ ${value.parts.map((part) => (part.kind === 'spread' ? `...(${emit(part.value)})` : `[${JSON.stringify(part.key)}]: ${emit(part.value)}`)).join(', ')} })`;
    case 'intrinsic': {
      const args = value.arguments.map(emit);
      switch (value.name) {
        case 'number.isFinite':
          return `Number.isFinite(${args.join(', ')})`;
        case 'object.freeze':
          return `Object.freeze(${args.join(', ')})`;
        case 'object.hasOwn':
          return `Object.hasOwn(${args.join(', ')})`;
        case 'array.every':
          return `(${args[0]}).every(${args.slice(1).join(', ')})`;
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
