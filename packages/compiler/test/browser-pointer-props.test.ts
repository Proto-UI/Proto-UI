// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buttonCases, evaluateButtonCase } from '../src/conformance/button-cases';
import { generateSequence } from '../src/conformance/sequences';
import { compareTraces, type SemanticCheckpoint, type TraceValue } from '../src/conformance/trace';
import { recordBrowserCase, startBrowserFixture, type BrowserFixture } from './browser-fixture';

const definition = buttonCases().find((entry) => entry.id === 'button.pointer-props')!;
const seed = Number(process.env.COMPILER_POINTER_SEED ?? 20260927);
const fractions = generateSequence(seed, definition.steps.length, [0.35, 0.5, 0.65]);
const viewport = { width: 800, height: 500 };
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const hash = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(path.join(repository, relative)))
    .digest('hex');
const identities = {
  reference: {
    reason: 'Corresponding actual single-owner Adapter tokens; no subsequent owner is normalized',
    aliases: { 'reference-owner-1': 'pointer-button' },
  },
  candidate: {
    reason: 'Corresponding actual single-owner Adapter token on emitted path',
    aliases: { 'candidate-owner-1': 'pointer-button' },
  },
};
type Probe = {
  ready(): boolean;
  step(id: string): void;
  setDisabled(value: boolean): void;
  omitDisabled(): void;
  dispose(): void;
  staleClick(): void;
  read(): { ownerId: string; data: Record<string, TraceValue> };
};
let fixture: BrowserFixture;
beforeAll(async () => {
  fixture = await startBrowserFixture('pointer-props');
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);

async function runPath(
  side: 'reference' | 'candidate',
  variant: 'unchanged' | 'duplicate-click',
  trace: SemanticCheckpoint[]
) {
  const context = await fixture.browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  try {
    await page.goto(`${fixture.baseUrl}/pointer-props.html?target=${side}&variant=${variant}`);
    await page.waitForFunction(() =>
      (window as unknown as { pointerProbe?: Probe }).pointerProbe?.ready()
    );
    for (const [index, step] of definition.steps.entries()) {
      await page.evaluate(
        (id) => (window as unknown as { pointerProbe: Probe }).pointerProbe.step(id),
        step.id
      );
      const action = step.action;
      if (action.kind === 'hover' || action.kind === 'click') {
        const box = await page.locator('#pointer-root [data-pui-root]').boundingBox();
        if (!box) throw new Error(`Missing root at ${step.id}`);
        const point = { x: box.x + box.width * fractions[index], y: box.y + box.height / 2 };
        // Real browser input, including disabled attempts; do not substitute dispatchEvent.
        if (action.kind === 'hover') await page.mouse.move(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
      } else if (action.kind === 'down') await page.mouse.down();
      else if (action.kind === 'up') await page.mouse.up();
      else if (action.kind === 'leave') await page.mouse.move(0, 0);
      else if (action.kind === 'props') {
        await page.evaluate((disabled) => {
          const probe = (window as unknown as { pointerProbe: Probe }).pointerProbe;
          if (disabled === null) probe.omitDisabled();
          else probe.setDisabled(disabled);
        }, action.disabled);
      } else if (action.kind === 'dispose')
        await page.evaluate(() =>
          (window as unknown as { pointerProbe: Probe }).pointerProbe.dispose()
        );
      else if (action.kind === 'stale-click')
        await page.evaluate(() =>
          (window as unknown as { pointerProbe: Probe }).pointerProbe.staleClick()
        );
      else throw new Error(`Unsupported pointer/props action ${action.kind}`);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const observed = await page.evaluate(() =>
        (window as unknown as { pointerProbe: Probe }).pointerProbe.read()
      );
      trace.push({
        step: step.id,
        phase: observed.data.present ? 'mounted' : 'terminal',
        ownerId: observed.ownerId,
        parentId: null,
        viewEpoch: 1,
        kind: 'snapshot',
        inputSources:
          action.kind === 'props' || action.kind === 'dispose'
            ? ['host-api']
            : action.kind === 'stale-click'
              ? ['synthetic-dispatch']
              : ['browser-automation'],
        data: observed.data,
      });
      if (['hover', 'disable', 'omit-disabled', 'dispose'].includes(step.id)) {
        await page.screenshot({
          path: path.join(fixture.evidenceDir, `${side}-${variant}-${step.id}.png`),
          fullPage: true,
        });
      }
    }
    const finalInputs = trace.at(-1)!.data as {
      inputs: Array<{ step: string; type: string; trusted: boolean }>;
    };
    expect(
      finalInputs.inputs
        .filter((entry) => entry.step !== 'stale-after-dispose')
        .every((entry) => entry.trusted)
    ).toBe(true);
    expect(
      finalInputs.inputs
        .filter((entry) => entry.step === 'stale-after-dispose')
        .map((entry) => entry.trusted)
    ).toEqual([false]);
    const nativeTypes: Record<string, string> = {
      hover: 'pointerenter',
      down: 'pointerdown',
      up: 'pointerup',
      click: 'click',
      leave: 'pointerleave',
    };
    for (const step of definition.steps) {
      const type = nativeTypes[step.action.kind];
      if (type)
        expect(
          finalInputs.inputs.some(
            (entry) => entry.step === step.id && entry.type === type && entry.trusted
          ),
          step.id
        ).toBe(true);
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(
      path.join(fixture.evidenceDir, `${side}-${variant}-host.json`),
      JSON.stringify({ errors, trace }, null, 2)
    );
    await context.close();
  }
}

async function replayManifest() {
  const relative = 'packages/compiler/test/fixtures/differential-browser/';
  await writeFile(
    path.join(fixture.evidenceDir, 'pointer-props-replay.json'),
    JSON.stringify(
      {
        sourceRevision: process.env.GITHUB_SHA ?? null,
        runId: process.env.COMPILER_EVIDENCE_RUN_ID ?? null,
        seed,
        seedUse:
          'LCG chooses safe horizontal pointer fractions; ordered actions are fixed by registry',
        orderedInputs: definition.steps.map((step, index) => ({
          id: step.id,
          action: step.action,
          fraction: fractions[index],
        })),
        viewport,
        deviceScaleFactor: 1,
        browser: fixture.browser.version(),
        node: process.version,
        react: JSON.parse(
          readFileSync(
            path.join(repository, 'packages/adapters/react/node_modules/react/package.json'),
            'utf8'
          )
        ).version,
        source: definition.source,
        sourceSha256: hash(definition.source),
        lockfileSha256: hash('pnpm-lock.yaml'),
        cssSha256: hash(relative + 'pointer-props.css'),
        harnessSha256: hash('packages/compiler/test/browser-pointer-props.test.ts'),
        fixtureSha256: hash(relative + 'pointer-props.ts'),
        styleFamily: definition.styleFamily,
      },
      null,
      2
    )
  );
}

describe('executed Button pointer/props evidence', () => {
  it('satisfies pointer/props contracts on both paths and rejects one extra emitted signal', async () => {
    const reference: SemanticCheckpoint[] = [];
    const candidate: SemanticCheckpoint[] = [];
    await replayManifest();
    let result;
    let harnessError: string | undefined;
    try {
      await runPath('reference', 'unchanged', reference);
      await runPath('candidate', 'unchanged', candidate);
    } catch (error) {
      harnessError = String(error);
      throw error;
    } finally {
      result = await recordBrowserCase(
        fixture,
        definition.id,
        reference,
        candidate,
        identities,
        harnessError
      );
    }
    expect(result.status, JSON.stringify(result.reasons)).toBe('PASS');
    for (const side of ['reference', 'candidate'] as const) {
      expect(result.oracleCoverage?.[side].every((entry) => entry.outcome === 'PASS')).toBe(true);
    }
    const mutant: SemanticCheckpoint[] = [];
    await runPath('candidate', 'duplicate-click', mutant);
    const mutation = evaluateButtonCase(definition.id, reference, mutant, identities);
    const comparison = compareTraces(reference, mutant, {
      referenceIdentity: identities.reference,
      candidateIdentity: identities.candidate,
    });
    const prefixComparison = compareTraces(reference.slice(0, 2), mutant.slice(0, 2), {
      referenceIdentity: identities.reference,
      candidateIdentity: identities.candidate,
    });
    await writeFile(
      path.join(fixture.evidenceDir, 'mutant-duplicate-click.json'),
      JSON.stringify(
        {
          seed,
          control: result,
          mutation,
          comparison,
          prefixComparison,
          reference,
          candidate,
          mutant,
        },
        null,
        2
      )
    );
    expect(mutation.status).toBe('FAIL');
    expect(mutation.failures).toContain('compiler-mismatch');
    expect(mutation.oracleCoverage?.reference.every((entry) => entry.outcome === 'PASS')).toBe(
      true
    );
    expect(prefixComparison).toEqual({ equal: true });
    expect(reference[2].step).toBe('up');
    expect(mutant[2].step).toBe('up');
    expect(comparison).toEqual({
      equal: false,
      firstDifference: {
        checkpoint: 2,
        path: [2, 'data', 'clicks'],
        reference: { present: true, value: 1 },
        candidate: { present: true, value: 2 },
      },
    });
    expect(
      mutation.oracleCoverage?.candidate.find(
        (entry) => entry.criterion === 'P-BASE-BUTTON-CLICK-SIGNAL'
      )?.outcome
    ).toBe('FAIL');
  }, 120_000);
});
