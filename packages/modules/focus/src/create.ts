import {
  type FocusFacts,
  type FocusEntryConfig,
  FocusEntryConfigPatch,
  FocusEntryHandle,
  type FocusRovingConfig,
  FocusRovingConfigPatch,
  FocusRovingHandle,
  FocusRovingKey,
  type FocusRovingMemberStatus,
  type FocusRovingEntryRequestOptions,
  type FocusScopeConfig,
  illegalPhase,
  FocusRequestOptions,
  FocusScopeConfigPatch,
  FocusScopeHandle,
  FocusScopeKey,
  type OwnedStateHandle,
  type FocusableConfig,
  FocusableConfigPatch,
  type InstancePhase,
  type MountPhase,
  FocusableHandle,
  ObservedStateHandle,
} from '@proto.ui/core';
import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';
import type { PropsBaseType } from '@proto.ui/types';
import type { FocusFacade, FocusModule, FocusPort } from './types';
import type { EventPort } from '@proto.ui/module-event';
import type { StateFacade, StatePort } from '@proto.ui/module-state';
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
} from './caps';
import {
  FOCUS_CENTER,
  type FocusCenterEntry,
  type FocusRequestBehavior,
  type FocusRequestOutcome,
} from './center';

const DEFAULT_FOCUSABLE_CONFIG: FocusableConfig = Object.freeze({
  autoFocus: false,
  disabled: false,
  navParticipation: 'auto',
});

const DEFAULT_ENTRY_CONFIG: FocusEntryConfig = Object.freeze({
  strategy: 'self',
  fallback: 'self',
  disabled: false,
});

const DEFAULT_SCOPE_CONFIG: FocusScopeConfig = Object.freeze({
  trap: false,
  loop: false,
  navigation: 'tab',
  orientation: 'vertical',
  entry: 'first',
  restore: 'none',
  emptyPolicy: 'none',
});

const DEFAULT_ROVING_CONFIG: FocusRovingConfig = Object.freeze({
  loop: false,
  navigation: 'none',
  orientation: 'vertical',
  entry: 'first',
  selectOnFocus: false,
});

function mergeMeta(
  prev: Readonly<Record<string, unknown>> | undefined,
  next: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> | undefined {
  if (!next) return prev;
  return Object.freeze({
    ...(prev ?? {}),
    ...next,
  });
}

function pushOverrideWarning(
  warnings: string[],
  owner: 'focusable' | 'entry' | 'scope',
  field: string,
  prev: unknown,
  next: unknown
) {
  if (typeof prev === 'undefined' || Object.is(prev, next)) return;
  warnings.push(`[Focus] ${owner}.${field} overridden: ${String(prev)} -> ${String(next)}`);
}

/**
 * Reads the UA's own :focus-visible decision for an element, when the
 * environment exposes it. Returns false outside real browsers (jsdom/happy-dom)
 * so tests and SSR keep the modality-only heuristic.
 */
type NativeFocusVisibleResult = { supported: boolean; value: boolean };

function readNativeFocusVisible(el: unknown): NativeFocusVisibleResult {
  if (!el || typeof (el as Element).matches !== 'function')
    return { supported: false, value: false };
  try {
    return { supported: true, value: (el as Element).matches(':focus-visible') };
  } catch {
    return { supported: false, value: false };
  }
}

class FocusModuleImpl extends ModuleBase {
  private focusableConfig: FocusableConfig = DEFAULT_FOCUSABLE_CONFIG;
  private focusableDeclared = false;
  private entryDeclared = false;
  private entryConfig: FocusEntryConfig = DEFAULT_ENTRY_CONFIG;
  private scopeDeclared = false;
  private rovingDeclared = false;
  private rovingConfig: FocusRovingConfig = DEFAULT_ROVING_CONFIG;
  private scopeConfig: FocusScopeConfig = DEFAULT_SCOPE_CONFIG;
  private readonly prototypeName: string;
  private readonly warnings: string[] = [];
  private didAutoFocus = false;
  private keyboardModality = false;
  private currentHostFocusTarget: unknown = null;
  private hostFocusTargetGeneration = 0;
  private hostEventsWired = false;
  private scopeEventsWired = false;
  private rovingEventsWired = false;
  private pendingFocusRequest: { options?: FocusRequestOptions; syncFacts: boolean } | undefined;
  private offTargetReady: (() => void) | undefined;
  private lastHostFocusableTarget: HTMLElement | null = null;
  private lastHostEntryTarget: HTMLElement | null = null;

  private readonly focusedOwned: OwnedStateHandle<boolean>;
  private readonly focusVisibleOwned: OwnedStateHandle<boolean>;
  private readonly focusableOwned: OwnedStateHandle<boolean>;
  private readonly activeOwned: OwnedStateHandle<boolean>;
  private readonly hasFocusedOwned: OwnedStateHandle<boolean>;

  private readonly focusedState: ObservedStateHandle<boolean, any>;
  private readonly focusVisibleState: ObservedStateHandle<boolean, any>;
  private readonly focusableState: ObservedStateHandle<boolean, any>;
  private readonly activeState: ObservedStateHandle<boolean, any>;
  private readonly hasFocusedState: ObservedStateHandle<boolean, any>;
  private rovingSelected = false;
  private rovingActive = false;

  private readonly focusableHandle: FocusableHandle<any>;
  private readonly entryHandle: FocusEntryHandle<any>;
  private readonly scopeHandle: FocusScopeHandle<any>;
  private readonly rovingHandle: FocusRovingHandle<any>;

  constructor(
    caps: ModuleFactoryArgs['caps'],
    prototypeName: string,
    private readonly eventPort: EventPort,
    private readonly statePort: StatePort,
    stateFacade: StateFacade
  ) {
    super(caps);
    this.prototypeName = prototypeName;

    this.focusedOwned = stateFacade.bool('@focus/focused', false);
    this.focusVisibleOwned = stateFacade.bool('@focus/focusVisible', false);
    this.focusableOwned = stateFacade.bool('@focus/focusable', false);
    this.activeOwned = stateFacade.bool('@focus/active', false);
    this.hasFocusedOwned = stateFacade.bool('@focus/hasFocused', false);
    (this.focusedOwned as any).__stateName = 'focused';
    (this.focusVisibleOwned as any).__stateName = 'focusVisible';
    (this.focusableOwned as any).__stateName = 'focusable';
    (this.activeOwned as any).__stateName = 'active';
    (this.hasFocusedOwned as any).__stateName = 'hasFocused';

    this.focusedState = statePort.createObservedHandle(this.focusedOwned) as any;
    this.focusVisibleState = statePort.createObservedHandle(this.focusVisibleOwned) as any;
    this.focusableState = statePort.createObservedHandle(this.focusableOwned) as any;
    this.activeState = statePort.createObservedHandle(this.activeOwned) as any;
    this.hasFocusedState = statePort.createObservedHandle(this.hasFocusedOwned) as any;

    this.focusableHandle = {
      focused: this.focusedState,
      focusVisible: this.focusVisibleState,
      focusable: this.focusableState,
      focus: (options?: FocusRequestOptions) => this.requestFocus(options),
      focusSelf: (options?: FocusRequestOptions) => this.requestNativeFocus(options),
      blur: () => this.blur(),
      isFocused: () => this.focusedState.get(),
      setDisabled: (disabled: boolean) => this.setDisabled(disabled),
      setNavParticipation: (navParticipation: 'auto' | 'none') =>
        this.setNavParticipation(navParticipation),
      setRovingStatus: (status: FocusRovingMemberStatus) => this.setRovingStatus(status),
      configure: (patch: FocusableConfigPatch) => this.configureFocusable(patch),
    };

    this.entryHandle = {
      focus: (options?: FocusRequestOptions) => this.requestEntryFocus(options),
      setDisabled: (disabled: boolean) => this.setEntryDisabled(disabled),
      configure: (patch: FocusEntryConfigPatch) => this.configureEntry(patch),
    };

    this.scopeHandle = {
      active: this.activeState,
      hasFocused: this.hasFocusedState,
      focusFirst: () => this.focusFirst(),
      focusLast: () => this.focusLast(),
      focusNext: () => this.focusNext(),
      focusPrev: () => this.focusPrev(),
      focusSelected: () => this.focusSelected(),
      restoreFocus: () => this.restoreFocus(),
      activate: (options?: FocusRequestOptions) => this.activateScope(options),
      deactivate: (options?: FocusRequestOptions) => this.deactivateScope(options),
      isActive: () => this.isScopeActive(),
      configure: (patch: FocusScopeConfigPatch) => this.configureScope(patch),
      getRoving: () => this.getRoving(),
    };

    this.rovingHandle = {
      active: this.activeState,
      hasFocused: this.hasFocusedState,
      focusFirst: (options?: FocusRovingEntryRequestOptions) => this.focusFirst(options),
      focusLast: (options?: FocusRovingEntryRequestOptions) => this.focusLast(options),
      focusNext: () => this.focusNext(),
      focusPrev: () => this.focusPrev(),
      focusSelected: (options?: FocusRovingEntryRequestOptions) => this.focusSelected(options),
      configure: (patch: FocusRovingConfigPatch) => this.configureRoving(patch),
      setLoop: (loop: boolean) => this.setRovingLoop(loop),
      setOrientation: (orientation: FocusRovingConfig['orientation']) =>
        this.setRovingOrientation(orientation),
    };

    this.syncTargetReadySubscription();
  }

  protected override onCapsEpoch(): void {
    this.syncTargetReadySubscription();
  }

  private syncTargetReadySubscription(): void {
    this.offTargetReady?.();
    this.offTargetReady = undefined;
    if (!this.caps.has(FOCUS_TARGET_READY_CAP)) return;
    this.offTargetReady = this.caps.get(FOCUS_TARGET_READY_CAP)(() => {
      this.runInCallbackScope(() => {
        this.syncCenter();
        this.syncHostFocusable();
        this.syncHostEntry();
        if (this.fulfillPendingFocus()) return;
        // A portal or retained view epoch can replace/move the native target
        // after logical focus was already granted. Re-project that established
        // owner without synthesizing or changing the semantic focus facts.
        if (this.focusedState.get()) {
          this.requestNativeFocus({
            reason: this.focusVisibleState.get() ? 'keyboard' : 'programmatic',
          });
        }
      });
    });
  }

  private ensureSetup(op: string) {
    this.sys?.ensureSetup(op);

    if (!this.sys && this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  private getRootTarget(): HTMLElement | null {
    if (!this.caps.has(FOCUS_ROOT_TARGET_CAP)) return null;
    const getter = this.caps.get(FOCUS_ROOT_TARGET_CAP);
    return getter?.() ?? null;
  }

  private getCallbackCtx(): unknown {
    return this.sys?.getCallbackCtx?.() ?? undefined;
  }

  private setFocusState(
    handle: OwnedStateHandle<boolean>,
    next: boolean,
    reason?: unknown,
    options?: { defaultOnly?: boolean }
  ): void {
    if (Object.is(handle.get(), next)) return;
    if (options?.defaultOnly) {
      this.statePort.setDefault(handle, next);
      return;
    }
    this.statePort.set(handle, next, reason, this.getCallbackCtx());
  }

  private getSelfToken() {
    if (!this.caps.has(FOCUS_INSTANCE_TOKEN_CAP)) return this.getRootTarget();
    return this.caps.get(FOCUS_INSTANCE_TOKEN_CAP);
  }

  private getParentGetter() {
    if (!this.caps.has(FOCUS_PARENT_CAP)) return () => null;
    return this.caps.get(FOCUS_PARENT_CAP);
  }

  private runInCallbackScope(fn: () => void): void {
    if (this.caps.has(FOCUS_RUN_IN_CALLBACK_CAP)) {
      this.caps.get(FOCUS_RUN_IN_CALLBACK_CAP)(fn);
      return;
    }
    fn();
  }

  private createCenterEntry(): FocusCenterEntry | null {
    const self = this.getSelfToken();
    if (!self) return null;
    return {
      instance: self,
      getParent: this.getParentGetter(),
      isFocusable: () => this.focusableDeclared,
      isScopeProvider: () => this.scopeDeclared,
      isRovingProvider: () => this.rovingDeclared,
      getFocusableConfig: () => this.focusableConfig,
      getScopeConfig: () => this.scopeConfig,
      getRovingConfig: () => this.rovingConfig,
      getFacts: () => this.getFacts(),
      getRootTarget: () => this.getRootTarget(),
      requestFocus: (options?: FocusRequestOptions, behavior?: FocusRequestBehavior) => {
        let outcome: FocusRequestOutcome = 'rejected';
        this.runInCallbackScope(() => {
          if (behavior?.syncFacts === false) {
            outcome = this.requestNativeFocusDirect(options);
            return;
          }
          outcome = this.requestFocusDirect(options);
        });
        return outcome;
      },
      hasPendingFocus: () => !!this.pendingFocusRequest,
      clearFocus: (reason: unknown) => {
        this.runInCallbackScope(() => this.clearFocus(reason));
      },
      setScopeActive: (active: boolean) => this.setScopeActive(active),
      pushWarning: (message: string) => this.warnings.push(message),
    };
  }

  private syncCenter() {
    const entry = this.createCenterEntry();
    if (!entry) return;
    FOCUS_CENTER.upsert(entry);
  }

  private syncHostFocusable() {
    const target = this.getRootTarget();

    if (this.lastHostFocusableTarget && this.lastHostFocusableTarget !== target) {
      if (this.caps.has(FOCUS_SET_FOCUSABLE_CAP)) {
        this.caps.get(FOCUS_SET_FOCUSABLE_CAP)(this.lastHostFocusableTarget, false);
      } else {
        this.lastHostFocusableTarget.tabIndex = -1;
      }
    }

    this.lastHostFocusableTarget = target;
    if (!target) return;

    const enabled =
      this.focusableDeclared &&
      !this.focusableConfig.disabled &&
      this.focusableConfig.navParticipation !== 'none';
    const isNative = this.caps.has(FOCUS_IS_NATIVELY_FOCUSABLE_CAP)
      ? this.caps.get(FOCUS_IS_NATIVELY_FOCUSABLE_CAP)(target)
      : false;

    if (this.caps.has(FOCUS_SET_FOCUSABLE_CAP)) {
      this.caps.get(FOCUS_SET_FOCUSABLE_CAP)(target, enabled, {
        programmatic: this.focusableDeclared && !this.focusableConfig.disabled,
      });
      return;
    }

    if (!enabled && isNative) {
      target.tabIndex = -1;
    }
  }

  private syncHostEntry() {
    const target = this.getRootTarget();

    if (this.lastHostEntryTarget && this.lastHostEntryTarget !== target) {
      if (this.caps.has(FOCUS_SET_ENTRY_FOCUSABLE_CAP)) {
        this.caps.get(FOCUS_SET_ENTRY_FOCUSABLE_CAP)(
          this.lastHostEntryTarget,
          this.entryConfig,
          false
        );
      } else if (this.caps.has(FOCUS_SET_FOCUSABLE_CAP)) {
        this.caps.get(FOCUS_SET_FOCUSABLE_CAP)(this.lastHostEntryTarget, false);
      }
    }

    this.lastHostEntryTarget = target;
    if (!target || !this.entryDeclared) return;

    const enabled = !this.entryConfig.disabled;
    if (this.focusableDeclared && !this.focusableConfig.disabled) return;

    if (this.caps.has(FOCUS_SET_ENTRY_FOCUSABLE_CAP)) {
      this.caps.get(FOCUS_SET_ENTRY_FOCUSABLE_CAP)(target, this.entryConfig, enabled);
      return;
    }

    if (this.caps.has(FOCUS_SET_FOCUSABLE_CAP)) {
      if (enabled && this.entryConfig.fallback === 'self') {
        this.caps.get(FOCUS_SET_FOCUSABLE_CAP)(target, true);
      } else if (!this.focusableDeclared || this.focusableConfig.disabled) {
        this.caps.get(FOCUS_SET_FOCUSABLE_CAP)(target, false);
      }
    }
  }

  private declareFocusable(): void {
    if (!this.focusableDeclared) {
      this.focusableDeclared = true;
      this.setFocusState(this.focusableOwned, !this.focusableConfig.disabled, 'focus declared', {
        defaultOnly: true,
      });
    }
    this.wireHostFocusEvents();
    this.syncHostFocusable();
    this.syncCenter();
  }

  private declareEntry(): void {
    this.entryDeclared = true;
    this.syncHostEntry();
  }

  private declareScope(): void {
    this.scopeDeclared = true;
    this.wireScopeKeyEvents();
    this.syncCenter();
  }

  private declareRoving(): void {
    this.rovingDeclared = true;
    this.wireRovingKeyEvents();
    this.syncCenter();
  }

  private readHostFocusTarget(event: any): unknown {
    return event?.nativeEvent?.target ?? event?.target ?? null;
  }

  private invalidateHostFocusTarget(): void {
    this.currentHostFocusTarget = null;
    this.hostFocusTargetGeneration += 1;
  }

  private resampleCurrentFocusVisible(reason: string): void {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return;
    if (!this.focusedOwned.get()) return;
    const generation = this.hostFocusTargetGeneration;
    const target = this.currentHostFocusTarget;
    const native = readNativeFocusVisible(target);
    const next = native.supported ? native.value : this.keyboardModality;
    if (generation !== this.hostFocusTargetGeneration || target !== this.currentHostFocusTarget) {
      return;
    }
    this.setFocusState(this.focusVisibleOwned, next, reason);
  }

  private wireHostFocusEvents(): void {
    if (this.hostEventsWired) return;
    this.hostEventsWired = true;

    this.eventPort.onGlobal('key.down', () => {
      this.keyboardModality = true;
      this.resampleCurrentFocusVisible('reason: focus.key.down => focusVisible resample');
    });
    this.eventPort.on('pointer.down', () => {
      this.keyboardModality = false;
      this.resampleCurrentFocusVisible('reason: focus.pointer.down => focusVisible resample');
    });
    this.eventPort.on('host:focus', (ev: any) => {
      if (!this.focusableDeclared || this.focusableConfig.disabled) return;
      this.currentHostFocusTarget = this.readHostFocusTarget(ev);
      this.hostFocusTargetGeneration += 1;
      this.setFocusState(this.focusedOwned, true, 'reason: focus.host:focus => focused');
      this.resampleCurrentFocusVisible('reason: focus.host:focus => focusVisible');
      this.setFocusState(this.activeOwned, true, 'reason: focus.host:focus => active');
      this.setFocusState(this.hasFocusedOwned, true, 'reason: focus.host:focus => hasFocused');
      const entry = this.createCenterEntry();
      if (entry) FOCUS_CENTER.noteFocused(entry);
    });
    this.eventPort.on('host:blur', (ev: any) => {
      const target = this.readHostFocusTarget(ev);
      if (this.currentHostFocusTarget && target && target !== this.currentHostFocusTarget) {
        return;
      }
      this.invalidateHostFocusTarget();
      this.setFocusState(this.focusedOwned, false, 'reason: focus.host:blur => focused');
      this.setFocusState(this.focusVisibleOwned, false, 'reason: focus.host:blur => focusVisible');
      this.setFocusState(this.activeOwned, false, 'reason: focus.host:blur => active');
    });
  }

  private wireScopeKeyEvents(): void {
    if (this.scopeEventsWired) return;
    this.scopeEventsWired = true;

    this.eventPort.onGlobal('key.down', (ev) => {
      if (!this.scopeDeclared) return;
      if (!this.scopeConfig.trap) return;
      if (this.scopeConfig.navigation !== 'tab' && this.scopeConfig.navigation !== 'tab+arrow') {
        return;
      }

      if (ev.key !== 'Tab') return;

      const entry = this.createCenterEntry();
      if (!entry || !FOCUS_CENTER.isTopActiveScope(entry)) return;

      ev.control.requestDefaultActionPrevention({
        reason: 'focus.scope.trap',
        source: this.prototypeName,
      });
      FOCUS_CENTER.focusInScope(entry, ev.shiftKey ? 'prev' : 'next');
    });
  }

  private wireRovingKeyEvents(): void {
    if (this.rovingEventsWired) return;
    this.rovingEventsWired = true;

    this.eventPort.onGlobal('key.down', (ev) => {
      if (!this.rovingDeclared) return;
      const op = this.resolveRovingKeyOperation(ev);
      if (!op) return;

      const entry = this.createCenterEntry();
      if (!entry) return;

      const handled = FOCUS_CENTER.focusInRoving(entry, op, { requireFocusedMember: true });
      if (!handled) return;

      ev.control.requestDefaultActionPrevention({
        reason: 'focus.roving.keyboard',
        source: this.prototypeName,
      });
    });
  }

  private resolveRovingKeyOperation(detail: any): 'first' | 'last' | 'next' | 'prev' | null {
    if (this.rovingConfig.navigation !== 'arrow' && this.rovingConfig.navigation !== 'tab+arrow') {
      return null;
    }

    const key = detail?.key;
    if (key === 'Home') return 'first';
    if (key === 'End') return 'last';

    const orientation = this.rovingConfig.orientation;
    if ((orientation === 'horizontal' || orientation === 'both') && key === 'ArrowRight') {
      return 'next';
    }
    if ((orientation === 'horizontal' || orientation === 'both') && key === 'ArrowLeft') {
      return 'prev';
    }
    if ((orientation === 'vertical' || orientation === 'both') && key === 'ArrowDown') {
      return 'next';
    }
    if ((orientation === 'vertical' || orientation === 'both') && key === 'ArrowUp') {
      return 'prev';
    }
    return null;
  }

  getFocusable<P extends PropsBaseType = PropsBaseType>(): FocusableHandle<P> {
    this.declareFocusable();
    return this.focusableHandle as FocusableHandle<P>;
  }

  getEntry<P extends PropsBaseType = PropsBaseType>(): FocusEntryHandle<P> {
    this.declareEntry();
    return this.entryHandle as FocusEntryHandle<P>;
  }

  getScope<P extends PropsBaseType = PropsBaseType>(): FocusScopeHandle<P> {
    this.declareScope();
    return this.scopeHandle as FocusScopeHandle<P>;
  }

  getRoving<P extends PropsBaseType = PropsBaseType>(): FocusRovingHandle<P> {
    this.declareRoving();
    return this.rovingHandle as FocusRovingHandle<P>;
  }

  configureFocusable(patch: FocusableConfigPatch): void {
    this.ensureSetup('focus.configureFocusable');
    this.declareFocusable();
    if (typeof patch.autoFocus !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'focusable',
        'autoFocus',
        this.focusableConfig.autoFocus,
        patch.autoFocus
      );
    }
    if (typeof patch.disabled !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'focusable',
        'disabled',
        this.focusableConfig.disabled,
        patch.disabled
      );
    }
    if (typeof patch.navParticipation !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'focusable',
        'navParticipation',
        this.focusableConfig.navParticipation,
        patch.navParticipation
      );
    }
    if (typeof patch.scopeKey !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'focusable',
        'scopeKey',
        this.focusableConfig.scopeKey?.meta?.debugLabel ?? this.focusableConfig.scopeKey?.id,
        patch.scopeKey?.meta?.debugLabel ?? patch.scopeKey?.id
      );
    }
    if (typeof patch.groupKey !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'focusable',
        'groupKey',
        this.focusableConfig.groupKey?.meta?.debugLabel ?? this.focusableConfig.groupKey?.id,
        patch.groupKey?.meta?.debugLabel ?? patch.groupKey?.id
      );
    }

    this.focusableConfig = Object.freeze({
      ...this.focusableConfig,
      ...patch,
      meta: mergeMeta(this.focusableConfig.meta, patch.meta),
    });
    this.setDisabled(this.focusableConfig.disabled, 'focus config updated');
    this.syncHostFocusable();
    this.syncCenter();
  }

  configureEntry(patch: FocusEntryConfigPatch): void {
    this.ensureSetup('focus.configureEntry');
    this.declareEntry();
    if (typeof patch.strategy !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'entry',
        'strategy',
        this.entryConfig.strategy,
        patch.strategy
      );
    }
    if (typeof patch.fallback !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'entry',
        'fallback',
        this.entryConfig.fallback,
        patch.fallback
      );
    }
    if (typeof patch.disabled !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'entry',
        'disabled',
        this.entryConfig.disabled,
        patch.disabled
      );
    }

    this.entryConfig = Object.freeze({
      ...this.entryConfig,
      ...patch,
      meta: mergeMeta(this.entryConfig.meta, patch.meta),
    });
    this.syncHostEntry();
  }

  configureScope(patch: FocusScopeConfigPatch): void {
    this.ensureSetup('focus.configureScope');
    this.declareScope();
    if (typeof patch.key !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'key',
        this.scopeConfig.key?.meta?.debugLabel ?? this.scopeConfig.key?.id,
        patch.key?.meta?.debugLabel ?? patch.key?.id
      );
    }
    if (typeof patch.trap !== 'undefined') {
      pushOverrideWarning(this.warnings, 'scope', 'trap', this.scopeConfig.trap, patch.trap);
    }
    if (typeof patch.loop !== 'undefined') {
      pushOverrideWarning(this.warnings, 'scope', 'loop', this.scopeConfig.loop, patch.loop);
    }
    if (typeof patch.navigation !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'navigation',
        this.scopeConfig.navigation,
        patch.navigation
      );
    }
    if (typeof patch.orientation !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'orientation',
        this.scopeConfig.orientation,
        patch.orientation
      );
    }
    if (typeof patch.entry !== 'undefined') {
      pushOverrideWarning(this.warnings, 'scope', 'entry', this.scopeConfig.entry, patch.entry);
    }
    if (typeof patch.restore !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'restore',
        this.scopeConfig.restore,
        patch.restore
      );
    }
    if (typeof patch.emptyPolicy !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'emptyPolicy',
        this.scopeConfig.emptyPolicy,
        patch.emptyPolicy
      );
    }
    if (typeof patch.group !== 'undefined') {
      pushOverrideWarning(this.warnings, 'scope', 'group', this.scopeConfig.group, patch.group);
      if (patch.group && typeof patch.group === 'object') {
        this.configureRoving(patch.group);
      }
    }

    this.scopeConfig = Object.freeze({
      ...this.scopeConfig,
      ...patch,
      meta: mergeMeta(this.scopeConfig.meta, patch.meta),
    });
  }

  configureRoving(patch: FocusRovingConfigPatch): void {
    this.ensureSetup('focus.configureRoving');
    this.declareRoving();
    if (typeof patch.key !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'roving.key',
        this.rovingConfig.key?.meta?.debugLabel ?? this.rovingConfig.key?.id,
        patch.key?.meta?.debugLabel ?? patch.key?.id
      );
    }
    if (typeof patch.loop !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'roving.loop',
        this.rovingConfig.loop,
        patch.loop
      );
    }
    if (typeof patch.navigation !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'roving.navigation',
        this.rovingConfig.navigation,
        patch.navigation
      );
    }
    if (typeof patch.orientation !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'roving.orientation',
        this.rovingConfig.orientation,
        patch.orientation
      );
    }
    if (typeof patch.entry !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'roving.entry',
        this.rovingConfig.entry,
        patch.entry
      );
    }
    if (typeof patch.selectOnFocus !== 'undefined') {
      pushOverrideWarning(
        this.warnings,
        'scope',
        'roving.selectOnFocus',
        this.rovingConfig.selectOnFocus,
        patch.selectOnFocus
      );
    }

    this.rovingConfig = Object.freeze({
      ...this.rovingConfig,
      ...patch,
      meta: mergeMeta(this.rovingConfig.meta, patch.meta),
    });
    this.syncCenter();
  }

  setRovingLoop(loop: boolean): void {
    this.rovingConfig = Object.freeze({
      ...this.rovingConfig,
      loop,
    });
    this.syncCenter();
  }

  setRovingOrientation(orientation: FocusRovingConfig['orientation']): void {
    this.rovingConfig = Object.freeze({
      ...this.rovingConfig,
      orientation,
    });
    this.syncCenter();
  }

  private queuePendingFocus(options: FocusRequestOptions | undefined, syncFacts: boolean) {
    this.pendingFocusRequest = { options, syncFacts };
  }

  private clearPendingFocus(): void {
    this.pendingFocusRequest = undefined;
  }

  private fulfillPendingFocus(): boolean {
    const pending = this.pendingFocusRequest;
    if (!pending || !this.getRootTarget() || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) return false;
    this.pendingFocusRequest = undefined;
    if (pending.syncFacts) this.requestFocus(pending.options);
    else this.requestNativeFocus(pending.options);
    return true;
  }

  private requestFocusDirect(options?: FocusRequestOptions): FocusRequestOutcome {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return 'rejected';
    const target = this.getRootTarget();
    if (!target || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) {
      this.queuePendingFocus(options, true);
      return 'pending';
    }
    this.clearPendingFocus();
    const applied = this.caps.get(FOCUS_REQUEST_FOCUS_CAP)(target, options);
    if (applied === false) {
      this.queuePendingFocus(options, true);
      return 'pending';
    }
    this.setFocusState(this.focusedOwned, true, options?.reason ?? 'programmatic');
    this.setFocusState(this.focusVisibleOwned, options?.reason === 'keyboard', options?.reason);
    this.setFocusState(this.activeOwned, true, options?.reason ?? 'programmatic');
    this.setFocusState(this.hasFocusedOwned, true, options?.reason ?? 'programmatic');
    return 'applied';
  }

  private clearFocus(reason: unknown): void {
    this.clearPendingFocus();
    this.setFocusState(this.focusedOwned, false, reason);
    this.setFocusState(this.focusVisibleOwned, false, reason);
    this.setFocusState(this.activeOwned, false, reason);
  }

  requestFocus(options?: FocusRequestOptions): void {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return;
    const entry = this.createCenterEntry();
    if (!entry) {
      this.requestFocusDirect(options);
      return;
    }
    FOCUS_CENTER.requestFocus(entry, options, { syncFacts: true });
  }

  requestEntryFocus(options?: FocusRequestOptions): void {
    if (!this.entryDeclared || this.entryConfig.disabled) return;
    const target = this.getRootTarget();
    if (!target || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) return;

    const resolved = this.caps.has(FOCUS_RESOLVE_ENTRY_TARGET_CAP)
      ? this.caps.get(FOCUS_RESOLVE_ENTRY_TARGET_CAP)(target, this.entryConfig)
      : this.entryConfig.fallback === 'self'
        ? target
        : null;
    if (!resolved) return;
    this.caps.get(FOCUS_REQUEST_FOCUS_CAP)(resolved, options);
  }

  private requestNativeFocusDirect(options?: FocusRequestOptions): FocusRequestOutcome {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return 'rejected';
    if (options?.reason === 'keyboard') this.keyboardModality = true;
    else if (options?.reason === 'pointer') this.keyboardModality = false;
    const target = this.getRootTarget();
    if (!target || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) {
      this.queuePendingFocus(options, false);
      return 'pending';
    }
    this.clearPendingFocus();
    const applied = this.caps.get(FOCUS_REQUEST_FOCUS_CAP)(target, options);
    if (applied === false) {
      this.queuePendingFocus(options, false);
      return 'pending';
    }
    return 'applied';
  }

  private requestNativeFocus(options?: FocusRequestOptions): void {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return;
    const entry = this.createCenterEntry();
    if (!entry) {
      this.requestNativeFocusDirect(options);
      return;
    }
    FOCUS_CENTER.requestFocus(entry, options, { syncFacts: false });
  }

  blur(): void {
    this.clearPendingFocus();
    const target = this.getRootTarget();
    if (target && this.caps.has(FOCUS_BLUR_CAP)) {
      this.caps.get(FOCUS_BLUR_CAP)(target);
    }
    this.setFocusState(this.focusedOwned, false, 'blur');
    this.setFocusState(this.focusVisibleOwned, false, 'blur');
    this.setFocusState(this.activeOwned, false, 'blur');
  }

  focusFirst(options?: FocusRovingEntryRequestOptions): void {
    const entry = this.createCenterEntry();
    if (entry && this.rovingDeclared) {
      FOCUS_CENTER.focusInRoving(entry, 'first', { entryRequest: options });
      return;
    }
    if (this.focusableConfig.disabled) return;
    if (this.scopeConfig.emptyPolicy === 'container') {
      this.setFocusState(this.activeOwned, true, 'focusFirst:container');
      this.setFocusState(this.hasFocusedOwned, false, 'focusFirst:container');
      this.setFocusState(this.focusedOwned, false, 'focusFirst:container');
      this.setFocusState(this.focusVisibleOwned, false, 'focusFirst:container');
      return;
    }
    this.requestFocus({ reason: 'programmatic' });
  }

  focusLast(options?: FocusRovingEntryRequestOptions): void {
    const entry = this.createCenterEntry();
    if (entry && this.rovingDeclared) {
      FOCUS_CENTER.focusInRoving(entry, 'last', { entryRequest: options });
      return;
    }
    this.requestFocus({ reason: 'programmatic' });
  }

  focusNext(): void {
    const entry = this.createCenterEntry();
    if (entry && this.rovingDeclared) {
      FOCUS_CENTER.focusInRoving(entry, 'next');
      return;
    }
    this.requestFocus({ reason: 'programmatic' });
  }

  focusPrev(): void {
    const entry = this.createCenterEntry();
    if (entry && this.rovingDeclared) {
      FOCUS_CENTER.focusInRoving(entry, 'prev');
      return;
    }
    this.requestFocus({ reason: 'programmatic' });
  }

  focusSelected(options?: FocusRovingEntryRequestOptions): void {
    const entry = this.createCenterEntry();
    if (entry && this.rovingDeclared) {
      FOCUS_CENTER.focusInRoving(entry, 'selected', { entryRequest: options });
      return;
    }
    this.requestFocus({ reason: 'programmatic' });
  }

  restoreFocus(): void {
    this.requestFocus({ reason: 'programmatic' });
  }

  activateScope(options?: FocusRequestOptions): void {
    this.declareScope();
    const entry = this.createCenterEntry();
    if (!entry) return;
    FOCUS_CENTER.activateScope(entry, options);
  }

  deactivateScope(options?: FocusRequestOptions): void {
    const entry = this.createCenterEntry();
    if (!entry) {
      this.setScopeActive(false);
      return;
    }
    FOCUS_CENTER.deactivateScope(entry, options);
  }

  isScopeActive(): boolean {
    const entry = this.createCenterEntry();
    return entry ? FOCUS_CENTER.isScopeActive(entry) : this.activeState.get();
  }

  private setScopeActive(active: boolean): void {
    this.setFocusState(this.activeOwned, active, active ? 'scope.activate' : 'scope.deactivate');
    if (active) {
      this.setFocusState(this.hasFocusedOwned, true, 'scope.activate');
    }
  }

  setDisabled(disabled: boolean, reason: unknown = 'focus.setDisabled'): void {
    this.focusableConfig = Object.freeze({
      ...this.focusableConfig,
      disabled,
    });
    this.setFocusState(this.focusableOwned, this.focusableDeclared && !disabled, reason, {
      defaultOnly: this.sys?.execPhase?.() === 'setup',
    });
    if (disabled) {
      this.blur();
    }
    this.syncHostFocusable();
    this.syncCenter();
  }

  setNavParticipation(navParticipation: 'auto' | 'none'): void {
    this.focusableConfig = Object.freeze({
      ...this.focusableConfig,
      navParticipation,
    });
    this.syncHostFocusable();
    this.syncCenter();
  }

  setRovingStatus(status: FocusRovingMemberStatus): void {
    if (typeof status.selected !== 'undefined') this.rovingSelected = status.selected;
    if (typeof status.active !== 'undefined') this.rovingActive = status.active;
  }

  setEntryDisabled(disabled: boolean): void {
    this.entryConfig = Object.freeze({
      ...this.entryConfig,
      disabled,
    });
    this.syncHostEntry();
  }

  afterRenderCommit(): void {
    this.syncCenter();
    this.syncHostFocusable();
    this.syncHostEntry();
    const hadPendingFocus = !!this.pendingFocusRequest;
    // During the initial adapter commit host events are wired, but the runtime
    // still rejects them until mountPhase becomes `mounted`. Keep native focus
    // pending until that boundary so the resulting host focus event is observed.
    if (this.mountPhase !== 'mounting') this.fulfillPendingFocus();
    if (hadPendingFocus) {
      this.didAutoFocus = true;
      return;
    }
    if (this.didAutoFocus) return;
    this.didAutoFocus = true;
    if (
      this.focusableDeclared &&
      this.focusableConfig.autoFocus &&
      !this.focusableConfig.disabled
    ) {
      this.requestFocus({ reason: 'programmatic' });
    }
  }

  getEffectiveScopeKey(): FocusScopeKey | undefined {
    return this.focusableConfig.scopeKey ?? this.scopeConfig.key;
  }

  getEffectiveRovingKey(): FocusRovingKey | undefined {
    return this.rovingConfig.key;
  }

  getFocusableConfig(): FocusableConfig {
    return this.focusableConfig;
  }

  getEntryConfig(): FocusEntryConfig {
    return this.entryConfig;
  }

  getScopeConfig(): FocusScopeConfig {
    return this.scopeConfig;
  }

  getRovingConfig(): FocusRovingConfig {
    return this.rovingConfig;
  }

  getFacts(): FocusFacts {
    return Object.freeze({
      focused: this.focusedState.get(),
      focusVisible: this.focusVisibleState.get(),
      focusable: this.focusableState.get(),
      active: this.activeState.get(),
      hasFocused: this.hasFocusedState.get(),
      rovingSelected: this.rovingSelected,
      rovingActive: this.rovingActive,
    });
  }

  getWarnings(): readonly string[] {
    return Object.freeze(this.warnings.slice());
  }

  override onInstancePhase(phase: InstancePhase): void {
    super.onInstancePhase(phase);
    if (phase === 'disposing') {
      this.clearPendingFocus();
      this.invalidateHostFocusTarget();
      const self = this.getSelfToken();
      if (self) FOCUS_CENTER.remove(self);
    }
    if (phase === 'disposed') {
      this.offTargetReady?.();
      this.offTargetReady = undefined;
    }
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'mounted') {
      this.syncCenter();
      this.syncHostFocusable();
      this.syncHostEntry();
      this.fulfillPendingFocus();
      return;
    }
    if (phase !== 'detached') return;
    this.invalidateHostFocusTarget();
    const self = this.getSelfToken();
    if (self) FOCUS_CENTER.detach(self);
    // `detached` ends only the current host view epoch. Keep the latest
    // logical focus request so a retained React/Vue owner can fulfill it when
    // its replacement target mounts. Terminal unmount/dispose, blur, disabled,
    // or a newer request still cancel or replace the pending intent.
  }
}

export function createFocusModule(ctx: ModuleFactoryArgs): FocusModule {
  const { init, caps, deps } = ctx;

  return createModule<'focus', 'instance', FocusFacade, FocusPort>({
    name: 'focus',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ deps }) => {
      const eventPort = deps.requirePort<EventPort>('event');
      const statePort = deps.requirePort<StatePort>('state');
      const stateFacade = deps.requireFacade<StateFacade>('state');
      const impl = new FocusModuleImpl(caps, init.prototypeName, eventPort, statePort, stateFacade);
      const port: FocusPort = {
        configureFocusable: (patch) => impl.configureFocusable(patch),
        configureEntry: (patch) => impl.configureEntry(patch),
        configureRoving: (patch) => impl.configureRoving(patch),
        configureGroup: (patch) => impl.configureRoving(patch),
        setRovingLoop: (loop) => impl.setRovingLoop(loop),
        setRovingOrientation: (orientation) => impl.setRovingOrientation(orientation),
        configureScope: (patch) => impl.configureScope(patch),
        setDisabled: (disabled) => impl.setDisabled(disabled),
        setNavParticipation: (navParticipation) => impl.setNavParticipation(navParticipation),
        setRovingStatus: (status) => impl.setRovingStatus(status),
        setEntryDisabled: (disabled) => impl.setEntryDisabled(disabled),
        requestFocus: (options) => impl.requestFocus(options),
        requestEntryFocus: (options) => impl.requestEntryFocus(options),
        blur: () => impl.blur(),
        focusFirst: (options) => impl.focusFirst(options),
        focusLast: (options) => impl.focusLast(options),
        focusNext: () => impl.focusNext(),
        focusPrev: () => impl.focusPrev(),
        focusSelected: (options) => impl.focusSelected(options),
        restoreFocus: () => impl.restoreFocus(),
        activateScope: (options) => impl.activateScope(options),
        deactivateScope: (options) => impl.deactivateScope(options),
        isScopeActive: () => impl.isScopeActive(),
        getEffectiveRovingKey: () => impl.getEffectiveRovingKey(),
        getEffectiveGroupKey: () => impl.getEffectiveRovingKey(),
        getEffectiveScopeKey: () => impl.getEffectiveScopeKey(),
        getFocusableConfig: () => impl.getFocusableConfig(),
        getEntryConfig: () => impl.getEntryConfig(),
        getRovingConfig: () => impl.getRovingConfig(),
        getGroupConfig: () => impl.getRovingConfig(),
        getScopeConfig: () => impl.getScopeConfig(),
        getFacts: () => impl.getFacts(),
        getWarnings: () => impl.getWarnings(),
      };

      return {
        facade: {
          getFocusable: () => impl.getFocusable(),
          getEntry: () => impl.getEntry(),
          getRoving: () => impl.getRoving(),
          getScope: () => impl.getScope(),
        },
        hooks: {
          onInstancePhase: (p) => impl.onInstancePhase(p),
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          onProtoPhase: (p) => impl.onProtoPhase(p),
          afterRenderCommit: () => impl.afterRenderCommit(),
        },
        port,
      };
    },
  }) as FocusModule;
}

export const FocusModuleDef = defineModule({
  name: 'focus',
  resourceOwnership: 'mixed',
  deps: ['event', 'state'],
  create: createFocusModule,
});
