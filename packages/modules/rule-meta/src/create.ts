import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs, ModuleDeps } from '@proto.ui/module-base';
import type { CapsVaultView, InstancePhase, MountPhase, ProtoPhase } from '@proto.ui/core';
import type { RulePort } from '@proto.ui/module-rule';
import type { RuleMetaFacade, RuleMetaModule } from './types';
import {
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  RULE_META_GET_CAP,
  RULE_META_PREFERENCE_SOURCE_CAP,
  isPreferenceKey,
  normalizePreferenceValue,
  type PreferenceInvalidationSource,
  type PreferenceKey,
  type ColorSchemeInvalidationSource,
} from './caps';

class RuleMetaModuleImpl extends ModuleBase {
  private readonly rulePort: RulePort<any>;
  private source: ColorSchemeInvalidationSource | null = null;
  private unsubscribe: (() => void) | null = null;
  private generation = 0;
  private disposed = false;
  private preferenceSource: PreferenceInvalidationSource | null = null;
  private preferenceUnsubscribe: (() => void) | null = null;
  private preferenceGeneration = 0;
  private preferenceKeys: readonly PreferenceKey[] = [];

  constructor(caps: CapsVaultView, deps: ModuleDeps) {
    super(caps);
    this.rulePort = deps.requirePort<RulePort<any>>('rule');
    this.rulePort.registerExtension({
      beforePlan: (ctx) => {
        if (ctx.readMeta) return { kind: 'continue' };
        ctx.readMeta = (key: string) => this.get(key);
        return { kind: 'continue' };
      },
    });
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    this.reconcileLease();
    this.reconcilePreferenceLease();
  }

  override onInstancePhase(phase: InstancePhase): void {
    super.onInstancePhase(phase);
    this.reconcileLease();
    this.reconcilePreferenceLease();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.reconcileLease();
    this.reconcilePreferenceLease();
  }

  protected override onCapsEpoch(): void {
    this.reconcileLease();
    this.reconcilePreferenceLease();
  }

  private canSubscribe(): boolean {
    return (
      !this.disposed &&
      this.instancePhase === 'alive' &&
      this.mountPhase === 'mounted' &&
      (this.protoPhase === 'mounted' || this.protoPhase === 'updated')
    );
  }

  private reconcileLease(): void {
    if (!this.canSubscribe()) {
      this.releaseLease();
      return;
    }
    const consumesColorScheme = this.rulePort
      .exportIR()
      .some((rule) => rule.deps.some((dep) => dep.kind === 'meta' && dep.key === 'colorScheme'));
    const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
    const source = this.caps.has(RULE_META_COLOR_SCHEME_SOURCE_CAP)
      ? this.caps.get(RULE_META_COLOR_SCHEME_SOURCE_CAP)
      : null;
    if (!consumesColorScheme || !source || source.getter !== getter) {
      this.releaseLease();
      return;
    }
    if (this.source === source && this.unsubscribe) return;

    this.releaseLease();
    this.source = source;
    const generation = this.generation;
    this.unsubscribe = source.subscribe(() => {
      if (generation !== this.generation || !this.canSubscribe()) return;
      this.rulePort.requestStyleReevaluation();
    });
    // A fresh lease samples after subscription, including an unchanged-value remount.
    this.rulePort.requestStyleReevaluation();
  }

  private releaseLease(): void {
    this.generation++;
    const unsubscribe = this.unsubscribe;
    this.unsubscribe = null;
    this.source = null;
    unsubscribe?.();
  }

  private reconcilePreferenceLease(): void {
    const keys = [
      ...new Set(
        this.rulePort
          .exportIR()
          .flatMap((rule) =>
            rule.deps.flatMap((dep) =>
              dep.kind === 'meta' && isPreferenceKey(dep.key) ? [dep.key] : []
            )
          )
      ),
    ].sort();
    const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
    const source = this.caps.has(RULE_META_PREFERENCE_SOURCE_CAP)
      ? this.caps.get(RULE_META_PREFERENCE_SOURCE_CAP)
      : null;
    if (!this.canSubscribe() || keys.length === 0 || !source || source.getter !== getter) {
      const changed = this.releasePreferenceLease();
      // A lost live source must remove enhancement, even when its sampled getter survives.
      if (changed && this.canSubscribe()) this.rulePort.requestStyleReevaluation();
      return;
    }
    if (
      source === this.preferenceSource &&
      this.preferenceUnsubscribe &&
      keys.join() === this.preferenceKeys.join()
    )
      return;
    this.releasePreferenceLease();
    this.preferenceSource = source;
    this.preferenceKeys = keys;
    const generation = this.preferenceGeneration;
    const release = source.subscribe(keys, () => {
      if (
        generation !== this.preferenceGeneration ||
        !this.preferenceUnsubscribe ||
        !this.canSubscribe()
      )
        return;
      this.rulePort.requestStyleReevaluation();
    });
    // Protect a reentrant replacement/disposal during subscription as well as late callbacks.
    if (generation !== this.preferenceGeneration || !this.canSubscribe()) {
      release();
      return;
    }
    this.preferenceUnsubscribe = release;
    this.rulePort.requestStyleReevaluation();
  }

  private releasePreferenceLease(): boolean {
    const changed = this.preferenceSource !== null;
    ++this.preferenceGeneration;
    const release = this.preferenceUnsubscribe;
    this.preferenceUnsubscribe = null;
    this.preferenceSource = null;
    this.preferenceKeys = [];
    release?.();
    return changed;
  }

  dispose(): void {
    this.disposed = true;
    this.releaseLease();
    this.releasePreferenceLease();
  }

  get(key: string): unknown {
    const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
    if (isPreferenceKey(key)) {
      if (
        !this.canSubscribe() ||
        !this.preferenceUnsubscribe ||
        this.preferenceSource?.getter !== getter ||
        !this.preferenceKeys.includes(key)
      )
        return 'unknown';
      return normalizePreferenceValue(key, getter?.(key));
    }
    return getter ? getter(key) : undefined;
  }
}

export function createRuleMetaModule(ctx: ModuleFactoryArgs): RuleMetaModule {
  const { init, caps, deps } = ctx;

  return createModule<'rule-meta', 'instance', RuleMetaFacade>({
    name: 'rule-meta',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ caps, deps }) => {
      const impl = new RuleMetaModuleImpl(caps, deps);
      return {
        facade: {
          get: (key: string) => impl.get(key),
        },
        hooks: {
          onProtoPhase: (p) => impl.onProtoPhase(p),
          onInstancePhase: (p) => impl.onInstancePhase(p),
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          dispose: () => impl.dispose(),
        },
      };
    },
  }) as any;
}

export const RuleMetaModuleDef = defineModule({
  name: 'rule-meta',
  resourceOwnership: 'mixed',
  deps: ['rule'],
  create: createRuleMetaModule,
});
