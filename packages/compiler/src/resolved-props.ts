import { acceptsValue } from './data-types';
import type { ExpressionIR, PrototypeIR, StatementIR } from './ir';

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
  // A conditional without an early setup exit cannot bypass a later declaration.
  // Presence is separate from whether repeated declarations prove a non-null value.
  const canExit = (body: readonly StatementIR[]): boolean =>
    body.some(
      (statement) =>
        statement.kind === 'return' ||
        statement.kind === 'throw' ||
        (statement.kind === 'if' && (canExit(statement.then) || canExit(statement.otherwise))) ||
        (statement.kind === 'try' &&
          (canExit(statement.body) ||
            (!!statement.catch && canExit(statement.catch.body)) ||
            (!!statement.finally && canExit(statement.finally))))
    );
  const hooks = new Map(ir.hooks.map((hook) => [hook.id, hook]));
  const reached = new Set<string>();
  const immediate = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const node = value as ExpressionIR;
    if (node.kind === 'function') return;
    if (node.kind === 'conditional') {
      immediate(node.condition);
      return;
    }
    if (node.kind === 'binary' && ['&&', '||', '??'].includes(node.operator)) {
      immediate(node.left);
      return;
    }
    // Ordinary calls may contain an optional chain in their callee. Do not infer
    // installation from their arguments; the direct authored-hook node is enough.
    if (node.kind === 'call') {
      immediate(node.callee);
      return;
    }
    if (node.kind === 'element' && node.optional) {
      immediate(node.object);
      return;
    }
    if (node.kind === 'operation' && node.optional) {
      immediate(node.receiver);
      return;
    }
    if (node.kind === 'operation') guaranteed.add(node);
    if (node.kind === 'authored-hook') {
      const hook = hooks.get(node.hookId);
      if (
        hook &&
        !reached.has(hook.id) &&
        ir.hooks.filter((other) => other.name === hook.name).length === 1
      ) {
        reached.add(hook.id);
        prefix(hook.setup.body);
      }
    }
    for (const [key, child] of Object.entries(value))
      if (key !== 'type' && key !== 'span') immediate(child);
  };
  const prefix = (body: readonly StatementIR[]): void => {
    for (const statement of body) {
      if (
        statement.kind === 'return' ||
        statement.kind === 'throw' ||
        (statement.kind === 'if' && (canExit(statement.then) || canExit(statement.otherwise))) ||
        (statement.kind === 'try' && canExit([statement]))
      )
        break;
      if (statement.kind === 'effect') immediate(statement.expression);
      if (statement.kind === 'const') immediate(statement.value);
    }
  };
  prefix(ir.setup.body);
  const required = new Set<string>(),
    nonNull = new Set<string>();
  for (const prop of ir.props) {
    const declarations = definitions.get(prop.name) ?? [];
    if (declarations.some((declaration) => guaranteed.has(declaration))) required.add(prop.name);
    if (!declarations.some((declaration) => guaranteed.has(declaration))) continue;
    const record = declarations[0].arguments[0];
    const spec =
      record.kind === 'record'
        ? record.entries.find((entry) => entry.key === prop.name)?.value
        : undefined;
    if (opaque || spec?.kind !== 'record') continue;
    // Identical repeated scalar descriptors retain one contract; other refinements
    // remain conservative. In particular, a nullable first default is not erased.
    if (declarations.length > 1) {
      const signature = (value: ExpressionIR | undefined): string | undefined =>
        value?.kind === 'record' && value.entries.every((entry) => entry.value.kind === 'literal')
          ? JSON.stringify(
              value.entries
                .map((entry) => [
                  entry.key,
                  entry.value.kind === 'literal' ? entry.value.value : undefined,
                ])
                .sort(([a], [b]) => String(a).localeCompare(String(b)))
            )
          : undefined;
      const expected = signature(spec);
      if (
        !expected ||
        declarations.some((declaration) => {
          const value = declaration.arguments[0];
          return (
            value?.kind !== 'record' ||
            signature(value.entries.find((entry) => entry.key === prop.name)?.value) !== expected
          );
        })
      )
        continue;
    }
    const fields = new Map(spec.entries.map((entry) => [entry.key, entry.value]));
    const empty = fields.get('empty');
    if (empty && (empty.kind !== 'literal' || empty.value === 'accept')) continue;
    const valid = (value: ExpressionIR | undefined): boolean => {
      if (
        value?.kind !== 'literal' ||
        value.value === null ||
        !acceptsValue(prop.type, value.value)
      )
        return false;
      const options = fields.get('options');
      if (
        options &&
        (options.kind !== 'array' ||
          !options.elements.some(
            (option) => option.kind === 'literal' && option.value === value.value
          ))
      )
        return false;
      const range = fields.get('range');
      if (range) {
        if (range.kind !== 'record' || typeof value.value !== 'number') return false;
        for (const entry of range.entries) {
          if (entry.value.kind !== 'literal' || typeof entry.value.value !== 'number') return false;
          if (
            (entry.key === 'min' && value.value < entry.value.value) ||
            (entry.key === 'max' && value.value > entry.value.value)
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
