import {
  getModuleDeclaration,
  type Prototype,
  type ScrollProjectionPreference,
} from '@proto.ui/core';
import type {
  CommitSignal,
  RuntimeCheckpoint,
  RuntimeController,
  RuntimeLifecycleEvent,
} from '@proto.ui/runtime';
import {
  createEventGate,
  createScopedExposesReader,
  createViewEpochOwner,
  createWebProtoEventRouter,
  installViewVisibilityRule,
  PUI_VIEW_DETACHED_ATTR,
  PUI_VIEW_PENDING_ATTR,
  type ProtoAdapterExposes,
  type ProtoAdapterProps,
  scheduleAfterWebLayout,
} from '@proto.ui/adapter-base';
import type { ExposeStateWebMode } from '@proto.ui/module-expose-state-web';
import {
  resolveWebTextControlLocalName,
  TEXT_CONTROL_DECLARATION,
} from '@proto.ui/module-text-control';
import {
  createZIndexOverlayLayerScheduler,
  type OverlayLayerScheduler,
  type OverlayPort,
  type OverlayZIndexLayerSchedulerOptions,
} from '@proto.ui/module-overlay';
import type { RawPropsSource } from '@proto.ui/module-props';
import { PropsBaseType } from '@proto.ui/types';

import { createDefaultMetaGetter } from './platform/meta';
import type {
  ProtoVue2Component,
  Vue2AdapterInstance,
  Vue2ComponentOptions,
  Vue2CreateElement,
  Vue2Runtime,
} from './types';
import {
  bindLogicalParent,
  bindLogicalEventTarget,
  createLogicalInstance,
  resolveLogicalTriggerEventRouteForTarget,
  markProtoInstance,
  unbindProtoInstance,
  unbindLogicalEventTarget,
} from './platform/instance-tree';
import { createVue2EffectsPort } from './runtime/effects-port';
import { createVue2Modules, createVue2OwnerModules } from './runtime/modules';
import { createVue2HostSession } from './runtime/session';
import { renderTemplateToVue2 } from './template';

export { __VUE2_PROTO_INSTANCE } from './platform/instance-tree';

export type Vue2AdapterProps<Props extends PropsBaseType> = Props &
  PropsBaseType & {
    class?: string | string[] | Record<string, boolean>;
    hostClass?: string | string[] | Record<string, boolean>;
    surfaceClass?: string | string[] | Record<string, boolean>;
    hostStyle?: Record<string, string> | string | Array<Record<string, string>>;
    surfaceStyle?: Record<string, string> | string | Array<Record<string, string>>;
    [key: `on${string}`]: unknown;
  };

export interface Vue2AdapterOptions<Props extends PropsBaseType> {
  schedule?: (task: () => void) => void;
  getProps?: (props: Vue2AdapterProps<Props>) => Partial<Props> | null | undefined;
  getMeta?: (key: string) => unknown;
  diagnostics?: {
    onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
    /** @deprecated Use onLifecycleEvent. */
    onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
  };
  exposeStateWebMode?: ExposeStateWebMode;
  scrollProjection?: ScrollProjectionPreference;
  autoUpdateOnPropsChange?: boolean;
  rootTag?: string;
  overlayLayer?:
    | (OverlayZIndexLayerSchedulerOptions & {
        scheduler?: OverlayLayerScheduler;
      })
    | undefined;
}

type Vue2InternalState<Props extends PropsBaseType> = {
  proto: Prototype<Props>;
  initOptions: {
    schedule: (task: () => void) => void;
    getMeta: (key: string) => unknown;
    onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
    onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
    exposeStateWebMode?: ExposeStateWebMode;
    scrollProjection?: ScrollProjectionPreference;
    overlayLayerScheduler?: OverlayLayerScheduler;
  };
  instanceToken: ReturnType<typeof createLogicalInstance>;
  owner: ReturnType<typeof createViewEpochOwner<Props>>;
  rawPropsSource: RawPropsSource<Props> | null;
  controller: RuntimeController | null;
  eventGate: ReturnType<typeof createEventGate> | null;
  exposes: Record<string, unknown>;
  invoke: ((fn: () => void) => void) | null;
  scopedExposesReader: ReturnType<typeof createScopedExposesReader>;
  pendingCommit: boolean;
  pendingSignal: CommitSignal | null;
  viewReady: boolean;
  viewDisposed: boolean;
  terminalDisposed: boolean;
  activationVersion: number;
  hostActive: boolean;
  lastHostProps: Readonly<Record<string, unknown>> | null;
  subs: Set<() => void>;
  hostSession: ReturnType<typeof createVue2HostSession<Props>> | null;
  boundRoot: HTMLElement | null;
  lastInitRoot: HTMLElement | null;
  focusTargetReadyListeners: Set<() => void>;
  focusTargetRetryScheduled: boolean;
  focusTargetRetryCount: number;
  propWatchDisposer: (() => void) | null;
};

function defaultGetProps<Props extends PropsBaseType>(
  props: Vue2AdapterProps<Props>
): Partial<Props> {
  const {
    class: className,
    hostClass,
    surfaceClass,
    hostStyle,
    surfaceStyle,
    ...rest
  } = (props ?? {}) as any;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (isFrameworkEventProp(key, value)) continue;
    filtered[key] = value;
  }
  return filtered as Partial<Props>;
}

function shallowEqualHostProps(
  prev: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>
) {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  return prevKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(next, key) && Object.is(prev[key], next[key])
  );
}

const MAX_FOCUS_TARGET_RETRIES = 3;

export function createVue2Adapter(runtime: Vue2Runtime) {
  const sharedOverlayLayerScheduler = createZIndexOverlayLayerScheduler();
  const logicalOwnerKey = Symbol('@proto.ui/adapter-vue2/logical-owner');

  return function AdaptToVue2<TProto extends Prototype<any, any>>(
    proto: TProto,
    opt: Vue2AdapterOptions<ProtoAdapterProps<TProto>> = {}
  ): ProtoVue2Component<TProto> {
    type Props = ProtoAdapterProps<TProto>;
    const schedule = opt.schedule ?? ((task) => queueMicrotask(task));
    const getProps = opt.getProps ?? defaultGetProps;
    const getMeta = opt.getMeta ?? createDefaultMetaGetter();
    const exposeStateWebMode = opt.exposeStateWebMode;
    const scrollProjection = opt.scrollProjection;
    const autoUpdate = opt.autoUpdateOnPropsChange ?? true;
    const textControl = getModuleDeclaration(proto, TEXT_CONTROL_DECLARATION)?.config;
    const textControlRootTag = textControl
      ? resolveWebTextControlLocalName(textControl)
      : undefined;
    if (textControlRootTag && opt.rootTag && opt.rootTag !== textControlRootTag) {
      throw new Error(
        `[Vue2 Adapter] text-control declaration conflicts with rootTag: ${opt.rootTag}`
      );
    }
    const rootTag = textControlRootTag ?? opt.rootTag ?? 'div';

    const hasCustomOverlayLayerConfig =
      !!opt.overlayLayer &&
      (typeof opt.overlayLayer.baseZIndex !== 'undefined' ||
        typeof opt.overlayLayer.step !== 'undefined' ||
        typeof opt.overlayLayer.roleOffsets !== 'undefined');
    const overlayLayerScheduler =
      opt.overlayLayer?.scheduler ??
      (hasCustomOverlayLayerConfig
        ? createZIndexOverlayLayerScheduler({
            baseZIndex: opt.overlayLayer?.baseZIndex,
            step: opt.overlayLayer?.step,
            roleOffsets: opt.overlayLayer?.roleOffsets,
          })
        : sharedOverlayLayerScheduler);

    const createState = (): Vue2InternalState<Props> => {
      const state = {
        proto,
        initOptions: {
          schedule,
          getMeta,
          onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
          onLifecycleEvent: opt.diagnostics?.onLifecycleEvent,
          exposeStateWebMode,
          scrollProjection,
          overlayLayerScheduler,
        },
        instanceToken: createLogicalInstance(proto as Prototype<any>),
        owner: createViewEpochOwner<Props>({ prototypeName: proto.name }),
        rawPropsSource: null,
        controller: null,
        eventGate: null,
        exposes: {},
        invoke: null,
        scopedExposesReader: null as unknown as ReturnType<typeof createScopedExposesReader>,
        pendingCommit: false,
        pendingSignal: null,
        viewReady: false,
        viewDisposed: false,
        terminalDisposed: false,
        activationVersion: 0,
        hostActive: true,
        lastHostProps: null,
        subs: new Set(),
        hostSession: null,
        boundRoot: null,
        lastInitRoot: null,
        focusTargetReadyListeners: new Set(),
        focusTargetRetryScheduled: false,
        focusTargetRetryCount: 0,
        propWatchDisposer: null,
      } as Vue2InternalState<Props>;
      state.scopedExposesReader = createScopedExposesReader(() => state.invoke);
      return state;
    };

    const options: Vue2ComponentOptions<TProto> = {
      name: toVue2ComponentName(proto.name),
      inheritAttrs: false,
      inject: {
        __puiLogicalParent: {
          from: logicalOwnerKey,
          default: null,
        },
      },
      props: {
        hostClass: { type: [String, Array, Object], default: undefined },
        surfaceClass: { type: [String, Array, Object], default: undefined },
        hostStyle: { type: [String, Array, Object], default: undefined },
        surfaceStyle: { type: [String, Array, Object], default: undefined },
      },
      beforeCreate() {
        (this as any).__pui = createState();
      },
      data() {
        const state = getState<Props>(this);
        bindLogicalParent(
          state.instanceToken,
          ((this as any).__puiLogicalParent ?? null) as ReturnType<
            typeof createLogicalInstance
          > | null
        );
        return {
          __puiShouldExist: false,
          __puiRenderChildren: null,
          __puiHostTokens: [] as string[],
          __puiCommitVersion: 0,
          __puiViewReady: false,
        };
      },
      provide() {
        return {
          [logicalOwnerKey]: getState<Props>(this).instanceToken,
        };
      },
      created() {
        const vm = this;
        const state = getState<Props>(vm);
        const rawPropsSource: RawPropsSource<Props> = {
          debugName: `${proto.name}#raw-props`,
          get() {
            const nextProps = getProps(collectAdapterInput<Props>(vm));
            return (nextProps ?? {}) as Readonly<Props & PropsBaseType>;
          },
          subscribe(cb) {
            state.subs.add(cb);
            return () => state.subs.delete(cb);
          },
        };
        state.rawPropsSource = rawPropsSource;
        state.lastHostProps = rawPropsSource.get();

        const createHostSession = (
          wiring: Parameters<typeof createVue2HostSession<Props>>[0]['wiring'],
          initialMount: 'eager' | 'manual'
        ) =>
          createVue2HostSession({
            proto,
            schedule,
            rawPropsSource,
            wiring,
            eventGate: {
              disable: () => state.eventGate?.disable(),
              dispose: () => state.owner.disposeView(),
            },
            router: {
              dispose: () => state.owner.disposeView(),
            },
            onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
            onLifecycleEvent: opt.diagnostics?.onLifecycleEvent,
            onCommit: (children, signal) => {
              state.pendingCommit = true;
              state.pendingSignal = signal;
              setVmField(vm, '__puiRenderChildren', children);
              setVmField(vm, '__puiCommitVersion', ((vm as any).__puiCommitVersion ?? 0) + 1);
              forceUpdate(vm);
              afterVueCommit(runtime, vm, () => finishPendingCommit(vm));
            },
            onAfterUnmount: () => {
              state.scopedExposesReader.invalidate();
              state.invoke = null;
              state.hostSession = null;
              state.controller = null;
              state.exposes = {};
              setVmField(vm, '__puiHostTokens', []);
            },
            initialMount,
          });

        const ownerModules = createVue2OwnerModules({
          instanceToken: state.instanceToken,
          emit: (key, payload, options) => {
            emitVue2(vm, key, payload, options);
          },
          rawPropsSource,
          getMeta,
          setExposes: (record) => {
            state.exposes = record;
          },
          runInCallbackScope: (fn) => {
            const invoke = state.invoke;
            if (invoke) invoke(fn);
            else fn();
          },
          overlayLayerScheduler,
        });

        state.hostSession = state.owner.initialize({
          modules: ownerModules,
          createSession: (wiring) => createHostSession(wiring, 'manual'),
          onViewIntent: (snapshot) => {
            setShouldExist(runtime, vm, snapshot.present);
          },
        }) as ReturnType<typeof createVue2HostSession<Props>>;
        state.controller = state.hostSession.controller as RuntimeController;
        state.invoke = state.hostSession.invokeInCallbackScope;
        setShouldExist(runtime, vm, state.hostSession.viewIntent.getSnapshot().present);

        if (typeof vm.$watch === 'function') {
          state.propWatchDisposer = vm.$watch(
            () => collectAdapterInput<Props>(vm),
            () => notifyPropsChange(vm, autoUpdate),
            { deep: true }
          );
        }
      },
      mounted() {
        const rootEl = getRootElement(this);
        if (rootEl) installViewVisibilityRule(rootEl.ownerDocument);
        if ((this as any).__puiShouldExist) {
          initSession(runtime, this, proto, {
            schedule,
            getMeta,
            exposeStateWebMode,
            scrollProjection,
            overlayLayerScheduler,
          });
        }
        afterVueCommit(runtime, this, () => notifyFocusTargetReady(this));
      },
      updated() {
        notifyPropsChange(this, autoUpdate);
        const target = getRootElement(this);
        const state = getState<Props>(this);
        if (target && target !== state.lastInitRoot && (this as any).__puiShouldExist) {
          afterVueCommit(runtime, this, () => {
            if (getRootElement(this) === target && (this as any).__puiShouldExist) {
              initSession(runtime, this, proto, {
                schedule,
                getMeta,
                exposeStateWebMode,
                scrollProjection,
                overlayLayerScheduler,
              });
            }
          });
        }
        if (!state.viewReady || !target?.isConnected) return;
        notifyFocusTargetReady(this);
        afterVueCommit(runtime, this, () => {
          if (getRootElement(this) === target) notifyFocusTargetReady(this);
        });
      },
      activated() {
        const state = getState<Props>(this);
        state.hostActive = true;
        const activationVersion = ++state.activationVersion;
        afterVueCommit(runtime, this, () => {
          if (state.terminalDisposed || activationVersion !== state.activationVersion) return;
          initSession(runtime, this, proto, {
            schedule,
            getMeta,
            exposeStateWebMode,
            scrollProjection,
            overlayLayerScheduler,
          });
        });
      },
      deactivated() {
        const state = getState<Props>(this);
        state.hostActive = false;
        state.activationVersion += 1;
        setViewReady(this, false);
        getRootElement(this)?.setAttribute(PUI_VIEW_PENDING_ATTR, '');
        if (state.owner.hasView) void state.owner.detachView();
        state.lastInitRoot = null;
      },
      beforeDestroy() {
        const state = getState<Props>(this);
        state.terminalDisposed = true;
        state.activationVersion += 1;
        state.propWatchDisposer?.();
        state.propWatchDisposer = null;
        state.scopedExposesReader.invalidate();
        state.invoke = null;
        void state.owner.dispose();
        state.lastInitRoot = null;
      },
      methods: {
        update() {
          getState<Props>(this).controller?.update();
        },
        getExposes() {
          const state = getState<Props>(this);
          return state.scopedExposesReader.read(state.exposes ?? {}) as ProtoAdapterExposes<TProto>;
        },
        invokeInCallbackScope(fn: () => void) {
          getState<Props>(this).invoke?.(fn);
        },
      },
      render(h: Vue2CreateElement) {
        const state = getState<Props>(this);
        const present = !!(this as any).__puiShouldExist;
        const overlayPort = state.owner.session?.caps.getPort<OverlayPort>('overlay');
        // Keep closed overlay hosts and authored children mounted so collection
        // items can register before the first open. The shared detached rule
        // removes the subtree from paint, accessibility, and tab order.
        const detached = !present && overlayPort?.hasPresenceBinding() === true;
        if (!present && !detached) return (h as any)();

        const slotNodes = normalizeSlotNodes((this.$slots ?? {}).default);
        const renderRuntime = { h };
        const rendered = present
          ? renderTemplateToVue2(renderRuntime, (this as any).__puiRenderChildren, {
              slot: slotNodes,
            })
          : slotNodes;
        const rootChildren = normalizeVue2Children(rendered);
        const attrs = this.$attrs ?? {};

        return h(
          rootTag,
          {
            ref: '__puiRoot',
            class: mergeHostClass([
              (this as any).surfaceClass,
              (this as any).hostClass,
              getVNodeStaticClass(this),
              getVNodeClass(this),
              attrs.class,
            ]),
            style: mergeHostStyle([
              (this as any).surfaceStyle,
              (this as any).hostStyle,
              getVNodeStaticStyle(this),
              getVNodeStyle(this),
              attrs.style,
            ]),
            attrs: {
              'data-pui-root': '',
              [PUI_VIEW_DETACHED_ATTR]: detached ? '' : undefined,
              [PUI_VIEW_PENDING_ATTR]: state.viewReady ? undefined : '',
              'data-pui-style': serializeStyleTokens((this as any).__puiHostTokens ?? []),
              'data-demo-ref': attrs['data-demo-ref'] as string | undefined,
            },
          },
          rootChildren as any
        );
      },
    };

    return (runtime.extend ? runtime.extend(options) : options) as ProtoVue2Component<TProto>;
  };
}

function getState<Props extends PropsBaseType>(
  vm: Vue2AdapterInstance<Prototype<Props>> | any
): Vue2InternalState<Props> {
  const state = vm.__pui as Vue2InternalState<Props> | undefined;
  if (!state) throw new Error('[Vue2 Adapter] internal state is not initialized.');
  return state;
}

function toVue2ComponentName(name: string) {
  const safeName = name.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+/, '');
  return `Proto-${safeName || 'prototype'}`;
}

function collectAdapterInput<Props extends PropsBaseType>(
  vm: Vue2AdapterInstance<Prototype<Props>> | any
): Vue2AdapterProps<Props> {
  return {
    ...(vm.$attrs ?? {}),
    class: mergeHostClass([getVNodeStaticClass(vm), getVNodeClass(vm), vm.$attrs?.class]),
    hostClass: vm.hostClass,
    surfaceClass: vm.surfaceClass,
    hostStyle: vm.hostStyle,
    surfaceStyle: vm.surfaceStyle,
  } as Vue2AdapterProps<Props>;
}

function setShouldExist(runtime: Vue2Runtime, vm: any, present: boolean) {
  const state = getState(vm);
  if (state.terminalDisposed) return;
  const prev = !!vm.__puiShouldExist;
  setVmField(vm, '__puiShouldExist', present);
  if (present) {
    if (!prev) setViewReady(vm, false);
    afterVueCommit(runtime, vm, () => {
      if (vm.__puiShouldExist) {
        initSession(runtime, vm, null, null);
      }
    });
    return;
  }
  state.eventGate?.disable?.();
  if (state.owner.hasView) void state.owner.detachView();
  state.lastInitRoot = null;
  setVmField(vm, '__puiHostTokens', []);
  setViewReady(vm, false);
}

function initSession<Props extends PropsBaseType>(
  runtime: Vue2Runtime,
  vm: Vue2AdapterInstance<Prototype<Props>> | any,
  proto: Prototype<Props> | null,
  options: {
    schedule: (task: () => void) => void;
    getMeta: (key: string) => unknown;
    onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
    onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
    exposeStateWebMode?: ExposeStateWebMode;
    scrollProjection?: ScrollProjectionPreference;
    overlayLayerScheduler?: OverlayLayerScheduler;
  } | null
) {
  const state = getState<Props>(vm);
  if (state.terminalDisposed || !state.hostActive) return;
  const rootEl = getRootElement(vm);
  if (!rootEl || rootEl === state.lastInitRoot) return;
  if (!state.rawPropsSource) return;
  const targetProto = proto ?? getLogicalProtoFromState<Props>(state);
  const targetOptions = options ?? getInitOptionsFromState<Props>(state);
  if (!targetProto || !targetOptions) return;

  state.lastInitRoot = rootEl;
  markProtoInstance(rootEl, targetProto as Prototype<any>, state.instanceToken);
  state.boundRoot = rootEl;

  const eventGate = createEventGate();
  state.eventGate = eventGate;

  const router = createWebProtoEventRouter({
    rootEl,
    instanceToken: state.instanceToken,
    resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
    globalEl: typeof window === 'undefined' ? rootEl : window,
    isEnabled: () => eventGate.isEnabled?.() ?? true,
  });
  bindLogicalEventTarget(state.instanceToken, router.rootTarget);
  state.viewDisposed = false;
  const disposeView = () => {
    if (state.viewDisposed) return;
    state.viewDisposed = true;
    eventGate.disable();
    eventGate.dispose();
    unbindLogicalEventTarget(state.instanceToken, router.rootTarget);
    router.dispose();
    unbindProtoInstance(state.instanceToken, state.boundRoot ?? undefined);
    if (state.boundRoot === rootEl) state.boundRoot = null;
    if (state.eventGate === eventGate) state.eventGate = null;
  };

  const effectsPort = createVue2EffectsPort((tokens) => {
    setVmField(vm, '__puiHostTokens', tokens);
    forceUpdate(vm);
  });

  const modules = createVue2Modules({
    el: rootEl,
    instanceToken: state.instanceToken,
    router,
    emit: (key, payload, eventOptions) => {
      emitVue2(vm, key, payload, eventOptions);
    },
    rawPropsSource: state.rawPropsSource,
    effectsPort,
    getMeta: targetOptions.getMeta,
    exposeStateWebMode: targetOptions.exposeStateWebMode,
    scrollProjection: targetOptions.scrollProjection,
    setExposes: (record) => {
      state.exposes = record;
    },
    runInCallbackScope: (fn) => {
      const invoke = state.invoke;
      if (invoke) {
        invoke(fn);
        return;
      }
      fn();
    },
    isViewReady: () =>
      state.viewReady && !getRootElement(vm)?.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
    getCurrentElement: () => getRootElement(vm),
    subscribeTargetReady: (listener) => {
      state.focusTargetReadyListeners.add(listener);
      return () => state.focusTargetReadyListeners.delete(listener);
    },
    retryTargetReady: () => {
      if (
        state.focusTargetRetryScheduled ||
        state.focusTargetRetryCount >= MAX_FOCUS_TARGET_RETRIES
      ) {
        return;
      }
      state.focusTargetRetryScheduled = true;
      state.focusTargetRetryCount += 1;
      scheduleAfterWebLayout(
        getRootElement(vm),
        () => {
          state.focusTargetRetryScheduled = false;
          notifyFocusTargetReady(vm);
        },
        targetOptions.schedule
      );
    },
    overlayLayerScheduler: targetOptions.overlayLayerScheduler,
  });

  state.hostSession = state.owner.attachView({
    modules,
    disposeView,
    createSession: (wiring) =>
      createVue2HostSession({
        proto: targetProto,
        schedule: targetOptions.schedule,
        rawPropsSource: state.rawPropsSource!,
        wiring,
        eventGate: {
          disable: () => state.eventGate?.disable(),
          dispose: () => state.owner.disposeView(),
        },
        router: {
          dispose: () => state.owner.disposeView(),
        },
        onCommit: (children, signal) => {
          state.pendingCommit = true;
          state.pendingSignal = signal;
          setVmField(vm, '__puiRenderChildren', children);
          setVmField(vm, '__puiCommitVersion', (vm.__puiCommitVersion ?? 0) + 1);
          forceUpdate(vm);
          afterVueCommit(runtime, vm, () => finishPendingCommit(vm));
        },
        onLifecycleCheckpoint: targetOptions.onLifecycleCheckpoint,
        onLifecycleEvent: targetOptions.onLifecycleEvent,
        onAfterUnmount: () => {
          state.scopedExposesReader.invalidate();
          state.invoke = null;
          state.hostSession = null;
          state.controller = null;
          state.exposes = {};
          setVmField(vm, '__puiHostTokens', []);
        },
        initialMount: 'eager',
      }),
  });
  state.controller = state.hostSession.controller as RuntimeController;
  state.invoke = state.hostSession.invokeInCallbackScope;

  const { kernel } = state.hostSession;
  if (kernel && kernel.run) {
    (kernel.run as any).host = { get: () => getRootElement(vm) };
  }
}

function getLogicalProtoFromState<Props extends PropsBaseType>(
  state: Vue2InternalState<Props>
): Prototype<Props> | null {
  return state.proto;
}

function getInitOptionsFromState<Props extends PropsBaseType>(
  state: Vue2InternalState<Props>
): {
  schedule: (task: () => void) => void;
  getMeta: (key: string) => unknown;
  onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
  onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
  exposeStateWebMode?: ExposeStateWebMode;
  scrollProjection?: ScrollProjectionPreference;
  overlayLayerScheduler?: OverlayLayerScheduler;
} | null {
  return state.initOptions;
}

function notifyPropsChange(vm: any, autoUpdate: boolean) {
  const state = getState(vm);
  if (!state.rawPropsSource) return;
  const nextHostProps = state.rawPropsSource.get();
  if (state.lastHostProps && shallowEqualHostProps(state.lastHostProps, nextHostProps)) return;
  state.lastHostProps = nextHostProps;
  for (const cb of state.subs) cb();
  if (autoUpdate) state.controller?.update();
}

function finishPendingCommit(vm: any) {
  const state = getState(vm);
  if (!state.pendingCommit) return;
  state.pendingCommit = false;
  state.viewReady = true;
  state.focusTargetRetryCount = 0;
  state.eventGate?.enable();
  notifyFocusTargetReady(vm);
  state.pendingSignal?.done?.();
  state.pendingSignal = null;
}

function notifyFocusTargetReady(vm: any) {
  const state = getState(vm);
  const target = getRootElement(vm);
  if (!state.viewReady || !target?.isConnected) return;
  for (const listener of Array.from(state.focusTargetReadyListeners)) listener();
  if (target.ownerDocument.activeElement === target) state.focusTargetRetryCount = 0;
}

function setViewReady(vm: any, value: boolean) {
  const state = getState(vm);
  state.viewReady = value;
  state.focusTargetRetryCount = 0;
  setVmField(vm, '__puiViewReady', value);
  forceUpdate(vm);
}

function setVmField(vm: any, key: string, value: unknown) {
  vm[key] = value;
}

function forceUpdate(vm: any) {
  if (typeof vm.$forceUpdate === 'function') vm.$forceUpdate();
}

function afterVueCommit(runtime: Vue2Runtime, vm: any, cb: () => void) {
  const nextTick = typeof vm.$nextTick === 'function' ? vm.$nextTick.bind(vm) : runtime.nextTick;
  nextTick(cb);
}

function getRootElement(vm: any): HTMLElement | null {
  const ref = vm.$refs?.__puiRoot;
  const el = Array.isArray(ref) ? ref[0] : ref;
  if (isHTMLElement(el)) return el;
  if (isHTMLElement(vm.$el) && vm.$el.getAttribute('data-pui-root') !== null) {
    return vm.$el;
  }
  return null;
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function normalizeSlotNodes(slot: unknown) {
  if (Array.isArray(slot)) return slot;
  return slot ?? null;
}

function normalizeVue2Children(children: unknown) {
  if (children == null) return [];
  return Array.isArray(children) ? children : [children];
}

function emitVue2(vm: any, key: string, payload?: unknown, options?: Record<string, unknown>) {
  const propListener = vm.$attrs?.[`on${key.slice(0, 1).toUpperCase()}${key.slice(1)}`];
  if (typeof propListener === 'function') propListener(payload, options);
  if (typeof vm.$emit === 'function') vm.$emit(key, payload, options);
}

function getVNodeData(vm: any) {
  return vm.$vnode?.data ?? {};
}

function getVNodeStaticClass(vm: any) {
  return getVNodeData(vm).staticClass;
}

function getVNodeClass(vm: any) {
  return getVNodeData(vm).class;
}

function getVNodeStaticStyle(vm: any) {
  return getVNodeData(vm).staticStyle;
}

function getVNodeStyle(vm: any) {
  return getVNodeData(vm).style;
}

function mergeHostClass(input: unknown) {
  const values = (Array.isArray(input) ? input : [input])
    .map((value: any) => value ?? '')
    .filter((value: any) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return String(value).trim().length > 0;
    });

  const out: any[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') {
      out.push(value);
      continue;
    }

    const tokens = value
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const unique = tokens.filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });

    if (unique.length > 0) out.push(unique.join(' '));
  }

  return out;
}

function mergeHostStyle(input: unknown) {
  const values = (Array.isArray(input) ? input : [input])
    .flatMap((value) => {
      if (value == null || value === '') return [];
      return Array.isArray(value) ? value : [value];
    })
    .filter((value) => {
      if (value == null || value === '') return false;
      if (typeof value === 'object') return Object.keys(value as object).length > 0;
      return String(value).trim().length > 0;
    });

  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];
  return values;
}

function serializeStyleTokens(tokens: string[]) {
  return tokens.length > 0 ? tokens.join(' ') : undefined;
}

function isFrameworkEventProp(key: string, value: unknown) {
  return /^on[A-Z]/.test(key) && typeof value === 'function';
}
