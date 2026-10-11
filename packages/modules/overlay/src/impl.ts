import { joinEscapeScope, ownsEscapeSample } from './escape-coordinator';
import type {
  BoundaryHandle,
  CapsVaultView,
  ObservedStateHandle,
  OverlayConfig,
  OverlayConfigPatch,
  OverlayPositionPatch,
  OverlayModuleHandle,
  MountPhase,
  ProtoPhase,
  OverlayReason,
  OverlayRegistration,
  AnchoredPositionHandle,
  AvailableSpaceHandle,
  AnchoredPositionSnapshot,
  AnatomyPartView,
} from '@proto.ui/core';
import { illegalPhase } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { EventPort } from '@proto.ui/module-event';
import type { BoundaryPort } from '@proto.ui/module-boundary';
import type { StateEvent } from '@proto.ui/types';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { HOST_ELEMENT_CAP } from '@proto.ui/core';
import {
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_MODAL_CAP,
  OVERLAY_TARGET_HOST_CAP,
  type OverlayGlobalMount,
  type OverlayLayerScheduler,
  type OverlayModal,
} from './caps';

const DEFAULT_CONFIG: OverlayConfig = Object.freeze({
  defaultOpen: false,
  closeOnEscape: false,
  closeOnOutsidePress: false,
  closeOnFocusOutside: false,
  closeOnAnchorPress: false,
  closeOnTriggerPress: false,
  placement: 'bottom',
  align: 'start',
  sideOffset: 4,
  alignOffset: 0,
  anchored: false,
  availableSpace: false,
  strategy: 'absolute',
  avoidCollisions: true,
  collisionBoundary: 'clippingAncestors',
  collisionPadding: 0,
  excludeAnchorTranslation: false,
  entry: 'content',
  restore: 'trigger',
  portal: false,
  modal: false,
  layerRole: 'overlay',
  layerOffset: 0,
});

function createObservedHandle<T>(initialValue: T) {
  let value = initialValue;
  const watchers = new Set<(run: any, e: StateEvent<T>) => void>();

  const handle: ObservedStateHandle<T, any> = {
    get: () => value,
    watch: (cb) => {
      watchers.add(cb as any);
      return () => {
        watchers.delete(cb as any);
      };
    },
  };

  return {
    handle: Object.freeze(handle),
    set(next: T, reason?: unknown) {
      if (Object.is(next, value)) return;
      const prev = value;
      value = next;
      const event: StateEvent<T> = { type: 'next', next, prev, reason };
      for (const watcher of watchers) {
        watcher(undefined as any, event);
      }
    },
  };
}

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

function pushOverrideWarning(warnings: string[], field: string, prev: unknown, next: unknown) {
  if (typeof prev === 'undefined' || Object.is(prev, next)) return;
  warnings.push(`[Overlay] ${field} overridden: ${String(prev)} -> ${String(next)}`);
}

type HostResourceLease = {
  target?: unknown;
  acquiring: boolean;
  revoked: boolean;
  release: (() => void) | null;
};

function revokeHostResource(lease: HostResourceLease): void {
  lease.revoked = true;
  if (lease.acquiring) return;
  const release = lease.release;
  lease.release = null;
  release?.();
}

export class OverlayModuleImpl extends ModuleBase {
  private config: OverlayConfig = DEFAULT_CONFIG;
  private presenceBound = false;
  private readonly prototypeName: string;
  private readonly warnings: string[] = [];
  private targetIssue: string | null = null;
  private readonly boundary: BoundaryHandle<any>;
  private openRevision = 0;
  private lastReason: OverlayReason | undefined = undefined;
  private viewReconciliationVersion = 0;
  private registration: OverlayRegistration = Object.freeze({
    trigger: null,
    anchor: null,
    content: null,
  });

  private readonly openState = createObservedHandle(false);
  private viewActive = false;
  private globalMount: OverlayGlobalMount | null = null;
  private modalLock: OverlayModal | null = null;
  private layerScheduler: OverlayLayerScheduler | null = null;
  private portalLease: HostResourceLease | null = null;
  private mountedEpoch = 0;
  private reconcilingView = false;
  private reconcileViewAgain = false;
  private anchorPart: AnatomyPartView | null = null;
  private inputAnchor: import('@proto.ui/core').InputOriginAnchor | null = null;
  private layerLease: HostResourceLease | null = null;
  private modalLease: HostResourceLease | null = null;
  private readonly boundaryDisposers: Record<
    'trigger' | 'anchor' | 'content',
    (() => void) | null
  > = {
    trigger: null,
    anchor: null,
    content: null,
  };
  private readonly offBoundaryOutside: (() => void) | null;
  private escapeSamplingInstalled = false;
  private escapeScope: object | null = null;
  private leaveEscapeScope: (() => void) | null = null;
  private readonly escapeOwner = {};

  private syncEscapeCandidate(): void {
    const scope =
      this.isOpen() && this.viewActive && this.mountPhase === 'mounted' && this.config.closeOnEscape
        ? (this.eventPort.getGlobalInputScope?.() ?? null)
        : null;
    if (scope === this.escapeScope) return;
    this.leaveEscapeScope?.();
    this.escapeScope = scope;
    this.leaveEscapeScope = scope ? joinEscapeScope(scope, this.escapeOwner) : null;
  }

  constructor(
    caps: CapsVaultView,
    prototypeName: string,
    boundary: BoundaryHandle<any>,
    private readonly boundaryPort: BoundaryPort,
    private readonly eventPort: EventPort,
    private readonly anatomyPort: AnatomyPort,
    private readonly anchoredPosition: AnchoredPositionHandle,
    private readonly availableSpace: AvailableSpaceHandle | null = null
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    this.boundary = boundary;
    this.refreshHostCaps();
    this.offBoundaryOutside = this.boundary.subscribeOutside((event) => {
      if (!this.isOpen()) return;
      if (event.observation === 'focus.move') {
        if (this.config.closeOnFocusOutside) this.close('focus.outside');
        return;
      }
      if (!this.config.closeOnOutsidePress) return;
      this.close('outside.press');
    });
  }

  private installDismissSampling(): void {
    if (this.config.closeOnOutsidePress) {
      this.boundaryPort.observe('pointer.press');
    }
    if (this.config.closeOnFocusOutside) {
      this.boundaryPort.observe('focus.move');
    }
    if (this.config.closeOnEscape && !this.escapeSamplingInstalled) {
      this.escapeSamplingInstalled = true;
      this.eventPort.onGlobal('key.down', (event) => {
        if (!this.isOpen() || !this.config.closeOnEscape) return;
        if (event.key !== 'Escape') return;
        const input = this.eventPort.getInputContext?.(event);
        if (!input || this.escapeScope !== input.scope) return;
        if (!ownsEscapeSample(input.scope, input.sample, this.escapeOwner)) return;
        this.close('escape');
      });
    }
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.refreshHostCaps();
    this.syncEscapeCandidate();
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.viewReconciliationVersion += 1;
    this.leaveEscapeScope?.();
    this.leaveEscapeScope = null;
    this.escapeScope = null;
    this.teardownMountedViewSideEffects();
    this.clearBoundaryRegistrations();
    this.offBoundaryOutside?.();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    if (this.mountPhase !== phase || this.mountedEpoch !== epoch) {
      this.viewReconciliationVersion += 1;
    }
    super.onMountPhase(phase, epoch);
    this.mountedEpoch = epoch;
    this.syncEscapeCandidate();
    if (phase === 'unmounting' || phase === 'detached') {
      this.teardownMountedViewSideEffects();
      return;
    }
    if (phase === 'mounted') {
      if (this.viewActive) this.syncViewSideEffects();
    }
  }

  private refreshHostCaps(): void {
    this.deferResourceReentry(() => this.refreshCurrentHostCaps());
  }

  private refreshCurrentHostCaps(): void {
    const epoch = this.caps.epoch;
    const globalMount = this.caps.has(OVERLAY_GLOBAL_MOUNT_CAP)
      ? this.caps.get(OVERLAY_GLOBAL_MOUNT_CAP)
      : null;
    const modalLock = this.caps.has(OVERLAY_MODAL_CAP) ? this.caps.get(OVERLAY_MODAL_CAP) : null;
    const layerScheduler = this.caps.has(OVERLAY_LAYER_SCHEDULER_CAP)
      ? this.caps.get(OVERLAY_LAYER_SCHEDULER_CAP)
      : null;
    // Release through the provider that acquired each resource before replacing it.
    if (globalMount !== this.globalMount) this.unmountGlobalIfNeeded();
    if (epoch !== this.caps.epoch) return;
    if (modalLock !== this.modalLock) this.unlockModalIfNeeded();
    if (epoch !== this.caps.epoch) return;
    if (layerScheduler !== this.layerScheduler) this.clearLayer();
    if (epoch !== this.caps.epoch) return;
    this.globalMount = globalMount;
    this.modalLock = modalLock;
    this.layerScheduler = layerScheduler;
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  private ensureSetup(op: string) {
    this.sys?.ensureSetup(op);

    if (!this.sys && this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  private resolveHostElement(): unknown | null {
    if (this.caps.has(OVERLAY_TARGET_HOST_CAP)) {
      const epoch = this.caps.epoch;
      const version = this.viewReconciliationVersion;
      const registration = this.registration;
      const host = this.caps.get(OVERLAY_TARGET_HOST_CAP);
      const candidate = this.registration.content ?? host.root();
      const resolved =
        candidate !== null && typeof candidate === 'object' ? host.resolve(candidate) : null;
      if (
        epoch !== this.caps.epoch ||
        version !== this.viewReconciliationVersion ||
        registration !== this.registration
      )
        return null;
      if (resolved !== null && typeof resolved === 'object') {
        this.targetIssue = null;
        return resolved;
      }
      this.targetIssue = '[Overlay] host target unavailable or foreign';
      return null;
    }
    // Compatibility for existing Web-only providers. A native peer has no
    // HTMLElement global; absence is not permission to accept a foreign token.
    const candidate =
      this.registration.content ??
      (this.caps.has(HOST_ELEMENT_CAP) ? this.caps.get(HOST_ELEMENT_CAP) : null);
    if (typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement) {
      this.targetIssue = null;
      return candidate;
    }
    this.targetIssue = '[Overlay] host target capability unavailable';
    return null;
  }

  private mountGlobalIfNeeded(hostEl: unknown, current: () => boolean): void {
    const provider = this.globalMount;
    if (!this.config.portal || !provider || this.portalLease?.target === hostEl) return;
    this.unmountGlobalIfNeeded();
    if (!current()) return;
    const lease: HostResourceLease = {
      target: hostEl,
      acquiring: true,
      revoked: false,
      release: () => provider.unmount(hostEl),
    };
    this.portalLease = lease;
    let acquired = false;
    try {
      provider.mount(hostEl);
      acquired = true;
    } finally {
      lease.acquiring = false;
      if (!acquired || lease.revoked || !current() || this.portalLease !== lease) {
        if (this.portalLease === lease) this.portalLease = null;
        revokeHostResource(lease);
      }
    }
  }

  private unmountGlobalIfNeeded(): void {
    const lease = this.portalLease;
    this.portalLease = null;
    if (lease) revokeHostResource(lease);
  }

  private applyLayerIfNeeded(hostEl: unknown, current: () => boolean): void {
    const provider = this.layerScheduler;
    if (!provider || this.layerLease?.target === hostEl) return;
    this.clearLayer();
    if (!current()) return;
    const lease: HostResourceLease = {
      target: hostEl,
      acquiring: true,
      revoked: false,
      release: null,
    };
    this.layerLease = lease;
    let acquired = false;
    try {
      lease.release = provider.attach(hostEl, {
        role: this.config.layerRole,
        offset: this.config.layerOffset,
        modal: this.config.modal,
        portal: this.config.portal,
        meta: this.config.meta,
      });
      acquired = true;
    } finally {
      lease.acquiring = false;
      if (!acquired || lease.revoked || !current() || this.layerLease !== lease) {
        if (this.layerLease === lease) this.layerLease = null;
        revokeHostResource(lease);
      }
    }
  }

  private clearLayer(): void {
    const lease = this.layerLease;
    this.layerLease = null;
    if (lease) revokeHostResource(lease);
  }

  private lockModalIfNeeded(current: () => boolean): void {
    const provider = this.modalLock;
    if (!this.config.modal || !provider || this.modalLease || !current()) return;
    const lease: HostResourceLease = {
      acquiring: true,
      revoked: false,
      release: () => provider.unlock(),
    };
    this.modalLease = lease;
    let acquired = false;
    try {
      provider.lock();
      acquired = true;
    } finally {
      lease.acquiring = false;
      if (!acquired || lease.revoked || !current() || this.modalLease !== lease) {
        if (this.modalLease === lease) this.modalLease = null;
        revokeHostResource(lease);
      }
    }
  }

  private unlockModalIfNeeded(): void {
    const lease = this.modalLease;
    this.modalLease = null;
    if (lease) revokeHostResource(lease);
  }

  private currentViewGuard(): () => boolean {
    const version = this.viewReconciliationVersion;
    const epoch = this.caps.epoch;
    const mountedEpoch = this.mountedEpoch;
    return () =>
      version === this.viewReconciliationVersion &&
      epoch === this.caps.epoch &&
      mountedEpoch === this.mountedEpoch &&
      this.mountPhase === 'mounted' &&
      this.viewActive;
  }

  private syncViewSideEffects(): void {
    // Host callbacks can replace providers or detach/re-enter synchronously.
    // Finish retiring their in-flight lease before acquiring the next one.
    if (this.reconcilingView) {
      this.reconcileViewAgain = true;
      return;
    }
    this.reconcilingView = true;
    try {
      do {
        this.reconcileViewAgain = false;
        this.syncCurrentViewSideEffects();
      } while (this.reconcileViewAgain && this.mountPhase === 'mounted' && this.viewActive);
    } finally {
      this.reconcilingView = false;
    }
  }

  private syncCurrentViewSideEffects(): void {
    const validView = this.currentViewGuard();
    if (!validView()) return;
    this.syncAnchorPartRegistration();
    if (!validView()) return;
    const registration = this.registration;
    const config = this.config;
    const current = () =>
      validView() && registration === this.registration && config === this.config;
    const hostEl = this.resolveHostElement();
    if (!current()) return;
    if (!hostEl) {
      this.teardownMountedViewSideEffects();
      return;
    }
    this.mountGlobalIfNeeded(hostEl, current);
    if (!current()) return;
    this.applyLayerIfNeeded(hostEl, current);
    if (!current()) return;
    this.syncAnchoredPosition(hostEl, current);
    if (!current()) return;
    this.lockModalIfNeeded(current);
  }

  private deferResourceReentry(work: () => void): void {
    if (this.reconcilingView) {
      work();
      return;
    }
    this.reconcilingView = true;
    try {
      work();
    } finally {
      this.reconcilingView = false;
    }
    if (this.reconcileViewAgain) this.syncViewSideEffects();
  }

  private deactivateViewSideEffects(): void {
    this.deferResourceReentry(() => {
      this.anchoredPosition.disconnect();
      this.availableSpace?.disconnect();
      this.unlockModalIfNeeded();
    });
  }

  private teardownMountedViewSideEffects(): void {
    this.deferResourceReentry(() => {
      this.clearLayer();
      this.anchoredPosition.disconnect();
      this.availableSpace?.disconnect();
      this.unmountGlobalIfNeeded();
      this.unlockModalIfNeeded();
    });
  }

  private setOpen(next: boolean, reason?: OverlayReason) {
    this.lastReason = reason;

    const wasOpen = this.openState.handle.get();
    if (Object.is(wasOpen, next)) {
      if (next && this.viewActive) this.syncViewSideEffects();
      return;
    }

    if (!next) {
      this.leaveEscapeScope?.();
      this.leaveEscapeScope = null;
      this.escapeScope = null;
    }
    const revision = ++this.openRevision;
    this.openState.set(next, reason);
    if (revision !== this.openRevision) return;
    this.syncEscapeCandidate();

    if (next) {
      this.boundary.setStackActive(true);
      return;
    }

    this.boundary.setStackActive(false);
  }

  markPresenceBound(): void {
    this.presenceBound = true;
  }

  hasPresenceBinding(): boolean {
    return this.presenceBound;
  }

  setViewActive(active: boolean): void {
    if (Object.is(this.viewActive, active)) {
      return;
    }

    this.viewActive = active;
    this.syncEscapeCandidate();
    this.viewReconciliationVersion += 1;
    if (active) {
      if (this.mountPhase === 'mounted') this.reconcileViewResourcesAfterCallback();
      return;
    }
    this.deactivateViewSideEffects();
  }

  reconcileViewResourcesAfterCallback(): void {
    if (!this.viewActive) return;
    const version = this.viewReconciliationVersion;
    const reconcile = () => {
      if (!this.viewActive || version !== this.viewReconciliationVersion) return;
      this.syncViewSideEffects();
    };
    if (this.sys.deferAfterCallback) {
      this.sys.deferAfterCallback(reconcile);
      return;
    }
    reconcile();
  }

  private replaceRegistration(next: Partial<OverlayRegistration>) {
    const prev = this.registration;
    this.registration = Object.freeze({
      trigger: typeof next.trigger === 'undefined' ? this.registration.trigger : next.trigger,
      anchor: typeof next.anchor === 'undefined' ? this.registration.anchor : next.anchor,
      content: typeof next.content === 'undefined' ? this.registration.content : next.content,
    });
    this.syncBoundaryRegistration('trigger', prev.trigger, this.registration.trigger);
    this.syncBoundaryRegistration('anchor', prev.anchor, this.registration.anchor);
    this.syncBoundaryRegistration('content', prev.content, this.registration.content);
  }

  private syncBoundaryRegistration(
    role: 'trigger' | 'anchor' | 'content',
    prevTarget: unknown,
    nextTarget: unknown
  ) {
    if (Object.is(prevTarget, nextTarget)) return;
    this.boundaryDisposers[role]?.();
    this.boundaryDisposers[role] = null;
    if (typeof nextTarget === 'undefined' || nextTarget === null) return;
    this.boundaryDisposers[role] = this.boundary.registerRegion(nextTarget, { role });
  }

  private clearBoundaryRegistrations(): void {
    this.boundaryDisposers.trigger?.();
    this.boundaryDisposers.anchor?.();
    this.boundaryDisposers.content?.();
    this.boundaryDisposers.trigger = null;
    this.boundaryDisposers.anchor = null;
    this.boundaryDisposers.content = null;
  }

  private patchValue<K extends keyof OverlayConfig>(field: K, value: OverlayConfigPatch[K]): void {
    if (typeof value === 'undefined') return;
    pushOverrideWarning(this.warnings, String(field), this.config[field], value);
    this.config = Object.freeze({
      ...this.config,
      [field]: value,
    }) as OverlayConfig;
  }

  configure(patch: OverlayConfigPatch): void {
    this.ensureSetup('overlay.configure');

    this.patchValue('defaultOpen', patch.defaultOpen);
    this.patchValue('closeOnEscape', patch.closeOnEscape);
    this.patchValue('closeOnOutsidePress', patch.closeOnOutsidePress);
    this.patchValue('closeOnFocusOutside', patch.closeOnFocusOutside);
    this.patchValue('closeOnAnchorPress', patch.closeOnAnchorPress);
    this.patchValue('closeOnTriggerPress', patch.closeOnTriggerPress);
    this.patchValue('placement', patch.placement);
    this.patchValue('align', patch.align);
    this.patchValue('sideOffset', patch.sideOffset);
    this.patchValue('alignOffset', patch.alignOffset);
    this.patchValue('anchored', patch.anchored);
    this.patchValue('availableSpace', patch.availableSpace);
    this.patchValue('strategy', patch.strategy);
    this.patchValue('avoidCollisions', patch.avoidCollisions);
    this.patchValue('collisionBoundary', patch.collisionBoundary);
    this.patchValue('collisionPadding', patch.collisionPadding);
    this.patchValue('excludeAnchorTranslation', patch.excludeAnchorTranslation);
    this.patchValue('entry', patch.entry);
    this.patchValue('restore', patch.restore);
    this.patchValue('portal', patch.portal);
    this.patchValue('modal', patch.modal);
    this.patchValue('layerRole', patch.layerRole);
    this.patchValue('layerOffset', patch.layerOffset);

    if (typeof patch.meta !== 'undefined') {
      this.config = Object.freeze({
        ...this.config,
        meta: mergeMeta(this.config.meta, patch.meta),
      });
    }

    this.installDismissSampling();

    if (this.config.defaultOpen) {
      this.setOpen(true, 'programmatic');
    }
  }

  updatePosition(patch: OverlayPositionPatch): void {
    const assign = <K extends keyof OverlayConfig>(field: K, value: OverlayConfigPatch[K]) => {
      if (typeof value === 'undefined') return;
      this.config = Object.freeze({ ...this.config, [field]: value }) as OverlayConfig;
    };
    assign('placement', patch.placement);
    assign('align', patch.align);
    assign('sideOffset', patch.sideOffset);
    assign('alignOffset', patch.alignOffset);
    assign('strategy', patch.strategy);
    assign('avoidCollisions', patch.avoidCollisions);
    assign('collisionBoundary', patch.collisionBoundary);
    assign('collisionPadding', patch.collisionPadding);
    assign('excludeAnchorTranslation', patch.excludeAnchorTranslation);
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  open(reason?: OverlayReason): void {
    this.setOpen(true, reason);
  }

  close(reason?: OverlayReason): void {
    this.setOpen(false, reason);
  }

  toggle(reason?: OverlayReason): void {
    this.setOpen(!this.openState.handle.get(), reason);
  }

  isOpen(): boolean {
    return this.openState.handle.get();
  }

  getConfig(): OverlayConfig {
    return this.config;
  }

  getWarnings(): readonly string[] {
    return Object.freeze([...this.warnings, ...(this.targetIssue ? [this.targetIssue] : [])]);
  }

  getLastReason(): OverlayReason | undefined {
    return this.lastReason;
  }

  getRegistration(): OverlayRegistration {
    return this.registration;
  }

  getPositionSnapshot(): AnchoredPositionSnapshot | null {
    return this.anchoredPosition.getSnapshot();
  }

  private resolveAnchorTarget(): unknown | null {
    if (this.anchorPart) {
      const target = this.anatomyPort.resolvePartTarget(this.anchorPart);
      if (target) return target;
    }
    return this.registration.anchor ?? this.registration.trigger;
  }

  private syncAnchorPartRegistration(): void {
    if (!this.anchorPart) return;
    const target = this.anatomyPort.resolvePartTarget(this.anchorPart);
    this.replaceRegistration({ anchor: target ?? null });
  }

  private syncAnchoredPosition(availableTarget: unknown, current: () => boolean): void {
    if (!current()) return;
    if (
      this.config.availableSpace &&
      this.viewActive &&
      this.mountPhase === 'mounted' &&
      availableTarget
    ) {
      this.availableSpace?.connect({ target: availableTarget, boundary: 'root-content' });
    } else this.availableSpace?.disconnect();
    if (!current()) return;
    if (!this.config.anchored || !this.viewActive || this.mountPhase !== 'mounted') {
      this.anchoredPosition.disconnect();
      return;
    }
    const anchor = this.inputAnchor ?? this.resolveAnchorTarget();
    if (!current()) return;
    const floating = availableTarget;
    if (!anchor || !floating) {
      this.anchoredPosition.disconnect();
      return;
    }
    this.anchoredPosition.connect({
      anchor,
      floating,
      config: {
        side: this.config.placement,
        align: this.config.align,
        sideOffset: this.config.sideOffset,
        alignOffset: this.config.alignOffset,
        strategy: this.config.strategy,
        avoidCollisions: this.config.avoidCollisions,
        collisionBoundary: this.config.collisionBoundary,
        collisionPadding: this.config.collisionPadding,
        excludeAnchorTranslation: this.config.excludeAnchorTranslation,
      },
    });
  }

  registerTrigger(target: unknown): void {
    this.replaceRegistration({ trigger: target });
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  registerAnchor(target: unknown): void {
    this.anchorPart = null;
    this.replaceRegistration({ anchor: target });
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  registerInputAnchor(anchor: import('@proto.ui/core').InputOriginAnchor | null): void {
    if (this.inputAnchor === anchor) return;
    this.inputAnchor = anchor;
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  registerAnchorPart(part: AnatomyPartView): void {
    this.anchorPart = part;
    this.syncAnchorPartRegistration();
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  registerContent(target: unknown): void {
    this.replaceRegistration({ content: target });

    if (!this.viewActive) return;
    this.reconcileViewResourcesAfterCallback();
  }

  readonly handle: OverlayModuleHandle<any> = {
    open: this.openState.handle,
    isOpen: () => this.isOpen(),
    openOverlay: (reason?: OverlayReason) => this.open(reason),
    close: (reason?: OverlayReason) => this.close(reason),
    toggle: (reason?: OverlayReason) => this.toggle(reason),
    configure: (patch: OverlayConfigPatch) => this.configure(patch),
    updatePosition: (patch: OverlayPositionPatch) => this.updatePosition(patch),
    registerTrigger: (target: unknown) => this.registerTrigger(target),
    registerAnchor: (target: unknown) => this.registerAnchor(target),
    registerInputAnchor: (anchor) => this.registerInputAnchor(anchor),
    registerAnchorPart: (part: AnatomyPartView) => this.registerAnchorPart(part),
    registerContent: (target: unknown) => this.registerContent(target),
    getPositionSnapshot: () => this.getPositionSnapshot(),
  };
}
