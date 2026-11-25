// Type authority for the 0.4 compiler's controlled TypeScript Program.
// The producer resolves these declarations and tracks individual source bindings.
declare const kind: unique symbol;
declare const valueType: unique symbol;
declare const inputType: unique symbol;
declare const taskCommand: unique symbol;

interface Identity<Kind extends string> {
  readonly [kind]: Kind;
}

interface TypedHandle<Kind extends string, Value> extends Identity<Kind> {
  readonly [valueType]: Value;
}

// Writable capabilities accept and produce the same exact type. Widening the
// handle would allow a different value to be supplied by its next consumer.
type Invariant<Value> = (value: Value) => Value;

interface Operation<
  Kind extends string,
  Args extends readonly unknown[],
  Outcome,
> extends TypedHandle<Kind, Outcome> {
  readonly [inputType]: Invariant<Args>;
}

// An immutable read preserves the identity and type of a nested handle.
type ReadValue<Value> = Value extends Identity<string> | ((...args: never[]) => unknown)
  ? Value
  : Value extends object
    ? { readonly [Field in keyof Value]: ReadValue<Value[Field]> }
    : Value;

export type Presence<Value> =
  | { readonly kind: 'omitted' }
  | { readonly kind: 'present'; readonly value: Value };

export type Result<Value, Failure> =
  | { readonly kind: 'ok'; readonly value: ReadValue<Value> }
  | { readonly kind: 'err'; readonly error: ReadValue<Failure> };

export interface StyleTokens extends Identity<'style-tokens'> {}
export declare function tw(tokens: string): StyleTokens;

export interface PropHandle<Value> extends TypedHandle<'prop', Value> {}
export interface DerivedHandle<Value> extends TypedHandle<'derived', Value> {}
export interface ConsumedContext<Value> extends TypedHandle<'context', Value> {}
export interface StateHandle<Value> extends TypedHandle<'state', Value> {
  readonly [inputType]: Invariant<Value>;
}

export type ReadHandle<Value> = TypedHandle<'prop' | 'derived' | 'context' | 'state', Value>;

export interface ContextKey<Value> extends TypedHandle<'context-key', Invariant<Value>> {}
export declare function createContextKey<Value>(debugName: string): ContextKey<Value>;

export interface EventHandle<Payload> extends TypedHandle<'event', Invariant<Payload>> {}
export interface ActionHandle<Args extends readonly unknown[], Outcome> extends Operation<
  'action',
  Args,
  Outcome
> {}
export interface TaskHandle<Args extends readonly unknown[], Outcome> extends Operation<
  'task',
  Args,
  Outcome
> {}
export interface ExternHandle<Args extends readonly unknown[], Outcome> extends Operation<
  'extern',
  Args,
  Outcome
> {}
export interface TaskExtern<Args extends readonly unknown[], Outcome> extends ExternHandle<
  Args,
  Outcome
> {
  readonly [taskCommand]: true;
}

type Target = 'react' | 'gpui' | 'vue2' | 'vue3' | 'web-components';

interface ExternDeclaration {
  readonly name: string;
  readonly effect: string;
  readonly lifetime: string;
  readonly async: boolean;
  readonly targets: readonly Target[];
}

interface AsyncTaskCommand extends ExternDeclaration {
  readonly effect: 'after-state-commit';
  readonly lifetime: 'task';
  readonly async: true;
}

export declare function declareExtern<Args extends readonly unknown[], Outcome>(
  declaration: AsyncTaskCommand
): TaskExtern<Args, Outcome>;
// Other declared effects and lifetimes require their own semantic checks and
// target binding. Only a task command grants the explicit task.await operation.
export declare function declareExtern<Args extends readonly unknown[], Outcome>(
  declaration: ExternDeclaration
): ExternHandle<Args, Outcome>;

interface PropValues {
  readonly boolean: boolean;
  readonly number: number;
  readonly string: string;
}

type PropField = {
  [Kind in keyof PropValues]:
    | {
        readonly type: Kind;
        readonly default?: PropValues[Kind];
        readonly optional?: false;
        readonly controlMode?: never;
      }
    | {
        readonly type: Kind;
        readonly optional: true;
        readonly controlMode?: 'fixed-instance';
        readonly default?: never;
      };
}[keyof PropValues];

type PropRead<Field extends PropField> = Field extends { readonly optional: true }
  ? Presence<PropValues[Field['type']]>
  : PropValues[Field['type']];

type DataRecord<T extends object> = T extends readonly unknown[] | ((...args: never[]) => unknown)
  ? never
  : T;

export interface PropsDefinition {
  define<const Schema extends object & { readonly [Field in keyof Schema]: PropField }>(
    schema: Schema & DataRecord<Schema>
  ): {
    readonly [Field in keyof Schema]: PropHandle<PropRead<Schema[Field]>>;
  };
}

export interface ReadContext {
  // Optional schema inputs already carry an immutable scalar Presence. Preserve
  // its declared domain when reading a prop through any of the phase contexts.
  get<Value extends PropValues[keyof PropValues]>(
    handle: PropHandle<Presence<Value>>
  ): Presence<Value>;
  get<Value>(handle: ReadHandle<Value>): ReadValue<Value>;
}

export interface StateDefinition {
  define<Value>(
    name: string,
    options: { readonly initialize: (read: ReadContext) => Value }
  ): StateHandle<Value>;
}

export interface ActionContext extends ReadContext {
  set<Value>(state: StateHandle<Value>, value: Value): void;
  emit<Payload>(event: EventHandle<Payload>, payload: Payload): void;
  start<Args extends readonly unknown[], Outcome>(
    task: TaskHandle<Args, Outcome>,
    ...args: Args
  ): void;
  cancel<Args extends readonly unknown[], Outcome>(task: TaskHandle<Args, Outcome>): void;
}

export interface TaskContext extends ReadContext {
  readonly set: ActionContext['set'];
  await<Args extends readonly unknown[], Outcome>(
    command: TaskExtern<Args, Outcome>,
    ...args: Args
  ): Promise<Outcome>;
}

export interface ExposeDefinition {
  state<Value>(publicName: string, handle: ReadHandle<Value>): void;
  action<Args extends readonly unknown[], Outcome>(
    publicName: string,
    action: ActionHandle<Args, Outcome>
  ): void;
  event<Payload>(publicName: string): EventHandle<Payload>;
}

export interface EventDefinition {
  on<Args extends readonly unknown[], Outcome>(
    eventName: string,
    action: ActionHandle<Args, Outcome>
  ): void;
}

export interface LifecycleDefinition {
  onCreated<Args extends readonly unknown[], Outcome>(
    action: ActionHandle<Args, Outcome> & ([] extends Args ? unknown : never)
  ): void;
}

export interface ContextDefinition {
  provide<Value>(key: ContextKey<Value>, project: (read: ReadContext) => Value): void;
  consume<Value>(key: ContextKey<Value>): ConsumedContext<Value>;
}

export interface Definition {
  readonly props: PropsDefinition;
  readonly state: StateDefinition;
  readonly expose: ExposeDefinition;
  readonly event: EventDefinition;
  readonly lifecycle: LifecycleDefinition;
  readonly context: ContextDefinition;
  derive<Value>(name: string, compute: (read: ReadContext) => Value): DerivedHandle<Value>;
  action<Args extends readonly unknown[], Outcome>(
    name: string,
    execute: (run: ActionContext, ...args: Args) => Outcome
  ): ActionHandle<Args, Outcome>;
  task<Args extends readonly unknown[], Outcome>(
    name: string,
    options: { readonly policy: 'latest' | 'parallel' | 'serial' },
    execute: (task: TaskContext, ...args: Args) => Promise<Outcome>
  ): TaskHandle<Args, Outcome>;
}

export interface Prototype extends Identity<'prototype'> {}
export interface TemplateNode extends Identity<'template-node'> {}

interface ElementOptions {
  readonly style?: StyleTokens;
  readonly disabled?: boolean;
}

export interface Renderer extends ReadContext {
  el(
    tag: string,
    options?: ElementOptions,
    children?: readonly (TemplateNode | string)[]
  ): TemplateNode;
  // The producer links the resolved child to its setup-declared schema and
  // checks the supplied keys, values and required inputs at this call site.
  child<
    const Props extends object & { readonly [Name in keyof Props]: PropValues[keyof PropValues] },
  >(
    prototype: Prototype,
    options: { readonly key: string | number; readonly props: Props & DataRecord<Props> }
  ): TemplateNode;
}

export declare function definePrototype(declaration: {
  readonly name: string;
  readonly setup: (def: Definition) => (renderer: Renderer) => TemplateNode;
}): Prototype;
