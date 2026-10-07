// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { compareTraces, type SemanticCheckpoint } from '../src/conformance/trace';
import { updateRegistry, type UpdateAction } from '../src/conformance/update-cases';
import { startBrowserFixture, type BrowserFixture } from './browser-fixture';
import { writeCaseEvidence } from './case-evidence';

type Side = 'reference' | 'candidate' | 'source';
type Snapshot = {
  value: number | null;
  text: string | null;
  updates: number;
  present: boolean;
  sameHandle: boolean;
  sameOwnerHandle: boolean;
  invalid: boolean;
  disposed: boolean;
};
type Evidence = {
  compilation: { profile: string; mutant: boolean; generatedSha256: string } | null;
  lifecycle: Array<{ type: string; epoch?: number; revision?: number }>;
  commits: Array<{
    phase: string;
    commitTime: number;
    at: number;
    updates: number;
    text: string | null;
  }>;
  updatedEvents: Array<{ text: string | null; present: boolean; at: number }>;
};
type Probe = {
  ready(): boolean;
  write(value: number): void;
  request(): void;
  setPresent(value: boolean): void;
  rapid(requests: number): void;
  dispose(): void;
  read(): Snapshot;
  evidence(): Evidence;
};
type PathRun = { trace: SemanticCheckpoint[]; evidence?: Evidence };
const definition = updateRegistry.get('compiler.explicit-update');
const sides: readonly Side[] = ['reference', 'candidate', 'source'];
const viewport = { width: 800, height: 500 };
const requests = 6;
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const hash = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(path.join(repository, relative)))
    .digest('hex');
const identity = (side: Side) => ({
  reason:
    'Corresponding observed stable public imperative handles; no claim of internal token identity',
  aliases: { [`${side}-public-handle`]: 'update-public-handle' },
});
const identities = (side: 'candidate' | 'source') => ({
  reference: identity('reference'),
  candidate: identity(side),
});
let fixture: BrowserFixture;
beforeAll(async () => {
  fixture = await startBrowserFixture('update-intent');
  await replayManifest();
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function observe(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as { updateProbe: Probe }).updateProbe;
    return { snapshot: probe.read(), evidence: probe.evidence() };
  });
}
async function action(page: Page, input: UpdateAction) {
  await page.evaluate((input) => {
    const probe = (window as unknown as { updateProbe: Probe }).updateProbe;
    switch (input.kind) {
      case 'observe':
        return;
      case 'write':
        return probe.write(input.value);
      case 'request':
        return probe.request();
      case 'presence':
        return probe.setPresent(input.value);
      case 'dispose':
        return probe.dispose();
    }
  }, input);
}

async function inBrowser(
  side: Side,
  variant: 'unchanged' | 'without-update',
  scenario: 'registered' | 'rapid',
  run: PathRun,
  exercise: (page: Page) => Promise<void>
) {
  const context = await fixture.browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors: string[] = [];
  let harnessError: string | undefined;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  try {
    await page.goto(`${fixture.baseUrl}/update-intent.html?target=${side}&variant=${variant}`);
    await page.waitForFunction(() =>
      (window as unknown as { updateProbe?: Probe }).updateProbe?.ready()
    );
    await settle(page);
    await exercise(page);
    expect(errors).toEqual([]);
  } catch (error) {
    harnessError = String(error);
    await page
      .screenshot({
        path: path.join(fixture.evidenceDir, `${side}-${variant}-${scenario}-failure.png`),
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  } finally {
    run.evidence = await page
      .evaluate(() => (window as unknown as { updateProbe?: Probe }).updateProbe?.evidence())
      .catch(() => undefined);
    await writeFile(
      path.join(fixture.evidenceDir, `${side}-${variant}-${scenario}-host.json`),
      JSON.stringify(
        {
          scenario,
          side,
          variant,
          browser: fixture.browser.version(),
          environment: 'real-browser',
          inputSource: 'host-api',
          inputExplanation:
            'Browser automation navigates and observes; all prototype inputs are public host props or imperative API calls, not trusted native input.',
          orderedInputs:
            scenario === 'registered'
              ? definition.steps.map(({ id, action }) => ({ id, action }))
              : [
                  { id: 'mount', action: { kind: 'observe' } },
                  { id: 'write-without-update', action: { kind: 'write', value: 7 } },
                  { id: 'rapid-request', action: { kind: 'imperative-update', requests } },
                  { id: 'settled', action: { kind: 'observe' } },
                ],
          errors,
          harnessError,
          trace: run.trace,
          evidence: run.evidence,
        },
        null,
        2
      )
    );
    await context.close();
  }
}

async function collect(side: Side, variant: 'unchanged' | 'without-update', run: PathRun) {
  await inBrowser(side, variant, 'registered', run, async (page) => {
    let epoch = 0;
    let wasPresent = false;
    for (const step of definition.steps) {
      await action(page, step.action);
      await settle(page);
      const { snapshot } = await observe(page);
      if (snapshot.present && !wasPresent) ++epoch;
      wasPresent = snapshot.present;
      run.trace.push({
        step: step.id,
        phase: snapshot.disposed ? 'terminal' : snapshot.present ? 'mounted' : 'detached',
        ownerId: `${side}-public-handle`,
        parentId: null,
        viewEpoch: epoch,
        kind: 'snapshot',
        inputSources: step.action.kind === 'observe' ? [] : ['host-api'],
        data: snapshot,
      });
      if (
        ['write-without-update', 'explicit-update', 'request-detached', 'reattach'].includes(
          step.id
        )
      ) {
        await page.screenshot({
          path: path.join(fixture.evidenceDir, `${side}-${variant}-${step.id}.png`),
          fullPage: true,
        });
      }
    }
  });
}

async function replayManifest() {
  const relative = 'packages/compiler/test/fixtures/differential-browser/';
  const inputs = [
    definition.source,
    relative + 'update-intent.ts',
    relative + 'update-intent.html',
    relative + 'vite.config.ts',
    'packages/compiler/test/browser-update-intent.test.ts',
    'packages/compiler/test/browser-fixture.ts',
    'packages/compiler/test/case-evidence.ts',
    'packages/compiler/src/conformance/update-cases.ts',
    'packages/compiler/src/compile.ts',
    'packages/compiler/src/parser.ts',
    'packages/compiler/src/parser-module.ts',
    'packages/compiler/src/operations.ts',
    'packages/compiler/src/ir.ts',
    'packages/compiler/src/react.ts',
    'packages/compiler/src/react-source.ts',
    'packages/compiler/src/native-style.ts',
    'packages/compiler/src/native-context.ts',
    'packages/adapters/react/src/adapt.ts',
    'packages/adapters/react/src/runtime/session.ts',
    'packages/runtime/src/instance/session.ts',
    'vitest.config.ts',
    'pnpm-lock.yaml',
  ];
  await writeFile(
    path.join(fixture.evidenceDir, 'update-intent-replay.json'),
    JSON.stringify(
      {
        declaredRevision: process.env.GITHUB_SHA ?? null,
        runId: process.env.COMPILER_EVIDENCE_RUN_ID ?? null,
        revisionExplanation:
          'Declared revision is not an actual-tree identity; file hashes and generated/supporting source hashes capture executed local inputs.',
        browser: fixture.browser.version(),
        node: process.version,
        viewport,
        deviceScaleFactor: 1,
        react: JSON.parse(
          readFileSync(
            path.join(repository, 'packages/adapters/react/node_modules/react/package.json'),
            'utf8'
          )
        ).version,
        source: definition.source,
        profile: definition.profile,
        paths: {
          reference: 'original React Adapter',
          candidate: 'react-runtime-v1',
          source: 'react-dom-source-v1',
        },
        inputSources: ['host-api'],
        orderedInputs: definition.steps.map(({ id, action }) => ({ id, action })),
        rapidInputs: {
          write: 7,
          sameTaskRequests: requests,
          api: 'public imperative handle.update()',
        },
        files: inputs.map((file) => ({ file, sha256: hash(file) })),
      },
      null,
      2
    )
  );
}

describe.sequential('executed three-path explicit update browser contracts', () => {
  it('keeps write, commit, detached dirty, reattach and terminal contracts independent and rejects missing update', async () => {
    const runs: Record<Side, PathRun> = {
      reference: { trace: [] },
      candidate: { trace: [] },
      source: { trace: [] },
    };
    let harnessError: string | undefined;
    try {
      for (const side of sides) await collect(side, 'unchanged', runs[side]);
    } catch (error) {
      harnessError = String(error);
    }
    const results = await Promise.all(
      (['candidate', 'source'] as const).map(async (side) => {
        const normalization = identities(side);
        const result = updateRegistry.evaluateReport({
          id: definition.id,
          reference: runs.reference.trace,
          candidate: runs[side].trace,
          identities: normalization,
          harnessError,
        });
        await writeCaseEvidence(
          path.join(fixture.evidenceDir, side),
          result,
          runs.reference.trace,
          runs[side].trace,
          normalization,
          fixture.browser.version(),
          harnessError,
          definition
        );
        return result;
      })
    );
    expect(harnessError).toBeUndefined();
    for (const result of results) {
      expect(result.status, JSON.stringify(result.reasons)).toBe('PASS');
      for (const side of ['reference', 'candidate'] as const)
        expect(result.oracleCoverage?.[side].every((entry) => entry.outcome === 'PASS')).toBe(true);
    }
    for (const side of sides) {
      // onUpdated must observe committed text, not the old DOM before host acceptance.
      expect(
        runs[side].evidence?.updatedEvents.map(({ text, present }) => ({ text, present }))
      ).toEqual([{ text: '1', present: true }]);
      expect(
        runs[side].trace
          .filter((entry) => entry.step !== 'dispose')
          .every((entry) => (entry.data as Snapshot).sameOwnerHandle)
      ).toBe(true);
    }
    expect(runs.candidate.evidence?.compilation?.profile).toBe('react-runtime-v1');
    expect(runs.source.evidence?.compilation?.profile).toBe('react-dom-source-v1');

    const mutant: PathRun = { trace: [] };
    let mutationError: string | undefined;
    try {
      await collect('candidate', 'without-update', mutant);
    } catch (error) {
      mutationError = String(error);
    }
    const normalization = identities('candidate');
    const mutation = updateRegistry.evaluateReport({
      id: definition.id,
      reference: runs.reference.trace,
      candidate: mutant.trace,
      identities: normalization,
      harnessError: mutationError,
    });
    await writeCaseEvidence(
      path.join(fixture.evidenceDir, 'mutant'),
      mutation,
      runs.reference.trace,
      mutant.trace,
      normalization,
      fixture.browser.version(),
      mutationError,
      definition
    );
    const comparisonOptions = {
      referenceIdentity: normalization.reference,
      candidateIdentity: normalization.candidate,
    };
    const comparison = compareTraces(runs.reference.trace, mutant.trace, comparisonOptions);
    const prefixComparison = compareTraces(
      runs.reference.trace.slice(0, 2),
      mutant.trace.slice(0, 2),
      comparisonOptions
    );
    await writeFile(
      path.join(fixture.evidenceDir, 'mutant-without-update.json'),
      JSON.stringify(
        {
          controls: results,
          mutation,
          comparison,
          prefixComparison,
          intendedCheckpoint: 'explicit-update',
          reference: runs.reference,
          candidate: runs.candidate,
          source: runs.source,
          mutant,
        },
        null,
        2
      )
    );
    expect(mutationError).toBeUndefined();
    expect(mutant.evidence?.compilation?.mutant).toBe(true);
    expect(mutation.status).toBe('FAIL');
    expect(mutation.failures).toContain('compiler-mismatch');
    expect(mutation.oracleCoverage?.reference.every((entry) => entry.outcome === 'PASS')).toBe(
      true
    );
    expect(prefixComparison).toEqual({ equal: true });
    expect(runs.reference.trace[2].step).toBe('explicit-update');
    expect(mutant.trace[2].step).toBe('explicit-update');
    expect(comparison).toEqual({
      equal: false,
      firstDifference: {
        checkpoint: 2,
        path: [2, 'data', 'text'],
        reference: { present: true, value: '1' },
        candidate: { present: true, value: '0' },
      },
    });
    expect(
      mutation.oracleCoverage?.candidate.find((entry) => entry.criterion === 'C-LIFECYCLE-0003-A')
        ?.outcome
    ).toBe('FAIL');
  }, 120_000);

  it('settles same-task redundant requests against actual accepted commits on each path', async () => {
    for (const side of sides) {
      const run: PathRun = { trace: [] };
      await inBrowser(side, 'unchanged', 'rapid', run, async (page) => {
        const observations: Array<{ step: string; snapshot: Snapshot; evidence: Evidence }> = [];
        const checkpoint = async (step: string) => {
          const observed = await observe(page);
          observations.push({ step, ...observed });
          run.trace.push({
            step,
            phase: 'mounted',
            ownerId: `${side}-public-handle`,
            parentId: null,
            viewEpoch: 1,
            kind: 'snapshot',
            inputSources: step === 'mount' ? [] : ['host-api'],
            data: observed.snapshot,
          });
          return observed;
        };
        try {
          await checkpoint('mount');
          await action(page, { kind: 'write', value: 7 });
          await settle(page);
          const before = await checkpoint('write-without-update');
          expect(before.snapshot).toMatchObject({
            value: 7,
            text: '0',
            updates: 0,
            sameHandle: true,
          });
          const pending = await page.evaluate((requests) => {
            const probe = (window as unknown as { updateProbe: Probe }).updateProbe;
            probe.rapid(requests);
            return probe.read();
          }, requests);
          expect(pending).toMatchObject({ value: 7, text: '0', updates: 0 });
          await settle(page);
          const after = await checkpoint('rapid-settled');
          expect(after.snapshot).toMatchObject({
            value: 7,
            text: '7',
            present: true,
            sameHandle: true,
            sameOwnerHandle: true,
          });
          const updated = after.snapshot.updates - before.snapshot.updates;
          const commits = after.evidence.commits.slice(before.evidence.commits.length);
          const notifications = after.evidence.updatedEvents.slice(
            before.evidence.updatedEvents.length
          );
          expect(updated).toBeGreaterThan(0);
          expect(updated).toBeLessThanOrEqual(requests);
          expect(notifications).toHaveLength(updated);
          expect(notifications.every((entry) => entry.text === '7' && entry.present)).toBe(true);
          expect(commits.length).toBeGreaterThanOrEqual(updated);
          if (side === 'source') {
            // With no host prop changes or style rerenders, these are native template commits.
            expect(commits).toHaveLength(updated);
          } else {
            // Signal.done diagnostics execute from the Adapter's actual layout commit acceptance.
            const accepted = after.evidence.lifecycle
              .slice(before.evidence.lifecycle.length)
              .filter((entry) => entry.type === 'update.commit.done');
            expect(accepted).toHaveLength(updated);
            expect(new Set(accepted.map((entry) => `${entry.epoch}:${entry.revision}`)).size).toBe(
              updated
            );
          }
          await settle(page);
          const stable = await checkpoint('stable-after-extra-frames');
          expect(stable.snapshot).toEqual(after.snapshot);
          expect(stable.evidence.updatedEvents).toEqual(after.evidence.updatedEvents);
          expect(stable.evidence.commits).toEqual(after.evidence.commits);
        } finally {
          await writeFile(
            path.join(fixture.evidenceDir, `${side}-rapid-checkpoints.json`),
            JSON.stringify(
              {
                browser: fixture.browser.version(),
                requests,
                inputSource: 'host-api',
                observations,
                scope:
                  'Per-path update/actual-commit correspondence; batching counts are not cross-profile equivalence claims.',
              },
              null,
              2
            )
          );
        }
      });
    }
  }, 120_000);
});
