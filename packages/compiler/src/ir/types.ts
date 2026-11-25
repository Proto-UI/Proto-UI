import type { SourceSpan } from '../diagnostics';

export const PROTO_IR_VERSION = 2 as const;

export const CAPABILITY_BITS = {
  props: 1n << 0n,
  state: 1n << 1n,
  expose: 1n << 2n,
  event: 1n << 3n,
  lifecycle: 1n << 4n,
  context: 1n << 5n,
  style: 1n << 6n,
  rule: 1n << 7n,
  render: 1n << 8n,
  trigger: 1n << 9n,
  focus: 1n << 10n,
  accessible: 1n << 11n,
  controlLabel: 1n << 12n,
  anatomy: 1n << 13n,
  collection: 1n << 14n,
  overlay: 1n << 15n,
  boundary: 1n << 16n,
  hitParticipation: 1n << 17n,
  positioning: 1n << 18n,
  scroll: 1n << 19n,
  textControl: 1n << 20n,
  imageView: 1n << 21n,
  tableStructure: 1n << 22n,
  nativeLink: 1n << 23n,
  axisInput: 1n << 24n,
  presence: 1n << 25n,
  shader: 1n << 26n,
  authoredHooks: 1n << 27n,
} as const;

export type CapabilityName = keyof typeof CAPABILITY_BITS;

export function encodeCapabilityMask(caps: Iterable<CapabilityName>): bigint {
  let mask = 0n;
  for (const cap of caps) {
    mask |= CAPABILITY_BITS[cap];
  }
  return mask;
}

export function decodeCapabilityMask(mask: bigint): CapabilityName[] {
  const result: CapabilityName[] = [];
  for (const [name, bit] of Object.entries(CAPABILITY_BITS) as [CapabilityName, bigint][]) {
    if ((mask & bit) !== 0n) result.push(name);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core SSA Types (1-to-1 lowered to LLVM IR scalar/pointer types)
// ---------------------------------------------------------------------------

export type SsaType = 'void' | 'i1' | 'i32' | 'f64' | 'ptr';

export interface SsaParam {
  readonly id: string;
  readonly type: Exclude<SsaType, 'void'>;
}

export type SsaBinOp = 'add' | 'sub' | 'mul' | 'div' | 'rem' | 'and' | 'or' | 'xor';
export type SsaCmpOp = 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';

export type HostOpKind = 'emit_event' | 'request_update' | 'set_present' | 'apply_style_rule';

export type SsaInst =
  | {
      readonly op: 'const';
      readonly result: string;
      readonly type: Exclude<SsaType, 'void'>;
      readonly value: boolean | number | null;
    }
  | {
      readonly op: 'load_prop';
      readonly result: string;
      readonly type: Exclude<SsaType, 'void'>;
      readonly propsPtr: string;
      readonly slot: number;
      readonly propName: string;
    }
  | {
      readonly op: 'load_state';
      readonly result: string;
      readonly type: Exclude<SsaType, 'void'>;
      readonly statesPtr: string;
      readonly slot: number;
      readonly stateName: string;
    }
  | {
      readonly op: 'store_state';
      readonly statesPtr: string;
      readonly slot: number;
      readonly value: string;
      readonly valueType: Exclude<SsaType, 'void'>;
    }
  | {
      readonly op: 'binop';
      readonly result: string;
      readonly operator: SsaBinOp;
      readonly type: 'i1' | 'i32' | 'f64';
      readonly lhs: string;
      readonly rhs: string;
    }
  | {
      readonly op: 'cmp';
      readonly result: string;
      readonly operator: SsaCmpOp;
      readonly operandType: 'i1' | 'i32' | 'f64';
      readonly lhs: string;
      readonly rhs: string;
    }
  | {
      readonly op: 'not';
      readonly result: string;
      readonly operand: string;
    }
  | {
      readonly op: 'fneg';
      readonly result: string;
      readonly operand: string;
    }
  | {
      readonly op: 'select';
      readonly result: string;
      readonly type: Exclude<SsaType, 'void'>;
      readonly cond: string;
      readonly thenVal: string;
      readonly elseVal: string;
    }
  | {
      readonly op: 'phi';
      readonly result: string;
      readonly type: Exclude<SsaType, 'void'>;
      readonly incoming: readonly { readonly label: string; readonly value: string }[];
    }
  | {
      readonly op: 'call';
      readonly result?: string;
      readonly callee: string;
      readonly returnType: SsaType;
      readonly args: readonly { readonly id: string; readonly type: Exclude<SsaType, 'void'> }[];
    }
  | {
      readonly op: 'host_op';
      readonly kind: HostOpKind;
      readonly args: readonly { readonly id: string; readonly type: Exclude<SsaType, 'void'> }[];
    };

export type SsaTerminator =
  | { readonly op: 'br'; readonly target: string }
  | {
      readonly op: 'condbr';
      readonly cond: string;
      readonly thenTarget: string;
      readonly elseTarget: string;
    }
  | { readonly op: 'ret'; readonly value?: string; readonly type: SsaType }
  | { readonly op: 'unreachable' };

export interface SsaBasicBlock {
  readonly label: string;
  readonly instructions: SsaInst[];
  terminator: SsaTerminator;
}

export interface SsaFunction {
  readonly name: string;
  readonly params: readonly SsaParam[];
  readonly returnType: SsaType;
  readonly blocks: SsaBasicBlock[];
  readonly exported?: boolean;
  readonly pure?: boolean;
  readonly comment?: string;
}

// ---------------------------------------------------------------------------
// Declarative Prototype Semantic IR
// ---------------------------------------------------------------------------

export type ScalarLiteral = string | number | boolean | null;

export interface PropDeclIR {
  readonly index: number;
  readonly name: string;
  readonly tsType: string;
  readonly kind: 'boolean' | 'number' | 'string' | 'enum' | 'object' | 'any';
  readonly defaultValue?: ScalarLiteral;
  readonly options?: readonly ScalarLiteral[];
  readonly empty?: 'accept' | 'fallback' | 'error';
  readonly range?: { readonly min?: number; readonly max?: number };
  readonly ssaType: Exclude<SsaType, 'void'>;
}

export interface StateDeclIR {
  readonly index: number;
  readonly name: string;
  readonly variableName?: string;
  readonly kind: 'bool' | 'string' | 'enum' | 'number.discrete' | 'number.range';
  readonly initialValue?: ScalarLiteral;
  readonly options?: readonly ScalarLiteral[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly clamp?: boolean;
  readonly ssaType: Exclude<SsaType, 'void'>;
}

export interface ExposeDeclIR {
  readonly name: string;
  readonly kind: 'state' | 'event' | 'method' | 'value';
  readonly tsType: string;
}

export interface EventDeclIR {
  readonly scope: 'root' | 'global';
  readonly eventName: string;
  readonly body?: readonly ActionStatementIR[];
  readonly simpleAction?:
    | {
        readonly kind: 'increment-state';
        readonly stateName: string;
        readonly delta: number;
      }
    | {
        readonly kind: 'toggle-state';
        readonly stateName: string;
      }
    | {
        readonly kind: 'set-state';
        readonly stateName: string;
        readonly value: ScalarLiteral;
      };
}

/** Values preserve source evaluation order. No source fragments survive into this IR. */
export type ValueExprIR =
  | { readonly kind: 'literal'; readonly value: ScalarLiteral }
  | { readonly kind: 'state'; readonly name: string }
  | { readonly kind: 'prop'; readonly name: string; readonly source?: 'current' | 'previous' }
  | { readonly kind: 'local'; readonly name: string }
  | { readonly kind: 'unary'; readonly operator: '!' | '-' | '+'; readonly operand: ValueExprIR }
  | {
      readonly kind: 'binary';
      readonly operator:
        | '+'
        | '-'
        | '*'
        | '/'
        | '%'
        | '==='
        | '!=='
        | '<'
        | '<='
        | '>'
        | '>='
        | '&&'
        | '||'
        | '??';
      readonly left: ValueExprIR;
      readonly right: ValueExprIR;
    }
  | {
      readonly kind: 'conditional';
      readonly condition: ValueExprIR;
      readonly then: ValueExprIR;
      readonly otherwise: ValueExprIR;
    };

export type ActionStatementIR =
  | { readonly kind: 'request-update' }
  /** A lowered ordinary function call. Return exits only this invocation. */
  | { readonly kind: 'invoke'; readonly body: readonly ActionStatementIR[] }
  | { readonly kind: 'state-set'; readonly stateName: string; readonly value: ValueExprIR }
  | { readonly kind: 'local'; readonly name: string; readonly value: ValueExprIR }
  | {
      readonly kind: 'if';
      readonly condition: ValueExprIR;
      readonly then: readonly ActionStatementIR[];
      readonly otherwise: readonly ActionStatementIR[];
    }
  | { readonly kind: 'return' };

export interface LoweringGapIR {
  readonly operation: string;
  readonly message: string;
  readonly span?: SourceSpan;
}

export interface LifecycleDeclIR {
  readonly phase: 'created' | 'mounted' | 'updated' | 'unmounted' | 'before-dispose';
  readonly body: readonly ActionStatementIR[];
}

export interface PropWatchDeclIR {
  /** null selects every declared resolved property. Raw subscriptions are a separate capability. */
  readonly keys: readonly string[] | null;
  readonly body: readonly ActionStatementIR[];
}

export interface HookCallIR {
  readonly name: string;
  readonly moduleSpecifier?: string;
  readonly kind: 'builtin' | 'authored';
  /** The invocation has been fully expanded into this prototype's semantic declarations. */
  readonly lowered?: boolean;
}

export interface ContextUsageIR {
  readonly keyName: string;
  readonly mode: 'provide' | 'subscribe' | 'read' | 'update';
}

export type RuleExpr =
  | { readonly kind: 'true' }
  | { readonly kind: 'false' }
  | { readonly kind: 'not'; readonly expr: RuleExpr }
  | { readonly kind: 'all'; readonly exprs: readonly RuleExpr[] }
  | { readonly kind: 'any'; readonly exprs: readonly RuleExpr[] }
  | {
      readonly kind: 'cmp';
      readonly operator: 'eq' | 'gte';
      readonly source: 'prop' | 'state' | 'meta';
      readonly key: string;
      readonly value: ScalarLiteral;
    };

export interface RuleIR {
  readonly id: number;
  readonly condition: RuleExpr;
  readonly styleTokens: readonly string[];
  readonly dynamic?: boolean;
}

export type LifecycleHookName =
  | 'onCreated'
  | 'onMounted'
  | 'onUpdated'
  | 'onUnmounted'
  | 'onBeforeDispose';

export type TemplateChildIR =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'slot' }
  | { readonly kind: 'prop-read'; readonly propName: string }
  | { readonly kind: 'state-read'; readonly stateName: string }
  | { readonly kind: 'element'; readonly node: TemplateElementIR };

export interface TemplateElementIR {
  readonly tag: string;
  readonly styleTokens?: readonly string[];
  readonly children: readonly TemplateChildIR[];
}

export type RenderIR =
  | { readonly kind: 'default-slot' }
  | { readonly kind: 'fragment'; readonly children: readonly TemplateChildIR[] }
  | { readonly kind: 'static-tree'; readonly root: TemplateElementIR }
  | { readonly kind: 'reactive-tree'; readonly root: TemplateElementIR }
  | { readonly kind: 'dynamic' };

/** Structural reactivity classification. Target admission is checked separately. */
export type CompilationTier = 'static' | 'reactive';

export interface PrototypeIR {
  readonly name: string;
  readonly exportName: string;
  readonly isDefaultExport: boolean;
  readonly sourceFile: string;
  readonly span?: SourceSpan;
  readonly tier: CompilationTier;
  readonly propsTypeText?: string;
  readonly exposesTypeText?: string;
  readonly props: readonly PropDeclIR[];
  readonly states: readonly StateDeclIR[];
  readonly exposes: readonly ExposeDeclIR[];
  readonly events: readonly EventDeclIR[];
  readonly hooks: readonly HookCallIR[];
  readonly contexts: readonly ContextUsageIR[];
  readonly staticStyleTokens: readonly string[];
  readonly rules: readonly RuleIR[];
  readonly lifecycle: readonly LifecycleHookName[];
  readonly lifecycleHandlers?: readonly LifecycleDeclIR[];
  readonly propWatches?: readonly PropWatchDeclIR[];
  readonly render: RenderIR;
  readonly capabilities: readonly CapabilityName[];
  readonly capabilityMask: bigint;
  readonly functions: readonly SsaFunction[];
  readonly stringTable: readonly string[];
  readonly unlowered?: readonly LoweringGapIR[];
}

export interface AuthoredHookSummary {
  readonly name: string;
  readonly exportName: string;
  readonly kind: 'as-hook' | 'hook';
  readonly sourceFile: string;
  readonly capabilities: readonly CapabilityName[];
}

export interface ModuleIR {
  readonly irVersion: typeof PROTO_IR_VERSION;
  readonly sourceFile: string;
  readonly prototypes: readonly PrototypeIR[];
  readonly authoredHooks: readonly AuthoredHookSummary[];
  readonly functions: readonly SsaFunction[];
}
