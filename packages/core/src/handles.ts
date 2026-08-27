// packages/core/src/handles.ts
import {
  EventListenerToken,
  ExtensionEventType,
  HostEventListenerOptions,
  ProtoEventPayload,
  SemanticEventType,
  ExposeEventSpec,
  JsonObject,
  ContextKey,
  PropsBaseType,
  PropsSpecMap,
  StateEvent,
} from '@proto.ui/types';
import {
  UnUse,
  StyleHandle,
  TemplateType,
  TemplateProps,
  TemplateChildren,
  TemplateNode,
  SvgFactories,
} from './spec';
import type { AnatomyClaimDecl, AnatomyFamily, AnatomyOrderView, AnatomyPartView } from './anatomy';
import { State, StateDefAPI, type BorrowedStateHandle, type OwnedStateHandle } from './state';
import type { Unsubscribe } from './state';
import type { A11yDefAPI } from './a11y';

// 统一错误上下文，方便在 runtime 做 phase guard 时给出可诊断信息

export interface GuardInfo {
  prototypeName: string;
  phase: Phase;
}

export type ExposeEvent<Payload = any> = {
  kind: 'event';
  payload?: Payload;
};

export type ExposeMethod<F extends Function = (...args: any[]) => any> = {
  kind: 'method';
  fn: F;
};

export type ExposeValue<V = any> = {
  kind: 'value';
  value: V;
};

export type ExposeState<V = any> = State<V> | { kind: 'state'; state: State<V> };

export type ExposeMap = Record<
  string,
  ExposeEvent<any> | ExposeMethod<any> | ExposeValue<any> | ExposeState<any>
>;

export type RuleHandle = {
  readonly id: number;
  dispose(): void;
};

export type RuleDep<Props extends PropsBaseType> =
  | { kind: 'prop'; key: keyof Props }
  | { kind: 'state'; id: unknown }
  | { kind: 'context'; key: unknown }
  | { kind: 'meta'; key: string };

export type WhenLiteral = string | number | boolean | null;
export type WhenComparable<T> =
  Extract<T, WhenLiteral> extends never ? WhenLiteral : Extract<T, WhenLiteral>;

export type WhenValue<Props extends PropsBaseType> =
  | { type: 'prop'; key: keyof Props }
  | { type: 'state'; id: unknown }
  | { type: 'context'; key: unknown }
  | { type: 'meta'; key: string };

export type WhenExpr<Props extends PropsBaseType> =
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'eq'; left: WhenValue<Props>; right: WhenLiteral }
  | { type: 'not'; expr: WhenExpr<Props> }
  | { type: 'all'; exprs: WhenExpr<Props>[] }
  | { type: 'any'; exprs: WhenExpr<Props>[] };

export interface WhenSignal<Props extends PropsBaseType, T> {
  eq(lit: WhenComparable<T>): WhenExpr<Props>;
}

export interface WhenBuilder<Props extends PropsBaseType> {
  prop<K extends keyof Props & string>(key: K): WhenSignal<Props, Props[K]>;
  state<T>(state: State<T>): WhenSignal<Props, T>;
  ctx<T extends JsonObject>(key: ContextKey<T>): WhenSignal<Props, unknown>;
  meta(key: string): WhenSignal<Props, unknown>;

  all(...exprs: WhenExpr<Props>[]): WhenExpr<Props>;
  any(...exprs: WhenExpr<Props>[]): WhenExpr<Props>;
  not(expr: WhenExpr<Props>): WhenExpr<Props>;

  t(): WhenExpr<Props>;
  f(): WhenExpr<Props>;
}

export type RuleOp<Props extends PropsBaseType = PropsBaseType> =
  | { kind: 'feedback.style.use'; handles: StyleHandle[] }
  | {
      kind: 'state.set';
      handle: OwnedStateHandle<any> | BorrowedStateHandle<any, Props>;
      value: any;
      reason?: any;
    };

export type RuleIntent<Props extends PropsBaseType = PropsBaseType> = {
  kind: 'ops';
  ops: RuleOp<Props>[];
};

export interface StateIntentBuilder<T> {
  be(value: T): void;
}

export interface IntentBuilder<Props extends PropsBaseType = PropsBaseType> {
  feedback: {
    style: {
      use(...handles: StyleHandle[]): void;
    };
  };
  state: <T>(handle: OwnedStateHandle<T> | BorrowedStateHandle<T, Props>) => StateIntentBuilder<T>;
}

export type RuleSpec<Props extends PropsBaseType> = {
  label?: string;
  note?: string;
  when: (w: WhenBuilder<Props>) => WhenExpr<Props>;
  intent: (i: IntentBuilder<Props>) => void;
};

/**
 * Handles are how we strictly separate phases:
 * - def: setup-only (declare intent, register callbacks). After setup, any def usage must throw.
 * - renderer: render-time (build template). It provides el/r + a readonly view `read`.
 * - run: callback-time (runtime callbacks, lifecycle/effects/handlers).
 *
 * core only defines types; runtime enforces phase rules via guards.
 */

export type Phase = 'setup' | 'render' | 'callback' | 'unknown';

export interface RunHandle<Props extends PropsBaseType> {
  update(): void;

  lifecycle: {
    /**
     * Updates desired host-view presence for this alive Proto instance.
     * Actual mount/unmount is reconciled by the lifecycle owner.
     */
    setPresent(present: boolean): void;
  };

  /** Optional getter for the host DOM element (provided by adapters). */
  host?: {
    get(): unknown;
  };

  /** Optional module-backed host/environment metadata. */
  meta?: {
    get(key: string): unknown;
  };

  props: {
    get(): PropsSnapshot<Props>;
    getRaw(): Readonly<Props & PropsBaseType>;
    isProvided(key: keyof Props): boolean;
  };

  context: {
    read<T extends JsonObject>(key: ContextKey<T>): T;
    tryRead<T extends JsonObject>(key: ContextKey<T>): T | null;
    update<T extends JsonObject>(key: ContextKey<T>, next: T | ((prev: T) => T)): void;
    tryUpdate<T extends JsonObject>(key: ContextKey<T>, next: T | ((prev: T) => T)): boolean;
  };

  expose: {
    emit(key: string, payload?: any, options?: Record<string, unknown>): void;
  };

  feedback: {
    style: {
      patch: (...handles: StyleHandle[]) => void;
      suppress: (...handles: StyleHandle[]) => void;
      clearPatch: () => void;
    };
  };

  anatomy: {
    /** runtime-only readonly anatomy query surface; unavailable during setup */
    has(family: AnatomyFamily, role: string): boolean;
    parts(family: AnatomyFamily): ReadonlyArray<AnatomyPartView>;
    partsOf(family: AnatomyFamily, role: string): ReadonlyArray<AnatomyPartView>;
    order: AnatomyOrderView;
  };
}

export interface DefHandle<Props extends PropsBaseType, Exposes = Record<string, unknown>> {
  lifecycle: {
    onCreated(cb: (run: RunHandle<Props>) => void): void;
    onMounted(cb: (run: RunHandle<Props>) => void): void;
    onUpdated(cb: (run: RunHandle<Props>) => void): void;
    onUnmounted(cb: (run: RunHandle<Props>) => void): void;
    onBeforeDispose(cb: (run: RunHandle<Props>) => void): void;
  };

  props: {
    /** Declarations may be contributed incrementally by nested asHooks. */
    define(decl: Partial<PropsSpecMap<Props>>): void;
    setDefaults(partialDefaults: PropsDefaults<Props>): void;
    watch(keys: (keyof Props & string)[], cb: PropsWatchCallback<Props>): Unsubscribe;
    watchAll(cb: PropsWatchCallback<Props>): Unsubscribe;

    watchRaw(
      keys: (keyof Props & string)[],
      cb: RawWatchCallback<Props & PropsBaseType>
    ): Unsubscribe;
    watchRawAll(cb: RawWatchCallback<Props & PropsBaseType>): Unsubscribe;
  };

  feedback: {
    style: {
      use: (...handles: StyleHandle[]) => UnUse;
    };
  };

  expose: (<K extends keyof Exposes>(key: K, value: Exposes[K]) => void) & {
    event: <K extends keyof Exposes & string>(key: K, spec?: ExposeEventSpec) => void;
    state: <K extends keyof Exposes & string>(
      key: K,
      handle: Exposes[K] extends ExposeState<infer V> ? State<V> : State<any>
    ) => void;
    value: <K extends keyof Exposes & string, V>(
      key: K,
      value: Exposes[K] extends ExposeValue<infer X> ? X : V
    ) => void;
    method: <K extends keyof Exposes & string, F extends Function>(
      key: K,
      fn: Exposes[K] extends ExposeMethod<infer X> ? X : F
    ) => void;
  };

  rule: (spec: RuleSpec<Props>) => RuleHandle;

  event: {
    on(type: SemanticEventType, cb: ProtoEventCallback<Props>): EventListenerToken;
    on(
      type: ExtensionEventType,
      cb: ProtoEventCallback<Props, unknown>,
      options?: HostEventListenerOptions
    ): EventListenerToken;
    off(token: EventListenerToken): void;
    onGlobal(type: SemanticEventType, cb: ProtoEventCallback<Props>): EventListenerToken;
    onGlobal(
      type: ExtensionEventType,
      cb: ProtoEventCallback<Props, unknown>,
      options?: HostEventListenerOptions
    ): EventListenerToken;
  };

  state: StateDefAPI;

  context: {
    provide<T extends JsonObject>(key: ContextKey<T>, defaultValue: T): void;
    subscribe<T extends JsonObject>(
      key: ContextKey<T>,
      onChange?: ContextOnChange<Props, T>
    ): Unsubscribe;
    trySubscribe<T extends JsonObject>(
      key: ContextKey<T>,
      onChange?: ContextOnChangeOptional<Props, T>
    ): Unsubscribe;
  };

  anatomy: {
    claim(family: AnatomyFamily, decl: AnatomyClaimDecl): void;
    subscribeParts(
      family: AnatomyFamily,
      role: string,
      onChange: (run: RunHandle<Props>, parts: readonly AnatomyPartView[]) => void
    ): Unsubscribe;
  };

  a11y: A11yDefAPI;
}

export type ContextOnChange<P extends PropsBaseType, T extends JsonObject> = (
  run: RunHandle<P>,
  next: T,
  prev: T
) => void;

export type ContextOnChangeOptional<P extends PropsBaseType, T extends JsonObject> = (
  run: RunHandle<P>,
  next: T | null,
  prev: T | null
) => void;

// render-time 句柄：构造模板 + 只读读取视图（read）
// 注意：这里不叫 run，避免和 callback-time 的 run 混淆
export interface RenderReadHandle<Props extends PropsBaseType> {
  props: RunHandle<Props>['props'];
  context: Pick<RunHandle<Props>['context'], 'read' | 'tryRead'>;
  anatomy: RunHandle<Props>['anatomy'];
}

export interface ElementFactory {
  (type: TemplateType): TemplateNode;
  (type: TemplateType, children: TemplateChildren): TemplateNode;
  (type: TemplateType, props: TemplateProps, children?: TemplateChildren): TemplateNode;
}

export interface RendererHandle<Props extends PropsBaseType> {
  el: ElementFactory;
  slot(): TemplateNode;
  r: ReservedFactories;
  svg: SvgFactories;
  read: RenderReadHandle<Props>; // render 阶段可用的 readonly 快照视图
}

export interface ReservedFactories {
  slot(): TemplateNode;
}

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Resolved props snapshot type:
 * - Declared keys are present on the resolved snapshot.
 * - Undefined is not a resolved value. Empty/fallback resolution may still produce null
 *   only when the declared value domain allows it.
 * - `any` stays wide so generic prototype registries can remain intentionally erased.
 */
export type PropsSnapshot<P extends PropsBaseType> =
  IsAny<P> extends true
    ? Readonly<P>
    : Readonly<{
        [K in keyof P]-?: Exclude<P[K], undefined>;
      }>;

/** Defaults should be aligned to Props shape. */
export type PropsDefaults<P extends PropsBaseType> = Partial<P>;

export type WatchInfo<P extends PropsBaseType> = {
  changedKeysAll: Array<keyof P & string>;
  changedKeysMatched: Array<keyof P & string>;
};

export type PropsWatchCallback<P extends PropsBaseType> = (
  run: RunHandle<P>,
  next: PropsSnapshot<P>,
  prev: PropsSnapshot<P>,
  info: WatchInfo<P>
) => void;

export type RawWatchCallback<P extends PropsBaseType> = (
  run: RunHandle<P>,
  nextRaw: Readonly<P & PropsBaseType>,
  prevRaw: Readonly<P & PropsBaseType>,
  info: WatchInfo<P & PropsBaseType>
) => void;

export type ProtoEventCallback<P extends PropsBaseType, E = ProtoEventPayload> = (
  run: RunHandle<P>,
  ev: E
) => void;

export type StateWatchCallback<V, P extends PropsBaseType> = (
  run: RunHandle<P>,
  e: StateEvent<V>
) => void;

export type StateSubscribeCallback<V> = (e: StateEvent<V>) => void;
