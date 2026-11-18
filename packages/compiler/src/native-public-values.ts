import { createHash } from 'node:crypto';
import { isDataValueType, type GeneratedModule, type ValueType } from './ir';
import type { DataType } from './data-types';
import { callableValue, joinValueTypes, valueAlternatives } from './value-types';

/** Needed only when a checked call site can target both authored and external functions. */
export const nativeAuthoredCallablesArtifact: NonNullable<
  GeneratedModule['supportingFiles']
>[number] = {
  path: '.proto-ui/owner/authored-callables-v1.ts',
  kind: 'source',
  contents: `// Identity marks for checked mixed call sites; marking neither wraps nor invokes.
const authored = new WeakSet<Function>();
export function markNativeAuthoredCallable<T extends Function>(callback: T): T {
  authored.add(callback);
  return callback;
}
export function isNativeAuthoredCallable(callback: Function): boolean {
  return authored.has(callback);
}
`,
};

export const nativePublicCallsArtifact: NonNullable<GeneratedModule['supportingFiles']>[number] = {
  path: '.proto-ui/owner/public-callables-v1.ts',
  kind: 'source',
  contents: `/** Public call boundaries preserve raw authored closures and their original receivers. */
export function createNativePublicCalls(options: { alive(): void; invoke<T>(callback: () => T): T }) {
  type Entry = { callable: Function; results: Map<string, (value: unknown) => unknown> };
  const root = Object.freeze({}), cache = new WeakMap<object, WeakMap<Function, Entry>>();
  const records = new WeakMap<object, object>();
  const projectedCallables = new WeakMap<Function, Entry>();
  function wrap<T extends Function>(callback: T, receiver: object = root, projectResult?: (value: ReturnType<Extract<T, (...args: never[]) => unknown>>) => unknown, projectionKey = ''): T {
    let callbacks = cache.get(receiver);
    if (!callbacks) { callbacks = new WeakMap(); cache.set(receiver, callbacks); }
    let entry = projectedCallables.get(callback) ?? callbacks.get(callback);
    if (!entry) {
      const results = new Map<string, (value: unknown) => unknown>();
      const callable = function (...args: unknown[]) {
        options.alive();
        const raw = options.invoke(() => Reflect.apply(callback, receiver, args));
        let projected = raw;
        for (const project of results.values()) projected = project(raw);
        return projected;
      };
      entry = { callable, results };
      callbacks.set(callback, entry);
      projectedCallables.set(callable, entry);
    }
    if (projectResult) entry.results.set(projectionKey, value => projectResult(value as ReturnType<Extract<T, (...args: never[]) => unknown>>));
    return entry.callable as T;
  }
  wrap.record = function <T extends object>(source: T, project: (target: T) => void): T {
    let target = records.get(source) as T | undefined;
    if (!target) {
      target = { ...source };
      records.set(source, target);
      records.set(target, target);
    } else if (target !== source) {
      for (const key of Object.keys(target)) if (!Object.hasOwn(source, key)) Reflect.deleteProperty(target, key);
      for (const [key, value] of Object.entries(source)) Object.defineProperty(target, key, {value, enumerable: true, configurable: true, writable: true});
    }
    // Public records remain mutable. Revisit current fields even when this is
    // already our projection; wrap() preserves previously guarded functions.
    project(target);
    return target;
  };
  return wrap;
}
`,
};

export function hasPublicCallable(type: ValueType): boolean {
  if (typeof type === 'string') return false;
  if (type.kind === 'callable') return true;
  if (type.kind === 'object') return type.fields.some((field) => hasPublicCallable(field.type));
  if (type.kind === 'value-union') return type.members.some(hasPublicCallable);
  return false;
}

/** Project method results at the public boundary, keeping the captured method raw. */
export function emitPublicMethodProjection(
  callbackType: ValueType,
  options: Pick<Parameters<typeof emitPublicValue>[0], 'wrap' | 'prefix' | 'typeName' | 'typed'>
): string | undefined {
  const type = callableValue(callbackType).returnType;
  if (!hasPublicCallable(type)) return undefined;
  const name = `${options.prefix}PublicResult`;
  const parameter = options.typed !== false ? `${name}: ${options.typeName(type)}` : name;
  return `(${parameter}) => ${emitPublicValue({ ...options, value: name, type })}`;
}

/** Compile a boundary predicate without serializing capabilities as a JSON schema. */
export function emitPublicValueCheck(
  value: string,
  type: ValueType,
  data: (value: string, type: DataType) => string
): string {
  if (isDataValueType(type)) return data(value, type);
  if (typeof type !== 'string') {
    if (type.kind === 'value-union')
      return `(${type.members.map((member) => emitPublicValueCheck(value, member, data)).join(' || ') || 'false'})`;
    if (type.kind === 'callable') return `(typeof ${value} === 'function')`;
    if (type.kind === 'object') {
      const fields = type.fields.map((field) => {
        const descriptor = `Object.getOwnPropertyDescriptor(${value}, ${JSON.stringify(field.name)})`;
        const predicate = `(${descriptor} !== undefined && Object.hasOwn(${descriptor}!, 'value') && ${emitPublicValueCheck(`${descriptor}!.value`, field.type, data)})`;
        return field.optional ? `(${descriptor} === undefined || ${predicate})` : predicate;
      });
      return `(${value} !== null && typeof ${value} === 'object' && !Array.isArray(${value})${fields.map((field) => ` && ${field}`).join('')})`;
    }
    return 'false';
  }
  if (type.startsWith('optional:'))
    return `(${value} === undefined || ${emitPublicValueCheck(value, type.slice(9) as ValueType, data)})`;
  if (type.startsWith('nullable:'))
    return `(${value} === null || ${emitPublicValueCheck(value, type.slice(9) as ValueType, data)})`;
  if (type.endsWith('-list'))
    return `(Array.isArray(${value}) && ${value}.every((item: unknown) => ${emitPublicValueCheck('item', type.slice(0, -5) as ValueType, data)}))`;
  if (type === 'context-key')
    return `(${value} !== null && typeof ${value} === 'object' && Object.getOwnPropertyDescriptor(${value}, '__brand')?.value === 'ContextKey')`;
  // These public snapshots contain nominal identities, not runtime authority.
  return `(${value} !== null && typeof ${value} === 'object' && !Array.isArray(${value}))`;
}

/** Emit field-specific native expressions, preserving opaque identities and omitted fields. */
export function emitPublicValue(options: {
  value: string;
  type: ValueType;
  wrap: string;
  prefix: string;
  typeName: (type: ValueType) => string;
  typed?: boolean;
}): string {
  let sequence = 0;
  const cast = (value: string, type: ValueType) =>
    options.typed !== false
      ? `(${value} as ${options.typeName(type)})`
      : `/** @type {${options.typeName(type)}} */ (${value})`;
  function project(value: string, type: ValueType, receiver?: string): string {
    if (!hasPublicCallable(type)) return value;
    const name = `${options.prefix}PublicValue${sequence++}`;
    const variants = valueAlternatives(type);
    const callable = variants.some(
      (variant) => typeof variant !== 'string' && variant.kind === 'callable'
    );
    const fields = new Map<string, ValueType[]>();
    for (const variant of variants)
      if (typeof variant !== 'string' && variant.kind === 'object')
        for (const field of variant.fields)
          if (hasPublicCallable(field.type))
            fields.set(field.name, [...(fields.get(field.name) ?? []), field.type]);
    let body = name;
    if (fields.size) {
      const target = `${name}Record`;
      const entries = [...fields].map(([key, types]) => {
        const fieldType = joinValueTypes(types);
        const read =
          options.typed !== false
            ? `(${name} as unknown as Record<string, unknown>)[${JSON.stringify(key)}]`
            : `${name}[${JSON.stringify(key)}]`;
        return `if (Object.hasOwn(${name}, ${JSON.stringify(key)})) Object.defineProperty(${target}, ${JSON.stringify(key)}, { value: ${project(cast(read, fieldType), fieldType, name)}, enumerable: true, configurable: true, writable: true });`;
      });
      body = `${name} !== null && typeof ${name} === 'object' ? ${options.wrap}.record(${name}, ${target} => { ${entries.join(' ')} }) : ${name}`;
    }
    if (callable) {
      const returns = variants.flatMap((variant) =>
        typeof variant !== 'string' && variant.kind === 'callable' ? [variant.returnType] : []
      );
      const resultType = joinValueTypes(returns);
      const result = `${name}Result`;
      const resultParameter =
        options.typed !== false ? `${result}: ${options.typeName(resultType)}` : result;
      const resultProjection = hasPublicCallable(resultType)
        ? `, ${receiver ?? 'undefined'}, (${resultParameter}) => ${project(result, resultType)}, ${JSON.stringify(createHash('sha256').update(JSON.stringify(resultType)).digest('hex').slice(0, 16))}`
        : receiver
          ? `, ${receiver}`
          : '';
      body = `typeof ${name} === 'function' ? ${options.wrap}(${name}${resultProjection}) : (${body})`;
    }
    const parameter = options.typed !== false ? `${name}: ${options.typeName(type)}` : name;
    return `((${parameter}) => (${body}))(${value})`;
  }
  return project(options.value, options.type);
}
