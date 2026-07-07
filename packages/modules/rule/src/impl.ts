// packages/modules/rule/src/impl.ts
import type {
  RuleIR,
  RuleSpec,
  RuleEvalCtx,
  RuleEvalResult,
  RuleExtension,
  RuleHandle,
} from './types';
import { compileRule } from './compile';
import { evaluateRulesToPlan } from './eval';
import type { PropsBaseType } from '@proto.ui/types';
import type { PropsFacade, PropsPort } from '@proto.ui/module-props';
import type { StatePort } from '@proto.ui/module-state';
import type { FeedbackPort, FeedbackRuntimeStyleDisposer } from '@proto.ui/module-feedback';
import type { ContextFacade } from '@proto.ui/module-context';

type RuleExecutorDeps<Props extends PropsBaseType> = {
  propsFacade?: PropsFacade<Props>;
  propsPort?: PropsPort<Props>;
  statePort?: StatePort;
  feedbackPort?: FeedbackPort;
  contextFacade?: ContextFacade;
};

export class RuleModuleImpl<Props extends PropsBaseType> {
  private rules: RuleIR<Props>[] = [];
  private extensions: RuleExtension<Props>[] = [];
  private stateHandleById = new Map<any, { get(): any }>();
  private nextRuleId = 1;

  private deps: RuleExecutorDeps<Props> = {};
  private depsResolver?: () => RuleExecutorDeps<Props>;
  private stateWatchOffs: Array<() => void> = [];
  private stateWatchesInstalled = false;
  private driverActive = false;
  private unUseRuleStyle: FeedbackRuntimeStyleDisposer | null = null;

  define(spec: RuleSpec<Props>): RuleHandle {
    const ir = compileRule(spec, {
      registerStateHandle: (id, handle) => {
        if (handle && typeof handle.get === 'function') {
          this.stateHandleById.set(id, handle);
        }
      },
    });
    const withId = { ...ir, id: this.nextRuleId++ };
    this.rules.push(withId);
    const handle: RuleHandle = {
      id: withId.id,
      dispose: () => {
        const before = this.rules.length;
        this.rules = this.rules.filter((r) => r.id !== withId.id);
        if (this.rules.length === before) return;
        if (this.driverActive) this.evaluateAndApply();
      },
    };
    return handle;
  }

  exportIR(): RuleIR<Props>[] {
    return this.rules.slice();
  }

  resolveStateHandle(id: any): { get(): any } | undefined {
    return this.stateHandleById.get(id);
  }

  registerExtension(ext: RuleExtension<Props>): void {
    this.extensions.push(ext);
  }

  evaluate(ctx: RuleEvalCtx<Props>): RuleEvalResult {
    const readState =
      ctx.readState ??
      ((id: any) => {
        const h = this.stateHandleById.get(id);
        return h ? h.get() : undefined;
      });

    const evalCtx: RuleEvalCtx<Props> = {
      ...ctx,
      readState,
    };

    let rules = this.rules;
    for (const ext of this.extensions) {
      if (ext.transformRules) {
        rules = ext.transformRules(rules, evalCtx) ?? rules;
      }
    }

    for (const ext of this.extensions) {
      const before = ext.beforePlan?.(evalCtx);
      if (before?.kind === 'short-circuit') {
        if (before.execute) before.execute(evalCtx);
        return { kind: 'short-circuit', executed: !!before.execute };
      }
    }

    let plan = evaluateRulesToPlan(rules, evalCtx);

    for (const ext of this.extensions) {
      plan = ext.afterPlan ? ext.afterPlan(plan, evalCtx) : plan;
    }

    return { kind: 'plan', plan };
  }

  attachExecutor(resolveDeps: () => RuleExecutorDeps<Props>): void {
    this.depsResolver = resolveDeps;
    this.deps = resolveDeps();
  }

  onProtoPhase(phase: 'setup' | 'mounted' | 'updated' | 'unmounted'): void {
    if (phase === 'mounted') {
      this.ensureDeps();
      if (!this.stateWatchesInstalled) this.installStateWatches();
      this.driverActive = true;
      this.evaluateAndApply();
      return;
    }

    if (phase === 'updated') {
      this.ensureDeps();
      if (!this.stateWatchesInstalled) this.installStateWatches();
      if (this.driverActive) this.evaluateAndApply();
      return;
    }

    if (phase === 'unmounted') {
      this.stopDriver();
      return;
    }
  }

  dispose(): void {
    this.stopDriver();
  }

  private installStateWatches(): void {
    this.ensureDeps();
    const statePort = this.deps.statePort;
    if (!statePort) return;

    const ir = this.exportIR();
    const seen = new Set<any>();
    for (const r of ir) {
      for (const dep of r.deps) {
        if (dep.kind !== 'state') continue;
        if (seen.has(dep.id)) continue;
        seen.add(dep.id);
        const h = this.resolveStateHandle(dep.id) as any;
        if (!h) continue;
        const off = statePort.watch(h, () => {
          if (this.driverActive) this.evaluateAndApply();
        });
        this.stateWatchOffs.push(off);
      }
    }

    this.stateWatchesInstalled = true;
  }

  private stopDriver(): void {
    this.driverActive = false;
    while (this.stateWatchOffs.length) {
      try {
        this.stateWatchOffs.pop()!();
      } catch {}
    }
    this.stateWatchesInstalled = false;

    if (this.unUseRuleStyle) {
      try {
        this.unUseRuleStyle();
      } catch {}
      this.unUseRuleStyle = null;
    }
  }

  private evaluateAndApply(): void {
    if (!this.driverActive) return;

    this.ensureDeps();
    const { propsFacade, propsPort, feedbackPort, contextFacade } = this.deps;
    if (!feedbackPort) return;

    propsPort?.syncFromHost();
    const props = (propsFacade?.get?.() ?? {}) as Props;

    const res = this.evaluate({
      props,
      readContext: (key: any) => {
        if (!contextFacade) return undefined;
        return contextFacade.tryRead(key as any) ?? undefined;
      },
    } as RuleEvalCtx<Props>);

    if (res.kind !== 'plan' || res.plan.kind !== 'style.tokens') {
      if (this.unUseRuleStyle) {
        this.unUseRuleStyle = feedbackPort.replaceStyleRuntime(this.unUseRuleStyle);
      }
      return;
    }

    const tokens = res.plan.tokens ?? [];
    if (tokens.length === 0 && !this.unUseRuleStyle) return;

    this.unUseRuleStyle = feedbackPort.replaceStyleRuntime(
      this.unUseRuleStyle,
      ...(tokens.length > 0 ? [{ kind: 'tw' as const, tokens }] : [])
    );
  }

  private ensureDeps(): void {
    if (!this.depsResolver) return;
    const next = this.depsResolver();
    this.deps = {
      propsFacade: next.propsFacade ?? this.deps.propsFacade,
      propsPort: next.propsPort ?? this.deps.propsPort,
      statePort: next.statePort ?? this.deps.statePort,
      feedbackPort: next.feedbackPort ?? this.deps.feedbackPort,
      contextFacade: next.contextFacade ?? this.deps.contextFacade,
    };
  }
}
