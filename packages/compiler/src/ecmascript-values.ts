import { parseDataType, type DataType } from './data-types';
import { isDataValueType, type ExpressionIR, type ValueType } from './ir';

/** Checked ordinary values and bounded diagnostics. No returned host authority. */
export type EcmaIntrinsicName =
  | 'number'
  | 'console.warn'
  | 'object.keys'
  | 'aggregateError.create'
  | 'typeError.create'
  | `math.${'min' | 'max' | 'abs' | 'ceil' | 'floor' | 'round' | 'trunc' | 'sign' | 'sqrt' | 'cbrt' | 'pow' | 'hypot' | 'log' | 'log2' | 'log10' | 'exp'}`
  | `number.${'isFinite' | 'isInteger' | 'isSafeInteger' | 'isNaN' | 'parseFloat' | 'parseInt'}`
  | `number.value.${'toPrecision' | 'toFixed' | 'toExponential' | 'toString'}`
  | `string.value.${'trim' | 'trimStart' | 'trimEnd' | 'toLowerCase' | 'toUpperCase' | 'normalize' | 'slice' | 'substring' | 'substr' | 'split' | 'startsWith' | 'endsWith' | 'includes' | 'charAt' | 'charCodeAt' | 'codePointAt' | 'replace' | 'replaceAll'}`
  | 'regexp.create'
  | 'regexp.test'
  | 'intl.numberFormat.create'
  | 'intl.numberFormat.format'
  | 'intl.numberFormat.formatToParts'
  | 'intl.numberFormat.resolvedOptions';

const mathMethods = new Set([
  'min',
  'max',
  'abs',
  'ceil',
  'floor',
  'round',
  'trunc',
  'sign',
  'sqrt',
  'cbrt',
  'pow',
  'hypot',
  'log',
  'log2',
  'log10',
  'exp',
]);
const numberStatics = new Set([
  'isFinite',
  'isInteger',
  'isSafeInteger',
  'isNaN',
  'parseFloat',
  'parseInt',
]);
const numberMethods = new Set(['toPrecision', 'toFixed', 'toExponential', 'toString']);
const stringMethods = new Set([
  'trim',
  'trimStart',
  'trimEnd',
  'toLowerCase',
  'toUpperCase',
  'normalize',
  'slice',
  'substring',
  'substr',
  'split',
  'startsWith',
  'endsWith',
  'includes',
  'charAt',
  'charCodeAt',
  'codePointAt',
  'replace',
  'replaceAll',
]);

function alternatives(type: ValueType): readonly ValueType[] {
  return typeof type !== 'string' && (type.kind === 'union' || type.kind === 'value-union')
    ? type.members.flatMap(alternatives)
    : [type];
}
function union(...members: ValueType[]): ValueType {
  const flat = members.flatMap(alternatives);
  if (flat.length === 1) return flat[0];
  // Keep scalar optional results in the same canonical data-union grammar
  // independently rebuilt by the portable IR importer.
  return flat.every(isDataValueType)
    ? parseDataType({ kind: 'union', members: flat })
    : { kind: 'value-union', members: flat };
}
function primitive(type: ValueType, name: 'string' | 'number' | 'boolean'): boolean {
  return alternatives(type).every(
    (member) =>
      member === name ||
      (typeof member !== 'string' && member.kind === 'literal' && typeof member.value === name)
  );
}
function optional(type: ValueType | undefined, accepts: (value: ValueType) => boolean): boolean {
  return (
    type === undefined || alternatives(type).every((member) => member === 'void' || accepts(member))
  );
}
function scalarData(type: ValueType): boolean {
  return alternatives(type).every((member) =>
    typeof member === 'string'
      ? ['string', 'number', 'boolean', 'null', 'void'].includes(member)
      : member.kind === 'literal'
  );
}
function data(type: ValueType): boolean {
  if (typeof type === 'string')
    return ['string', 'number', 'boolean', 'null', 'void'].includes(type);
  if (type.kind === 'literal') return true;
  if (type.kind === 'union' || type.kind === 'value-union') return type.members.every(data);
  if (type.kind === 'array' || type.kind === 'value-array') return data(type.element);
  if (type.kind === 'record' || type.kind === 'object')
    return (
      (type.kind !== 'object' || type.index === undefined) &&
      type.fields.every((field) => data(field.type))
    );
  return false;
}
function stringArray(type: ValueType): boolean {
  return (
    typeof type !== 'string' &&
    (type.kind === 'array' || type.kind === 'value-array') &&
    primitive(type.element, 'string')
  );
}
function exceptionData(type: ValueType): boolean {
  return alternatives(type).every((member) => member === 'exception' || data(member));
}
function exceptionIterable(type: ValueType): boolean {
  return alternatives(type).every(
    (member) =>
      primitive(member, 'string') ||
      (typeof member !== 'string' &&
        (member.kind === 'array' || member.kind === 'value-array' || member.kind === 'set') &&
        exceptionData(member.element))
  );
}

/** Callers must first prove that the global root is not shadowed. */
export function ecmaGlobalCallName(path: readonly string[]): EcmaIntrinsicName | undefined {
  if (path.length === 1 && path[0] === 'Number') return 'number';
  if (path.length === 2 && path[0] === 'console' && path[1] === 'warn') return 'console.warn';
  if (path.length === 2 && path[0] === 'Math' && mathMethods.has(path[1]))
    return `math.${path[1]}` as EcmaIntrinsicName;
  if (path.length === 2 && path[0] === 'Number' && numberStatics.has(path[1]))
    return `number.${path[1]}` as EcmaIntrinsicName;
  if (path.length === 2 && path[0] === 'Object' && path[1] === 'keys') return 'object.keys';
  // Calling NumberFormat without new constructs the same fresh formatter in
  // this direct-global form. Legacy call/apply receivers are not admitted.
  if (path.length === 2 && path[0] === 'Intl' && path[1] === 'NumberFormat')
    return 'intl.numberFormat.create';
  return undefined;
}
export function ecmaConstructorName(path: readonly string[]): EcmaIntrinsicName | undefined {
  if (path.length === 1 && path[0] === 'AggregateError') return 'aggregateError.create';
  if (path.length === 1 && path[0] === 'TypeError') return 'typeError.create';
  if (path.length === 1 && path[0] === 'RegExp') return 'regexp.create';
  if (path.length === 2 && path[0] === 'Intl' && path[1] === 'NumberFormat')
    return 'intl.numberFormat.create';
  return undefined;
}
export function ecmaMemberCallName(
  receiver: ValueType,
  property: string
): EcmaIntrinsicName | undefined {
  if (primitive(receiver, 'string') && stringMethods.has(property))
    return `string.value.${property}` as EcmaIntrinsicName;
  if (primitive(receiver, 'number') && numberMethods.has(property))
    return `number.value.${property}` as EcmaIntrinsicName;
  if (receiver === 'regexp' && property === 'test') return 'regexp.test';
  if (
    receiver === 'intl-number-format' &&
    ['format', 'formatToParts', 'resolvedOptions'].includes(property)
  )
    return `intl.numberFormat.${property}` as EcmaIntrinsicName;
  return undefined;
}

/** Extending one syntactic optional chain is equivalent to another receiver
 * guard only when a successful prior builtin cannot itself return nullish. */
export function ecmaOptionalContinuation(value: ExpressionIR): boolean {
  if (
    value.kind !== 'intrinsic' ||
    !value.optional ||
    !isEcmaIntrinsic(value.name) ||
    !value.arguments.length
  )
    return false;
  const present = alternatives(value.arguments[0].type).filter(
    (type) => type !== 'null' && type !== 'void'
  );
  if (!present.length) return false;
  try {
    const result = ecmaIntrinsicResult(value.name, [
      present.length === 1 ? present[0] : union(...present),
      ...value.arguments.slice(1).map((argument) => argument.type),
    ]);
    return (
      result !== undefined &&
      alternatives(result).every((type) => type !== 'null' && type !== 'void')
    );
  } catch {
    return false;
  }
}
export function isEcmaMemberName(property: string): boolean {
  return (
    stringMethods.has(property) ||
    numberMethods.has(property) ||
    ['test', 'format', 'formatToParts', 'resolvedOptions'].includes(property)
  );
}

const stringOptions = [
  'localeMatcher',
  'style',
  'currency',
  'currencyDisplay',
  'currencySign',
  'numberingSystem',
  'compactDisplay',
  'notation',
  'signDisplay',
  'unit',
  'unitDisplay',
  'roundingPriority',
  'roundingMode',
  'trailingZeroDisplay',
];
const numberOptions = [
  'minimumIntegerDigits',
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumSignificantDigits',
  'maximumSignificantDigits',
  'roundingIncrement',
];
export const INTL_NUMBER_FORMAT_OPTIONS: ValueType = {
  kind: 'object',
  fields: [
    ...stringOptions.map((name) => ({ name, type: 'string' as const, optional: true })),
    ...numberOptions.map((name) => ({ name, type: 'number' as const, optional: true })),
    {
      name: 'useGrouping',
      type: { kind: 'union', members: ['boolean', 'string'] },
      optional: true,
    },
  ],
};
export const INTL_NUMBER_FORMAT_RESOLVED: ValueType = {
  kind: 'record',
  fields: [
    { name: 'locale', type: 'string' },
    { name: 'numberingSystem', type: 'string' },
    { name: 'style', type: 'string' },
    { name: 'minimumIntegerDigits', type: 'number' },
    { name: 'useGrouping', type: { kind: 'union', members: ['boolean', 'string'] } },
    ...[
      'currency',
      'currencyDisplay',
      'currencySign',
      'compactDisplay',
      'notation',
      'signDisplay',
      'unit',
      'unitDisplay',
      'roundingPriority',
      'roundingMode',
      'trailingZeroDisplay',
    ].map((name) => ({ name, type: 'string' as const, optional: true })),
    ...numberOptions
      .filter((name) => name !== 'minimumIntegerDigits')
      .map((name) => ({ name, type: 'number' as const, optional: true })),
  ],
};
export const INTL_NUMBER_FORMAT_PART: DataType = {
  kind: 'record',
  fields: [
    { name: 'type', type: 'string' },
    { name: 'value', type: 'string' },
  ],
};

/** Known lib types are ordinary value metadata, never imported executable code. */
export function ecmaNamedType(path: readonly string[]): ValueType | undefined {
  if (path.length === 1 && path[0] === 'RegExp') return 'regexp';
  if (path.length !== 2 || path[0] !== 'Intl') return undefined;
  if (path[1] === 'NumberFormat') return 'intl-number-format';
  if (path[1] === 'NumberFormatOptions') return INTL_NUMBER_FORMAT_OPTIONS;
  if (path[1] === 'ResolvedNumberFormatOptions') return INTL_NUMBER_FORMAT_RESOLVED;
  if (path[1] === 'NumberFormatPart') return INTL_NUMBER_FORMAT_PART;
  return undefined;
}

/** Non-writable finite ECMAScript constants; the source binding must be unshadowed. */
export function ecmaConstantValue(path: readonly string[]): number | undefined {
  if (path.length !== 2) return undefined;
  const constants: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    Number: {
      EPSILON: Number.EPSILON,
      MAX_VALUE: Number.MAX_VALUE,
      MIN_VALUE: Number.MIN_VALUE,
      MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
      MIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,
    },
    Math: {
      E: Math.E,
      LN10: Math.LN10,
      LN2: Math.LN2,
      LOG10E: Math.LOG10E,
      LOG2E: Math.LOG2E,
      PI: Math.PI,
      SQRT1_2: Math.SQRT1_2,
      SQRT2: Math.SQRT2,
    },
  };
  return Object.hasOwn(constants, path[0]) && Object.hasOwn(constants[path[0]], path[1])
    ? constants[path[0]][path[1]]
    : undefined;
}

export function ecmaRegexLiteral(raw: string): { pattern: string; flags: string } {
  const end = raw.lastIndexOf('/');
  if (!raw.startsWith('/') || end <= 0) throw new TypeError('Invalid regular-expression literal.');
  const pattern = raw.slice(1, end),
    flags = raw.slice(end + 1);
  // Validate syntax only. No author expression, pattern match or replacement
  // executes while parsing or compiling a source module.
  new RegExp(pattern, flags);
  return { pattern, flags };
}

export function ecmaIntrinsicResult(
  name: string,
  args: readonly ValueType[],
  nullish = false
): ValueType | undefined {
  if (!isEcmaIntrinsic(name)) return undefined;
  if (nullish) {
    if (!args.length) throw new TypeError('A nullish ECMAScript member call requires a receiver.');
    if (
      !name.startsWith('string.value.') &&
      !name.startsWith('number.value.') &&
      name !== 'regexp.test' &&
      !/^intl\.numberFormat\.(format|formatToParts|resolvedOptions)$/.test(name)
    )
      throw new TypeError('This ECMAScript call does not admit a nullish receiver.');
    const present = alternatives(args[0]).filter((type) => type !== 'null' && type !== 'void');
    const result = ecmaIntrinsicResult(name, [
      present.length === 1 ? present[0] : union(...present),
      ...args.slice(1),
    ]);
    return union(result!, 'void');
  }
  const expect = (valid: boolean, result: ValueType): ValueType => {
    if (!valid) throw new TypeError(`Invalid checked operands for ${name}.`);
    return result;
  };
  // Opaque values can hide authored conversion callbacks. This bounded Number
  // admission never acquires permission to invoke them through coercion.
  if (name === 'number') return expect(args.length <= 1 && args.every(scalarData), 'number');
  if (name === 'console.warn') return expect(args.every(scalarData), 'void');
  if (name === 'typeError.create')
    return expect(
      args.length <= 1 && optional(args[0], (type) => primitive(type, 'string')),
      'exception'
    );
  if (name === 'aggregateError.create')
    return expect(
      args.length >= 1 &&
        args.length <= 2 &&
        exceptionIterable(args[0]) &&
        optional(args[1], (type) => primitive(type, 'string')),
      'exception'
    );
  if (name === 'object.keys')
    return expect(
      args.length === 1 &&
        typeof args[0] !== 'string' &&
        (args[0].kind === 'object' || args[0].kind === 'record'),
      { kind: 'value-array', element: 'string' }
    );
  if (name.startsWith('math.')) {
    const method = name.slice(5),
      arity = ['min', 'max', 'hypot'].includes(method)
        ? args.length >= 0
        : method === 'pow'
          ? args.length === 2
          : args.length === 1;
    return expect(arity && args.every((type) => primitive(type, 'number')), 'number');
  }
  if (name.startsWith('number.value.'))
    return expect(
      args.length >= 1 &&
        args.length <= 2 &&
        primitive(args[0], 'number') &&
        optional(args[1], (type) => primitive(type, 'number')),
      'string'
    );
  if (name.startsWith('number.')) {
    const parse = name === 'number.parseFloat' || name === 'number.parseInt';
    if (parse)
      return expect(
        (args.length === 1 || (name === 'number.parseInt' && args.length === 2)) &&
          primitive(args[0], 'string') &&
          optional(args[1], (type) => primitive(type, 'number')),
        'number'
      );
    // Retain the existing portable admission for isFinite; widening that
    // operation would also silently widen non-JavaScript target contracts.
    return expect(
      args.length === 1 && (name === 'number.isFinite' ? isDataValueType(args[0]) : data(args[0])),
      'boolean'
    );
  }
  if (name === 'regexp.create')
    return expect(
      args.length <= 2 &&
        optional(args[0], (type) => primitive(type, 'string') || type === 'regexp') &&
        optional(args[1], (type) => primitive(type, 'string')),
      'regexp'
    );
  if (name === 'regexp.test')
    return expect(
      args.length === 2 && args[0] === 'regexp' && primitive(args[1], 'string'),
      'boolean'
    );
  if (name.startsWith('string.value.')) {
    if (!args.length || !primitive(args[0], 'string'))
      throw new TypeError('String method requires a checked string receiver.');
    const method = name.slice('string.value.'.length),
      count = args.length - 1;
    if (['trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase'].includes(method))
      return expect(count === 0, 'string');
    if (method === 'normalize')
      return expect(count <= 1 && optional(args[1], (type) => primitive(type, 'string')), 'string');
    if (['slice', 'substring', 'substr'].includes(method))
      return expect(
        count <= 2 &&
          args.slice(1).every((type) => optional(type, (value) => primitive(value, 'number'))),
        'string'
      );
    if (['startsWith', 'endsWith', 'includes'].includes(method))
      return expect(
        count >= 1 &&
          count <= 2 &&
          primitive(args[1], 'string') &&
          optional(args[2], (type) => primitive(type, 'number')),
        'boolean'
      );
    if (['charAt', 'charCodeAt', 'codePointAt'].includes(method))
      return expect(
        count <= 1 && optional(args[1], (type) => primitive(type, 'number')),
        method === 'charAt'
          ? 'string'
          : method === 'codePointAt'
            ? union('number', 'void')
            : 'number'
      );
    if (method === 'split')
      return expect(
        count <= 2 &&
          optional(args[1], (type) => primitive(type, 'string') || type === 'regexp') &&
          optional(args[2], (type) => primitive(type, 'number')),
        { kind: 'value-array', element: 'string' }
      );
    if (method === 'replace' || method === 'replaceAll')
      return expect(
        count === 2 &&
          (primitive(args[1], 'string') || args[1] === 'regexp') &&
          primitive(args[2], 'string'),
        'string'
      );
  }
  if (name === 'intl.numberFormat.create') {
    const locales = optional(args[0], (type) => primitive(type, 'string') || stringArray(type));
    const options = optional(
      args[1],
      (type) =>
        typeof type !== 'string' && (type.kind === 'object' || type.kind === 'record') && data(type)
    );
    return expect(args.length <= 2 && locales && options, 'intl-number-format');
  }
  if (name === 'intl.numberFormat.resolvedOptions')
    return expect(
      args.length === 1 && args[0] === 'intl-number-format',
      INTL_NUMBER_FORMAT_RESOLVED
    );
  if (name === 'intl.numberFormat.format' || name === 'intl.numberFormat.formatToParts')
    return expect(
      args.length === 2 && args[0] === 'intl-number-format' && primitive(args[1], 'number'),
      name.endsWith('formatToParts')
        ? { kind: 'value-array', element: INTL_NUMBER_FORMAT_PART }
        : 'string'
    );
  throw new TypeError(`No checked ECMAScript result for ${name}.`);
}

export function isEcmaIntrinsic(name: string): name is EcmaIntrinsicName {
  if (
    name === 'number' ||
    name === 'console.warn' ||
    name === 'object.keys' ||
    name === 'aggregateError.create' ||
    name === 'typeError.create' ||
    name === 'regexp.create' ||
    name === 'regexp.test'
  )
    return true;
  if (name.startsWith('math.')) return mathMethods.has(name.slice(5));
  if (name.startsWith('number.value.'))
    return numberMethods.has(name.slice('number.value.'.length));
  if (name.startsWith('string.value.'))
    return stringMethods.has(name.slice('string.value.'.length));
  if (name.startsWith('number.')) return numberStatics.has(name.slice(7));
  return [
    'intl.numberFormat.create',
    'intl.numberFormat.format',
    'intl.numberFormat.formatToParts',
    'intl.numberFormat.resolvedOptions',
  ].includes(name);
}
export function emitEcmaIntrinsic(
  name: string,
  args: readonly string[],
  nullish = false,
  typed = true
): string | undefined {
  if (!isEcmaIntrinsic(name)) return undefined;
  if (name === 'number') return `Number(${args.join(', ')})`;
  if (name === 'console.warn') return `console.warn(${args.join(', ')})`;
  if (name === 'aggregateError.create') return `new AggregateError(${args.join(', ')})`;
  if (name === 'typeError.create') return `new TypeError(${args.join(', ')})`;
  if (name === 'object.keys') return `Object.keys(${args.join(', ')})`;
  if (name.startsWith('math.')) return `Math.${name.slice(5)}(${args.join(', ')})`;
  if (name.startsWith('number.') && !name.startsWith('number.value.'))
    return `Number.${name.slice(7)}(${args.join(', ')})`;
  if (name === 'regexp.create') return `new RegExp(${args.join(', ')})`;
  if (name === 'intl.numberFormat.create') {
    const operands = args.map((value, index) =>
      typed && index === 1 ? `(${value} as Intl.NumberFormatOptions | undefined)` : value
    );
    return `new Intl.NumberFormat(${operands.join(', ')})`;
  }
  const method = name.slice(name.lastIndexOf('.') + 1);
  return `(${args[0]})${nullish ? '?.' : '.'}${method}(${args.slice(1).join(', ')})`;
}
export function ecmaTypeName(type: ValueType): string | undefined {
  if (type === 'regexp') return 'RegExp';
  if (type === 'intl-number-format') return 'Intl.NumberFormat';
  return undefined;
}
