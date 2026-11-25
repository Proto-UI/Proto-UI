/** The compile-time input shared by source targets. IDs identify resolved bindings.
 * Names identify their source or host spelling. Neither is an operation selector. */
export type ScalarType = 'bool' | 'number' | 'text' | 'unit' | 'tokens';
export type DataRef = `data:${number}`;
export type ValueType = ScalarType | DataRef;

export interface SourceSpan {
  readonly file: string;
  readonly start: number;
  readonly end: number;
}

export interface DataField {
  readonly name: string;
  readonly type: ValueType;
  readonly source: SourceSpan;
}

export type DataType =
  | { readonly kind: 'presence'; readonly value: ValueType; readonly source: SourceSpan }
  | { readonly kind: 'record'; readonly fields: readonly DataField[]; readonly source: SourceSpan };

/** Resolve a canonical data reference below the exclusive declaration bound. */
export function lookupDataType(types: readonly DataType[], type: ValueType, before = types.length): DataType | undefined {
  const prefix = 'data:';
  if (typeof type !== 'string' || !type.startsWith(prefix) || type.length === prefix.length) return undefined;
  if (type[prefix.length] === '0' && type.length !== prefix.length + 1) return undefined;
  if (!Number.isSafeInteger(before) || before <= 0) return undefined;
  const bound = Math.min(types.length, before);
  let index = 0;
  for (let i = prefix.length; i < type.length; i++) {
    const digit = type.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return undefined;
    index = index * 10 + digit;
    if (index >= bound) return undefined;
  }
  return types[index];
}

export interface Binding {
  readonly id: string;
  readonly name: string;
  readonly type: ValueType;
  readonly source: SourceSpan;
}

export type LiteralValue =
  | { readonly kind: 'bool'; readonly value: boolean }
  /** Sixteen hexadecimal digits preserve signed zero and non-finite literals across IPC. */
  | { readonly kind: 'number'; readonly bits: string }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'tokens'; readonly values: readonly string[] };

export interface InputBinding extends Binding {
  /** A schema default applies when the host omits this input. */
  readonly default?: LiteralValue;
  /** A fixed optional input keeps its initial presence for this instance. */
  readonly controlMode?: 'fixed-instance';
}

export interface ContextKeyIR {
  readonly binding: Binding;
  readonly debugName: string;
  readonly exportName?: string;
}

export interface ContextRead {
  readonly key: string;
  readonly binding: Binding;
}

export interface ContextProvide {
  readonly key: string;
  readonly fn: string;
  readonly source: SourceSpan;
}

export type Value =
  | LiteralValue
  | { readonly kind: 'prop' | 'state' | 'capture' | 'local'; readonly id: string }
  | { readonly kind: 'context'; readonly id: string }
  | {
      readonly kind: 'record';
      readonly type: DataRef;
      /** Evaluate in source order. Each name selects its own declared field type. */
      readonly fields: readonly { readonly name: string; readonly value: Value }[];
    }
  | { readonly kind: 'member'; readonly value: Value; readonly field: string }
  | { readonly kind: 'has-value'; readonly value: Value }
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
  /** The present edge supplies the proven payload before its explicit arguments. */
  | { readonly kind: 'presence'; readonly value: Value; readonly present: Edge; readonly omitted: Edge }
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
  /** Resolved prop, capture, state and consumed Context bindings read transitively. */
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

export interface TextRegion {
  readonly kind: 'text';
  /** A zero-argument pure behavior returning text. */
  readonly value: string;
  readonly source: SourceSpan;
}

export interface ChildProp {
  readonly name: string;
  readonly fn: string;
  readonly source: SourceSpan;
}

export interface ChildView {
  readonly kind: 'child';
  readonly component: string;
  /** A zero-argument pure behavior in the parent that returns the stable text key. */
  readonly key: string;
  readonly props: readonly ChildProp[];
  readonly source: SourceSpan;
}

export type ViewNode = TextRegion | ElementView | ChildView;

export interface ElementView {
  readonly kind: 'element';
  readonly tag: 'span' | 'i' | 'section' | 'div' | 'button';
  readonly source: SourceSpan;
  readonly children: readonly ViewNode[];
  /** Pure token-list behavior, in authored order. */
  readonly style?: string;
  readonly disabled?: string;
  /** An action connected to semantic press completion. */
  readonly activate?: string;
}

export interface ComponentBody {
  /** Resolved definition ID in the compilation unit. */
  readonly id: string;
  /** Public component binding selected from the resolved module export. */
  readonly name: string;
  /** Authored definePrototype metadata, independent of the host binding. */
  readonly prototypeName?: string;
  readonly source: SourceSpan;
  readonly props: readonly InputBinding[];
  readonly consumes: readonly ContextRead[];
  readonly provides: readonly ContextProvide[];
  readonly fields: readonly InitialField[];
  readonly signals: readonly Binding[];
  readonly behaviors: readonly Behavior[];
  readonly projections: readonly NamedBehavior[];
  readonly actions: readonly NamedBehavior[];
  readonly view: ElementView;
}

export interface ComponentIR extends ComponentBody {
  readonly version: 4;
  /** A declaration's own fields and payloads can reference only earlier entries. */
  readonly types: readonly DataType[];
  readonly keys: readonly ContextKeyIR[];
  /** Linked bodies share this root's data and nominal Context key tables. */
  readonly components: readonly ComponentBody[];
}
