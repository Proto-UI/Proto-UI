// @vitest-environment node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer as createViteServer } from '../../../apps/workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type { Browser, Page } from '../../../apps/www/node_modules/playwright-core/types/types';

type Target = 'reference' | 'runtime' | 'source' | 'source-duplicate-activation';
type Probe = {
  ready(): boolean;
  step(id: string): void;
  setLater(value: boolean): void;
  setPresent(value: boolean): void;
  setDisabled(value: boolean): void;
  setAccent(value: boolean): void;
  dispose(): void;
  read(): Record<string, unknown>;
};
type Action =
  | {
      kind:
        | 'observe'
        | 'tab'
        | 'tab-from-before'
        | 'pointer-down'
        | 'pointer-up'
        | 'pointer-click'
        | 'dispose';
    }
  | { kind: 'key' | 'key-down' | 'key-up'; key: string }
  | { kind: 'later' | 'present' | 'disabled' | 'accent'; value: boolean };
type Step = {
  id: string;
  action: Action;
  color?: string;
  width?: number;
  clicks: number;
  count: number;
  text?: string;
};
const green = 'rgb(34, 197, 94)';
const red = 'rgb(239, 68, 68)';
const purple = 'rgb(168, 85, 247)';
const steps: Step[] = [
  { id: 'initial', action: { kind: 'observe' }, color: green, width: 224, clicks: 0, count: 0 },
  {
    id: 'withdraw-opacity-rule',
    action: { kind: 'key', key: 'r' },
    color: green,
    width: 224,
    clicks: 0,
    count: 0,
  },
  {
    id: 'later-rule',
    action: { kind: 'later', value: true },
    color: red,
    width: 256,
    clicks: 0,
    count: 0,
  },
  {
    id: 'withdraw-later-rule',
    action: { kind: 'later', value: false },
    color: green,
    width: 224,
    clicks: 0,
    count: 0,
  },
  {
    id: 'suppress-width',
    action: { kind: 'key', key: 's' },
    color: green,
    width: 160,
    clicks: 0,
    count: 0,
  },
  {
    id: 'patch-runtime',
    action: { kind: 'key', key: 'p' },
    color: purple,
    width: 288,
    clicks: 0,
    count: 0,
  },
  {
    id: 'clear-runtime-patch',
    action: { kind: 'key', key: 'c' },
    color: green,
    width: 224,
    clicks: 0,
    count: 0,
  },
  {
    id: 'prop-rule',
    action: { kind: 'accent', value: true },
    color: red,
    width: 256,
    clicks: 0,
    count: 0,
  },
  {
    id: 'withdraw-prop-rule',
    action: { kind: 'accent', value: false },
    color: green,
    width: 224,
    clicks: 0,
    count: 0,
  },
  {
    id: 'later-before-detach',
    action: { kind: 'later', value: true },
    color: red,
    width: 256,
    clicks: 0,
    count: 0,
  },
  {
    id: 'patch-before-detach',
    action: { kind: 'key', key: 'p' },
    color: purple,
    width: 288,
    clicks: 0,
    count: 0,
  },
  { id: 'detach', action: { kind: 'present', value: false }, clicks: 0, count: 0 },
  {
    id: 'reattach',
    action: { kind: 'present', value: true },
    color: purple,
    width: 288,
    clicks: 0,
    count: 0,
  },
  {
    id: 'clear-after-reattach',
    action: { kind: 'key', key: 'c' },
    color: red,
    width: 256,
    clicks: 0,
    count: 0,
  },
  {
    id: 'withdraw-after-reattach',
    action: { kind: 'later', value: false },
    color: green,
    width: 224,
    clicks: 0,
    count: 0,
  },
  { id: 'tab-before', action: { kind: 'tab' }, color: green, width: 224, clicks: 0, count: 0 },
  { id: 'tab-root', action: { kind: 'tab' }, color: green, width: 224, clicks: 0, count: 0 },
  // Existing Router commits Space on keydown; do not substitute native-button release timing.
  {
    id: 'space-down',
    action: { kind: 'key-down', key: 'Space' },
    color: green,
    width: 224,
    clicks: 1,
    count: 1,
    text: 'Presentation 0',
  },
  {
    id: 'space-up',
    action: { kind: 'key-up', key: 'Space' },
    color: green,
    width: 224,
    clicks: 1,
    count: 1,
    text: 'Presentation 0',
  },
  {
    id: 'explicit-update-space',
    action: { kind: 'key', key: 'u' },
    color: green,
    width: 224,
    clicks: 1,
    count: 1,
    text: 'Presentation 1',
  },
  {
    id: 'pointer-down',
    action: { kind: 'pointer-down' },
    color: green,
    width: 224,
    clicks: 1,
    count: 1,
    text: 'Presentation 1',
  },
  {
    id: 'pointer-up',
    action: { kind: 'pointer-up' },
    color: green,
    width: 224,
    clicks: 2,
    count: 2,
    text: 'Presentation 1',
  },
  {
    id: 'explicit-update-pointer',
    action: { kind: 'key', key: 'u' },
    color: green,
    width: 224,
    clicks: 2,
    count: 2,
    text: 'Presentation 2',
  },
  {
    id: 'disable',
    action: { kind: 'disabled', value: true },
    color: green,
    width: 224,
    clicks: 2,
    count: 2,
    text: 'Presentation 2',
  },
  {
    id: 'disabled-pointer',
    action: { kind: 'pointer-click' },
    color: green,
    width: 224,
    clicks: 2,
    count: 2,
    text: 'Presentation 2',
  },
  {
    id: 'disabled-space',
    action: { kind: 'key', key: 'Space' },
    color: green,
    width: 224,
    clicks: 2,
    count: 2,
    text: 'Presentation 2',
  },
  {
    id: 'disabled-tab',
    action: { kind: 'tab-from-before' },
    color: green,
    width: 224,
    clicks: 2,
    count: 2,
    text: 'Presentation 2',
  },
  { id: 'dispose', action: { kind: 'dispose' }, clicks: 2, count: 2 },
];
type Observation = {
  step: string;
  inputSources: string[];
  data: Record<string, unknown>;
  ax: unknown;
};
const viewport = { width: 800, height: 500 };
let browser: Browser;
let baseUrl: string;
let evidenceDir: string;
let closeServer: (() => Promise<void>) | undefined;

beforeAll(async () => {
  evidenceDir = process.env.COMPILER_EVIDENCE_DIR
    ? path.resolve(process.env.COMPILER_EVIDENCE_DIR, 'source-presentation')
    : await mkdtemp(path.join(tmpdir(), 'proto-compiler-source-presentation-'));
  await mkdir(evidenceDir, { recursive: true });
  const server = createServer();
  const vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('./fixtures/source-presentation/vite.config.ts', import.meta.url)
    ),
    server: { middlewareMode: true, hmr: { server } },
  });
  server.on('request', vite.middlewares);
  closeServer = async () => {
    await vite.close();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Presentation server has no address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(
    `Compiler source presentation evidence: ${evidenceDir}; observation: ${baseUrl}/?target=source`
  );
  const fixtureRoot = new URL('./fixtures/source-presentation/', import.meta.url);
  const inputs = await Promise.all(
    ['presentation.proto.ts', 'presentation.css', 'main.ts', 'vite.config.ts'].map(
      async (name) => ({
        name,
        sha256: createHash('sha256')
          .update(await readFile(new URL(name, fixtureRoot)))
          .digest('hex'),
      })
    )
  );
  await writeFile(
    path.join(evidenceDir, 'replay.json'),
    JSON.stringify(
      {
        sourceRevision: process.env.GITHUB_SHA ?? null,
        browser: browser.version(),
        viewport,
        deviceScaleFactor: 1,
        inputs,
        steps,
        profiles: {
          reference: 'original React Adapter',
          runtime: 'react-runtime-v1',
          source: 'react-dom-source-v1',
        },
        cssPreset:
          'finite source-presentation/presentation.css; no general Tailwind/preset coverage',
        projection: {
          feedback: 'Root[data-pui-style]',
          template: 'child class/data-pui-style recorded separately; computed style is the oracle',
        },
        observationUrls: ['reference', 'runtime', 'source', 'source-duplicate-activation'].map(
          (target) => `${baseUrl}/?target=${target}`
        ),
      },
      null,
      2
    )
  );
}, 120_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await closeServer?.();
  }
}, 60_000);

async function act(page: Page, action: Action) {
  if (action.kind === 'observe') return;
  if (action.kind === 'tab') {
    await page.keyboard.press('Tab');
    return;
  }
  if (action.kind === 'tab-from-before') {
    // Host focus establishes a deterministic starting point; the traversal is real browser Tab.
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    return;
  }
  if (action.kind === 'key') {
    await page.keyboard.press(action.key);
    return;
  }
  if (action.kind === 'key-down') {
    await page.keyboard.down(action.key);
    return;
  }
  if (action.kind === 'key-up') {
    await page.keyboard.up(action.key);
    return;
  }
  if (
    action.kind === 'pointer-down' ||
    action.kind === 'pointer-up' ||
    action.kind === 'pointer-click'
  ) {
    const box = await page.locator('#presentation-host [data-pui-root] span').boundingBox();
    if (!box) throw new Error('Presentation child has no painted input target');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    if (action.kind === 'pointer-down') await page.mouse.down();
    else if (action.kind === 'pointer-up') await page.mouse.up();
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return;
  }
  await page.evaluate((command) => {
    const probe = (window as unknown as { presentationProbe: Probe }).presentationProbe;
    if (command.kind === 'later') probe.setLater(command.value);
    else if (command.kind === 'present') probe.setPresent(command.value);
    else if (command.kind === 'disabled') probe.setDisabled(command.value);
    else if (command.kind === 'accent') probe.setAccent(command.value);
    else if (command.kind === 'dispose') probe.dispose();
    else throw new Error(`Unsupported host action ${command.kind}`);
  }, action);
}

function assertOracle(
  target: Target,
  step: Step,
  observation: Observation,
  previous?: Observation
) {
  const data = observation.data;
  expect(data.clicks, `${target}:${step.id}: exactly one activation per accepted input`).toBe(
    step.clicks
  );
  if (step.id === 'dispose') {
    expect(data).toMatchObject({
      present: false,
      disposed: true,
      refCleared: true,
      rootCount: 0,
      oldTargetConnected: false,
    });
    return;
  }
  expect(data.count, `${target}:${step.id}: accepted input increments authored state`).toBe(
    step.count
  );
  expect(data.sameHandles).toBe(true);
  if (step.id === 'detach') {
    expect(data).toMatchObject({
      present: false,
      rootCount: 0,
      oldTargetConnected: false,
      later: true,
    });
    return;
  }
  expect(data).toMatchObject({
    present: true,
    rootCount: 1,
    background: step.color,
    width: step.width,
    height: 64,
    opacity: step.id === 'initial' ? '0.4' : '1',
    childBackground: 'rgb(234, 179, 8)',
    childPadding: '8px',
    childInsideRoot: true,
    centerHitOwned: true,
    centerHitIsChild: true,
    text: step.text ?? 'Presentation 0',
    childTokens: ['bg-yellow-500', 'p-2'],
    axRole: 'button',
    axName: step.text ?? 'Presentation 0',
    axDisabled: ['disable', 'disabled-pointer', 'disabled-space', 'disabled-tab'].includes(step.id),
  });
  const tokens = data.rootTokens as string[];
  expect(tokens).not.toContain('bg-yellow-500');
  expect(tokens).not.toContain('p-2');
  const expectedColor =
    step.color === purple ? 'bg-purple-500' : step.color === red ? 'bg-red-500' : 'bg-green-500';
  expect(tokens.filter((token) => token.startsWith('bg-'))).toEqual([expectedColor]);
  expect(tokens.filter((token) => token.startsWith('w-'))).toEqual(
    step.id === 'suppress-width'
      ? []
      : [`w-${step.width === 288 ? 72 : step.width === 256 ? 64 : 56}`]
  );
  if (
    [
      'withdraw-opacity-rule',
      'later-rule',
      'withdraw-later-rule',
      'suppress-width',
      'patch-runtime',
      'clear-runtime-patch',
      'later-before-detach',
      'patch-before-detach',
      'clear-after-reattach',
      'withdraw-after-reattach',
      'space-down',
      'space-up',
      'pointer-up',
    ].includes(step.id)
  ) {
    expect(
      data.updated,
      `${step.id}: feedback/state changes are not semantic template commits`
    ).toBe(previous!.data.updated);
    expect(data.text).toBe(previous!.data.text);
  }
  if (step.id.startsWith('explicit-update-'))
    expect(data.updated).toBe(Number(previous!.data.updated) + 1);
  if (step.id === 'reattach')
    expect(data).toMatchObject({ replacedTarget: true, oldTargetConnected: false, later: true });
  if (step.id === 'tab-before') expect(data.activeId).toBe('before');
  if (step.id === 'tab-root') expect(data).toMatchObject({ active: true, focused: true });
  if (step.id === 'pointer-down') expect(data.pressed).toBe(true);
  if (step.id === 'pointer-up' || step.id === 'disable') expect(data.pressed).toBe(false);
  if (step.id === 'space-down' || step.id === 'space-up')
    expect(data.scrollY).toBe(previous!.data.scrollY);
  if (step.id === 'disabled-tab') expect(data).toMatchObject({ active: false, activeId: 'after' });
}

async function collect(target: Target, trace: Observation[], enforceOracle: boolean) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors: string[] = [];
  let failure: string | undefined;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  try {
    await page.goto(`${baseUrl}/?target=${target}`);
    await page.waitForFunction(() =>
      (window as unknown as { presentationProbe?: Probe }).presentationProbe?.ready()
    );
    const cdp = await context.newCDPSession(page);
    for (const step of steps) {
      await page.evaluate(
        (id) => (window as unknown as { presentationProbe: Probe }).presentationProbe.step(id),
        step.id
      );
      await act(page, step.action);
      // Settle host work for a fixed two frames, never poll for an expected oracle result.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const data = await page.evaluate(() =>
        (window as unknown as { presentationProbe: Probe }).presentationProbe.read()
      );
      let ax: unknown = null;
      if (data.present) {
        const document = await cdp.send('DOM.getDocument');
        const node = await cdp.send('DOM.querySelector', {
          nodeId: document.root.nodeId,
          selector: '#presentation-host [data-pui-root]',
        });
        const description = await cdp.send('DOM.describeNode', { nodeId: node.nodeId });
        const tree = await cdp.send('Accessibility.getPartialAXTree', {
          backendNodeId: description.node.backendNodeId,
          fetchRelatives: false,
        });
        ax = tree;
        const actual = tree.nodes.find(
          (entry: { backendDOMNodeId?: number }) =>
            entry.backendDOMNodeId === description.node.backendNodeId
        );
        data.axRole = actual?.role?.value ?? null;
        data.axName = actual?.name?.value ?? null;
        data.axDisabled =
          actual?.properties?.find((property: { name: string }) => property.name === 'disabled')
            ?.value?.value ?? false;
      }
      const hostAPI = ['later', 'present', 'disabled', 'accent', 'dispose'].includes(
        step.action.kind
      );
      const observation = {
        step: step.id,
        inputSources:
          step.action.kind === 'observe'
            ? []
            : step.action.kind === 'tab-from-before'
              ? ['host-api', 'browser-automation']
              : [hostAPI ? 'host-api' : 'browser-automation'],
        data,
        ax,
      };
      trace.push(observation);
      // Retain visual evidence from the actual page, including every withdrawal and view epoch.
      await page.screenshot({
        path: path.join(evidenceDir, `${target}-${step.id}.png`),
        fullPage: true,
      });
      if (enforceOracle) assertOracle(target, step, observation, trace.at(-2));
      if (!hostAPI && step.action.kind !== 'observe') {
        const inputs = (
          data.inputs as Array<{ step: string; type: string; trusted: boolean }>
        ).filter((input) => input.step === step.id);
        const requiredType =
          step.action.kind === 'pointer-down'
            ? 'pointerdown'
            : step.action.kind === 'pointer-up'
              ? 'pointerup'
              : step.action.kind === 'pointer-click'
                ? 'click'
                : step.action.kind === 'key-up'
                  ? 'keyup'
                  : 'keydown';
        expect(
          inputs.some((input) => input.type === requiredType && input.trusted),
          `${step.id}: browser-generated ${requiredType}`
        ).toBe(true);
        expect(inputs.every((input) => input.trusted)).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  } catch (error) {
    failure = String(error);
    await page
      .screenshot({ path: path.join(evidenceDir, `${target}-failure.png`), fullPage: true })
      .catch(() => undefined);
    await writeFile(
      path.join(evidenceDir, `${target}-failure.html`),
      await page.content().catch(() => 'Page unavailable')
    );
    throw error;
  } finally {
    await writeFile(
      path.join(evidenceDir, `${target}-observations.json`),
      JSON.stringify({ target, failure: failure ?? null, errors, trace }, null, 2)
    );
    await context.close();
  }
}

// Host carriers are not a semantic requirement; retain both in raw observations.
function semantic(trace: Observation[]) {
  return trace.map(({ step, inputSources, data }) => {
    const { childClass: _class, childStyle: _style, inputs: _inputs, ...observed } = data;
    return { step, inputSources, data: observed };
  });
}

describe('executed finite Rule/feedback presentation and native input evidence', () => {
  it('checks Adapter/runtime/source independently and detects generated duplicate activation at Space keydown', async () => {
    const reference: Observation[] = [];
    const runtime: Observation[] = [];
    const source: Observation[] = [];
    const mutant: Observation[] = [];
    let failure: string | undefined;
    try {
      await collect('reference', reference, true);
      await collect('runtime', runtime, true);
      await collect('source', source, true);
      expect(semantic(runtime)).toEqual(semantic(reference));
      expect(semantic(source)).toEqual(semantic(reference));
      await collect('source-duplicate-activation', mutant, false);
      const control = semantic(source);
      const changed = semantic(mutant);
      const firstIndex = control.findIndex(
        (entry, index) => JSON.stringify(entry) !== JSON.stringify(changed[index])
      );
      expect(firstIndex).toBe(steps.findIndex((step) => step.id === 'space-down'));
      expect(changed.slice(0, firstIndex)).toEqual(control.slice(0, firstIndex));
      expect(changed[firstIndex].data.clicks).toBe(2);
      expect(control[firstIndex].data.clicks).toBe(1);
      await writeFile(
        path.join(evidenceDir, 'mutation.json'),
        JSON.stringify(
          {
            control: 'PASS: all three independent oracles and semantic comparisons',
            generatedMutation: 'duplicate Button click signal in generated source only',
            firstDivergentCheckpoint: steps[firstIndex].id,
            intendedContract:
              'exactly one exposed click on accepted Space keydown (existing Router contract)',
            controlObservation: source[firstIndex],
            mutantObservation: mutant[firstIndex],
          },
          null,
          2
        )
      );
    } catch (error) {
      failure = String(error);
      throw error;
    } finally {
      await writeFile(
        path.join(evidenceDir, 'assessment.json'),
        JSON.stringify(
          {
            status: failure ? 'FAIL' : 'PASS',
            failure: failure ?? null,
            scope:
              'one finite authored prototype; explicit finite CSS; React Adapter/react-runtime-v1/react-dom-source-v1; launched Chromium only',
            observationSource: {
              layout: 'getComputedStyle/getBoundingClientRect/elementFromPoint',
              accessibility: 'CDP Accessibility.getPartialAXTree',
              input: 'trusted Playwright keyboard/mouse',
              viewIntentAndState: 'host-api',
            },
            reference,
            runtime,
            source,
            mutant,
          },
          null,
          2
        )
      );
    }
  }, 240_000);
});
