import {
  createCapsWiring,
  createWebMoveGestureHost,
  type LogicalInstanceToken,
} from '@proto.ui/adapter-base';
import {
  HOST_ELEMENT_CAP,
  type EffectsPort,
  type FocusEntryConfig,
  type FocusRequestOptions,
  type ScrollProjectionPreference,
} from '@proto.ui/core';
import {
  createDomOrderObserver,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_ORDER_OBSERVER_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_MERGE_GROUP_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { A11Y_PROJECT_CAP, createWebA11yProjector } from '@proto.ui/module-a11y';
import { createWebBoundaryHostBridge, BOUNDARY_HOST_BRIDGE_CAP } from '@proto.ui/module-boundary';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  type EventDefaultActionCancelRequest,
  EVENT_EMIT_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  createExposeStateWebNameMap,
  createExposeStateWebNativeVariantPolicy,
  EXPOSE_STATE_WEB_MAP_CAP,
  EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
  EXPOSE_STATE_WEB_MODE_CAP,
} from '@proto.ui/module-expose-state-web';
import {
  FOCUS_BLUR_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_SET_ENTRY_FOCUSABLE_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  FOCUS_TARGET_READY_CAP,
} from '@proto.ui/module-focus';
import {
  createWebHitParticipationHostBridge,
  HIT_PARTICIPATION_HOST_BRIDGE_CAP,
} from '@proto.ui/module-hit-participation';
import {
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_MODAL_CAP,
  type OverlayLayerScheduler,
} from '@proto.ui/module-overlay';
import {
  ANCHORED_POSITION_HOST_CAP,
  createFloatingUiAnchoredPositionHost,
} from '@proto.ui/module-positioning';
import {
  createWebTextControlHost,
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
  type WebTextControl,
} from '@proto.ui/module-text-control';
import { type RawPropsSource, RAW_PROPS_SOURCE_CAP } from '@proto.ui/module-props';
import { RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP } from '@proto.ui/module-rule-expose-state-web';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { createWebScrollSurfaceHost, SCROLL_SURFACE_HOST_CAP } from '@proto.ui/module-scroll';
import { type PropsBaseType } from '@proto.ui/types';

import {
  getLogicalEventTarget,
  getLogicalParent,
  getLogicalPrototype,
  getLogicalRoot,
  getLogicalTriggerSurfaceRoot,
  releaseTriggerSurface,
  mergeLogicalTriggerGroup,
  subscribeLogicalTriggerSurface,
} from '../platform/instance-tree';

const TRIGGER_OWNER_MARK = Symbol.for('@proto.ui/as-trigger/confirm-owner');
const WEB_COMPONENT_TEXT_CONTROL_HOST_OPTIONS = Object.freeze({ stopPropagation: true });

function resolveWebComponentTriggerSurface(
  root: HTMLElement,
  logicalSurface: HTMLElement | null
): HTMLElement | null {
  if (!(root as unknown as Record<symbol, unknown>)[TRIGGER_OWNER_MARK]) {
    return logicalSurface;
  }

  let surface = root;
  while (true) {
    const next = Array.from(surface.querySelectorAll<HTMLElement>('[data-pui-root]')).find(
      (candidate) => {
        if (!(candidate as unknown as Record<symbol, unknown>)[TRIGGER_OWNER_MARK]) return false;
        let parent = candidate.parentElement;
        while (parent && parent !== surface && !parent.hasAttribute('data-pui-root')) {
          parent = parent.parentElement;
        }
        return parent === surface;
      }
    );
    if (!next) return surface;
    surface = next;
  }
}

type BodyWithOverflowSnapshot = HTMLElement & {
  __proto_ui_original_overflow?: string;
};

type WebComponentOwnerModulesArgs<Props extends PropsBaseType> = {
  el: HTMLElement;
  instanceToken: LogicalInstanceToken;
  rawPropsSource: RawPropsSource<Props>;
  textControlTarget: WebTextControl | null;
  getMeta: (key: string) => unknown;
  exposeStateWebMode?: {
    allowContinuousAttr?: boolean;
    allowStringVar?: boolean;
  };
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
};

/** Owner/instance capabilities that remain valid without rendered children. */
export function createWebComponentOwnerModules<Props extends PropsBaseType>(
  args: WebComponentOwnerModulesArgs<Props>
) {
  const { el, instanceToken, rawPropsSource, getMeta, setExposes } = args;
  const getTriggerSurface = () => {
    if (args.textControlTarget) return args.textControlTarget;
    const target = getLogicalTriggerSurfaceRoot(instanceToken);
    const surface = resolveWebComponentTriggerSurface(el, target);
    return surface?.isConnected ? surface : null;
  };
  const normalizeOwnedSurface = () => {
    const surface = getTriggerSurface();
    if (surface && surface !== el) releaseTriggerSurface(el);
  };
  subscribeLogicalTriggerSurface(instanceToken, normalizeOwnedSurface);
  queueMicrotask(() => queueMicrotask(normalizeOwnedSurface));
  // The custom element is the persistent owner shell, so semantic and
  // expose-state projection remain valid while its internal view is absent.
  const physicalControl = () => args.textControlTarget;

  return createCapsWiring()
    .use('text-control', [
      [
        TEXT_CONTROL_HOST_CAP,
        createWebTextControlHost(physicalControl, WEB_COMPONENT_TEXT_CONTROL_HOST_OPTIONS),
      ],
      [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('a11y', [
      [
        A11Y_PROJECT_CAP,
        createWebA11yProjector(getTriggerSurface, (listener) =>
          subscribeLogicalTriggerSurface(instanceToken, listener)
        ),
      ],
    ])
    .use('event', [
      [
        EVENT_EMIT_CAP,
        (key: string, payload?: unknown, options?: Record<string, unknown>) => {
          el.dispatchEvent(
            new CustomEvent(key, {
              detail: payload,
              bubbles: true,
              cancelable: true,
              ...options,
            })
          );
        },
      ],
    ])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [FOCUS_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('expose-state', [
      [
        EXPOSE_STATE_SET_EXPOSES_CAP,
        (record: Record<string, unknown>) => {
          setExposes(record ?? {});
        },
      ],
    ])
    .use('expose-state-web', () => [
      [HOST_ELEMENT_CAP, el],
      [EXPOSE_STATE_WEB_MAP_CAP, createExposeStateWebNameMap],
      ...(args.exposeStateWebMode
        ? [[EXPOSE_STATE_WEB_MODE_CAP, args.exposeStateWebMode] as const]
        : []),
    ])
    .use('context', [
      [CONTEXT_INSTANCE_TOKEN_CAP, instanceToken],
      [CONTEXT_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
    ])
    .use('anatomy', [
      [ANATOMY_INSTANCE_TOKEN_CAP, instanceToken],
      [ANATOMY_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [ANATOMY_GET_PROTO_CAP, (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken)],
      [ANATOMY_ROOT_TARGET_CAP, (inst: unknown) => getLogicalRoot(inst as LogicalInstanceToken)],
    ])
    .use('as-trigger', [
      [AS_TRIGGER_INSTANCE_CAP, instanceToken],
      [AS_TRIGGER_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [
        AS_TRIGGER_MERGE_GROUP_CAP,
        (inst: unknown, anchor: unknown) =>
          mergeLogicalTriggerGroup(inst as LogicalInstanceToken, anchor as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
        (inst: unknown) => getLogicalEventTarget(inst as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_PROTO_CAP,
        (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken),
      ],
    ])
    .use('rule-meta', [[RULE_META_GET_CAP, (key: string) => getMeta(key)]])
    .use('rule-expose-state-web', [
      [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, createExposeStateWebNativeVariantPolicy],
    ])
    .use('overlay', () => [
      ...(args.overlayLayerScheduler
        ? [[OVERLAY_LAYER_SCHEDULER_CAP, args.overlayLayerScheduler] as const]
        : []),
    ])
    .build();
}

export function createWebComponentModules<Props extends PropsBaseType>(args: {
  el: HTMLElement;
  instanceToken: LogicalInstanceToken;
  router: {
    rootTarget: EventTarget;
    globalTarget: EventTarget;
  };
  rawPropsSource: RawPropsSource<Props>;
  effectsPort: EffectsPort;
  textControlTarget: WebTextControl | null;
  getMeta: (key: string) => unknown;
  exposeStateWebMode?: {
    allowContinuousAttr?: boolean;
    allowStringVar?: boolean;
  };
  scrollProjection?: ScrollProjectionPreference;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  isViewReady: () => boolean;
  subscribeTargetReady: (listener: () => void) => () => void;
  retryTargetReady: () => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
}) {
  const {
    el,
    instanceToken,
    router,
    rawPropsSource,
    effectsPort,
    getMeta,
    exposeStateWebMode,
    scrollProjection,
    setExposes,
  } = args;

  let mountedEl: HTMLElement | null = null;
  let originalParent: Node | null = null;
  let originalNext: Node | null = null;
  const getConnectedTriggerSurface = () => {
    const target = getLogicalTriggerSurfaceRoot(instanceToken);
    const surface = resolveWebComponentTriggerSurface(el, target);
    return surface?.isConnected ? surface : null;
  };
  // A11y must project while the rematerialized host is still behind the reveal
  // barrier; focus remains gated until that host is ready for interaction.
  const getTriggerSurface = () => (args.isViewReady() ? getConnectedTriggerSurface() : null);
  const subscribeFocusTarget = (listener: () => void) => {
    const offReady = args.subscribeTargetReady(listener);
    const offSurface = subscribeLogicalTriggerSurface(instanceToken, listener);
    return () => {
      offReady();
      offSurface();
    };
  };
  const physicalControl = () => args.textControlTarget;
  // Keep canonical instance-facing state markers on the custom-element
  // boundary while mirroring only the generated selector context needed by
  // translated feedback.style tokens on a split presentation surface.
  const presentationSurface = args.textControlTarget ?? el;

  return createCapsWiring()
    .use('text-control', [
      [
        TEXT_CONTROL_HOST_CAP,
        createWebTextControlHost(physicalControl, WEB_COMPONENT_TEXT_CONTROL_HOST_OPTIONS),
      ],
      [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('feedback', [[EFFECTS_CAP, effectsPort]])
    .use('a11y', [
      [
        A11Y_PROJECT_CAP,
        createWebA11yProjector(
          () => physicalControl() ?? getConnectedTriggerSurface(),
          (listener) => subscribeLogicalTriggerSurface(instanceToken, listener)
        ),
      ],
    ])
    .use('event', [
      [EVENT_ROOT_TARGET_CAP, () => router.rootTarget],
      [EVENT_GLOBAL_TARGET_CAP, () => router.globalTarget],
      [
        EVENT_CANCEL_DEFAULT_ACTION_CAP,
        ({ event }: EventDefaultActionCancelRequest) => {
          if (typeof (event as Event | undefined)?.preventDefault === 'function') {
            (event as Event).preventDefault();
          }
        },
      ],
      [
        EVENT_EMIT_CAP,
        (key: string, payload?: unknown, options?: Record<string, unknown>) => {
          const ev = new CustomEvent(key, {
            detail: payload,
            bubbles: true,
            cancelable: true,
            ...options,
          });
          el.dispatchEvent(ev);
        },
      ],
    ])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [FOCUS_TARGET_READY_CAP, subscribeFocusTarget],
      [FOCUS_ROOT_TARGET_CAP, () => physicalControl() ?? getTriggerSurface()],
      [FOCUS_IS_NATIVELY_FOCUSABLE_CAP, (target: HTMLElement) => isNativelyFocusable(target)],
      [
        FOCUS_SET_FOCUSABLE_CAP,
        (target: HTMLElement, enabled: boolean) => {
          const surface = physicalControl() ?? getLogicalTriggerSurfaceRoot(instanceToken);
          target.tabIndex = enabled && (!surface || surface === target) ? 0 : -1;
        },
      ],
      [
        FOCUS_RESOLVE_ENTRY_TARGET_CAP,
        (target: HTMLElement, config: FocusEntryConfig) => resolveFocusEntryTarget(target, config),
      ],
      [
        FOCUS_SET_ENTRY_FOCUSABLE_CAP,
        (target: HTMLElement, config: FocusEntryConfig, enabled: boolean) => {
          if (!enabled) {
            target.tabIndex = -1;
            return;
          }

          const resolved = resolveFocusEntryTarget(target, config);
          target.tabIndex = resolved === target ? 0 : -1;
        },
      ],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (target: HTMLElement, options?: FocusRequestOptions) => {
          target.focus(
            typeof options?.preventScroll === 'boolean'
              ? { preventScroll: options.preventScroll }
              : undefined
          );
          const applied = target.ownerDocument.activeElement === target;
          if (!applied) args.retryTargetReady();
          return applied;
        },
      ],
      [FOCUS_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
      [
        FOCUS_BLUR_CAP,
        (target: HTMLElement) => {
          target.blur();
        },
      ],
    ])
    .use('expose-state', [
      [
        EXPOSE_STATE_SET_EXPOSES_CAP,
        (record: Record<string, unknown>) => {
          setExposes(record ?? {});
        },
      ],
    ])
    .use('expose-state-web', () => [
      [HOST_ELEMENT_CAP, el],
      [EXPOSE_STATE_WEB_MAP_CAP, createExposeStateWebNameMap],
      [
        EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
        () => (presentationSurface === el ? [] : [presentationSurface]),
      ],
      ...(exposeStateWebMode ? [[EXPOSE_STATE_WEB_MODE_CAP, exposeStateWebMode] as const] : []),
    ])
    .use('context', [
      [CONTEXT_INSTANCE_TOKEN_CAP, instanceToken],
      [CONTEXT_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
    ])
    .use('anatomy', [
      [ANATOMY_INSTANCE_TOKEN_CAP, instanceToken],
      [ANATOMY_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [ANATOMY_GET_PROTO_CAP, (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken)],
      [ANATOMY_ROOT_TARGET_CAP, (inst: unknown) => getLogicalRoot(inst as LogicalInstanceToken)],
      [ANATOMY_ORDER_OBSERVER_CAP, createDomOrderObserver],
    ])
    .use('as-trigger', [
      [AS_TRIGGER_INSTANCE_CAP, instanceToken],
      [AS_TRIGGER_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [
        AS_TRIGGER_MERGE_GROUP_CAP,
        (inst: unknown, anchor: unknown) =>
          mergeLogicalTriggerGroup(inst as LogicalInstanceToken, anchor as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
        (inst: unknown) => getLogicalEventTarget(inst as LogicalInstanceToken),
      ],
      [
        AS_TRIGGER_GET_PROTO_CAP,
        (inst: unknown) => getLogicalPrototype(inst as LogicalInstanceToken),
      ],
    ])
    .use('rule-meta', [[RULE_META_GET_CAP, (key: string) => getMeta(key)]])
    .use('rule-expose-state-web', [
      [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, createExposeStateWebNativeVariantPolicy],
    ])
    .use('hit-participation', [
      [HOST_ELEMENT_CAP, el],
      [HIT_PARTICIPATION_HOST_BRIDGE_CAP, createWebHitParticipationHostBridge()],
    ])
    .use('boundary', [
      [HOST_ELEMENT_CAP, el],
      [BOUNDARY_HOST_BRIDGE_CAP, createWebBoundaryHostBridge()],
    ])
    .use('positioning', [[ANCHORED_POSITION_HOST_CAP, createFloatingUiAnchoredPositionHost()]])
    .use('scroll', [
      [
        SCROLL_SURFACE_HOST_CAP,
        createWebScrollSurfaceHost(el, {
          moveGestureHost: createWebMoveGestureHost(),
          preference: scrollProjection,
        }),
      ],
    ])
    .use('overlay', () => [
      [HOST_ELEMENT_CAP, el],
      [
        OVERLAY_GLOBAL_MOUNT_CAP,
        {
          mount(el: HTMLElement) {
            if (el.parentNode === document.body) return;
            mountedEl = el;
            originalParent = el.parentNode;
            originalNext = el.nextSibling;
            try {
              Object.defineProperty(el, 'parentNode', {
                get() {
                  return originalParent;
                },
                configurable: true,
              });
            } catch {}
            document.body.appendChild(el);
          },
          unmount(_el: HTMLElement) {
            if (!mountedEl) return;
            if (originalParent) {
              if (originalNext && originalParent.contains(originalNext)) {
                originalParent.insertBefore(mountedEl, originalNext);
              } else {
                originalParent.appendChild(mountedEl);
              }
            }
            try {
              Object.defineProperty(mountedEl, 'parentNode', {
                get() {
                  return originalParent;
                },
                configurable: true,
              });
            } catch {}
            mountedEl = null;
          },
        },
      ],
      [
        OVERLAY_MODAL_CAP,
        {
          lock() {
            const body = document.body as BodyWithOverflowSnapshot;
            const original = body.style.overflow;
            body.__proto_ui_original_overflow = original;
            body.style.overflow = 'hidden';
          },
          unlock() {
            const body = document.body as BodyWithOverflowSnapshot;
            const original = body.__proto_ui_original_overflow ?? '';
            body.style.overflow = original;
            delete body.__proto_ui_original_overflow;
          },
        },
      ],
      ...(args.overlayLayerScheduler
        ? [[OVERLAY_LAYER_SCHEDULER_CAP, args.overlayLayerScheduler] as const]
        : []),
    ])
    .build();
}

function isNativelyFocusable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') {
    return true;
  }
  if (tag === 'a') {
    return el.hasAttribute('href');
  }
  return false;
}

function resolveFocusEntryTarget(
  container: HTMLElement,
  config: { strategy: 'self' | 'descendant-first'; fallback: 'self' | 'none' }
): HTMLElement | null {
  if (config.strategy === 'descendant-first') {
    const descendant = findFirstTabbableDescendant(container);
    if (descendant) return descendant;
  }

  if (config.fallback === 'self') return container;
  return null;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(',');

function findFirstTabbableDescendant(container: HTMLElement): HTMLElement | null {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.find((candidate) => isTabbableDescendant(container, candidate)) ?? null;
}

function isTabbableDescendant(container: HTMLElement, el: HTMLElement): boolean {
  if (el === container) return false;
  if (!container.contains(el)) return false;
  if (el.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
  if (el.hasAttribute('disabled')) return false;
  const ariaDisabled = el.getAttribute('aria-disabled');
  if (ariaDisabled === 'true') return false;
  const tabIndexAttr = el.getAttribute('tabindex');
  if (tabIndexAttr !== null && Number(tabIndexAttr) < 0) return false;
  return isNativelyFocusable(el) || tabIndexAttr !== null || el.isContentEditable;
}
