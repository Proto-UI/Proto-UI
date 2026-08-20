import { cap } from '@proto.ui/core';
import type { FocusEntryConfig, FocusRequestOptions } from '@proto.ui/core';

export type FocusInstanceToken = unknown;
export type FocusParentGetter = (instance: FocusInstanceToken) => FocusInstanceToken | null;

export type FocusRootTargetGetter = () => HTMLElement | null;
export type FocusTargetReadySubscriber = (listener: () => void) => () => void;

export type FocusIsNativelyFocusable = (target: HTMLElement) => boolean;

export type FocusSetFocusable = (
  target: HTMLElement,
  enabled: boolean,
  options?: { programmatic?: boolean }
) => void;

export type FocusRequestFocus = (
  target: HTMLElement,
  options?: FocusRequestOptions
) => void | boolean;

export type FocusBlur = (target: HTMLElement) => void;

export type FocusResolveEntryTarget = (
  container: HTMLElement,
  config: FocusEntryConfig
) => HTMLElement | null;

export type FocusSetEntryFocusable = (
  container: HTMLElement,
  config: FocusEntryConfig,
  enabled: boolean
) => void;

export type FocusRunInCallback = (fn: () => void) => void;

export const FOCUS_ROOT_TARGET_CAP = cap<FocusRootTargetGetter>('@proto.ui/focus/getRootTarget');
export const FOCUS_TARGET_READY_CAP = cap<FocusTargetReadySubscriber>(
  '@proto.ui/focus/subscribeTargetReady'
);
export const FOCUS_INSTANCE_TOKEN_CAP = cap<FocusInstanceToken>('@proto.ui/focus/instanceToken');
export const FOCUS_PARENT_CAP = cap<FocusParentGetter>('@proto.ui/focus/getParent');

export const FOCUS_IS_NATIVELY_FOCUSABLE_CAP = cap<FocusIsNativelyFocusable>(
  '@proto.ui/focus/isNativelyFocusable'
);

export const FOCUS_SET_FOCUSABLE_CAP = cap<FocusSetFocusable>('@proto.ui/focus/setFocusable');

export const FOCUS_REQUEST_FOCUS_CAP = cap<FocusRequestFocus>('@proto.ui/focus/requestFocus');

export const FOCUS_BLUR_CAP = cap<FocusBlur>('@proto.ui/focus/blur');

export const FOCUS_RESOLVE_ENTRY_TARGET_CAP = cap<FocusResolveEntryTarget>(
  '@proto.ui/focus/resolveEntryTarget'
);

export const FOCUS_SET_ENTRY_FOCUSABLE_CAP = cap<FocusSetEntryFocusable>(
  '@proto.ui/focus/setEntryFocusable'
);

export const FOCUS_RUN_IN_CALLBACK_CAP = cap<FocusRunInCallback>('@proto.ui/focus/runInCallback');
