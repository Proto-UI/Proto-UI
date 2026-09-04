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
  markProtoInstance,
  unbindProtoInstance,
  unbindLogicalEventTarget,
} from './platform/instance-tree';
import { createWebEffectsPort } from './runtime/effects-port';
import { createWebComponentModules, createWebComponentOwnerModules } from './runtime/modules';
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

  const shadow = opt.shadow ?? false;
  const getProps = opt.getProps ?? (() => ({}) as Partial<Props>);
  const schedule = opt.schedule ?? ((task) => queueMicrotask(task));
  const getMeta = opt.getMeta ?? createDefaultMetaGetter();
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
    private _disconnectVersion = 0;
    private _pendingOwnedTokens: string[] | null = null;
    private _controller: RuntimeController | null = null;
    private _focusTargetReadyListeners = new Set<() => void>();
    private _focusTargetRetryScheduled = false;
    private _focusTargetRetryCount = 0;

    private _root: Element | ShadowRoot;
    private _slotProjector: SlotProjector | null = null;
    private _hostDisplay: HostDisplayController | null = null;
    private _textControlTarget: WebTextControl | null = null;
    private _surfaceProjection: HostSurfaceProjection<HTMLElement>;

    private _applier: ReturnType<typeof createOwnedTwTokenApplier> | null = null;
    private _exposes: Record<string, unknown> = {};

    constructor() {
      super();
      this._root = shadow ? (this.attachShadow({ mode: 'open' }) as ShadowRoot) : this;
      if (textControl) {
        this._textControlTarget = document.createElement(
          resolveWebTextControlLocalName(textControl)
        );
        this._textControlTarget.setAttribute('part', 'control');
      }
      this._surfaceProjection = createHostSurfaceProjection<HTMLElement>(
        this,
        this._textControlTarget ?? this
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

    connectedCallback() {
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
      this._hostDisplay = installDefaultHostDisplay(thisEl);

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
      let currentEventGate: ReturnType<typeof createEventGate> | null = null;
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
          textControlTarget: this._textControlTarget,
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
            unbindController(this);
            removeDebugHooks(this);
          },
          initialMount: 'manual',
        });

      const attachView = () => {
        if (owner.hasView) {
          setViewDetached(false);
          return;
        }

        const eventGate = createEventGate();
        const router = createWebProtoEventRouter({
          rootEl: thisEl,
          instanceToken: this._instanceToken,
          resolveSemanticEventRoute: resolveLogicalTriggerEventRouteForTarget,
          globalEl: window,
          isEnabled: () => eventGate.isEnabled?.() ?? true,
        });
        bindLogicalEventTarget(this._instanceToken, router.rootTarget);
        const applier = createOwnedTwTokenApplier(this._textControlTarget ?? thisEl, {
          onChange: () => {
            this._hostDisplay?.sync();
          },
        });
        currentEventGate = eventGate;
        currentRouter = router;
        this._applier = applier;
        let disposeFocusBridge: (() => void) | null = null;
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
          control.addEventListener('focus', onFocus);
          control.addEventListener('blur', onBlur);
          disposeFocusBridge = () => {
            control.removeEventListener('focus', onFocus);
            control.removeEventListener('blur', onBlur);
          };
        }

        let disposed = false;
        const disposeView = () => {
          if (disposed) return;
          disposed = true;
          eventGate.disable();
          eventGate.dispose();
          unbindLogicalEventTarget(this._instanceToken, router.rootTarget);
          router.dispose();
          disposeFocusBridge?.();
          disposeFocusBridge = null;
          applier.clear();
          releaseRenderedChildren();
          if (currentEventGate === eventGate) currentEventGate = null;
          if (currentRouter === router) currentRouter = null;
          if (this._applier === applier) this._applier = null;
          this._hostDisplay?.sync();
        };

        owner.attachView({
          modules: createWebComponentModules({
            el: thisEl,
            instanceToken: this._instanceToken,
            router,
            rawPropsSource,
            effectsPort: createWebEffectsPort(applier),
            getMeta,
            textControlTarget: this._textControlTarget,
            exposeStateWebMode,
            scrollProjection,
            setExposes,
            runInCallbackScope,
            isViewReady: () => thisEl.isConnected && !thisEl.closest(`[${PUI_VIEW_DETACHED_ATTR}]`),
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
        instanceToken: this._instanceToken,
        rawPropsSource,
        getMeta,
        textControlTarget: this._textControlTarget,
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

        if (this._invokeUnmounted) {
          const fn = this._invokeUnmounted;
          this._invokeUnmounted = null;
          const disposed = fn();
          // Terminal invalidation is synchronous even though adapter cleanup
          // exposes a Promise for callback errors. Publish the disconnected
          // ownership state before yielding so a later reconnect cannot reuse
          // the disposed session.
          unbindProtoInstance(this._instanceToken, this);
          this._controller = null;
          this._mountedOnce = false;
          this._pendingOwnedTokens = null;
          await disposed;
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
