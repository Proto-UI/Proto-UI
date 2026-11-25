/** The compile-time input shared by source targets. IDs identify resolved bindings.
 * Names identify their source or host spelling. Neither is an operation selector. */
export type ValueType = 'bool' | 'number' | 'text' | 'unit';

export interface SourceSpan {
  readonly file: string;
  readonly start: number;
  readonly end: number;
}

export interface Binding {
  readonly id: string;
  readonly name: string;
  readonly type: ValueType;
  readonly source: SourceSpan;
}

export type Value =
  | { readonly kind: 'bool'; readonly value: boolean }
  /** Sixteen hexadecimal digits preserve signed zero and non-finite literals across IPC. */
  | { readonly kind: 'number'; readonly bits: string }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'prop' | 'state' | 'capture' | 'local'; readonly id: string }
  | { readonly kind: 'not'; readonly value: Value }
  | {
      readonly kind: 'binary';
      readonly op: 'add' | 'multiply' | 'equal' | 'concat';
      readonly left: Value;
      readonly right: Value;
    }
  | { readonly kind: 'call'; readonly fn: string; readonly args: readonly Value[] };

export type Instruction = { readonly source: SourceSpan } & (
  | { readonly kind: 'let'; readonly binding: Binding; readonly value: Value }
  | { readonly kind: 'write' | 'emit'; readonly target: string; readonly value: Value }
  | { readonly kind: 'invoke'; readonly fn: string; readonly args: readonly Value[] }
);

export interface Edge {
  readonly block: string;
  readonly args: readonly Value[];
}

export type Terminator = { readonly source: SourceSpan } & (
  | { readonly kind: 'return'; readonly value?: Value }
  | { readonly kind: 'jump'; readonly to: Edge }
  | { readonly kind: 'branch'; readonly condition: Value; readonly yes: Edge; readonly no: Edge }
  | { readonly kind: 'fail'; readonly reason: string }
);

export interface Block {
  readonly id: string;
  readonly params: readonly Binding[];
  readonly instructions: readonly Instruction[];
  readonly end: Terminator;
}

export interface Behavior {
  readonly binding: Binding;
  readonly phase: 'init' | 'pure' | 'action';
  readonly params: readonly Binding[];
  /** Resolved prop, capture and state bindings read by this function, transitively. */
  readonly dependencies: readonly string[];
  readonly entry: string;
  readonly blocks: readonly Block[];
}

export interface NamedBehavior {
  readonly name: string;
  readonly fn: string;
}

/** Instance initializers read current props and earlier initialized fields. Capture
 * values keep their creation value; prop reads observe the latest published input. */
export interface InitialField {
  readonly kind: 'state' | 'capture';
  readonly binding: Binding;
  readonly init: string;
}

export interface ComponentIR {
  readonly version: 1;
  readonly name: string;
  readonly source: SourceSpan;
  readonly props: readonly Binding[];
  readonly fields: readonly InitialField[];
  readonly signals: readonly Binding[];
  readonly behaviors: readonly Behavior[];
  readonly projections: readonly NamedBehavior[];
  readonly actions: readonly NamedBehavior[];
  readonly view: {
    readonly role: 'text' | 'button';
    readonly text: string;
    readonly disabled?: string;
    readonly activate?: string;
  };
}
