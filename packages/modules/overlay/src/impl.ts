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

export class OverlayModuleImpl extends ModuleBase {
  private config: OverlayConfig = DEFAULT_CONFIG;
  private presenceBound = false;
  private readonly prototypeName: string;
  private readonly warnings: string[] = [];
  private readonly boundary: BoundaryHandle<any>;
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
  private mountedHost: HTMLElement | null = null;
  private anchorPart: AnatomyPartView | null = null;
  private layerDetach: (() => void) | null = null;
  private layerHost: HTMLElement | null = null;
  private modalLocked = false;
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

  constructor(
    caps: CapsVaultView,
    prototypeName: string,
    boundary: BoundaryHandle<any>,
    private readonly boundaryPort: BoundaryPort,
    private readonly eventPort: EventPort,
    private readonly anatomyPort: AnatomyPort,
    private readonly anchoredPosition: AnchoredPositionHandle
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    this.boundary = boundary;
    this.refreshHostCaps();
    this.offBoundaryOutside = this.boundary.subscribeOutside(() => {
      if (!this.isOpen()) return;
      if (!this.config.closeOnOutsidePress) return;
      this.close('outside.press');
    });
  }

  private installDismissSampling(): void {
    if (this.config.closeOnOutsidePress) {
      this.boundaryPort.observe('pointer.press');
    }
    if (this.config.closeOnEscape && !this.escapeSamplingInstalled) {
      this.escapeSamplingInstalled = true;
      this.eventPort.onGlobal('key.down', (event) => {
        if (!this.isOpen() || !this.config.closeOnEscape) return;
        if (event.key !== 'Escape') return;
        this.close('escape');
      });
    }
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.refreshHostCaps();
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.teardownMountedViewSideEffects();
    this.clearBoundaryRegistrations();
    this.offBoundaryOutside?.();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'unmounting' || phase === 'detached') {
      this.teardownMountedViewSideEffects();
      this.boundary.setStackActive(false);
      return;
    }
    if (phase === 'mounted') {
      if (this.isOpen()) this.boundary.setStackActive(true);
      if (this.viewActive) this.syncViewSideEffects();
    }
  }

  private refreshHostCaps(): void {
    this.globalMount = this.caps.has(OVERLAY_GLOBAL_MOUNT_CAP)
      ? this.caps.get(OVERLAY_GLOBAL_MOUNT_CAP)
      : null;
    this.modalLock = this.caps.has(OVERLAY_MODAL_CAP) ? this.caps.get(OVERLAY_MODAL_CAP) : null;
    this.layerScheduler = this.caps.has(OVERLAY_LAYER_SCHEDULER_CAP)
      ? this.caps.get(OVERLAY_LAYER_SCHEDULER_CAP)
      : null;
  }

  private ensureSetup(op: string) {
    this.sys?.ensureSetup(op);

    if (!this.sys && this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  private resolveHostElement(): HTMLElement | null {
    let hostEl: HTMLElement | null =
      this.registration.content instanceof HTMLElement ? this.registration.content : null;
    if (hostEl) return hostEl;
    if (!this.caps.has(HOST_ELEMENT_CAP)) return null;
    const capHost = this.caps.get(HOST_ELEMENT_CAP);
    return capHost instanceof HTMLElement ? capHost : null;
  }

  private mountGlobalIfNeeded(hostEl: HTMLElement): void {
    if (!this.config.portal || !this.globalMount) return;

    if (this.mountedHost === hostEl) return;

    if (this.mountedHost && this.mountedHost !== hostEl) {
      this.globalMount.unmount(this.mountedHost);
      this.mountedHost = null;
    }

    this.globalMount.mount(hostEl);
    this.mountedHost = hostEl;
  }

  private unmountGlobalIfNeeded(): void {
    if (!this.mountedHost || !this.globalMount) return;
    this.globalMount.unmount(this.mountedHost);
    this.mountedHost = null;
  }

  private applyLayerIfNeeded(hostEl: HTMLElement): void {
    if (!this.layerScheduler) return;

    if (this.layerDetach && this.layerHost === hostEl) return;

    this.clearLayer();
    this.layerDetach = this.layerScheduler.attach(hostEl, {
      role: this.config.layerRole,
      offset: this.config.layerOffset,
      modal: this.config.modal,
      portal: this.config.portal,
      meta: this.config.meta,
    });
    this.layerHost = hostEl;
  }

  private clearLayer(): void {
    this.layerHost = null;
    if (!this.layerDetach) return;
    try {
      this.layerDetach();
    } finally {
      this.layerDetach = null;
    }
  }

  private lockModalIfNeeded(): void {
    if (!this.config.modal || !this.modalLock || this.modalLocked) return;
    this.modalLock.lock();
    this.modalLocked = true;
  }

  private unlockModalIfNeeded(): void {
    if (!this.modalLock || !this.modalLocked) return;
    this.modalLock.unlock();
    this.modalLocked = false;
  }

  private syncViewSideEffects(): void {
    if (this.mountPhase !== 'mounted') return;
    this.syncAnchorPartRegistration();
    const hostEl = this.resolveHostElement();
    if (hostEl) {
      this.mountGlobalIfNeeded(hostEl);
      this.applyLayerIfNeeded(hostEl);
    }
    this.syncAnchoredPosition();
    this.lockModalIfNeeded();
  }

  private deactivateViewSideEffects(): void {
    this.anchoredPosition.disconnect();
    this.unlockModalIfNeeded();
  }

  private teardownMountedViewSideEffects(): void {
    this.clearLayer();
    this.anchoredPosition.disconnect();
    this.unmountGlobalIfNeeded();
    this.unlockModalIfNeeded();
  }

  private setOpen(next: boolean, reason?: OverlayReason) {
    this.lastReason = reason;

    const wasOpen = this.openState.handle.get();
    if (Object.is(wasOpen, next)) {
      if (next) {
        this.boundary.setStackActive(true);
        if (this.viewActive) this.syncViewSideEffects();
      } else {
        this.boundary.setStackActive(false);
      }
      return;
    }

    this.openState.set(next, reason);

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
    this.viewReconciliationVersion += 1;
    if (active) {
      if (this.mountPhase === 'mounted') this.lockModalIfNeeded();
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
    if (this.viewActive) this.syncAnchoredPosition();
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
    return Object.freeze(this.warnings.slice());
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

  private syncAnchoredPosition(): void {
    if (!this.config.anchored || !this.viewActive || this.mountPhase !== 'mounted') {
      this.anchoredPosition.disconnect();
      return;
    }
    const anchor = this.resolveAnchorTarget();
    const floating = this.registration.content ?? this.resolveHostElement();
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

  registerAnchorPart(part: AnatomyPartView): void {
    this.anchorPart = part;
    this.syncAnchorPartRegistration();
    if (this.viewActive) this.reconcileViewResourcesAfterCallback();
  }

  registerContent(target: unknown): void {
    this.replaceRegistration({ content: target });

    if (!this.viewActive) return;

    const hostEl = this.resolveHostElement();
    if (!hostEl) return;
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
    registerAnchorPart: (part: AnatomyPartView) => this.registerAnchorPart(part),
    registerContent: (target: unknown) => this.registerContent(target),
    getPositionSnapshot: () => this.getPositionSnapshot(),
  };
}
