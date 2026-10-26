import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import type {
  HookSourceValue,
  SourceGraphVersionTracker,
} from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';

const graphBudget = vi.hoisted(() => ({
  enabled: false,
  trackers: [] as { tracker: SourceGraphVersionTracker; values: Set<HookSourceValue> }[],
}));

vi.mock('../src/services/hook-source-summary', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & {
    createSourceGraphVersionTracker: () => SourceGraphVersionTracker;
  };
  return {
    ...actual,
    createSourceGraphVersionTracker: () => {
      const tracker = actual.createSourceGraphVersionTracker();
      if (!graphBudget.enabled) return tracker;
      const values = new Set<HookSourceValue>();
      graphBudget.trackers.push({ tracker, values });
      return {
        record(before: HookSourceValue, after: HookSourceValue, uncertain: boolean) {
          values.add(before);
          values.add(after);
          tracker.record(before, after, uncertain);
        },
        latest(value: HookSourceValue) {
          return tracker.latest(value);
        },
        versions(value: HookSourceValue) {
          return tracker.versions(value);
        },
        sameContainer(left: HookSourceValue, right: HookSourceValue) {
          return tracker.sameContainer(left, right);
        },
      };
    },
  };
});

/** Distinct post-run container lineages and their current-version counts. */
function containerVersionCounts(entries: typeof graphBudget.trackers): number[] {
  const counts: number[] = [];
  for (const { tracker, values } of entries) {
    const representatives: HookSourceValue[] = [];
    for (const value of values) {
      if (representatives.some((other) => tracker.sameContainer(other, value))) continue;
      representatives.push(value);
    }
    for (const representative of representatives) {
      counts.push(tracker.versions(representative).length);
    }
  }
  return counts;
}

/** A real intent: the variant is a prefix on tokens, so a stub yields nothing. */
const rule = (condition: string) =>
  `def.rule({ when: (w) => ${condition}, intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

/**
 * `asFacts` projects an array of two state handles, so a call that writes to
 * the projected container can reorder the handles a later read names.
 * `asOther` projects one handle, so a copy has a member set to copy.
 * `asPlain` projects nothing, so its result keeps the hook accessors.
 * `asProjected` projects an object that carries one state handle and the
 * read-only accessor that reads a handle by name, so a call through that
 * accessor can be told apart from a call through an unknown member.
 * `asMutator` projects the same handle behind a member that writes to the
 * projection, so a call through it may have replaced a member.
 * `asProjectedBeta` projects the other handle behind the same read-only
 * accessor, so a callee that may be either projection still only reads.
 * `asNested` projects a nested object beside the accessor, so a write into
 * the nested object rewrites the object that holds it.
 * `asEscapable` adds a beta member to that nested projection, so a call can
 * reach the nested object through its outer container; the outer state and
 * accessor also provide immutable-capture controls.
 * `asWideEscape` carries three distinct nested children for a bounded
 * conditional-write graph-count check.
 * `asRetiredEscape` provides a replaceable grandchild for live-version
 * reachability checks.
 * `asTwins` projects two nested objects with the same shape, so they are two
 * containers: a write into one of them does not reach the other.
 * `asAmbiguous` projects a member the analysis cannot name beside the proven
 * read-only accessor, so the member is unknown until a write proves it and
 * the accessor can restore it.
 */
const PRODUCER = [
  "import { defineAsHook } from '@proto.ui/core';",
  "export const asFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return [result.stateHandles.alpha, result.stateHandles.beta]; } });",
  "export const asOther = defineAsHook({ name: 'other', setup(def) { def.state.bool('gamma', false); }, projectHandle(result) { return [result.stateHandles.gamma]; } });",
  "export const asPlain = defineAsHook({ name: 'plain', setup(def) { def.state.bool('alpha', false); } });",
  "export const asProjected = defineAsHook({ name: 'projected', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: result.stateHandles.alpha, lookup: result.getState! }; } });",
  "export const asMutator = defineAsHook({ name: 'mutator', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: result.stateHandles.alpha, lookup: function () { this.ready = result.stateHandles.beta; } }; } });",
  "export const asProjectedBeta = defineAsHook({ name: 'projectedBeta', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: result.stateHandles.beta, lookup: result.getState! }; } });",
  "export const asNested = defineAsHook({ name: 'nested', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: result.stateHandles.alpha, nested: { ready: result.stateHandles.alpha }, lookup: result.getState! }; } });",
  "export const asEscapable = defineAsHook({ name: 'escapable', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: result.stateHandles.alpha, nested: { ready: result.stateHandles.alpha }, beta: result.stateHandles.beta, lookup: result.getState! }; } });",
  "export const asWideEscape = defineAsHook({ name: 'wideEscape', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: result.stateHandles.alpha, first: { ready: result.stateHandles.alpha }, second: { ready: result.stateHandles.alpha }, third: { ready: result.stateHandles.alpha }, beta: result.stateHandles.beta, lookup: result.getState! }; } });",
  "export const asRetiredEscape = defineAsHook({ name: 'retiredEscape', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { nested: { nested: { nested: { ready: result.stateHandles.alpha }, ready: result.stateHandles.alpha }, ready: result.stateHandles.alpha }, beta: result.stateHandles.beta }; } });",
  "export const asTwins = defineAsHook({ name: 'twins', setup(def) { def.state.bool('alpha', false); }, projectHandle(result) { return { left: { ready: result.stateHandles.alpha }, right: { ready: result.stateHandles.alpha } }; } });",
  "export const asAmbiguous = defineAsHook({ name: 'ambiguous', setup(def) { def.state.bool('alpha', false); def.state.bool('beta', false); }, projectHandle(result) { return { ready: chooseAlpha ? result.stateHandles.alpha : result.stateHandles.beta, lookup: result.getState! }; } });",
].join('\n');

/**
 * Scan the consumer and extract the tokens from the same files production
 * reads: the coverage scan reads the source, the extractor reads the files.
 */
async function analyze(consumer: string, afterScan?: () => void) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-receiver-mutation-'));
  try {
    await writeFile(path.join(dir, 'producer.ts'), PRODUCER);
    const consumerFile = path.join(dir, 'consumer.proto.ts');
    await writeFile(consumerFile, consumer);
    const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
    afterScan?.();
    const tokens = await collectProtoStyleTokens(dir);
    return { scan, tokens };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('hook source receiver mutation', () => {
  it('withholds a state a call that writes to its receiver may have replaced', async () => {
    // `bag.reverse()` writes to the container it is called on, so the handle
    // `bag[0]` names afterwards is not the one the projection put there.
    const consumer = [
      "import { asFacts } from './producer';",
      'const bag = asFacts();',
      'bag.reverse();',
      rule('w.state(bag[0]).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'bag[0]', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
    expect(tokens).not.toContain('data-[beta]:bg-primary');
  });

  it('shares the receiver invalidation with an alias of the same container', async () => {
    const consumer = [
      "import { asFacts } from './producer';",
      'const bag = asFacts();',
      'const alias = bag;',
      'bag.reverse();',
      rule('w.state(alias[0]).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'alias[0]', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('invalidates the container the receiver denoted before an argument rebound the name', async () => {
    // The receiver is evaluated before the arguments, so the container the
    // call wrote to is the one `bag` denoted then, not the one the argument
    // bound afterwards.
    const consumer = [
      "import { asFacts } from './producer';",
      'let bag = asFacts();',
      'const alias = bag;',
      'bag.reverse((bag = { ready: null }));',
      rule('w.state(alias[0]).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'alias[0]', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps a copy on the argument the call received', async () => {
    // The copy writes to its first argument, so the receiver capture must not
    // shift the position the copy reads and writes.
    const consumer = [
      "import { asFacts, asOther } from './producer';",
      'const bag = asFacts();',
      'const other = asOther();',
      'Object.assign(bag, other);',
      rule('w.state(bag[0]).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asOther', state: 'gamma' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[gamma]:bg-primary');
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps the state a proven hook read names', async () => {
    // `getState` reads the result it is called on, so the call does not
    // withdraw the proof the result carries.
    const consumer = [
      "import { asPlain } from './producer';",
      'const facts = asPlain();',
      rule("w.state(facts.getState('alpha')).eq(true)"),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asPlain', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('keeps the members a projected accessor call did not write to', async () => {
    // The projected accessor reads the result it is called on, so the call
    // does not withdraw the proof the rest of the projection carries. The
    // dynamic key names no state, but the accessor still reads, so what the
    // call returns is not part of that proof.
    const consumer = [
      "import { asProjected } from './producer';",
      'const facts = asProjected();',
      'const chooseAlpha = true;',
      "facts.lookup(chooseAlpha ? 'alpha' : 'beta');",
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asProjected', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state an unknown method call may have replaced', async () => {
    // The projection proves no `clear` member, so the call is unknown and may
    // have replaced any member of the projection.
    const consumer = [
      "import { asProjected } from './producer';",
      'const facts = asProjected();',
      'facts.clear();',
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a nested alias member an unknown call may have replaced through its parent', async () => {
    // An external mutate may set `bag.nested.ready = bag.beta`. It reaches the
    // child through the outer argument, so replacing only the outer member
    // proofs would leave this alias with a stale alpha proof.
    const consumer = [
      "import { asEscapable } from './producer';",
      'const bag = asEscapable();',
      'const nested = bag.nested;',
      'mutate(bag);',
      rule('w.state(nested.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'nested.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps a nested alias an unproven Object.assign cannot reach', async () => {
    // Object.assign replaces only the outer object's members. Even when the
    // source is unproven, it cannot write into the previously captured child.
    const consumer = [
      "import { asEscapable } from './producer';",
      'const bag = asEscapable();',
      'const nested = bag.nested;',
      'Object.assign(bag, chooseSource);',
      rule('w.state(nested.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asEscapable', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('keeps a detached alias outside the live graph an unknown call receives', async () => {
    // The unbound producer result still references the retired parent graph.
    // The call must follow the parent's live replacement, not withdraw the
    // detached child that the retired member used to reference.
    const consumer = [
      "import { asRetiredEscape, asTwins } from './producer';",
      'const parent = asRetiredEscape().nested.nested;',
      'const detached = parent.nested;',
      'parent.nested = asTwins().left;',
      'const bag = asRetiredEscape();',
      'mutate(bag);',
      rule('w.state(detached.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asRetiredEscape', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('keeps a state captured before an unknown call replaced its outer member', async () => {
    // The declaration captured the State handle itself. A later write to the
    // outer projection cannot retroactively change that immutable capture.
    const consumer = [
      "import { asEscapable } from './producer';",
      'const bag = asEscapable();',
      'const captured = bag.ready;',
      'mutate(bag);',
      rule('w.state(captured).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asEscapable', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('keeps an accessor captured before an unknown call replaced its outer member', async () => {
    // The projected getState accessor closes over its own frozen handle map.
    // Losing the outer bag's lookup member does not revoke that capture.
    const consumer = [
      "import { asEscapable } from './producer';",
      'const bag = asEscapable();',
      'const lookup = bag.lookup;',
      'mutate(bag);',
      rule("w.state(lookup('alpha')!).eq(true)"),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asEscapable', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('keeps one pre-call and one post-call graph per container after a conditional nested escape', async () => {
    const consumer = [
      "import { asWideEscape } from './producer';",
      'const bag = asWideEscape();',
      'const nested = bag.second;',
      'if (choose) mutate(bag);',
      rule('w.state(nested.ready).eq(true)'),
    ].join('\n');
    const observations: number[][] = [];
    let observedTrackers = 0;
    const observe = () => {
      observations.push(containerVersionCounts(graphBudget.trackers.slice(observedTrackers)));
      observedTrackers = graphBudget.trackers.length;
    };
    graphBudget.trackers.length = 0;
    graphBudget.enabled = true;
    try {
      const { scan, tokens } = await analyze(consumer, observe);
      observe();
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'nested.ready', reason: 'subject' }]);
      expect(tokens).not.toContain('data-[alpha]:bg-primary');
      expect(observations).toEqual([
        [2, 2, 2, 2],
        [2, 2, 2, 2],
      ]);
    } finally {
      graphBudget.enabled = false;
      graphBudget.trackers.length = 0;
    }
  });

  it('reads the accessor the call had before an argument rebound the name', async () => {
    // The callee is evaluated before the arguments, so the accessor the call
    // names is the one the projection carried then. The argument rebinds the
    // name afterwards, so the call still read the projected object.
    const consumer = [
      "import { asProjected } from './producer';",
      'let facts = asProjected();',
      'const alias = facts;',
      'facts.lookup((facts = { ready: null }));',
      rule('w.state(alias.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asProjected', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a mutator alternative of the callee may have replaced', async () => {
    // The callee may be the mutating projection or the read-only one, and the
    // runtime takes one of them, so the call may have replaced the member the
    // rule reads. Reading only the primary callee would certify it.
    const consumer = [
      "import { asMutator, asProjected } from './producer';",
      'const original = asMutator();',
      'let facts = original;',
      'if (chooseRead) facts = asProjected();',
      "facts.lookup(chooseAlpha ? 'alpha' : 'beta');",
      rule('w.state(original.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'original.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps the members when every alternative of the callee reads only', async () => {
    // Both projections the callee may be carry the read-only accessor, so the
    // call reads on either branch and withdraws nothing.
    const consumer = [
      "import { asProjected, asProjectedBeta } from './producer';",
      'const original = asProjected();',
      'let facts = original;',
      'if (chooseRead) facts = asProjectedBeta();',
      "facts.lookup(chooseAlpha ? 'alpha' : 'beta');",
      rule('w.state(original.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asProjected', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a repeated producer call may have overwritten through a replaced member', async () => {
    // A producer hands the same container to every call, so the repeated call
    // reaches the container the first one bound. The member write replaced the
    // accessor with a mutator, so the call reads the member the container
    // holds then, and that member may have overwritten the member the rule
    // reads.
    const consumer = [
      "import { asMutator, asProjected } from './producer';",
      'const facts = asProjected();',
      'facts.lookup = asMutator().lookup as typeof facts.lookup;',
      "asProjected().lookup(true ? 'alpha' : 'beta');",
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a repeated producer call may have overwritten after a nested write', async () => {
    // The nested write rewrites the object that holds it, so the container the
    // repeated call reaches is the rewritten one, and the accessor the member
    // write replaced is the member that call reaches.
    const consumer = [
      "import { asMutator, asNested } from './producer';",
      'const facts = asNested();',
      'facts.nested.ready = facts.ready;',
      'facts.lookup = asMutator().lookup as typeof facts.lookup;',
      "asNested().lookup(true ? 'alpha' : 'beta');",
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a conditional member write may have left a mutator on', async () => {
    // The conditional write may not have run, so the nested object may still
    // carry the mutator, and the call may have overwritten the member the
    // rule reads. The newest version of the nested object is not the only one
    // the container may hold.
    const consumer = [
      "import { asMutator, asNested, asProjected } from './producer';",
      'const facts = asNested();',
      '(facts.nested as { lookup?: unknown }).lookup = asMutator().lookup;',
      'if (chooseRead) (facts.nested as { lookup?: unknown }).lookup = asProjected().lookup;',
      "(facts.nested as { lookup?: unknown }).lookup(true ? 'alpha' : 'beta');",
      rule('w.state(facts.nested.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.nested.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a repeated producer call may have overwritten through a skipped write', async () => {
    // The conditional write may not have run, so the container may still hold
    // the mutator, and the repeated call reaches whichever version the
    // container holds - not only the newest one.
    const consumer = [
      "import { asMutator, asNested, asProjected } from './producer';",
      'const facts = asNested();',
      'facts.lookup = asMutator().lookup;',
      'if (chooseRead) facts.lookup = asProjected().lookup;',
      "asNested().lookup(true ? 'alpha' : 'beta');",
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state two skipped writes may have left a mutator on', async () => {
    // Both conditional writes may not have run, so the container may still
    // hold the mutator the first write installed, and neither the newest
    // version nor the one before it answers for the container.
    const consumer = [
      "import { asMutator, asNested, asProjected } from './producer';",
      'const facts = asNested();',
      'facts.lookup = asMutator().lookup;',
      'if (chooseRead) facts.lookup = asProjected().lookup;',
      'if (chooseOther) facts.lookup = asProjected().lookup;',
      "asNested().lookup(true ? 'alpha' : 'beta');",
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a repeated producer call may have overwritten after several skipped writes', async () => {
    // Every conditional write may not have run, so the container may hold any
    // combination of the graphs those writes produced. The container holds
    // one graph, so the graphs it may hold grow with the writes and not with
    // their combinations: a write that reaches the container reaches the
    // graph it holds, and one graph is not written twice.
    const consumer = [
      "import { asMutator, asNested, asProjected } from './producer';",
      'const facts = asNested();',
      'facts.lookup = asMutator().lookup;',
      'if (chooseRead) facts.lookup = asProjected().lookup;',
      'if (chooseOther) facts.lookup = asProjected().lookup;',
      'if (chooseThird) facts.lookup = asProjected().lookup;',
      'if (chooseFourth) facts.lookup = asProjected().lookup;',
      "asNested().lookup(true ? 'alpha' : 'beta');",
      rule('w.state(facts.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps a sibling container a write to another child did not reach', async () => {
    // The projection holds two children with the same shape, but they are two
    // containers with their own identity, so a write into one of them does
    // not reach the other, and the alias of the untouched child keeps the
    // proof the projection gave it.
    const consumer = [
      "import { asTwins } from './producer';",
      'const facts = asTwins();',
      'const alias = facts.left;',
      'facts.right.ready = null;',
      rule('w.state(alias.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asTwins', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('withdraws a state an alias of the written child may have replaced', async () => {
    // The alias names the same child the write reached, so the member the
    // rule reads is the one the write may have replaced.
    const consumer = [
      "import { asTwins } from './producer';",
      'const facts = asTwins();',
      'const alias = facts.right;',
      'facts.right.ready = null;',
      rule('w.state(alias.ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'alias.ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a producer call member may have replaced', async () => {
    // The producer hands the same container to every call, so the repeated
    // call reaches the container the first one bound, and the member the
    // write replaced is the member the call reads.
    const consumer = [
      "import { asNested } from './producer';",
      'const facts = asNested();',
      'facts.ready = null;',
      rule('w.state(asNested().ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'asNested().ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps a state a producer call member still proves', async () => {
    // The write reached another member, so the member the producer call
    // reads is still the one the projection put there.
    const consumer = [
      "import { asNested } from './producer';",
      'const facts = asNested();',
      'facts.nested.ready = null;',
      rule('w.state(asNested().ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asNested', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a producer call member may still have replaced', async () => {
    // The conditional write may not have run, so the container may still hold
    // the graph the first write produced, and the member the producer call
    // reads is the member that write replaced. The newest version of the
    // container is not the only one it may hold.
    const consumer = [
      "import { asNested } from './producer';",
      'const facts = asNested();',
      'facts.ready = null;',
      "if (chooseRestore) facts.ready = asNested().lookup('alpha');",
      rule('w.state(asNested().ready).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'asNested().ready', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('withholds a state a declared producer call member may still hold', async () => {
    // The projection's member is unknown, and the conditional write may not
    // have run, so the container may still hold the unknown member. The
    // declaration reads the member of a producer call, so it must keep that
    // alternative instead of answering with the newest member, and the later
    // write does not re-read the declaration's initializer.
    const consumer = [
      "import { asAmbiguous } from './producer';",
      'const facts = asAmbiguous();',
      "if (restore) facts.ready = facts.lookup('alpha');",
      'const selected = asAmbiguous().ready;',
      'facts.ready = null;',
      rule('w.state(selected).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'selected', reason: 'subject' }]);
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps a state a declared producer call member proves', async () => {
    // The declaration reads the member while it is proven, and it captures
    // that value: the write that follows does not reach the captured value.
    const consumer = [
      "import { asNested } from './producer';",
      'const facts = asNested();',
      'const selected = asNested().ready;',
      'facts.ready = null;',
      rule('w.state(selected).eq(true)'),
    ].join('\n');
    const { scan, tokens } = await analyze(consumer);
    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asNested', state: 'alpha' },
    ]);
    expect(scan.unresolved).toEqual([]);
    expect(tokens).toContain('data-[alpha]:bg-primary');
  });

  it('keeps a local state a member write replaced the projection with', async () => {
    // The member is written twice, and the second write is a known exposed
    // local state, so the member carries that local state: the projection the
    // member came from does not answer for it, and the local state is not
    // dropped with it.
    const consumer = [
      "import { definePrototype } from '@proto.ui/core';",
      "import { asProjected } from './producer';",
      'export default definePrototype({',
      '  setup(def) {',
      "    const local = def.state.bool('local', false);",
      "    def.expose.state('local', local);",
      '    const externalState = { ready: null };',
      '    const facts = asProjected();',
      '    facts.ready = externalState;',
      '    facts.ready = local;',
      '    def.rule({',
      '      when: (w) => w.state(facts.ready).eq(true),',
      "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
      '    });',
      '  },',
      '});',
    ].join('\n');
    const { tokens } = await analyze(consumer);
    expect(tokens).toContain('data-[local]:bg-primary');
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });

  it('keeps the projection member a local state did not replace', async () => {
    // The member was written with an unproven value, so it does not answer
    // with the projection's state either, and it does not inherit the local
    // state that was never written to it.
    const consumer = [
      "import { definePrototype } from '@proto.ui/core';",
      "import { asProjected } from './producer';",
      'export default definePrototype({',
      '  setup(def) {',
      "    const local = def.state.bool('local', false);",
      "    def.expose.state('local', local);",
      '    const externalState = { ready: null };',
      '    const facts = asProjected();',
      '    facts.ready = externalState;',
      '    def.rule({',
      '      when: (w) => w.state(facts.ready).eq(true),',
      "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
      '    });',
      '  },',
      '});',
    ].join('\n');
    const { tokens } = await analyze(consumer);
    expect(tokens).not.toContain('data-[local]:bg-primary');
    expect(tokens).not.toContain('data-[alpha]:bg-primary');
  });
});
