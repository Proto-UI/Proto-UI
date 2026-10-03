// Astro compiles on first request. Keep the shared runner's readiness inventory
// importable without starting its server or running Vitest.
export const READY_ROUTES = Object.freeze([
  '/en/test/style-isolation/',
  '/en/ui-libraries/base/image/',
  '/en/ui-libraries/base/table/',
  '/zh-cn/ui-libraries/base/table/',
  '/en/start-here/quick-start/',
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
  'apps/www/test/message-composition.browser.test.ts',
  'apps/www/test/color-scheme.browser.test.ts',
  'apps/www/test/button-view-lifetime.browser.test.ts',
  'apps/www/test/radio-group-entry.browser.test.ts',
  'apps/workspace/test/lifecycle.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-image.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-table.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/table-react19.browser.test.ts',
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
  'apps/www/src/content/docs/zh-cn/demo-shadcn-tooltip.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surfaces.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts',
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
