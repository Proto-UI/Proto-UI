import { createCapsWiring } from '@proto.ui/adapter-base';
import { HOST_ELEMENT_CAP, type EffectsPort } from '@proto.ui/core';
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
  AS_TRIGGER_INSTANCE_CAP,
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
  FOCUS_BLUR_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
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
import { PRESENCE_HOST_BRIDGE_CAP, type PresenceHostBridge } from '@proto.ui/module-presence';
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
import {
  createWebVisibilityHostBridge,
  VISIBILITY_HOST_BRIDGE_CAP,
} from '@proto.ui/module-visibility';
import type { PropsBaseType } from '@proto.ui/types';

import { getProtoParent, getPrototypeByInstance, setProtoParent } from '../platform/instance-tree';

export function createVueModules<Props extends PropsBaseType>(args: {
  el: HTMLElement;
  router: {
    rootTarget: EventTarget;
    globalTarget: EventTarget;
  };
  emit: (key: string, payload?: unknown, options?: Record<string, unknown>) => void;
  rawPropsSource: RawPropsSource<Props>;
  effectsPort: EffectsPort;
  getMeta: (key: string) => unknown;
  exposeStateWebMode?: ExposeStateWebMode;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  presenceBridge?: PresenceHostBridge;
  overlayLayerScheduler?: OverlayLayerScheduler;
}) {
  const { el, router, emit, rawPropsSource, effectsPort, getMeta, exposeStateWebMode, setExposes } =
    args;

  return createCapsWiring()
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('feedback', [[EFFECTS_CAP, effectsPort]])
    .use('a11y', [[A11Y_PROJECT_CAP, createWebA11yProjector(el)]])
    .use('visibility', [[VISIBILITY_HOST_BRIDGE_CAP, createWebVisibilityHostBridge(el)]])
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
      [EVENT_EMIT_CAP, emit],
    ])
    .use('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, el],
      [FOCUS_PARENT_CAP, (inst: unknown) => getProtoParent(inst as HTMLElement)],
      [FOCUS_ROOT_TARGET_CAP, () => el],
      [FOCUS_IS_NATIVELY_FOCUSABLE_CAP, isNativelyFocusable],
      [
        FOCUS_SET_FOCUSABLE_CAP,
        (target: HTMLElement, enabled: boolean) => {
          target.tabIndex = enabled ? 0 : -1;
        },
      ],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (target: HTMLElement) => {
          target.focus();
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
      ...(exposeStateWebMode ? [[EXPOSE_STATE_WEB_MODE_CAP, exposeStateWebMode] as const] : []),
    ])
    .use('context', [
      [CONTEXT_INSTANCE_TOKEN_CAP, el],
      [CONTEXT_PARENT_CAP, (inst: unknown) => getProtoParent(inst as HTMLElement)],
    ])
    .use('anatomy', [
      [ANATOMY_INSTANCE_TOKEN_CAP, el],
      [ANATOMY_PARENT_CAP, (inst: unknown) => getProtoParent(inst as HTMLElement)],
      [ANATOMY_GET_PROTO_CAP, (inst: unknown) => getPrototypeByInstance(inst as HTMLElement)],
      [ANATOMY_ROOT_TARGET_CAP, (inst: unknown) => inst as HTMLElement],
      [ANATOMY_ORDER_OBSERVER_CAP, createDomOrderObserver],
    ])
    .use('as-trigger', [
      [AS_TRIGGER_INSTANCE_CAP, el],
      [AS_TRIGGER_PARENT_CAP, (inst: unknown) => getProtoParent(inst as HTMLElement)],
      [AS_TRIGGER_GET_PROTO_CAP, (inst: unknown) => getPrototypeByInstance(inst as HTMLElement)],
    ])
    .use('rule-meta', [[RULE_META_GET_CAP, (key: string) => getMeta(key)]])
    .use('rule-expose-state-web', [
      [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, createExposeStateWebNativeVariantPolicy],
    ])
    .use('presence', [
      [PRESENCE_HOST_BRIDGE_CAP, args.presenceBridge ?? { mount: () => {}, unmount: () => {} }],
    ])
    .use('hit-participation', [
      [HOST_ELEMENT_CAP, el],
      [HIT_PARTICIPATION_HOST_BRIDGE_CAP, createWebHitParticipationHostBridge()],
    ])
    .use('boundary', [
      [HOST_ELEMENT_CAP, el],
      [BOUNDARY_HOST_BRIDGE_CAP, createWebBoundaryHostBridge()],
    ])
    .use('overlay', () => [
      [HOST_ELEMENT_CAP, el],
      [
        OVERLAY_GLOBAL_MOUNT_CAP,
        {
          mount(hostEl: HTMLElement) {
            if (hostEl.parentElement && hostEl.parentElement !== document.body) {
              setProtoParent(hostEl, hostEl.parentElement);
            }
            if (hostEl.parentNode !== document.body) {
              document.body.appendChild(hostEl);
            }
          },
          unmount() {
            /* Vue unmount handles cleanup */
          },
        },
      ],
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
