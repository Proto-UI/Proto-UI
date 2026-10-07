import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
const read = (p: string) => readFileSync(p, 'utf8');

describe('startup source invariants (not browser paint)', () => {
  it('keeps the pre-upgrade runtime value neutral instead of contradicting stored preference', () => {
    const adapter = read('apps/www/src/components/override/AdapterSelect.astro');
    expect(adapter).toContain('<SelectValue data-placeholder="选择适配器">Runtime</SelectValue>');
    expect(read('apps/www/src/components/Homepage/HomeActions.astro')).toContain(
      'class="site-header-runtime-placeholder">Runtime'
    );
  });
  it('uses the stable canvas height input for both fallback and loaded host', () => {
    const source = read('apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro');
    const host = source.match(/\.proto-previewer__preview \.host\s*\{([^}]*)\}/)![1];
    const fallback = source
      .match(/\.proto-previewer__skeleton\s*\{([^}]*)\}/g)!
      .find((s) => s.includes('min-height'))!;
    const height = 'min-height: var(--runtime-box-content-min, 10rem)';
    expect(host).toContain(height);
    expect(fallback).toContain(height);
  });
  it('keeps the shared loading presentation bounded to pre-enhancement owners', () => {
    const css = read('apps/www/src/styles/site-startup.css');
    expect(css).toContain("[data-site-select-root]:not([data-site-shadcn-initialized='1'])");
    expect(css).toContain('.site-header:not([data-site-menu-ready])');
    expect(css).toContain('var(--color-background)');
    expect(css).toContain('var(--site-surface-border-width, 1px)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).not.toMatch(/opacity:|backdrop-filter:|animation:|data-pui-style/);
    const source = read('apps/www/src/components/PrototypePreviewer/PrototypePreviewer.astro');
    expect(source).toContain('正文和源码已可阅读');
    expect(source).toContain('class="proto-previewer__skeleton" role="status"');
  });
  it('isolates each material preference and also captures their combination and restoration', () => {
    const probe = read('apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts');
    for (const pair of [
      "'reduce', 'none'",
      "'no-preference', 'active'",
      "'reduce', 'active'",
      "'no-preference', 'none'",
    ]) {
      expect(probe).toContain(`setMaterialMedia(${pair})`);
    }
    expect(probe).toContain('expect(forced.reducedTransparency).toBe(false)');
    expect(probe).toContain('expect(reduced.forcedColors).toBe(false)');
    expect(probe).toContain('expect(restored.backgroundAlpha).toBeCloseTo(0.5, 2)');
  });
  it('resamples settled facts and copies the candidate probe dependency closure', () => {
    const probe = read('apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts');
    expect(probe).toContain('const immediateFacts = await readFacts()');
    expect(probe).toContain('const settledFacts = await readFacts()');
    expect(probe).toContain('for (const facts of [immediateFacts, settledFacts])');
    const workflow = YAML.parse(read('.github/workflows/site-startup-theme-evidence.yml'));
    const bind = workflow.jobs.capture.steps.find(
      (step: { name?: string }) =>
        step.name === 'Bind the same probe to both exact source revisions'
    ).run;
    for (const path of [
      'apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      'scripts/test/server-readiness.mjs',
    ])
      expect(bind).toContain(path);
    expect(bind).toContain('cp "candidate/$PROBE" "subject/$PROBE"');
    expect(bind).toContain('sha256sum "subject/$PROBE" >>');
  });
  it('schedules its production-only suite when a theme or underlying adapter changes', () => {
    const workflow = YAML.parse(read('.github/workflows/site-startup-theme-evidence.yml'));
    expect(workflow.on.pull_request.paths).toEqual(
      expect.arrayContaining([
        'apps/www/**',
        'packages/adapters/**',
        'packages/prototypes/**',
        'packages/modules/**',
        'packages/runtime/**',
        'packages/cli/**',
        'pnpm-lock.yaml',
      ])
    );
    const probe = read('apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts');
    expect(probe).toContain('/zh-cn/ui-libraries/brutalist/components/card/');
    expect(probe).toContain('Page.captureScreenshot');
    expect(probe).toContain('response?.status()).toBe(200)');
    expect(probe).toContain("page.locator('[data-site-header-settings] .language-select-wrapper')");
    expect(probe).toContain('expect(await locale.count()).toBe(1)');
  });
});
