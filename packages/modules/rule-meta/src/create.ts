import { createKeyedMetaLease, type KeyedSource } from './keyed-lease';
import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs, ModuleDeps } from '@proto.ui/module-base';
import type {
  CapToken,
  CapsVaultView,
  InstancePhase,
  MountPhase,
  ProtoPhase,
} from '@proto.ui/core';
import type { RulePort } from '@proto.ui/module-rule';
import type { RuleMetaFacade, RuleMetaModule } from './types';
import {
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  RULE_META_GET_CAP,
  RULE_META_PREFERENCE_SOURCE_CAP,
  RULE_META_STYLE_SUPPORT_SOURCE_CAP,
  isStyleSupportKey,
  type StyleSupportKey,
  isPreferenceKey,
  normalizePreferenceValue,
  type PreferenceKey,
  type ColorSchemeInvalidationSource,
} from './caps';

class RuleMetaModuleImpl extends ModuleBase {
  private readonly rulePort: RulePort<any>;
  private source: ColorSchemeInvalidationSource | null = null;
  private unsubscribe: (() => void) | null = null;
  private generation = 0;
  private disposed = false;
  private readonly preferenceLease = createKeyedMetaLease<PreferenceKey>(
    () => this.canSubscribe(),
    () => this.rulePort.requestStyleReevaluation()
  );
  private readonly styleSupportLease = createKeyedMetaLease<StyleSupportKey>(
    () => this.canSubscribe(),
    () => this.rulePort.requestStyleReevaluation()
  );

  constructor(caps: CapsVaultView, deps: ModuleDeps) {
    super(caps);
    this.rulePort = deps.requirePort<RulePort<any>>('rule');
    this.rulePort.registerExtension({
      beforePlan: (ctx) => {
        if (ctx.readMeta) return { kind: 'continue' };
        // Preserve the legacy no-getter extension seam; only the new bounded
        // dependencies need an explicit unknown reader when their source is absent.
        if (
          !this.caps.has(RULE_META_GET_CAP) &&
          !this.rulePort
            .exportIR()
            .some((rule) =>
              rule.deps.some(
                (dep) =>
                  dep.kind === 'meta' && (isPreferenceKey(dep.key) || isStyleSupportKey(dep.key))
              )
            )
        )
          return { kind: 'continue' };
        ctx.readMeta = (key: string) => this.get(key);
        return { kind: 'continue' };
      },
    });
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    this.reconcileLease();
    this.reconcileBoundedLeases();
  }

  override onInstancePhase(phase: InstancePhase): void {
    super.onInstancePhase(phase);
    this.reconcileLease();
    this.reconcileBoundedLeases();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.reconcileLease();
    this.reconcileBoundedLeases();
  }

  protected override onCapsEpoch(): void {
    this.reconcileLease();
    this.reconcileBoundedLeases();
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

  private reconcileBoundedLeases(): void {
    this.reconcileKeyedLease(
      this.preferenceLease,
      isPreferenceKey,
      RULE_META_PREFERENCE_SOURCE_CAP
    );
    this.reconcileKeyedLease(
      this.styleSupportLease,
      isStyleSupportKey,
      RULE_META_STYLE_SUPPORT_SOURCE_CAP
    );
  }

  private reconcileKeyedLease<Key extends string>(
    lease: ReturnType<typeof createKeyedMetaLease<Key>>,
    accepts: (key: string) => key is Key,
    sourceCap: CapToken<KeyedSource<Key>>
  ): void {
    // Read separately for each capability: the first subscription/reconciliation
    // may synchronously replace the getter or the other source through host hooks.
    const keys = [
      ...new Set(
        this.rulePort
          .exportIR()
          .flatMap((rule) =>
            rule.deps.flatMap((dep) => (dep.kind === 'meta' && accepts(dep.key) ? [dep.key] : []))
          )
      ),
    ].sort();
    const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
    lease.reconcile(keys, getter, this.caps.has(sourceCap) ? this.caps.get(sourceCap) : null);
  }

  dispose(): void {
    this.disposed = true;
    this.releaseLease();
    this.preferenceLease.release();
    this.styleSupportLease.release();
  }

  get(key: string): unknown {
    const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
    if (isPreferenceKey(key))
      return normalizePreferenceValue(key, this.preferenceLease.read(key, getter));
    if (isStyleSupportKey(key)) {
      const value = this.styleSupportLease.read(key, getter);
      return typeof value === 'boolean' ? value : 'unknown';
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
