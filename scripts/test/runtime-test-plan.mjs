import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Astro compiles on first request. Keep the shared runner's readiness inventory
// importable without starting its server or running Vitest.
export const READY_ROUTES = Object.freeze([
  '/en/test/style-isolation/',
  '/en/test/new-projection-families/',
  '/en/test/bootstrap-state-controls/',
  '/en/test/liquid-glass-material/',
  '/en/ui-libraries/base/image/',
  '/en/ui-libraries/base/collapsible/',
  '/en/ui-libraries/shadcn/collapsible/',
  '/zh-cn/ui-libraries/shadcn/collapsible/',
  '/en/ui-libraries/brutalist/components/collapsible/',
  '/zh-cn/ui-libraries/brutalist/components/collapsible/',
  '/en/ui-libraries/bootstrap-2-3-2/collapsible/',
  '/zh-cn/ui-libraries/bootstrap-2-3-2/collapsible/',
  '/en/ui-libraries/liquid-glass/collapsible/',
  '/zh-cn/ui-libraries/liquid-glass/collapsible/',
  '/en/ui-libraries/base/field/',
  '/en/ui-libraries/shadcn/field/',
  '/en/ui-libraries/brutalist/field/',
  '/en/ui-libraries/bootstrap-2-3-2/field/',
  '/en/ui-libraries/liquid-glass/field/',
  '/zh-cn/ui-libraries/base/field/',
  '/zh-cn/ui-libraries/shadcn/field/',
  '/zh-cn/ui-libraries/brutalist/field/',
  '/zh-cn/ui-libraries/bootstrap-2-3-2/field/',
  '/zh-cn/ui-libraries/liquid-glass/field/',
  '/en/ui-libraries/base/accordion/',
  '/en/ui-libraries/shadcn/accordion/',
  '/en/ui-libraries/brutalist/accordion/',
  '/en/ui-libraries/bootstrap-2-3-2/accordion/',
  '/en/ui-libraries/liquid-glass/accordion/',
  '/zh-cn/ui-libraries/base/accordion/',
  '/zh-cn/ui-libraries/shadcn/accordion/',
  '/zh-cn/ui-libraries/brutalist/accordion/',
  '/zh-cn/ui-libraries/bootstrap-2-3-2/accordion/',
  '/zh-cn/ui-libraries/liquid-glass/accordion/',

  '/zh-cn/ui-libraries/base/collapsible/',
  '/en/ui-libraries/base/table/',
  '/zh-cn/ui-libraries/base/table/',
  '/en/start-here/quick-start/',
  '/en/ui-libraries/shadcn/input/',
  '/en/ui-libraries/shadcn/select/',
  '/en/ui-libraries/base/scroll-area/',
  '/en/ui-libraries/base/textarea/',
  '/en/ui-libraries/brutalist/components/badge/',
  '/en/ui-libraries/brutalist/components/button/',
  '/en/ui-libraries/brutalist/components/card/',
  '/en/ui-libraries/brutalist/components/dialog/',
  '/en/ui-libraries/brutalist/components/hover-card/',
  '/en/ui-libraries/brutalist/components/select/',
  '/en/ui-libraries/brutalist/components/separator/',
  '/en/ui-libraries/brutalist/components/skeleton/',
  '/en/ui-libraries/brutalist/components/switch/',
  '/en/ui-libraries/brutalist/components/tabs/',
  '/en/ui-libraries/brutalist/components/toggle/',
  '/en/ui-libraries/brutalist/components/tooltip/',
  '/en/ui-libraries/shadcn/checkbox/',
  '/en/ui-libraries/shadcn/dropdown-menu/',
  '/en/ui-libraries/shadcn/switch/',
  '/en/ui-libraries/shadcn/textarea/',
  '/zh-cn/ui-libraries/base/transition/',
  '/zh-cn/ui-libraries/shadcn/button/',
  '/zh-cn/',
  '/zh-cn/start-here/quick-start/',
  '/zh-cn/internal/demo-matrix/',
  '/zh-cn/ui-libraries/shadcn/select/',
  '/zh-cn/ui-libraries/shadcn/scroll-area/',
  '/zh-cn/ui-libraries/brutalist/components/checkbox/',
  '/zh-cn/ui-libraries/shadcn/tooltip/',
]);

export const BROWSER_SUITES = Object.freeze([
  'packages/adapters/base/test/focus-intent-retries.browser.test.ts',
  'packages/adapters/react/test/focus-entry-readiness.browser.test.ts',
  'packages/adapters/vue/test/focus-request-readiness.browser.test.ts',
  'apps/www/test/template-style.browser.test.ts',
  'apps/www/test/evidence/brutalist-spinner.capture.browser.test.ts',
  'apps/www/test/evidence/brutalist-fonts.browser.test.ts',
  'apps/www/src/components/documentation-image-preview.browser.test.ts',
  'apps/www/test/message-composition.browser.test.ts',
  'apps/www/test/color-scheme.browser.test.ts',
  'apps/www/test/preferences.browser.test.ts',
  'apps/www/test/button-view-lifetime.browser.test.ts',
  'apps/www/test/radio-group-entry.browser.test.ts',
  'apps/workspace/test/lifecycle.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/contrast-probe.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-image.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-table.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/table-react19.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-collapsible.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-collapsible-projections.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-field-family.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-accordion-family.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-passive-atoms.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-input.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-button.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-checkbox.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-dialog.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-remaining.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-spinner.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-composed-style-isolation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-prototype-style-closure.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-ring-offset-default.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadow-split-s3.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadow-split-s4.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadow-split-s4-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadow-split-s5.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-input.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-radio-group.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-chrome-display.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-area-corner.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-end-follow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-tooltip.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surfaces.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surface-grammar.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-preview-surface.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-copy-commands.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/overlay-scrollbar-geometry.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/overlay-portal-direction.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-layout-parity.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-loading-mask.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/base-accordion-layout-parity.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/library-cards-first-frame.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/header-select-elevation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-typography.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-new-projection-families.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts',
  'packages/adapters/web-component/test/shadow-closeout.browser.test.ts',
]);

// Production-specific evidence uses dedicated built-site owners, never the dev server.
export const PRODUCTION_BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts',
]);

// Each production-only suite has an executable owner; exclusion is never a skip.
export const PRODUCTION_BROWSER_OWNERS = Object.freeze({
  'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts':
    'apps/www/scripts/run-search-production-evidence.mjs',
  'apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts':
    '.github/workflows/site-startup-theme-evidence.yml',
});

// Bound each CI worker to a deterministic share of the complete development inventory.
// Sorted round-robin assignment is deterministic and never changes local coverage.
export const BROWSER_SHARD_COUNT = 8;

export function corepackInvocation(platform = process.platform) {
  return {
    executable: platform === 'win32' ? 'corepack.cmd' : 'corepack',
    shell: platform === 'win32',
  };
}

export function discoverBrowserSuites(root = fileURLToPath(new URL('../../', import.meta.url))) {
  return [
    ...new Set(
      globSync(
        [
          'packages/**/*.browser.test.ts',
          'internal/contracts/__tests__/**/*.browser.test.ts',
          'apps/**/test/**/*.browser.test.ts',
          'apps/www/src/**/*.browser.test.ts',
        ],
        { cwd: root, exclude: ['**/node_modules/**', '**/dist/**'] }
      )
    ),
  ]
    .map((suite) => suite.replaceAll('\\', '/'))
    .sort();
}

export function assertBrowserInventory(
  discovered = discoverBrowserSuites(),
  development = BROWSER_SUITES,
  production = PRODUCTION_BROWSER_SUITES
) {
  const registered = [...development, ...production];
  if (new Set(registered).size !== registered.length)
    throw new Error('Duplicate browser suite registration');
  const missing = discovered.filter((suite) => !registered.includes(suite));
  const stale = registered.filter((suite) => !discovered.includes(suite));
  if (missing.length || stale.length)
    throw new Error(
      `Browser inventory mismatch: unregistered=${missing.join(', ')}; missing=${stale.join(', ')}`
    );
}

export function browserShards(suites = BROWSER_SUITES, count = BROWSER_SHARD_COUNT) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > suites.length ||
    new Set(suites).size !== suites.length
  )
    throw new Error('Browser shards must be nonempty and suites unique');
  const sorted = [...suites].sort();
  return Array.from({ length: count }, (_, index) =>
    sorted.filter((_, position) => position % count === index)
  );
}

export function selectBrowserShard(shard) {
  const match = /^(\d+)\/(\d+)$/.exec(shard ?? '');
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (count !== BROWSER_SHARD_COUNT || index < 1 || index > count)
    throw new Error(
      `Expected browser shard 1/${BROWSER_SHARD_COUNT} through ${BROWSER_SHARD_COUNT}/${BROWSER_SHARD_COUNT}`
    );
  return browserShards()[index - 1];
}

export function createRuntimeTestPlan(rawArgs, { phase, shard } = {}) {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  if (phase !== undefined && !['general', 'browser'].includes(phase))
    throw new Error(`Unknown runtime phase: ${phase}`);
  if (shard !== undefined && phase !== 'browser')
    throw new Error('A runtime shard requires the browser phase');
  if (args.length > 0) {
    if (phase) throw new Error('CI runtime phases cannot be combined with focused Vitest filters');
    return [{ needsServer: false, args }];
  }
  assertBrowserInventory();
  const plan = [
    {
      needsServer: false,
      // Bound process fan-out so a large core count cannot starve the 5s
      // fixture timeouts or the CLI subprocess tests on developer machines.
      // Vitest derives a CPU-count-based minimum unless both bounds are
      // provided; on high-core machines that minimum can exceed maxWorkers.
      args: [
        '--minWorkers=1',
        '--maxWorkers=2',
        ...[...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES].flatMap((suite) => [
          '--exclude',
          suite,
        ]),
      ],
    },
    {
      needsServer: true,
      // One dev server compiles for every suite, so running the files in
      // parallel makes them queue behind each other and blow their own
      // readiness timeouts. Keep the browser matrix sequential so every
      // route receives a complete, reproducible evidence pass.
      args: [
        '--no-file-parallelism',
        ...(phase === 'browser' ? selectBrowserShard(shard) : BROWSER_SUITES),
      ],
    },
  ];
  return phase === 'general' ? [plan[0]] : phase === 'browser' ? [plan[1]] : plan;
}
