import type { EffectsPort } from '@proto.ui/core';
import { createDeferredViewVisualSink, type VisualFeedbackSink } from '@proto.ui/module-feedback';
import { withoutInstanceAssociations } from '@proto.ui/adapter-base/internal/instance-associations';
import type { InstanceAssociations } from '@proto.ui/core';
import { IMAGE_VIEW_DECLARATION, resolveWebImageLocalName } from '@proto.ui/module-image-view';
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
  createDefaultWebColorSchemeSource,
  createDefaultWebPreferenceSource,
  createDefaultWebStyleSupportSource,
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
import type {
  ColorSchemeInvalidationSource,
  PreferenceInvalidationSource,
  StyleSupportInvalidationSource,
} from '@proto.ui/module-rule-meta';
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
  isLogicalEventRouteCandidate,
  markProtoInstance,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  subscribeFocusTargetOwnerReady,
  unbindProtoInstance,
  unbindLogicalEventTarget,
} from './platform/instance-tree';
import { createVue2EffectsPort } from './runtime/effects-port';
import {
  createVue2Modules,
  createVue2OwnerModules,
  type FocusIntentState,
} from './runtime/modules';
import { createVue2HostSession } from './runtime/session';
import { renderTemplateToVue2 } from './template';

export { __VUE2_PROTO_INSTANCE } from './platform/instance-tree';

export type Vue2AdapterProps<Props extends PropsBaseType> = Props &
  PropsBaseType & {
    instanceAssociations?: InstanceAssociations;
    class?: string | string[] | Record<string, boolean>;
    hostClass?: string | string[] | Record<string, boolean>;
    surfaceClass?: string | string[] | Record<string, boolean>;
    hostStyle?: Record<string, string> | string | Array<Record<string, string>>;
    surfaceStyle?: Record<string, string> | string | Array<Record<string, string>>;
    [key: `on${string}`]: unknown;
  };

export interface Vue2AdapterOptions<Props extends PropsBaseType> {
  /** Draft V2 host provider; one fresh sink per physical view. No provider means ordinary style. */
  createVisualSink?: (host: HTMLElement, effects: EffectsPort) => VisualFeedbackSink | null;
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
    createVisualSink?: Vue2AdapterOptions<Props>['createVisualSink'];
    colorSchemeSource?: ColorSchemeInvalidationSource;
    preferenceSource?: PreferenceInvalidationSource;
    styleSupportSource?: StyleSupportInvalidationSource;
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
  focusIntentState: FocusIntentState;
  focusIngressReady: boolean;
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
    instanceAssociations,
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
    const createVisualSink = opt.createVisualSink;
    const schedule = opt.schedule ?? ((task) => queueMicrotask(task));
    const getProps = opt.getProps ?? defaultGetProps;
    const getMeta = opt.getMeta ?? createDefaultMetaGetter();
    const colorSchemeSource = opt.getMeta ? undefined : createDefaultWebColorSchemeSource(getMeta);
    const preferenceSource = opt.getMeta ? undefined : createDefaultWebPreferenceSource(getMeta);
    const styleSupportSource = opt.getMeta
      ? undefined
      : createDefaultWebStyleSupportSource(getMeta);
    const exposeStateWebMode = opt.exposeStateWebMode;
    const scrollProjection = opt.scrollProjection;
    const autoUpdate = opt.autoUpdateOnPropsChange ?? true;
    const textControl = getModuleDeclaration(proto, TEXT_CONTROL_DECLARATION)?.config;
    const textControlRootTag = textControl
      ? resolveWebTextControlLocalName(textControl)
      : undefined;
    const imageView = getModuleDeclaration(proto, IMAGE_VIEW_DECLARATION)?.config;
    const imageViewRootTag = imageView ? resolveWebImageLocalName() : undefined;
    if (textControlRootTag && imageViewRootTag) {
      throw new Error(
        '[Vue2 Adapter] text-control and image-view declarations cannot share a root.'
      );
    }
    const declaredRootTag = textControlRootTag ?? imageViewRootTag;
    if (declaredRootTag && opt.rootTag && opt.rootTag !== declaredRootTag) {
      throw new Error(
        `[Vue2 Adapter] rootTag conflicts with the static ${textControlRootTag ? 'text-control' : 'image-view'} declaration.`
      );
    }
    const rootTag = declaredRootTag ?? opt.rootTag ?? 'div';

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
          createVisualSink: createVisualSink,
          schedule,
          getMeta,
          colorSchemeSource,
          preferenceSource,
          styleSupportSource,
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
        focusIntentState: {},
        focusIngressReady: false,
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
        instanceAssociations: { type: Object, default: undefined },
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
            return withoutInstanceAssociations(nextProps) as Readonly<Props & PropsBaseType>;
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
            getInstanceAssociations: () => vm.instanceAssociations ?? {},
            wiring,
            eventGate: {
              disable: () => state.eventGate?.disable(),
              dispose: () => state.owner.disposeView(),
            },
            router: {
              dispose: () => state.owner.disposeView(),
            },
            onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
            onLifecycleEvent: (event) => {
              opt.diagnostics?.onLifecycleEvent?.(event);
              trackFocusIngress(vm, event);
            },
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
          colorSchemeSource,
          preferenceSource,
          styleSupportSource,
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
            createVisualSink: createVisualSink,
            schedule,
            getMeta,
            colorSchemeSource,
            preferenceSource,
            styleSupportSource,
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
                createVisualSink: createVisualSink,
                schedule,
                getMeta,
                colorSchemeSource,
                preferenceSource,
                styleSupportSource,
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
            createVisualSink: createVisualSink,
            schedule,
            getMeta,
            colorSchemeSource,
            preferenceSource,
            styleSupportSource,
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
        try {
          if (state.owner.hasView) return state.owner.detachView();
        } finally {
          // A failed old release must not strand the cached KeepAlive root.
          // A synchronously attached replacement owns its own init marker.
          if (!state.owner.hasView) state.lastInitRoot = null;
        }
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
        const hostDirection = attrs.dir ?? (this as any).dir;

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
              // An absent VNode attr must not claim consumer-owned native direction.
              ...(hostDirection === undefined ? {} : { dir: hostDirection }),
              'data-pui-root': '',
              [PUI_VIEW_DETACHED_ATTR]: detached ? '' : undefined,
              [PUI_VIEW_PENDING_ATTR]: state.viewReady ? undefined : '',
              ...(createVisualSink
                ? {}
                : { 'data-pui-style': serializeStyleTokens((this as any).__puiHostTokens ?? []) }),
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
    instanceAssociations: vm.instanceAssociations,
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
  try {
    if (state.owner.hasView) void state.owner.detachView();
  } finally {
    // A callback can restore presence while the old view is being released.
    if (!vm.__puiShouldExist && !state.owner.hasView) {
      state.lastInitRoot = null;
      setVmField(vm, '__puiHostTokens', []);
      setViewReady(vm, false);
    }
  }
}

function initSession<Props extends PropsBaseType>(
  runtime: Vue2Runtime,
  vm: Vue2AdapterInstance<Prototype<Props>> | any,
  proto: Prototype<Props> | null,
  options: {
    schedule: (task: () => void) => void;
    getMeta: (key: string) => unknown;
    createVisualSink?: Vue2AdapterOptions<Props>['createVisualSink'];
    colorSchemeSource?: ColorSchemeInvalidationSource;
    preferenceSource?: PreferenceInvalidationSource;
    styleSupportSource?: StyleSupportInvalidationSource;
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
  try {
    markProtoInstance(rootEl, targetProto as Prototype<any>, state.instanceToken);
  } catch (error) {
    // Marker publication can replay focus before this view has a disposer.
    // Roll back this root only; a reentrant replacement owns its own binding.
    try {
      unbindProtoInstance(state.instanceToken, rootEl);
    } catch {
      /* original error wins */
    }
    if (state.lastInitRoot === rootEl) state.lastInitRoot = null;
    throw error;
  }
  state.boundRoot = rootEl;

  const eventGate = createEventGate();
  state.eventGate = eventGate;

  const router = createWebProtoEventRouter({
    rootEl,
    instanceToken: state.instanceToken,
    resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
    isSemanticEventRouteCandidate: isLogicalEventRouteCandidate,
    globalEl: typeof window === 'undefined' ? rootEl : window,
    isEnabled: () => eventGate.isEnabled?.() ?? true,
  });
  bindLogicalEventTarget(state.instanceToken, router.rootTarget);
  state.viewDisposed = false;
  let viewDisposed = false;
  let ownedVisualStyle: string | null = null;
  let focusRetryGeneration = 0;
  let releaseRequestedTargetReady: (() => void) | undefined;
  const releaseNativeReadiness = registerNativeFocusReadiness(
    state.instanceToken,
    {
      isReady: () =>
        !viewDisposed &&
        state.viewReady &&
        state.focusIngressReady &&
        !state.terminalDisposed &&
        state.hostActive &&
        vm.__puiShouldExist &&
        eventGate.isEnabled() &&
        getRootElement(vm) === rootEl &&
        rootEl.isConnected &&
        !rootEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
      subscribe: (listener) => {
        state.focusTargetReadyListeners.add(listener);
        return () => state.focusTargetReadyListeners.delete(listener);
      },
    },
    { deferPublication: true }
  );
  const disposeView = () => {
    if (viewDisposed) return;
    viewDisposed = true;
    state.viewDisposed = true;
    const releases = [
      () => {
        if (ownedVisualStyle !== null && rootEl.getAttribute('data-pui-style') === ownedVisualStyle)
          rootEl.removeAttribute('data-pui-style');
      },
      () => eventGate.disable(),
      () => eventGate.dispose(),
      () => {
        const release = releaseRequestedTargetReady;
        releaseRequestedTargetReady = undefined;
        release?.();
      },
      () => unbindLogicalEventTarget(state.instanceToken, router.rootTarget),
      () => router.dispose(),
      () => unbindProtoInstance(state.instanceToken, rootEl),
      () => {
        if (state.boundRoot === rootEl) state.boundRoot = null;
        if (state.eventGate === eventGate) {
          state.eventGate = null;
          state.focusTargetRetryScheduled = false;
        }
      },
      // Publish invalidation after releasing old bindings. A pending request
      // can synchronously call user-controlled focus and throw here.
      releaseNativeReadiness,
    ];
    let failed = false;
    let firstError: unknown;
    for (const release of releases) {
      try {
        release();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  };

  const effectsPort = createVue2EffectsPort((tokens) => {
    if (viewDisposed || getRootElement(vm) !== rootEl) return;
    setVmField(vm, '__puiHostTokens', tokens);
    forceUpdate(vm);
    if (viewDisposed || getRootElement(vm) !== rootEl) return;
    // The VNode omits this owned attribute, including its undefined key: Vue 2
    // otherwise removes it again on a later unrelated framework update.
    if (targetOptions.createVisualSink) {
      ownedVisualStyle = serializeStyleTokens(tokens) ?? null;
      if (ownedVisualStyle === null) rootEl.removeAttribute('data-pui-style');
      else if (rootEl.getAttribute('data-pui-style') !== ownedVisualStyle)
        rootEl.setAttribute('data-pui-style', ownedVisualStyle);
    }
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
    visualFeedbackSink: targetOptions.createVisualSink
      ? createDeferredViewVisualSink(
          () => targetOptions.createVisualSink!(rootEl, effectsPort),
          (frame) => {
            effectsPort.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
            effectsPort.requestFlush();
          }
        )
      : undefined,
    getMeta: targetOptions.getMeta,
    colorSchemeSource: targetOptions.colorSchemeSource,
    preferenceSource: targetOptions.preferenceSource,
    styleSupportSource: targetOptions.styleSupportSource,
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
      state.viewReady &&
      !viewDisposed &&
      !getRootElement(vm)?.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
    isEntryAcquisitionReady: (target) => {
      releaseRequestedTargetReady?.();
      releaseRequestedTargetReady = undefined;
      if (isFocusTargetOwnerReady(target)) return true;
      releaseRequestedTargetReady = subscribeFocusTargetOwnerReady(target, () => {
        if (viewDisposed) return;
        releaseRequestedTargetReady?.();
        releaseRequestedTargetReady = undefined;
        notifyFocusTargetReady(vm);
      });
      return false;
    },
    getCurrentElement: () => getRootElement(vm),
    subscribeTargetReady: (listener) => {
      state.focusTargetReadyListeners.add(listener);
      return () => state.focusTargetReadyListeners.delete(listener);
    },
    focusIntentState: state.focusIntentState,
    onFocusIntent: () => {
      state.focusTargetRetryCount = 0;
      focusRetryGeneration += 1;
      state.focusTargetRetryScheduled = false;
    },
    onFocusPendingReleased: () => {
      focusRetryGeneration += 1;
      state.focusTargetRetryScheduled = false;
      const release = releaseRequestedTargetReady;
      releaseRequestedTargetReady = undefined;
      release?.();
    },
    onFocusAcquired: () => {
      state.focusTargetRetryCount = 0;
      // Completion retires queued work for this intent in the current view.
      focusRetryGeneration += 1;
      state.focusTargetRetryScheduled = false;
      releaseRequestedTargetReady?.();
      releaseRequestedTargetReady = undefined;
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
      const generation = focusRetryGeneration;
      scheduleAfterWebLayout(
        getRootElement(vm),
        () => {
          if (viewDisposed || generation !== focusRetryGeneration) return;
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
        getInstanceAssociations: () => vm.instanceAssociations ?? {},
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
        onLifecycleEvent: (event) => {
          targetOptions.onLifecycleEvent?.(event);
          trackFocusIngress(vm, event);
        },
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
  releaseNativeReadiness.publish();
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
  createVisualSink?: Vue2AdapterOptions<Props>['createVisualSink'];
  colorSchemeSource?: ColorSchemeInvalidationSource;
  preferenceSource?: PreferenceInvalidationSource;
  styleSupportSource?: StyleSupportInvalidationSource;
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
  state.controller?.applyInstanceAssociations(vm.instanceAssociations ?? {});
  const nextHostProps = state.rawPropsSource.get();
  if (state.lastHostProps && shallowEqualHostProps(state.lastHostProps, nextHostProps)) return;
  state.lastHostProps = nextHostProps;
  for (const cb of state.subs) cb();
  if (autoUpdate) state.controller?.update();
}

function trackFocusIngress(vm: any, event: RuntimeLifecycleEvent) {
  if (event.type !== 'mount.phase') return;
  const state = getState(vm);
  state.focusIngressReady = event.phase === 'mounted';
  if (state.focusIngressReady) notifyFocusTargetReady(vm);
}

function finishPendingCommit(vm: any) {
  const state = getState(vm);
  if (!state.pendingCommit) return;
  state.pendingCommit = false;
  const signal = state.pendingSignal;
  state.pendingSignal = null;
  state.viewReady = true;
  state.eventGate?.enable();
  signal?.done?.();
  // Remount event listeners and Runtime callback scope are live only after
  // acknowledgement. onUpdated retains Vue2's existing enabled-gate timing.
  notifyFocusTargetReady(vm);
}

function notifyFocusTargetReady(vm: any) {
  const state = getState(vm);
  const target = getRootElement(vm);
  if (!state.viewReady || !target?.isConnected) return;
  let failed = false;
  let firstError: unknown;
  for (const listener of Array.from(state.focusTargetReadyListeners)) {
    try {
      listener();
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }
  if (failed) throw firstError;
}

function setViewReady(vm: any, value: boolean) {
  const state = getState(vm);
  state.viewReady = value;
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
