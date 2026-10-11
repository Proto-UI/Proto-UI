import type {
  BoundaryClassification,
  BoundaryConfig,
  BoundaryConfigPatch,
  BoundaryHandle,
  BoundaryOutsideEvent,
  BoundaryObservation,
  BoundaryRegion,
  BoundaryRegionOptions,
  BoundarySample,
  MountPhase,
  ProtoPhase,
} from '@proto.ui/core';
import { HOST_ELEMENT_CAP, illegalPhase } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { EventPort } from '@proto.ui/module-event';
import { BOUNDARY_HOST_BRIDGE_CAP, type BoundaryHostBridge } from './caps';

const DEFAULT_CONFIG: BoundaryConfig = Object.freeze({});

type BoundaryRegionRecord = BoundaryRegion & {
  id: number;
};

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
  warnings.push(`[Boundary] ${field} overridden: ${String(prev)} -> ${String(next)}`);
}

type StackEntry = { suspended: boolean };
type PointerSequence = {
  members: Set<StackEntry>;
  sample?: BoundarySample;
  outside: Set<StackEntry>;
  dispatches: number;
};
const pointerScopes = new WeakMap<object, PointerSequence>();

const STACK_CENTER = (() => {
  const order: StackEntry[] = [];
  const sampleOwners = new WeakMap<object, StackEntry | null>();

  return {
    activate(entry: StackEntry) {
      const existingIndex = order.indexOf(entry);
      if (existingIndex >= 0) {
        order.splice(existingIndex, 1);
      }
      order.push(entry);
    },
    deactivate(entry: StackEntry) {
      const existingIndex = order.indexOf(entry);
      if (existingIndex >= 0) {
        order.splice(existingIndex, 1);
      }
    },
    topForSample(sample?: BoundarySample): StackEntry | null {
      const native = sample?.nativeEvent;
      const identity =
        native && (typeof native === 'object' || typeof native === 'function')
          ? (native as object)
          : sample;
      if (identity && sampleOwners.has(identity)) return sampleOwners.get(identity) ?? null;
      let owner: StackEntry | null = null;
      for (let index = order.length - 1; index >= 0; index--) {
        if (!order[index].suspended) {
          owner = order[index];
          break;
        }
      }
      // Every Event listener wraps the same native sample independently. Retain
      // its original owner even when that owner's outside callback closes it.
      if (identity) sampleOwners.set(identity, owner);
      return owner;
    },
  };
})();

export class BoundaryModuleImpl extends ModuleBase {
  private config: BoundaryConfig = DEFAULT_CONFIG;
  private readonly prototypeName: string;
  private readonly stackEntry: StackEntry = { suspended: false };
  private readonly warnings: string[] = [];
  private readonly outsideSubscribers = new Set<(event: BoundaryOutsideEvent) => void>();
  private hostBridge: BoundaryHostBridge | null = null;
  private hostElement: HTMLElement | null = null;
  private nextRegionId = 1;
  private regions: BoundaryRegionRecord[] = [];
  private stackActive = false;
  private observingPointerDown = false;
  private pointerSamplingInstalled = false;
  private observingFocusMove = false;
  private pointerScope: object | null = null;
  private pointerSequence: PointerSequence | null = null;

  constructor(
    caps: any,
    prototypeName: string,
    private readonly eventPort: EventPort
  ) {
    super(caps);
    this.prototypeName = prototypeName;
    this.refreshHostCaps();
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.refreshHostCaps();
    this.syncPointerScope();
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.stackEntry.suspended = true;
    this.syncPointerScope();
    this.setStackActive(false);
    this.regions = [];
    this.outsideSubscribers.clear();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'unmounting' || phase === 'detached') {
      this.stackEntry.suspended = true;
      this.syncPointerScope();
      // View suspension removes eligibility, not the logical activation rank.
      return;
    }
    if (phase === 'mounted') {
      this.stackEntry.suspended = false;
      this.syncPointerScope();
    }
  }

  private refreshHostCaps(): void {
    this.hostElement = this.caps.has(HOST_ELEMENT_CAP) ? this.caps.get(HOST_ELEMENT_CAP) : null;
    this.hostBridge = this.caps.has(BOUNDARY_HOST_BRIDGE_CAP)
      ? this.caps.get(BOUNDARY_HOST_BRIDGE_CAP)
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

  configure(patch: BoundaryConfigPatch): void {
    this.ensureSetup('boundary.configure');

    if (typeof patch.debugLabel !== 'undefined') {
      pushOverrideWarning(this.warnings, 'debugLabel', this.config.debugLabel, patch.debugLabel);
      this.config = Object.freeze({
        ...this.config,
        debugLabel: patch.debugLabel,
      });
    }

    if (typeof patch.meta !== 'undefined') {
      this.config = Object.freeze({
        ...this.config,
        meta: mergeMeta(this.config.meta, patch.meta),
      });
    }
  }

  setStackActive(active: boolean): void {
    this.stackActive = active;

    if (active) {
      STACK_CENTER.activate(this.stackEntry);
      return;
    }

    STACK_CENTER.deactivate(this.stackEntry);
  }

  registerRegion(target: unknown, options: BoundaryRegionOptions = {}): () => void {
    const id = this.nextRegionId++;
    this.regions = this.regions.concat([
      Object.freeze({
        id,
        target,
        role: options.role,
        meta: options.meta,
      }),
    ]);

    return () => {
      this.regions = this.regions.filter((region) => region.id !== id);
    };
  }

  unregisterRegion(target: unknown): void {
    this.regions = this.regions.filter((region) => region.target !== target);
  }

  getRegions(): readonly BoundaryRegion[] {
    const explicit = this.regions.map(({ target, role, meta }) =>
      Object.freeze({
        target,
        ...(typeof role === 'undefined' ? {} : { role }),
        ...(typeof meta === 'undefined' ? {} : { meta }),
      })
    );

    if (
      this.hostElement &&
      !explicit.some((region) => Object.is(region.target, this.hostElement))
    ) {
      return Object.freeze([{ target: this.hostElement, role: 'content' as const }, ...explicit]);
    }

    return explicit;
  }

  classify(sample?: BoundarySample): BoundaryClassification {
    const target = sample?.target;
    if (
      typeof target !== 'undefined' &&
      this.regions.some((region) => Object.is(region.target, target))
    ) {
      return 'inside';
    }
    if (this.hostBridge) {
      return this.hostBridge.classify({
        regions: this.getRegions(),
        sample,
      });
    }
    return 'unknown';
  }

  notify(sample?: BoundarySample): BoundaryClassification {
    return this.notifyObserved(sample);
  }

  private notifyObserved(
    sample?: BoundarySample,
    observation?: BoundaryObservation,
    ownerSample = sample
  ): BoundaryClassification {
    if (this.stackEntry.suspended) return 'unknown';
    const topBoundary = this.stackActive ? STACK_CENTER.topForSample(ownerSample) : null;
    const epoch = this.caps.epoch;
    const regions = this.regions;
    const classification = this.classify(sample);
    if (this.stackEntry.suspended || epoch !== this.caps.epoch || regions !== this.regions)
      return 'unknown';
    if (classification !== 'outside') return classification;
    if (this.stackActive) {
      if (topBoundary !== null && topBoundary !== this.stackEntry) {
        return 'unknown';
      }
    }
    // Mark before callbacks: a controlled owner may synchronously reject close
    // or move focus while the pointer dispatch is still running.
    if (observation === 'pointer.press') this.pointerSequence?.outside.add(this.stackEntry);
    const event = Object.freeze({
      classification,
      ...(observation ? { observation } : {}),
      sample,
    }) satisfies BoundaryOutsideEvent;
    for (const subscriber of this.outsideSubscribers) {
      subscriber(event);
    }
    return classification;
  }

  private syncPointerScope(): void {
    const scope =
      this.pointerSamplingInstalled && !this.stackEntry.suspended && this.mountPhase === 'mounted'
        ? (this.eventPort.getGlobalInputScope?.() ?? this.stackEntry)
        : null;
    if (scope === this.pointerScope) return;
    const previous = this.pointerSequence;
    if (previous && this.pointerScope) {
      previous.members.delete(this.stackEntry);
      if (!previous.members.size && !previous.dispatches) pointerScopes.delete(this.pointerScope);
    }
    this.pointerScope = scope;
    this.pointerSequence = null;
    if (!scope) return;
    let sequence = pointerScopes.get(scope);
    if (!sequence) {
      sequence = { members: new Set(), outside: new Set(), dispatches: 0 };
      pointerScopes.set(scope, sequence);
    }
    sequence.members.add(this.stackEntry);
    this.pointerSequence = sequence;
  }

  private withPointerScope(callback: (sequence: PointerSequence) => void): void {
    const scope = this.pointerScope;
    const sequence = this.pointerSequence;
    if (!scope || !sequence) return;
    sequence.dispatches++;
    try {
      callback(sequence);
    } finally {
      sequence.dispatches--;
      if (!sequence.members.size && !sequence.dispatches) pointerScopes.delete(scope);
    }
  }

  private installPointerSampling(): void {
    if (this.pointerSamplingInstalled) return;
    this.pointerSamplingInstalled = true;
    this.eventPort.onGlobal('host:pointerdown', (nativeEvent) => {
      this.withPointerScope((sequence) => {
        if (!sequence.sample || sequence.sample.nativeEvent !== nativeEvent) {
          const target =
            nativeEvent && typeof nativeEvent === 'object' && 'target' in nativeEvent
              ? (nativeEvent as { target?: unknown }).target
              : undefined;
          sequence.sample = { type: 'pointerdown', target, nativeEvent };
          sequence.outside.clear();
        }
        // All boundaries in the input scope share this reservation, including
        // focus events dispatched reentrantly before another pointer listener.
        STACK_CENTER.topForSample(sequence.sample);
        if (this.observingPointerDown) this.notifyObserved(sequence.sample, 'pointer.press');
      });
    });
    // A fresh key/press, release or cancellation ends suppression. No timeout,
    // focus restoration, or author-side scheduling guesses browser defaults.
    for (const type of [
      'host:pointerup',
      'host:pointercancel',
      'host:keydown',
      'host:blur',
    ] as const) {
      this.eventPort.onGlobal(type, () => {
        if (!this.pointerSequence) return;
        this.pointerSequence.sample = undefined;
        this.pointerSequence.outside.clear();
      });
    }
  }

  observe(observation: BoundaryObservation): void {
    this.ensureSetup('boundary.observe');
    if (observation === 'pointer.press') {
      this.observingPointerDown = true;
      this.installPointerSampling();
      return;
    }
    if (observation !== 'focus.move' || this.observingFocusMove) return;
    this.observingFocusMove = true;
    this.installPointerSampling();
    this.eventPort.onGlobal('host:focusin', (nativeEvent) => {
      this.withPointerScope((sequence) => {
        const epoch = this.caps.epoch;
        const sample = this.hostBridge?.sampleFocus?.(nativeEvent);
        if (!sample || epoch !== this.caps.epoch || sequence !== this.pointerSequence) return;
        // Preserve browser focus and emit at most one outside intent per press,
        // including when a controlled owner leaves the Overlay logically open.
        if (sequence.sample && sequence.outside.has(this.stackEntry)) return;
        this.notifyObserved(sample, 'focus.move', sequence.sample ?? sample);
      });
    });
  }

  subscribeOutside(cb: (event: BoundaryOutsideEvent) => void): () => void {
    this.outsideSubscribers.add(cb);
    return () => {
      this.outsideSubscribers.delete(cb);
    };
  }

  getConfig(): BoundaryConfig {
    return this.config;
  }

  getWarnings(): readonly string[] {
    return Object.freeze([
      ...this.warnings,
      ...(this.observingFocusMove && !this.hostBridge?.sampleFocus
        ? ['[Boundary] current focus observation unavailable on this host']
        : []),
    ]);
  }

  readonly handle: BoundaryHandle<any> = {
    configure: (patch: BoundaryConfigPatch) => this.configure(patch),
    observe: (observation: BoundaryObservation) => this.observe(observation),
    setStackActive: (active: boolean) => this.setStackActive(active),
    registerRegion: (target: unknown, options?: BoundaryRegionOptions) =>
      this.registerRegion(target, options),
    unregisterRegion: (target: unknown) => this.unregisterRegion(target),
    classify: (sample?: BoundarySample) => this.classify(sample),
    notify: (sample?: BoundarySample) => this.notify(sample),
    subscribeOutside: (cb: (event: BoundaryOutsideEvent) => void) => this.subscribeOutside(cb),
  };
}
