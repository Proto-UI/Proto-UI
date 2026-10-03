import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BROWSER_SUITES = Object.freeze([
  'apps/www/test/evidence/brutalist-spinner.capture.browser.test.ts',
  'apps/www/test/evidence/brutalist-fonts.browser.test.ts',
  'apps/www/src/components/documentation-image-preview.browser.test.ts',
  'apps/www/test/message-composition.browser.test.ts',
  'apps/www/test/color-scheme.browser.test.ts',
  'apps/www/test/preferences.browser.test.ts',
  'apps/www/test/button-view-lifetime.browser.test.ts',
  'apps/www/test/radio-group-entry.browser.test.ts',
  'apps/workspace/test/lifecycle.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-image.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-button.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-checkbox.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-dialog.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-remaining.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-spinner.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-composed-style-isolation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-prototype-style-closure.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-ring-offset-default.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-dialog.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-radio-group.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-chrome-display.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-end-follow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-tooltip.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surfaces.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surface-grammar.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-preview-surface.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-copy-commands.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/header-select-elevation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-typography.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-new-projection-families.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts',
]);

// Built Pagefind evidence uses its dedicated production owner, never the dev server.
export const PRODUCTION_BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts',
]);

// Bound each CI worker to a deterministic share of the complete development inventory.
// Sorted round-robin assignment is deterministic and never changes local coverage.
export const BROWSER_SHARD_COUNT = 8;

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
      args: [...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES].flatMap((suite) => [
        '--exclude',
        suite,
      ]),
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
