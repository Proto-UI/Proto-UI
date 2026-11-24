import { acceptsValue } from './data-types';
import { traceSetupOperations } from './callable-effects';
import type { ExpressionIR, PrototypeIR, StaticValue } from './ir';

/** Literal data only: never run a validator, helper, getter, or host operation. */
function staticPropValue(expression: ExpressionIR | undefined): StaticValue | undefined {
  if (!expression) return undefined;
  if (expression.kind === 'literal')
    return typeof expression.value !== 'number' || Number.isFinite(expression.value)
      ? expression.value
      : undefined;
  if (expression.kind === 'narrow') return staticPropValue(expression.value);
  if (expression.kind === 'unary' && (expression.operator === '-' || expression.operator === '+')) {
    const operand = staticPropValue(expression.operand);
    return typeof operand === 'number'
      ? expression.operator === '-'
        ? -operand
        : operand
      : undefined;
  }
  if (expression.kind === 'array') {
    const values = expression.elements.map(staticPropValue);
    return values.every((value): value is StaticValue => value !== undefined) ? values : undefined;
  }
  if (expression.kind === 'record') {
    const entries = expression.entries.map(
      (entry) => [entry.key, staticPropValue(entry.value)] as const
    );
    if (entries.some(([, value]) => value === undefined)) return undefined;
    return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) as {
      readonly [key: string]: StaticValue;
    };
  }
  return undefined;
}

/** Prove native resolved Props from checked declarations and unconditional default layers. */
export function resolvedPropFacts(ir: PrototypeIR): {
  required: Set<string>;
  nonNull: Set<string>;
} {
  type Operation = Extract<ExpressionIR, { kind: 'operation' }>;
  const definitions = new Map<string, Operation[]>();
  const defaults = new Map<string, ExpressionIR[]>();
  let opaque = false;
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const node = value as ExpressionIR;
    if (
      node.kind === 'operation' &&
      ['props.define', 'props.setDefaults'].includes(node.operation)
    ) {
      const record = node.arguments[0];
      if (record?.kind !== 'record') opaque = true;
      else
        for (const entry of record.entries) {
          if (node.operation === 'props.define')
            definitions.set(entry.key, [...(definitions.get(entry.key) ?? []), node]);
          else defaults.set(entry.key, [...(defaults.get(entry.key) ?? []), entry.value]);
        }
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(ir.setup);
  for (const hook of ir.hooks) visit(hook.setup);
  for (const hook of ir.hooks) if (hook.configure) visit(hook.configure);
  for (const binding of ir.moduleBindings ?? []) visit(binding.value);
  const guaranteed = new Set<Operation>();
  // Inherited prototypes and installed hooks contribute real declarations too.
  // Use the checked call graph's successful-path intersection, rather than
  // treating every syntactically contained closure as an executed declaration.
  const traceIssue = traceSetupOperations(
    ir.setup,
    ir.moduleBindings ?? [],
    {
      operation() {},
      hook() {},
      completePropOperations(operations) {
        for (const operation of operations) guaranteed.add(operation);
      },
    },
    ir.hooks
  );
  if (traceIssue) guaranteed.clear();
  const required = new Set<string>(),
    nonNull = new Set<string>();
  for (const prop of ir.props) {
    const declarations = definitions.get(prop.name) ?? [];
    if (declarations.some((declaration) => guaranteed.has(declaration))) required.add(prop.name);
    if (!declarations.some((declaration) => guaranteed.has(declaration))) continue;
    const specifications = declarations.map((declaration) => {
      const record = declaration.arguments[0];
      return record.kind === 'record'
        ? record.entries.find((entry) => entry.key === prop.name)?.value
        : undefined;
    });
    const spec = specifications[0];
    if (opaque || spec?.kind !== 'record') continue;
    // Identical inherited refinements do not weaken a declared fallback.
    // Different or opaque refinements keep the conservative nullable result.
    const specification = staticPropValue(spec);
    if (
      specification === undefined ||
      specifications.some(
        (candidate) => JSON.stringify(staticPropValue(candidate)) !== JSON.stringify(specification)
      )
    )
      continue;
    const fields = new Map(spec.entries.map((entry) => [entry.key, entry.value]));
    // A user validator can reject an otherwise valid literal fallback. Its
    // authored function is not evaluated by the native type proof.
    if (fields.has('validator')) continue;
    const empty = fields.get('empty');
    if (empty && (empty.kind !== 'literal' || empty.value === 'accept')) continue;
    const valid = (value: ExpressionIR | undefined): boolean => {
      const candidate = staticPropValue(value);
      if (candidate === undefined || candidate === null || !acceptsValue(prop.type, candidate))
        return false;
      const options = fields.get('options');
      if (
        options &&
        (options.kind !== 'array' ||
          !options.elements.some((option) => staticPropValue(option) === candidate))
      )
        return false;
      const range = fields.get('range');
      if (range) {
        if (range.kind !== 'record' || typeof candidate !== 'number') return false;
        for (const entry of range.entries) {
          const bound = staticPropValue(entry.value);
          if (typeof bound !== 'number') return false;
          if (
            (entry.key === 'min' && candidate < bound) ||
            (entry.key === 'max' && candidate > bound)
          )
            return false;
        }
      }
      return true;
    };
    const layers = defaults.get(prop.name) ?? [];
    if (layers.some((value) => !valid(value))) continue;
    const guaranteedLayer = [...guaranteed].some(
      (operation) =>
        operation.operation === 'props.setDefaults' &&
        operation.arguments[0]?.kind === 'record' &&
        operation.arguments[0].entries.some(
          (entry) => entry.key === prop.name && valid(entry.value)
        )
    );
    if (
      (empty?.kind === 'literal' && empty.value === 'error') ||
      guaranteedLayer ||
      valid(fields.get('default'))
    )
      nonNull.add(prop.name);
  }
  return { required, nonNull };
}
