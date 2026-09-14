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
import { HOST_ELEMENT_CAP, illegalPhase } from '@proto.ui/core';
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
    this.hostElement = this.caps.has(HOST_ELEMENT_CAP) ? this.caps.get(HOST_ELEMENT_CAP) : null;
    this.hostBridge = this.caps.has(HIT_PARTICIPATION_HOST_BRIDGE_CAP)
      ? this.caps.get(HIT_PARTICIPATION_HOST_BRIDGE_CAP)
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
      this.patchMode(patch.mode);

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

  registerRegion(target: unknown, options: HitParticipationRegionOptions = {}): () => void {
    const id = this.nextRegionId++;
    this.replaceRegions(
      this.regions.concat([
        Object.freeze({
          id,
          target,
          role: options.role,
          mode: options.mode ?? this.config.mode,
          meta: options.meta,
        }),
      ])
    );
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
    return this.regions.map(({ target, role, mode, meta }) =>
      Object.freeze({
        target,
        mode,
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
        { target: this.hostElement, role: 'content' as any, mode: this.config.mode },
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
    this.hostBridge.sync({
      config: this.config,
      regions: this.getEffectiveRegions(true),
    });
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
    registerRegion: (target: unknown, options?: HitParticipationRegionOptions) =>
      this.registerRegion(target, options),
    unregisterRegion: (target: unknown) => this.unregisterRegion(target),
  };
}
