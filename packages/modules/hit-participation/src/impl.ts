import type {
  HitParticipationConfig,
  HitParticipationConfigPatch,
  HitParticipationHandle,
  HitParticipationMode,
  HitParticipationRegion,
  HitParticipationRegionOptions,
  MountPhase,
  ProtoPhase,
} from '@proto.ui/core';
import { HOST_ELEMENT_CAP, illegalPhase, snapshotStaticHitInset } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import { HIT_PARTICIPATION_HOST_BRIDGE_CAP, type HitParticipationHostBridge } from './caps';

const DEFAULT_CONFIG: HitParticipationConfig = Object.freeze({
  mode: 'participating',
});

type HitParticipationRegionRecord = HitParticipationRegion & {
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
  warnings.push(`[HitParticipation] ${field} overridden: ${String(prev)} -> ${String(next)}`);
}

export class HitParticipationModuleImpl extends ModuleBase {
  private config: HitParticipationConfig = DEFAULT_CONFIG;
  private readonly prototypeName: string;
  private readonly warnings: string[] = [];
  private hostBridge: HitParticipationHostBridge | null = null;
  private hostElement: HTMLElement | null = null;
  private readonly selfTarget = Object.freeze({});
  private nextRegionId = 1;
  private regions: HitParticipationRegionRecord[] = [];
  private suspended = false;

  constructor(caps: any, prototypeName: string) {
    super(caps);
    this.prototypeName = prototypeName;
    this.refreshHostCaps();
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.refreshHostCaps();
    this.syncHostBridge();
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase !== 'unmounted') return;
    this.clearHostBridge();
    this.regions = [];
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    if (phase === 'unmounting' || phase === 'detached') {
      this.suspended = true;
      this.clearHostBridge();
      return;
    }
    if (phase === 'mounted') {
      this.suspended = false;
      this.refreshHostCaps();
      this.syncHostBridge();
    }
  }

  private refreshHostCaps(): void {
    const nextBridge = this.caps.has(HIT_PARTICIPATION_HOST_BRIDGE_CAP)
      ? this.caps.get(HIT_PARTICIPATION_HOST_BRIDGE_CAP)
      : null;
    if (this.hostBridge && this.hostBridge !== nextBridge) this.clearHostBridge();
    this.hostElement = this.caps.has(HOST_ELEMENT_CAP) ? this.caps.get(HOST_ELEMENT_CAP) : null;
    this.hostBridge = nextBridge;
  }

  private ensureSetup(op: string) {
    this.sys?.ensureSetup(op);

    if (!this.sys && this.protoPhase !== 'setup') {
      throw illegalPhase(op, this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  private patchMode(mode: HitParticipationMode | undefined) {
    if (typeof mode === 'undefined') return;
    pushOverrideWarning(this.warnings, 'mode', this.config.mode, mode);
    this.config = Object.freeze({
      ...this.config,
      mode,
    });
  }

  configure(patch: HitParticipationConfigPatch): void {
    this.ensureSetup('hitParticipation.configure');

    const previous = this.config;
    const warningCount = this.warnings.length;
    try {
      const inset =
        patch.staticHitInset === null
          ? undefined
          : typeof patch.staticHitInset === 'undefined'
            ? this.config.staticHitInset
            : snapshotStaticHitInset(patch.staticHitInset);
      this.patchMode(patch.mode);
      if (typeof patch.staticHitInset !== 'undefined') {
        this.config = Object.freeze({ ...this.config, staticHitInset: inset });
      }

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

      this.syncHostBridge();
    } catch (error) {
      this.config = previous;
      this.warnings.length = warningCount;
      throw error;
    }
  }

  private ensureSelfLeaseLive(): void {
    if (
      this.protoPhase === 'unmounted' ||
      this.instancePhase === 'disposing' ||
      this.instancePhase === 'disposed'
    ) {
      throw illegalPhase('hitParticipation.registerSelfRegion', this.protoPhase, {
        prototypeName: this.prototypeName,
      });
    }
  }

  registerSelfRegion(options: HitParticipationRegionOptions = {}): () => void {
    this.ensureSelfLeaseLive();
    return this.registerRegion(this.selfTarget, options);
  }

  registerRegion(target: unknown, options: HitParticipationRegionOptions = {}): () => void {
    const id = this.nextRegionId++;
    // Read caller accessors once before selecting the current declaration list.
    // A getter may successfully acquire another lease; never overwrite that lease
    // with a receiver captured before the getter ran.
    const role = options.role;
    const mode = options.mode;
    const rawInset = options.staticHitInset;
    const meta = options.meta;
    const inset =
      rawInset === null
        ? undefined
        : rawInset === undefined
          ? this.config.staticHitInset
          : snapshotStaticHitInset(rawInset);
    const record = Object.freeze({
      id,
      target,
      role,
      mode: mode ?? this.config.mode,
      ...(inset ? { staticHitInset: inset } : {}),
      meta,
    });
    if (target === this.selfTarget) this.ensureSelfLeaseLive();
    this.replaceRegions(this.regions.concat([record]));
    return () => {
      this.replaceRegions(this.regions.filter((region) => region.id !== id));
    };
  }

  unregisterRegion(target: unknown): void {
    this.replaceRegions(this.regions.filter((region) => region.target !== target));
  }

  private replaceRegions(next: HitParticipationRegionRecord[]): void {
    const previous = this.regions;
    this.regions = next;
    try {
      this.syncHostBridge();
    } catch (error) {
      this.regions = previous;
      throw error;
    }
  }

  getConfig(): HitParticipationConfig {
    return this.config;
  }

  getWarnings(): readonly string[] {
    return Object.freeze(this.warnings.slice());
  }

  getRegions(): readonly HitParticipationRegion[] {
    return this.buildRegions();
  }

  private buildRegions(): readonly HitParticipationRegion[] {
    return this.regions
      .filter(({ target }) => target !== this.selfTarget || this.hostElement !== null)
      .map(({ target, role, mode, meta, staticHitInset }) =>
        Object.freeze({
          target: target === this.selfTarget ? this.hostElement : target,
          mode,
          ...(staticHitInset ? { staticHitInset } : {}),
          ...(typeof role === 'undefined' ? {} : { role }),
          ...(typeof meta === 'undefined' ? {} : { meta }),
        })
      );
  }

  private getEffectiveRegions(includeImplicitHost: boolean): readonly HitParticipationRegion[] {
    const explicit = this.buildRegions();

    if (
      includeImplicitHost &&
      this.hostElement &&
      !explicit.some((region) => Object.is(region.target, this.hostElement))
    ) {
      return Object.freeze([
        {
          target: this.hostElement,
          role: 'content' as any,
          mode: this.config.mode,
          ...(this.config.staticHitInset ? { staticHitInset: this.config.staticHitInset } : {}),
        },
        ...explicit,
      ]);
    }

    return explicit;
  }

  private syncHostBridge(): void {
    if (
      !this.hostBridge ||
      this.suspended ||
      this.mountPhase === 'detached' ||
      this.mountPhase === 'unmounting'
    )
      return;
    if (!this.hostElement && this.regions.some(({ target }) => target === this.selfTarget)) {
      throw new Error('[HitParticipation] self region requires a bound host target.');
    }
    const regions = this.getEffectiveRegions(true);
    if (
      regions.some((region) => region.staticHitInset) &&
      !this.hostBridge.supportsStaticHitInset
    ) {
      throw new Error('[HitParticipation] host does not support staticHitInset.');
    }
    this.hostBridge.sync({ config: this.config, regions });
  }

  private clearHostBridge(): void {
    if (!this.hostBridge) return;
    this.hostBridge.sync({
      config: this.config,
      regions: [],
    });
  }

  readonly handle: HitParticipationHandle<any> = {
    configure: (patch: HitParticipationConfigPatch) => this.configure(patch),
    registerSelfRegion: (options?: HitParticipationRegionOptions) =>
      this.registerSelfRegion(options),
    registerRegion: (target: unknown, options?: HitParticipationRegionOptions) =>
      this.registerRegion(target, options),
    unregisterRegion: (target: unknown) => this.unregisterRegion(target),
  };
}
