// packages/modules/rule-expose-state-web/src/create.ts
import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs, ModuleDeps } from '@proto.ui/module-base';
import type { MountPhase, ProtoPhase, StyleHandle } from '@proto.ui/core';
import type { WhenExpr, RuleIR, RulePort } from '@proto.ui/module-rule';
import type { ExposeStateWebPort, ExposeStateWebBinding } from '@proto.ui/module-expose-state-web';
import type { FeedbackPort } from '@proto.ui/module-feedback';
import type { RuleExposeStateWebFacade, RuleExposeStateWebModule } from './types';
import { canonicalizeLoweredVariants } from './generated/lowered-variant-order';
import {
  RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP,
  type RuleExposeStateWebNativeVariantPolicy,
} from './caps';

type Condition =
  | { kind: 'state'; stateId: any; literal: string | number | boolean | null }
  | { kind: 'meta.dark' };

type Candidate = {
  id: number;
  order: number;
  conditions: Condition[];
  tokens: string[];
};

// A meta-only rule is lowerable too: `meta.dark` has a selector form, so a rule
// conditioned on colorScheme alone must not fall back to the default plan, which
// samples the scheme once and leaves stale presentation after a theme switch.
function isStateMetaDeps<Props extends {}>(rule: RuleIR<Props>): boolean {
  let hasLowerableDep = false;
  for (const dep of rule.deps) {
    if (dep.kind === 'state' || dep.kind === 'meta') {
      hasLowerableDep = true;
      continue;
    }
    return false;
  }
  return hasLowerableDep;
}

function extractConditions<Props extends {}>(expr: WhenExpr<Props>): Condition[] | null {
  switch (expr.type) {
    case 'eq':
      if (expr.left.type === 'state') {
        return [{ kind: 'state', stateId: expr.left.id, literal: expr.right }];
      }
      if (expr.left.type === 'meta' && expr.left.key === 'colorScheme' && expr.right === 'dark') {
        return [{ kind: 'meta.dark' }];
      }
      return null;
    case 'all': {
      const all: Condition[] = [];
      for (const e of expr.exprs) {
        const c = extractConditions(e);
        if (!c) return null;
        all.push(...c);
      }
      return all;
    }
    default:
      return null;
  }
}

function stripDataPrefix(attr: string): string {
  return attr.startsWith('data-') ? attr.slice('data-'.length) : attr;
}

function buildSemanticVariant(
  semantic: string | undefined,
  condition: Condition,
  allowNativeVariant: RuleExposeStateWebNativeVariantPolicy | null
): string | null {
  if (!semantic || condition.kind !== 'state' || condition.literal !== true) return null;

  let variant: string | null = null;
  switch (semantic) {
    case '@interaction/hovered':
      variant = 'hover';
      break;
    case '@interaction/pressed':
      variant = 'active';
      break;
    case '@interaction/disabled':
      variant = 'disabled';
      break;
    case '@interaction/focused':
      variant = 'focus';
      break;
    case '@interaction/focusVisible':
      variant = 'focus-visible';
      break;
    default:
      variant = null;
  }

  if (!variant) return null;
  if (allowNativeVariant && !allowNativeVariant({ semantic, variant })) return null;
  return variant;
}

function buildVariant(
  condition: Condition,
  map: ReadonlyMap<string, ExposeStateWebBinding>,
  allowNativeVariant: RuleExposeStateWebNativeVariantPolicy | null
): string | null {
  if (condition.kind === 'meta.dark') {
    return 'dark';
  }

  const binding = map.get(String(condition.stateId));
  if (!binding) return null;
  if (binding.kind === 'number.range') return null;

  const semanticVariant = buildSemanticVariant(binding.semantic, condition, allowNativeVariant);
  if (semanticVariant) return semanticVariant;

  const attr = binding.attr;
  if (!attr) return null;
  const key = stripDataPrefix(attr);

  if (binding.kind === 'bool') {
    if (condition.literal === true) return `data-[${key}]`;
    if (condition.literal === false) return `not-[data-${key}]`;
    return null;
  }

  if (condition.literal === null) return null;
  if (binding.kind === 'enum' || binding.kind === 'string' || binding.kind === 'number.discrete') {
    return `data-[${key}=${String(condition.literal)}]`;
  }

  return null;
}

function isNegativeDataVariant(variant: string): boolean {
  return /^not-\[data-[a-zA-Z0-9-]+\]$/.test(variant);
}

class RuleExposeStateWebImpl extends ModuleBase {
  private readonly rulePort: RulePort<any>;
  private readonly exposeStateWeb: ExposeStateWebPort;
  private readonly feedbackPort: FeedbackPort;

  private candidates: Candidate[] = [];
  private candidatesReady = false;
  private optimizedIds = new Set<number>();

  constructor(caps: any, deps: ModuleDeps) {
    super(caps);
    this.rulePort = deps.requirePort<RulePort<any>>('rule');
    this.exposeStateWeb = deps.requirePort<ExposeStateWebPort>('expose-state-web');
    this.feedbackPort = deps.requirePort<FeedbackPort>('feedback');

    this.rulePort.registerExtension({
      transformRules: (rules) => rules.filter((r) => !this.optimizedIds.has((r as any).id)),
    });
  }

  override onProtoPhase(phase: ProtoPhase): void {
    super.onProtoPhase(phase);
    if (phase === 'mounted') this.tryApply();
  }

  override onMountPhase(phase: MountPhase, epoch: number): void {
    super.onMountPhase(phase, epoch);
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.tryApply();
  }

  afterRenderCommit(): void {
    this.tryApply();
  }

  private collectCandidates(): Candidate[] {
    const ir = this.rulePort.exportIR();
    const out: Candidate[] = [];
    let order = 0;

    for (const r of ir) {
      if (!isStateMetaDeps(r)) continue;
      const conditions = extractConditions(r.when);
      if (!conditions || conditions.length === 0) continue;

      if (r.intent.kind !== 'ops') continue;
      const tokens: string[] = [];
      let ok = true;
      for (const op of r.intent.ops) {
        if (op.kind !== 'feedback.style.use') {
          ok = false;
          break;
        }
        for (const h of op.handles) {
          if (!h || h.kind !== 'tw') {
            ok = false;
            break;
          }
          tokens.push(...h.tokens);
        }
      }
      if (!ok || tokens.length === 0) continue;

      out.push({ id: (r as any).id, order: order++, conditions, tokens });
    }

    return out;
  }

  private getAllowNativeVariant(): RuleExposeStateWebNativeVariantPolicy | null {
    return this.caps.has(RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP)
      ? this.caps.get(RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP)
      : null;
  }

  private tryApply(): void {
    if (this.mountPhase === 'detached' || this.mountPhase === 'unmounting') return;
    // A pure-meta candidate resolves before the map is consulted, so an empty
    // exposed-state map must not short-circuit the pass. State candidates find
    // no binding and are retried on the next attempt.
    const map =
      this.exposeStateWeb.getExposedStateMap() ?? new Map<string, ExposeStateWebBinding>();
    const allowNativeVariant = this.getAllowNativeVariant();
    // With no exposed state there is nothing web-specific to key off except the
    // host's own variant policy, which only a web adapter declares. Without it
    // the lowered selector would never render, so the default plan keeps the
    // rule and `C-RULE-EXTENSION-0001-C` equivalent execution still holds.
    if (map.size === 0 && !allowNativeVariant) return;

    if (!this.candidatesReady) {
      this.candidates = this.collectCandidates();
      this.candidatesReady = true;
    }
    if (this.candidates.length === 0) return;

    const appliedIds: number[] = [];
    for (const c of this.candidates) {
      if (this.optimizedIds.has(c.id)) continue;

      const variants: string[] = [];
      let ok = true;
      for (const cond of c.conditions) {
        const v = buildVariant(cond, map, allowNativeVariant);
        if (!v) {
          ok = false;
          break;
        }
        variants.push(v);
      }

      if (!ok || variants.length === 0) continue;
      if (variants.every(isNegativeDataVariant)) continue;

      const prefix = canonicalizeLoweredVariants(variants).join(':');
      const tokens = c.tokens.map((t) => `${prefix}:${t}`);
      const handle: StyleHandle = { kind: 'tw', tokens };
      this.feedbackPort.useStyleUnsafe(handle);
      appliedIds.push(c.id);
    }

    for (const id of appliedIds) this.optimizedIds.add(id);
  }
}

export function createRuleExposeStateWebModule(ctx: ModuleFactoryArgs): RuleExposeStateWebModule {
  const { init, caps, deps } = ctx;

  return createModule<'rule-expose-state-web', 'instance', RuleExposeStateWebFacade>({
    name: 'rule-expose-state-web',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ caps, deps }) => {
      const impl = new RuleExposeStateWebImpl(caps, deps);
      return {
        facade: {},
        hooks: {
          onMountPhase: (p, epoch) => impl.onMountPhase(p, epoch),
          onProtoPhase: (p) => impl.onProtoPhase(p),
          afterRenderCommit: () => impl.afterRenderCommit(),
        },
      };
    },
  }) as any;
}

export const RuleExposeStateWebModuleDef = defineModule({
  name: 'rule-expose-state-web',
  resourceOwnership: 'mixed',
  deps: ['rule', 'expose-state-web', 'feedback'],
  create: createRuleExposeStateWebModule,
});
