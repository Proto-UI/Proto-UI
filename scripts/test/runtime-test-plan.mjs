import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// The assignment was balanced from PR #652 run 35487857309 and checked against
// exact-head run 35490492252. Keep it explicit: S3/S4/S2 dominate file counts.
export const BROWSER_SHARDS = Object.freeze(
  [
    // 299.450s on exact-head run 35490492252
    [
      'apps/www/src/content/docs/zh-cn/demo-shadow-split-s3.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
      'apps/www/test/message-composition.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-shadcn-tooltip.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/scroll-chrome-display.browser.test.ts',
    ],
    // 276.683s on exact-head run 35490492252
    [
      'apps/www/src/content/docs/zh-cn/demo-shadow-split-s4.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/code-surfaces.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-composed-style-isolation.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-brutalist-dialog.browser.test.ts',
    ],
    // 281.639s on exact-head run 35490492252
    [
      'apps/www/src/content/docs/zh-cn/demo-shadow-split-s2.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
      'packages/adapters/web-component/test/shadow-closeout.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-brutalist-remaining.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-prototype-style-closure.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
      'apps/www/test/button-view-lifetime.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-brutalist-button.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts',
    ],
    // 291.014s on exact-head run 35490492252
    [
      'apps/www/src/content/docs/zh-cn/demo-shadow-split-s1.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-shadow-split-s5.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-shadow-split-s4-paint.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-base-image.browser.test.ts',
      'apps/www/test/color-scheme.browser.test.ts',
      'apps/workspace/test/lifecycle.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-brutalist-checkbox.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-ring-offset-default.browser.test.ts',
    ],
  ].map((shard) => Object.freeze(shard))
);

export const BROWSER_SUITES = Object.freeze(BROWSER_SHARDS.flat());

const DISCOVERY_ROOTS = ['apps', 'packages'];
const IGNORED_DIRECTORIES = new Set(['.astro', 'dist', 'node_modules']);

export function discoverBrowserSuites(root) {
  const suites = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(path.join(directory, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.browser.test.ts')) {
        suites.push(
          path.relative(root, path.join(directory, entry.name)).split(path.sep).join('/')
        );
      }
    }
  };
  for (const directory of DISCOVERY_ROOTS.map((name) => path.join(root, name))) {
    if (existsSync(directory)) visit(directory);
  }
  return suites.sort();
}

export function validateBrowserTestPlan(discoveredSuites, browserShards = BROWSER_SHARDS) {
  if (browserShards.length !== 4) {
    throw new Error(`expected 4 browser shards, received ${browserShards.length}`);
  }
  const empty = browserShards.flatMap((shard, index) => (shard.length ? [] : [index + 1]));
  if (empty.length) throw new Error(`empty browser shard: ${empty.join(', ')}`);

  const assigned = browserShards.flat();
  const seen = new Set();
  const duplicates = new Set();
  for (const suite of assigned) {
    if (seen.has(suite)) duplicates.add(suite);
    seen.add(suite);
  }
  if (duplicates.size) {
    throw new Error(`duplicate browser suite assignment: ${[...duplicates].sort().join(', ')}`);
  }

  const discovered = new Set(discoveredSuites);
  const missingAssignments = [...discovered].filter((suite) => !seen.has(suite)).sort();
  const unknownEntries = [...seen].filter((suite) => !discovered.has(suite)).sort();
  if (missingAssignments.length || unknownEntries.length) {
    throw new Error(
      `browser suite manifest mismatch; missing assignments: ${missingAssignments.join(', ') || 'none'}; unknown manifest entries: ${unknownEntries.join(', ') || 'none'}`
    );
  }
  return assigned;
}

function nonBrowserPhase() {
  return {
    label: 'non-browser tests',
    needsServer: false,
    args: BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
  };
}

function browserPhase(files, label) {
  return {
    label,
    needsServer: true,
    // Keep files serial inside each hosted-runner shard. Every shard owns an
    // independent dev server, so the cross-runner critical path is parallel.
    args: ['--no-file-parallelism', ...files],
  };
}

export function createRuntimeTestPlan(rawArgs, options = {}) {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  const { scope, shard, discoveredSuites = BROWSER_SUITES } = options;
  validateBrowserTestPlan(discoveredSuites);

  if (args.length > 0) {
    if (scope || shard) {
      throw new Error('focused Vitest arguments cannot be combined with CI scope');
    }
    return [{ label: 'focused Vitest arguments', needsServer: false, args }];
  }

  if (!scope || scope === 'full') {
    if (shard) throw new Error('full test scope does not accept a browser shard');
    return [
      nonBrowserPhase(),
      browserPhase(BROWSER_SUITES, `all browser suites (${BROWSER_SUITES.length} files)`),
    ];
  }
  if (scope === 'non-browser') {
    if (shard) throw new Error('non-browser test scope does not accept a shard');
    return [nonBrowserPhase()];
  }
  if (scope !== 'browser') throw new Error(`unknown test scope: ${scope}`);

  const match = typeof shard === 'string' ? /^(\d+)\/(\d+)$/.exec(shard) : null;
  const index = Number(match?.[1]);
  const total = Number(match?.[2]);
  if (!match || total !== BROWSER_SHARDS.length || index < 1 || index > total) {
    throw new Error(
      `invalid browser shard ${String(shard)}; expected 1/${BROWSER_SHARDS.length} through ${BROWSER_SHARDS.length}/${BROWSER_SHARDS.length}`
    );
  }
  const files = BROWSER_SHARDS[index - 1];
  return [browserPhase(files, `browser shard ${index}/${total} (${files.length} files)`)];
}
