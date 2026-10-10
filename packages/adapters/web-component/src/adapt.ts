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
  createRebindableEventTarget,
  createScopedExposesReader,
  createWebProtoEventRouter,
  createViewEpochOwner,
  scheduleAfterWebLayout,
  type EventGate,
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
  bindLogicalParent,
  bindLogicalEventTarget,
  resolveLogicalTriggerEventRouteForTarget,
  isLogicalEventRouteCandidate,
  markProtoInstance,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  subscribeFocusTargetOwnerReady,
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
import { createOwnedVisualSurface } from './visual-surface';
import type { FinalStyleSink } from '@proto.ui/module-feedback/internal/final-style-sink';
import { createShadowTextControlSurface } from './shadow-text-control-surface';
import {
  createRebindableWebOverlayModal,
  createWebComponentModules,
  createWebComponentOwnerModules,
  type FocusIntentState,
} from './runtime/modules';
import { completeCleanup, createWebComponentHostSession } from './runtime/session';
import { createShadowOwnerShell } from './shadow-owner-shell';
import { normalizeShadowProfile, type WebComponentShadowSplitOptions } from './shadow-profile';
import { createShadowSplitResources, type ShadowSplitResources } from './shadow-split-resources';
import {
  createShadowSplitEffectsPort,
  hasVerifiedShadowSplitBaseRecipe,
} from './shadow-split-effects';
import { createPortalConcealBarrier } from './portal-conceal';
import {
  abandonWebComponentPortalProjection,
  adoptWebComponentPortalProjections,
  isWebComponentPortaled,
} from './portal-mount';
import { createRebindableColorSchemeSource } from './color-scheme-source';
import { createRebindableWebKeyedMetaSources } from './keyed-meta-sources';
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
    throw new Error(`custom-element:name:${tag}`);
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
    throw new Error('shadow-split:image-view');
  }
  if (
    split &&
    textControl &&
    !hasVerifiedShadowSplitBaseRecipe(split.styleArtifact, 'native-text', 'l1')
  ) {
    throw new Error('shadow-split:native-text-recipe');
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
    private _terminalDisposing = false;
    private _terminalOwner: LogicalInstanceToken | null = null;
    private _reconnectRequested = false;
    private _disconnectVersion = 0;
    private _pendingOwnedTokens: string[] | null = null;
    private _controller: RuntimeController | null = null;
    private _focusTargetReadyListeners = new Set<() => void>();
    private _focusTargetRetryScheduled = false;
    private _focusTargetRetryCount = 0;
    private _focusIntentState: FocusIntentState = {};
    private _defaultMetaGetter = opt.getMeta
      ? undefined
      : createDefaultMetaGetter(this.ownerDocument);
    private readonly _getMeta = opt.getMeta ?? ((key: string) => this._defaultMetaGetter!(key));
    private _defaultKeyedMetaSources:
      | ReturnType<typeof createRebindableWebKeyedMetaSources>
      | undefined;
    private _defaultColorSchemeSource =
      split || opt.getMeta
        ? undefined
        : createRebindableColorSchemeSource(this._getMeta, this.ownerDocument);
    private _globalEventTarget = createRebindableEventTarget();
    private _overlayModal: ReturnType<typeof createRebindableWebOverlayModal>;

    private _root: Element | ShadowRoot;
    private _splitResources: ShadowSplitResources | null = null;
    private _portalConceal = createPortalConcealBarrier(this);
    private _slotProjector: SlotProjector | null = null;
    private _hostDisplay: HostDisplayController | null = null;
    private _textControlTarget: WebTextControl | null = null;
    private _imageViewTarget: HTMLImageElement | null = null;
    private _surfaceProjection: HostSurfaceProjection<HTMLElement>;
    private readonly _a11yProjection: HostSurfaceProjection<HTMLElement>;

    private _applier: ReturnType<typeof createOwnedTwTokenApplier> | null = null;
    private _exposes: Record<string, unknown> = {};

    constructor() {
      super();
      this._globalEventTarget.setTarget(this.ownerDocument.defaultView);
      this._overlayModal = createRebindableWebOverlayModal(this.ownerDocument);
      this._root = shadow ? (this.attachShadow({ mode: 'open' }) as ShadowRoot) : this;
      if (textControl && imageView) {
        throw new Error('WC:text/image conflict');
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
      // C-HOST-SURFACE-PROJECTION-0001-D: an ordinary split surface only
      // paints. Native controls retain Main's live physical a11y projection;
      // other controls retain their logical trigger/boundary target.
      this._a11yProjection =
        split && !textControl && !imageView
          ? createHostSurfaceProjection<HTMLElement>(this)
          : this._surfaceProjection;
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
      if (!opt.getMeta) this._defaultMetaGetter = createDefaultMetaGetter(newDocument);
      // Adoption detaches the host from its old physical tree before the
      // destination can connect it. Drop that stale logical edge here; a
      // subsequent connection will bind the destination parent. Same-document
      // portal moves deliberately retain their projected logical ownership.
      bindLogicalParent(this._instanceToken, null);
      adoptWebComponentPortalProjections(this, newDocument);
      this._defaultKeyedMetaSources?.adoptDocument(newDocument);
      this._defaultColorSchemeSource?.adoptDocument(newDocument);
      this._globalEventTarget.setTarget(newDocument.defaultView);
      this._overlayModal.adoptDocument(newDocument);
      this._splitResources?.environment.adoptDocument(newDocument);
      this._hostDisplay?.sync();
      this[NOTIFY_FOCUS_TARGET_READY]();
    }

    connectedCallback() {
      // Reuse is valid for synchronous moves, not once terminal teardown starts.
      // The predecessor owns host-wide resources until its complete cleanup;
      // coalesce reconnects and initialize only after it can no longer write.
      if (this._terminalDisposing) {
        this._reconnectRequested = true;
        return;
      }
      const initializing = !this._mountedOnce;
      try {
        this._connectOwner();
      } catch (error) {
        if (initializing) {
          // Only an actual connection during retirement requests a new owner.
          // Merely remaining connected after failed startup does not retry it.
          const dispose = this._invokeUnmounted;
          this._invokeUnmounted = null;
          try {
            const result = dispose?.();
            if (result) void result.catch(() => {});
          } catch {
            /* The supported startup failure wins over secondary cleanup errors. */
          }
        }
        throw error;
      }
    }

    private _beginTerminalDisposal(token: LogicalInstanceToken) {
      if (this._instanceToken !== token || this._terminalOwner === token) return;
      this._terminalOwner = token;
      this._terminalDisposing = true;
      this._reconnectRequested = false;
    }

    private _finishTerminalDisposal(token: LogicalInstanceToken) {
      if (this._terminalOwner !== token) return;
      this._terminalOwner = null;
      this._terminalDisposing = false;
      const reconnect = this._reconnectRequested;
      this._reconnectRequested = false;
      if (reconnect) {
        queueMicrotask(() => {
          if (
            this._instanceToken === token &&
            this.isConnected &&
            !this._mountedOnce &&
            !this._terminalDisposing
          )
            this.connectedCallback();
        });
      }
    }

    private _releaseSplitResources(resources = this._splitResources) {
      if (this._splitResources !== resources) return;
      this._splitResources = null;
      completeCleanup([
        () => this._surfaceProjection.setSurfaceTarget(null),
        () => resources?.dispose(),
      ]);
    }

    private _connectOwner() {
      this._globalEventTarget.setTarget(this.ownerDocument.defaultView);

      if (this._mountedOnce) {
        // Refresh the logical parent link after a synchronous DOM move.
        // Portal ownership is retained in Adapter metadata while parentNode
        // continues to report the physical DOM tree.
        markProtoInstance(
          this,
          proto as Prototype<any>,
          this._instanceToken,
          !isWebComponentPortaled(this)
        );
        if (this._pendingOwnedTokens?.length) {
          this._applier?.apply(this._pendingOwnedTokens);
        }
        this._hostDisplay?.sync();
        this._pendingOwnedTokens = null;
        this._controller?.update();
        const token = this._instanceToken;
        schedule(() => {
          if (this._instanceToken === token && !this._terminalDisposing)
            this[NOTIFY_FOCUS_TARGET_READY]();
        });
        return;
      }
      if (this._runtimeGeneration > 0) {
        // Confirmed terminal teardown ends the predecessor's logical
        // participation. View detach and synchronous moves never reach this
        // branch, so their retained token keeps its existing ancestry.
        this._instanceToken = createLogicalInstance(proto as Prototype<any>);
      }
      this._runtimeGeneration += 1;
      this._mountedOnce = true;
      this._focusTargetRetryCount = 0;
      this._focusTargetRetryScheduled = false;
      this._focusIntentState = {};

      const thisEl = this;
      const thisRoot = this._root;
      const instanceToken = this._instanceToken;
      const owner = createViewEpochOwner<Props>({ prototypeName: tagName });
      let splitResources: ShadowSplitResources | null = null;
      let defaultKeyedMetaSources = this._defaultKeyedMetaSources;
      const propsObservers = new Set<MutationObserver>();
      let runFocusCallbackScope: ((fn: () => void) => void) | null = null;
      const scopedExposesReader = createScopedExposesReader(() => runFocusCallbackScope);
      let currentEventGate: EventGate | null = null;
      let releaseCurrentView: (() => void) | null = null;
      let ownerResourcesReleased = false;
      let runtimeTailFinished = false;
      let terminalStarted = false;
      let terminalReleaseFailed = false;
      let terminalReleaseError: unknown;
      const completeOwnerCleanup = (steps: Array<() => void>) => {
        try {
          completeCleanup(steps);
        } catch (error) {
          if (terminalStarted && !terminalReleaseFailed) {
            terminalReleaseFailed = true;
            terminalReleaseError = error;
          }
          throw error;
        }
      };
      const releaseOwnerResources = () => {
        if (ownerResourcesReleased) return;
        ownerResourcesReleased = true;
        completeOwnerCleanup([
          () => releaseCurrentView?.(),
          () => {
            for (const observer of propsObservers) observer.disconnect();
            propsObservers.clear();
          },
          () => {
            const source = defaultKeyedMetaSources;
            defaultKeyedMetaSources = undefined;
            if (this._defaultKeyedMetaSources === source) this._defaultKeyedMetaSources = undefined;
            source?.dispose();
          },
          () => {
            const display = this._hostDisplay;
            this._hostDisplay = null;
            display?.disconnect();
          },
          () => {
            if (splitResources) this._releaseSplitResources(splitResources);
          },
          () => {
            scopedExposesReader.invalidate();
            runFocusCallbackScope = null;
            this._exposes = {};
            this._focusTargetReadyListeners.clear();
          },
          () => unbindController(this),
          () => removeDebugHooks(this),
        ]);
      };
      const finishOwnerDisposal = () => {
        try {
          releaseOwnerResources();
        } finally {
          this._finishTerminalDisposal(instanceToken);
        }
      };
      let terminalPromise: Promise<void> | null = null;
      this._invokeUnmounted = () => {
        if (terminalStarted) return terminalPromise ?? undefined;
        terminalStarted = true;
        this._beginTerminalDisposal(instanceToken);
        this._invokeUnmounted = null;
        this._portalConceal.cancel();
        let result: Promise<void> = Promise.resolve();
        let completed = false;
        try {
          completeCleanup([
            () => {
              try {
                result = owner.dispose();
              } catch (error) {
                // A synchronous release can precede the Runtime's Promise tail.
                try {
                  result = owner.session?.dispose() ?? result;
                } catch {
                  /* Preserve the first owner release failure. */
                }
                throw error;
              }
              // A host wrapper can transport the owned-view failure through
              // a Promise. Keep its exact synchronous value, even undefined.
              if (terminalReleaseFailed) throw terminalReleaseError;
            },
            () => unbindProtoInstance(instanceToken, thisEl),
            () => bindLogicalParent(instanceToken, null),
            () => {
              if (this._instanceToken !== instanceToken) return;
              this._controller = null;
              this._mountedOnce = false;
              this._pendingOwnedTokens = null;
              this._focusTargetRetryScheduled = false;
              thisEl.setAttribute(PUI_VIEW_DETACHED_ATTR, '');
            },
            () => {
              if (runtimeTailFinished || !owner.session) finishOwnerDisposal();
            },
          ]);
          completed = true;
        } finally {
          terminalPromise = result.then(finishOwnerDisposal, (error) => {
            try {
              finishOwnerDisposal();
            } catch {
              /* The Runtime terminal failure precedes the fallback releases. */
            }
            throw error;
          });
          // Retain the tail before the exact synchronous failure escapes.
          if (!completed) void terminalPromise.catch(() => {});
        }
        return terminalPromise;
      };
      // Claim the owner and its disposer before marker/source publication can
      // replay an outer request or synchronously move this element.
      markProtoInstance(this, proto as Prototype<any>, instanceToken);
      thisEl.setAttribute('data-pui-root', '');
      if (split) {
        splitResources = this._splitResources = createShadowSplitResources({
          host: thisEl,
          shell: createShadowOwnerShell(thisRoot as ShadowRoot),
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
      splitResources = this._splitResources;
      const ownerGetMeta = splitResources?.getMeta ?? this._getMeta;
      defaultKeyedMetaSources = opt.getMeta
        ? undefined
        : createRebindableWebKeyedMetaSources(ownerGetMeta, this.ownerDocument);
      this._defaultKeyedMetaSources = defaultKeyedMetaSources;
      const preferenceSource = defaultKeyedMetaSources?.preferenceSource;
      const styleSupportSource = defaultKeyedMetaSources?.styleSupportSource;
      // Split reserves colorScheme for its retained environment, not the document getter.
      const ownerSplitResources = splitResources;
      const runtimeColorSchemeSource = ownerSplitResources
        ? {
            getter: ownerGetMeta,
            subscribe: (listener: () => void) =>
              ownerSplitResources.environment.subscribe(listener),
          }
        : this._defaultColorSchemeSource;
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
          propsObservers.add(mo);
          return () => {
            propsObservers.delete(mo);
            mo.disconnect();
          };
        },
      };

      const runInCallbackScope = (fn: () => void) => {
        if (runFocusCallbackScope) {
          runFocusCallbackScope(fn);
          return;
        }
        fn();
      };
      const setExposes = (record: Record<string, unknown>) => {
        if (terminalStarted) return;
        this._exposes = record;
      };
      const subscribeTargetReady = (listener: () => void) => {
        this._focusTargetReadyListeners.add(listener);
        return () => this._focusTargetReadyListeners.delete(listener);
      };

      const clearSlotProjector = () => {
        const projector = this._slotProjector;
        this._slotProjector = null;
        projector?.disconnect();
      };

      const setViewDetached = (detached: boolean) => {
        thisEl.toggleAttribute(PUI_VIEW_DETACHED_ATTR, detached);
        if (detached) {
          currentEventGate?.disable();
          return;
        }
        schedule(() => {
          if (
            terminalStarted ||
            this._instanceToken !== instanceToken ||
            !thisEl.isConnected ||
            thisEl.hasAttribute(PUI_VIEW_DETACHED_ATTR)
          )
            return;
          currentEventGate?.enable();
          completeCleanup([
            () => thisEl[NOTIFY_FOCUS_TARGET_READY](),
            ...Array.from(
              thisEl.querySelectorAll<ProtoElement>('[data-pui-root]'),
              (descendant) => () => descendant[NOTIFY_FOCUS_TARGET_READY]?.()
            ),
          ]);
        });
      };

      const releaseRenderedChildren = () => {
        if (shadow) {
          completeCleanup([
            () => {
              if (splitResources) splitResources.surface.clearRenderedChildren();
              else thisRoot.replaceChildren();
            },
            clearSlotProjector,
          ]);
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
          shadowViewTarget: splitResources?.surface,
          schedule,
          rawPropsSource,
          textControlTarget: this._textControlTarget,
          imageViewTarget: this._imageViewTarget,
          wiring,
          eventGate: {
            enable: () => {
              if (!terminalStarted && !thisEl.hasAttribute(PUI_VIEW_DETACHED_ATTR))
                currentEventGate?.enable();
            },
            disable: () => currentEventGate?.disable(),
            dispose: owner.disposeView,
          },
          router: {
            dispose: owner.disposeView,
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
            try {
              releaseOwnerResources();
            } finally {
              runtimeTailFinished = true;
            }
          },
          initialMount: 'manual',
        });

      const attachView = () => {
        if (terminalStarted) return;
        if (owner.hasView) {
          setViewDetached(false);
          return;
        }

        // The Adapter acquires the sink before capability attachment can fail.
        // Both Feedback and rollback retire the same lease, including before
        // any frame exists. Mark it retired before calling user cleanup.
        let finalStyleSink: FinalStyleSink | undefined;
        let sinkReleased = false;
        let sinkView = 0;
        const releaseSink = (view = sinkView) => {
          if (sinkReleased || !finalStyleSink) return;
          sinkReleased = true;
          finalStyleSink.release(view);
        };
        let disposed = false;
        let viewReady = false;
        let focusRetryGeneration = 0;
        let releaseRequestedTargetReady: (() => void) | undefined;
        const releaseRequestedReadiness = () => {
          const release = releaseRequestedTargetReady;
          releaseRequestedTargetReady = undefined;
          release?.();
        };
        const resetFocusRetry = () => {
          this._focusTargetRetryCount = 0;
          focusRetryGeneration += 1;
          this._focusTargetRetryScheduled = false;
          releaseRequestedReadiness();
        };
        const releases: Array<() => void> = [];
        let releaseNativeReadiness: (() => void) | undefined;
        const disposeView = () => {
          if (disposed) return;
          disposed = true;
          viewReady = false;
          focusRetryGeneration += 1;
          if (releaseCurrentView === disposeView) releaseCurrentView = null;
          completeOwnerCleanup([
            releaseSink,
            releaseRequestedReadiness,
            ...releases,
            releaseRenderedChildren,
            () => this._hostDisplay?.sync(),
            // Publish invalidation after the old route and children are gone.
            () => releaseNativeReadiness?.(),
          ]);
        };
        // Retain the view lease before a factory can invoke supported callbacks.
        // A factory throwing before it returns still owns its internal resources.
        releaseCurrentView = disposeView;

        let publishReadiness: (() => void) | undefined;
        try {
          const eventGate = createEventGate();
          currentEventGate = eventGate;
          releases.push(eventGate.disable, eventGate.dispose, () => {
            if (currentEventGate !== eventGate) return;
            currentEventGate = null;
            this._focusTargetRetryScheduled = false;
          });
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
          if (splitEffects) releases.push(() => splitEffects.dispose());
          const router = createWebProtoEventRouter({
            rootEl: thisEl,
            focusEventTarget: this._textControlTarget ?? undefined,
            instanceToken,
            resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
            isSemanticEventRouteCandidate: isLogicalEventRouteCandidate,
            globalEl: this._globalEventTarget,
            isEnabled: () => eventGate.isEnabled(),
          });
          releases.push(
            () => unbindLogicalEventTarget(instanceToken, router.rootTarget),
            router.dispose
          );
          bindLogicalEventTarget(instanceToken, router.rootTarget);
          const applier = splitEffects
            ? null
            : createOwnedTwTokenApplier(
                this._textControlTarget ?? this._imageViewTarget ?? thisEl,
                {
                  onChange: () => this._hostDisplay?.sync(),
                }
              );
          this._applier = applier;
          if (applier)
            releases.push(() => {
              if (this._applier === applier) this._applier = null;
              applier.clear();
            });
          // Observe focus only at the physical editor, not its retargeted shell.
          finalStyleSink = applier
            ? (getExperimentalVisualConsumer(proto)?.(
                thisEl,
                applier,
                createOwnedVisualSurface(thisEl, thisRoot)
              ) ??
              (proto.modules?.some((declaration) => declaration.id === OWNED_MATERIAL_ID)
                ? createOpaqueMaterialVisualSink(thisEl, applier)
                : undefined))
            : undefined;
          const readiness = registerNativeFocusReadiness(
            instanceToken,
            {
              isReady: () =>
                !disposed &&
                !terminalStarted &&
                !this._terminalDisposing &&
                viewReady &&
                this._instanceToken === instanceToken &&
                currentEventGate === eventGate &&
                eventGate.isEnabled() &&
                thisEl.isConnected &&
                !thisEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
              getNativeTarget: () => this._textControlTarget,
              subscribe: subscribeTargetReady,
            },
            { deferPublication: true }
          );
          releaseNativeReadiness = readiness;
          publishReadiness = readiness.publish;
          owner.attachView({
            modules: createWebComponentModules({
              el: thisEl,
              surfaceProjection: this._a11yProjection,
              instanceToken,
              router,
              rawPropsSource,
              effectsPort: splitEffects ?? createWebEffectsPort(applier!),
              materialBindingFactory:
                applier &&
                proto.modules?.some((declaration) => declaration.id === OWNED_MATERIAL_ID)
                  ? createOwnedMaterialBinding
                  : undefined,
              finalStyleSink: finalStyleSink
                ? {
                    commit(frame) {
                      if (sinkReleased) throw new Error('Retired material visual sink');
                      sinkView = frame.view;
                      finalStyleSink!.commit(frame);
                    },
                    release: releaseSink,
                  }
                : undefined,
              getMeta: ownerGetMeta,
              colorSchemeSource: runtimeColorSchemeSource,
              preferenceSource,
              styleSupportSource,
              textControlTarget: this._textControlTarget,
              imageViewTarget: this._imageViewTarget,
              overlayModal: this._overlayModal,
              exposeStateWebMode,
              scrollProjection,
              setExposes,
              runInCallbackScope,
              isViewReady: () =>
                !disposed &&
                !terminalStarted &&
                thisEl.isConnected &&
                !thisEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
              isEntryAcquisitionReady: (target) => {
                releaseRequestedReadiness();
                if (isFocusTargetOwnerReady(target)) return true;
                releaseRequestedTargetReady = subscribeFocusTargetOwnerReady(target, () => {
                  if (disposed || terminalStarted) return;
                  releaseRequestedReadiness();
                  this[NOTIFY_FOCUS_TARGET_READY]();
                });
                return false;
              },
              focusIntentState: this._focusIntentState,
              onFocusIntent: resetFocusRetry,
              onFocusPendingReleased: () => {
                focusRetryGeneration += 1;
                this._focusTargetRetryScheduled = false;
                releaseRequestedReadiness();
              },
              onFocusAcquired: resetFocusRetry,
              subscribeTargetReady,
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
                    if (disposed || terminalStarted || generation !== focusRetryGeneration) return;
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
          viewReady = true;
        } catch (error) {
          try {
            disposeView();
          } catch {
            /* Preserve the attachment failure after retiring its resources. */
          }
          throw error;
        }
        setViewDetached(false);
        publishReadiness?.();
      };

      let latestIntentVersion = 0;
      let reconciliation = Promise.resolve();
      let initializingOwner = true;
      let initialPresent = true;
      const reconcileIntent = (snapshot: { present: boolean }) => {
        if (terminalStarted) return;
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
                terminalStarted ||
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
                  terminalStarted ||
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
        instanceToken,
        rawPropsSource,
        getMeta: ownerGetMeta,
        colorSchemeSource: runtimeColorSchemeSource,
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
    }

    private [NOTIFY_FOCUS_TARGET_READY](): void {
      if (this._terminalDisposing) return;
      completeCleanup(Array.from(this._focusTargetReadyListeners));
    }

    disconnectedCallback() {
      this._pendingOwnedTokens = this._applier ? Array.from(this._applier.getOwned()) : null;
      this._applier?.clear();
      this._hostDisplay?.sync();

      const disconnectVersion = ++this._disconnectVersion;
      const instanceToken = this._instanceToken;

      queueMicrotask(async () => {
        if (this._instanceToken !== instanceToken) return;
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
          this._beginTerminalDisposal(instanceToken);
          let disposed: Promise<void> | undefined;
          try {
            completeCleanup([
              () => abandonWebComponentPortalProjection(this),
              () => {
                disposed = fn() || undefined;
              },
            ]);
          } catch (error) {
            // A synchronous projection failure remains primary while the
            // captured Runtime owner completes its independent terminal tail.
            if (disposed) void disposed.catch(() => {});
            throw error;
          } finally {
            // Only the captured disposer unlocks its owner after actual cleanup;
            // an unrelated old error transport cannot unlock a newer owner.
            if (this._instanceToken === instanceToken && this._mountedOnce) {
              completeCleanup([
                () => unbindProtoInstance(instanceToken, this),
                () => bindLogicalParent(instanceToken, null),
                () => {
                  this._controller = null;
                  this._mountedOnce = false;
                  this._pendingOwnedTokens = null;
                },
              ]);
            }
          }
          await disposed;
          return;
        }
        if (this._terminalDisposing) return;
        unbindProtoInstance(instanceToken, this);
        bindLogicalParent(instanceToken, null);
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
