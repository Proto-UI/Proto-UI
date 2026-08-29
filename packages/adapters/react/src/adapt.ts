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
  createScopedExposesReader,
  createViewEpochOwner,
  createWebProtoEventRouter,
  installViewVisibilityRule,
  PUI_VIEW_DETACHED_ATTR,
  PUI_VIEW_PENDING_ATTR,
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
  markProtoInstance,
  unbindProtoInstance,
  unbindLogicalEventTarget,
} from './platform/instance-tree';
import { createReactEffectsPort } from './runtime/effects-port';
import { createReactModules, createReactOwnerModules } from './runtime/modules';
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
        `[React Adapter] text-control declaration conflicts with rootTag: ${opt.rootTag}`
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

    const Component = runtime.forwardRef((props: ReactAdapterProps<Props>, ref: any) => {
      const rootRef = runtime.useRef<HTMLElement | null>(null);
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
      const [hostTokens, setHostTokens] = runtime.useState<string[]>([]);
      const [shouldExist, setShouldExist] = runtime.useState(!supportsOwnerContext);
      const viewReadyRef = runtime.useRef(false);
      const focusTargetReadyListenersRef = runtime.useRef<Set<() => void>>(new Set());
      const focusTargetRetryScheduledRef = runtime.useRef(false);
      const focusTargetRetryCountRef = runtime.useRef(0);
      const notifyFocusTargetReady = () => {
        const target = rootRef.current;
        if (!viewReadyRef.current || !target?.isConnected) return;
        for (const listener of Array.from(focusTargetReadyListenersRef.current)) listener();
        if (target.ownerDocument.activeElement === target) focusTargetRetryCountRef.current = 0;
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
            const nextProps = getProps(propsRef.current) ?? ({} as Partial<Props>);
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
        const nextRawProps = snapshotRawProps(getProps(propsRef.current));
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
          eventGateRef.current?.disable?.();
          if (ownerRef.current?.hasView) void ownerRef.current.detachView();
          setHostTokens([]);
          viewReadyRef.current = false;
          focusTargetRetryCountRef.current = 0;
          return;
        }

        const rootEl = rootRef.current;
        if (!rootEl) return;

        installViewVisibilityRule(rootEl.ownerDocument);

        markProtoInstance(rootEl, proto as Prototype<any>, instanceTokenRef.current);
        boundRootRef.current = rootEl;

        const eventGate = createEventGate();
        eventGateRef.current = eventGate;

        const router = createWebProtoEventRouter({
          rootEl,
          instanceToken: instanceTokenRef.current,
          resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
          globalEl: typeof window === 'undefined' ? rootEl : window,
          isEnabled: () => eventGate.isEnabled?.() ?? true,
        });
        bindLogicalEventTarget(instanceTokenRef.current, router.rootTarget);
        let viewDisposed = false;
        const disposeView = () => {
          if (viewDisposed) return;
          viewDisposed = true;
          eventGate.disable();
          eventGate.dispose();
          unbindLogicalEventTarget(instanceTokenRef.current, router.rootTarget);
          router.dispose();
          unbindProtoInstance(instanceTokenRef.current, boundRootRef.current ?? undefined);
          if (boundRootRef.current === rootEl) boundRootRef.current = null;
          if (eventGateRef.current === eventGate) eventGateRef.current = null;
        };

        const effectsPort = createReactEffectsPort((tokens) => {
          setHostTokens(tokens);
        });

        const rawPropsSource = rawPropsSourceRef.current as RawPropsSource<Props>;
        const modules = createReactModules({
          el: rootEl,
          instanceToken: instanceTokenRef.current,
          router,
          emit: (key, payload) => {
            eventCallbacksRef.current[key]?.(payload);
          },
          rawPropsSource,
          effectsPort,
          getMeta,
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
          isViewReady: () =>
            viewReadyRef.current && !rootRef.current?.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
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
            scheduleAfterWebLayout(
              rootRef.current,
              () => {
                focusTargetRetryScheduledRef.current = false;
                notifyFocusTargetReady();
              },
              schedule
            );
          },
          overlayLayerScheduler,
        });

        const hostSession = ownerRef.current!.attachView({
          modules,
          disposeView,
          createSession: (wiring) => createHostSession(wiring, 'eager'),
        });

        hostSessionRef.current = hostSession;
        controllerRef.current = hostSession.controller as RuntimeController;
        invokeInCallbackScopeRef.current = hostSession.invokeInCallbackScope;

        const { kernel } = hostSession;
        if (kernel && kernel.run) {
          (kernel.run as any).host = { get: () => rootRef.current };
        }
      }, [shouldExist]);

      // React StrictMode replays layout effects. Detach immediately so view
      // resources follow the replay, but defer terminal owner disposal by one
      // microtask so an immediate retain can preserve the Proto instance.
      runtime.useLayoutEffect(() => {
        ownerDisposalRef.current?.retain();
        return () => {
          viewReadyRef.current = false;
          focusTargetRetryCountRef.current = 0;
          rootRef.current?.setAttribute(PUI_VIEW_PENDING_ATTR, '');
          void ownerRef.current?.detachView();
          ownerDisposalRef.current?.release();
        };
      }, []);

      runtime.useLayoutEffect(() => {
        if (!pendingCommitRef.current) return;
        pendingCommitRef.current = false;
        viewReadyRef.current = true;
        focusTargetRetryCountRef.current = 0;
        rootRef.current?.removeAttribute(PUI_VIEW_PENDING_ATTR);
        eventGateRef.current?.enable();
        notifyFocusTargetReady();
        pendingSignalRef.current?.done?.();
        pendingSignalRef.current = null;
      }, [commitVersion]);

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
                'data-pui-root': '',
                [PUI_VIEW_DETACHED_ATTR]: detached ? '' : undefined,
                [PUI_VIEW_PENDING_ATTR]: viewReadyRef.current ? undefined : '',
                'data-pui-style': serializeStyleTokens(hostTokens),
                'data-demo-ref': props['data-demo-ref' as keyof typeof props] as string | undefined,
              },
              // Without a view there is no template to place the slot into, so the
              // authored children stand in for it.
              ...(shouldExist ? renderedChildren : [props.children])
            );
      const projectedContent = portalContainer
        ? runtime.createPortal!(content, portalContainer)
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
