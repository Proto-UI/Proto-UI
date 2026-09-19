// packages/modules/rule/src/types.ts
import type { PropsBaseType } from '@proto.ui/types';
import type {
  ModuleInstance,
  ModuleFacade,
  ModuleScope,
  IntentBuilder,
  RuleDep,
  RuleHandle,
  RuleIntent,
  RuleOp,
  RuleSpec,
  StateIntentBuilder,
  WhenBuilder,
  WhenExpr,
  WhenLiteral,
  WhenSignal,
  WhenValue,
} from '@proto.ui/core';

export type RuleIR<Props extends PropsBaseType> = {
  id: number;
  label?: string;
  note?: string;

  deps: RuleDep<Props>[];
  when: WhenExpr<Props>;
  intent: RuleIntent<Props>;
};

export type RulePlanV0 = {
  kind: 'style.tokens';
  tokens: string[];
};

export type RuleEvalCtx<Props extends PropsBaseType> = {
  props: Readonly<Props>;
  readState?: (id: any) => any;
  readContext?: (key: any, path?: string[]) => any;
  readMeta?: (key: string) => unknown;
};

export type RuleEvalResult =
  | { kind: 'plan'; plan: RulePlanV0 }
  | { kind: 'short-circuit'; executed: boolean };

export type RuleExtension<Props extends PropsBaseType> = {
  transformRules?: (rules: RuleIR<Props>[], ctx: RuleEvalCtx<Props>) => RuleIR<Props>[];
  beforePlan?: (
    ctx: RuleEvalCtx<Props>
  ) =>
    | { kind: 'continue' }
    | { kind: 'short-circuit'; execute?: (ctx: RuleEvalCtx<Props>) => void };
  afterPlan?: (plan: RulePlanV0, ctx: RuleEvalCtx<Props>) => RulePlanV0;
};

export type RulePort<Props extends PropsBaseType> = {
  exportIR(): RuleIR<Props>[];
  resolveStateHandle(id: any): { get(): any } | undefined;
  evaluate(ctx: RuleEvalCtx<Props>): RuleEvalResult;
  registerExtension(ext: RuleExtension<Props>): void;
  requestStyleReevaluation(): void;
};

export type RuleFacade<Props extends PropsBaseType> = ModuleFacade & {
  // setup-only: def.rule
  rule: (spec: RuleSpec<Props>) => RuleHandle;
};

export type RuleModule<Props extends PropsBaseType> = ModuleInstance<RuleFacade<Props>> & {
  name: 'rule';
  scope: ModuleScope; // normally "instance"
  port: RulePort<Props>;
};

export type {
  IntentBuilder,
  RuleDep,
  RuleHandle,
  RuleIntent,
  RuleOp,
  RuleSpec,
  StateIntentBuilder,
  WhenBuilder,
  WhenExpr,
  WhenLiteral,
  WhenSignal,
  WhenValue,
};
