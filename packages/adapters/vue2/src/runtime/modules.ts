import {
  beginWebPortalMaterialEpoch,
  getWebPortalDestinationGeneration,
  resolveWebPortalDestinationBinding,
  subscribeWebPortalDestinations,
  notifyWebPortalProjection,
  type WebPortalDestinationBinding,
  type WebPortalMaterialEpoch,
} from '@proto.ui/adapter-base';
import { createWebPresencePresentationSink } from '@proto.ui/adapter-base';
import {
  PRESENCE_PRESENTATION_SINK_CAP,
  PRESENCE_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-feedback';
import { createWebResidentMotionSink, type WebResidentMotionOptions } from '@proto.ui/adapter-base';
import { OWNED_DECORATION_CAP, RESIDENT_MOTION_SINK_CAP } from '@proto.ui/module-feedback';
import {
  NATIVE_LINK_HOST_CAP,
  NATIVE_LINK_RUN_IN_CALLBACK_CAP,
  createWebNativeLinkHost,
} from '@proto.ui/module-native-link';
import { AXIS_INPUT_HOST_CAP, AXIS_INPUT_RUN_IN_CALLBACK_CAP } from '@proto.ui/module-axis-input';
import { createWebAxisInputHost } from '@proto.ui/adapter-base';
import {
  CONTROL_LABEL_HOST_CAP,
  CONTROL_LABEL_RUN_IN_CALLBACK_CAP,
  createWebControlLabelHost,
} from '@proto.ui/module-control-label';
import {
  IMAGE_VIEW_HOST_CAP,
  IMAGE_VIEW_RUN_IN_CALLBACK_CAP,
  createWebImageViewHost,
} from '@proto.ui/module-image-view';
import type { FocusEntryConfig } from '@proto.ui/core';
import {
  isWebFocusTargetActive,
  orderFocusTargetsByDocument,
  resolveWebFocusEntryTarget,
} from '@proto.ui/adapter-base';
import {
  createCapsWiring,
  retainWebPortalDirection,
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
import {
  EFFECTS_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type VisualFeedbackSink,
} from '@proto.ui/module-feedback';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  type EventDefaultActionCancelRequest,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_GLOBAL_INPUT_SCOPE_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import {
  FOCUS_BLUR_CAP,
  FOCUS_RELEASE_PENDING_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_ORDER_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_SET_ENTRY_FOCUSABLE_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  FOCUS_TARGET_READY_CAP,
  type FocusRequestKind,
} from '@proto.ui/module-focus';
import {
  createWebHitParticipationHostBridge,
  HIT_PARTICIPATION_HOST_BRIDGE_CAP,
} from '@proto.ui/module-hit-participation';
import {
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_MODAL_CAP,
  createWebOverlayModal,
  type OverlayGlobalMount,
  type OverlayLayerScheduler,
} from '@proto.ui/module-overlay';
import {
  CONTEXT_MENU_INPUT_HOST_CAP,
  CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP,
  createWebContextMenuInputHost,
  AVAILABLE_SPACE_HOST_CAP,
  createWebAvailableSpaceHost,
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
import {
  RULE_META_GET_CAP,
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  RULE_META_PREFERENCE_SOURCE_CAP,
  RULE_META_STYLE_SUPPORT_SOURCE_CAP,
  RULE_META_VIEWPORT_SOURCE_CAP,
  type StyleSupportInvalidationSource,
  type ViewportInvalidationSource,
  type PreferenceInvalidationSource,
  type ColorSchemeInvalidationSource,
} from '@proto.ui/module-rule-meta';
import { createWebScrollSurfaceHost, SCROLL_SURFACE_HOST_CAP } from '@proto.ui/module-scroll';
import type { PropsBaseType } from '@proto.ui/types';
import {
  createWebTextControlHost,
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
  type WebTextControl,
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
  subscribeFocusSurfaceReady,
  isNativeFocusTargetReady,
} from '../platform/instance-tree';

type Vue2OwnerModulesArgs<Props extends PropsBaseType> = {
  ownedDecoration?: boolean;
  instanceToken: LogicalInstanceToken;
  emit: (key: string, payload?: unknown, options?: Record<string, unknown>) => void;
  rawPropsSource: RawPropsSource<Props>;
  getMeta: (key: string) => unknown;
  colorSchemeSource?: ColorSchemeInvalidationSource;
  preferenceSource?: PreferenceInvalidationSource;
  styleSupportSource?: StyleSupportInvalidationSource;
  viewportSource?: ViewportInvalidationSource;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  overlayLayerScheduler?: OverlayLayerScheduler;
};

const portalDestinationRefreshers = new WeakMap<HTMLElement, () => void>();
const portalDestinationEpochs = new WeakMap<HTMLElement, number>();
export function refreshVue2PortalDestination(host: HTMLElement): void {
  portalDestinationRefreshers.get(host)?.();
}

export function createVue2OverlayGlobalMount(
  instanceToken: LogicalInstanceToken,
  getPortalOrigin?: () => Node | null
): OverlayGlobalMount<HTMLElement> {
  const leases = new WeakMap<HTMLElement, { release: () => void }>();
  return {
    mount(hostEl: HTMLElement) {
      if (leases.has(hostEl)) {
        refreshVue2PortalDestination(hostEl);
        return;
      }
      const parent = hostEl.parentNode;
      if (!parent) return;
      const document = hostEl.ownerDocument;
      const epoch = (portalDestinationEpochs.get(hostEl) ?? 0) + 1;
      portalDestinationEpochs.set(hostEl, epoch);
      const unchanged = () => portalDestinationEpochs.get(hostEl) === epoch;
      const anchor = document.createComment('pui-vue2-portal');
      const origin = () => getPortalOrigin?.() ?? anchor;
      let retired = false;
      let projectedParent: HTMLElement | null = null;
      let binding: WebPortalDestinationBinding | null = null;
      let materialEpoch: WebPortalMaterialEpoch | null = null;
      let offDestination = () => {};
      let releaseDirection = () => {};
      const refresh = () => {
        if (retired || !unchanged()) return;
        if (
          !anchor.parentNode?.isConnected ||
          (projectedParent &&
            (!projectedParent.isConnected || hostEl.parentNode !== projectedParent))
        ) {
          materialEpoch?.suspend();
          return;
        }
        const revision = getWebPortalDestinationGeneration();
        const next = resolveWebPortalDestinationBinding(origin(), hostEl);
        if (retired || !unchanged() || revision !== getWebPortalDestinationGeneration()) return;
        if (binding) {
          if (
            next.destination !== binding.destination ||
            next.registration !== binding.registration
          )
            materialEpoch?.suspend();
          return;
        }
        // Select once before focus enters this view. Registry changes later in
        // this epoch withdraw material without moving a focused native subtree.
        binding = next;
        projectedParent = next.destination;
        if (hostEl.parentNode === projectedParent) {
          materialEpoch?.commitProjection();
          return;
        }
        projectedParent.appendChild(hostEl);
        if (!retired && unchanged() && hostEl.parentNode === projectedParent) {
          materialEpoch?.commitProjection();
          if (!retired && unchanged() && hostEl.parentNode === projectedParent)
            notifyWebPortalProjection(hostEl);
        }
      };
      const lease = {
        release: () => {
          if (retired) return;
          retired = true;
          offDestination();
          if (portalDestinationRefreshers.get(hostEl) === refresh)
            portalDestinationRefreshers.delete(hostEl);
          leases.delete(hostEl);
          try {
            // Direction's author snapshot belongs to this view. Restore it
            // before material listeners can synchronously mount a replacement
            // that would otherwise capture our projected dir as author input.
            releaseDirection();
          } finally {
            try {
              materialEpoch?.release();
            } finally {
              try {
                if (unchanged() && hostEl.parentNode === projectedParent) {
                  if (anchor.parentNode) anchor.parentNode.insertBefore(hostEl, anchor);
                  else hostEl.remove();
                }
                anchor.remove();
              } finally {
                if (unchanged()) clearProtoParentProjection(hostEl);
                if (unchanged()) notifyWebPortalProjection(hostEl);
              }
            }
          }
        },
      };
      leases.set(hostEl, lease);
      try {
        parent.insertBefore(anchor, hostEl);
        const parentToken = getLogicalParent(instanceToken);
        setProtoParent(hostEl, parentToken ? getLogicalRoot(parentToken) : null);
        if (retired) return;
        const acquiredDirection = retainWebPortalDirection(hostEl, origin);
        if (retired || !unchanged()) {
          acquiredDirection();
          return;
        }
        releaseDirection = acquiredDirection;
        const acquiredMaterial = beginWebPortalMaterialEpoch(hostEl);
        if (retired || !unchanged()) {
          acquiredMaterial.release();
          return;
        }
        materialEpoch = acquiredMaterial;
        offDestination = subscribeWebPortalDestinations(refresh);
        if (retired || !unchanged()) {
          offDestination();
          return;
        }
        portalDestinationRefreshers.set(hostEl, refresh);
        refresh();
      } catch (error) {
        lease.release();
        throw error;
      }
    },
    unmount(hostEl: HTMLElement) {
      leases.get(hostEl)?.release();
    },
  };
}

/** Owner/instance capabilities that are valid before a host view exists. */
export function createVue2OwnerModules<Props extends PropsBaseType>(
  args: Vue2OwnerModulesArgs<Props>
) {
  const {
    instanceToken,
    emit,
    rawPropsSource,
    getMeta,
    colorSchemeSource,
    preferenceSource,
    styleSupportSource,
    viewportSource,
    setExposes,
  } = args;

  return createCapsWiring()
    .use('feedback', args.ownedDecoration ? [[OWNED_DECORATION_CAP, true]] : [])
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
    .use('rule-meta', [
      [RULE_META_GET_CAP, getMeta],
      ...(colorSchemeSource
        ? [[RULE_META_COLOR_SCHEME_SOURCE_CAP, colorSchemeSource] as const]
        : []),
      ...(preferenceSource ? [[RULE_META_PREFERENCE_SOURCE_CAP, preferenceSource] as const] : []),
      ...(viewportSource ? [[RULE_META_VIEWPORT_SOURCE_CAP, viewportSource] as const] : []),
      ...(styleSupportSource
        ? [[RULE_META_STYLE_SUPPORT_SOURCE_CAP, styleSupportSource] as const]
        : []),
    ])
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

// Kept by the logical Adapter owner, across replaceable view providers.
export type FocusIntentState = {
  options?: FocusRequestOptions;
  kind?: FocusRequestKind;
};

export function createVue2Modules<Props extends PropsBaseType>(args: {
  ownedDecoration?: boolean;
  el: HTMLElement;
  instanceToken: LogicalInstanceToken;
  router: {
    rootTarget: EventTarget;
    globalTarget: EventTarget;
  };
  emit: (key: string, payload?: unknown, options?: Record<string, unknown>) => void;
  rawPropsSource: RawPropsSource<Props>;
  effectsPort: EffectsPort;
  /** Optional V2 visual provider for this physical view; absence retains ordinary style. */
  visualFeedbackSink?: VisualFeedbackSink;
  residentMotion?: WebResidentMotionOptions;
  getMeta: (key: string) => unknown;
  colorSchemeSource?: ColorSchemeInvalidationSource;
  preferenceSource?: PreferenceInvalidationSource;
  styleSupportSource?: StyleSupportInvalidationSource;
  viewportSource?: ViewportInvalidationSource;
  exposeStateWebMode?: ExposeStateWebMode;
  scrollProjection?: ScrollProjectionPreference;
  setExposes: (record: Record<string, unknown>) => void;
  runInCallbackScope: (fn: () => void) => void;
  isViewReady: () => boolean;
  isEntryAcquisitionReady: (target: HTMLElement) => boolean;
  getCurrentElement: () => HTMLElement | null;
  subscribeTargetReady: (listener: () => void) => () => void;
  retryTargetReady: () => void;
  focusIntentState?: FocusIntentState;
  onFocusIntent?: () => void;
  onFocusAcquired?: () => void;
  onFocusPendingReleased?: () => void;
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
    colorSchemeSource,
    preferenceSource,
    styleSupportSource,
    viewportSource,
    exposeStateWebMode,
    scrollProjection,
    setExposes,
  } = args;

  const request = args.focusIntentState ?? {};
  const getTriggerSurface = () => {
    const target = getLogicalTriggerSurfaceRoot(instanceToken);
    return args.isViewReady() && target?.isConnected ? target : null;
  };
  // Label owns physical-detachment discovery; focus still requires connection.
  const getControlLabelSurface = () =>
    args.isViewReady() ? getLogicalTriggerSurfaceRoot(instanceToken) : null;
  const subscribeFocusTarget = (listener: () => void) => {
    const offReady = args.subscribeTargetReady(listener);
    const offSurface = subscribeFocusSurfaceReady(instanceToken, listener);
    return () => {
      offReady();
      offSurface();
    };
  };
  const physicalControl = () => args.getCurrentElement() as WebTextControl | null;

  return createCapsWiring()
    .use('control-label', [
      [
        CONTROL_LABEL_HOST_CAP,
        createWebControlLabelHost(getControlLabelSurface, subscribeFocusTarget),
      ],
      [CONTROL_LABEL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('text-control', [
      [TEXT_CONTROL_HOST_CAP, createWebTextControlHost(physicalControl)],
      [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('native-link', [
      [
        NATIVE_LINK_HOST_CAP,
        createWebNativeLinkHost(() => args.getCurrentElement() as HTMLAnchorElement | null),
      ],
      [NATIVE_LINK_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('image-view', [
      [
        IMAGE_VIEW_HOST_CAP,
        createWebImageViewHost(() => args.getCurrentElement() as HTMLImageElement | null),
      ],
      [IMAGE_VIEW_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
    .use('props', [[RAW_PROPS_SOURCE_CAP, rawPropsSource]])
    .use('feedback', [
      ...(args.ownedDecoration ? [[OWNED_DECORATION_CAP, true] as const] : []),
      [EFFECTS_CAP, effectsPort],
      [PRESENCE_PRESENTATION_SINK_CAP, createWebPresencePresentationSink(args.el, effectsPort)],
      [PRESENCE_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
      [
        RESIDENT_MOTION_SINK_CAP,
        createWebResidentMotionSink(args.el, effectsPort, args.residentMotion),
      ],
      ...(args.visualFeedbackSink
        ? [[VISUAL_FEEDBACK_SINK_CAP, args.visualFeedbackSink] as const]
        : []),
    ])
    .use('a11y', [
      [
        A11Y_PROJECT_CAP,
        createWebA11yProjector(() => {
          const surface = getLogicalTriggerSurfaceRoot(instanceToken);
          const target = surface === el ? args.getCurrentElement() : surface;
          return args.isViewReady() && target?.isConnected ? target : null;
        }, subscribeFocusTarget),
      ],
    ])
    .use('event', [
      [EVENT_ROOT_TARGET_CAP, () => router.rootTarget],
      [EVENT_GLOBAL_TARGET_CAP, () => router.globalTarget],
      [EVENT_GLOBAL_INPUT_SCOPE_CAP, () => el.ownerDocument],
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
      [FOCUS_RELEASE_PENDING_CAP, () => args.onFocusPendingReleased?.()],
      [FOCUS_ROOT_TARGET_CAP, getTriggerSurface],
      [FOCUS_IS_NATIVELY_FOCUSABLE_CAP, isNativelyFocusable],
      [FOCUS_ORDER_CAP, orderFocusTargetsByDocument],
      [
        FOCUS_SET_FOCUSABLE_CAP,
        (target: HTMLElement, enabled: boolean, options?: { programmatic?: boolean }) => {
          const surface = getLogicalTriggerSurfaceRoot(instanceToken);
          projectFocusable(target, enabled && (!surface || surface === target), options);
        },
      ],
      [
        FOCUS_RESOLVE_ENTRY_TARGET_CAP,
        (target: HTMLElement, config: FocusEntryConfig) =>
          resolveWebFocusEntryTarget(target, config, isNativelyFocusable),
      ],
      [
        FOCUS_SET_ENTRY_FOCUSABLE_CAP,
        (target: HTMLElement, config: FocusEntryConfig, enabled: boolean) => {
          const resolved = enabled
            ? resolveWebFocusEntryTarget(target, config, isNativelyFocusable)
            : null;
          projectFocusable(target, resolved === target);
        },
      ],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (target: HTMLElement, options: FocusRequestOptions | undefined, kind: FocusRequestKind) => {
          if (request.options !== options || request.kind !== kind) {
            request.options = options;
            request.kind = kind;
            args.onFocusIntent?.();
          }
          if (
            !target.isConnected ||
            (kind === 'native' && !isNativeFocusTargetReady(target)) ||
            (kind === 'entry' && !args.isEntryAcquisitionReady(target))
          )
            return false;
          target.focus(
            typeof options?.preventScroll === 'boolean'
              ? { preventScroll: options.preventScroll }
              : undefined
          );
          const applied = isWebFocusTargetActive(target);
          // Native focus can synchronously issue a newer request. Only the
          // still-current intent owns success or retry-budget accounting.
          if (request.options === options && request.kind === kind) {
            if (applied) args.onFocusAcquired?.();
            else args.retryTargetReady();
          }
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
    .use('rule-meta', [
      [RULE_META_GET_CAP, getMeta],
      ...(colorSchemeSource
        ? [[RULE_META_COLOR_SCHEME_SOURCE_CAP, colorSchemeSource] as const]
        : []),
      ...(preferenceSource ? [[RULE_META_PREFERENCE_SOURCE_CAP, preferenceSource] as const] : []),
      ...(viewportSource ? [[RULE_META_VIEWPORT_SOURCE_CAP, viewportSource] as const] : []),
      ...(styleSupportSource
        ? [[RULE_META_STYLE_SUPPORT_SOURCE_CAP, styleSupportSource] as const]
        : []),
    ])
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
    .use('positioning', [
      [ANCHORED_POSITION_HOST_CAP, createFloatingUiAnchoredPositionHost()],
      [CONTEXT_MENU_INPUT_HOST_CAP, createWebContextMenuInputHost()],
      [CONTEXT_MENU_INPUT_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
      [AVAILABLE_SPACE_HOST_CAP, createWebAvailableSpaceHost()],
    ])
    .use('axis-input', [
      [AXIS_INPUT_HOST_CAP, createWebAxisInputHost()],
      [AXIS_INPUT_RUN_IN_CALLBACK_CAP, args.runInCallbackScope],
    ])
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
      [OVERLAY_MODAL_CAP, createWebOverlayModal(el.ownerDocument)],
      ...(args.overlayLayerScheduler
        ? [[OVERLAY_LAYER_SCHEDULER_CAP, args.overlayLayerScheduler] as const]
        : []),
    ])
    .build();
}

function isNativelyFocusable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'iframe') {
    return true;
  }
  if (tag === 'input') return (el as HTMLInputElement).type !== 'hidden';
  if (tag === 'a') return el.hasAttribute('href');
  if (tag === 'area') {
    const map = el.closest('map');
    if (!el.hasAttribute('href') || !map?.name || !el.isConnected) return false;
    return Array.from(el.ownerDocument.querySelectorAll('img[usemap]')).some(
      (image) =>
        image.getAttribute('usemap') === `#${map.name}` &&
        !image.closest('[hidden],[inert],[aria-hidden="true"]')
    );
  }
  if (tag === 'audio' || tag === 'video') return el.hasAttribute('controls');
  if (tag === 'summary') {
    const parent = el.parentElement;
    return (
      parent?.tagName.toLowerCase() === 'details' &&
      Array.from(parent.children).find((child) => child.tagName.toLowerCase() === 'summary') === el
    );
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
