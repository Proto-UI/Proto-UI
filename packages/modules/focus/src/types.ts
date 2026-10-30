import type {
  FocusFacts,
  FocusEntryConfig,
  FocusEntryConfigPatch,
  FocusEntryHandle,
  FocusRovingConfig,
  FocusRovingConfigPatch,
  FocusRovingHandle,
  FocusRovingKey,
  FocusRovingMemberStatus,
  FocusRovingEntryRequestOptions,
  FocusScopeConfig,
  FocusRequestOptions,
  FocusScopeActivationOptions,
  FocusScopeConfigPatch,
  FocusScopeHandle,
  FocusScopeKey,
  FocusableConfig,
  FocusableConfigPatch,
  FocusableHandle,
  ModuleInstance,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export type FocusFacade = {
  getFocusable<P extends PropsBaseType = PropsBaseType>(): FocusableHandle<P>;
  getEntry<P extends PropsBaseType = PropsBaseType>(): FocusEntryHandle<P>;
  getRoving<P extends PropsBaseType = PropsBaseType>(): FocusRovingHandle<P>;
  getScope<P extends PropsBaseType = PropsBaseType>(): FocusScopeHandle<P>;
};

export type FocusPort = {
  configureFocusable(patch: FocusableConfigPatch): void;
  configureEntry(patch: FocusEntryConfigPatch): void;
  configureRoving(patch: FocusRovingConfigPatch): void;
  configureGroup(patch: FocusRovingConfigPatch): void;
  setRovingLoop(loop: boolean): void;
  setRovingOrientation(orientation: FocusRovingConfig['orientation']): void;
  configureScope(patch: FocusScopeConfigPatch): void;
  setDisabled(disabled: boolean): void;
  setNavParticipation(navParticipation: 'auto' | 'none'): void;
  setRovingStatus(status: FocusRovingMemberStatus): void;
  setEntryDisabled(disabled: boolean): void;
  requestFocus(options?: FocusRequestOptions): void;
  requestEntryFocus(options?: FocusRequestOptions): void;
  blur(): void;
  focusFirst(options?: FocusRovingEntryRequestOptions): void;
  focusLast(options?: FocusRovingEntryRequestOptions): void;
  focusNext(): void;
  focusPrev(): void;
  focusSelected(options?: FocusRovingEntryRequestOptions): void;
  restoreFocus(): void;
  activateScope(options?: FocusScopeActivationOptions): void;
  deactivateScope(options?: FocusRequestOptions): void;
  isScopeActive(): boolean;
  getEffectiveRovingKey(): FocusRovingKey | undefined;
  getEffectiveGroupKey(): FocusRovingKey | undefined;
  getEffectiveScopeKey(): FocusScopeKey | undefined;
  getFocusableConfig(): FocusableConfig;
  getEntryConfig(): FocusEntryConfig;
  getRovingConfig(): FocusRovingConfig;
  getGroupConfig(): FocusRovingConfig;
  getScopeConfig(): FocusScopeConfig;
  getFacts(): FocusFacts;
  getWarnings(): readonly string[];
};

export type FocusModule = ModuleInstance<FocusFacade> & {
  name: 'focus';
  scope: 'instance';
  port: FocusPort;
};
