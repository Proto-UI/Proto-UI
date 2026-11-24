import type ts from 'typescript';

import type { HookSourceSummaryContext } from './hook-source-summary.js';
import type { UnresolvedStateRead } from './lowered-hook-coverage.js';

/**
 * What one rule call was observed to read.
 *
 * A rule registered inside a helper function is read by the call site that
 * binds the helper's parameters: the helper's own file cannot know what its
 * parameters hold. The observation therefore waits for that call site, and a
 * helper no call site replays keeps its observation visible instead of losing
 * it.
 */
export type RuleState = {
  /**
   * The leaves whose usages were already reported, by the leaf's offset in
   * the helper's own file. A replayed call replaces the declaration-level
   * observation of a leaf rather than adding a second one.
   */
  reported: Set<number>;
  /**
   * The leaves that were not resolved, by the leaf's offset. A call site that
   * resolves a leaf removes it here.
   */
  deferred: Map<number, UnresolvedStateRead>;
  /** The rule-level read that was not resolved, if there is one. */
  rule: UnresolvedStateRead | null;
};

type HelperObservation = {
  /** The file that declares the helper. */
  file: string;
  /** The helper's identity in its own source. */
  helper: string;
  /**
   * The rule calls the helper registers, by the rule call's offset in the
   * helper's own file. The declaration scan and a call-site replay parse the
   * file separately, so an offset is what they agree on.
   */
  rules: Map<number, RuleState>;
};

const registries = new WeakMap<HookSourceSummaryContext, Map<string, HelperObservation>>();
const replays = new WeakMap<HookSourceSummaryContext, Set<string>>();

/** The identity of a helper in its own source. */
export const helperIdentity = (helper: ts.FunctionLikeDeclaration): string => {
  const file = helper.getSourceFile();
  return `${file.fileName}:${helper.getStart(file)}`;
};

export const helperObservationState = (
  summary: HookSourceSummaryContext,
  helper: ts.FunctionLikeDeclaration
): HelperObservation => {
  let helpers = registries.get(summary);
  if (!helpers) {
    helpers = new Map();
    registries.set(summary, helpers);
  }
  const key = helperIdentity(helper);
  let state = helpers.get(key);
  if (!state) {
    state = { file: helper.getSourceFile().fileName, helper: key, rules: new Map() };
    helpers.set(key, state);
  }
  return state;
};

/**
 * The state of one rule call a helper registers. The rule call is identified
 * by its offset in the helper's own file, so the declaration scan and a
 * call-site replay of the same rule agree on it even though they parse the
 * file separately.
 */
export const helperRuleState = (
  summary: HookSourceSummaryContext,
  helper: ts.FunctionLikeDeclaration,
  ruleOffset: number
): RuleState => {
  const observation = helperObservationState(summary, helper);
  let state = observation.rules.get(ruleOffset);
  if (!state) {
    state = { reported: new Set(), deferred: new Map(), rule: null };
    observation.rules.set(ruleOffset, state);
  }
  return state;
};

/**
 * Marks a helper as being replayed. A helper that calls itself, directly or
 * through another helper, must not recurse: the call that is already running
 * owns the rule it registers.
 */
export const beginHelperReplay = (
  summary: HookSourceSummaryContext,
  helper: ts.FunctionLikeDeclaration
): boolean => {
  let active = replays.get(summary);
  if (!active) {
    active = new Set();
    replays.set(summary, active);
  }
  const key = helperIdentity(helper);
  if (active.has(key)) return false;
  active.add(key);
  return true;
};

export const endHelperReplay = (
  summary: HookSourceSummaryContext,
  helper: ts.FunctionLikeDeclaration
): void => {
  replays.get(summary)?.delete(helperIdentity(helper));
};

/**
 * The reads no call site resolved.
 *
 * A helper's own file cannot know what its parameters hold, so a rule read it
 * could not trace waits for the call site that binds them. A helper no call
 * site replays keeps its read visible instead of losing it.
 */
export const pendingRuleReads = (
  summary: HookSourceSummaryContext
): Array<{ file: string; read: UnresolvedStateRead }> => {
  const helpers = registries.get(summary);
  if (!helpers) return [];
  const pending: Array<{ file: string; read: UnresolvedStateRead }> = [];
  for (const state of helpers.values()) {
    for (const rule of state.rules.values()) {
      if (rule.rule) pending.push({ file: state.file, read: rule.rule });
      for (const read of rule.deferred.values()) pending.push({ file: state.file, read });
    }
  }
  return pending.sort((left, right) =>
    left.file === right.file
      ? left.read.expression.localeCompare(right.read.expression)
      : left.file.localeCompare(right.file)
  );
};
