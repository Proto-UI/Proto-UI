export const BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts',
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
      args: BROWSER_SUITES,
    },
  ];
}
