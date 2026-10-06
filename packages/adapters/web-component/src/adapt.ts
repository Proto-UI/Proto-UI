// packages/adapters/web-component/src/adapt.ts
import {
  getModuleDeclaration,
  type Prototype,
  type ScrollProjectionPreference,
} from '@proto.ui/core';
import { PropsBaseType } from '@proto.ui/types';

import { type RawPropsSource } from '@proto.ui/module-props';
import type { AnatomyPort } from '@proto.ui/module-anatomy';

import {
  createHostWiring,
  createHostSurfaceProjection,
  createEventGate,
  createDefaultWebColorSchemeSource,
  createDefaultWebPreferenceSource,
  createDefaultWebStyleSupportSource,
  createScopedExposesReader,
  createWebProtoEventRouter,
  createViewEpochOwner,
  scheduleAfterWebLayout,
  type HostSurfaceProjection,
  type LogicalInstanceToken,
  type ProtoAdapterProps,
} from '@proto.ui/adapter-base';
import {
  createZIndexOverlayLayerScheduler,
  type OverlayLayerScheduler,
  type OverlayZIndexLayerSchedulerOptions,
} from '@proto.ui/module-overlay';
import {
  resolveWebTextControlLocalName,
  TEXT_CONTROL_DECLARATION,
  type WebTextControl,
} from '@proto.ui/module-text-control';
import { IMAGE_VIEW_DECLARATION, resolveWebImageLocalName } from '@proto.ui/module-image-view';

import {
  bindController,
  bindElementSurfaceProjection,
  getElementProps,
  getElementAssociations,
  setElementProps,
  unbindController,
} from './props';
import { createOwnedVisualSurface } from './visual-surface';
import { SlotProjector } from './slot-projector';
import { createOwnedTwTokenApplier } from './feedback-style';
import { installDebugHooks, removeDebugHooks } from './debug/hooks';
import {
  installDefaultHostDisplay,
  PUI_VIEW_DETACHED_ATTR,
  type HostDisplayController,
} from './host-display';
import { createDefaultMetaGetter } from './platform/meta';
import {
  createLogicalInstance,
  bindLogicalEventTarget,
  resolveLogicalTriggerEventRouteForTarget,
  getLogicalParent,
  getLogicalRoot,
  markProtoInstance,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  subscribeFocusTargetOwnerReady,
  setProtoParent,
  unbindProtoInstance,
  unbindLogicalEventTarget,
} from './platform/instance-tree';
import { createWebEffectsPort } from './runtime/effects-port';
import { getExperimentalVisualConsumer } from './runtime/experimental-visual-consumer';
import {
  OWNED_MATERIAL_ID,
  createOwnedMaterialBinding,
} from '@proto.ui/module-feedback/internal/owned-slot';
import { createOpaqueMaterialVisualSink } from './material/owned-texture-sink';
import {
  createWebComponentModules,
  createWebComponentOwnerModules,
  type FocusIntentState,
} from './runtime/modules';
import { createWebComponentHostSession } from './runtime/session';
import type { WebComponentAdapterConstructor } from './types';
import type {
  RuntimeCheckpoint,
  RuntimeController,
  RuntimeLifecycleEvent,
} from '@proto.ui/runtime';

export { __WC_DEBUG_SYS } from './debug/hooks';
export type {
  WebComponentAdapterConstructor,
  WebComponentAdapterHandle,
  WebComponentAdapterElement,
} from './types';

function assertKebabCase(tag: string) {
  if (!tag.includes('-') || tag.toLowerCase() !== tag) {
    throw new Error(`[WC Adapter] custom element name must be kebab-case and contain '-': ${tag}`);
  }
}

export interface WebComponentAdapterOptions<Props extends PropsBaseType = PropsBaseType> {
  shadow?: boolean;
  register?: boolean;
  registerAs?: string;
  getProps?: (el: HTMLElement) => Partial<Props> | null | undefined;
  schedule?: (task: () => void) => void;
  getMeta?: (key: string) => unknown;
  diagnostics?: {
    onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
    /** @deprecated Use onLifecycleEvent. */
    onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
  };
  exposeStateWebMode?: {
    allowContinuousAttr?: boolean;
    allowStringVar?: boolean;
  };
  scrollProjection?: ScrollProjectionPreference;
  overlayLayer?:
    | (OverlayZIndexLayerSchedulerOptions & {
        scheduler?: OverlayLayerScheduler;
      })
    | undefined;
}

const SHARED_OVERLAY_LAYER_SCHEDULER = createZIndexOverlayLayerScheduler();
const NOTIFY_FOCUS_TARGET_READY = Symbol('proto-ui.notify-focus-target-ready');

export function AdaptToWebComponent<TProto extends Prototype<any, any>>(
  proto: TProto,
  opt: WebComponentAdapterOptions<ProtoAdapterProps<TProto>> = {}
): WebComponentAdapterConstructor<TProto> {
  type Props = ProtoAdapterProps<TProto>;
  const register = opt.register ?? true;
  const tagName = opt.registerAs ?? proto.name;
  assertKebabCase(tagName);
  const textControl = getModuleDeclaration(proto, TEXT_CONTROL_DECLARATION)?.config;
  const imageView = getModuleDeclaration(proto, IMAGE_VIEW_DECLARATION)?.config;

  const shadow = opt.shadow ?? false;
  const getProps = opt.getProps ?? (() => ({}) as Partial<Props>);
  const schedule = opt.schedule ?? ((task) => queueMicrotask(task));
  const getMeta = opt.getMeta ?? createDefaultMetaGetter();
  const colorSchemeSource = opt.getMeta ? undefined : createDefaultWebColorSchemeSource(getMeta);
  const preferenceSource = opt.getMeta ? undefined : createDefaultWebPreferenceSource(getMeta);
  const styleSupportSource = opt.getMeta ? undefined : createDefaultWebStyleSupportSource(getMeta);
  const exposeStateWebMode = opt.exposeStateWebMode;
  const scrollProjection = opt.scrollProjection;
  const MAX_FOCUS_TARGET_RETRIES = 3;

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
      : SHARED_OVERLAY_LAYER_SCHEDULER);

  class ProtoElement extends HTMLElement {
    private _mountedOnce = false;
    private _terminalDisposing = false;
    private _terminalReconnectRequested = false;
    private _pendingViewCleanup: (() => void) | null = null;
    private _releasePropsObservers: (() => void) | null = null;
    private _terminalCleanupComplete = false;
    private _runtimeGeneration = 0;
    private _instanceToken: LogicalInstanceToken;
    private _invokeUnmounted: (() => void | Promise<void>) | null = null;
    private _disconnectVersion = 0;
    private _pendingOwnedTokens: string[] | null = null;
    private _controller: RuntimeController | null = null;
    private _anatomyPort: AnatomyPort | null = null;
    private _focusTargetReadyListeners = new Set<() => void>();
    private _focusTargetRetryScheduled = false;
    private _focusTargetRetryCount = 0;
    private _focusIntentState: FocusIntentState = {};

    private _root: Element | ShadowRoot;
    private _slotProjector: SlotProjector | null = null;
    private _hostDisplay: HostDisplayController | null = null;
    private _textControlTarget: WebTextControl | null = null;
    private _imageViewTarget: HTMLImageElement | null = null;
    private _surfaceProjection: HostSurfaceProjection<HTMLElement>;

    private _applier: ReturnType<typeof createOwnedTwTokenApplier> | null = null;
    private _exposes: Record<string, unknown> = {};

    constructor() {
      super();
      this._root = shadow ? (this.attachShadow({ mode: 'open' }) as ShadowRoot) : this;
      if (textControl && imageView) {
        throw new Error(
          '[WC Adapter] text-control and image-view declarations cannot share a root.'
        );
      }
      if (textControl) {
        this._textControlTarget = document.createElement(
          resolveWebTextControlLocalName(textControl)
        );
        this._textControlTarget.setAttribute('part', 'control');
      }
      if (imageView) {
        this._imageViewTarget = document.createElement(resolveWebImageLocalName());
        this._imageViewTarget.setAttribute('part', 'image');
      }
      this._surfaceProjection = createHostSurfaceProjection<HTMLElement>(
        this,
        this._textControlTarget ?? this._imageViewTarget ?? this
      );
      bindElementSurfaceProjection(this, this._surfaceProjection);
      this._instanceToken = createLogicalInstance(proto as Prototype<any>);
      markProtoInstance(this, proto as Prototype<any>, this._instanceToken);
    }

    override focus(options?: FocusOptions): void {
      if (this._textControlTarget) {
        this._textControlTarget.focus(options);
        return;
      }
      super.focus(options);
    }

    override blur(): void {
      if (this._textControlTarget) {
        this._textControlTarget.blur();
        return;
      }
      super.blur();
    }

    static get observedAttributes() {
      return ['instance-associations', 'control-label-ref'];
    }

    attributeChangedCallback(name: string, _previous: string | null, next: string | null) {
      if (next !== null)
        throw new TypeError(
          `[Web Component] ${name} has no instance-association attribute lowering; use setElementAssociations`
        );
    }

    connectedCallback() {
      // A focus observer can reconnect this element while the old owner's
      // cleanup is still using its fields. Start the new owner only afterward.
      if (this._terminalDisposing) {
        this._terminalReconnectRequested = true;
        return;
      }
      if (this.hasAttribute('instance-associations') || this.hasAttribute('control-label-ref')) {
        throw new TypeError(
          '[Web Component] instance-association attributes have no lowering; use setElementAssociations'
        );
      }

      if (this._mountedOnce) {
        const previousParent = getLogicalParent(this._instanceToken);
        const previousRoot = previousParent ? getLogicalRoot(previousParent) : null;
        try {
          // WC ownership follows its current tree, unlike renderer-owned portals.
          setProtoParent(this, null);
          markProtoInstance(this, proto as Prototype<any>, this._instanceToken);
          // Logical membership remains live when either view is detached.
          this._anatomyPort?.syncStructure();
        } catch (error) {
          // Rejected adoption must not commit a new logical domain. The native
          // DOM move is author-owned; reconcile retained membership signatures.
          try {
            setProtoParent(this, previousRoot);
            this._anatomyPort?.syncStructure();
          } catch (rollbackError) {
            throw new AggregateError([error, rollbackError]);
          }
          throw error;
        }
        if (this._pendingOwnedTokens?.length) {
          this._applier?.apply(this._pendingOwnedTokens);
        }
        this._hostDisplay?.sync();
        this._pendingOwnedTokens = null;
        this._controller?.update();
        schedule(() => this[NOTIFY_FOCUS_TARGET_READY]());
        return;
      }
      try {
        this.connectOwner();
      } catch (error) {
        // Keep the initial failure synchronous; cleanup errors cannot replace it.
        // A still-connected failed node is not a request to retry construction.
        void this.retireOwner().catch(() => {});
        throw error;
      }
    }

    private connectOwner() {
      // A fresh logical owner gets a fresh budget; synchronous DOM moves above
      // retain both the request snapshot and its consumed retry allowance.
      this._terminalCleanupComplete = false;
      this._focusIntentState = {};
      this._focusTargetRetryCount = 0;
      if (this._runtimeGeneration > 0) {
        this._instanceToken = createLogicalInstance(proto as Prototype<any>);
      }
      const instanceToken = this._instanceToken;
      // Claim the connection before marker publication can reenter through a
      // real DOM move. That move belongs to this same initializing owner.
      this._runtimeGeneration += 1;
      this._mountedOnce = true;
      // The constructor ran before the element had a DOM parent.
      markProtoInstance(this, proto as Prototype<any>, instanceToken);

      const thisEl = this;
      const thisRoot = this._root;
      thisEl.setAttribute('data-pui-root', '');
      this._hostDisplay = installDefaultHostDisplay(thisEl);

      const propsObservers = new Set<MutationObserver>();
      this._releasePropsObservers = () => {
        for (const observer of propsObservers) observer.disconnect();
        propsObservers.clear();
      };
      const rawPropsSource: RawPropsSource<Props> = {
        debugName: `${tagName}#raw-props`,
        get(): Readonly<Props & PropsBaseType> {
          const p = getElementProps(thisEl) ?? getProps(thisEl) ?? ({} as Partial<Props>);
          return p as unknown as Readonly<Props & PropsBaseType>;
        },
        subscribe(cb) {
          const mo = new MutationObserver((records) => {
            for (const r of records) {
              if (r.type === 'attributes') {
                cb();
                break;
              }
            }
          });

          propsObservers.add(mo);
          mo.observe(thisEl, { attributes: true });
          return () => {
            mo.disconnect();
            propsObservers.delete(mo);
          };
        },
      };

      let runFocusCallbackScope: ((fn: () => void) => void) | null = null;
      const runInCallbackScope = (fn: () => void) => {
        if (runFocusCallbackScope) {
          runFocusCallbackScope(fn);
          return;
        }
        fn();
      };
      const scopedExposesReader = createScopedExposesReader(() => runFocusCallbackScope);
      const setExposes = (record: Record<string, unknown>) => {
        this._exposes = record;
      };

      const owner = createViewEpochOwner<Props>({ prototypeName: tagName });
      // Register terminal ownership before initialize/setup or view callbacks.
      this._invokeUnmounted = () => owner.dispose();
      let currentEventGate: ReturnType<typeof createEventGate> | null = null;
      let focusIngressReady = false;
      let currentRouter: ReturnType<typeof createWebProtoEventRouter> | null = null;

      const clearSlotProjector = () => {
        this._slotProjector?.disconnect();
        this._slotProjector = null;
      };

      const setViewDetached = (detached: boolean) => {
        thisEl.toggleAttribute(PUI_VIEW_DETACHED_ATTR, detached);
        if (detached) return;
        schedule(() => {
          thisEl[NOTIFY_FOCUS_TARGET_READY]();
          for (const descendant of thisEl.querySelectorAll<ProtoElement>('[data-pui-root]')) {
            descendant[NOTIFY_FOCUS_TARGET_READY]?.();
          }
        });
      };

      const releaseRenderedChildren = () => {
        if (shadow) {
          thisRoot.replaceChildren();
          clearSlotProjector();
          return;
        }

        if (this._imageViewTarget?.parentNode) {
          this._imageViewTarget.parentNode.removeChild(this._imageViewTarget);
        }

        const projector = this._slotProjector;
        if (!projector) return;
        const externalChildren = projector.collectSlotPoolBeforeCommit();
        projector.disconnect();
        this._slotProjector = null;
        thisEl.replaceChildren(...externalChildren);
      };

      const createHostSession = (wiring: ReturnType<typeof createHostWiring>) =>
        createWebComponentHostSession({
          proto,
          tagName,
          shadow,
          host: thisEl,
          root: thisRoot,
          schedule,
          rawPropsSource,
          getInstanceAssociations: () => getElementAssociations(thisEl),
          textControlTarget: this._textControlTarget,
          imageViewTarget: this._imageViewTarget,
          wiring,
          eventGate: {
            enable: () => currentEventGate?.enable(),
            disable: () => currentEventGate?.disable(),
            dispose: () => owner.disposeView(),
          },
          router: {
            dispose: () => owner.disposeView(),
          },
          onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
          onLifecycleEvent: (event) => {
            opt.diagnostics?.onLifecycleEvent?.(event);
            if (event.type === 'mount.phase') {
              focusIngressReady = event.phase === 'mounted';
              if (focusIngressReady) this[NOTIFY_FOCUS_TARGET_READY]();
            }
          },
          getSlotProjector: () => this._slotProjector,
          ensureSlotProjector: () => {
            if (!this._slotProjector) this._slotProjector = new SlotProjector(thisEl);
            return this._slotProjector;
          },
          clearSlotProjector,
          onAfterUnmount: () => {
            scopedExposesReader.invalidate();
            runFocusCallbackScope = null;
            this._anatomyPort = null;
            this._exposes = {};
            this._applier?.clear();
            this._applier = null;
            this._hostDisplay?.disconnect();
            this._hostDisplay = null;
            unbindController(this);
            removeDebugHooks(this);
            // This tail releases resources synchronously; the returned dispose
            // promise may still be carrying an error through later microtasks.
            this._terminalCleanupComplete = true;
          },
          initialMount: 'manual',
        });

      const attachView = (initial = false) => {
        if (owner.hasView) {
          setViewDetached(false);
          return;
        }

        let disposed = false;
        let focusRetryGeneration = 0;
        let releaseRequestedTargetReady: (() => void) | undefined;
        let disposeFocusBridge: (() => void) | null = null;
        const resources: {
          eventGate?: ReturnType<typeof createEventGate>;
          router?: ReturnType<typeof createWebProtoEventRouter>;
          applier?: ReturnType<typeof createOwnedTwTokenApplier>;
          nativeReadiness?: ReturnType<typeof registerNativeFocusReadiness>;
        } = {};
        const disposeView = () => {
          if (disposed) return;
          disposed = true;
          const releases = [
            () => resources.eventGate?.disable(),
            () => resources.eventGate?.dispose(),
            () => {
              const release = releaseRequestedTargetReady;
              releaseRequestedTargetReady = undefined;
              release?.();
            },
            () =>
              resources.router &&
              unbindLogicalEventTarget(instanceToken, resources.router.rootTarget),
            () => resources.router?.dispose(),
            () => {
              const release = disposeFocusBridge;
              disposeFocusBridge = null;
              release?.();
            },
            () => resources.applier?.clear(),
            releaseRenderedChildren,
            () => {
              if (currentEventGate === resources.eventGate) {
                currentEventGate = null;
                this._focusTargetRetryScheduled = false;
              }
              if (currentRouter === resources.router) currentRouter = null;
              if (this._applier === resources.applier) this._applier = null;
              this._hostDisplay?.sync();
            },
            // Invalidation can synchronously replay user focus. Release the
            // old view first, and retain that failure after all cleanup.
            () => resources.nativeReadiness?.(),
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
          if (this._pendingViewCleanup === disposeView) this._pendingViewCleanup = null;
          if (failed) throw firstError;
        };
        this._pendingViewCleanup = disposeView;
        try {
          const eventGate = (resources.eventGate = createEventGate());
          const router = (resources.router = createWebProtoEventRouter({
            rootEl: thisEl,
            instanceToken: instanceToken,
            resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
            globalEl: window,
            isEnabled: () => eventGate.isEnabled?.() ?? true,
          }));
          bindLogicalEventTarget(instanceToken, router.rootTarget);
          const applier = (resources.applier = createOwnedTwTokenApplier(
            this._textControlTarget ?? this._imageViewTarget ?? thisEl,
            {
              onChange: () => {
                this._hostDisplay?.sync();
              },
            }
          ));
          currentEventGate = eventGate;
          currentRouter = router;
          this._applier = applier;
          if (this._textControlTarget) {
            // Native focus/blur do not bubble from the physical text control.
            // Route the trusted physical event through the adapter-private host
            // ingress: Proto focus facts update without emitting a second public
            // native-looking event from the custom-element boundary.
            const control: HTMLElement = this._textControlTarget;
            // Bind native focus/blur directly on the known control so the
            // callback receives the real DOM event object with target/currentTarget
            // intact. The private transport preserves both the declared type and
            // the physical event identity without dispatching a second public
            // boundary event.
            const onFocus = (event: FocusEvent) => {
              if (event.target === control) router.dispatchHostRootEvent('focus', event);
            };
            const onBlur = (event: FocusEvent) => {
              if (event.target === control) router.dispatchHostRootEvent('blur', event);
            };
            disposeFocusBridge = () => {
              control.removeEventListener('focus', onFocus);
              control.removeEventListener('blur', onBlur);
            };
            control.addEventListener('focus', onFocus);
            control.addEventListener('blur', onBlur);
          }

          resources.nativeReadiness = registerNativeFocusReadiness(
            instanceToken,
            {
              isReady: () =>
                !disposed &&
                focusIngressReady &&
                eventGate.isEnabled() &&
                thisEl.isConnected &&
                !thisEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
              // Text controls use a physical control target while logical ownership
              // stays on the custom element. Both are roots of this same view.
              getNativeTarget: () => this._textControlTarget ?? thisEl,
              subscribe: (listener) => {
                this._focusTargetReadyListeners.add(listener);
                return () => this._focusTargetReadyListeners.delete(listener);
              },
            },
            { deferPublication: true }
          );

          owner.attachView({
            modules: createWebComponentModules({
              el: thisEl,
              surfaceProjection: this._surfaceProjection,
              instanceToken: instanceToken,
              router,
              rawPropsSource,
              effectsPort: createWebEffectsPort(applier),
              materialBindingFactory: proto.modules?.some(
                (declaration) => declaration.id === OWNED_MATERIAL_ID
              )
                ? createOwnedMaterialBinding
                : undefined,
              finalStyleSink:
                getExperimentalVisualConsumer(proto)?.(
                  thisEl,
                  applier,
                  createOwnedVisualSurface(thisEl, thisRoot)
                ) ??
                (proto.modules?.some((declaration) => declaration.id === OWNED_MATERIAL_ID)
                  ? createOpaqueMaterialVisualSink(thisEl, applier)
                  : undefined),
              getMeta,
              colorSchemeSource,
              preferenceSource,
              styleSupportSource,
              textControlTarget: this._textControlTarget,
              imageViewTarget: this._imageViewTarget,
              exposeStateWebMode,
              scrollProjection,
              setExposes,
              runInCallbackScope,
              isViewReady: () =>
                !disposed && thisEl.isConnected && !thisEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
              isEntryAcquisitionReady: (target) => {
                releaseRequestedTargetReady?.();
                releaseRequestedTargetReady = undefined;
                if (isFocusTargetOwnerReady(target)) return true;
                releaseRequestedTargetReady = subscribeFocusTargetOwnerReady(target, () => {
                  if (disposed) return;
                  releaseRequestedTargetReady?.();
                  releaseRequestedTargetReady = undefined;
                  this[NOTIFY_FOCUS_TARGET_READY]();
                });
                return false;
              },
              subscribeTargetReady: (listener: () => void) => {
                this._focusTargetReadyListeners.add(listener);
                return () => this._focusTargetReadyListeners.delete(listener);
              },
              focusIntentState: this._focusIntentState,
              onFocusIntent: () => {
                this._focusTargetRetryCount = 0;
                focusRetryGeneration += 1;
                this._focusTargetRetryScheduled = false;
              },
              onFocusPendingReleased: () => {
                focusRetryGeneration += 1;
                this._focusTargetRetryScheduled = false;
                const release = releaseRequestedTargetReady;
                releaseRequestedTargetReady = undefined;
                release?.();
              },
              onFocusAcquired: () => {
                this._focusTargetRetryCount = 0;
                // Completion retires queued work for this intent in the current view.
                focusRetryGeneration += 1;
                this._focusTargetRetryScheduled = false;
                releaseRequestedTargetReady?.();
                releaseRequestedTargetReady = undefined;
              },
              retryTargetReady: () => {
                if (
                  this._focusTargetRetryScheduled ||
                  this._focusTargetRetryCount >= MAX_FOCUS_TARGET_RETRIES
                ) {
                  return;
                }
                this._focusTargetRetryScheduled = true;
                this._focusTargetRetryCount += 1;
                const generation = focusRetryGeneration;
                scheduleAfterWebLayout(
                  this,
                  () => {
                    if (disposed || generation !== focusRetryGeneration) return;
                    this._focusTargetRetryScheduled = false;
                    this[NOTIFY_FOCUS_TARGET_READY]();
                  },
                  schedule
                );
              },
              overlayLayerScheduler,
            }),
            disposeView,
            createSession: createHostSession,
          });
        } catch (error) {
          // Initial failure is retired by the guarded connection transaction,
          // so callback reentry cannot race a partly cleaned logical owner.
          if (initial) throw error;
          // Retained remount failure releases the view while preserving its owner.
          try {
            if (owner.hasView) void owner.detachView().catch(() => {});
          } catch {}
          try {
            disposeView();
          } catch {}
          throw error;
        }
        // A retained owner already has its terminal disposer and public binding.
        // Publication failure leaves this fully owned view available for cleanup.
        // The initial connection's enclosing transaction still rolls back on it.
        setViewDetached(false);
        resources.nativeReadiness!.publish();
      };

      let latestIntentVersion = 0;
      let reconciliation = Promise.resolve();
      let initializingOwner = true;
      let initialPresent = true;
      const reconcileIntent = (snapshot: { present: boolean }) => {
        if (initializingOwner) {
          initialPresent = snapshot.present;
          return;
        }
        if (!snapshot.present) setViewDetached(true);
        const requestVersion = ++latestIntentVersion;
        queueMicrotask(() => {
          reconciliation = reconciliation
            .then(async () => {
              if (
                requestVersion !== latestIntentVersion ||
                !thisEl.isConnected ||
                this._controller !== hostSession.controller
              ) {
                return;
              }
              if (snapshot.present) {
                attachView();
              } else if (owner.hasView) {
                await owner.detachView();
              }
            })
            .catch((error) => {
              queueMicrotask(() => {
                throw error;
              });
            });
        });
      };

      const ownerModules = createWebComponentOwnerModules({
        el: thisEl,
        instanceToken: instanceToken,
        rawPropsSource,
        getMeta,
        colorSchemeSource,
        preferenceSource,
        styleSupportSource,
        textControlTarget: this._textControlTarget,
        imageViewTarget: this._imageViewTarget,
        exposeStateWebMode,
        setExposes,
        runInCallbackScope,
        overlayLayerScheduler,
      });
      const hostSession = owner.initialize({
        modules: ownerModules,
        createSession: createHostSession,
        onViewIntent: reconcileIntent,
      });
      initializingOwner = false;
      runFocusCallbackScope = hostSession.invokeInCallbackScope;
      this._anatomyPort = hostSession.caps.getPort<AnatomyPort>('anatomy') ?? null;

      if (initialPresent) attachView(true);
      else setViewDetached(true);

      const { controller, kernel } = hostSession;
      if (kernel && kernel.run) {
        (kernel.run as any).host = { get: () => thisEl };
      }

      installDebugHooks(thisEl, hostSession.caps);

      (this as any).update = () => controller.update();

      (this as any).getExposes = () => {
        if (!this.isConnected) return {};
        return scopedExposesReader.read(this._exposes ?? {});
      };

      (this as unknown as { setProps?(v: Record<string, unknown>): void }).setProps = (
        next: Record<string, unknown>
      ) => {
        setElementProps(thisEl, next);
        controller.update();
      };

      this._controller = controller;
      bindController(this, controller);
    }

    private [NOTIFY_FOCUS_TARGET_READY](): void {
      let failed = false;
      let firstError: unknown;
      for (const listener of Array.from(this._focusTargetReadyListeners)) {
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

    adoptedCallback() {
      // A retained view must reproject against its current document and host capabilities.
      this._controller?.update();
    }

    disconnectedCallback() {
      if (this._terminalDisposing) return;
      this._pendingOwnedTokens = this._applier ? Array.from(this._applier.getOwned()) : null;
      this._applier?.clear();
      this._hostDisplay?.sync();

      const disconnectVersion = ++this._disconnectVersion;

      queueMicrotask(async () => {
        if (this._disconnectVersion !== disconnectVersion) {
          if (this._pendingOwnedTokens?.length) {
            this._applier?.apply(this._pendingOwnedTokens);
          }
          this._hostDisplay?.sync();
          this._pendingOwnedTokens = null;
          return;
        }
        if (this.isConnected) {
          this._pendingOwnedTokens = null;
          return;
        }

        await this.retireOwner();
      });
    }
    private async retireOwner(): Promise<void> {
      if (this._terminalDisposing) return;
      this._terminalDisposing = true;
      this._terminalReconnectRequested = false;
      const token = this._instanceToken;
      const dispose = this._invokeUnmounted;
      this._invokeUnmounted = null;
      const pendingViewCleanup = this._pendingViewCleanup;
      this._pendingViewCleanup = null;
      const releasePropsObservers = this._releasePropsObservers;
      this._releasePropsObservers = null;
      let pending: void | Promise<void>;
      let failed = false;
      let firstError: unknown;
      let cleanupFailed = false;
      let cleanupError: unknown;
      let released = false;
      const releaseTerminal = () => {
        if (released) return;
        released = true;
        const reconnectRequested = this._terminalReconnectRequested;
        this._terminalReconnectRequested = false;
        this._terminalDisposing = false;
        if (reconnectRequested && this.isConnected)
          queueMicrotask(() => {
            if (this.isConnected && !this._mountedOnce && !this._terminalDisposing)
              this.connectedCallback();
          });
      };
      try {
        try {
          pending = dispose?.();
        } catch (error) {
          failed = true;
          firstError = error;
        }
        // Retire the old published owner before awaiting its callback result.
        // Reentrant connects are held until all session cleanup has settled.
        for (const release of [
          () => pendingViewCleanup?.(),
          () => releasePropsObservers?.(),
          () => {
            this._slotProjector?.disconnect();
            this._slotProjector = null;
          },
          () => {
            this._applier?.clear();
            this._applier = null;
          },
          () => {
            this._hostDisplay?.disconnect();
            this._hostDisplay = null;
          },
          () => {
            this._focusTargetReadyListeners.clear();
            this._exposes = {};
          },
          () => unbindController(this),
          () => removeDebugHooks(this),
          () => unbindProtoInstance(token, this),
          () => {
            this._controller = null;
            this._anatomyPort = null;
            this._mountedOnce = false;
            this._pendingOwnedTokens = null;
          },
        ]) {
          try {
            release();
          } catch (error) {
            if (!cleanupFailed) {
              cleanupFailed = true;
              cleanupError = error;
            }
          }
        }
        // Unlock only after both the session tail and this invocation's
        // published-owner cleanup are complete. Normal reconnect stays sync.
        if (this._terminalCleanupComplete) releaseTerminal();
        try {
          await pending!;
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      } finally {
        // Once-only release cannot alter a newer owner while an older error
        // promise completes after an ordinary synchronous reconnect.
        releaseTerminal();
      }
      if (failed) throw firstError;
      if (cleanupFailed) throw cleanupError;
    }
  }

  if (register && !customElements.get(tagName)) {
    customElements.define(tagName, ProtoElement);
  }

  return ProtoElement as unknown as WebComponentAdapterConstructor<TProto>;
}
