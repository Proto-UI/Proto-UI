// packages/modules/rule/src/eval.ts
import type { RuleIR, RulePlanV0, RuleEvalCtx, WhenExpr, WhenValue } from './types';
import { mergeTwTokensV0, snapshotMaterialCandidate, type MaterialCandidate } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

function evalValue<Props extends PropsBaseType>(v: WhenValue<Props>, ctx: RuleEvalCtx<Props>): any {
  switch (v.type) {
    case 'prop':
      return (ctx.props as any)[v.key];
    case 'state':
      return ctx.readState ? ctx.readState(v.id) : undefined;
    case 'context':
      return ctx.readContext ? ctx.readContext(v.key) : undefined;
    case 'meta':
      return ctx.readMeta ? ctx.readMeta(v.key) : undefined;
  }
}

function evalExpr<Props extends PropsBaseType>(
  e: WhenExpr<Props>,
  ctx: RuleEvalCtx<Props>
): boolean {
  switch (e.type) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'eq':
      return evalValue(e.left, ctx) === e.right;
    case 'not':
      return !evalExpr(e.expr, ctx);
    case 'all':
      for (const it of e.exprs) if (!evalExpr(it, ctx)) return false;
      return true;
    case 'any':
      for (const it of e.exprs) if (evalExpr(it, ctx)) return true;
      return false;
  }
}

/**
 * Evaluate rules and produce a Plan (style.tokens).
 * - Deterministic ordering: declaration order
 * - Collect ops, concatenate tokens in order, semantic-merge -> tokens
 */
export function evaluateRulesToPlan<Props extends PropsBaseType>(
  rules: RuleIR<Props>[],
  ctx: RuleEvalCtx<Props>
): RulePlanV0 {
  const active = rules
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => evalExpr(r.when, ctx))
    .sort((a, b) => a.idx - b.idx);

  const tokens: string[] = [];
  const materials: MaterialCandidate[] = [];
  for (const { r } of active) {
    if (r.intent.kind !== 'ops') continue;
    for (const op of r.intent.ops) {
      if (op.kind === 'feedback.material.use')
        materials.push(snapshotMaterialCandidate(op.candidate));
      if (op.kind === 'feedback.style.use') {
        for (const h of op.handles) {
          if (!h || h.kind !== 'tw') {
            throw new Error(`[rule] unsupported style handle in v0`);
          }
          tokens.push(...h.tokens);
        }
      }
    }
  }

  const merged = mergeTwTokensV0(tokens);
  return {
    kind: 'style.tokens',
    tokens: merged.tokens,
    ...(materials.length ? { materials: Object.freeze(materials) } : {}),
  };
}
