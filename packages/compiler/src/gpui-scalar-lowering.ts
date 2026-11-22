import type { ExpressionIR, ValueType } from './ir';

export type GpuiScalarKind = 'boolean' | 'number' | 'string';

/** A checked union with one scalar representation needs no runtime type dispatch. */
export function gpuiScalarKind(type: ValueType): GpuiScalarKind | undefined {
  if (type === 'boolean' || type === 'number' || type === 'string') return type;
  if (typeof type === 'string') return;
  if (type.kind === 'literal') {
    const kind = typeof type.value;
    return kind === 'boolean' || kind === 'number' || kind === 'string' ? kind : undefined;
  }
  if (type.kind === 'union' || type.kind === 'value-union') {
    const first = type.members[0] && gpuiScalarKind(type.members[0]);
    if (first && type.members.every((member) => gpuiScalarKind(member) === first)) return first;
  }
}

export const gpuiScalarRustType = (kind: GpuiScalarKind): string =>
  kind === 'number' ? 'f64' : kind === 'boolean' ? 'bool' : 'String';

export const gpuiBoxScalar = (kind: GpuiScalarKind, value: string): string =>
  kind === 'string' ? `Value::string(&(${value}))` : `Value::${kind}(${value})`;

export const gpuiUnboxScalar = (kind: GpuiScalarKind, value: string): string =>
  `(${value}).${kind === 'number' ? 'num' : kind === 'boolean' ? 'bool' : 'text'}()`;

/** Rust float syntax must not append a decimal point after an exponent. */
export function gpuiNumberLiteral(value: number): string {
  if (Number.isNaN(value)) return 'f64::NAN';
  if (value === Infinity) return 'f64::INFINITY';
  if (value === -Infinity) return 'f64::NEG_INFINITY';
  if (Object.is(value, -0)) return '-0.0_f64';
  const text = String(value);
  return `${/[.eE]/.test(text) ? text : text + '.0'}_f64`;
}

interface ScalarEmitter {
  /** Emits the ordinary value boundary, without re-entering this scalar for the same node. */
  ordinary(node: ExpressionIR): string;
  value(node: ExpressionIR): string;
  scalarReference(node: ExpressionIR): string | undefined;
  string(value: string): string;
  fresh(): string;
}

/**
 * Lower scalar computations from checked types. Only a host/public/unknown-value
 * boundary reads a Value; intermediate scalar operations and lexical storage are
 * native Rust. Coercion helpers implement language atoms, not authored protocols.
 */
export function createGpuiScalarEmitter(emitter: ScalarEmitter) {
  function truthyScalar(kind: GpuiScalarKind, code: string): string {
    if (kind === 'boolean') return code;
    if (kind === 'string') return `!(${code}).is_empty()`;
    const name = emitter.fresh();
    return `{ let ${name}:f64=${code}; ${name}!=0.0 && !${name}.is_nan() }`;
  }
  function truthy(node: ExpressionIR): string {
    const kind = gpuiScalarKind(node.type);
    // A caught UTF-16 unit can be a source string without being a Rust String.
    // String observations therefore keep the existing lossless Value boundary.
    return kind && kind !== 'string'
      ? truthyScalar(kind, scalar(node))
      : `(${emitter.value(node)}).truthy()`;
  }
  function number(node: ExpressionIR): string {
    const kind = gpuiScalarKind(node.type);
    if (kind === 'number') return scalar(node);
    if (kind === 'boolean') return `if ${scalar(node)} {1.0} else {0.0}`;
    // Source strings also include caught UTF-16 units. Do not force them
    // through Rust String before applying the language's numeric conversion.
    if (kind === 'string') return `(${emitter.value(node)}).scalar_number()`;
    return `(${emitter.value(node)}).scalar_number()`;
  }
  function scalar(node: ExpressionIR): string {
    const kind = gpuiScalarKind(node.type);
    if (!kind || kind === 'string')
      throw new Error('Native scalar lowering requires one checked scalar representation.');
    const reference = emitter.scalarReference(node);
    if (reference !== undefined) return reference;
    if (node.kind === 'literal') {
      if (typeof node.value === 'boolean') return String(node.value);
      if (typeof node.value === 'number') return gpuiNumberLiteral(node.value);
    }
    if (node.kind === 'narrow') {
      return gpuiScalarKind(node.value.type) === kind
        ? scalar(node.value)
        : gpuiUnboxScalar(kind, emitter.value(node.value));
    }
    const asScalar = (value: ExpressionIR): string =>
      gpuiScalarKind(value.type) === kind
        ? scalar(value)
        : gpuiUnboxScalar(kind, emitter.value(value));
    if (node.kind === 'conditional')
      return `if ${truthy(node.condition)} {${asScalar(node.then)}} else {${asScalar(node.otherwise)}}`;
    if (node.kind === 'unary')
      return node.operator === '!'
        ? `!(${truthy(node.operand)})`
        : `${node.operator === '-' ? '-' : ''}(${number(node.operand)})`;
    if (node.kind === 'binary') {
      const leftKind = gpuiScalarKind(node.left.type);
      const rightKind = gpuiScalarKind(node.right.type);
      const left = emitter.fresh(),
        right = emitter.fresh();
      if (['&&', '||', '??'].includes(node.operator)) {
        if (leftKind === kind) {
          if (node.operator === '??') return scalar(node.left);
          const selectRight = `${node.operator === '||' ? '!' : ''}(${truthyScalar(kind, left)})`;
          return `{ let ${left}=${scalar(node.left)}; if ${selectRight} {${asScalar(node.right)}} else {${left}} }`;
        }
        const selectRight =
          node.operator === '??'
            ? `${left}.nullish()`
            : `${node.operator === '||' ? '!' : ''}${left}.truthy()`;
        return `{ let ${left}=${emitter.value(node.left)}; if ${selectRight} {${asScalar(node.right)}} else {${gpuiUnboxScalar(kind, left)}} }`;
      }
      if (node.operator === '===' || node.operator === '!==') {
        if (leftKind && rightKind && leftKind !== 'string' && rightKind !== 'string') {
          const equals = leftKind === rightKind ? `${left}==${right}` : 'false';
          return `{ let ${left}=${scalar(node.left)}; let ${right}=${scalar(node.right)}; ${node.operator === '!==' ? '!' : ''}(${equals}) }`;
        }
        return gpuiUnboxScalar(kind, emitter.ordinary(node));
      }
      if (['<', '<=', '>', '>='].includes(node.operator)) {
        if (leftKind === 'string' && rightKind === 'string')
          return gpuiUnboxScalar(kind, emitter.ordinary(node));
        return `{ let ${left}:f64=${number(node.left)}; let ${right}:f64=${number(node.right)}; ${left} ${node.operator} ${right} }`;
      }
      return `{ let ${left}:f64=${number(node.left)}; let ${right}:f64=${number(node.right)}; ${left} ${node.operator} ${right} }`;
    }
    if (node.kind === 'intrinsic') {
      if (node.name === 'number.isFinite') {
        const input = node.arguments[0];
        const inputKind = gpuiScalarKind(input.type);
        if (inputKind === 'number') return `(${scalar(input)}).is_finite()`;
        if (inputKind) return `{ let _=${emitter.value(input)}; false }`;
      }
    }
    return gpuiUnboxScalar(kind, emitter.ordinary(node));
  }
  return { scalar, truthy };
}
