import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  earlyOwnershipBoundaryIsNative,
  isQuickStartReactRuntime,
  type OwnershipTrace,
} from './quick-start-runtime-gate';

const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'utf8'
);
const renderer = readFileSync(
  'apps/www/src/components/PrototypePreviewer/demo-renderer.ts',
  'utf8'
);
const retained = { focused: true, codeSame: true, textRetained: true, selectionSame: true };
function trace(menu = false): OwnershipTrace[] {
  return [
    ...(menu
      ? [
          { kind: 'focus-call', at: 1, target: { tag: 'wc-shadcn-button' } },
          { kind: 'focusout', at: 2, target: { tag: 'summary' } },
          { kind: 'focusin', at: 3, applicationOwnership: retained },
        ]
      : []),
    {
      kind: 'DOMContentLoaded',
      at: 4,
      fragmentTarget: null,
      menuReady: true,
      applicationOwnership: retained,
    },
    { kind: 'focusout', at: 5, fragmentTarget: '_top', active: { tag: 'body' } },
    { kind: 'load', at: 6, fragmentTarget: '_top' },
  ];
}
describe('Quickstart actual navigation/runtime boundary (source and classifier, no native pass)', () => {
  it('holds only the real dynamic React runtime module and permits bootstrap scripts', () => {
    expect(
      isQuickStartReactRuntime(
        'http://localhost:4321/src/components/PrototypePreviewer/runtimes/react-runtime.ts?t=123'
      )
    ).toBe(true);
    for (const name of [
      'demo-renderer.ts',
      'site-typography-client.ts',
      'override/Header.astro?astro&type=script&index=0&lang.ts',
      'react-runtime.ts.map',
    ])
      expect(isQuickStartReactRuntime(`http://localhost:4321/src/components/${name}`)).toBe(false);
    expect(renderer).toContain("() => import('./runtimes/react-runtime')");
    expect(renderer).not.toMatch(/import\s+[^;]+\s+from\s+['"].*runtimes\/react-runtime['"]/);
    expect(source).toContain('heldRuntimeRequests.every(isQuickStartReactRuntime)');
    expect(source).toContain('expect(initial.codeEnhanced).toBe(false)');
    expect(source).toContain('expect(initial.typographyEnhanced).toBe(false)');
  });
  it('retains strict settled focus, same-fragment admission and trusted Tab without restoring focus', () => {
    expect(source).toContain(
      "location.hash === '#_top' && document.querySelector(':target')?.id === '_top'"
    );
    expect(source).toContain("await page.keyboard.press('Tab')");
    expect(source).toContain("if (phase === 'early-native') target.focus({ preventScroll: true })");
    expect(source).toContain('expect(facts.focused).toBe(true)');
    expect(source).toContain("event.kind === 'focusout'");
    expect(source).toContain('endToEndEarlyInputDebt:');
    expect(source).toContain('productFixClaimed: false');
    expect(source).not.toMatch(/(?:location\.hash\s*=(?!=)|history\.(?:replaceState|pushState)\()/);
    const start = source.indexOf('expect(initial.hash)');
    const release = source.indexOf('release();', start);
    const end = source.indexOf('} catch (error)', release);
    expect(source.slice(release, end)).not.toContain('.focus(');
  });
  it.each(['menu', 'content-link'] as const)(
    'accepts observed %s handoff followed by a native fragment boundary',
    (owner) => {
      expect(earlyOwnershipBoundaryIsNative(trace(owner === 'menu'), owner)).toBe(true);
    }
  );
  it.each(['focused', 'codeSame', 'textRetained', 'selectionSame'] as const)(
    'rejects broken %s at DCL',
    (field) => {
      const events = trace();
      events[0].applicationOwnership = { ...retained, [field]: false };
      expect(earlyOwnershipBoundaryIsNative(events, 'content-link')).toBe(false);
    }
  );
  it('rejects initial fragment already complete, missing DCL, missing handoff, and unexplained blur', () => {
    const events = trace();
    expect(earlyOwnershipBoundaryIsNative(events.slice(1), 'content-link')).toBe(false);
    expect(earlyOwnershipBoundaryIsNative(events, 'menu')).toBe(false);
    events[0].fragmentTarget = '_top';
    expect(earlyOwnershipBoundaryIsNative(events, 'content-link')).toBe(false);
    const blurred = [{ kind: 'focusout', at: 0 }, ...trace()];
    expect(earlyOwnershipBoundaryIsNative(blurred, 'content-link')).toBe(false);
    const noTarget = trace();
    noTarget[1].fragmentTarget = null;
    expect(earlyOwnershipBoundaryIsNative(noTarget, 'content-link')).toBe(false);
  });
  it.each(['focus-call', 'blur-call'])('rejects %s between DCL and fragment focus loss', (kind) => {
    const events = trace();
    events.splice(1, 0, { kind, at: 4.5 });
    expect(earlyOwnershipBoundaryIsNative(events, 'content-link')).toBe(false);
  });
  it('rejects duplicate menu blur or a handoff that did not actually receive focus', () => {
    const duplicate = trace(true);
    duplicate.splice(1, 0, { kind: 'focusout', at: 1.5, target: { tag: 'summary' } });
    expect(earlyOwnershipBoundaryIsNative(duplicate, 'menu')).toBe(false);
    const failed = trace(true);
    failed[2].applicationOwnership = { ...retained, focused: false };
    expect(earlyOwnershipBoundaryIsNative(failed, 'menu')).toBe(false);
  });
});

describe('Quickstart native workflow actual path filters', () => {
  const workflow = parse(
    readFileSync('.github/workflows/quick-start-first-frame-evidence.yml', 'utf8')
  );
  const paths: string[] = workflow.on.pull_request.paths;
  const gatePattern = 'apps/www/src/content/docs/zh-cn/quick-start-runtime-gate*.ts';
  const covered = (file: string, filters = paths) =>
    filters.some((pattern) => matchesGlob(file, pattern));
  it.each(['quick-start-runtime-gate.ts', 'quick-start-runtime-gate.test.ts'])(
    'schedules native evidence when only %s changes, and rejects the old missing trigger',
    (name) => {
      const file = `apps/www/src/content/docs/zh-cn/${name}`;
      expect(readFileSync(file, 'utf8').length).toBeGreaterThan(0);
      expect(paths).toContain(gatePattern);
      expect(covered(file)).toBe(true);
      expect(
        covered(
          file,
          paths.filter((pattern) => pattern !== gatePattern)
        )
      ).toBe(false);
    }
  );
  it('preserves every prior filter and manual dispatch without broadening unrelated changes', () => {
    for (const pattern of [
      '.github/workflows/quick-start-first-frame-evidence.yml',
      'packages/**',
      'apps/www/astro.config.mjs',
      'apps/www/package.json',
      'package.json',
      'apps/www/src/components/**',
      'apps/www/src/styles/**',
      'apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx',
      'apps/www/src/content/docs/zh-cn/quick-start-first-frame*.ts',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      'scripts/test/server-readiness.mjs',
      'vitest.config.ts',
      'scripts/test/runtime-test-plan.mjs',
      'pnpm-lock.yaml',
    ])
      expect(paths).toContain(pattern);
    expect(covered('apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts')).toBe(
      true
    );
    expect(covered('README.md')).toBe(false);
    expect(covered('apps/www/src/content/docs/zh-cn/unrelated.ts')).toBe(false);
    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });
});
