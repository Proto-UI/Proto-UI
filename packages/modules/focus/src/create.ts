import { createFocusRequestIntent, retainFocusRequestIntent } from './request-intent';
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
  FOCUS_RELEASE_PENDING_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_ORDER_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_SET_ENTRY_FOCUSABLE_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  FOCUS_TARGET_READY_CAP,
  FOCUS_SAMPLE_SCOPE_TARGETS_CAP,
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

// Keep the explicit field order (including legacy roving labels) without
// repeating the same optional-patch warning code for every configuration.
function warnConfigPatch<T extends object>(
  warnings: string[],
  owner: 'focusable' | 'entry' | 'scope',
  previous: T,
  patch: Partial<T>,
  fields: readonly (keyof T & string)[],
  prefix = ''
) {
  const keyLabel = (key: unknown) =>
    (key as FocusScopeKey | undefined)?.meta?.debugLabel ?? (key as FocusScopeKey | undefined)?.id;
  for (const field of fields) {
    if (typeof patch[field] === 'undefined') continue;
    const isKey = field === 'key' || field === 'scopeKey' || field === 'groupKey';
    pushOverrideWarning(
      warnings,
      owner,
      prefix + field,
      isKey ? keyLabel(previous[field]) : previous[field],
      isKey ? keyLabel(patch[field]) : patch[field]
    );
  }
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

type FocusOperation = {
  kind: 'target' | 'entry';
  inFlight: boolean;
  admitted: boolean;
  preflight: boolean;
  deferredReadinessVersion?: number;
  cancelled?: boolean;
  previous?: FocusOperation;
};

class FocusModuleImpl extends ModuleBase {
  private focusableConfig: FocusableConfig = DEFAULT_FOCUSABLE_CONFIG;
  private focusableDeclared = false;
  private entryDeclared = false;
  private lastScopeTarget: Element | null = null;
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
  private focusApplicationVersion = 0;
  private entryAcquisitionVersion = 0;
  private focusOperation: FocusOperation | undefined;
  private focusFactsEpoch = 0;
  private hostEventsWired = false;
  private scopeEventsWired = false;
  private rovingEventsWired = false;
  private pendingFocusRequest:
    | { kind: 'target'; options: FocusRequestOptions; syncFacts: boolean }
    | { kind: 'entry'; options: FocusRequestOptions }
    | undefined;
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
        const applicationVersion = this.focusApplicationVersion;
        this.syncCenter();
        this.syncHostFocusable();
        this.syncHostEntry();
        // Center may already replay a deferred roving request during upsert.
        // Do not apply that same pending intent twice for one readiness signal.
        if (applicationVersion !== this.focusApplicationVersion) return;
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

  private withFocusRequestIntent(
    kind: FocusOperation['kind'],
    options: FocusRequestOptions | undefined,
    apply: (intent: FocusRequestOptions) => void,
    createIntent = createFocusRequestIntent
  ): void {
    const previous = this.focusOperation;
    const applicationVersion = this.focusApplicationVersion;
    // Author getters and Proxy traps may request or cancel focus while options
    // are copied. Reserve tentative ownership without consuming older pending
    // intent: a throwing snapshot or first unresolved nested entry is a no-op.
    const operation: FocusOperation = {
      kind,
      inFlight: true,
      admitted: false,
      preflight: true,
      previous,
    };
    this.focusOperation = operation;
    let failed = false;
    try {
      const intent = createIntent(options);
      if (this.focusOperation === operation && !operation.cancelled) {
        this.focusOperation = this.liveFocusPredecessor(previous);
        apply(intent);
      }
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (this.focusOperation === operation) {
        this.focusOperation = this.liveFocusPredecessor(previous);
      }
      operation.inFlight = false;
      operation.previous = undefined;
      this.settleDeferredReadiness(operation, applicationVersion, failed);
    }
  }

  private settleDeferredReadiness(
    operation: FocusOperation,
    applicationVersion: number,
    failed: boolean
  ): void {
    // Do not lose readiness if preflight threw or entry remained a no-op.
    // A signal before an attempt has already had its opportunity. A signal
    // during a rejected current application still owes one coalesced replay.
    if (
      operation.deferredReadinessVersion !== undefined &&
      (applicationVersion === this.focusApplicationVersion ||
        (operation.deferredReadinessVersion === this.focusApplicationVersion &&
          this.focusOperation === operation &&
          !!this.pendingFocusRequest))
    ) {
      const readinessVersion = operation.deferredReadinessVersion;
      operation.deferredReadinessVersion = undefined;
      // Preparing a Center request may hand the snapshot's ownership to its
      // still-running host preflight before any application has happened.
      if (this.focusOperation?.inFlight && this.focusOperation.preflight) {
        this.focusOperation.deferredReadinessVersion = readinessVersion;
        return;
      }
      try {
        if (this.pendingFocusRequest) this.fulfillPendingFocus();
        else if (this.focusedState.get()) {
          this.requestNativeFocus({
            reason: this.focusVisibleState.get() ? 'keyboard' : 'programmatic',
          });
        }
      } catch (error) {
        if (!failed) throw error;
      }
    }
  }

  private beginFocusOperation(kind: FocusOperation['kind']): FocusOperation {
    // Execution ownership is separate from the stable request-options identity.
    // Readiness replay keeps its intent while getting a new guarded execution.
    const operation: FocusOperation = {
      kind,
      inFlight: true,
      admitted: kind === 'target',
      preflight: true,
    };
    this.focusOperation = operation;
    // An enabled target request supersedes older intent before Center admission.
    if (kind === 'target') this.clearPendingFocus();
    return operation;
  }

  private cancelFocusOperation(kind?: FocusOperation['kind']): void {
    let operation = this.focusOperation;
    while (operation) {
      if (!kind || operation.kind === kind) operation.cancelled = true;
      operation = operation.admitted ? undefined : operation.previous;
    }
    if (this.focusOperation?.cancelled) {
      const tentative = this.focusOperation;
      this.focusOperation =
        kind && !tentative.admitted ? this.liveFocusPredecessor(tentative.previous) : undefined;
    }
  }

  private liveFocusPredecessor(operation: FocusOperation | undefined): FocusOperation | undefined {
    while (operation?.cancelled && !operation.admitted) operation = operation.previous;
    return operation?.cancelled ? undefined : operation;
  }

  private writeFocusFacts(
    updates: ReadonlyArray<
      readonly [OwnedStateHandle<boolean>, boolean | (() => boolean), unknown]
    >,
    ownsRequest: () => boolean = () => true
  ): boolean {
    const epoch = ++this.focusFactsEpoch;
    const current = () => epoch === this.focusFactsEpoch && ownsRequest();
    for (const [handle, value, reason] of updates) {
      if (!current()) return false;
      const next = typeof value === 'function' ? value() : value;
      if (!current()) return false;
      this.setFocusState(handle, next, reason);
    }
    return current();
  }

  private clearFocusFacts(reason: unknown): void {
    this.writeFocusFacts([
      [this.focusedOwned, false, reason],
      [this.focusVisibleOwned, false, reason],
      [this.activeOwned, false, reason],
    ]);
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

  private createCenterEntry(prepared?: FocusOperation): FocusCenterEntry | null {
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
      orderTargets: (targets) =>
        this.caps.has(FOCUS_ORDER_CAP) ? this.caps.get(FOCUS_ORDER_CAP)(targets) : null,
      requestFocus: (options?: FocusRequestOptions, behavior?: FocusRequestBehavior) => {
        // Center-originated scope/roving requests also need distinct identity.
        // An owned snapshot is a pending replay and must retain its budget.
        let outcome: FocusRequestOutcome = 'rejected';
        this.withFocusRequestIntent(
          'target',
          options,
          (intent) => {
            this.runInCallbackScope(() => {
              if (behavior?.syncFacts === false) {
                outcome = this.requestNativeFocusDirect(intent);
                return;
              }
              outcome = this.requestFocusDirect(intent);
            });
          },
          retainFocusRequestIntent
        );
        return outcome;
      },
      prepareFocusRequest: (options, behavior) => {
        if (!this.focusableDeclared || this.focusableConfig.disabled) {
          return {
            isCurrent: () => false,
            apply: () => 'rejected',
            finish: () => {},
          };
        }
        let operation = prepared;
        let intent: FocusRequestOptions | undefined;
        const applicationVersion = this.focusApplicationVersion;
        if (prepared) intent = retainFocusRequestIntent(options);
        else {
          // Center-originated author options need the same tentative owner as
          // direct requests. Already-owned snapshots retain their retry identity.
          this.withFocusRequestIntent(
            'target',
            options,
            (snapshot) => {
              intent = snapshot;
              operation = this.beginFocusOperation('target');
            },
            retainFocusRequestIntent
          );
        }
        const current = () =>
          !!operation && this.focusOperation === operation && !operation.cancelled;
        return {
          isCurrent: current,
          apply: () => {
            let outcome: FocusRequestOutcome = 'rejected';
            this.runInCallbackScope(() => {
              if (current()) {
                outcome = this.applyTargetDirect(intent!, behavior?.syncFacts !== false, operation);
              }
            });
            return outcome;
          },
          finish: (failed = false) => {
            if (!operation) return;
            operation.inFlight = false;
            if (!prepared) this.settleDeferredReadiness(operation, applicationVersion, failed);
          },
        };
      },
      hasPendingFocus: () => !!this.pendingFocusRequest || !!this.focusOperation?.inFlight,
      clearFocus: (reason: unknown) => {
        this.runInCallbackScope(() => this.clearFocus(reason));
      },
      setScopeActive: (active: boolean) => this.setScopeActive(active),
      pushWarning: (message: string) => this.warnings.push(message),
    };
  }

  private syncCenter() {
    // Readiness can arrive during setup before any Focus role is declared.
    // Such a partially constructed module owns no Center entry to publish.
    if (
      !this.focusableDeclared &&
      !this.entryDeclared &&
      !this.scopeDeclared &&
      !this.rovingDeclared
    )
      return;
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
      const generation = this.hostFocusTargetGeneration;
      if (
        !this.writeFocusFacts(
          [
            [this.focusedOwned, true, 'reason: focus.host:focus => focused'],
            [
              this.focusVisibleOwned,
              () => {
                const native = readNativeFocusVisible(this.currentHostFocusTarget);
                return native.supported ? native.value : this.keyboardModality;
              },
              'reason: focus.host:focus => focusVisible',
            ],
            [this.activeOwned, true, 'reason: focus.host:focus => active'],
            [this.hasFocusedOwned, true, 'reason: focus.host:focus => hasFocused'],
          ],
          () => generation === this.hostFocusTargetGeneration
        )
      )
        return;
      const entry = this.createCenterEntry();
      if (entry) FOCUS_CENTER.noteFocused(entry);
    });
    this.eventPort.on('host:blur', (ev: any) => {
      const target = this.readHostFocusTarget(ev);
      if (this.currentHostFocusTarget && target && target !== this.currentHostFocusTarget) {
        return;
      }
      this.invalidateHostFocusTarget();
      this.writeFocusFacts([
        [this.focusedOwned, false, 'reason: focus.host:blur => focused'],
        [this.focusVisibleOwned, false, 'reason: focus.host:blur => focusVisible'],
        [this.activeOwned, false, 'reason: focus.host:blur => active'],
      ]);
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
      const container = this.getRootTarget();
      if (
        container &&
        this.caps.has(FOCUS_SAMPLE_SCOPE_TARGETS_CAP) &&
        this.caps.has(FOCUS_REQUEST_FOCUS_CAP)
      ) {
        const { targets, activeTarget, activeInsertionIndex, recentTarget, recentInsertionIndex } =
          this.caps.get(FOCUS_SAMPLE_SCOPE_TARGETS_CAP)(container, ev.shiftKey ? 'prev' : 'next');
        if (targets.length === 0) return;
        // Actual in-scope focus (pointer or programmatic) refreshes the
        // remembered recovery anchor (C-AS-FOCUS-SCOPE-0002-I); only sampled
        // targets qualify, so stale or out-of-scope history is ignored.
        if (recentTarget && targets.some((target) => target === recentTarget))
          this.lastScopeTarget = recentTarget;
        let current = targets.findIndex((target) => target === activeTarget);
        const rememberedInsertionIndex =
          activeInsertionIndex === undefined ? recentInsertionIndex : undefined;
        if (
          current < 0 &&
          activeInsertionIndex === undefined &&
          rememberedInsertionIndex === undefined
        )
          current = targets.findIndex((target) => target === this.lastScopeTarget);
        const insertionIndex = activeInsertionIndex ?? rememberedInsertionIndex;
        let next =
          current < 0
            ? insertionIndex !== undefined
              ? insertionIndex - (ev.shiftKey ? 1 : 0)
              : ev.shiftKey
                ? targets.length - 1
                : 0
            : current + (ev.shiftKey ? -1 : 1);
        next = this.scopeConfig.loop
          ? (next + targets.length) % targets.length
          : Math.max(0, Math.min(targets.length - 1, next));
        // Native host events, not this sample, report any logical focus facts.
        const request = this.caps.get(FOCUS_REQUEST_FOCUS_CAP);
        for (let attempts = targets.length; attempts > 0; attempts -= 1) {
          const target = targets[next]!;
          if (request(target, { reason: 'keyboard' }) !== false) {
            this.lastScopeTarget = target;
            return;
          }
          if (!this.scopeConfig.loop && next === (ev.shiftKey ? 0 : targets.length - 1)) return;
          next = (next + (ev.shiftKey ? -1 : 1) + targets.length) % targets.length;
        }
        return;
      }
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
    warnConfigPatch(this.warnings, 'focusable', this.focusableConfig, patch, [
      'autoFocus',
      'disabled',
      'navParticipation',
      'scopeKey',
      'groupKey',
    ]);

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
    warnConfigPatch(this.warnings, 'entry', this.entryConfig, patch, [
      'strategy',
      'fallback',
      'disabled',
    ]);

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
    warnConfigPatch(this.warnings, 'scope', this.scopeConfig, patch, [
      'key',
      'trap',
      'loop',
      'navigation',
      'orientation',
      'entry',
      'restore',
      'emptyPolicy',
      'group',
    ]);
    if (patch.group && typeof patch.group === 'object') this.configureRoving(patch.group);

    this.scopeConfig = Object.freeze({
      ...this.scopeConfig,
      ...patch,
      meta: mergeMeta(this.scopeConfig.meta, patch.meta),
    });
  }

  configureRoving(patch: FocusRovingConfigPatch): void {
    this.ensureSetup('focus.configureRoving');
    this.declareRoving();
    warnConfigPatch(
      this.warnings,
      'scope',
      this.rovingConfig,
      patch,
      ['key', 'loop', 'navigation', 'orientation', 'entry', 'selectOnFocus'],
      'roving.'
    );

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

  private queuePendingFocus(options: FocusRequestOptions, syncFacts: boolean) {
    this.pendingFocusRequest = { kind: 'target', options, syncFacts };
  }

  private clearPendingFocus(): void {
    this.pendingFocusRequest = undefined;
    if (this.caps.has(FOCUS_RELEASE_PENDING_CAP)) this.caps.get(FOCUS_RELEASE_PENDING_CAP)();
  }

  private fulfillPendingFocus(): boolean {
    // Readiness is an observation, not a newer explicit intent. Let the
    // current preflight or host application settle before using its signal.
    if (this.focusOperation?.inFlight) {
      this.focusOperation.deferredReadinessVersion = this.focusApplicationVersion;
      return true;
    }
    const pending = this.pendingFocusRequest;
    if (!pending) return false;
    const target = this.getRootTarget();
    if (this.pendingFocusRequest !== pending) return true;
    if (!target || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) return false;
    if (pending.kind === 'entry') {
      // Do not pre-clear an entry replay: applyEntryFocus keeps the slot when
      // the replacement target has not mounted yet, so readiness from the
      // later commit can still fulfill the same intent.
      this.applyEntryFocus(pending.options, { replay: true });
    } else {
      this.pendingFocusRequest = undefined;
      this.applyTargetFocus(pending.options, pending.syncFacts, true);
    }
    return true;
  }

  private requestFocusDirect(options: FocusRequestOptions): FocusRequestOutcome {
    return this.applyTargetDirect(options, true);
  }

  private applyTargetDirect(
    options: FocusRequestOptions,
    syncFacts: boolean,
    prepared?: FocusOperation
  ): FocusRequestOutcome {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return 'rejected';
    const operation = prepared ?? this.beginFocusOperation('target');
    const applicationVersion = this.focusApplicationVersion;
    const current = () => this.focusOperation === operation && !operation.cancelled;
    this.clearPendingFocus();
    let failed = false;
    try {
      if (!syncFacts) {
        if (options.reason === 'keyboard') this.keyboardModality = true;
        else if (options.reason === 'pointer') this.keyboardModality = false;
      }
      const target = this.getRootTarget();
      if (!current()) return 'rejected';
      if (!target || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) {
        if (!current()) return 'rejected';
        this.queuePendingFocus(options, syncFacts);
        return 'pending';
      }
      operation.preflight = false;
      this.focusApplicationVersion += 1;
      const applied = this.caps.get(FOCUS_REQUEST_FOCUS_CAP)(
        target,
        options,
        syncFacts ? 'programmatic' : 'native'
      );
      if (!current()) return 'rejected';
      if (applied === false) {
        this.queuePendingFocus(options, syncFacts);
        return 'pending';
      }
      if (
        syncFacts &&
        !this.writeFocusFacts(
          [
            [this.focusedOwned, true, options.reason ?? 'programmatic'],
            [this.focusVisibleOwned, options.reason === 'keyboard', options.reason],
            [this.activeOwned, true, options.reason ?? 'programmatic'],
            [this.hasFocusedOwned, true, options.reason ?? 'programmatic'],
          ],
          current
        )
      )
        return 'rejected';
      return current() ? 'applied' : 'rejected';
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      operation.inFlight = false;
      if (!prepared) this.settleDeferredReadiness(operation, applicationVersion, failed);
    }
  }

  private clearFocus(reason: unknown): void {
    this.cancelFocusOperation();
    this.clearPendingFocus();
    this.clearFocusFacts(reason);
  }

  requestFocus(options?: FocusRequestOptions): void {
    this.withFocusRequestIntent('target', options, (intent) => this.applyTargetFocus(intent, true));
  }

  private applyTargetFocus(options: FocusRequestOptions, syncFacts: boolean, replay = false): void {
    if (!this.focusableDeclared || this.focusableConfig.disabled) return;
    const operation = this.beginFocusOperation('target');
    const applicationVersion = this.focusApplicationVersion;
    let failed = false;
    try {
      // The legacy token fallback itself reads the host root and may reenter.
      const entry = this.createCenterEntry(operation);
      if (this.focusOperation !== operation || operation.cancelled) return;
      if (entry) FOCUS_CENTER.requestFocus(entry, options, { syncFacts });
      else this.applyTargetDirect(options, syncFacts, operation);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      operation.inFlight = false;
      if (!replay) this.settleDeferredReadiness(operation, applicationVersion, failed);
    }
  }

  requestEntryFocus(options?: FocusRequestOptions): void {
    // A private snapshot identifies this distinct intent even when callers
    // reuse options. Readiness replay keeps this same snapshot and retry budget.
    this.withFocusRequestIntent('entry', options, (intent) => this.applyEntryFocus(intent));
  }

  private applyEntryFocus(options: FocusRequestOptions, intent?: { replay: boolean }): void {
    if (!this.entryDeclared || this.entryConfig.disabled) return;
    const previous = this.focusOperation;
    const applicationVersion = this.focusApplicationVersion;
    const retainedEntry =
      this.pendingFocusRequest?.kind === 'entry' ||
      (previous?.kind === 'entry' && previous.inFlight && previous.admitted);
    // Resolution itself can synchronously reenter. Reserve execution ownership,
    // but roll back a first unresolved entry so it remains a genuine no-op.
    const operation = this.beginFocusOperation('entry');
    operation.previous = previous;
    const current = () => this.focusOperation === operation && !operation.cancelled;
    const restorePrevious = () => {
      this.focusOperation = this.liveFocusPredecessor(previous);
    };
    let failed = false;
    try {
      const target = this.getRootTarget();
      if (!current()) return;
      if (!target || !this.caps.has(FOCUS_REQUEST_FOCUS_CAP)) {
        if (!current()) return;
        if (retainedEntry) {
          operation.admitted = true;
          this.pendingFocusRequest = { kind: 'entry', options };
        } else restorePrevious();
        return;
      }
      const resolved = this.caps.has(FOCUS_RESOLVE_ENTRY_TARGET_CAP)
        ? this.caps.get(FOCUS_RESOLVE_ENTRY_TARGET_CAP)(target, this.entryConfig)
        : this.entryConfig.fallback === 'self'
          ? target
          : null;
      if (!current()) return;
      if (!resolved) {
        if (retainedEntry) {
          // Only a replay preserves its intent across the temporary
          // no-target gap before a replacement commits. An explicit newer
          // request whose policy result is no-target ends the retained
          // intent instead of reviving it later.
          if (intent?.replay) this.pendingFocusRequest = { kind: 'entry', options };
          else this.clearPendingFocus();
          this.focusOperation = undefined;
        } else restorePrevious();
        return;
      }
      operation.admitted = true;
      this.clearPendingFocus();
      operation.preflight = false;
      this.focusApplicationVersion += 1;
      const applied = this.caps.get(FOCUS_REQUEST_FOCUS_CAP)(resolved, options, 'entry');
      if (current() && applied !== false) this.entryAcquisitionVersion += 1;
      if (current() && applied === false) this.pendingFocusRequest = { kind: 'entry', options };
    } catch (error) {
      failed = true;
      if (current() && !operation.admitted) restorePrevious();
      throw error;
    } finally {
      operation.inFlight = false;
      operation.previous = undefined;
      // A replay already consumes this readiness opportunity, even when its
      // target is still absent. Coalesce nested signals rather than retrying
      // the same unresolved intent recursively.
      if (!intent?.replay) this.settleDeferredReadiness(operation, applicationVersion, failed);
    }
  }

  private requestNativeFocusDirect(options: FocusRequestOptions): FocusRequestOutcome {
    return this.applyTargetDirect(options, false);
  }

  private requestNativeFocus(options?: FocusRequestOptions): void {
    this.withFocusRequestIntent('target', options, (intent) =>
      this.applyTargetFocus(intent, false)
    );
  }

  blur(): void {
    this.cancelFocusOperation();
    this.clearPendingFocus();
    this.blurTarget();
  }

  private blurTarget(disabling = false): void {
    const epoch = this.focusFactsEpoch;
    const operation = this.focusOperation;
    const acquisition = this.entryAcquisitionVersion;
    const target = this.getRootTarget();
    // A root getter may create a pending entry while disable is clearing old
    // physical focus. Only an actual acquisition or newer facts protect it.
    if (
      epoch !== this.focusFactsEpoch ||
      (disabling ? acquisition !== this.entryAcquisitionVersion : operation !== this.focusOperation)
    )
      return;
    if (target && this.caps.has(FOCUS_BLUR_CAP)) this.caps.get(FOCUS_BLUR_CAP)(target);
    // A native observer or accepted effect may already have settled newer facts.
    if (epoch === this.focusFactsEpoch) this.clearFocusFacts('blur');
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
    if (!active) this.lastScopeTarget = null;
    this.setFocusState(this.activeOwned, active, active ? 'scope.activate' : 'scope.deactivate');
    if (active) {
      this.setFocusState(this.hasFocusedOwned, true, 'scope.activate');
    }
  }

  setDisabled(disabled: boolean, reason: unknown = 'focus.setDisabled'): void {
    const config = Object.freeze({ ...this.focusableConfig, disabled });
    this.focusableConfig = config;
    if (disabled) {
      this.cancelFocusOperation('target');
      if (this.pendingFocusRequest?.kind === 'target') this.clearPendingFocus();
    }
    const acquisition = this.entryAcquisitionVersion;
    const epoch = this.focusFactsEpoch;
    this.setFocusState(this.focusableOwned, this.focusableDeclared && !disabled, reason, {
      defaultOnly: this.sys?.execPhase?.() === 'setup',
    });
    // State observers can re-enable and acquire before this transition resumes.
    if (this.focusableConfig !== config) return;
    // A rejected replacement entry owns its pending intent, not the old
    // physical focus. Only successful entry acquisition protects that focus.
    if (
      disabled &&
      acquisition === this.entryAcquisitionVersion &&
      epoch === this.focusFactsEpoch
    ) {
      this.blurTarget(true);
    }
    if (this.focusableConfig !== config) return;
    this.syncHostFocusable();
    if (this.focusableConfig !== config) return;
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
    if (disabled) this.cancelFocusOperation('entry');
    if (disabled && this.pendingFocusRequest?.kind === 'entry') this.clearPendingFocus();
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
      this.focusOperation = undefined;
      this.focusFactsEpoch += 1;
      this.clearPendingFocus();
      this.invalidateHostFocusTarget();
      const self = this.getSelfToken();
      if (self) FOCUS_CENTER.remove(self);
    }
    if (phase === 'disposed') {
      this.lastScopeTarget = null;
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
    this.lastScopeTarget = null;
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
