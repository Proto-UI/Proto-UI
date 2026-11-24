import { createHash } from 'node:crypto';
import type { DataType } from './data-types';
import { isAssignable } from './data-types';
import { relationalOperandKind } from './expression-types';
import { gpuiLexicalNames } from './gpui-lexical-names';
import { validateIR } from './ir-validation';
import { isDataValueType, statementsTerminate } from './ir';
import { serializableDataType } from './value-types';
import type {
  CompileResult,
  ExpressionIR,
  FunctionIR,
  PrototypeIR,
  SourceSpan,
  StatementIR,
} from './ir';
import { portableDataMethods, type PortableModuleBinding } from './portable-data-methods';
import { rustDataSupport, type RustDataSupportFeature } from './rust-data-support';
import { rustMathRound } from './rust-scalar-intrinsics';

export interface RustDataOptions {
  /** Select checked pure module functions by their unambiguous exposed names. Setup is not run. */
  methods: readonly string[];
  /** Stable Cargo identity chosen by the embedding project. */
  crateName?: string;
  /** Caller-declared Cargo license metadata for translated source; not inferred or SPDX-validated. */
  sourceLicense?: string;
}
export interface RustDataMethod {
  name: string;
  rustName: string;
  parameters: {
    name: string;
    rustName: string;
    type: DataType;
    optional: boolean;
    rustType: string;
  }[];
  returnType: DataType;
  rustReturnType: string;
}
export interface RustDataModule {
  format: 'proto-ui-rust-data';
  version: 1;
  profile: 'rust-data-v1';
  code: string;
  supportingFiles: { path: string; contents: string; kind: 'source' | 'declaration' }[];
  dependencies: { name: string; version: string; role: 'language-support' }[];
  methods: RustDataMethod[];
  provenance: {
    source: PrototypeIR['source'];
    irVersion: PrototypeIR['schemaVersion'];
    backend: 'rust-data-v1';
    sourceLicense?: string;
    sourceResolution?: {
      version: 1;
      imports: Readonly<Record<string, string>>;
      packages: readonly { manifest: string; sha256: string }[];
    };
  };
}

const rustKeywords = new Set(
  'as async await break const continue crate dyn else enum extern false fn for gen if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while abstract become box do final macro override priv typeof unsized virtual yield try'.split(
    ' '
  )
);
function snake(value: string): string {
  let result = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .toLowerCase();
  if (!/^[a-z]/.test(result)) result = `data_${result}`;
  return rustKeywords.has(result) ? `data_${result}` : result;
}
function pascal(value: string): string {
  return (
    snake(value)
      .split('_')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('') || 'Data'
  );
}
const local = (name: string) => `v_${Buffer.from(name, 'utf8').toString('hex')}`;
const hasLoneSurrogate = (value: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
type Scope = ReadonlyMap<string, DataType>;
type RecordType = Extract<DataType, { kind: 'record' }>;
type UnionType = Extract<DataType, { kind: 'union' }>;
const canonical = (type: DataType): unknown => {
  if (typeof type === 'string') return type;
  if (type.kind === 'record')
    return {
      ...type,
      fields: [...type.fields]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((f) => ({ ...f, type: canonical(f.type) })),
    };
  if (type.kind === 'array') return { ...type, element: canonical(type.element) };
  if (type.kind === 'union') return { ...type, members: type.members.map(canonical) };
  return type;
};
const typeKey = (type: DataType): string => JSON.stringify(canonical(type));
const sameType = (left: DataType, right: DataType): boolean => typeKey(left) === typeKey(right);
function allocateName(preferred: string, used: Set<string>): string {
  let name = preferred;
  for (let suffix = 1; used.has(name); suffix += 1) name = `${preferred}_${suffix}`;
  used.add(name);
  return name;
}
const primitive = (type: DataType): string | undefined =>
  typeof type === 'string'
    ? type
    : type.kind === 'literal'
      ? type.value === null
        ? 'null'
        : typeof type.value
      : undefined;

/** Emit explicit checked pure function exports as ordinary typed Rust, independently of any UI target. */
export function emitRustDataSource(
  input: PrototypeIR,
  options: RustDataOptions
): CompileResult<RustDataModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const failure = (
    code: string,
    message: string,
    span = input.setup.span
  ): CompileResult<RustDataModule> => ({
    ok: false,
    diagnostics: [{ code, category: 'unsupported-input', message, span }],
  });
  if (
    !options ||
    !Array.isArray(options.methods) ||
    !options.methods.length ||
    options.methods.some((name) => typeof name !== 'string' || !name) ||
    new Set(options.methods).size !== options.methods.length
  )
    return failure(
      'PUI_RUST_DATA_SELECTION',
      'Select a non-empty list of distinct exposed pure method names.'
    );
  const crateName = options.crateName ?? `generated-data-${input.source.sha256.slice(0, 16)}`;
  if (
    typeof crateName !== 'string' ||
    !/^[a-z][a-z0-9_-]{0,63}$/.test(crateName) ||
    rustKeywords.has(crateName.replaceAll('-', '_'))
  )
    return failure(
      'PUI_RUST_DATA_NAME',
      'Choose a non-reserved Cargo name of 1–64 lowercase ASCII letters, digits, underscores or hyphens, beginning with a letter.'
    );
  const sourceLicense = options.sourceLicense;
  if (
    sourceLicense !== undefined &&
    (typeof sourceLicense !== 'string' ||
      !sourceLicense.trim() ||
      /[\u0000-\u001f\u007f-\u009f\uD800-\uDFFF]/u.test(sourceLicense))
  )
    return failure(
      'PUI_RUST_DATA_LICENSE',
      'sourceLicense must be a non-empty Unicode string without control characters or unpaired surrogates.'
    );
  const ir = gpuiLexicalNames(checked.value);
  const eligible = portableDataMethods(ir);
  for (const name of options.methods)
    if (!eligible.has(name))
      return failure(
        'PUI_RUST_DATA_PURITY',
        `Method ${JSON.stringify(name)} is not an unambiguous checked immutable portable module function. Owner operations, mutable captures, recursive calls, closures and unsupported syntax require a component owner or a separate compiler capability.`
      );
  if (new Set(options.methods.map(snake)).size !== options.methods.length)
    return failure(
      'PUI_RUST_DATA_NAME',
      'Selected method names collide after Rust identifier normalization.'
    );

  class Unsupported extends Error {
    constructor(
      message: string,
      readonly span: SourceSpan = ir.setup.span
    ) {
      super(message);
    }
  }
  const modules = new Map((ir.moduleBindings ?? []).map((binding) => [binding.name, binding]));
  const functions = new Map<PortableModuleBinding, string>();
  const functionNames = new Set([
    'ecma_numeric_space',
    'ecma_radix_number',
    'ecma_string_number',
    'ecma_number_text',
  ]);
  const publicNames = new Map(
    options.methods.map((name) => [name, allocateName(snake(name), functionNames)])
  );
  const features = new Set<RustDataSupportFeature>();
  const types = new Map<string, { name: string; type: RecordType | UnionType }>();
  const usedNames = new Set([
    'DataError',
    'Undefined',
    'String',
    'DataArray',
    'Option',
    'Result',
    'Rc',
    'Vec',
    'From',
    'Some',
    'None',
    'Ok',
    'Err',
  ]);
  const declarations: string[] = [];
  let sequence = 0;
  const fresh = () => `pui_local_${sequence++}`;
  const rustString = (value: string, span = ir.setup.span): string => {
    if (hasLoneSurrogate(value))
      throw new Unsupported(
        'Rust source strings and public data keys cannot contain an unpaired UTF-16 surrogate.',
        span
      );
    return `"${Array.from(value, (character) => {
      const cp = character.codePointAt(0)!;
      return character === '"' || character === '\\'
        ? `\\${character}`
        : cp < 32 || cp === 127
          ? `\\u{${cp.toString(16)}}`
          : character;
    }).join('')}"`;
  };
  function literal(value: string | number | boolean | null): string {
    if (value === null) return '()';
    if (typeof value === 'string') return `${rustString(value)}.to_owned()`;
    if (typeof value === 'boolean') return String(value);
    const text = Object.is(value, -0) ? '-0' : String(value);
    return `${/^-?\d+$/.test(text) ? `${text}.0` : text}f64`;
  }
  function optionalFieldData(type: DataType): DataType {
    if (typeof type === 'string') return type;
    if (type.kind === 'array') return { ...type, element: optionalFieldData(type.element) };
    if (type.kind === 'union') return { ...type, members: type.members.map(optionalFieldData) };
    if (type.kind !== 'record') return type;
    return {
      ...type,
      fields: type.fields.map((field) => {
        // Both ordinary objects and already checked DataType records can carry
        // the optional field's read-domain undefined. The existing finite-data
        // projection represents that absence once, through the optional bit.
        const projected = field.optional
          ? serializableDataType({ kind: 'record', fields: [field] })
          : undefined;
        const value =
          projected && typeof projected !== 'string' && projected.kind === 'record'
            ? projected.fields[0].type
            : field.type;
        return { ...field, type: optionalFieldData(value) };
      }),
    };
  }
  function data(type: ExpressionIR['type'], span = ir.setup.span): DataType {
    if (isDataValueType(type)) return optionalFieldData(type);
    if (typeof type !== 'string' && type.kind === 'value-array') {
      const schema = serializableDataType(type);
      if (schema !== undefined) return optionalFieldData(schema);
    }
    if (typeof type !== 'string' && type.kind === 'object' && !type.index) {
      // An optional ordinary field includes undefined in its read type; its
      // finite-data schema already records absence with `optional`. Reuse that
      // projection so the Rust ABI has one Option, while required explicit
      // void fields and literal validation retain their existing handling.
      const schema = serializableDataType(type);
      if (schema !== undefined) return optionalFieldData(schema);
      return optionalFieldData({
        kind: 'record',
        fields: type.fields.map((field) => ({
          name: field.name,
          type: data(field.type, span),
          ...(field.optional ? { optional: true } : {}),
        })),
      });
    }
    if (typeof type !== 'string' && type.kind === 'value-union')
      return { kind: 'union', members: type.members.map((member) => data(member, span)) };
    throw new Unsupported(
      'A checked pure expression has no finite portable Rust representation.',
      span
    );
  }
  function fieldNames(type: RecordType): Map<string, string> {
    const normalized = type.fields.map((field) => snake(field.name));
    const used = new Set(['identity']);
    return new Map(
      [...type.fields]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((field) => {
          let name = snake(field.name);
          if (
            name === 'identity' ||
            normalized.filter((candidate) => candidate === name).length > 1
          )
            name += `_${createHash('sha256').update(field.name).digest('hex').slice(0, 12)}`;
          return [field.name, allocateName(name, used)];
        })
    );
  }
  function variant(type: UnionType, index: number): string {
    const member = type.members[index];
    if (typeof member !== 'string' && member.kind === 'literal' && typeof member.value === 'string')
      return `${pascal(member.value)}${index}`;
    if (member === 'void') return `Undefined${index}`;
    if (primitive(member) === 'null') return `Null${index}`;
    return `Alternative${index}`;
  }
  const unitVariant = (member: DataType): boolean =>
    member === 'void' ||
    primitive(member) === 'null' ||
    (typeof member !== 'string' && member.kind === 'literal');
  const unitValue = (member: DataType): string =>
    member === 'void'
      ? 'Undefined'
      : typeof member !== 'string' && member.kind === 'literal'
        ? literal(member.value)
        : '()';
  function layout(type: RecordType | UnionType, hint = `Data${types.size}`): string {
    const key = typeKey(type),
      known = types.get(key);
    if (known) return known.name;
    let name = pascal(hint);
    if (usedNames.has(name)) name += createHash('sha256').update(key).digest('hex').slice(0, 8);
    name = allocateName(name, usedNames);
    types.set(key, { name, type });
    if (type.kind === 'record') {
      const names = fieldNames(type);
      const fields = type.fields.map((field) => ({
        ...field,
        rustName: names.get(field.name)!,
        rustType: typeName(field.type, `${name}${pascal(field.name)}`),
      }));
      declarations.push(
        `#[derive(Debug)]\npub struct ${name} {\n    identity: Rc<()>,\n${fields.map((field) => `    /// Source field ${rustString(field.name)}.\n    pub ${field.rustName}: ${field.optional ? `Option<${field.rustType}>` : field.rustType},`).join('\n')}\n}\nimpl ${name} {\n    pub fn new(${fields.map((field) => `${field.rustName}: ${field.optional ? `Option<${field.rustType}>` : field.rustType}`).join(', ')}) -> Rc<Self> {\n        Rc::new(Self { identity: Rc::new(()), ${fields.map((field) => field.rustName).join(', ')} })\n    }\n}`
      );
    } else {
      const variants = type.members.map(
        (member, index) =>
          `    ${variant(type, index)}${unitVariant(member) ? '' : `(${typeName(member, `${name}Alternative${index}`)})`},`
      );
      declarations.push(`#[derive(Clone, Debug)]\npub enum ${name} {\n${variants.join('\n')}\n}`);
    }
    return name;
  }
  function typeName(type: DataType, hint?: string): string {
    const kind = primitive(type);
    if (kind)
      return { boolean: 'bool', number: 'f64', string: 'String', null: '()', void: 'Undefined' }[
        kind
      ]!;
    if (typeof type === 'string') throw new Unsupported('Unknown data type.');
    if (type.kind === 'array') {
      features.add('array');
      return `DataArray<${typeName(type.element, hint && `${hint}Item`)}>`;
    }
    return type.kind === 'record' ? `Rc<${layout(type, hint)}>` : layout(type as UnionType, hint);
  }
  function unionMap(
    code: string,
    type: UnionType,
    map: (code: string, member: DataType) => string
  ): string {
    const name = layout(type);
    return `match ${code} { ${type.members
      .map((member, index) => {
        const payload = fresh();
        return `${name}::${variant(type, index)}${unitVariant(member) ? '' : `(${payload})`} => { ${map(unitVariant(member) ? unitValue(member) : payload, member)} }`;
      })
      .join(', ')} }`;
  }
  function convert(code: string, actual: DataType, expected: DataType): string {
    if (
      sameType(actual, expected) ||
      (primitive(actual) && primitive(actual) === primitive(expected))
    )
      return code;
    if (typeof actual !== 'string' && actual.kind === 'union')
      return unionMap(code, actual, (value, member) => convert(value, member, expected));
    if (typeof expected !== 'string' && expected.kind === 'union') {
      const index = expected.members.findIndex((member) => isAssignable(actual, member));
      if (index >= 0) {
        const member = expected.members[index],
          tag = `${layout(expected)}::${variant(expected, index)}`;
        return unitVariant(member)
          ? `{ let _ = ${code}; ${tag} }`
          : `${tag}(${convert(code, actual, member)})`;
      }
      // A flow-refined read can select a finite literal arm from a broader scalar.
      if (primitive(actual)) {
        const value = fresh();
        return `{ let ${value} = ${code}; ${expected.members
          .map((member, index) => {
            if (
              typeof member !== 'string' &&
              member.kind === 'literal' &&
              primitive(member) === primitive(actual)
            )
              return `if ${value} == ${literal(member.value)} { ${layout(expected)}::${variant(expected, index)} } else `;
            return '';
          })
          .join('')}{ return Err(DataError::InvalidType("checked union")); } }`;
      }
    }
    if (
      typeof actual !== 'string' &&
      actual.kind === 'record' &&
      typeof expected !== 'string' &&
      expected.kind === 'record'
    ) {
      const value = fresh(),
        names = fieldNames(actual),
        targetNames = fieldNames(expected);
      const fields = expected.fields.map((field) => {
        const source = actual.fields.find((candidate) => candidate.name === field.name);
        let result: string;
        if (!source)
          result = field.optional
            ? 'None'
            : 'return Err(DataError::InvalidType("missing checked field"))';
        else if (source.optional && field.optional)
          result = `${value}.${names.get(field.name)}.clone().map(|value| Ok(${convert('value', source.type, field.type)})).transpose()?`;
        else if (source.optional)
          result = convert(
            `${value}.${names.get(field.name)}.clone().ok_or(DataError::InvalidType("missing checked field"))?`,
            source.type,
            field.type
          );
        else {
          result = convert(`${value}.${names.get(field.name)}.clone()`, source.type, field.type);
          if (field.optional) result = `Some(${result})`;
        }
        return `${targetNames.get(field.name)}: ${result}`;
      });
      return `{ let ${value} = ${code}; Rc::new(${layout(expected)} { identity: ${value}.identity.clone(), ${fields.join(', ')} }) }`;
    }
    if (
      typeof actual !== 'string' &&
      actual.kind === 'array' &&
      typeof expected !== 'string' &&
      expected.kind === 'array'
    ) {
      const value = fresh();
      typeName(expected);
      return `{ let ${value} = ${code}; DataArray { identity: ${value}.identity.clone(), items: Rc::new(${value}.iter().cloned().map(|value| Ok(${convert('value', actual.element, expected.element)})).collect::<Result<Vec<_>, DataError>>()?) } }`;
    }
    return `{ let _ = ${code}; return Err(DataError::InvalidType("checked refinement")); }`;
  }
  function truthy(code: string, type: DataType): string {
    if (typeof type !== 'string' && type.kind === 'union') return unionMap(code, type, truthy);
    const value = fresh();
    const result =
      primitive(type) === 'boolean'
        ? value
        : primitive(type) === 'number'
          ? `${value} != 0. && !${value}.is_nan()`
          : primitive(type) === 'string'
            ? `!${value}.is_empty()`
            : primitive(type) === 'null' || primitive(type) === 'void'
              ? 'false'
              : 'true';
    return `{ let ${value} = ${code}; ${result} }`;
  }
  function numeric(code: string, type: DataType): string {
    if (typeof type !== 'string' && type.kind === 'union') return unionMap(code, type, numeric);
    switch (primitive(type)) {
      case 'number':
        return code;
      case 'boolean':
        return `if ${code} { 1.0f64 } else { 0.0f64 }`;
      case 'null':
        return `{ let _ = ${code}; 0.0f64 }`;
      case 'void':
        return `{ let _ = ${code}; f64::NAN }`;
      case 'string':
        features.add('string-number');
        return `ecma_string_number(&(${code}))`;
      default:
        throw new Unsupported('Numeric conversion of a structured value is not admitted.');
    }
  }
  function textual(code: string, type: DataType): string {
    if (typeof type !== 'string' && type.kind === 'union') return unionMap(code, type, textual);
    switch (primitive(type)) {
      case 'string':
        return code;
      case 'number':
        features.add('number-text');
        return `ecma_number_text(${code})`;
      case 'boolean':
        return `if ${code} { "true".to_owned() } else { "false".to_owned() }`;
      case 'null':
        return `{ let _ = ${code}; "null".to_owned() }`;
      case 'void':
        return `{ let _ = ${code}; "undefined".to_owned() }`;
      default:
        throw new Unsupported('Text conversion of a structured value is not admitted.');
    }
  }
  function equal(left: string, leftType: DataType, right: string, rightType: DataType): string {
    if (typeof leftType !== 'string' && leftType.kind === 'union')
      return unionMap(left, leftType, (value, type) =>
        equal(value, type, `${right}.clone()`, rightType)
      );
    if (typeof rightType !== 'string' && rightType.kind === 'union')
      return unionMap(right, rightType, (value, type) =>
        equal(`${left}.clone()`, leftType, value, type)
      );
    const a = primitive(leftType),
      b = primitive(rightType);
    if (a || b)
      return a === b ? (a === 'null' || a === 'void' ? 'true' : `${left} == ${right}`) : 'false';
    const ak = typeof leftType !== 'string' ? leftType.kind : '',
      bk = typeof rightType !== 'string' ? rightType.kind : '';
    return ak === bk ? `Rc::ptr_eq(&${left}.identity, &${right}.identity)` : 'false';
  }
  function validate(code: string, type: DataType): string {
    const value = fresh();
    let check = '';
    if (typeof type !== 'string' && type.kind === 'union') {
      if (type.members.every(unitVariant)) return '';
      check = `${unionMap(value, type, (memberValue, member) => (unitVariant(member) ? '()' : `{ ${validate(memberValue, member)} }`))};`;
    } else if (primitive(type) === 'number')
      check = `if !${value}.is_finite() { return Err(DataError::NonFiniteNumber); }${typeof type !== 'string' && type.kind === 'literal' ? ` if ${value} != ${literal(type.value)} { return Err(DataError::InvalidType("literal")); }` : ''}`;
    else if (typeof type !== 'string' && type.kind === 'literal')
      check = `if ${value} != ${literal(type.value)} { return Err(DataError::InvalidType("literal")); }`;
    else if (typeof type !== 'string' && type.kind === 'array') {
      const itemCheck = validate('(*item).clone()', type.element);
      if (!itemCheck) return '';
      check = `for item in ${value}.iter() { ${itemCheck} }`;
    } else if (typeof type !== 'string' && type.kind === 'record') {
      const names = fieldNames(type);
      check = type.fields
        .map((field) => {
          const check = validate(
            field.optional ? '(*field).clone()' : `${value}.${names.get(field.name)}.clone()`,
            field.type
          );
          return !check
            ? ''
            : field.optional
              ? `if let Some(field) = &${value}.${names.get(field.name)} { ${check} }`
              : check;
        })
        .filter(Boolean)
        .join(' ');
    }
    return check ? `{ let ${value} = (${code}).clone(); ${check} }` : '';
  }
  function optionalArgument(code: string, actual: DataType, expected: DataType): string {
    if (typeof actual !== 'string' && actual.kind === 'union')
      return unionMap(code, actual, (value, member) => optionalArgument(value, member, expected));
    return primitive(actual) === 'void'
      ? `{ let _ = ${code}; None }`
      : `Some(${convert(code, actual, expected)})`;
  }
  function callTarget(node: ExpressionIR): PortableModuleBinding {
    const name =
      node.kind === 'helper-call'
        ? node.name
        : node.kind === 'call' && node.callee.kind === 'reference'
          ? node.callee.name
          : '';
    const binding = modules.get(name);
    if (!binding || binding.value.kind !== 'function')
      throw new Unsupported('Pure function closure lost a checked module call target.', node.span);
    return binding;
  }
  function collect(binding: PortableModuleBinding): void {
    if (functions.has(binding)) return;
    functions.set(binding, allocateName(`pui_function_${functions.size}`, functionNames));
    function walk(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      const node = value as ExpressionIR;
      if (node.kind === 'call' || node.kind === 'helper-call') collect(callTarget(node));
      for (const [key, child] of Object.entries(value))
        if (!['span', 'type', 'captures'].includes(key)) walk(child);
    }
    walk(binding.value);
  }
  function project(
    code: string,
    object: DataType,
    property: string,
    optional: boolean,
    expected: DataType
  ): string {
    if (typeof object !== 'string' && object.kind === 'union')
      return unionMap(code, object, (value, member) =>
        project(value, member, property, optional, expected)
      );
    if (primitive(object) === 'null' || primitive(object) === 'void')
      return optional
        ? convert(`{ let _ = ${code}; Undefined }`, 'void', expected)
        : `{ let _ = ${code}; return Err(DataError::NullishProperty); }`;
    if (typeof object !== 'string' && object.kind === 'record') {
      const field = object.fields.find((field) => field.name === property);
      if (!field) return convert(`{ let _ = ${code}; Undefined }`, 'void', expected);
      const access = `(${code}).${fieldNames(object).get(property)}.clone()`;
      return field.optional
        ? `match ${access} { Some(value) => ${convert('value', field.type, expected)}, None => ${convert('Undefined', 'void', expected)} }`
        : convert(access, field.type, expected);
    }
    if (property === 'length' && typeof object !== 'string' && object.kind === 'array')
      return convert(`(${code}).len() as f64`, 'number', expected);
    if (property === 'length' && primitive(object) === 'string')
      return convert(`(${code}).encode_utf16().count() as f64`, 'number', expected);
    return convert(`{ let _ = ${code}; Undefined }`, 'void', expected);
  }
  function expression(
    node: ExpressionIR,
    scope: Scope,
    expected = data(node.type, node.span)
  ): string {
    const actual = data(node.type, node.span);
    const emit = (value: ExpressionIR, target?: DataType) => expression(value, scope, target);
    if (node.kind === 'record' && typeof expected !== 'string' && expected.kind === 'record') {
      const locals = new Map<string, { name: string; type: DataType }>();
      const evaluated = node.entries.map((entry) => {
        const name = fresh(),
          type =
            expected.fields.find((field) => field.name === entry.key)?.type ??
            data(entry.value.type);
        locals.set(entry.key, { name, type });
        return `let ${name} = ${emit(entry.value, type)};`;
      });
      const fields = expected.fields.map((field) => {
        const item = locals.get(field.name),
          name = fieldNames(expected).get(field.name);
        if (!item)
          return `${name}: ${field.optional ? 'None' : 'return Err(DataError::InvalidType("missing field"))'}`;
        return `${name}: ${field.optional ? `Some(${item.name})` : item.name}`;
      });
      return `{ ${evaluated.join(' ')} Rc::new(${layout(expected)} { identity: Rc::new(()), ${fields.join(', ')} }) }`;
    }
    if (node.kind === 'array' && typeof expected !== 'string' && expected.kind === 'array') {
      typeName(expected);
      return `DataArray::new(vec![${node.elements.map((item) => emit(item, expected.element)).join(', ')}])`;
    }
    if (node.kind === 'conditional')
      return `if ${truthy(emit(node.condition), data(node.condition.type))} { ${emit(node.then, expected)} } else { ${emit(node.otherwise, expected)} }`;
    let code: string;
    switch (node.kind) {
      case 'literal':
        code = literal(node.value);
        break;
      case 'undefined':
        code = 'Undefined';
        break;
      case 'reference':
        return convert(`${local(node.name)}.clone()`, scope.get(node.name) ?? actual, expected);
      case 'narrow':
        return emit(node.value, expected);
      case 'record':
        return convert(expression(node, scope, actual), actual, expected);
      case 'array':
        return convert(expression(node, scope, actual), actual, expected);
      case 'member':
        return project(
          emit(node.object),
          data(node.object.type),
          node.property,
          node.optional,
          expected
        );
      case 'element': {
        const objectType = data(node.object.type),
          object = fresh(),
          index = fresh();
        if (typeof objectType === 'string' || objectType.kind !== 'array')
          throw new Unsupported(
            'Rust data element access currently requires a checked array; finite record/string dynamic keys are not lowered.',
            node.span
          );
        if (primitive(data(node.index.type)) !== 'number')
          throw new Unsupported(
            'Rust data array element access currently requires a numeric index.',
            node.span
          );
        code = `{ let ${object} = ${emit(node.object)}; let ${index} = ${emit(node.index)}; if ${index}.is_finite() && ${index} >= 0. && ${index}.fract() == 0. && ${index} < ${object}.len() as f64 { ${convert(`${object}[${index} as usize].clone()`, objectType.element, expected)} } else { ${convert('Undefined', 'void', expected)} } }`;
        return code;
      }
      case 'call':
      case 'helper-call': {
        const target = callTarget(node);
        if (target.value.kind !== 'function')
          throw new Unsupported('Missing pure function.', node.span);
        const fn = target.value.function;
        const args = fn.parameters.map((parameter, index) => {
          const argument = node.arguments[index],
            type = data(parameter.type);
          if (!argument || argument.kind === 'undefined')
            return parameter.optional ? 'None' : convert('Undefined', 'void', type);
          return parameter.optional
            ? optionalArgument(emit(argument), data(argument.type), type)
            : emit(argument, type);
        });
        code = `${functions.get(target)}(${args.join(', ')})?`;
        break;
      }
      case 'intrinsic':
        if (node.name === 'math.round') code = rustMathRound(emit(node.arguments[0], 'number'));
        else if (node.name === 'math.floor')
          code = `(${emit(node.arguments[0], 'number')}).floor()`;
        else if (node.name === 'number')
          code = node.arguments.length
            ? numeric(emit(node.arguments[0]), data(node.arguments[0].type))
            : '0.0f64';
        else if (node.name === 'string')
          code = node.arguments.length
            ? textual(emit(node.arguments[0]), data(node.arguments[0].type))
            : 'String::new()';
        else
          throw new Unsupported(
            `The immutable Rust data artifact does not lower ${node.name}.`,
            node.span
          );
        break;
      case 'unary':
        code =
          node.operator === '!'
            ? `!(${truthy(emit(node.operand), data(node.operand.type))})`
            : `${node.operator === '-' ? '-' : ''}(${numeric(emit(node.operand), data(node.operand.type))})`;
        break;
      case 'binary': {
        const leftType = data(node.left.type),
          rightType = data(node.right.type),
          left = fresh(),
          right = fresh();
        if (node.operator === '&&' || node.operator === '||')
          return `{ let ${left} = ${emit(node.left)}; if ${node.operator === '||' ? '!' : ''}(${truthy(`${left}.clone()`, leftType)}) { ${emit(node.right, expected)} } else { ${convert(left, leftType, expected)} } }`;
        if (node.operator === '??') {
          const isNullish = (value: string, type: DataType): string =>
            typeof type !== 'string' && type.kind === 'union'
              ? unionMap(value, type, isNullish)
              : `{ let _ = ${value}; ${primitive(type) === 'null' || primitive(type) === 'void'} }`;
          return `{ let ${left} = ${emit(node.left)}; if ${isNullish(`${left}.clone()`, leftType)} { ${emit(node.right, expected)} } else { ${convert(left, leftType, expected)} } }`;
        }
        let operation: string;
        if (node.operator === '===' || node.operator === '!==')
          operation = `${node.operator === '!==' ? '!' : ''}(${equal(left, leftType, right, rightType)})`;
        else if (['<', '<=', '>', '>='].includes(node.operator))
          operation =
            relationalOperandKind(leftType, rightType) === 'string'
              ? `(${textual(left, leftType)}).encode_utf16().cmp((${textual(right, rightType)}).encode_utf16()) ${node.operator} std::cmp::Ordering::Equal`
              : `(${numeric(left, leftType)}) ${node.operator} (${numeric(right, rightType)})`;
        else if (node.operator === '+' && primitive(actual) === 'string')
          operation = `(${textual(left, leftType)}) + &(${textual(right, rightType)})`;
        else if (node.operator === '+' && typeof actual !== 'string' && actual.kind === 'union')
          throw new Unsupported(
            'Mixed string/number addition requires a finite result-arm lowering not yet admitted by the Rust data artifact.',
            node.span
          );
        else
          operation = `(${numeric(left, leftType)}) ${node.operator} (${numeric(right, rightType)})`;
        code = `{ let ${left} = ${emit(node.left)}; let ${right} = ${emit(node.right)}; ${operation} }`;
        break;
      }
      case 'object-spread':
        throw new Unsupported(
          'Object spread is not yet represented by the typed Rust data artifact; explicit record fields remain supported.',
          node.span
        );
      default:
        throw new Unsupported(
          `The immutable Rust data artifact does not lower ${node.kind}.`,
          node.span
        );
    }
    return convert(code, actual, expected);
  }
  function statements(
    body: readonly StatementIR[],
    parent: Scope,
    returnType: DataType,
    depth: number
  ): string {
    const indent = '    '.repeat(depth),
      scope = new Map(parent);
    return body
      .map((statement): string => {
        switch (statement.kind) {
          case 'const': {
            const type = data(statement.value.type),
              code = expression(statement.value, scope);
            scope.set(statement.name, type);
            return `${indent}let ${local(statement.name)}: ${typeName(type)} = ${code};\n`;
          }
          case 'effect':
            return `${indent}let _ = ${expression(statement.expression, scope)};\n`;
          case 'return':
            return `${indent}return Ok(${statement.value ? expression(statement.value, scope, returnType) : convert('Undefined', 'void', returnType)});\n`;
          case 'if':
            return `${indent}if ${truthy(expression(statement.condition, scope), data(statement.condition.type))} {\n${statements(statement.then, scope, returnType, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, scope, returnType, depth + 1)}${indent}}` : ''}\n`;
          default:
            throw new Unsupported(
              `The immutable Rust data artifact does not lower ${statement.kind} statements.`,
              statement.span
            );
        }
      })
      .join('');
  }
  function emitFunction(binding: PortableModuleBinding): string {
    if (binding.value.kind !== 'function')
      throw new Unsupported('Expected checked module function.', binding.span);
    const fn: FunctionIR = binding.value.function,
      scope = new Map<string, DataType>();
    const defaults = fn.parameters
      .map((parameter) => {
        const type = data(parameter.type),
          name = local(parameter.name);
        const bodyType: DataType =
          parameter.optional && !parameter.default
            ? { kind: 'union', members: [type, 'void'] }
            : type;
        const code = parameter.default
          ? `    let ${name} = match match ${name} { Some(value) => ${optionalArgument('value', type, type)}, None => None } { Some(value) => value, None => ${expression(parameter.default, scope, type)} };\n`
          : parameter.optional
            ? `    let ${name} = match ${name} { Some(value) => ${convert('value', type, bodyType)}, None => ${convert('Undefined', 'void', bodyType)} };\n`
            : '';
        scope.set(parameter.name, bodyType);
        return code;
      })
      .join('');
    const result = data(fn.returnType),
      body = statements(fn.body, scope, result, 1);
    return `fn ${functions.get(binding)}(${fn.parameters.map((parameter) => `${local(parameter.name)}: ${parameter.optional ? `Option<${typeName(data(parameter.type))}>` : typeName(data(parameter.type))}`).join(', ')}) -> Result<${typeName(result)}, DataError> {\n${defaults}${body}${statementsTerminate(fn.body) ? '' : `    Ok(${convert('Undefined', 'void', result)})\n`}}`;
  }
  try {
    options.methods.forEach((name) => collect(eligible.get(name)!));
    const methods: RustDataMethod[] = options.methods.map((name) => {
      const exposure = ir.exposes.find(
        (exposure) => exposure.kind === 'method' && exposure.name === name
      )!;
      if (exposure.kind !== 'method')
        throw new Unsupported('Selected method has no portable data signature.', exposure.span);
      const returnType = data(exposure.returnType);
      return {
        name,
        rustName: publicNames.get(name)!,
        parameters: exposure.parameters.map((parameter, index) => {
          const type = data(parameter.type);
          return {
            name: parameter.name,
            rustName: `argument_${index}`,
            type,
            optional: Boolean(parameter.optional),
            rustType: typeName(type, `${pascal(name)}${pascal(parameter.name)}`),
          };
        }),
        returnType,
        rustReturnType: typeName(returnType, `${pascal(name)}Result`),
      };
    });
    const authored = [...functions].map(([binding]) => emitFunction(binding)).join('\n\n');
    const entries = methods
      .map(
        (method) =>
          `/// Calls selected pure source function ${rustString(method.name)}; component setup is not executed.\npub fn ${method.rustName}(${method.parameters.map((parameter) => `${parameter.rustName}: ${parameter.optional ? `Option<${parameter.rustType}>` : parameter.rustType}`).join(', ')}) -> Result<${method.rustReturnType}, DataError> {\n    ${method.parameters.map((parameter) => (parameter.optional ? `if let Some(value) = &${parameter.rustName} { ${validate('(*value).clone()', parameter.type)} }` : validate(parameter.rustName, parameter.type))).join('\n    ')}\n    let result = ${functions.get(eligible.get(method.name)!)}(${method.parameters.map((parameter) => parameter.rustName).join(', ')})?;\n    ${validate('result', method.returnType)}\n    Ok(result)\n}`
      )
      .join('\n\n');
    const code = `// Generated checked typed data functions. No setup, renderer, owner, dynamic object map or IR interpreter.\n#![allow(dead_code, unused_variables, unused_mut, unused_imports, unreachable_code)]\n${rustDataSupport(features)}\n${declarations.join('\n\n')}\n\n${authored}\n\n${entries}\n`;
    const dependencies: RustDataModule['dependencies'] = features.has('number-text')
      ? [{ name: 'serde_json', version: '1.0', role: 'language-support' }]
      : [];
    // For well-formed Unicode without controls, JSON quoting is also a safe TOML basic string.
    // This encodes caller metadata; it does not determine SPDX validity or licensing rights.
    const licenseLine =
      sourceLicense === undefined ? '' : 'license = ' + JSON.stringify(sourceLicense) + '\n';
    const manifest = `[package]\nname = ${JSON.stringify(crateName)}\nversion = "0.1.0"\nedition = "2021"\n${licenseLine}publish = false\n\n[lib]\npath = "lib.rs"\n\n[dependencies]\n${dependencies.map((dependency) => `${dependency.name} = ${JSON.stringify(dependency.version)}\n`).join('')}`;
    return {
      ok: true,
      value: {
        format: 'proto-ui-rust-data',
        version: 1,
        profile: 'rust-data-v1',
        code,
        supportingFiles: [{ path: 'Cargo.toml', contents: manifest, kind: 'source' }],
        dependencies,
        methods,
        provenance: {
          source: input.source,
          irVersion: input.schemaVersion,
          backend: 'rust-data-v1',
          ...(sourceLicense === undefined ? {} : { sourceLicense }),
        },
      },
    };
  } catch (error) {
    if (error instanceof Unsupported)
      return failure('PUI_RUST_DATA_UNSUPPORTED', error.message, error.span);
    throw error;
  }
}
