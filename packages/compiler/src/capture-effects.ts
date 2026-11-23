import type { ExpressionIR } from './ir';

type Operation = Extract<ExpressionIR, { kind: 'operation' }>;
type Field = readonly [string, number | 'result' | { readonly literal: string }];
export interface CaptureEffect {
  readonly bucket: 'props' | 'state' | 'context' | 'event' | 'feedback';
  readonly fields?: readonly Field[];
  readonly direct?: number | 'result';
  readonly disposer?: 'props' | 'context' | 'event' | 'feedback';
  readonly eventKey?: boolean;
  readonly method?: boolean;
  readonly introducedState?: number;
}
const operation = (name: string): Field => ['op', { literal: name }];

/** Closed compiler facts for successful setup effects, not a bucket interpreter. */
export function captureEffect(name: Operation['operation']): CaptureEffect | undefined {
  switch (name) {
    case 'props.define':
      return { bucket: 'props', fields: [operation('define'), ['specMap', 0]] };
    case 'props.setDefaults':
      return { bucket: 'props', fields: [operation('setDefaults'), ['partial', 0]] };
    case 'props.watch':
    case 'props.watchRaw':
      return {
        bucket: 'props',
        fields: [operation(name.slice(6)), ['keys', 0], ['off', 'result']],
        disposer: 'props',
      };
    case 'props.watchAll':
    case 'props.watchRawAll':
      return {
        bucket: 'props',
        fields: [operation(name.slice(6)), ['off', 'result']],
        disposer: 'props',
      };
    case 'state.bool':
    case 'state.string':
    case 'state.enum':
    case 'state.numberDiscrete':
    case 'state.numberRange':
      return { bucket: 'state', direct: 'result' };
    case 'expose.state':
      return {
        bucket: 'state',
        fields: [operation(name), ['key', 0], ['handle', 1]],
        introducedState: 1,
      };
    case 'accessible.state':
      return {
        bucket: 'state',
        fields: [operation('a11y.state'), ['key', 0], ['handle', 1], ['options', 2]],
        introducedState: 1,
      };
    case 'expose.value':
      return { bucket: 'context', fields: [operation(name), ['key', 0], ['value', 1]] };
    case 'expose.method':
      return { bucket: 'context', fields: [operation(name), ['key', 0], ['fn', 1]], method: true };
    case 'expose.event':
      return {
        bucket: 'event',
        fields: [operation(name), ['key', 0], ['spec', 1]],
        eventKey: true,
      };
    case 'context.provide':
      return { bucket: 'context', fields: [operation('provide'), ['key', 0]] };
    case 'context.subscribe':
    case 'context.trySubscribe':
      return {
        bucket: 'context',
        fields: [operation(name.slice(8)), ['key', 0], ['off', 'result']],
        disposer: 'context',
      };
    case 'event.on':
    case 'event.onGlobal':
      return { bucket: 'event', fields: [['off', 'result']], disposer: 'event' };
    case 'feedback.style.use':
      return { bucket: 'feedback', direct: 'result', disposer: 'feedback' };
    default:
      return undefined;
  }
}

export function captureReceipt(
  effect: CaptureEffect,
  argument: (index: number) => string,
  result: string,
  literal: (value: string) => string,
  record: (fields: readonly (readonly [string, string])[]) => string
): string {
  const value = (field: Field[1]): string =>
    field === 'result'
      ? result
      : typeof field === 'number'
        ? argument(field)
        : literal(field.literal);
  return effect.direct !== undefined
    ? value(effect.direct)
    : record(effect.fields!.map(([name, field]) => [name, value(field)] as const));
}

/** Receivers and arguments are evaluated once, before the successful effect receipt. */
export function emitCapturedWebOperation(options: {
  value: Operation;
  prefix: string;
  manager: string;
  interaction: string;
  emit(value: ExpressionIR, capture?: boolean): string;
  declaration?(
    value: ExpressionIR,
    name: string,
    initializer: string,
    argumentIndex?: number
  ): string;
}): string | undefined {
  const { value, prefix, manager, interaction, emit } = options;
  const effect = captureEffect(value.operation);
  if (!effect || value.optional) return undefined;
  const definitions: string[] = [];
  const reference = (input: ExpressionIR, name: string, argumentIndex?: number): ExpressionIR => {
    const initializer = emit(input);
    definitions.push(
      options.declaration?.(input, name, initializer, argumentIndex) ??
        'const ' + name + ' = ' + initializer + ';'
    );
    return { kind: 'reference', name, type: input.type, span: input.span };
  };
  const receiver = value.receiver
    ? reference(value.receiver, prefix + 'CaptureReceiver')
    : undefined;
  const args = value.arguments.map((arg, index) =>
    reference(arg, prefix + 'CaptureArg' + index, index)
  );
  const argument = (index: number) =>
    index < args.length ? prefix + 'CaptureArg' + index : 'undefined';
  const result = prefix + 'CaptureResult';
  const call = emit({ ...value, receiver, arguments: args }, false);
  const listener = value.operation === 'event.on' || value.operation === 'event.onGlobal';
  const off = listener ? prefix + 'CaptureOff' : result;
  const receipt = listener
    ? '{token: ' + result + ', off: ' + off + '}'
    : captureReceipt(
        effect,
        argument,
        result,
        JSON.stringify,
        (fields) =>
          '{' +
          fields.map(([name, source]) => JSON.stringify(name) + ': ' + source).join(', ') +
          '}'
      );
  const records = [
    ...(listener
      ? ['const ' + off + ' = () => ' + interaction + '.releaseListener(' + result + ');']
      : []),
    manager + '.effect(' + JSON.stringify(effect.bucket) + ', ' + receipt + ');',
    ...(effect.disposer
      ? [manager + '.disposer(' + JSON.stringify(effect.disposer) + ', ' + off + ');']
      : []),
    ...(effect.eventKey ? [manager + '.eventKey(' + argument(0) + ');'] : []),
    ...(effect.method ? [manager + '.method(' + argument(0) + ', ' + argument(1) + ');'] : []),
    ...(effect.introducedState !== undefined
      ? [manager + '.introduceObserved(' + argument(effect.introducedState) + ');']
      : []),
  ];
  // JSDoc must start on its own line to attach to the declaration, including
  // the first temporary. Same-line comments can belong to the preceding token.
  return (
    '(() => {\n' +
    definitions.join('\n') +
    '\nconst ' +
    result +
    ' = ' +
    call +
    '; ' +
    records.join(' ') +
    ' return ' +
    result +
    '; })()'
  );
}
