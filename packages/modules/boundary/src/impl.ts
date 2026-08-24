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

const STACK_CENTER = (() => {
  const order: number[] = [];

  return {
    activate(id: number) {
      const existingIndex = order.indexOf(id);
      if (existingIndex >= 0) {
        order.splice(existingIndex, 1);
      }
      order.push(id);
    },
    deactivate(id: number) {
      const existingIndex = order.indexOf(id);
      if (existingIndex >= 0) {
        order.splice(existingIndex, 1);
      }
    },
    top(): number | null {
      return order.length > 0 ? (order[order.length - 1] ?? null) : null;
    },
  };
})();

export class BoundaryModuleImpl extends ModuleBase {
  private static nextBoundaryInstanceId = 1;
  private config: BoundaryConfig = DEFAULT_CONFIG;
  private readonly prototypeName: string;
  private readonly boundaryInstanceId = BoundaryModuleImpl.nextBoundaryInstanceId++;
  private readonly warnings: string[] = [];
  private readonly outsideSubscribers = new Set<(event: BoundaryOutsideEvent) => void>();
  private hostBridge: BoundaryHostBridge | null = null;
  private hostElement: HTMLElement | null = null;
  private nextRegionId = 1;
  private regions: BoundaryRegionRecord[] = [];
  private stackActive = false;
  private suspended = false;
  private observingPointerDown = false;

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
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.setStackActive(false);
    this.regions = [];
    this.outsideSubscribers.clear();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'unmounting' || phase === 'detached') {
      this.suspended = true;
      STACK_CENTER.deactivate(this.boundaryInstanceId);
      return;
    }
    if (phase === 'mounted') {
      this.suspended = false;
      if (this.stackActive) STACK_CENTER.activate(this.boundaryInstanceId);
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
    if (Object.is(this.stackActive, active)) {
      if (active && !this.suspended) {
        STACK_CENTER.activate(this.boundaryInstanceId);
      }
      return;
    }

    this.stackActive = active;

    if (active && !this.suspended) {
      STACK_CENTER.activate(this.boundaryInstanceId);
      return;
    }

    STACK_CENTER.deactivate(this.boundaryInstanceId);
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
    if (this.suspended) return 'unknown';
    const classification = this.classify(sample);
    if (classification !== 'outside') return classification;
    if (this.stackActive) {
      const topBoundaryId = STACK_CENTER.top();
      if (topBoundaryId !== null && topBoundaryId !== this.boundaryInstanceId) {
        return 'unknown';
      }
    }
    const event = Object.freeze({
      classification,
      sample,
    }) satisfies BoundaryOutsideEvent;
    for (const subscriber of this.outsideSubscribers) {
      subscriber(event);
    }
    return classification;
  }

  observe(observation: BoundaryObservation): void {
    this.ensureSetup('boundary.observe');
    if (observation !== 'pointer.press') return;
    if (this.observingPointerDown) return;
    this.observingPointerDown = true;
    this.eventPort.onGlobal('host:pointerdown', (nativeEvent) => {
      const target =
        nativeEvent && typeof nativeEvent === 'object' && 'target' in nativeEvent
          ? (nativeEvent as { target?: unknown }).target
          : undefined;
      this.notify({ type: 'pointerdown', target, nativeEvent });
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
    return Object.freeze(this.warnings.slice());
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
