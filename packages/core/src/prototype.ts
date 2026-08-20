// packages/core/src/prototype.ts
import type { PropsBaseType } from '@proto.ui/types';
import type { DefHandle, RendererHandle } from './handles';
import type { TemplateChildren } from './spec';
import type { BorrowedStateHandle, State } from './state';
import { getActiveAsHookContext } from './internal';

const MODULE_DECLARATION_TOKEN_BRAND = Symbol('@proto.ui/module-declaration-token');

export type ModuleDeclarationToken<Config> = Readonly<{
  id: string;
  readonly __type?: Config;
  readonly [MODULE_DECLARATION_TOKEN_BRAND]: true;
}>;

export type PrototypeModuleDeclaration<Config = unknown> = Readonly<{
  id: string;
  token: ModuleDeclarationToken<Config>;
  config: Readonly<Config>;
}>;

export function moduleDeclaration<Config>(id: string): ModuleDeclarationToken<Config> {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`[Prototype] module declaration token id must be a non-empty string.`);
  }
  return Object.freeze({
    id,
    [MODULE_DECLARATION_TOKEN_BRAND]: true as const,
  }) as ModuleDeclarationToken<Config>;
}

export function declareModule<Config>(
  token: ModuleDeclarationToken<Config>,
  config: Config
): PrototypeModuleDeclaration<Config> {
  if (token?.[MODULE_DECLARATION_TOKEN_BRAND] !== true) {
    throw new Error(`[Prototype] declareModule() expects a ModuleDeclarationToken.`);
  }
  const frozenConfig =
    config !== null && typeof config === 'object' ? Object.freeze(config) : config;
  return Object.freeze({ id: token.id, token, config: frozenConfig as Readonly<Config> });
}

export interface Prototype<
  Props extends PropsBaseType = PropsBaseType,
  Exposes = Record<string, unknown>,
> {
  name: string;
  modules?: readonly PrototypeModuleDeclaration[];

  setup: (def: DefHandle<Props, Exposes>) => RenderFn | void;
}

export type ExposeOf<T> =
  T extends Prototype<any, infer E> ? E : T extends AsHookCaller<any, infer E> ? E : never;

export type RenderFn = <Props extends PropsBaseType>(
  renderer: RendererHandle<Props>
) => TemplateChildren;

export type AsHookTraceEntry = {
  name: string;
  order: number;
  privileged: boolean;
  mode?: AsHookMode;
};

export type AsHookMode = 'configurable' | 'once' | 'multiple';

export type AsHookStateMap = Record<string, State<any>>;
export type AsHookEventMap = Record<string, unknown>;
export type AsHookDisposer = () => void;

export type AsHookContract = {
  state?: AsHookStateMap;
  event?: AsHookEventMap;
  asHooks?: Record<string, unknown>;
};

type NormalizeAsHookContract<C> = C extends AsHookContract
  ? {
      state: C['state'] extends AsHookStateMap ? C['state'] : {};
      event: C['event'] extends AsHookEventMap ? C['event'] : {};
      asHooks: C['asHooks'] extends Record<string, unknown> ? C['asHooks'] : {};
    }
  : C extends AsHookStateMap
    ? { state: C; event: {}; asHooks: {} }
    : { state: {}; event: {}; asHooks: {} };

type AsHookStatesOf<C> = NormalizeAsHookContract<C>['state'];
type AsHookEventsOf<C> = NormalizeAsHookContract<C>['event'];
type AsHookHandlesOf<C> = NormalizeAsHookContract<C>['asHooks'];

export type AsHookHandleLookup<ContractInput> = {
  <K extends keyof AsHookHandlesOf<ContractInput> & string>(
    name: K
  ): AsHookHandlesOf<ContractInput>[K] | undefined;
  <Handle = unknown>(name: string): Handle | undefined;
};

export type AsHookDisposers = Readonly<{
  all: readonly AsHookDisposer[];
  props?: readonly AsHookDisposer[];
  context?: readonly AsHookDisposer[];
  event?: readonly AsHookDisposer[];
  feedback?: readonly AsHookDisposer[];
  rule?: readonly AsHookDisposer[];
}>;

export type AsHookBorrowedStates<
  Props extends PropsBaseType,
  States extends AsHookStateMap,
> = Readonly<{
  [K in keyof States]: States[K] extends State<infer V> ? BorrowedStateHandle<V, Props> : never;
}>;

export type AsHookEventKeys<Events extends AsHookEventMap> = Readonly<{
  [K in keyof Events & string]: K;
}>;

export type AsHookChildResult = Readonly<{
  name: string;
  order: number;
  privileged: boolean;
  mode?: AsHookMode;
  /** Captured artifacts retained as the runtime truth source. */
  result: unknown;
  /** Stable caller-facing handle projected from `result`. */
  handle: unknown;
}>;

export type AsHookArtifacts<
  Props extends PropsBaseType = PropsBaseType,
  ContractInput = {},
> = Readonly<{
  stateHandles?: AsHookBorrowedStates<Props, AsHookStatesOf<ContractInput>>;
  eventKeys?: AsHookEventKeys<AsHookEventsOf<ContractInput>>;
  methods?: Readonly<Record<string, unknown>>;
  asHooks?: readonly AsHookChildResult[];
}>;

export type AsHookResult<Props extends PropsBaseType = PropsBaseType, ContractInput = {}> = {
  props?: unknown;
  state?: unknown;
  stateHandles?: AsHookBorrowedStates<Props, AsHookStatesOf<ContractInput>>;
  getState?: <K extends keyof AsHookStatesOf<ContractInput> & string>(
    key: K
  ) => AsHookBorrowedStates<Props, AsHookStatesOf<ContractInput>>[K] | undefined;
  methods?: Readonly<Record<string, unknown>>;
  getMethod?: <K extends string>(key: K) => unknown;
  asHooks?: readonly AsHookChildResult[];
  getAsHook?: (name: string) => AsHookChildResult | undefined;
  getAsHookHandle?: AsHookHandleLookup<ContractInput>;
  artifacts?: AsHookArtifacts<Props, ContractInput>;
  disposers?: AsHookDisposers;
  context?: unknown;
  event?: unknown;
  feedback?: unknown;
  render?: RenderFn;
  [key: string]: unknown;
};

export type AsHookInstanceState = {
  store: Record<string, unknown>;
  result?: AsHookResult<any, any>;
  callerResult?: unknown;
};

export type AsHookConfigApi = AsHookInstanceState & {
  name: string;
  order: number;
};

export type AsHookConfigureTools = {
  warn(message: string): void;
  conflict(message: string): never;
};

export type AsHookPrototype<
  Props extends PropsBaseType = PropsBaseType,
  Exposes = Record<string, unknown>,
  ContractInput = {},
  Handle = AsHookResult<Props, ContractInput>,
> = {
  name: string;
  /** Static module requirements that a caller prototype must carry before adapter selection. */
  modules?: readonly PrototypeModuleDeclaration[];
  setup: (def: DefHandle<Props, Exposes>) => RenderFn | void;
  /**
   * Projects the captured authored-asHook result into its public caller handle.
   * The projection runs once, after setup capture and borrowed-state projection.
   */
  projectHandle?: (result: AsHookResult<Props, ContractInput>) => Handle;
};

export type AsHookRuntime = {
  ensureSetup(op: string): void;
  register(
    name: string,
    meta: { privileged: boolean; mode?: AsHookMode }
  ): {
    action: 'setup' | 'configure' | 'skip';
    order: number;
    state: AsHookInstanceState;
  };
  beginCapture(name: string, meta: { order: number; privileged: boolean; mode?: AsHookMode }): void;
  recordCaptured(kind: 'props' | 'state' | 'context' | 'event' | 'feedback', entry: unknown): void;
  recordAsHookResult(entry: AsHookChildResult): void;
  registerStateName(name: string, stateId?: unknown): void;
  endCapture(render?: RenderFn): AsHookResult<any, any>;
  abortCapture(): void;
  projectState<T>(state: T): T;
  getTrace(): ReadonlyArray<AsHookTraceEntry>;
};

export type AsHookCaller<
  Props extends PropsBaseType = PropsBaseType,
  Exposes = Record<string, unknown>,
  ContractInput = {},
  Handle = AsHookResult<Props, ContractInput>,
> = (() => Handle) & {
  readonly kind: 'asHook';
  readonly definition: AsHookPrototype<Props, Exposes, ContractInput, Handle>;
  readonly modules: readonly PrototypeModuleDeclaration[];
};

export type HookContract = AsHookContract;
export type HookStateMap = AsHookStateMap;
export type HookEventMap = AsHookEventMap;
export type HookDisposer = AsHookDisposer;
export type HookDisposers = AsHookDisposers;
export type HookBorrowedStates<
  Props extends PropsBaseType,
  States extends HookStateMap,
> = AsHookBorrowedStates<Props, States>;
export type HookEventKeys<Events extends HookEventMap> = AsHookEventKeys<Events>;
export type HookArtifacts<
  Props extends PropsBaseType = PropsBaseType,
  ContractInput = {},
> = AsHookArtifacts<Props, ContractInput>;
export type HookResult<
  Props extends PropsBaseType = PropsBaseType,
  ContractInput = {},
> = AsHookResult<Props, ContractInput>;
export type HookInstanceState = AsHookInstanceState;
export type HookConfigApi = AsHookConfigApi;
export type HookConfigureTools = AsHookConfigureTools;
export type HookPrototype<
  Props extends PropsBaseType = PropsBaseType,
  Exposes = Record<string, unknown>,
  ContractInput = {},
  Options = void,
> = {
  name: string;
  mode?: AsHookMode;
  setup: (
    def: DefHandle<Props, Exposes>,
    options: Options,
    api: AsHookConfigApi
  ) => RenderFn | void;
  configure?: (api: AsHookConfigApi, options: Options, tools: AsHookConfigureTools) => void;
};
export type HookRuntime = AsHookRuntime;
export type HookCaller<
  Props extends PropsBaseType = PropsBaseType,
  Exposes = Record<string, unknown>,
  ContractInput = {},
  Options = void,
> = ((options?: Options) => HookResult<Props, ContractInput>) & {
  readonly kind: 'hook';
  readonly definition: HookPrototype<Props, Exposes, ContractInput, Options>;
};

function normalizeAsHookRender(value: RenderFn | void): RenderFn | undefined {
  if (typeof value !== 'undefined' && typeof value !== 'function') {
    throw new Error(`[AsHook] setup() must return render function or void, got: ${typeof value}.`);
  }
  return typeof value === 'function' ? value : undefined;
}

export function getModuleDeclaration<Config>(
  proto: Pick<Prototype, 'modules'>,
  token: ModuleDeclarationToken<Config>
): PrototypeModuleDeclaration<Config> | undefined {
  return proto.modules?.find((declaration) => declaration.id === token.id) as
    | PrototypeModuleDeclaration<Config>
    | undefined;
}

/** Thin wrapper: stabilize author-facing entry & improve inference */
export function definePrototype<P extends PropsBaseType, E = Record<string, unknown>>(
  proto: Prototype<P, E>
): Prototype<P, E> {
  if (!proto || typeof proto !== 'object') {
    throw new Error(`[Prototype] definePrototype() expects an object.`);
  }
  if (!proto.name || typeof proto.name !== 'string') {
    throw new Error(`[Prototype] illegal name.`);
  }
  if (typeof proto.setup !== 'function') {
    throw new Error(`[Prototype] setup must be a function.`);
  }
  proto.modules = freezeModuleDeclarations(proto.modules, 'Prototype');
  return proto;
}

function freezeModuleDeclarations(
  declarations: readonly PrototypeModuleDeclaration[] | undefined,
  owner: 'Prototype' | 'AsHook'
): readonly PrototypeModuleDeclaration[] {
  const values = declarations ?? [];
  const ids = new Set<string>();
  for (const declaration of values) {
    if (ids.has(declaration.id)) {
      throw new Error(`[${owner}] duplicate module declaration id: ${declaration.id}`);
    }
    ids.add(declaration.id);
  }
  return Object.freeze(values.slice());
}

/**
 * AsHook is still "a prototype authored by Component Author",
 * but its *import result* will be treated as borrowed in the future.
 */
export function defineAsHook<
  P extends PropsBaseType,
  E = Record<string, unknown>,
  C = {},
  H = AsHookResult<P, C>,
>(proto: AsHookPrototype<P, E, C, H>): AsHookCaller<P, E, C, H>;
export function defineAsHook<
  P extends PropsBaseType,
  E = Record<string, unknown>,
  C = {},
  H = AsHookResult<P, C>,
>(proto: AsHookPrototype<P, E, C, H>): AsHookCaller<P, E, C, H> {
  return createHookCaller(proto, 'asHook') as AsHookCaller<P, E, C, H>;
}

function createHookCaller<P extends PropsBaseType, E = Record<string, unknown>, C = {}, O = void>(
  proto: AsHookPrototype<P, E, C, unknown> | HookPrototype<P, E, C, O>,
  kind: 'asHook' | 'hook'
) {
  if (!proto || typeof proto !== 'object') {
    throw new Error(`[${kind === 'hook' ? 'Hook' : 'AsHook'}] define expects an object.`);
  }
  if (!proto.name || typeof proto.name !== 'string') {
    throw new Error(`[${kind === 'hook' ? 'Hook' : 'AsHook'}] illegal name.`);
  }
  if (typeof proto.setup !== 'function') {
    throw new Error(`[${kind === 'hook' ? 'Hook' : 'AsHook'}] setup must be a function.`);
  }
  const staticModules =
    kind === 'asHook'
      ? freezeModuleDeclarations((proto as AsHookPrototype<P, E, C, unknown>).modules, 'AsHook')
      : Object.freeze([] as PrototypeModuleDeclaration[]);
  if (kind === 'asHook') {
    Object.defineProperty(proto, 'modules', {
      value: staticModules,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  // TODO: 寻找更可靠的验证函数名
  // if (!/^as[A-Z]/.test(proto.name)) {
  //   throw new Error(
  //     `[AsHook] name must start with "as" followed by Capital letter, got: ${proto.name}`
  //   );
  // }

  const caller = ((options?: O) => {
    const { def: activeDef, rt } = getActiveAsHookContext(proto.name);
    const def = activeDef as DefHandle<P, E>;

    rt.ensureSetup(`asHook(${proto.name})`);
    const mode = kind === 'hook' ? (proto as HookPrototype<P, E, C, O>).mode : 'once';
    const reg = rt.register(proto.name, {
      privileged: false,
      mode: mode ?? 'once',
    });
    const api: AsHookConfigApi = {
      name: proto.name,
      order: reg.order,
      store: reg.state.store,
    };
    const tools: AsHookConfigureTools = {
      warn(message: string) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn(`[AsHook:${proto.name}] ${message}`);
        }
      },
      conflict(message: string): never {
        throw new Error(`[AsHook:${proto.name}] ${message}`);
      },
    };

    if (reg.action === 'skip') {
      const result = reg.state.result ?? {};
      const handle =
        kind === 'asHook' && Object.hasOwn(reg.state, 'callerResult')
          ? reg.state.callerResult
          : result;
      rt.recordAsHookResult({
        name: proto.name,
        order: reg.order,
        privileged: false,
        mode: mode ?? 'once',
        result,
        handle,
      });
      return handle;
    }

    if (reg.action === 'setup') {
      rt.beginCapture(proto.name, {
        order: reg.order,
        privileged: false,
        mode: mode ?? 'once',
      });
      let captureOpen = true;
      try {
        const render = normalizeAsHookRender(
          kind === 'hook'
            ? (proto as HookPrototype<P, E, C, O>).setup(def, options as O, api)
            : (proto as AsHookPrototype<P, E, C>).setup(def)
        );
        const result = rt.endCapture(render);
        captureOpen = false;
        let finalResult = result;
        if (result && typeof result === 'object' && 'state' in result) {
          const nextState = rt.projectState((result as any).state);
          if ((result as any).state !== nextState) {
            finalResult = { ...(result as any), state: nextState };
          }
        }
        reg.state.result = finalResult;
        if (kind === 'asHook') {
          const projectHandle = (proto as AsHookPrototype<P, E, C, unknown>).projectHandle;
          reg.state.callerResult = projectHandle ? projectHandle(finalResult) : finalResult;
        }
        rt.recordAsHookResult({
          name: proto.name,
          order: reg.order,
          privileged: false,
          mode: mode ?? 'once',
          result: finalResult,
          handle: kind === 'asHook' ? reg.state.callerResult : finalResult,
        });
        const hookProto = proto as HookPrototype<P, E, C, O>;
        if (
          kind === 'hook' &&
          (hookProto.mode ?? 'once') === 'configurable' &&
          typeof hookProto.configure === 'function'
        ) {
          hookProto.configure(api, options as O, tools);
        }
        return kind === 'asHook' ? reg.state.callerResult : (reg.state.result ?? {});
      } catch (e) {
        if (captureOpen) {
          rt.abortCapture();
        }
        throw e;
      }
    }

    const hookProto = proto as HookPrototype<P, E, C, O>;
    if (kind === 'hook' && typeof hookProto.configure === 'function') {
      hookProto.configure(api, options as O, tools);
    }
    const result = reg.state.result ?? {};
    rt.recordAsHookResult({
      name: proto.name,
      order: reg.order,
      privileged: false,
      mode: mode ?? 'once',
      result,
      handle: result,
    });
    return result;
  }) as AsHookCaller<P, E, C> | HookCaller<P, E, C, O>;

  Object.defineProperty(caller, 'kind', {
    value: kind,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(caller, 'definition', {
    value: proto,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  if (kind === 'asHook') {
    Object.defineProperty(caller, 'modules', {
      value: staticModules,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  return caller;
}

export function defineHook<P extends PropsBaseType, E = Record<string, unknown>, C = {}, O = void>(
  proto: HookPrototype<P, E, C, O>
): HookCaller<P, E, C, O> {
  return createHookCaller(proto, 'hook') as HookCaller<P, E, C, O>;
}
