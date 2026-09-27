// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { compileFile } from '../src/compile';
import { buttonCases, evaluateButtonCase, type ButtonCase } from '../src/conformance/button-cases';
import { compareTraces, type SemanticCheckpoint, type TraceValue } from '../src/conformance/trace';
import { recordBrowserCase, startBrowserFixture, type BrowserFixture } from './browser-fixture';

type Probe = {
  ready(): boolean;
  read(): Record<string, TraceValue>;
  setDisabled(value: boolean): void;
  setPresent(value: boolean): void;
  setLabel(value: string): void;
  setContext(value: string): void;
  rerender(): void;
  focusSelf(): void;
  blur(): void;
  dispose(): void;
  staleClick(): void;
};
type ProbeCommand = Exclude<keyof Probe, 'ready' | 'read'>;
let fixture: BrowserFixture;
beforeAll(async () => {
  fixture = await startBrowserFixture('native-lifecycle');
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);

const identities = {
  reference: {
    reason:
      'Opaque IDs assigned to actual Adapter tokens for the single trigger owner; legacy cases use harness role labels',
    aliases: { reference: 'button', 'reference-owner-1': 'retained-owner' },
  },
  candidate: {
    reason:
      'Corresponding actual Adapter token; later recreated owners are deliberately not normalized to the original owner',
    aliases: { candidate: 'button', 'candidate-owner-1': 'retained-owner' },
  },
};

async function command(page: Page, method: ProbeCommand, argument?: string | boolean) {
  await page.evaluate(
    ({ method, argument }) => {
      const probe = (window as unknown as { nativeProbe: Probe }).nativeProbe;
      (probe[method] as (argument?: string | boolean) => void)(argument);
    },
    { method, argument }
  );
}

async function collectPath(
  side: 'reference' | 'candidate',
  definition: ButtonCase,
  trace: SemanticCheckpoint[],
  variant = 'unchanged'
) {
  const context = await fixture.browser.newContext({ viewport: { width: 800, height: 500 } });
  const page = await context.newPage();
  const errors: string[] = [];
  const accessibility: unknown[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  try {
    const entry = definition.id === 'button.retained-owner' ? 'retained-owner' : 'native-lifecycle';
    await page.goto(`${fixture.baseUrl}/${entry}.html?target=${side}&variant=${variant}`);
    await page.waitForFunction(() =>
      (window as unknown as { nativeProbe?: Probe }).nativeProbe?.ready()
    );
    const cdp = await context.newCDPSession(page);
    const target = page.locator('#native-root [data-pui-root]');
    for (const step of definition.steps) {
      const action = step.action;
      switch (action.kind) {
        case 'observe':
          break;
        case 'presence':
          await command(page, 'setPresent', action.present);
          break;
        case 'click':
          await target.click();
          break;
        case 'up':
          await page.mouse.up();
          break;
        case 'leave':
          await page.mouse.move(0, 0);
          break;
        case 'tab':
          await page.keyboard.press('Tab');
          break;
        case 'key-down':
          await page.keyboard.down(action.key);
          break;
        case 'key-up':
          await page.keyboard.up(action.key);
          break;
        case 'focus':
          await command(page, 'focusSelf');
          break;
        case 'blur':
          await command(page, 'blur');
          break;
        case 'hover':
          await target.hover();
          break;
        case 'down':
          await page.mouse.down();
          break;
        case 'props':
          if (action.disabled === null)
            throw new Error('Omission is exercised by the separate omission journey');
          await command(page, 'setDisabled', action.disabled);
          break;
        case 'label':
          await command(page, 'setLabel', action.value);
          break;
        case 'context':
          await command(page, 'setContext', action.value);
          break;
        case 'rerender':
          await command(page, 'rerender');
          break;
        case 'native-child-click':
          await page.locator('[data-native-label]').click();
          break;
        case 'outside-click':
          await page.locator('#outside-native').click();
          break;
        case 'dispose':
          await command(page, 'dispose');
          break;
        case 'stale-click':
          await command(page, 'staleClick');
          break;
        default:
          throw new Error(`No native/lifecycle driver for ${action.kind}`);
      }
      // Observe after host work settles, not by polling until an oracle's desired value appears.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const observed = await page.evaluate(() =>
        (window as unknown as { nativeProbe: Probe }).nativeProbe.read()
      );
      // Move opaque identity observations into the canonical identity fields; do not discard them.
      const { observedOwnerId, observedParentId, ...data } = observed;
      if (data.present) {
        const document = await cdp.send('DOM.getDocument');
        const node = await cdp.send('DOM.querySelector', {
          nodeId: document.root.nodeId,
          selector: '#native-root [data-pui-root]',
        });
        const description = await cdp.send('DOM.describeNode', { nodeId: node.nodeId });
        const tree = await cdp.send('Accessibility.getPartialAXTree', {
          backendNodeId: description.node.backendNodeId,
          fetchRelatives: false,
        });
        accessibility.push({ step: step.id, tree });
        const ax = tree.nodes.find(
          (entry: { backendDOMNodeId?: number }) =>
            entry.backendDOMNodeId === description.node.backendNodeId
        );
        if (!ax || ax.ignored)
          throw new Error(`Root absent/ignored in browser AX tree at ${step.id}`);
        data.axRole = ax.role?.value ?? null;
        data.axName = ax.name?.value ?? null;
        data.axDisabled =
          ax.properties?.find((entry: { name: string }) => entry.name === 'disabled')?.value
            ?.value ?? null;
        data.axPresent = true;
      } else if (typeof data.nameInput === 'string') {
        const tree = await cdp.send('Accessibility.getFullAXTree');
        accessibility.push({ step: step.id, tree });
        data.axPresent = tree.nodes.some(
          (entry) =>
            !entry.ignored && entry.role?.value === 'button' && entry.name?.value === data.nameInput
        );
      }
      trace.push({
        step: step.id,
        phase:
          typeof data.mountPhase === 'string'
            ? data.mountPhase
            : data.present
              ? 'mounted'
              : data.disposed === false
                ? 'owner-without-host-view'
                : 'after-terminal-unmount',
        ownerId: typeof observedOwnerId === 'string' ? observedOwnerId : side,
        parentId: typeof observedParentId === 'string' ? observedParentId : null,
        viewEpoch: typeof data.epoch === 'number' ? data.epoch : 0,
        kind: 'snapshot',
        inputSources:
          action.kind === 'stale-click'
            ? ['synthetic-dispatch']
            : [
                  'tab',
                  'key-down',
                  'key-up',
                  'hover',
                  'down',
                  'up',
                  'leave',
                  'click',
                  'native-child-click',
                  'outside-click',
                ].includes(action.kind)
              ? ['browser-automation']
              : ['host-api'],
        data,
      });
      if (
        ['down', 'hold', 'detach', 'reattach'].includes(step.id) ||
        step === definition.steps[definition.steps.length - 1]
      ) {
        await page.screenshot({
          path: path.join(
            fixture.evidenceDir,
            `${side}-${definition.id}-${variant}-${step.id}.png`
          ),
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(
      path.join(fixture.evidenceDir, `${side}-${definition.id}-${variant}-host.json`),
      JSON.stringify({ errors, accessibility, trace }, null, 2)
    );
    await context.close();
  }
}

const cases = [
  'button.keyboard-focus',
  'button.native-mixing',
  'button.terminal-cleanup',
  'button.retained-owner',
];
describe.sequential('bounded native and lifecycle Adapter/generated cases', () => {
  for (const id of cases) {
    it(
      id,
      async () => {
        const definition = buttonCases().find((entry) => entry.id === id);
        if (!definition) throw new Error(`Unregistered case ${id}`);
        const reference: SemanticCheckpoint[] = [];
        const candidate: SemanticCheckpoint[] = [];
        let result;
        let harnessError: string | undefined;
        try {
          await collectPath('reference', definition, reference);
          if (id === 'button.retained-owner') {
            // Establish the original path before the red frontend-admission assertion.
            const referenceOracles = evaluateButtonCase(id, reference, reference, {
              reference: identities.reference,
              candidate: identities.reference,
            });
            expect(referenceOracles.status, JSON.stringify(referenceOracles.reasons)).toBe('PASS');
            const source = fileURLToPath(
              new URL('./fixtures/differential-browser/retained-owner.proto.ts', import.meta.url)
            );
            const admission = await compileFile(source, {
              root: fileURLToPath(new URL('../../../', import.meta.url)),
            });
            expect(admission.ok, JSON.stringify(admission.ok ? [] : admission.diagnostics)).toBe(
              true
            );
          }
          await collectPath('candidate', definition, candidate);
        } catch (error) {
          harnessError = String(error);
          throw error;
        } finally {
          result = await recordBrowserCase(
            fixture,
            id,
            reference,
            candidate,
            identities,
            harnessError
          );
        }
        expect(result.failures).toEqual([]);
        expect(result.status).toBe('PASS');
      },
      120_000
    );
  }

  it('detects emitted state loss and owner recreation against passing unchanged paths', async () => {
    const definition = buttonCases().find((entry) => entry.id === 'button.retained-owner')!;
    const reference: SemanticCheckpoint[] = [];
    const unchanged: SemanticCheckpoint[] = [];
    await collectPath('reference', definition, reference);
    await collectPath('candidate', definition, unchanged);
    const control = evaluateButtonCase(definition.id, reference, unchanged, identities);
    expect(control.status, JSON.stringify(control.reasons)).toBe('PASS');
    for (const variant of ['reset-state', 'recreate-owner']) {
      const mutant: SemanticCheckpoint[] = [];
      await collectPath('candidate', definition, mutant, variant);
      const result = evaluateButtonCase(definition.id, reference, mutant, identities);
      const comparison = compareTraces(reference, mutant, {
        referenceIdentity: identities.reference,
        candidateIdentity: identities.candidate,
      });
      await writeFile(
        path.join(fixture.evidenceDir, `mutant-${variant}.json`),
        JSON.stringify(
          { variant, control, result, comparison, reference, unchanged, mutant },
          null,
          2
        )
      );
      expect(result.status).toBe('FAIL');
      expect(result.failures).toContain('compiler-mismatch');
      expect(result.oracleCoverage?.reference.every((entry) => entry.outcome === 'PASS')).toBe(
        true
      );
      expect(comparison.equal).toBe(false);
      if (comparison.equal) throw new Error('Mutant incorrectly matched');
      expect(reference[comparison.firstDifference.checkpoint].step).toBe(
        variant === 'reset-state' ? 'detach' : 'attach'
      );
      if (variant === 'reset-state') {
        expect(comparison.firstDifference.path).toEqual([
          comparison.firstDifference.checkpoint,
          'data',
          'count',
        ]);
        expect(mutant.find((point) => point.step === 'detach')?.data).toMatchObject({
          count: 0,
          sameHandles: true,
          handlesValid: true,
          disposeCount: 0,
        });
      } else {
        const attach = mutant.find((point) => point.step === 'attach')!;
        const reattach = mutant.find((point) => point.step === 'reattach')!;
        expect(reattach.ownerId).not.toBe(attach.ownerId);
        expect(reattach.data).toMatchObject({
          sameOwner: false,
          sameHandles: false,
          handlesValid: false,
        });
      }
    }
  }, 120_000);
});
