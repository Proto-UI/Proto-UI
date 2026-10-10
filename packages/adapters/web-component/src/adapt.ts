import {
  NATIVE_LINK_DECLARATION,
  resolveWebNativeLinkLocalName,
} from '@proto.ui/module-native-link';
import type { EffectsPort } from '@proto.ui/core';
import {
  createRootStyleEffect,
  readRootStyleEntries,
  type RootStyleEntry,
} from '@proto.ui/core/internal';
import type { FinalStyleSink } from '@proto.ui/module-feedback/internal/final-style-sink';
import {
  createDeferredViewVisualSink,
  type VisualFeedbackFrame,
  type VisualFeedbackSink,
} from '@proto.ui/module-feedback';
// packages/adapters/web-component/src/adapt.ts
import {
  getModuleDeclaration,
  type Prototype,
  type ScrollProjectionPreference,
} from '@proto.ui/core';
import { PropsBaseType } from '@proto.ui/types';

import type { AnatomyPort } from '@proto.ui/module-anatomy';
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
import { createOwnedVisualSurface, isOwnedVisualNode } from './visual-surface';
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
  getLogicalParent,
  getLogicalRoot,
  setProtoParent,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  subscribeFocusTargetOwnerReady,
  markProtoInstance,
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

import { createShadowTextControlSurface } from './shadow-text-control-surface';
import {
  createRebindableWebOverlayModal,
  createWebComponentModules,
  createWebComponentOwnerModules,
  type FocusIntentState,
} from './runtime/modules';
import { createWebComponentHostSession } from './runtime/session';
import { createShadowOwnerShell } from './shadow-owner-shell';
import { normalizeShadowProfile, type WebComponentShadowSplitOptions } from './shadow-profile';
import { createShadowSplitResources, type ShadowSplitResources } from './shadow-split-resources';
import {
  createShadowSplitEffectsPort,
  hasVerifiedShadowSplitBaseRecipe,
} from './shadow-split-effects';
import { createPortalConcealBarrier } from './portal-conceal';
import { adoptWebComponentPortalProjections, isWebComponentPortaled } from './portal-mount';
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
  /** Draft V2 host provider; one fresh sink per physical view. */
  createVisualSink?: (host: HTMLElement, effects: EffectsPort) => VisualFeedbackSink | null;
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
  const nativeLink = getModuleDeclaration(proto, NATIVE_LINK_DECLARATION)?.config;

  const profile = normalizeShadowProfile(opt.shadow);
  const split = typeof profile === 'object' ? profile : null;
  const shadow = profile !== false;
  if (split && nativeLink) throw new Error('shadow-split:native-link unsupported');
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
    private _terminalReconnectRequested = false;
    private _pendingViewCleanup: (() => void) | null = null;
    private _releasePropsObservers: (() => void) | null = null;
    private _terminalCleanupComplete = false;
    private _disconnectVersion = 0;
    private _pendingOwnedTokens: string[] | null = null;
    private _controller: RuntimeController | null = null;
    private _anatomyPort: AnatomyPort | null = null;
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
    private _nativeLinkTarget: HTMLAnchorElement | null = null;
    private _surfaceProjection: HostSurfaceProjection<HTMLElement>;
    private readonly _a11yProjection: HostSurfaceProjection<HTMLElement>;

    private _applier: ReturnType<typeof createOwnedTwTokenApplier> | null = null;
    private _exposes: Record<string, unknown> = {};

    constructor() {
      super();
      this._globalEventTarget.setTarget(this.ownerDocument.defaultView);
      this._overlayModal = createRebindableWebOverlayModal(this.ownerDocument);
      this._root = shadow ? (this.attachShadow({ mode: 'open' }) as ShadowRoot) : this;
      if ([textControl, imageView, nativeLink].filter(Boolean).length > 1) {
        throw new Error('WC:text/image/native-link conflict');
      }
      if (textControl) {
        this._textControlTarget = this.ownerDocument.createElement(
          resolveWebTextControlLocalName(textControl)
        );
        this._textControlTarget.setAttribute('part', 'control');
      }
      if (imageView) {
        this._imageViewTarget = this.ownerDocument.createElement(resolveWebImageLocalName());
        this._imageViewTarget.setAttribute('part', 'image');
      }
      if (nativeLink) {
        this._nativeLinkTarget = this.ownerDocument.createElement(resolveWebNativeLinkLocalName());
        this._nativeLinkTarget.setAttribute('part', 'link');
      }
      this._surfaceProjection = createHostSurfaceProjection<HTMLElement>(
        this,
        split
          ? null
          : (this._textControlTarget ?? this._imageViewTarget ?? this._nativeLinkTarget ?? this)
      );
      // C-HOST-SURFACE-PROJECTION-0001-D: an ordinary split surface only
      // paints. Native controls retain Main's live physical a11y projection;
      // other controls retain their logical trigger/boundary target.
      this._a11yProjection =
        split && !textControl && !imageView && !nativeLink
          ? createHostSurfaceProjection<HTMLElement>(this)
          : this._surfaceProjection;
      bindElementSurfaceProjection(this, this._surfaceProjection);
      this._instanceToken = createLogicalInstance(proto as Prototype<any>);
      markProtoInstance(this, proto as Prototype<any>, this._instanceToken);
    }

    override focus(options?: FocusOptions): void {
      if (this._nativeLinkTarget) {
        this._nativeLinkTarget.focus(options);
        return;
      }
      if (this._textControlTarget) {
        this._textControlTarget.focus(options);
        return;
      }
      super.focus(options);
    }

    override blur(): void {
      if (this._nativeLinkTarget) {
        this._nativeLinkTarget.blur();
        return;
      }
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

    adoptedCallback(_oldDocument?: Document, newDocument: Document = this.ownerDocument) {
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
      this._controller?.update();
      this[NOTIFY_FOCUS_TARGET_READY]();
    }

    connectedCallback() {
      if (this._terminalDisposing) {
        this._terminalReconnectRequested = true;
        return;
      }
      if (this.hasAttribute('instance-associations') || this.hasAttribute('control-label-ref')) {
        throw new TypeError(
          '[Web Component] instance-association attributes have no lowering; use setElementAssociations'
        );
      }
      const initializing = !this._mountedOnce;
      try {
        this._connectOwner();
      } catch (error) {
        // Preserve the synchronous failure; the guarded terminal transaction
        // also owns partial activation and callback reentry for every profile.
        if (initializing) void this.retireOwner().catch(() => {});
        throw error;
      }
    }

    private _releaseSplitResources() {
      const resources = this._splitResources;
      this._splitResources = null;
      if (!resources) return;
      try {
        this._surfaceProjection.setSurfaceTarget(null);
      } finally {
        resources?.dispose();
      }
    }

    private _connectOwner() {
      this._globalEventTarget.setTarget(this.ownerDocument.defaultView);
      if (this._mountedOnce) {
        const previousParent = getLogicalParent(this._instanceToken);
        const previousRoot = previousParent ? getLogicalRoot(previousParent) : null;
        try {
          if (!isWebComponentPortaled(this)) setProtoParent(this, null);
          markProtoInstance(
            this,
            proto as Prototype<any>,
            this._instanceToken,
            !isWebComponentPortaled(this)
          );
          this._anatomyPort?.syncStructure();
        } catch (error) {
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
      this._terminalCleanupComplete = false;
      this._focusIntentState = {};
      this._focusTargetRetryCount = 0;
      if (this._runtimeGeneration > 0) {
        bindLogicalParent(this._instanceToken, null);
        this._instanceToken = createLogicalInstance(proto as Prototype<any>);
      }
      const instanceToken = this._instanceToken;
      // Claim this owner before marker publication can synchronously reenter.
      this._runtimeGeneration += 1;
      this._mountedOnce = true;
      markProtoInstance(this, proto as Prototype<any>, instanceToken);

      const thisEl = this;
      const thisRoot = this._root;
      const nativeLinkTarget = this._nativeLinkTarget;
      let nativeLinkProjectionObserver: MutationObserver | null = null;
      const transferNativeLinkChildren = () => {
        if (!nativeLinkTarget || shadow) return;
        for (const node of Array.from(thisEl.childNodes)) {
          if (node !== nativeLinkTarget && !isOwnedVisualNode(thisEl, node))
            nativeLinkTarget.appendChild(node);
        }
      };
      const mountNativeLink = () => {
        if (!nativeLinkTarget || nativeLinkTarget.parentNode === thisRoot) return;
        transferNativeLinkChildren();
        thisRoot.appendChild(nativeLinkTarget);
        if (!shadow) {
          nativeLinkProjectionObserver = new MutationObserver(transferNativeLinkChildren);
          nativeLinkProjectionObserver.observe(thisEl, { childList: true });
        }
      };
      mountNativeLink();
      thisEl.setAttribute('data-pui-root', '');
      if (split) {
        this._splitResources = createShadowSplitResources({
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
      const splitResources = this._splitResources;
      const ownerGetMeta = splitResources?.getMeta ?? this._getMeta;
      const defaultKeyedMetaSources = opt.getMeta
        ? undefined
        : createRebindableWebKeyedMetaSources(ownerGetMeta, this.ownerDocument);
      this._defaultKeyedMetaSources = defaultKeyedMetaSources;
      const preferenceSource = defaultKeyedMetaSources?.preferenceSource;
      const styleSupportSource = defaultKeyedMetaSources?.styleSupportSource;
      const disposeDefaultKeyedMetaSources = () => {
        defaultKeyedMetaSources?.dispose();
        if (this._defaultKeyedMetaSources === defaultKeyedMetaSources)
          this._defaultKeyedMetaSources = undefined;
      };
      // Split reserves colorScheme for its retained environment, not the document getter.
      const runtimeColorSchemeSource = splitResources
        ? {
            getter: ownerGetMeta,
            subscribe: (listener: () => void) => splitResources.environment.subscribe(listener),
          }
        : this._defaultColorSchemeSource;
      this._hostDisplay = installDefaultHostDisplay(thisEl, {
        displayOwner: split ? 'presentation' : 'fallback',
      });

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
      this._invokeUnmounted = () => {
        try {
          return owner.dispose();
        } finally {
          disposeDefaultKeyedMetaSources();
        }
      };
      let focusIngressReady = false;
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
        const gate = currentEventGate;
        schedule(() => {
          if (
            currentEventGate !== gate ||
            !thisEl.isConnected ||
            thisEl.hasAttribute(PUI_VIEW_DETACHED_ATTR)
          )
            return;
          gate?.enable();
          thisEl[NOTIFY_FOCUS_TARGET_READY]();
          for (const descendant of thisEl.querySelectorAll<ProtoElement>('[data-pui-root]')) {
            descendant[NOTIFY_FOCUS_TARGET_READY]?.();
          }
        });
      };

      const releaseRenderedChildren = () => {
        if (nativeLinkTarget) {
          nativeLinkProjectionObserver?.disconnect();
          nativeLinkProjectionObserver = null;
          if (!shadow) {
            const external =
              this._slotProjector?.collectSlotPoolBeforeCommit() ??
              Array.from(nativeLinkTarget.childNodes);
            clearSlotProjector();
            nativeLinkTarget.replaceChildren();
            nativeLinkTarget.remove();
            thisEl.append(...external);
          } else {
            nativeLinkTarget.replaceChildren();
            nativeLinkTarget.remove();
            clearSlotProjector();
          }
          return;
        }
        if (shadow) {
          if (splitResources) splitResources.surface.clearRenderedChildren();
          else thisRoot.replaceChildren();
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
          root: nativeLinkTarget ?? thisRoot,
          shadowViewTarget: splitResources?.surface,
          schedule,
          rawPropsSource,
          getInstanceAssociations: () => getElementAssociations(thisEl),
          textControlTarget: this._textControlTarget,
          imageViewTarget: this._imageViewTarget,
          wiring,
          eventGate: {
            enable: () => {
              mountNativeLink();
              if (!thisEl.hasAttribute(PUI_VIEW_DETACHED_ATTR)) currentEventGate?.enable();
            },
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
            if (!this._slotProjector)
              this._slotProjector = new SlotProjector(nativeLinkTarget ?? thisEl);
            return this._slotProjector;
          },
          clearSlotProjector,
          onAfterUnmount: () => {
            const releases = [
              () => scopedExposesReader.invalidate(),
              () => {
                runFocusCallbackScope = null;
                this._anatomyPort = null;
                this._exposes = {};
              },
              () => {
                const applier = this._applier;
                this._applier = null;
                applier?.clear();
              },
              () => {
                const display = this._hostDisplay;
                this._hostDisplay = null;
                display?.disconnect();
              },
              () => {
                if (splitResources && this._splitResources === splitResources)
                  this._releaseSplitResources();
              },
              () => unbindController(this),
              () => removeDebugHooks(this),
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
            this._terminalCleanupComplete = true;
            if (failed) throw firstError;
          },
          initialMount: 'manual',
        });

      const attachView = (initial = false) => {
        if (owner.hasView) {
          setViewDetached(false);
          return;
        }

        // Share the acquired final-style lease between Feedback and rollback.
        // Acquisition may succeed before any frame or capability attachment;
        // retire before invoking user cleanup so throwing cleanup is once-only.
        let acquiredFinalStyleSink: FinalStyleSink | undefined;
        let finalStyleSinkReleased = false;
        let finalStyleSinkView = 0;
        const releaseFinalStyleSink = (view = finalStyleSinkView) => {
          if (finalStyleSinkReleased || !acquiredFinalStyleSink) return;
          finalStyleSinkReleased = true;
          acquiredFinalStyleSink.release(view);
        };
        let disposed = false;
        let focusRetryGeneration = 0;
        let disposeFocusBridge: (() => void) | null = null;
        let releaseRequestedTargetReady: (() => void) | undefined;
        const resources: {
          eventGate?: ReturnType<typeof createEventGate>;
          router?: ReturnType<typeof createWebProtoEventRouter>;
          applier?: ReturnType<typeof createOwnedTwTokenApplier>;
          splitEffects?: ReturnType<typeof createShadowSplitEffectsPort>;
          nativeReadiness?: ReturnType<typeof registerNativeFocusReadiness>;
        } = {};
        const disposeView = () => {
          if (disposed) return;
          disposed = true;
          const releases = [
            releaseFinalStyleSink,
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
            () => resources.splitEffects?.dispose(),
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
          if (splitResources && this._textControlTarget)
            splitResources.surface.replaceRenderedChildren([this._textControlTarget]);
          const splitEffects = (resources.splitEffects = splitResources
            ? createShadowSplitEffectsPort({
                host: thisEl,
                surface: splitResources.surface.element,
                artifact: splitResources.artifact.artifact,
                prototypeName: proto.name,
              })
            : undefined);
          const eventGate = (resources.eventGate = createEventGate());
          const router = (resources.router = createWebProtoEventRouter({
            rootEl: thisEl,
            // The eager native bridge owns focus/blur before provider construction.
            // Router subscriptions stay on a private target, avoiding a second
            // Shadow-retargeted host observation of the same physical event.
            focusEventTarget:
              this._textControlTarget || nativeLinkTarget ? new EventTarget() : undefined,
            isSemanticEventRouteCandidate: isLogicalEventRouteCandidate,
            instanceToken: instanceToken,
            resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
            globalEl: this._globalEventTarget,
            isEnabled: () => eventGate.isEnabled?.() ?? true,
          }));
          bindLogicalEventTarget(instanceToken, router.rootTarget);
          let finalStyleEntries: readonly RootStyleEntry[] = [];
          let splitOwnedTokens = new Set<string>();
          const applier = (resources.applier = splitEffects
            ? {
                apply(tokens: string[]) {
                  if (disposed) return;
                  const byToken = new Map(finalStyleEntries.map((entry) => [entry.token, entry]));
                  const entries = tokens.map((token) => {
                    const entry = byToken.get(token);
                    if (!entry) throw new Error(`shadow-split:missing visual provenance:${token}`);
                    return entry;
                  });
                  effectsPort.queueStyle(createRootStyleEffect(entries));
                  effectsPort.requestFlush();
                  splitOwnedTokens = new Set(tokens);
                },
                clear() {
                  splitOwnedTokens.clear();
                  // Terminal cleanup retires effects separately, even if another
                  // release throws. Never write through an already-retired view.
                  if (disposed) return;
                  effectsPort.queueStyle(createRootStyleEffect([]));
                  effectsPort.requestFlush();
                },
                getOwned: () => splitOwnedTokens,
              }
            : createOwnedTwTokenApplier(
                this._textControlTarget ??
                  this._imageViewTarget ??
                  this._nativeLinkTarget ??
                  thisEl,
                {
                  onChange: () => this._hostDisplay?.sync(),
                }
              ));
          currentEventGate = eventGate;
          currentRouter = router;
          // Split owns its role-aware styles across synchronous DOM moves.
          this._applier = splitEffects ? null : applier;
          if (this._textControlTarget || nativeLinkTarget) {
            // Native focus/blur do not bubble from the physical text control.
            // Route the trusted physical event through the adapter-private host
            // ingress: Proto focus facts update without emitting a second public
            // native-looking event from the custom-element boundary.
            const control: HTMLElement = (this._textControlTarget ?? nativeLinkTarget)!;
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
              getNativeTarget: () => this._textControlTarget ?? nativeLinkTarget ?? thisEl,
              subscribe: (listener) => {
                this._focusTargetReadyListeners.add(listener);
                return () => this._focusTargetReadyListeners.delete(listener);
              },
            },
            { deferPublication: true }
          );

          // Rules finish their semantic replacement even when a host sink fails.
          // During acquisition, retain a split admission failure without queuing
          // an observer error, then reject the complete view transaction below.
          // Once acquired, ordinary projection failures keep their usual path.
          let acquiringProjection = true;
          let acquisitionFailed = false;
          let acquisitionError: unknown;
          const project = (action: () => void) => {
            if (acquiringProjection && acquisitionFailed) return;
            try {
              action();
            } catch (error) {
              if (!acquiringProjection) throw error;
              acquisitionFailed = true;
              acquisitionError = error;
            }
          };
          const effectsPort: EffectsPort = splitEffects
            ? {
                queueStyle: (handle) => project(() => splitEffects.queueStyle(handle)),
                requestFlush: () => project(() => splitEffects.requestFlush()),
                flushNow: () => project(() => splitEffects.flushNow?.()),
              }
            : createWebEffectsPort(applier);
          const deferredVisualSink = opt.createVisualSink
            ? createDeferredViewVisualSink(
                () => opt.createVisualSink!(thisEl, effectsPort),
                (frame) => {
                  effectsPort.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
                  effectsPort.requestFlush();
                }
              )
            : undefined;
          // View acquisition installs capabilities and evaluates initial Rules in
          // one synchronous transaction. Intermediate snapshots are not a
          // committed host frame and must not retire a valid server paint lease.
          let pendingVisualFrame: VisualFeedbackFrame | null = null;
          const visualFeedbackSink: VisualFeedbackSink | undefined = deferredVisualSink
            ? {
                commit(frame) {
                  if (acquiringProjection) pendingVisualFrame = frame;
                  else deferredVisualSink.commit(frame);
                },
                release(view) {
                  if (pendingVisualFrame?.view === view) pendingVisualFrame = null;
                  deferredVisualSink.release(view);
                },
              }
            : undefined;
          const visualTarget = thisEl;
          const rawFinalStyleSink = visualFeedbackSink
            ? undefined
            : (getExperimentalVisualConsumer(proto)?.(
                visualTarget,
                applier,
                createOwnedVisualSurface(thisEl, thisRoot)
              ) ??
              (proto.modules?.some((declaration) => declaration.id === OWNED_MATERIAL_ID)
                ? createOpaqueMaterialVisualSink(visualTarget, applier)
                : undefined));
          acquiredFinalStyleSink = rawFinalStyleSink;
          const finalStyleSink: FinalStyleSink | undefined = rawFinalStyleSink
            ? {
                commit(frame) {
                  if (finalStyleSinkReleased) throw new Error('Retired material visual sink');
                  finalStyleSinkView = frame.view;
                  if (splitEffects) {
                    if (!('entries' in frame.style))
                      throw new Error('shadow-split:root-provenance');
                    finalStyleEntries = readRootStyleEntries(
                      { ...frame.style, tokens: [...frame.style.tokens] },
                      'setup'
                    );
                  }
                  rawFinalStyleSink.commit(frame);
                },
                release: releaseFinalStyleSink,
              }
            : undefined;
          owner.attachView({
            modules: createWebComponentModules({
              el: thisEl,
              surfaceProjection: this._a11yProjection,
              instanceToken: instanceToken,
              router,
              rawPropsSource,
              effectsPort,
              visualFeedbackSink,
              materialBindingFactory: proto.modules?.some(
                (declaration) => declaration.id === OWNED_MATERIAL_ID
              )
                ? createOwnedMaterialBinding
                : undefined,
              finalStyleSink,
              getMeta: ownerGetMeta,
              colorSchemeSource: runtimeColorSchemeSource,
              preferenceSource,
              styleSupportSource,
              textControlTarget: this._textControlTarget,
              imageViewTarget: this._imageViewTarget,
              nativeLinkTarget,
              overlayModal: this._overlayModal,
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
          acquiringProjection = false;
          if (acquisitionFailed) throw acquisitionError;
          if (pendingVisualFrame) {
            const frame = pendingVisualFrame;
            pendingVisualFrame = null;
            deferredVisualSink!.commit(frame);
          }
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
        instanceToken,
        rawPropsSource,
        getMeta: ownerGetMeta,
        colorSchemeSource: runtimeColorSchemeSource,
        preferenceSource,
        styleSupportSource,
        textControlTarget: this._textControlTarget,
        imageViewTarget: this._imageViewTarget,
        nativeLinkTarget,
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
          () => this._portalConceal.cancel(),
          () => this._globalEventTarget.setTarget(null),
          () => pendingViewCleanup?.(),
          () => releasePropsObservers?.(),
          () => this._defaultKeyedMetaSources?.dispose(),
          () => this._releaseSplitResources(),
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
          () => bindLogicalParent(token, null),
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
