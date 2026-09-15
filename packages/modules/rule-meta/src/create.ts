import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs, ModuleDeps } from '@proto.ui/module-base';
import type { CapsVaultView, InstancePhase, MountPhase, ProtoPhase } from '@proto.ui/core';
import type { RulePort } from '@proto.ui/module-rule';
import type { RuleMetaFacade, RuleMetaModule } from './types';
import {
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  RULE_META_GET_CAP,
  type ColorSchemeInvalidationSource,
} from './caps';

class RuleMetaModuleImpl extends ModuleBase {
  private readonly rulePort: RulePort<any>;
  private source: ColorSchemeInvalidationSource | null = null;
  private unsubscribe: (() => void) | null = null;
  private generation = 0;
  private disposed = false;

  constructor(caps: CapsVaultView, deps: ModuleDeps) {
    super(caps);
    this.rulePort = deps.requirePort<RulePort<any>>('rule');
    this.rulePort.registerExtension({
      beforePlan: (ctx) => {
        if (ctx.readMeta) return { kind: 'continue' };
        const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
        if (!getter) return { kind: 'continue' };
        ctx.readMeta = (key: string) => getter(key);
        return { kind: 'continue' };
      },
    });
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    this.reconcileLease();
  }

  override onInstancePhase(phase: InstancePhase): void {
    super.onInstancePhase(phase);
    this.reconcileLease();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
    this.reconcileLease();
  }

  protected override onCapsEpoch(): void {
    this.reconcileLease();
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

  dispose(): void {
    this.disposed = true;
    this.releaseLease();
  }

  get(key: string): unknown {
    const getter = this.caps.has(RULE_META_GET_CAP) ? this.caps.get(RULE_META_GET_CAP) : null;
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
