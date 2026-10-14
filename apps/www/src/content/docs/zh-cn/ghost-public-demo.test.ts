import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { parse } from 'yaml';
import ghost from '../demo_components/button/demo-button-ghost.demo';
import { renderDemo } from '../../../components/PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../../../components/PrototypePreviewer/prototype-modules';
import {
  assertDemoSpec,
  type DemoSetupContext,
} from '../../../components/PrototypePreviewer/demo-types';
import {
  BROWSER_SUITES,
  PRODUCTION_BROWSER_SUITES,
  PRODUCTION_BROWSER_OWNERS,
  assertBrowserInventory,
  discoverBrowserSuites,
} from '../../../../../../scripts/test/runtime-test-plan.mjs';
const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
it('renders the real ghost demo through public props and observes outward signals only', async () => {
  assertDemoSpec(ghost);
  await loadPrototypes(['shadcn-button']);
  const host = document.createElement('div');
  document.body.append(host);
  let context!: DemoSetupContext;
  const result = await renderDemo({
    runtime: 'wc',
    host,
    demo: {
      ...ghost,
      setup(next) {
        context = next;
        return ghost.setup(next);
      },
    },
  });
  cleanups.push(() => result.destroy());
  await flush();
  const { enabled, disabled, status } = context.refs;
  expect(enabled, 'Real demo must expose the enabled ghost ref').toBeDefined();
  expect(disabled, 'Real demo must expose the public disabled ghost ref').toBeDefined();
  expect(status, 'Real demo must expose outward counts').toBeDefined();
  expect(enabled.textContent).toBe('Ghost');
  expect(disabled.textContent).toBe('Disabled ghost');
  expect(disabled.getAttribute('aria-disabled')).toBe('true');
  expect(disabled.tabIndex).toBeLessThan(0);
  expect(status.textContent).toBe('Enabled activations: 0; disabled activations: 0');
  // Synthetic outward delivery proves callback wiring, not native activation.
  // The native suite separately supplies real pointer/Enter/Space positive controls.
  enabled.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
  await flush();
  expect(status.textContent).toBe('Enabled activations: 1; disabled activations: 0');
  // Host click input commits a new outward signal; it is counted once, not
  // once as input plus once as outward delivery.
  enabled.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flush();
  expect(status.textContent).toBe('Enabled activations: 2; disabled activations: 0');
  disabled.dispatchEvent(new PointerEvent('pointerenter'));
  disabled.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
  disabled.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
  disabled.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  disabled.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  disabled.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  await flush();
  expect(disabled.hasAttribute('data-hovered')).toBe(false);
  expect(disabled.hasAttribute('data-pressed')).toBe(false);
  expect(status.textContent).toBe('Enabled activations: 2; disabled activations: 0');
  await result.destroy();
  cleanups.pop();
  enabled.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
  await flush();
  expect(status.textContent).toBe('Enabled activations: 2; disabled activations: 0');
});
it('keeps four public code projections aligned with the enabled and disabled demo', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/demo_components/button/buttonCode.ts',
    'utf8'
  );
  const blocks = [...source.matchAll(/'demo-button-ghost': formatCode\(`([\s\S]*?)`\)/g)].map(
    (match) => match[1]
  );
  expect(blocks).toHaveLength(4);
  for (const code of blocks) {
    expect(code).toContain('variant="ghost"');
    expect(code).toContain('disabled');
    expect(code).toContain('Disabled ghost');
    expect(code).toContain('Enabled activations:');
    expect(code).toContain('disabled activations:');
  }
});
it('owns the eight native journeys without skipping inventory or cancelling evidence', () => {
  const suite = 'apps/www/src/content/docs/zh-cn/finf-button-ghost.browser.test.ts';
  const owner = '.github/workflows/finf-button-ghost-evidence.yml';
  expect(PRODUCTION_BROWSER_SUITES).toContain(suite);
  expect(BROWSER_SUITES).not.toContain(suite);
  expect(PRODUCTION_BROWSER_OWNERS[suite]).toBe(owner);
  expect(() => assertBrowserInventory(discoverBrowserSuites(process.cwd()))).not.toThrow();
  const workflowText = readFileSync(owner, 'utf8'),
    workflow = parse(workflowText);
  expect(workflow.concurrency['cancel-in-progress']).toBe(false);
  expect(workflow.permissions).toEqual({ contents: 'read' });
  expect(workflowText).toContain(suite);
  expect(workflowText).toContain('assert.equal(report.numTotalTests, 8)');
  expect(workflowText).toContain('assert.equal(report.numPassedTests, 8)');
  const fixture = readFileSync(suite, 'utf8');
  expect(fixture).toContain('chromiumSandbox: true');
  expect(fixture).toContain("process.env.GITHUB_ACTIONS !== 'true'");
  expect(fixture).not.toContain('--no-sandbox');
  expect(fixture).not.toContain('force: true');
  expect(fixture).not.toContain('localStorage.setItem');
  expect(fixture).not.toContain('setProps(');
  expect(fixture).toContain('selectPublicPanel');
  expect(fixture).toContain('getCurrentRuntime');
});
