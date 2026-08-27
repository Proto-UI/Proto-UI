import {
  createCapsWiring,
  createWebMoveGestureHost,
  type LogicalInstanceToken,
} from '@proto.ui/adapter-base';
import {
  HOST_ELEMENT_CAP,
  type EffectsPort,
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
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import {
  FOCUS_BLUR_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
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
  type OverlayGlobalMount,
  type OverlayLayerScheduler,
} from '@proto.ui/module-overlay';
import {
  ANCHORED_POSITION_HOST_CAP,
  createFloatingUiAnchoredPositionHost,
} from '@proto.ui/module-positioning';
import { RAW_PROPS_SOURCE_CAP, type RawPropsSource } from '@proto.ui/module-props';
import {
  createExposeStateWebNameMap,
  createExposeStateWebNativeVariantPolicy,
  EXPOSE_STATE_WEB_MAP_CAP,
  EXPOSE_STATE_WEB_MODE_CAP,
  type ExposeStateWebMode,
} from '@proto.ui/module-expose-state-web';
import { RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP } from '@proto.ui/module-rule-expose-state-web';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { createWebScrollSurfaceHost, SCROLL_SURFACE_HOST_CAP } from '@proto.ui/module-scroll';
import type { PropsBaseType } from '@proto.ui/types';
import {
  createWebTextControlHost,
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-text-control';

import {
  clearProtoParentProjection,
  getLogicalEventTarget,
  getLogicalParent,
  getLogicalPrototype,
  getLogicalRoot,
  getLogicalTriggerSurfaceRoot,
  mergeLogicalTriggerGroup,
  setProtoParent,
  subscribeLogicalTriggerSurface,
} from '../platform/instance-tree';

type Vue2OwnerModulesArgs<Props extends PropsBaseType> = {
  instanceToken: LogicalInstanceToken;
  emit: (key: string, payload?: unknown, options?: Record<string, unknown>) => void;
  rawPropsSource: RawPropsSource<Props>;
  getMeta: (key: string) => unknown;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
};

export function createVue2OverlayGlobalMount(
  instanceToken: LogicalInstanceToken
): OverlayGlobalMount {
  const anchors = new WeakMap<HTMLElement, Comment>();

  return {
    mount(hostEl: HTMLElement) {
      const parentToken = getLogicalParent(instanceToken);
      setProtoParent(hostEl, parentToken ? getLogicalRoot(parentToken) : null);

      const document = hostEl.ownerDocument;
      const body = document?.body;
      const parent = hostEl.parentNode;
      if (!body || !parent || hostEl.parentNode === body) return;

      const anchor = document.createComment('pui-vue2-portal');
      parent.insertBefore(anchor, hostEl);
      body.appendChild(hostEl);
      anchors.set(hostEl, anchor);
    },
    unmount(hostEl: HTMLElement) {
      anchors.get(hostEl)?.remove();
      anchors.delete(hostEl);
      // The retained Proto instance stays in its logical tree while its Vue2
      // view epoch is torn down and will receive a fresh projection on remount.
      clearProtoParentProjection(hostEl);
    },
  };
}

/** Owner/instance capabilities that are valid before a host view exists. */
export function createVue2OwnerModules<Props extends PropsBaseType>(
  args: Vue2OwnerModulesArgs<Props>
) {
  const { instanceToken, emit, rawPropsSource, getMeta, setExposes } = args;

  return createCapsWiring()
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('expose-event', [[EXPOSE_EVENT_SINK_CAP, emit]])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [FOCUS_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('expose-state', [
      [
        EXPOSES_RECORD_SINK_CAP,
        (record: Record<string, unknown>) => {
          setExposes(record ?? {});
        },
      ],
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

export function createVue2Modules<Props extends PropsBaseType>(args: {
  el: HTMLElement;
  instanceToken: LogicalInstanceToken;
  router: {
    rootTarget: EventTarget;
    globalTarget: EventTarget;
  };
  emit: (key: string, payload?: unknown, options?: Record<string, unknown>) => void;
  rawPropsSource: RawPropsSource<Props>;
  effectsPort: EffectsPort;
  getMeta: (key: string) => unknown;
  exposeStateWebMode?: ExposeStateWebMode;
  scrollProjection?: ScrollProjectionPreference;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  isViewReady: () => boolean;
  getCurrentElement: () => HTMLElement | null;
  subscribeTargetReady: (listener: () => void) => () => void;
  retryTargetReady: () => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
}) {
  const {
    el,
    instanceToken,
    router,
    emit,
    rawPropsSource,
    effectsPort,
    getMeta,
    exposeStateWebMode,
    scrollProjection,
    setExposes,
  } = args;

  const getTriggerSurface = () => {
    const target = getLogicalTriggerSurfaceRoot(instanceToken);
    return args.isViewReady() && target?.isConnected ? target : null;
  };
  const subscribeFocusTarget = (listener: () => void) => {
    const offReady = args.subscribeTargetReady(listener);
    const offSurface = subscribeLogicalTriggerSurface(instanceToken, listener);
    return () => {
      offReady();
      offSurface();
    };
  };

  const physicalControl = () => args.getCurrentElement() as HTMLTextAreaElement | null;

  return createCapsWiring()
    .use('text-control', [
      [TEXT_CONTROL_HOST_CAP, createWebTextControlHost(physicalControl)],
      [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('feedback', [[EFFECTS_CAP, effectsPort]])
    .use('a11y', [
      [
        A11Y_PROJECT_CAP,
        createWebA11yProjector(getTriggerSurface, (listener) =>
          subscribeLogicalTriggerSurface(instanceToken, listener)
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
    ])
    .use('expose-event', [[EXPOSE_EVENT_SINK_CAP, emit]])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, (inst: unknown) => getLogicalParent(inst as LogicalInstanceToken)],
      [FOCUS_TARGET_READY_CAP, subscribeFocusTarget],
      [FOCUS_ROOT_TARGET_CAP, getTriggerSurface],
      [FOCUS_IS_NATIVELY_FOCUSABLE_CAP, isNativelyFocusable],
      [
        FOCUS_SET_FOCUSABLE_CAP,
        (target: HTMLElement, enabled: boolean, options?: { programmatic?: boolean }) => {
          const surface = getLogicalTriggerSurfaceRoot(instanceToken);
          projectFocusable(target, enabled && (!surface || surface === target), options);
        },
      ],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (target: HTMLElement, options?: FocusRequestOptions) => {
          if (!target.isConnected) return false;
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
        EXPOSES_RECORD_SINK_CAP,
        (record: Record<string, unknown>) => {
          setExposes(record ?? {});
        },
      ],
    ])
    .use('expose-state-web', () => [
      [HOST_ELEMENT_CAP, el],
      [EXPOSE_STATE_WEB_MAP_CAP, createExposeStateWebNameMap],
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
      [OVERLAY_GLOBAL_MOUNT_CAP, createVue2OverlayGlobalMount(instanceToken)],
      [
        OVERLAY_MODAL_CAP,
        {
          lock() {
            const original = document.body.style.overflow;
            (document.body as any).__proto_ui_original_overflow = original;
            document.body.style.overflow = 'hidden';
          },
          unlock() {
            const original = (document.body as any).__proto_ui_original_overflow ?? '';
            document.body.style.overflow = original;
            delete (document.body as any).__proto_ui_original_overflow;
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

function projectFocusable(
  target: HTMLElement,
  enabled: boolean,
  options?: { programmatic?: boolean }
): void {
  if (enabled) {
    target.setAttribute('tabindex', '0');
  } else if (options?.programmatic || isNativelyFocusable(target)) {
    target.setAttribute('tabindex', '-1');
  } else {
    target.removeAttribute('tabindex');
  }
}
