import type { PropsBaseType } from '@proto.ui/types';
import type { ObservedStateHandle } from './state';

export type FocusScopeMeta = Readonly<{
  kind?: string;
  debugLabel?: string;
}>;

export type FocusRovingMeta = Readonly<{
  kind?: string;
  debugLabel?: string;
}>;

export type FocusGroupMeta = FocusRovingMeta;

export type FocusScopeKey = Readonly<{
  id: symbol;
  meta?: FocusScopeMeta;
}>;

export type FocusRovingKey = Readonly<{
  id: symbol;
  meta?: FocusRovingMeta;
}>;

export type FocusGroupKey = FocusRovingKey;

export function createFocusScopeKey(meta?: FocusScopeMeta): FocusScopeKey {
  return Object.freeze({
    id: Symbol(meta?.debugLabel ?? '@proto.ui/focus-scope'),
    meta: meta ? Object.freeze({ ...meta }) : undefined,
  });
}

export function createFocusRovingKey(meta?: FocusRovingMeta): FocusRovingKey {
  return Object.freeze({
    id: Symbol(meta?.debugLabel ?? '@proto.ui/focus-roving'),
    meta: meta ? Object.freeze({ ...meta }) : undefined,
  });
}

export function createFocusGroupKey(meta?: FocusGroupMeta): FocusGroupKey {
  return createFocusRovingKey(meta);
}

export type FocusRequestOptions = Readonly<{
  reason?: 'programmatic' | 'keyboard' | 'pointer';
  preventScroll?: boolean;
}>;

/** Per-activation entry policy; does not mutate the scope's setup configuration. */
export type FocusScopeActivationOptions = FocusRequestOptions &
  Readonly<{
    /** Omitted/configured follows setup policy; manual suppresses only this automatic entry. */
    entry?: 'configured' | 'manual';
  }>;

export type FocusRovingEntryRequestOptions = FocusRequestOptions &
  Readonly<{
    defer?: boolean;
  }>;

export type FocusableConfigPatch = Readonly<{
  scopeKey?: FocusScopeKey;
  groupKey?: FocusRovingKey;
  autoFocus?: boolean;
  disabled?: boolean;
  navParticipation?: 'auto' | 'none';
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusableConfig = Readonly<{
  scopeKey?: FocusScopeKey;
  groupKey?: FocusRovingKey;
  autoFocus: boolean;
  disabled: boolean;
  navParticipation: 'auto' | 'none';
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusEntryStrategy = 'self' | 'descendant-first';
export type FocusEntryFallback = 'self' | 'none';

export type FocusEntryConfigPatch = Readonly<{
  strategy?: FocusEntryStrategy;
  fallback?: FocusEntryFallback;
  disabled?: boolean;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusEntryConfig = Readonly<{
  strategy: FocusEntryStrategy;
  fallback: FocusEntryFallback;
  disabled: boolean;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusScopeConfigPatch = Readonly<{
  key?: FocusScopeKey;
  trap?: boolean;
  loop?: boolean;
  navigation?: 'tab' | 'arrow' | 'tab+arrow';
  orientation?: 'vertical' | 'horizontal' | 'both';
  entry?: 'first' | 'selected' | 'active' | 'container' | 'manual';
  restore?: 'previous' | 'trigger' | 'none';
  emptyPolicy?: 'container' | 'none';
  group?: boolean | FocusRovingConfigPatch;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusScopeConfig = Readonly<{
  key?: FocusScopeKey;
  trap: boolean;
  loop: boolean;
  navigation: 'tab' | 'arrow' | 'tab+arrow';
  orientation: 'vertical' | 'horizontal' | 'both';
  entry: 'first' | 'selected' | 'active' | 'container' | 'manual';
  restore: 'previous' | 'trigger' | 'none';
  emptyPolicy: 'container' | 'none';
  group?: boolean | FocusRovingConfigPatch;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusRovingConfigPatch = Readonly<{
  key?: FocusRovingKey;
  loop?: boolean;
  navigation?: 'none' | 'tab' | 'arrow' | 'tab+arrow';
  orientation?: 'vertical' | 'horizontal' | 'both';
  entry?: 'first' | 'selected' | 'active' | 'manual';
  selectOnFocus?: boolean;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusRovingConfig = Readonly<{
  key?: FocusRovingKey;
  loop: boolean;
  navigation: 'none' | 'tab' | 'arrow' | 'tab+arrow';
  orientation: 'vertical' | 'horizontal' | 'both';
  entry: 'first' | 'selected' | 'active' | 'manual';
  selectOnFocus: boolean;
  meta?: Readonly<Record<string, unknown>>;
}>;

export type FocusGroupConfigPatch = FocusRovingConfigPatch;
export type FocusGroupConfig = FocusRovingConfig;

export type FocusFacts = Readonly<{
  focused: boolean;
  focusVisible: boolean;
  focusable: boolean;
  active: boolean;
  hasFocused: boolean;
  rovingSelected: boolean;
  rovingActive: boolean;
}>;

export type FocusRovingMemberStatus = Readonly<{
  selected?: boolean;
  active?: boolean;
}>;

export interface FocusableHandle<P extends PropsBaseType = PropsBaseType> {
  focused: ObservedStateHandle<boolean, P>;
  focusVisible: ObservedStateHandle<boolean, P>;
  focusable: ObservedStateHandle<boolean, P>;

  focus(options?: FocusRequestOptions): void;
  focusSelf(options?: FocusRequestOptions): void;
  blur(): void;
  isFocused(): boolean;
  setDisabled(disabled: boolean): void;
  setNavParticipation(navParticipation: 'auto' | 'none'): void;
  setRovingStatus(status: FocusRovingMemberStatus): void;

  configure(patch: FocusableConfigPatch): void;
}

export interface FocusEntryHandle<P extends PropsBaseType = PropsBaseType> {
  focus(options?: FocusRequestOptions): void;
  setDisabled(disabled: boolean): void;
  configure(patch: FocusEntryConfigPatch): void;
}

export interface FocusScopeHandle<P extends PropsBaseType = PropsBaseType> {
  active: ObservedStateHandle<boolean, P>;
  hasFocused: ObservedStateHandle<boolean, P>;

  focusFirst(): void;
  focusLast(): void;
  focusNext(): void;
  focusPrev(): void;
  focusSelected(): void;
  restoreFocus(): void;
  activate(options?: FocusScopeActivationOptions): void;
  deactivate(options?: FocusRequestOptions): void;
  isActive(): boolean;

  configure(patch: FocusScopeConfigPatch): void;
  getRoving(): FocusRovingHandle<P> | null;
}

export interface FocusRovingHandle<P extends PropsBaseType = PropsBaseType> {
  active: ObservedStateHandle<boolean, P>;
  hasFocused: ObservedStateHandle<boolean, P>;

  focusFirst(options?: FocusRovingEntryRequestOptions): void;
  focusLast(options?: FocusRovingEntryRequestOptions): void;
  focusNext(): void;
  focusPrev(): void;
  focusSelected(options?: FocusRovingEntryRequestOptions): void;

  configure(patch: FocusRovingConfigPatch): void;
  setLoop(loop: boolean): void;
  setOrientation(orientation: FocusRovingConfig['orientation']): void;
}

export type FocusGroupHandle<P extends PropsBaseType = PropsBaseType> = FocusRovingHandle<P>;
