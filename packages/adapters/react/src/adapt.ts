import {
  NATIVE_LINK_DECLARATION,
  resolveWebNativeLinkLocalName,
} from '@proto.ui/module-native-link';
import type { EffectsPort } from '@proto.ui/core';
import { createDeferredViewVisualSink, type VisualFeedbackSink } from '@proto.ui/module-feedback';
import { withoutInstanceAssociations } from '@proto.ui/adapter-base/internal/instance-associations';
import type { InstanceAssociations } from '@proto.ui/core';
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
  createDeferredOwnerDisposal,
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
  PUI_VIEW_REVEALING_ATTR,
  type ProtoAdapterProps,
  scheduleAfterWebLayout,
} from '@proto.ui/adapter-base';
import type { ExposeStateWebMode } from '@proto.ui/module-expose-state-web';
import {
  resolveWebTextControlLocalName,
  TEXT_CONTROL_DECLARATION,
} from '@proto.ui/module-text-control';
import { IMAGE_VIEW_DECLARATION, resolveWebImageLocalName } from '@proto.ui/module-image-view';
import {
  createZIndexOverlayLayerScheduler,
  type OverlayPort,
  type OverlayLayerScheduler,
  type OverlayZIndexLayerSchedulerOptions,
} from '@proto.ui/module-overlay';
import type { RawPropsSource } from '@proto.ui/module-props';
import { PropsBaseType } from '@proto.ui/types';

import { createDefaultMetaGetter } from './platform/meta';
import type { ProtoReactComponent, ReactAdapterHandle } from './types';
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
import { createReactEffectsPort } from './runtime/effects-port';
import {
  createReactModules,
  createReactOwnerModules,
  type FocusIntentState,
} from './runtime/modules';
import { createReactHostSession } from './runtime/session';
import { renderTemplateToReact, type ReactRuntime as ReactRenderRuntime } from './template';

export { __REACT_PROTO_INSTANCE } from './platform/instance-tree';

export type ReactRuntime = ReactRenderRuntime & {
  useState: <T>(init: T) => [T, (next: T) => void];
  useRef: <T>(init: T) => { current: T };
  useEffect: (cb: () => void | (() => void), deps?: any[]) => void;
  useLayoutEffect: (cb: () => void | (() => void), deps?: any[]) => void;
  useImperativeHandle: (ref: any, create: () => any, deps?: any[]) => void;
  forwardRef: (render: (props: any, ref: any) => any) => any;
  createElement: (type: any, props?: any, ...children: any[]) => any;
  Fragment?: any;
  createPortal?: (children: any, container: Element) => any;
  createContext?: <T>(defaultValue: T) => { Provider: any };
  // Context is an opaque runtime handle to the adapter. Keeping the input
  // structural would incorrectly require React.useContext to accept a partial
  // Context object, which the real React type correctly rejects.
  useContext?: <T>(context: any) => T;
};

export type { ReactAdapterHandle } from './types';

export type ReactAdapterProps<Props extends PropsBaseType> = Props &
  PropsBaseType & {
    instanceAssociations?: InstanceAssociations;
    dir?: 'ltr' | 'rtl' | 'auto';
    children?: any;
    className?: string;
    hostClassName?: string;
    surfaceClassName?: string;
    style?: any;
    hostStyle?: any;
    surfaceStyle?: any;
    [key: `on${string}`]: unknown;
  };

export interface ReactAdapterOptions<Props extends PropsBaseType> {
  /** Draft V2 host provider; one fresh sink per physical view. No provider means ordinary style. */
  createVisualSink?: (host: HTMLElement, effects: EffectsPort) => VisualFeedbackSink | null;
  schedule?: (task: () => void) => void;
  getProps?: (props: ReactAdapterProps<Props>) => Partial<Props> | null | undefined;
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

type ReactRuntimeInput = ReactRuntime | { React: ReactRuntime };

function defaultGetProps<Props extends PropsBaseType>(
  props: ReactAdapterProps<Props>
): Partial<Props> {
  const {
    children,
    className,
    hostClassName,
    surfaceClassName,
    style,
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

function snapshotRawProps<Props extends PropsBaseType>(
  value: Partial<Props> | null | undefined
): Record<string, unknown> {
  return { ...(value ?? {}) };
}

function hasSameRawProps(
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>
): boolean {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  return previousKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(next, key) && Object.is(previous[key], next[key])
  );
}

const MAX_FOCUS_TARGET_RETRIES = 3;
export function createReactAdapter(runtimeInput: ReactRuntimeInput) {
  const runtime = normalizeRuntime(runtimeInput);
  const sharedOverlayLayerScheduler = createZIndexOverlayLayerScheduler();
  const logicalOwnerContext = runtime.createContext?.<ReturnType<
    typeof createLogicalInstance
  > | null>(null);

  return function AdaptToReact<TProto extends Prototype<any, any>>(
    proto: TProto,
    opt: ReactAdapterOptions<ProtoAdapterProps<TProto>> = {}
  ): ProtoReactComponent<TProto> {
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
    const nativeLink = getModuleDeclaration(proto, NATIVE_LINK_DECLARATION)?.config;
    const nativeLinkRootTag = nativeLink ? resolveWebNativeLinkLocalName() : undefined;
    if ([textControlRootTag, imageViewRootTag, nativeLinkRootTag].filter(Boolean).length > 1) {
      throw new Error(
        '[React Adapter] text-control, image-view and native-link declarations cannot share a root.'
      );
    }
    const declaredRootTag = textControlRootTag ?? imageViewRootTag ?? nativeLinkRootTag;
    if (declaredRootTag && opt.rootTag && opt.rootTag !== declaredRootTag) {
      const declarationName = textControlRootTag
        ? 'text-control'
        : imageViewRootTag
          ? 'image-view'
          : 'native-link';
      throw new Error(
        `[React Adapter] ${declarationName} declaration conflicts with rootTag: ${opt.rootTag}`
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

    const Component = runtime.forwardRef((props: ReactAdapterProps<Props>, ref: any) => {
      const rootRef = runtime.useRef<HTMLElement | null>(null);
      const portalOriginRef = runtime.useRef<HTMLElement | null>(null);
      const instanceTokenRef = runtime.useRef(createLogicalInstance(proto as Prototype<any>));
      const parentToken =
        logicalOwnerContext && runtime.useContext
          ? (runtime.useContext(logicalOwnerContext) as ReturnType<
              typeof createLogicalInstance
            > | null)
          : null;
      const supportsOwnerContext = !!logicalOwnerContext && !!runtime.useContext;
      if (logicalOwnerContext && runtime.useContext) {
        bindLogicalParent(instanceTokenRef.current, parentToken);
      }
      const [renderChildren, setRenderChildren] = runtime.useState<any>(null);
      const hostTokenRevisionRef = runtime.useRef(0);
      const [hostStyle, setHostStyle] = runtime.useState<{ tokens: string[]; revision: number }>({
        tokens: [],
        revision: 0,
      });
      const setHostTokens = (tokens: string[]) => {
        const revision = ++hostTokenRevisionRef.current;
        setHostStyle({ tokens, revision });
      };
      const [shouldExist, setShouldExist] = runtime.useState(!supportsOwnerContext);
      const projectionReadyRef = runtime.useRef(false);
      const viewReadyRef = runtime.useRef(false);
      const focusTargetReadyListenersRef = runtime.useRef<Set<() => void>>(new Set());
      const focusTargetRetryScheduledRef = runtime.useRef(false);
      const focusTargetRetryCountRef = runtime.useRef(0);
      const focusIntentStateRef = runtime.useRef<FocusIntentState>({});
      const notifyFocusTargetReady = () => {
        const target = rootRef.current;
        if (!viewReadyRef.current || !eventGateRef.current?.isEnabled() || !target?.isConnected) {
          return;
        }
        let failed = false;
        let firstError: unknown;
        for (const listener of Array.from(focusTargetReadyListenersRef.current)) {
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
      };

      const controllerRef = runtime.useRef<RuntimeController | null>(null);
      const eventGateRef = runtime.useRef<ReturnType<typeof createEventGate> | null>(null);
      const exposesRef = runtime.useRef<Record<string, unknown>>({});
      const invokeInCallbackScopeRef = runtime.useRef<((fn: () => void) => void) | null>(null);
      const scopedExposesReaderRef = runtime.useRef(
        createScopedExposesReader(() => invokeInCallbackScopeRef.current)
      );

      const propsRef = runtime.useRef<ReactAdapterProps<Props>>(props);
      propsRef.current = props;
      const eventCallbacksRef = runtime.useRef<Record<string, (payload?: unknown) => void>>({});
      eventCallbacksRef.current = collectEventCallbacks(props);

      const subsRef = runtime.useRef<Set<() => void>>(new Set());
      const rawPropsSourceRef = runtime.useRef<RawPropsSource<Props> | null>(null);
      const deliveredRawPropsRef = runtime.useRef<Record<string, unknown> | null>(null);

      const pendingCommitRef = runtime.useRef(false);
      const pendingSignalRef = runtime.useRef<CommitSignal | null>(null);
      const commitVersionRef = runtime.useRef(0);
      const [commitVersion, setCommitVersion] = runtime.useState(0);
      const pendingRevealStyleRevisionRef = runtime.useRef<number | null>(null);
      const revealGenerationRef = runtime.useRef(0);
      const hostSessionRef = runtime.useRef<ReturnType<
        typeof createReactHostSession<Props>
      > | null>(null);
      const ownerRef = runtime.useRef<ReturnType<typeof createViewEpochOwner<Props>> | null>(null);
      if (!ownerRef.current) {
        ownerRef.current = createViewEpochOwner<Props>({ prototypeName: proto.name });
      }
      const ownerDisposalRef = runtime.useRef<ReturnType<
        typeof createDeferredOwnerDisposal
      > | null>(null);
      if (!ownerDisposalRef.current) {
        ownerDisposalRef.current = createDeferredOwnerDisposal(() => ownerRef.current?.dispose());
      }
      const boundRootRef = runtime.useRef<HTMLElement | null>(null);

      if (!rawPropsSourceRef.current) {
        rawPropsSourceRef.current = {
          debugName: `${proto.name}#raw-props`,
          get() {
            const nextProps = withoutInstanceAssociations(
              getProps(propsRef.current)
            ) as Partial<Props>;
            return nextProps as Readonly<Props & PropsBaseType>;
          },
          subscribe(cb) {
            subsRef.current.add(cb);
            return () => subsRef.current.delete(cb);
          },
        };
      }

      runtime.useImperativeHandle(
        ref,
        () => ({
          update: () => controllerRef.current?.update(),
          getExposes: () => scopedExposesReaderRef.current.read(exposesRef.current ?? {}),
          invokeInCallbackScope: (fn: () => void) => invokeInCallbackScopeRef.current?.(fn),
        }),
        []
      );

      runtime.useEffect(() => {
        controllerRef.current?.applyInstanceAssociations(
          propsRef.current.instanceAssociations ?? {}
        );
        const nextRawProps = snapshotRawProps(
          withoutInstanceAssociations(getProps(propsRef.current))
        );
        const previousRawProps = deliveredRawPropsRef.current;
        deliveredRawPropsRef.current = nextRawProps;
        if (previousRawProps && hasSameRawProps(previousRawProps, nextRawProps)) return;

        for (const cb of subsRef.current) cb();
        if (autoUpdate) controllerRef.current?.update();
      }, [props, autoUpdate]);

      const createHostSession = (
        wiring: Parameters<typeof createReactHostSession<Props>>[0]['wiring'],
        initialMount: 'eager' | 'manual'
      ) =>
        createReactHostSession({
          proto,
          schedule,
          rawPropsSource: rawPropsSourceRef.current as RawPropsSource<Props>,
          getInstanceAssociations: () => propsRef.current.instanceAssociations ?? {},
          wiring,
          eventGate: {
            disable: () => eventGateRef.current?.disable(),
            dispose: () => ownerRef.current?.disposeView(),
          },
          router: {
            dispose: () => ownerRef.current?.disposeView(),
          },
          onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
          onLifecycleEvent: opt.diagnostics?.onLifecycleEvent,
          onCommit: (children, signal) => {
            pendingCommitRef.current = true;
            pendingSignalRef.current = signal;
            setRenderChildren(children);
            commitVersionRef.current += 1;
            setCommitVersion(commitVersionRef.current);
          },
          onAfterUnmount: () => {
            scopedExposesReaderRef.current.invalidate();
            invokeInCallbackScopeRef.current = null;
            hostSessionRef.current = null;
            controllerRef.current = null;
            exposesRef.current = {};
            setHostTokens([]);
          },
          initialMount,
        });

      runtime.useLayoutEffect(() => {
        if (!supportsOwnerContext) return;
        let hostSession = ownerRef.current?.session;
        if (!hostSession) {
          const ownerModules = createReactOwnerModules({
            instanceToken: instanceTokenRef.current,
            emit: (key, payload) => {
              eventCallbacksRef.current[key]?.(payload);
            },
            rawPropsSource: rawPropsSourceRef.current as RawPropsSource<Props>,
            getMeta,
            colorSchemeSource,
            preferenceSource,
            styleSupportSource,
            setExposes: (record) => {
              exposesRef.current = record;
            },
            runInCallbackScope: (fn) => {
              const invoke = invokeInCallbackScopeRef.current;
              if (invoke) invoke(fn);
              else fn();
            },
            overlayLayerScheduler,
          });
          hostSession = ownerRef.current!.initialize({
            modules: ownerModules,
            createSession: (wiring) => createHostSession(wiring, 'manual'),
            onViewIntent: (snapshot) => {
              setShouldExist(snapshot.present);
            },
          });
        }

        hostSessionRef.current = hostSession as ReturnType<typeof createReactHostSession<Props>>;
        controllerRef.current = hostSession.controller as RuntimeController;
        invokeInCallbackScopeRef.current = hostSession.invokeInCallbackScope;
        const initialIntent = hostSession.viewIntent.getSnapshot();
        setShouldExist(initialIntent.present);
      }, []);

      runtime.useLayoutEffect(() => {
        if (!shouldExist) {
          const detachedEl = rootRef.current;
          if (detachedEl) installViewVisibilityRule(detachedEl.ownerDocument);
          detachedEl?.setAttribute(PUI_VIEW_PENDING_ATTR, '');
          revealGenerationRef.current += 1;
          detachedEl?.removeAttribute(PUI_VIEW_REVEALING_ATTR);
          eventGateRef.current?.disable?.();
          if (ownerRef.current?.hasView) void ownerRef.current.detachView();
          setHostTokens([]);
          pendingRevealStyleRevisionRef.current = null;
          projectionReadyRef.current = false;
          viewReadyRef.current = false;
          return;
        }

        const rootEl = rootRef.current;
        if (!rootEl) return;

        installViewVisibilityRule(rootEl.ownerDocument);

        try {
          markProtoInstance(rootEl, proto as Prototype<any>, instanceTokenRef.current);
        } catch (error) {
          // Marker publication can replay a pending request before a view
          // disposer exists. Roll back only this root, retaining the first error.
          try {
            unbindProtoInstance(instanceTokenRef.current, rootEl);
          } catch {
            /* original error wins */
          }

          throw error;
        }
        boundRootRef.current = rootEl;

        const eventGate = createEventGate();
        eventGateRef.current = eventGate;

        const router = createWebProtoEventRouter({
          rootEl,
          instanceToken: instanceTokenRef.current,
          resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
          isSemanticEventRouteCandidate: isLogicalEventRouteCandidate,
          globalEl: typeof window === 'undefined' ? rootEl : window,
          isEnabled: () => eventGate.isEnabled?.() ?? true,
        });
        bindLogicalEventTarget(instanceTokenRef.current, router.rootTarget);
        let viewDisposed = false;
        let ownedVisualStyle: string | null = null;
        let focusRetryGeneration = 0;
        let releaseRequestedTargetReady: (() => void) | undefined;
        const releaseNativeReadiness = registerNativeFocusReadiness(
          instanceTokenRef.current,
          {
            isReady: () =>
              !viewDisposed &&
              viewReadyRef.current &&
              eventGate.isEnabled() &&
              rootRef.current === rootEl &&
              rootEl.isConnected &&
              !rootEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
            subscribe: (listener) => {
              focusTargetReadyListenersRef.current.add(listener);
              return () => focusTargetReadyListenersRef.current.delete(listener);
            },
          },
          { deferPublication: true }
        );
        const disposeView = () => {
          if (viewDisposed) return;
          viewDisposed = true;
          const releases = [
            () => {
              if (
                ownedVisualStyle !== null &&
                rootEl.getAttribute('data-pui-style') === ownedVisualStyle
              )
                rootEl.removeAttribute('data-pui-style');
            },
            () => eventGate.disable(),
            () => eventGate.dispose(),
            () => {
              const release = releaseRequestedTargetReady;
              releaseRequestedTargetReady = undefined;
              release?.();
            },
            () => unbindLogicalEventTarget(instanceTokenRef.current, router.rootTarget),
            () => router.dispose(),
            () => unbindProtoInstance(instanceTokenRef.current, rootEl),
            () => {
              if (boundRootRef.current === rootEl) boundRootRef.current = null;
              if (eventGateRef.current === eventGate) {
                eventGateRef.current = null;
                focusTargetRetryScheduledRef.current = false;
              }
            },
            // Publish invalidation after releasing old bindings. Pending focus
            // callbacks may throw; every old-view release must still complete.
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

        const effectsPort = createReactEffectsPort((tokens) => {
          if (viewDisposed || rootRef.current !== rootEl) return;
          setHostTokens(tokens);
          if (viewDisposed || rootRef.current !== rootEl) return;
          // The opted-in visual provider samples final style in this transaction.
          // Keep this attribute out of React's deferred VDOM ownership below.
          if (createVisualSink) {
            ownedVisualStyle = serializeStyleTokens(tokens) ?? null;
            if (ownedVisualStyle === null) rootEl.removeAttribute('data-pui-style');
            else if (rootEl.getAttribute('data-pui-style') !== ownedVisualStyle)
              rootEl.setAttribute('data-pui-style', ownedVisualStyle);
          }
        });

        const rawPropsSource = rawPropsSourceRef.current as RawPropsSource<Props>;
        const modules = createReactModules({
          getPortalOrigin: () => portalOriginRef.current,
          el: rootEl,
          instanceToken: instanceTokenRef.current,
          router,
          emit: (key, payload) => {
            eventCallbacksRef.current[key]?.(payload);
          },
          rawPropsSource,
          effectsPort,
          visualFeedbackSink: createVisualSink
            ? createDeferredViewVisualSink(
                () => createVisualSink!(rootEl, effectsPort),
                (frame) => {
                  effectsPort.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
                  effectsPort.requestFlush();
                }
              )
            : undefined,
          getMeta,
          colorSchemeSource,
          preferenceSource,
          styleSupportSource,
          exposeStateWebMode,
          scrollProjection,
          setExposes: (record) => {
            exposesRef.current = record;
          },
          runInCallbackScope: (fn) => {
            const invoke = invokeInCallbackScopeRef.current;
            if (invoke) {
              invoke(fn);
              return;
            }
            fn();
          },
          // A child of a detached ancestor still mounts and attaches its own
          // view, so readiness has to consult the subtree, not just this host.
          // Physical/A11y binding and blur use the committed view. Acquisition
          // separately applies the native or entry owner's observation gate;
          // programmatic requests retain their synchronous Module-fact rule.
          isViewReady: () =>
            projectionReadyRef.current &&
            !viewDisposed &&
            !rootRef.current?.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
          // Entry does not own descendant facts. Wait for the actual target's
          // event owner without gating the shared physical target getter.
          isEntryAcquisitionReady: (target) => {
            releaseRequestedTargetReady?.();
            releaseRequestedTargetReady = undefined;
            if (isFocusTargetOwnerReady(target)) return true;
            releaseRequestedTargetReady = subscribeFocusTargetOwnerReady(target, () => {
              if (viewDisposed) return;
              releaseRequestedTargetReady?.();
              releaseRequestedTargetReady = undefined;
              notifyFocusTargetReady();
            });
            return false;
          },
          focusIntentState: focusIntentStateRef.current,
          onFocusIntent: () => {
            focusTargetRetryCountRef.current = 0;
            focusRetryGeneration += 1;
            focusTargetRetryScheduledRef.current = false;
          },
          onFocusPendingReleased: () => {
            focusRetryGeneration += 1;
            focusTargetRetryScheduledRef.current = false;
            const release = releaseRequestedTargetReady;
            releaseRequestedTargetReady = undefined;
            release?.();
          },
          onFocusAcquired: () => {
            focusTargetRetryCountRef.current = 0;
            // Completion retires queued work for this intent in the current view.
            focusRetryGeneration += 1;
            focusTargetRetryScheduledRef.current = false;
            releaseRequestedTargetReady?.();
            releaseRequestedTargetReady = undefined;
          },
          getCurrentElement: () => rootRef.current,
          subscribeTargetReady: (listener) => {
            focusTargetReadyListenersRef.current.add(listener);
            return () => focusTargetReadyListenersRef.current.delete(listener);
          },
          retryTargetReady: () => {
            if (
              focusTargetRetryScheduledRef.current ||
              focusTargetRetryCountRef.current >= MAX_FOCUS_TARGET_RETRIES
            ) {
              return;
            }
            focusTargetRetryScheduledRef.current = true;
            focusTargetRetryCountRef.current += 1;
            const generation = focusRetryGeneration;
            scheduleAfterWebLayout(
              rootRef.current,
              () => {
                if (viewDisposed || generation !== focusRetryGeneration) return;
                focusTargetRetryScheduledRef.current = false;
                notifyFocusTargetReady();
              },
              schedule
            );
          },
          overlayLayerScheduler,
        });

        const owner = ownerRef.current!;
        const initialSession = !owner.session;
        try {
          const hostSession = owner.attachView({
            modules,
            disposeView,
            // The optional no-Context runtime constructs its first session
            // here, before its lifetime cleanup effect has mounted. Retain the
            // session before mount can run author render/commit callbacks.
            createSession: (wiring) => {
              try {
                return createHostSession(wiring, 'manual');
              } catch (error) {
                // A partially constructed Runtime has not returned its dispose
                // handle. Revoke the caps already wired into it before view
                // invalidation can call those abandoned subscriptions again.
                try {
                  wiring.afterUnmount();
                } catch {
                  // Preserve the construction error through best-effort release.
                }
                throw error;
              }
            },
          });
          if (initialSession) void hostSession.mount();

          hostSessionRef.current = hostSession;
          controllerRef.current = hostSession.controller as RuntimeController;
          invokeInCallbackScopeRef.current = hostSession.invokeInCallbackScope;

          const { kernel } = hostSession;
          if (kernel && kernel.run) {
            (kernel.run as any).host = { get: () => rootRef.current };
          }
          releaseNativeReadiness.publish();
        } catch (error) {
          if (initialSession) {
            // attachView adopts disposeView before creating the session, so
            // even a factory that has not returned can release its acquired
            // host resources. Retire only this captured initial owner; existing
            // owners keep the normal retained/terminal React cleanup path.
            try {
              void owner.dispose().catch(() => {});
            } catch {
              // Cleanup cannot replace the original author callback failure.
            }
          }
          throw error;
        }
      }, [shouldExist]);

      // React StrictMode replays layout effects. Detach immediately so view
      // resources follow the replay, but defer terminal owner disposal by one
      // microtask so an immediate retain can preserve the Proto instance.
      runtime.useLayoutEffect(() => {
        ownerDisposalRef.current?.retain();
        return () => {
          pendingRevealStyleRevisionRef.current = null;
          projectionReadyRef.current = false;
          viewReadyRef.current = false;
          const cleanupRoot = rootRef.current;
          cleanupRoot?.setAttribute(PUI_VIEW_PENDING_ATTR, '');
          revealGenerationRef.current += 1;
          cleanupRoot?.removeAttribute(PUI_VIEW_REVEALING_ATTR);
          try {
            void ownerRef.current?.detachView();
          } finally {
            // A failing readiness observer must not keep a removed instance alive.
            ownerDisposalRef.current?.release();
          }
        };
      }, []);

      runtime.useLayoutEffect(() => {
        if (pendingCommitRef.current) {
          pendingCommitRef.current = false;
          const wasReady = viewReadyRef.current;
          const signal = pendingSignalRef.current;
          pendingSignalRef.current = null;
          projectionReadyRef.current = true;

          // Runtime finalizes rule-driven view effects from CommitSignal.done().
          // Keep a newly attached root pending until that flush has reached a
          // later React DOM commit; otherwise the base style becomes visible
          // before its variant, size, and state tokens.
          signal?.done?.();

          if (wasReady) {
            if (!pendingCommitRef.current) {
              eventGateRef.current?.enable();
              notifyFocusTargetReady();
            }
            return;
          }

          pendingRevealStyleRevisionRef.current = hostTokenRevisionRef.current;
        }

        const requiredStyleRevision = pendingRevealStyleRevisionRef.current;
        if (requiredStyleRevision === null) return;
        if (
          hostStyle.revision < requiredStyleRevision ||
          hostStyle.revision !== hostTokenRevisionRef.current
        ) {
          return;
        }

        pendingRevealStyleRevisionRef.current = null;
        viewReadyRef.current = true;
        const revealedRoot = rootRef.current;
        const revealGeneration = ++revealGenerationRef.current;
        revealedRoot?.setAttribute(PUI_VIEW_REVEALING_ATTR, '');
        revealedRoot?.removeAttribute(PUI_VIEW_PENDING_ATTR);
        if (revealedRoot) {
          scheduleAfterWebLayout(
            revealedRoot,
            () => {
              if (
                revealGenerationRef.current === revealGeneration &&
                rootRef.current === revealedRoot &&
                !revealedRoot.hasAttribute(PUI_VIEW_PENDING_ATTR)
              ) {
                revealedRoot.removeAttribute(PUI_VIEW_REVEALING_ATTR);
              }
            },
            schedule
          );
        }
        eventGateRef.current?.enable();
        notifyFocusTargetReady();
      }, [commitVersion, hostStyle.revision]);

      // A renderer can replace the host element after the Proto commit that
      // first announced readiness. Re-advertise the current ref after every
      // committed render, then once more after the renderer's microtask work,
      // so pending focus requests bind to the element that actually survived.
      runtime.useLayoutEffect(() => {
        const target = rootRef.current;
        if (!viewReadyRef.current || !target?.isConnected) return;
        notifyFocusTargetReady();
        schedule(() => {
          if (rootRef.current === target) notifyFocusTargetReady();
        });
      });

      const rendered = renderTemplateToReact(runtime, renderChildren, {
        slot: props.children,
      });
      // Template roots are a static child list. Passing that list as one array
      // makes React treat it as a dynamic collection and warn that anatomy
      // siblings such as Select Value + Chevron need authored keys.
      const renderedChildren = Array.isArray(rendered) ? rendered : [rendered];

      const overlayPort = ownerRef.current?.session?.caps.getPort<OverlayPort>('overlay');
      const portalContainer =
        shouldExist &&
        overlayPort?.getConfig().portal === true &&
        typeof runtime.createPortal === 'function' &&
        typeof document !== 'undefined'
          ? document.body
          : null;

      // Overlay content is detached, not unmounted, when it is not present: the
      // host element and the authored children stay put so collection members
      // keep registering, and the shared detached rule takes them out of paint,
      // a11y, and tab order. Prototypes that drive presence directly through
      // `lifecycle.setPresent`, such as Tabs Content, keep unmounting.
      const detached = !shouldExist && overlayPort?.hasPresenceBinding() === true;
      const content =
        !shouldExist && !detached
          ? null
          : runtime.createElement(
              rootTag,
              {
                ref: rootRef as { current: HTMLElement | null },
                className: mergeHostClassName([
                  props.surfaceClassName,
                  props.hostClassName,
                  props.className,
                ]),
                style: mergeHostStyle([props.surfaceStyle, props.hostStyle, props.style]),
                dir: props.dir,
                'data-pui-root': '',
                [PUI_VIEW_DETACHED_ATTR]: detached ? '' : undefined,
                [PUI_VIEW_PENDING_ATTR]: viewReadyRef.current ? undefined : '',
                ...(createVisualSink
                  ? {}
                  : { 'data-pui-style': serializeStyleTokens(hostStyle.tokens) }),
                'data-demo-ref': props['data-demo-ref' as keyof typeof props] as string | undefined,
              },
              // Without a view there is no template to place the slot into, so the
              // authored children stand in for it.
              ...(shouldExist ? renderedChildren : [props.children])
            );
      const portal = portalContainer ? runtime.createPortal!(content, portalContainer) : null;
      const projectedContent = portalContainer
        ? runtime.Fragment
          ? runtime.createElement(
              runtime.Fragment,
              null,
              runtime.createElement('span', {
                ref: portalOriginRef,
                hidden: true,
                'aria-hidden': true,
                'data-pui-portal-origin': '',
              }),
              portal
            )
          : portal
        : content;
      if (!logicalOwnerContext) return projectedContent;
      return runtime.createElement(
        logicalOwnerContext.Provider,
        { value: instanceTokenRef.current },
        projectedContent
      );
    }) as ProtoReactComponent<TProto>;

    Component.displayName = `Proto(${proto.name})`;
    return Component;
  };
}

function normalizeRuntime(input: ReactRuntimeInput): ReactRuntime {
  return (input as any).React ?? (input as ReactRuntime);
}

function mergeHostClassName(input: unknown) {
  const values = (Array.isArray(input) ? input : [input])
    .map((value: any) => (typeof value === 'string' ? value.trim() : value))
    .filter((value: any) => {
      if (typeof value === 'string') return value.length > 0;
      return value != null;
    });

  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const token of value.split(/\s+/)) {
      if (!token || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }

  return out.length > 0 ? out.join(' ') : undefined;
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

function collectEventCallbacks(
  props: Record<string, unknown>
): Record<string, (payload?: unknown) => void> {
  const out: Record<string, (payload?: unknown) => void> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!isFrameworkEventProp(key, value)) continue;
    const eventKey = fromHandlerPropName(key);
    if (!eventKey) continue;
    out[eventKey] = value as (payload?: unknown) => void;
  }
  return out;
}

function isFrameworkEventProp(key: string, value: unknown) {
  return /^on[A-Z]/.test(key) && typeof value === 'function';
}

function fromHandlerPropName(key: string) {
  const raw = key.slice(2);
  if (!raw) return null;
  return raw[0]!.toLowerCase() + raw.slice(1);
}
