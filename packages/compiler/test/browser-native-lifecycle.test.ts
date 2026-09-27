// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { buttonCases, type ButtonCase } from '../src/conformance/button-cases';
import type { SemanticCheckpoint, TraceValue } from '../src/conformance/trace';
import { recordBrowserCase, startBrowserFixture, type BrowserFixture } from './browser-fixture';

type Probe = {
  ready(): boolean;
  read(): Record<string, TraceValue>;
  setDisabled(value: boolean): void;
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
  trace: SemanticCheckpoint[]
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
    await page.goto(`${fixture.baseUrl}/native-lifecycle.html?target=${side}`);
    await page.waitForFunction(() =>
      (window as unknown as { nativeProbe?: Probe }).nativeProbe?.ready()
    );
    const cdp = await context.newCDPSession(page);
    const target = page.locator('#native-root [data-pui-root]');
    for (const step of definition.steps) {
      const action = step.action;
      switch (action.kind) {
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
      // Observe after host work settles, not by polling until the oracle's desired value appears.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const data = await page.evaluate(() =>
        (window as unknown as { nativeProbe: Probe }).nativeProbe.read()
      );
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
      }
      trace.push({
        step: step.id,
        phase: data.present ? 'mounted' : 'after-terminal-unmount',
        ownerId: side,
        parentId: null,
        viewEpoch: 0,
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
                  'native-child-click',
                  'outside-click',
                ].includes(action.kind)
              ? ['browser-automation']
              : ['host-api'],
        data,
      });
      if (step.id === 'down' || step === definition.steps[definition.steps.length - 1]) {
        await page.screenshot({
          path: path.join(fixture.evidenceDir, `${side}-${definition.id}-${step.id}.png`),
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(
      path.join(fixture.evidenceDir, `${side}-${definition.id}-host.json`),
      JSON.stringify({ errors, accessibility, trace }, null, 2)
    );
    await context.close();
  }
}

const cases = ['button.keyboard-focus', 'button.native-mixing', 'button.terminal-cleanup'];
describe.sequential('bounded native and terminal Adapter/generated cases', () => {
  for (const id of cases) {
    it(
      id,
      async () => {
        const definition = buttonCases().find((entry) => entry.id === id);
        if (!definition) throw new Error(`Unregistered case ${id}`);
        const reference: SemanticCheckpoint[] = [];
        const candidate: SemanticCheckpoint[] = [];
        const identities = {
          reference: {
            reason:
              'Harness role labels for corresponding single instances, not runtime identity observations',
            aliases: { reference: 'button' },
          },
          candidate: {
            reason:
              'Harness role labels for corresponding single instances, not runtime identity observations',
            aliases: { candidate: 'button' },
          },
        };
        let result;
        let harnessError: string | undefined;
        try {
          await collectPath('reference', definition, reference);
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
});
