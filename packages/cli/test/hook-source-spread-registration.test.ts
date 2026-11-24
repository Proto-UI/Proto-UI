import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';

// These are the same configured-name/first-registration semantics exercised by
// hook-source-collision-order.test.ts. A later asFacts() must not manufacture its
// own selected State after asReplacement() has already installed the name.
const PRODUCERS = [
  "import { defineAsHook } from '@proto.ui/core';",
  "export const asFacts = defineAsHook({ name: 'spread-shared',",
  "  setup(def) { def.state.bool('selected', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.selected }; }',
  '});',
  "export const asReplacement = defineAsHook({ name: 'spread-shared',",
  "  setup(def) { def.state.bool('other', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.other }; }',
  '});',
].join('\n');

const scanAfter = async (invocation: string) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'hook-spread-registration-'));
  try {
    await writeFile(path.join(directory, 'producers.ts'), PRODUCERS);
    const file = path.join(directory, 'consumer.proto.ts');
    const source = [
      "import { definePrototype, tw } from '@proto.ui/core';",
      "import { asFacts, asReplacement } from './producers';",
      'function install(_unused: unknown, options: { replace: boolean },',
      '  _extra?: { replace: boolean }) {',
      '  if (options.replace) asReplacement();',
      '}',
      'function ignore(..._values: unknown[]) {}',
      "export default definePrototype({ name: 'spread-consumer', setup(def) {",
      `  ${invocation}`,
      '  const bag = asFacts();',
      '  def.rule({ when: w => w.state(bag.ready).eq(true),',
      "    intent: i => i.feedback.style.use(tw('bg-accent')) });",
      '} });',
    ].join('\n');
    await writeFile(file, source);
    return scanRuleStateReads(source, file, createHookSourceSummaryContext());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

describe('helper registration with spread arguments', () => {
  it('keeps the ordinary closed-record control without a spread', async () => {
    const scan = await scanAfter('install(0, { replace: false });');

    expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
      { hook: 'asFacts', state: 'selected' },
    ]);
    expect(scan.unresolved).toEqual([]);
  });

  it('does not bind the AST argument after a spread to the second runtime parameter', async () => {
    const scan = await scanAfter(
      'install(...([0, { replace: true }] as const), { replace: false });'
    );

    // Runtime expansion passes (0, { replace: true }, { replace: false }).
    // The replacement is therefore registered first. The replay has no proven
    // spread expansion or iterator-effect model and must withhold this capture.
    // Binding AST argument 1 to parameter 1 would read false and invent selected.
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
  });

  it('withholds capture when spread iteration registers a competing hook', async () => {
    const scan = await scanAfter(
      'ignore(...{ [Symbol.iterator]() { asReplacement(); return [0][Symbol.iterator](); } });'
    );

    // Evaluating the spread calls the authored iterator before ignore runs.
    // Merely refusing literal-record arguments would miss this registration.
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
  });

  it('observes spread iteration before a later producer argument', async () => {
    const scan = await scanAfter(
      'ignore(...{ [Symbol.iterator]() { asReplacement(); return [0][Symbol.iterator](); } }, asFacts());'
    );

    // The iterator installs the replacement before the later argument calls
    // asFacts. A guard reached only after all arguments would be too late:
    // the lexical registration scan can otherwise certify that earlier call.
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map(({ expression }) => expression)).toEqual(['bag.ready']);
  });
});
