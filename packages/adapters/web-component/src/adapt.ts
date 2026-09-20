// packages/adapters/web-component/src/adapt.ts
import {
  getModuleDeclaration,
  type Prototype,
  type ScrollProjectionPreference,
} from '@proto.ui/core';
import { PropsBaseType } from '@proto.ui/types';

import { type RawPropsSource } from '@proto.ui/module-props';

import {
  createHostWiring,
  createHostSurfaceProjection,
  createEventGate,
  createDefaultWebColorSchemeSource,
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
  setElementProps,
  unbindController,
} from './props';
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
  isLogicalEventRouteCandidate,
  markProtoInstance,
  unbindProtoInstance,
  unbindLogicalEventTarget,
} from './platform/instance-tree';
import { createWebEffectsPort } from './runtime/effects-port';
import { createShadowTextControlSurface } from './shadow-text-control-surface';
import {
  createRebindableWebOverlayModal,
  createWebComponentModules,
  createWebComponentOwnerModules,
} from './runtime/modules';
import { createWebComponentHostSession } from './runtime/session';
import { createShadowOwnerShell, type ShadowOwnerShell } from './shadow-owner-shell';
import { normalizeShadowProfile, type WebComponentShadowSplitOptions } from './shadow-profile';
import { createShadowSplitResources, type ShadowSplitResources } from './shadow-split-resources';
import { createShadowSplitEffectsPort } from './shadow-split-effects';
import { createPortalConcealBarrier } from './portal-conceal';
import { adoptWebComponentPortalProjections } from './portal-mount';
import type { WebComponentAdapterConstructor } from './types';
import type {
  RuntimeCheckpoint,
  RuntimeController,
  RuntimeLifecycleEvent,
} from '@proto.ui/runtime';

export { __WC_DEBUG_SYS } from './debug/hooks';
export type { ShadowStyleArtifactV1 } from './shadow-style-artifact';
export type { ShadowColorSchemeSource } from './shadow-color-scheme-environment';
export type { WebComponentShadowSplitOptions } from './shadow-profile';
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
  shadow?: boolean | WebComponentShadowSplitOptions;
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

type RebindableEventTarget = EventTarget & {
  setTarget(target: EventTarget | null): void;
};

function createRebindableEventTarget(): RebindableEventTarget {
  type Registration = {
    type: string;
    listener: EventListenerOrEventListenerObject;
    capture: boolean;
    passive: boolean;
    once: boolean;
    signal?: AbortSignal;
    wrapped: EventListener;
    abort?: () => void;
  };

  let target: EventTarget | null = null;
  const registrations: Registration[] = [];

  const remove = (registration: Registration) => {
    const index = registrations.indexOf(registration);
    if (index < 0) return;
    registrations.splice(index, 1);
    target?.removeEventListener(registration.type, registration.wrapped, registration.capture);
    if (registration.abort) {
      registration.signal?.removeEventListener('abort', registration.abort);
    }
  };

  const bridge = {
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (!listener) return;
      const capture = typeof options === 'boolean' ? options : options?.capture === true;
      if (
        registrations.some(
          (registration) =>
            registration.type === type &&
            registration.listener === listener &&
            registration.capture === capture
        )
      ) {
        return;
      }
      const signal = typeof options === 'boolean' ? undefined : options?.signal;
      if (signal?.aborted) return;
      const registration = {
        type,
        listener,
        capture,
        passive: typeof options === 'boolean' ? false : options?.passive === true,
        once: typeof options === 'boolean' ? false : options?.once === true,
        signal,
      } as Registration;
      registration.wrapped = function (event) {
        if (registration.once) remove(registration);
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
      };
      if (signal) {
        registration.abort = () => remove(registration);
        signal.addEventListener('abort', registration.abort, { once: true });
      }
      registrations.push(registration);
      target?.addEventListener(type, registration.wrapped, {
        capture,
        passive: registration.passive,
      });
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ) {
      if (!listener) return;
      const capture = typeof options === 'boolean' ? options : options?.capture === true;
      const registration = registrations.find(
        (entry) => entry.type === type && entry.listener === listener && entry.capture === capture
      );
      if (registration) remove(registration);
    },
    dispatchEvent(event: Event) {
      return target?.dispatchEvent(event) ?? false;
    },
    setTarget(nextTarget: EventTarget | null) {
      if (target === nextTarget) return;
      if (target) {
        for (const registration of registrations) {
          target.removeEventListener(registration.type, registration.wrapped, registration.capture);
        }
      }
      target = nextTarget;
      if (target) {
        for (const registration of registrations) {
          target.addEventListener(registration.type, registration.wrapped, {
            capture: registration.capture,
            passive: registration.passive,
          });
        }
      }
    },
  };

  return bridge as RebindableEventTarget;
}

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

  const profile = normalizeShadowProfile(opt.shadow);
  const split = typeof profile === 'object' ? profile : null;
  const shadow = profile !== false;
  if (split && imageView) {
    throw new Error('[WC Adapter] shadow split does not support image-view declarations.');
  }
  if (
    split &&
    textControl &&
    !split.styleArtifact.cssText.includes('--pui-split-native-text-recipe: l1;')
  ) {
    throw new Error('[WC Adapter] native text recipe is absent; regenerate the CLI companion.');
  }
  const getProps = opt.getProps ?? (() => ({}) as Partial<Props>);
  const schedule = opt.schedule ?? ((task) => queueMicrotask(task));
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
    private _runtimeGeneration = 0;
    private _instanceToken: LogicalInstanceToken;
    private _invokeUnmounted: (() => void | Promise<void>) | null = null;
    private _splitOwnerDisposing = false;
    private _disconnectVersion = 0;
    private _pendingOwnedTokens: string[] | null = null;
    private _controller: RuntimeController | null = null;
    private _focusTargetReadyListeners = new Set<() => void>();
    private _focusTargetRetryScheduled = false;
    private _focusTargetRetryCount = 0;
    private readonly _getMeta: (key: string) => unknown;
    private _globalEventTarget = createRebindableEventTarget();
    private _overlayModal: ReturnType<typeof createRebindableWebOverlayModal>;

    private _root: Element | ShadowRoot;
    private _shadowOwnerShell: ShadowOwnerShell | null;
    private _splitResources: ShadowSplitResources | null = null;
    private _initializationCleanup: (() => void) | null = null;
    private _portalConceal = createPortalConcealBarrier(this);
    private _slotProjector: SlotProjector | null = null;
    private _hostDisplay: HostDisplayController | null = null;
    private _textControlTarget: WebTextControl | null = null;
    private _imageViewTarget: HTMLImageElement | null = null;
    private _surfaceProjection: HostSurfaceProjection<HTMLElement>;

    private _applier: ReturnType<typeof createOwnedTwTokenApplier> | null = null;
    private _exposes: Record<string, unknown> = {};

    constructor() {
      super();
      this._getMeta = opt.getMeta ?? createDefaultMetaGetter(() => this.ownerDocument);
      this._globalEventTarget.setTarget(this.ownerDocument.defaultView);
      this._overlayModal = createRebindableWebOverlayModal(this.ownerDocument);
      this._root = shadow ? (this.attachShadow({ mode: 'open' }) as ShadowRoot) : this;
      this._shadowOwnerShell = shadow ? createShadowOwnerShell(this._root as ShadowRoot) : null;
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
        split ? null : (this._textControlTarget ?? this._imageViewTarget ?? this)
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

    adoptedCallback(_oldDocument: Document, newDocument: Document) {
      this._portalConceal.cancel();
      adoptWebComponentPortalProjections(this, newDocument);
      this._globalEventTarget.setTarget(newDocument.defaultView);
      this._overlayModal.adoptDocument(newDocument);
      this._splitResources?.environment.adoptDocument(newDocument);
      this._hostDisplay?.sync();
    }

    connectedCallback() {
      // Reuse is valid for synchronous moves, not once terminal teardown starts.
      // The predecessor owns host-wide resources until its complete cleanup;
      // coalesce reconnects and initialize only after it can no longer write.
      if (split && this._splitOwnerDisposing) return;
      const initializing = !this._mountedOnce;
      try {
        this._connectOwner();
      } catch (error) {
        if (split && initializing) {
          // A failed activation is retryable on a later connection, never a half-owner.
          try {
            this._initializationCleanup?.();
          } catch {}
          this._initializationCleanup = null;
          try {
            this._releaseSplitResources();
          } catch {}
          this._hostDisplay?.disconnect();
          this._hostDisplay = null;
          unbindController(this);
          removeDebugHooks(this);
          unbindProtoInstance(this._instanceToken, this);
          this._controller = null;
          this._invokeUnmounted = null;
          this._exposes = {};
          this._mountedOnce = false;
          this.setAttribute(PUI_VIEW_DETACHED_ATTR, '');
        }
        throw error;
      }
    }

    private _releaseSplitResources() {
      const resources = this._splitResources;
      this._splitResources = null;
      try {
        this._surfaceProjection.setSurfaceTarget(null);
      } finally {
        resources?.dispose();
      }
    }

    private _connectOwner() {
      this._globalEventTarget.setTarget(this.ownerDocument.defaultView);
      this._focusTargetRetryCount = 0;

      if (this._mountedOnce) {
        // Refresh the logical parent link after a synchronous DOM move.
        markProtoInstance(this, proto as Prototype<any>, this._instanceToken);
        if (this._pendingOwnedTokens?.length) {
          this._applier?.apply(this._pendingOwnedTokens);
        }
        this._hostDisplay?.sync();
        this._pendingOwnedTokens = null;
        this._controller?.update();
        schedule(() => this[NOTIFY_FOCUS_TARGET_READY]());
        return;
      }
      if (this._runtimeGeneration > 0) {
        this._instanceToken = createLogicalInstance(proto as Prototype<any>);
      }
      // The constructor ran before the element had a DOM parent.
      markProtoInstance(this, proto as Prototype<any>, this._instanceToken);
      this._runtimeGeneration += 1;
      this._mountedOnce = true;

      const thisEl = this;
      const thisRoot = this._root;
      thisEl.setAttribute('data-pui-root', '');
      if (split) {
        this._splitResources = createShadowSplitResources({
          host: thisEl,
          shell: this._shadowOwnerShell!,
          artifact: split.styleArtifact,
          colorSchemeSource: split.colorSchemeSource,
          baseGetMeta: this._getMeta,
          factories: this._textControlTarget
            ? {
                createSurface: (shell) =>
                  createShadowTextControlSurface(shell, this._textControlTarget!),
              }
            : undefined,
        });
        this._splitResources.surface.element.setAttribute(
          'part',
          textControl ? 'control surface' : 'surface'
        );
        this._surfaceProjection.setSurfaceTarget(this._splitResources.surface.element);
      }
      const splitResources = this._splitResources;
      const ownerGetMeta = splitResources?.getMeta ?? this._getMeta;
      // Split reserves colorScheme for its retained environment, not the document getter.
      const colorSchemeSource =
        split || opt.getMeta
          ? undefined
          : createDefaultWebColorSchemeSource(ownerGetMeta, thisEl.ownerDocument);
      const runtimeColorSchemeSource = splitResources
        ? {
            getter: ownerGetMeta,
            subscribe: (listener: () => void) => splitResources.environment.subscribe(listener),
          }
        : colorSchemeSource;
      this._hostDisplay = installDefaultHostDisplay(thisEl, {
        displayOwner: split ? 'presentation' : 'fallback',
      });

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

          mo.observe(thisEl, { attributes: true });
          return () => mo.disconnect();
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
      this._initializationCleanup = () => {
        void owner.dispose().catch(() => {});
      };
      let currentEventGate: ReturnType<typeof createEventGate> | null = null;
      let currentRouter: ReturnType<typeof createWebProtoEventRouter> | null = null;

      const clearSlotProjector = () => {
        this._slotProjector?.disconnect();
        this._slotProjector = null;
      };

      const setViewDetached = (detached: boolean) => {
        thisEl.toggleAttribute(PUI_VIEW_DETACHED_ATTR, detached);
        if (detached) {
          currentEventGate?.disable();
          return;
        }
        schedule(() => {
          if (!thisEl.isConnected || thisEl.hasAttribute(PUI_VIEW_DETACHED_ATTR)) return;
          currentEventGate?.enable();
          thisEl[NOTIFY_FOCUS_TARGET_READY]();
          for (const descendant of thisEl.querySelectorAll<ProtoElement>('[data-pui-root]')) {
            descendant[NOTIFY_FOCUS_TARGET_READY]?.();
          }
        });
      };

      const releaseRenderedChildren = () => {
        if (shadow) {
          if (splitResources) splitResources.surface.clearRenderedChildren();
          else this._shadowOwnerShell?.clearRenderedChildren();
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
          shadowOwnerShell: this._shadowOwnerShell,
          shadowViewTarget: splitResources?.surface,
          schedule,
          rawPropsSource,
          textControlTarget: this._textControlTarget,
          imageViewTarget: this._imageViewTarget,
          wiring,
          eventGate: {
            enable: () => {
              if (!thisEl.hasAttribute(PUI_VIEW_DETACHED_ATTR)) currentEventGate?.enable();
            },
            disable: () => currentEventGate?.disable(),
            dispose: () => owner.disposeView(),
          },
          router: {
            dispose: () => owner.disposeView(),
          },
          onLifecycleCheckpoint: opt.diagnostics?.onLifecycleCheckpoint,
          onLifecycleEvent: opt.diagnostics?.onLifecycleEvent,
          getSlotProjector: () => this._slotProjector,
          ensureSlotProjector: () => {
            if (!this._slotProjector) this._slotProjector = new SlotProjector(thisEl);
            return this._slotProjector;
          },
          clearSlotProjector,
          onAfterUnmount: () => {
            scopedExposesReader.invalidate();
            runFocusCallbackScope = null;
            this._exposes = {};
            this._applier?.clear();
            this._applier = null;
            this._hostDisplay?.disconnect();
            this._hostDisplay = null;
            try {
              if (splitResources && this._splitResources === splitResources)
                this._releaseSplitResources();
            } finally {
              unbindController(this);
              removeDebugHooks(this);
            }
          },
          initialMount: 'manual',
        });

      const attachView = () => {
        if (owner.hasView) {
          setViewDetached(false);
          return;
        }

        if (splitResources && this._textControlTarget)
          splitResources.surface.replaceRenderedChildren([this._textControlTarget]);
        const splitEffects = splitResources
          ? createShadowSplitEffectsPort({
              host: thisEl,
              surface: splitResources.surface.element,
              artifact: splitResources.artifact.artifact,
              prototypeName: proto.name,
            })
          : null;
        const eventGate = createEventGate();
        const router = createWebProtoEventRouter({
          rootEl: thisEl,
          focusEventTarget: this._textControlTarget ?? undefined,
          instanceToken: this._instanceToken,
          resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
          isSemanticEventRouteCandidate: isLogicalEventRouteCandidate,
          globalEl: this._globalEventTarget,
          isEnabled: () => eventGate.isEnabled?.() ?? true,
        });
        bindLogicalEventTarget(this._instanceToken, router.rootTarget);
        const applier = splitEffects
          ? null
          : createOwnedTwTokenApplier(this._textControlTarget ?? this._imageViewTarget ?? thisEl, {
              onChange: () => {
                this._hostDisplay?.sync();
              },
            });
        currentEventGate = eventGate;
        currentRouter = router;
        this._applier = applier;
        // Focus/blur subscriptions bind directly to the physical editor.
        // A second host listener would see Shadow-retargeted focus and could
        // overwrite native :focus-visible with the shell's false result.

        let disposed = false;
        const disposeView = () => {
          if (disposed) return;
          disposed = true;
          eventGate.disable();
          eventGate.dispose();
          unbindLogicalEventTarget(this._instanceToken, router.rootTarget);
          router.dispose();
          applier?.clear();
          splitEffects?.dispose();
          releaseRenderedChildren();
          if (currentEventGate === eventGate) currentEventGate = null;
          if (currentRouter === router) currentRouter = null;
          if (this._applier === applier) this._applier = null;
          this._hostDisplay?.sync();
        };

        try {
          owner.attachView({
            modules: createWebComponentModules({
              el: thisEl,
              instanceToken: this._instanceToken,
              router,
              rawPropsSource,
              effectsPort: splitEffects ?? createWebEffectsPort(applier!),
              getMeta: ownerGetMeta,
              colorSchemeSource: runtimeColorSchemeSource,
              textControlTarget: this._textControlTarget,
              imageViewTarget: this._imageViewTarget,
              overlayModal: this._overlayModal,
              exposeStateWebMode,
              scrollProjection,
              setExposes,
              runInCallbackScope,
              isViewReady: () =>
                thisEl.isConnected && !thisEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
              subscribeTargetReady: (listener: () => void) => {
                this._focusTargetReadyListeners.add(listener);
                return () => this._focusTargetReadyListeners.delete(listener);
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
                scheduleAfterWebLayout(
                  this,
                  () => {
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
          disposeView();
          throw error;
        }
        setViewDetached(false);
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
        const wasConcealing = this._portalConceal.cancel();
        if (!snapshot.present) setViewDetached(true);
        const requestVersion = ++latestIntentVersion;
        if (snapshot.present && wasConcealing && owner.hasView) {
          // The retained epoch never unmounted. Reveal it immediately so a
          // newer open/focus request is not queued behind the canceled barrier.
          setViewDetached(false);
          return;
        }
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
                const conceal = this._portalConceal.wait();
                if (conceal) await conceal;
                if (
                  requestVersion !== latestIntentVersion ||
                  !thisEl.isConnected ||
                  this._controller !== hostSession.controller
                )
                  return;
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
        instanceToken: this._instanceToken,
        rawPropsSource,
        getMeta: ownerGetMeta,
        colorSchemeSource: runtimeColorSchemeSource,
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

      if (initialPresent) attachView();
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

      this._invokeUnmounted = () => owner.dispose();
      this._initializationCleanup = null;
    }

    private [NOTIFY_FOCUS_TARGET_READY](): void {
      for (const listener of Array.from(this._focusTargetReadyListeners)) listener();
      const active = this.ownerDocument.activeElement;
      if (
        active === this ||
        this.contains(active) ||
        (this.shadowRoot?.activeElement ?? null) !== null
      ) {
        this._focusTargetRetryCount = 0;
      }
    }

    disconnectedCallback() {
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

        this._globalEventTarget.setTarget(null);

        if (this._invokeUnmounted) {
          this._portalConceal.cancel();
          const fn = this._invokeUnmounted;
          this._invokeUnmounted = null;
          // Install before invoking user lifecycle callbacks: they may reconnect
          // synchronously, before fn() even returns its disposal promise.
          if (split) this._splitOwnerDisposing = true;
          try {
            let disposed: void | Promise<void>;
            try {
              disposed = fn();
            } finally {
              unbindProtoInstance(this._instanceToken, this);
              this._controller = null;
              this._mountedOnce = false;
              this._pendingOwnedTokens = null;
            }
            await disposed;
          } finally {
            if (split) {
              this._splitOwnerDisposing = false;
              // Keep reconnect failures separate from a rejected disposal, and
              // recheck latest connectivity after repeated remove/append calls.
              queueMicrotask(() => {
                if (this.isConnected && !this._mountedOnce && !this._splitOwnerDisposing)
                  this.connectedCallback();
              });
            }
          }
          return;
        }
        unbindProtoInstance(this._instanceToken, this);
        this._controller = null;
        this._mountedOnce = false;
        this._pendingOwnedTokens = null;
      });
    }
  }

  if (register && !customElements.get(tagName)) {
    customElements.define(tagName, ProtoElement);
  }

  return ProtoElement as unknown as WebComponentAdapterConstructor<TProto>;
}
