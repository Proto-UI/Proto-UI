export const BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-composed-style-isolation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-ring-offset-default.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts',
]);

export function createRuntimeTestPlan(rawArgs) {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  if (args.length > 0) return [{ needsServer: false, args }];

  return [
    {
      needsServer: false,
      // Bound process fan-out so a large core count cannot starve the 5s
      // fixture timeouts or the CLI subprocess tests on developer machines.
      // Vitest derives a CPU-count-based minimum unless both bounds are
      // provided; on high-core machines that minimum can exceed maxWorkers.
      args: [
        '--minWorkers=1',
        '--maxWorkers=4',
        ...BROWSER_SUITES.flatMap((suite) => ['--exclude', suite]),
      ],
    },
    {
      needsServer: true,
      // One dev server compiles for every suite, so running the files in
      // parallel makes them queue behind each other and blow their own
      // readiness timeouts. Measured on five suites: 75s sequential against
      // 102s parallel, with the parallel run intermittently timing out.
      args: ['--no-file-parallelism', ...BROWSER_SUITES],
    },
  ];
}
