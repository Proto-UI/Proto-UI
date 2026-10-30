import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  VIEW_OPERATION_CASES,
  expectedChecks,
  expectedReactionPhases,
  assertViewOperationReceipt,
} from '../../../../scripts/feedback/view-operation-receipt.mjs';
import {
  BROWSER_SUITES,
  assertBrowserInventory,
} from '../../../../scripts/test/runtime-test-plan.mjs';
import { assertVitestReport } from '../../../../scripts/test/runtime-ci.mjs';

const suite = 'packages/adapters/web-component/test/view-operation-withdrawal.browser.test.ts';
const identity = { revision: '1'.repeat(40), tree: '2'.repeat(40) };
function validReceipt() {
  // Data-only verifier control, explicitly not a native execution claim.
  return {
    ...identity,
    pass: true,
    failure: null,
    pageErrors: [],
    cleanupErrors: [],
    observation: {
      cases: [...VIEW_OPERATION_CASES],
      results: VIEW_OPERATION_CASES.map((name: string) => ({
        name,
        pass: true,
        failure: null,
        checks: Object.entries(expectedChecks(name)).map(([label, expected]) => ({
          label,
          actual: expected,
          expected,
        })),
        initialReactions: ['connectedCallback:before', 'connectedCallback:after'].map((phase) => ({
          phase,
          connected: true,
        })),
        events: expectedReactionPhases(name).map((phase: string, index: number) => ({
          phase,
          connected:
            phase.startsWith('connectedCallback') ||
            name === 'owned-transport' ||
            name === 'second-reconnect' ||
            (name === 'nested-author-remove' && index < 4),
          path: ['source', 'parent'],
        })),
      })),
    },
  };
}
const source = { ...identity, trackedTreeClean: true };
function report() {
  return {
    success: true,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPassedTests: 8,
    testResults: [
      {
        name: resolve(suite),
        status: 'passed',
        assertionResults: VIEW_OPERATION_CASES.map((name: string) => ({
          fullName: name,
          status: 'passed',
        })),
      },
    ],
  };
}
const selection = {
  checkoutSha: identity.revision,
  phase: 'browser',
  shard: '1/8',
  suites: [suite],
};

describe('source-view required native evidence cannot silently disappear', () => {
  it('registers the actual browser suite and accepts complete source-bound controls', () => {
    expect(BROWSER_SUITES.filter((path: string) => path === suite)).toHaveLength(1);
    assertBrowserInventory([suite], [suite], []);
    assertViewOperationReceipt(validReceipt(), source, identity);
    assertVitestReport(report(), selection, resolve('.'));
  });
  it('rejects missing and stale browser inventory', () => {
    expect(() => assertBrowserInventory([suite], [], [])).toThrow();
    expect(() => assertBrowserInventory([], [suite], [])).toThrow();
  });
  for (const mutation of [
    'missing-case',
    'zero-cases',
    'stale-revision',
    'stale-tree',
    'dirty-source',
    'failure',
    'weakened-expectation',
    'missing-reaction',
    'wrong-native-order',
    'page-error',
    'cleanup-error',
  ] as const) {
    it(`rejects ${mutation}`, () => {
      const receipt: any = validReceipt();
      const input: any = { ...source };
      if (mutation === 'missing-case') receipt.observation.results.pop();
      if (mutation === 'zero-cases') receipt.observation.results = [];
      if (mutation === 'stale-revision') receipt.revision = '3'.repeat(40);
      if (mutation === 'stale-tree') receipt.tree = '3'.repeat(40);
      if (mutation === 'dirty-source') input.trackedTreeClean = false;
      if (mutation === 'failure') {
        receipt.pass = false;
        receipt.failure = 'native assertion';
      }
      if (mutation === 'weakened-expectation')
        receipt.observation.results[4].checks.find(
          (c: any) => c.label === 'final-current'
        ).expected = false;
      if (mutation === 'missing-reaction') receipt.observation.results[4].events = [];
      if (mutation === 'wrong-native-order')
        receipt.observation.results[4].events[0].connected = false;
      if (mutation === 'page-error') receipt.pageErrors.push('uncaught');
      if (mutation === 'cleanup-error') receipt.cleanupErrors.push('close failed');
      expect(() => assertViewOperationReceipt(receipt, input, identity)).toThrow();
    });
  }
  for (const mutation of [
    'missing-suite',
    'empty-suite',
    'zero-pass',
    'skipped',
    'failed',
    'wrong-suite',
  ] as const) {
    it(`existing required browser report gate rejects ${mutation}`, () => {
      const value: any = report();
      if (mutation === 'missing-suite') value.testResults = [];
      if (mutation === 'empty-suite') value.testResults[0].assertionResults = [];
      if (mutation === 'zero-pass') value.numPassedTests = 0;
      if (mutation === 'skipped') value.testResults[0].assertionResults[0].status = 'skipped';
      if (mutation === 'failed') value.testResults[0].assertionResults[0].status = 'failed';
      if (mutation === 'wrong-suite')
        value.testResults[0].name = resolve('unrelated.browser.test.ts');
      expect(() => assertVitestReport(value, selection, resolve('.'))).toThrow();
    });
  }
  it('retains the original HappyDOM assertion source apart from relocated imports', () => {
    const archived = readFileSync(
      'packages/adapters/web-component/test/diagnostics/view-operation-withdrawal.happy-dom.ts',
      'utf8'
    );
    const normalized = archived.replaceAll("from '../../src/", "from '../src/");
    expect(createHash('sha256').update(normalized).digest('hex')).toBe(
      '6714f42886fccfb6c4502a3aa4a5754543db523d985fc5c78f593bddd0aafd31'
    );
  });
});
