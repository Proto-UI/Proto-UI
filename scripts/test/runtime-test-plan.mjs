export const BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-dialog.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-composed-style-isolation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-ring-offset-default.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
]);

export function createRuntimeTestPlan(rawArgs) {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  if (args.length > 0) return [{ needsServer: false, args }];

  return [
    {
      needsServer: false,
      args: BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
    },
    {
      needsServer: true,
      // One dev server compiles for every suite, so running the files in
      // parallel makes them queue behind each other and blow their own
      // readiness timeouts. Keep the browser matrix sequential so every
      // route receives a complete, reproducible evidence pass.
      args: ['--no-file-parallelism', ...BROWSER_SUITES],
    },
  ];
}
