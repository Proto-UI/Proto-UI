import type { AuthoredHookIR, HookCaptureIR, ValueType } from './ir';
import { captureStateHandlesType, operationResultType } from './operations';
import {
  joinValueTypes,
  objectFields,
  valueAlternatives,
  type ObjectValueType,
} from './value-types';

type HookView = Pick<AuthoredHookIR, 'id' | 'setup' | 'capture'>;
type Field = ObjectValueType['fields'][number];

/** A finite public facade, not the Runtime's private effect-bucket representation. */
export function captureFacadeFields(
  hook: HookView | undefined,
  childHandles: ReadonlyMap<string, ValueType>,
  capture: HookCaptureIR | undefined = hook?.capture
): Field[] {
  const states = captureStateHandlesType(capture);
  const methods: ValueType = {
    kind: 'object',
    fields: (capture?.methods ?? []).map(({ name, type }) => ({
      name,
      type,
      optional: true,
      readonly: true,
    })),
  };
  const events: ValueType = {
    kind: 'object',
    fields: (capture?.events ?? []).map((name) => ({
      name,
      type: { kind: 'literal', value: name },
      optional: true,
      readonly: true,
    })),
  };
  const getter = (operation: string, keys: readonly string[]): ValueType => {
    const lookup = keys.map((key) => ({
      key,
      type:
        operationResultType(operation, undefined, {
          capture,
          captureKey: key,
          childHandles,
        }) ?? 'void',
    }));
    return {
      kind: 'callable',
      parameters: [{ name: 'name', type: 'string' }],
      returnType: joinValueTypes([...lookup.map(({ type }) => type), 'void']),
      lookup,
    };
  };
  const field = (name: string, type: ValueType, optional = true): Field => ({
    name,
    type,
    ...(optional ? { optional: true } : {}),
    readonly: true,
  });
  const children = (capture?.children ?? []).map(({ name }) => name);
  return [
    // Opaque receipts may be forwarded, but cannot prove public JSON or grant
    // callable authority. Their internal bucket layout is not a public contract.
    ...['props', 'state', 'context', 'event', 'feedback', 'disposers'].map((name) =>
      field(name, 'unknown')
    ),
    field('stateHandles', states, valueAlternatives(states).includes('void')),
    field(
      'getState',
      getter(
        'capture.getState',
        (capture?.states ?? []).map(({ name }) => name)
      )
    ),
    field('methods', methods),
    field(
      'getMethod',
      getter(
        'capture.getMethod',
        (capture?.methods ?? []).map(({ name }) => name)
      )
    ),
    // Capability-bearing collections remain opaque at the ordinary value boundary;
    // getAsHook/getAsHookHandle retain precise, checked literal-key projections.
    field('asHooks', 'unknown'),
    field('getAsHook', getter('capture.getAsHook', children)),
    field('getAsHookHandle', getter('capture.getAsHookHandle', children)),
    field('artifacts', {
      kind: 'object',
      fields: [
        field('stateHandles', states),
        field('eventKeys', events),
        field('methods', methods),
        field('asHooks', 'unknown'),
      ],
    }),
    field('render', hook?.setup.returnType ?? 'void'),
  ];
}

/** Spread only closed records and explicitly known nullish alternatives. */
export function checkedSpreadFields(
  type: ValueType,
  captureFields: (id: string) => readonly Field[]
): Field[] | undefined {
  const alternatives = valueAlternatives(type).map((member) => {
    if (
      member === 'void' ||
      member === 'null' ||
      (typeof member !== 'string' && member.kind === 'literal' && member.value === null)
    )
      return [] as readonly Field[];
    if (typeof member !== 'string' && member.kind === 'capture')
      return captureFields(member.hookId);
    if (typeof member !== 'string' && member.kind === 'object' && member.index !== undefined)
      return undefined;
    return objectFields(member);
  });
  if (alternatives.some((fields) => fields === undefined)) return undefined;
  const records = alternatives as readonly (readonly Field[])[];
  const names = new Set(records.flatMap((fields) => fields.map(({ name }) => name)));
  return [...names].map((name) => {
    const fields = records.map((fields) => fields.find((field) => field.name === name));
    return {
      name,
      type: joinValueTypes(fields.flatMap((field) => (field ? [field.type] : []))),
      ...(fields.some((field) => !field || field.optional) ? { optional: true } : {}),
    };
  });
}

/** An absent optional source property leaves a preceding target property intact. */
export function mergeSpreadField(fields: Map<string, Field>, field: Field): void {
  const previous = fields.get(field.name);
  fields.set(
    field.name,
    field.optional && previous
      ? {
          name: field.name,
          type: joinValueTypes([previous.type, field.type]),
          ...(previous.optional ? { optional: true } : {}),
        }
      : field
  );
}
