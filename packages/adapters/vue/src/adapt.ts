import {
  collectWebOwnedDecorationTargets,
  createWebOwnedDecorationStage,
  type WebOwnedDecorationStage,
} from '@proto.ui/adapter-base';
import type { FeedbackFacade, FeedbackPort } from '@proto.ui/module-feedback';
import {
  getWebPortalDestinationGeneration,
  resolveWebPortalDestinationBinding,
  subscribeWebPortalDestinations,
  notifyWebPortalProjection,
  beginWebPortalMaterialEpoch,
} from '@proto.ui/adapter-base';
import type { WebResidentMotionOptions } from '@proto.ui/adapter-base';
import {
  NATIVE_LINK_DECLARATION,
  resolveWebNativeLinkLocalName,
} from '@proto.ui/module-native-link';
import type { EffectsPort } from '@proto.ui/core';
import { createDeferredViewVisualSink, type VisualFeedbackSink } from '@proto.ui/module-feedback';
import { withoutInstanceAssociations } from '@proto.ui/adapter-base/internal/instance-associations';
import type { InstanceAssociations } from '@proto.ui/core';
import {
  equalOwnedTemplateBlueprint,
  getModuleDeclaration,
  type TemplateChildren,
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
  createDefaultWebViewportSource,
  createScopedExposesReader,
  createViewEpochOwner,
  createWebProtoEventRouter,
  installViewVisibilityRule,
  PUI_VIEW_DETACHED_ATTR,
  PUI_VIEW_PENDING_ATTR,
  PUI_VIEW_REVEALING_ATTR,
  type ProtoAdapterExposes,
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
  type OverlayLayerScheduler,
  type OverlayPort,
  type OverlayZIndexLayerSchedulerOptions,
} from '@proto.ui/module-overlay';
import type { RawPropsSource } from '@proto.ui/module-props';
import { PropsBaseType } from '@proto.ui/types';

import { createDefaultMetaGetter } from './platform/meta';
import type { ProtoVueComponent, VueAdapterHandle } from './types';
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
import { createVueEffectsPort } from './runtime/effects-port';
import { createVueModules, createVueOwnerModules, type FocusIntentState } from './runtime/modules';
import { createVueHostSession } from './runtime/session';
import { renderTemplateToVue, type VueRuntime as VueRenderRuntime } from './template';

export { __VUE_PROTO_INSTANCE } from './platform/instance-tree';

export type VueRuntime = VueRenderRuntime & {
  defineComponent: (opt: any) => any;
  h: (type: any, props?: any, children?: any) => any;
  Teleport?: any;
  Fragment?: any;
  ref: <T>(v: T) => { value: T };
  shallowRef: <T>(v: T) => { value: T };
  watch: (source: any, cb: (...args: any[]) => void | Promise<void>, options?: any) => unknown;
  onMounted: (cb: () => void) => void;
  onUpdated?: (cb: () => void) => void;
  onBeforeUnmount: (cb: () => void) => void;
  onActivated?: (cb: () => void) => void;
  onDeactivated?: (cb: () => void) => void;
  nextTick: (fn?: () => void) => Promise<void>;
  provide?: (key: symbol, value: unknown) => void;
  inject?: <T>(key: symbol, defaultValue: T) => T;
};

export type { VueAdapterHandle } from './types';

export type VueAdapterProps<Props extends PropsBaseType> = Props &
  PropsBaseType & {
    instanceAssociations?: InstanceAssociations;
    class?: string | string[] | Record<string, boolean>;
    hostClass?: string | string[] | Record<string, boolean>;
    surfaceClass?: string | string[] | Record<string, boolean>;
    hostStyle?: Record<string, string> | string | Array<Record<string, string>>;
    surfaceStyle?: Record<string, string> | string | Array<Record<string, string>>;
    [key: `on${string}`]: unknown;
  };

export interface VueAdapterOptions<Props extends PropsBaseType> {
  /** Draft V2 host provider; one fresh sink per physical view. No provider means ordinary style. */
  createVisualSink?: (host: HTMLElement, effects: EffectsPort) => VisualFeedbackSink | null;
  residentMotion?: WebResidentMotionOptions;
  schedule?: (task: () => void) => void;
  getProps?: (props: VueAdapterProps<Props>) => Partial<Props> | null | undefined;
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

function defaultGetProps<Props extends PropsBaseType>(
  props: VueAdapterProps<Props>
): Partial<Props> {
  const {
    class: className,
    hostClass,
    surfaceClass,
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

export function createVueAdapter(runtime: VueRuntime) {
  const sharedOverlayLayerScheduler = createZIndexOverlayLayerScheduler();
  const logicalOwnerKey = Symbol('@proto.ui/adapter-vue/logical-owner');

  return function AdaptToVue<TProto extends Prototype<any, any>>(
    proto: TProto,
    opt: VueAdapterOptions<ProtoAdapterProps<TProto>> = {}
  ): ProtoVueComponent<TProto> {
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
    const viewportSource = opt.getMeta ? undefined : createDefaultWebViewportSource(getMeta);
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
        '[Vue Adapter] text-control, image-view and native-link declarations cannot share a root.'
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
        `[Vue Adapter] ${declarationName} declaration conflicts with rootTag: ${opt.rootTag}`
      );
    }
    const rootTag = declaredRootTag ?? opt.rootTag ?? 'div';
    const ownedDecoration =
      !declaredRootTag &&
      ![
        'input',
        'img',
        'textarea',
        'select',
        'a',
        'br',
        'hr',
        'area',
        'base',
        'embed',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
      ].includes(rootTag);

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

    const Component = runtime.defineComponent({
      name: `Proto(${proto.name})`,
      inheritAttrs: false,
      props: {
        instanceAssociations: { type: Object, default: undefined },
        hostClass: { type: [String, Array, Object], default: undefined },
        surfaceClass: { type: [String, Array, Object], default: undefined },
        hostStyle: { type: [String, Array, Object], default: undefined },
        surfaceStyle: { type: [String, Array, Object], default: undefined },
      },
      setup(props: any, ctx: any) {
        const rootRef = runtime.ref<HTMLElement | null>(null);
        const portalOriginRef = runtime.ref<HTMLElement | null>(null);
        const portalDestination = runtime.shallowRef<HTMLElement | null>(null);
        let portalEpoch: {
          host: HTMLElement;
          destination: HTMLElement;
          registration: object | null;
          material: ReturnType<typeof beginWebPortalMaterialEpoch>;
        } | null = null;
        let lastPortalProjection: { host: HTMLElement; parent: Node | null } | null = null;
        const refreshPortalDestination = () => {
          const host = rootRef.value;
          if (!runtime.Teleport || !host || !shouldExist.value) {
            const previous = portalEpoch;
            portalEpoch = null;
            portalDestination.value = null;
            lastPortalProjection = null;
            previous?.material.release();
            return;
          }
          if (owner.session?.caps.getPort<OverlayPort>('overlay')?.getConfig().portal !== true)
            return;
          const registryRevision = getWebPortalDestinationGeneration();
          const { destination: next, registration } = resolveWebPortalDestinationBinding(
            portalOriginRef.value ?? host,
            host
          );
          if (registryRevision !== getWebPortalDestinationGeneration() || rootRef.value !== host)
            return;
          if (portalEpoch?.host === host) {
            if (portalEpoch.destination !== next || portalEpoch.registration !== registration)
              portalEpoch.material.suspend();
          } else {
            const previous = portalEpoch;
            portalEpoch = null;
            previous?.material.release();
            if (
              rootRef.value !== host ||
              !shouldExist.value ||
              portalEpoch !== null ||
              registryRevision !== getWebPortalDestinationGeneration()
            )
              return;
            const material = beginWebPortalMaterialEpoch(host);
            if (
              rootRef.value !== host ||
              !shouldExist.value ||
              portalEpoch !== null ||
              registryRevision !== getWebPortalDestinationGeneration()
            ) {
              material.release();
              return;
            }
            portalEpoch = { host, destination: next, registration, material };
            if (portalDestination.value !== next) portalDestination.value = next;
          }
          const committedEpoch = portalEpoch;
          if (!committedEpoch || host.parentNode !== committedEpoch.destination) return;
          committedEpoch.material.commitProjection();
          if (
            rootRef.value !== host ||
            portalEpoch !== committedEpoch ||
            host.parentNode !== committedEpoch.destination
          )
            return;
          if (
            lastPortalProjection?.host !== host ||
            lastPortalProjection.parent !== host.parentNode
          ) {
            lastPortalProjection = { host, parent: host.parentNode };
            notifyWebPortalProjection(host);
          }
        };
        const offPortalDestination = subscribeWebPortalDestinations(refreshPortalDestination);
        runtime.onBeforeUnmount(() => {
          offPortalDestination();
          const previous = portalEpoch;
          portalEpoch = null;
          previous?.material.release();
        });
        runtime.onMounted(refreshPortalDestination);
        runtime.onUpdated?.(refreshPortalDestination);
        const renderChildren = runtime.shallowRef<any>(null);
        const commitVersion = runtime.ref(0);
        const hostTokens = runtime.shallowRef<string[]>([]);
        const controllerRef = runtime.ref<RuntimeController | null>(null);
        // The gate is an opaque resource: deep ref proxies break view-epoch identity checks.
        const eventGateRef = runtime.shallowRef<ReturnType<typeof createEventGate> | null>(null);
        let revealedGate: ReturnType<typeof createEventGate> | null = null;
        const exposesRef = runtime.ref<Record<string, unknown>>({});
        const invokeRef = runtime.ref<((fn: () => void) => void) | null>(null);
        const scopedExposesReader = createScopedExposesReader(() => invokeRef.value);
        const instanceToken = createLogicalInstance(proto as Prototype<any>);
        const supportsOwnerContext = !!runtime.provide && !!runtime.inject;
        const parentToken = supportsOwnerContext
          ? runtime.inject!(
              logicalOwnerKey,
              null as ReturnType<typeof createLogicalInstance> | null
            )
          : null;
        if (supportsOwnerContext) {
          bindLogicalParent(instanceToken, parentToken, { authority: 'owner' });
          runtime.provide!(logicalOwnerKey, instanceToken);
        }
        const shouldExist = runtime.ref(!supportsOwnerContext);
        let viewReady = false;
        const focusTargetReadyListeners = new Set<() => void>();
        let focusTargetRetryScheduled = false;
        let focusTargetRetryCount = 0;
        const focusIntentState: FocusIntentState = {};
        const portalIsCommitted = () => {
          if (
            owner.session?.caps.getPort<OverlayPort>('overlay')?.getConfig().portal !== true ||
            !runtime.Teleport
          )
            return true;
          return (
            !!portalEpoch &&
            portalEpoch.host === rootRef.value &&
            portalEpoch.host.parentNode === portalEpoch.destination
          );
        };
        const notifyFocusTargetReady = () => {
          const target = rootRef.value;
          if (!portalIsCommitted() || !viewReady || !target?.isConnected) return;
          let failed = false;
          let firstError: unknown;
          for (const listener of Array.from(focusTargetReadyListeners)) {
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

        const subs = new Set<() => void>();
        const rawPropsSource: RawPropsSource<Props> = {
          debugName: `${proto.name}#raw-props`,
          get() {
            const nextProps = getProps({
              ...(ctx.attrs ?? {}),
              ...(props ?? {}),
            } as VueAdapterProps<Props>);
            return withoutInstanceAssociations(nextProps) as Readonly<Props & PropsBaseType>;
          },
          subscribe(cb) {
            subs.add(cb);
            return () => subs.delete(cb);
          },
        };

        let pendingCommit = false;
        let renderDecoration: WebOwnedDecorationStage | undefined;
        let viewGeneration = 0;
        let decorationView: {
          stage: WebOwnedDecorationStage;
          blueprint: TemplateChildren;
          generation: number;
          root: HTMLElement | null;
          document: Document | null;
          caps: ReturnType<typeof createVueHostSession<Props>>['caps'];
          session: ReturnType<typeof createVueHostSession<Props>> | null;
          port: FeedbackPort;
          lease: object;
          committed: boolean;
        } | null = null;
        let commitGeneration = 0;
        let pendingSignal: CommitSignal | null = null;
        let hostSession: ReturnType<typeof createVueHostSession<Props>> | null = null;
        const owner = createViewEpochOwner<Props>({ prototypeName: proto.name });
        let boundRoot: HTMLElement | null = null;

        const createHostSession = (
          wiring: Parameters<typeof createVueHostSession<Props>>[0]['wiring'],
          initialMount: 'eager' | 'manual'
        ) =>
          createVueHostSession({
            proto,
            schedule,
            rawPropsSource,
            getInstanceAssociations: () => props.instanceAssociations ?? {},
            viewOperations: { capture: () => owner.captureViewOperation() },
            wiring,
            eventGate: {
              disable: () => eventGateRef.value?.disable(),
              dispose: () => owner.disposeView(),
            },
            router: {
              dispose: () => owner.disposeView(),
            },
            onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
            onLifecycleEvent: opt.diagnostics?.onLifecycleEvent,
            onCommit: (children, signal, caps) => {
              const root = rootRef.value;
              const generation = viewGeneration;
              const previousCommitGeneration = commitGeneration;
              const session = owner.session;
              const targets = collectWebOwnedDecorationTargets(children);
              const feedback = caps.getFacades().feedback as FeedbackFacade;
              const port = caps.getPort<FeedbackPort>('feedback');
              const lease = targets.length ? port?.captureDecorationLease?.() : undefined;
              const previous = decorationView;
              let next = previous?.committed ? previous : null;
              let stage: WebOwnedDecorationStage | undefined;
              if (next) {
                feedback.style.validateDecorationTemplate(targets);
                if (!equalOwnedTemplateBlueprint(next.blueprint, children))
                  throw new Error('[owned-decoration] structural rebind unsupported');
                if (
                  !root ||
                  next.root !== root ||
                  next.document !== root.ownerDocument ||
                  next.generation !== generation ||
                  next.session !== session ||
                  next.caps !== caps ||
                  next.port !== port ||
                  next.lease !== lease ||
                  !owner.hasView
                )
                  throw new Error('[Vue Adapter] stale decoration reuse');
                next.stage.assertReusable(root);
                stage = next.stage;
              } else {
                stage = targets.length
                  ? createWebOwnedDecorationStage(
                      targets,
                      (ids) => feedback.style.validateDecorationTemplate(ids),
                      { portal: !!caps.getPort<OverlayPort>('overlay')?.getConfig().portal }
                    )
                  : undefined;
                if (!targets.length) feedback.style.validateDecorationTemplate([]);
                if (stage) {
                  if (!port || !lease)
                    throw new Error('[Vue Adapter] owned-decoration unavailable');
                  next = {
                    stage,
                    blueprint: children,
                    generation,
                    root,
                    document: root?.ownerDocument ?? null,
                    caps,
                    session,
                    port,
                    lease,
                    committed: false,
                  };
                }
              }
              renderTemplateToVue({ h: () => null }, children, { decoration: stage });
              if (
                stage &&
                (rootRef.value !== root ||
                  viewGeneration !== generation ||
                  commitGeneration !== previousCommitGeneration ||
                  decorationView !== previous ||
                  owner.session !== session ||
                  port?.captureDecorationLease?.() !== lease)
              )
                throw new Error('[Vue Adapter] stale decoration commit');
              if (previous !== next) previous?.stage.retire();
              renderDecoration = stage;
              decorationView = next;
              commitGeneration += 1;
              pendingCommit = true;
              pendingSignal = signal;
              renderChildren.value = children;
              commitVersion.value += 1;
            },
            onAfterUnmount: () => {
              scopedExposesReader.invalidate();
              invokeRef.value = null;
              hostSession = null;
              controllerRef.value = null;
              exposesRef.value = {};
              hostTokens.value = [];
            },
            initialMount,
          });

        if (supportsOwnerContext) {
          const ownerModules = createVueOwnerModules({
            ownedDecoration,
            instanceToken,
            emit: (key, payload, options) => {
              ctx.emit(key, payload, options);
            },
            rawPropsSource,
            getMeta,
            colorSchemeSource,
            preferenceSource,
            styleSupportSource,
            viewportSource,
            setExposes: (record) => {
              exposesRef.value = record;
            },
            runInCallbackScope: (fn) => {
              const invoke = invokeRef.value;
              if (invoke) invoke(fn);
              else fn();
            },
            overlayLayerScheduler,
          });
          hostSession = owner.initialize({
            modules: ownerModules,
            createSession: (wiring) => createHostSession(wiring, 'manual'),
            onViewIntent: (snapshot) => {
              shouldExist.value = snapshot.present;
            },
          }) as ReturnType<typeof createVueHostSession<Props>>;
          controllerRef.value = hostSession.controller as RuntimeController;
          invokeRef.value = hostSession.invokeInCallbackScope;
          const initialIntent = hostSession.viewIntent.getSnapshot();
          shouldExist.value = initialIntent.present;
        }

        ctx.expose({
          update: () => controllerRef.value?.update(),
          getExposes: () =>
            scopedExposesReader.read(exposesRef.value ?? {}) as ProtoAdapterExposes<TProto>,
          invokeInCallbackScope: (fn: () => void) => invokeRef.value?.(fn),
        } satisfies VueAdapterHandle<TProto>);

        let lastHostProps = rawPropsSource.get();
        const notifyPropsChange = () => {
          controllerRef.value?.applyInstanceAssociations(props.instanceAssociations ?? {});
          const nextHostProps = rawPropsSource.get();
          if (shallowEqualHostProps(lastHostProps, nextHostProps)) return;
          lastHostProps = nextHostProps;
          for (const cb of subs) cb();
          if (autoUpdate) controllerRef.value?.update();
        };

        runtime.watch(props as any, notifyPropsChange, { deep: true });
        runtime.watch(() => ctx.attrs, notifyPropsChange, { deep: true });
        // Vue's attrs object always exposes the latest values but is not a
        // reactive watch source. Protocol props live in attrs because the
        // adapter component cannot declare instance-time prototype props.
        // Reconcile once the host component has received a parent update.
        runtime.onUpdated?.(notifyPropsChange);

        runtime.watch(
          () => commitVersion.value,
          async () => {
            if (!pendingCommit) return;
            pendingCommit = false;
            const generation = commitGeneration;
            const signal = pendingSignal;
            const gate = eventGateRef.value;
            const decoration = decorationView;
            const capturedRoot = rootRef.value;
            pendingSignal = null;
            await runtime.nextTick();
            if (
              generation !== commitGeneration ||
              gate !== eventGateRef.value ||
              rootRef.value !== capturedRoot ||
              !shouldExist.value
            )
              return;
            if (decoration) {
              const session = owner.session;
              const port = session?.caps.getPort<FeedbackPort>('feedback');
              if (
                decorationView !== decoration ||
                !capturedRoot ||
                decoration.root !== capturedRoot ||
                decoration.document !== capturedRoot.ownerDocument ||
                decoration.generation !== viewGeneration ||
                decoration.caps !== session?.caps ||
                (decoration.committed && decoration.session !== session) ||
                decoration.port !== port ||
                !owner.hasView ||
                !port?.bindDecorations ||
                port.captureDecorationLease?.() !== decoration.lease
              )
                throw new Error('[Vue Adapter] stale decoration commit');
              if (decoration.committed) decoration.stage.assertReusable(capturedRoot);
              else
                decoration.stage.bind(capturedRoot, (bindings) =>
                  port.bindDecorations!(bindings, decoration.lease)
                );
              if (
                generation !== commitGeneration ||
                gate !== eventGateRef.value ||
                rootRef.value !== capturedRoot ||
                capturedRoot.ownerDocument !== decoration.document ||
                decorationView !== decoration ||
                decoration.generation !== viewGeneration ||
                owner.session !== session ||
                !owner.hasView ||
                port.captureDecorationLease?.() !== decoration.lease
              )
                return;
              decoration.session = session;
              decoration.committed = true;
            }
            viewReady = true;
            notifyFocusTargetReady();
            signal?.done?.();
            // A lifecycle callback can synchronously commit again or detach.
            // Only this completed commit may reopen its own observation gate.
            if (
              generation !== commitGeneration ||
              gate !== eventGateRef.value ||
              !shouldExist.value
            )
              return;
            const revealedRoot = rootRef.value;
            const firstReveal = revealedGate !== gate;
            revealedGate = gate;
            // Keep the first authored style from transitioning from the unstyled host.
            if (firstReveal) revealedRoot?.setAttribute(PUI_VIEW_REVEALING_ATTR, '');
            revealedRoot?.removeAttribute(PUI_VIEW_PENDING_ATTR);
            if (firstReveal && revealedRoot) {
              scheduleAfterWebLayout(
                revealedRoot,
                () => {
                  if (
                    rootRef.value === revealedRoot &&
                    gate === eventGateRef.value &&
                    !revealedRoot.hasAttribute(PUI_VIEW_PENDING_ATTR)
                  ) {
                    revealedRoot.removeAttribute(PUI_VIEW_REVEALING_ATTR);
                  }
                },
                schedule
              );
            }
            gate?.enable();
            // onUpdated can schedule a Vue removal or replacement. Announce
            // observation readiness after that host commit has settled.
            const readyTarget = rootRef.value;
            runtime.nextTick().then(() => {
              if (
                generation === commitGeneration &&
                gate === eventGateRef.value &&
                rootRef.value === readyTarget
              )
                notifyFocusTargetReady();
            });
          },
          { flush: 'post' }
        );

        let lastInitRoot: HTMLElement | null = null;

        const initSession = () => {
          const rootEl = rootRef.value;
          if (!rootEl || rootEl === lastInitRoot) return;
          lastInitRoot = rootEl;

          try {
            markProtoInstance(rootEl, proto as Prototype<any>, instanceToken);
          } catch (error) {
            // Marker publication can replay a pending request before a view
            // disposer exists. Roll back only this root, retaining the first error.
            try {
              unbindProtoInstance(instanceToken, rootEl);
            } catch {
              /* original error wins */
            }
            if (lastInitRoot === rootEl) lastInitRoot = null;
            throw error;
          }
          boundRoot = rootEl;

          const eventGate = createEventGate();
          eventGateRef.value = eventGate;

          const router = createWebProtoEventRouter({
            rootEl,
            instanceToken,
            resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
            isSemanticEventRouteCandidate: isLogicalEventRouteCandidate,
            globalEl: typeof window === 'undefined' ? rootEl : window,
            isEnabled: () => eventGate.isEnabled?.() ?? true,
          });
          bindLogicalEventTarget(instanceToken, router.rootTarget);
          const physicalGeneration = ++viewGeneration;
          let viewDisposed = false;
          let ownedVisualStyle: string | null = null;
          let focusRetryGeneration = 0;
          let releaseRequestedTargetReady: (() => void) | undefined;
          const releaseNativeReadiness = registerNativeFocusReadiness(
            instanceToken,
            {
              isReady: () =>
                !viewDisposed &&
                shouldExist.value &&
                viewReady &&
                portalIsCommitted() &&
                eventGate.isEnabled() &&
                rootRef.value === rootEl &&
                rootEl.isConnected &&
                !rootEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
              subscribe: (listener) => {
                focusTargetReadyListeners.add(listener);
                return () => focusTargetReadyListeners.delete(listener);
              },
            },
            { deferPublication: true }
          );
          const disposeView = () => {
            if (viewDisposed) return;
            viewDisposed = true;
            if (viewGeneration === physicalGeneration) viewGeneration += 1;
            if (decorationView?.generation === physicalGeneration) {
              decorationView.stage.retire();
              decorationView = null;
            }
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
              () => unbindLogicalEventTarget(instanceToken, router.rootTarget),
              () => router.dispose(),
              () => unbindProtoInstance(instanceToken, rootEl),
              () => {
                if (boundRoot === rootEl) boundRoot = null;
                if (eventGateRef.value === eventGate) {
                  eventGateRef.value = null;
                  focusTargetRetryScheduled = false;
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

          const effectsPort = createVueEffectsPort((tokens) => {
            if (viewDisposed || rootRef.value !== rootEl) return;
            hostTokens.value = tokens;
            if (viewDisposed || rootRef.value !== rootEl) return;
            // One physical owner commits provider style before optical sampling.
            if (createVisualSink) {
              ownedVisualStyle = serializeStyleTokens(tokens) ?? null;
              if (ownedVisualStyle === null) rootEl.removeAttribute('data-pui-style');
              else if (rootEl.getAttribute('data-pui-style') !== ownedVisualStyle)
                rootEl.setAttribute('data-pui-style', ownedVisualStyle);
            }
          });

          const modules = createVueModules({
            ownedDecoration,
            getPortalOrigin: () => portalOriginRef.value,
            el: rootEl,
            instanceToken,
            router,
            emit: (key, payload, options) => {
              ctx.emit(key, payload, options);
            },
            rawPropsSource,
            effectsPort,
            residentMotion: opt.residentMotion,
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
            viewportSource,
            exposeStateWebMode,
            scrollProjection,
            setExposes: (record) => {
              exposesRef.value = record;
            },
            runInCallbackScope: (fn) => {
              const invoke = invokeRef.value;
              if (invoke) {
                invoke(fn);
                return;
              }
              fn();
            },
            // A child of a detached ancestor still mounts and attaches its own
            // view, so readiness has to consult the subtree, not just this host.
            // Keep committed effects/blur/A11y independent of acquisition.
            isViewReady: () =>
              viewReady &&
              portalIsCommitted() &&
              !viewDisposed &&
              !rootRef.value?.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
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
            focusIntentState: focusIntentState,
            onFocusIntent: () => {
              focusTargetRetryCount = 0;
              focusRetryGeneration += 1;
              focusTargetRetryScheduled = false;
            },
            onFocusPendingReleased: () => {
              focusRetryGeneration += 1;
              focusTargetRetryScheduled = false;
              const release = releaseRequestedTargetReady;
              releaseRequestedTargetReady = undefined;
              release?.();
            },
            onFocusAcquired: () => {
              focusTargetRetryCount = 0;
              // Completion retires queued work for this intent in the current view.
              focusRetryGeneration += 1;
              focusTargetRetryScheduled = false;
              releaseRequestedTargetReady?.();
              releaseRequestedTargetReady = undefined;
            },
            getCurrentElement: () => rootRef.value,
            subscribeTargetReady: (listener) => {
              focusTargetReadyListeners.add(listener);
              return () => focusTargetReadyListeners.delete(listener);
            },
            retryTargetReady: () => {
              if (focusTargetRetryScheduled || focusTargetRetryCount >= MAX_FOCUS_TARGET_RETRIES) {
                return;
              }
              focusTargetRetryScheduled = true;
              focusTargetRetryCount += 1;
              const generation = focusRetryGeneration;
              scheduleAfterWebLayout(
                rootRef.value,
                () => {
                  if (viewDisposed || generation !== focusRetryGeneration) return;
                  focusTargetRetryScheduled = false;
                  notifyFocusTargetReady();
                },
                schedule
              );
            },
            overlayLayerScheduler,
          });

          hostSession = owner.attachView({
            modules,
            disposeView,
            isViewAdmitted: () =>
              !viewDisposed &&
              rootRef.value === rootEl &&
              rootEl.isConnected &&
              !rootEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
            createSession: (wiring) => createHostSession(wiring, 'eager'),
          });

          controllerRef.value = hostSession.controller as RuntimeController;
          invokeRef.value = hostSession.invokeInCallbackScope;

          const { kernel } = hostSession;
          if (kernel && kernel.run) {
            (kernel.run as any).host = { get: () => rootRef.value };
          }
          releaseNativeReadiness.publish();
        };

        runtime.onMounted(() => {
          const rootEl = rootRef.value;
          if (rootEl) installViewVisibilityRule(rootEl.ownerDocument);
          // A detached host is mounted now, so reaching this hook no longer
          // means the view should attach. Leave that to the presence watcher,
          // or the first real open finds `lastInitRoot` already claimed.
          if (shouldExist.value) initSession();
          runtime.nextTick().then(notifyFocusTargetReady);
        });
        runtime.onUpdated?.(() => {
          const target = rootRef.value;
          if (!viewReady || !target?.isConnected) return;
          notifyFocusTargetReady();
          runtime.nextTick().then(() => {
            if (rootRef.value === target) notifyFocusTargetReady();
          });
        });
        runtime.onDeactivated?.(() => {
          viewReady = false;
          rootRef.value?.setAttribute(PUI_VIEW_PENDING_ATTR, '');
          try {
            if (owner.hasView) return owner.detachView();
          } finally {
            if (!owner.hasView) lastInitRoot = null;
          }
        });
        runtime.onActivated?.(() => {
          runtime.nextTick().then(initSession);
        });

        runtime.watch(
          () => shouldExist.value,
          async (val: boolean) => {
            if (val) {
              viewReady = false;
              await runtime.nextTick();
              initSession();
            } else {
              eventGateRef.value?.disable?.();
              try {
                if (owner.hasView) return owner.detachView();
              } finally {
                // Release errors must not strand the retained host's init marker.
                // A synchronously attached replacement owns its own bookkeeping.
                if (!owner.hasView) {
                  lastInitRoot = null;
                  if (!shouldExist.value) {
                    hostTokens.value = [];
                    viewReady = false;
                  }
                }
              }
            }
          },
          { flush: 'post' }
        );

        runtime.watch(
          rootRef,
          () => {
            if (!shouldExist.value) return;
            const currentRoot = rootRef.value;
            if (currentRoot && currentRoot !== lastInitRoot) {
              runtime.nextTick().then(() => {
                if (rootRef.value === currentRoot && shouldExist.value) {
                  initSession();
                }
              });
            }
          },
          { flush: 'post' }
        );

        runtime.onBeforeUnmount(() => {
          try {
            // Vue observes rejected lifecycle promises through errorHandler.
            return owner.dispose();
          } finally {
            lastInitRoot = null;
          }
        });

        return () => {
          const present = shouldExist.value;
          const overlayPort = owner.session?.caps.getPort<OverlayPort>('overlay');
          // Overlay content is detached, not unmounted, when it is not present:
          // the host element and the authored children stay put so collection
          // members keep registering, and the shared detached rule takes them
          // out of paint, a11y, and tab order. Prototypes that drive presence
          // directly through `lifecycle.setPresent`, such as Tabs Content, keep
          // unmounting.
          const detached = !present && overlayPort?.hasPresenceBinding() === true;
          if (!present && !detached) return null;

          const slotNodes = ctx.slots.default ? ctx.slots.default() : null;
          // Without a view there is no template to place the slot into, so the
          // authored children stand in for it.
          const rendered = present
            ? renderTemplateToVue(runtime, renderChildren.value, {
                slot: slotNodes as any,
                decoration: renderDecoration,
              })
            : slotNodes;

          const content = runtime.h(
            rootTag,
            {
              // Native VNode hooks retain post-commit reconciliation when the
              // optional component-updated hook is absent, including renders
              // whose root, origin, presence and destination refs are unchanged.
              ...(runtime.onUpdated
                ? {}
                : {
                    onVnodeMounted: refreshPortalDestination,
                    onVnodeUpdated: refreshPortalDestination,
                    onVnodeUnmounted: refreshPortalDestination,
                  }),
              ref: (el: HTMLElement | null) => {
                rootRef.value = el;
                // Marker-first portals acquire their first root after onMounted.
                if (el) installViewVisibilityRule(el.ownerDocument);
              },
              class: mergeHostClass([props.surfaceClass, props.hostClass, ctx.attrs.class]),
              style: mergeHostStyle([props.surfaceStyle, props.hostStyle, ctx.attrs.style]),
              dir: ctx.attrs.dir ?? props.dir,
              'data-pui-root': '',
              [PUI_VIEW_DETACHED_ATTR]: detached ? '' : undefined,
              [PUI_VIEW_PENDING_ATTR]:
                viewReady && revealedGate !== null && revealedGate === eventGateRef.value
                  ? undefined
                  : '',
              ...(createVisualSink
                ? {}
                : { 'data-pui-style': serializeStyleTokens(hostTokens.value) }),
              'data-demo-ref': ctx.attrs['data-demo-ref'] as string | undefined,
            },
            rendered as any
          );
          if (present && overlayPort?.getConfig().portal === true && runtime.Teleport) {
            // A selector target is resolved by Vue's renderer document, which
            // may differ from a same-origin iframe author tree. Commit the
            // origin first when needed, then use its actual Document's body.
            const target =
              portalDestination.value ??
              portalOriginRef.value?.ownerDocument.body ??
              rootRef.value?.ownerDocument.body;
            const portal = target ? runtime.h(runtime.Teleport, { to: target }, [content]) : null;
            const children = [
              runtime.h('span', {
                ref: (el: HTMLElement | null) => {
                  portalOriginRef.value = el;
                },
                hidden: true,
                'aria-hidden': true,
                'data-pui-portal-origin': '',
              }),
              portal,
            ];
            // Vue normalizes array roots into a Fragment even when the optional
            // Fragment export is not supplied to the Adapter runtime.
            return runtime.Fragment ? runtime.h(runtime.Fragment, null, children) : children;
          }
          return content;
        };
      },
    }) as ProtoVueComponent<TProto>;

    return Component;
  };
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
