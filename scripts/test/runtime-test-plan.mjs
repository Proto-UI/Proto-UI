import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Astro compiles on first request. Keep the shared runner's readiness inventory
// importable without starting its server or running Vitest.
export const READY_ROUTES = Object.freeze([
  '/en/ui-libraries/shadcn/menubar/',
  '/en/test/style-isolation/',
  '/en/test/new-projection-families/',
  '/en/test/liquid-glass-state-controls/',
  '/en/ui-libraries/bootstrap-2-3-2/button/',
  '/en/test/liquid-glass-material/',
  '/en/test/liquid-glass-portal/',
  '/en/ui-libraries/base/image/',
  '/en/ui-libraries/base/tooltip/',
  '/zh-cn/ui-libraries/base/tooltip/',
  '/en/ui-libraries/base/select/',
  '/zh-cn/ui-libraries/base/select/',
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
  '/en/ui-libraries/shadcn/card/',
  '/en/ui-libraries/shadcn/input/',
  '/en/ui-libraries/shadcn/select/',
  '/en/ui-libraries/shadcn/tabs/',
  '/en/ui-libraries/base/scroll-area/',
  '/en/ui-libraries/base/textarea/',
  '/en/ui-libraries/brutalist/components/badge/',
  '/en/ui-libraries/brutalist/components/button/',
  '/zh-cn/ui-libraries/brutalist/components/button/',
  '/en/ui-libraries/brutalist/components/card/',
  '/en/ui-libraries/brutalist/components/dialog/',
  '/en/ui-libraries/brutalist/components/hover-card/',
  '/en/ui-libraries/brutalist/components/input/',
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
  'apps/www/src/content/docs/zh-cn/demo-matrix-accessibility.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-recovery.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-disposal.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts',
  'apps/www/test/release-docs-reading.browser.test.ts',
  'apps/www/test/component-consumer-repairs.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-tooltip.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-base-select.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-switch-compositions.browser.test.ts',
  'packages/adapters/web-component/test/view-operation-withdrawal.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-menubar.browser.test.ts',
  'packages/adapters/web-component/test/native-text-width.browser.test.ts',
  'packages/prototypes/shadcn/test/drawer-presence.browser.test.ts',
  'packages/prototypes/shadcn/test/toast-stack.browser.test.ts',
  'packages/prototypes/base/test/async-region.browser.test.ts',
  'packages/prototypes/base/test/toast-pointer.browser.test.ts',
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
  'apps/www/test/tree-navigation.browser.test.ts',
  'apps/www/test/virtual-list-resize.browser.test.ts',
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
  'apps/www/src/content/docs/zh-cn/contrast-tooltip-warm-handoff.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/website-markup-provenance.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/brutalist-passive-consumers.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-alert-dialog-layout.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/button-boundaries.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-input.browser.test.ts',
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
  'apps/www/src/content/docs/zh-cn/demo-shadcn-toast-position.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-control-label.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-radio-group.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-chrome-display.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-area-corner.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/scroll-end-follow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/anchored-positioning-cold-size.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-tooltip.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surfaces.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-scroll-chain.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/code-surface-grammar.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-preview-surface.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-copy-commands.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-docs-columns.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/homepage-button-contract.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/overlay-scrollbar-geometry.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/overlay-portal-direction.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-layout-parity.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/runtime-loading-mask.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/base-accordion-layout-parity.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame-fragment-control.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/contents-wheel-evidence.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/header-select-elevation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-typography.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-sidebar-disclosure.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-new-projection-families.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-portal.browser.test.ts',
  'packages/adapters/web-component/test/shadow-closeout.browser.test.ts',
  'packages/web-conformance/test/number-field-stepper-feedback.browser.test.ts',
]);

// Dedicated evidence uses its existing owner, never the ordinary shared-dev phase.
// The historical PRODUCTION_* names include built-site checks and the private
// Liquid Card candidate fixture, whose own workflow uses an isolated dev server.
export const PRODUCTION_BROWSER_SUITES = Object.freeze([
  'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/bootstrap-navbar.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/bootstrap-button-motion.browser.test.ts',
  'packages/prototypes/bootstrap-2-3-2/test/modal-presence.browser.test.ts',
  'packages/prototypes/bootstrap-2-3-2/test/progress-width-motion.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-state-controls.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-card.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-select-item-sizing.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-carousel.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/brutalist-action-motion.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/language-select-navigation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/homepage-composition.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-toggle.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-hover.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-prominent-tint.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-tint-stage-diagnostic.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/demo-liquid-visible-refraction-diagnostic.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-drawer-intrinsic.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-drawer-command-density.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-popover-command-density.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-button-ghost.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-button-ghost-component.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-neo-popover-title.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-popover-title.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/popover-navigation.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-liquid-dropdown.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-dropdown-recipes.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-slider-upstream.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-shadcn-toggle.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/liquid-elevation-control.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/library-liquid-card-producer.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts',
  'packages/adapters/base/test/resident-motion.browser.test.ts',
  'packages/prototypes/shadcn/test/switch-motion.browser.test.ts',
  'packages/prototypes/brutalist/test/switch-motion.browser.test.ts',
  'packages/web-conformance/test/select-target-alignment.browser.test.ts',
  'packages/web-conformance/test/select-group.browser.test.ts',
]);

// Each dedicated suite has an executable owner; exclusion is never a skip.
export const PRODUCTION_BROWSER_OWNERS = Object.freeze({
  'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts':
    '.github/workflows/bootstrap-state-controls-evidence.yml',
  'apps/www/src/content/docs/zh-cn/bootstrap-navbar.browser.test.ts':
    '.github/workflows/bootstrap-state-controls-evidence.yml',
  'apps/www/src/content/docs/zh-cn/bootstrap-button-motion.browser.test.ts':
    '.github/workflows/bootstrap-state-controls-evidence.yml',
  'packages/prototypes/bootstrap-2-3-2/test/modal-presence.browser.test.ts':
    '.github/workflows/bootstrap-state-controls-evidence.yml',
  'packages/prototypes/bootstrap-2-3-2/test/progress-width-motion.browser.test.ts':
    '.github/workflows/bootstrap-state-controls-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-state-controls.browser.test.ts':
    '.github/workflows/liquid-material-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-card.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-select-item-sizing.browser.test.ts':
    '.github/workflows/select-item-sizing-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-shadcn-carousel.browser.test.ts':
    '.github/workflows/carousel-preview-evidence.yml',
  'apps/www/src/content/docs/zh-cn/brutalist-action-motion.browser.test.ts':
    '.github/workflows/homepage-visual-evidence.yml',
  'apps/www/src/content/docs/zh-cn/language-select-navigation.browser.test.ts':
    '.github/workflows/language-select-navigation-evidence.yml',
  'apps/www/src/content/docs/zh-cn/homepage-composition.browser.test.ts':
    '.github/workflows/homepage-visual-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-toggle.browser.test.ts':
    '.github/workflows/liquid-material-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-hover.browser.test.ts':
    '.github/workflows/liquid-material-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-prominent-tint.browser.test.ts':
    '.github/workflows/liquid-material-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-liquid-tint-stage-diagnostic.browser.test.ts':
    '.github/workflows/liquid-material-evidence.yml',
  'apps/www/src/content/docs/zh-cn/demo-liquid-visible-refraction-diagnostic.browser.test.ts':
    '.github/workflows/liquid-material-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-button-ghost-component.browser.test.ts':
    '.github/workflows/finf-button-ghost-component-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-button-ghost.browser.test.ts':
    '.github/workflows/finf-button-ghost-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-drawer-intrinsic.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-drawer-command-density.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-popover-command-density.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-neo-popover-title.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-popover-title.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/popover-navigation.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-liquid-dropdown.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-dropdown-recipes.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-slider-upstream.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-shadcn-toggle.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'apps/www/src/content/docs/zh-cn/liquid-elevation-control.browser.test.ts':
    '.github/workflows/liquid-elevation-control-evidence.yml',
  'apps/www/src/content/docs/zh-cn/library-liquid-card-producer.browser.test.ts':
    '.github/workflows/liquid-card-candidate-evidence.yml',
  'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts':
    'apps/www/scripts/run-search-production-evidence.mjs',
  'apps/www/src/content/docs/zh-cn/site-startup-theme.browser.test.ts':
    '.github/workflows/site-startup-theme-evidence.yml',
  'packages/prototypes/brutalist/test/switch-motion.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'packages/prototypes/shadcn/test/switch-motion.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'packages/adapters/base/test/resident-motion.browser.test.ts':
    '.github/workflows/finf-representative-features-evidence.yml',
  'packages/web-conformance/test/select-group.browser.test.ts':
    '.github/workflows/select-target-alignment-evidence.yml',
  'packages/web-conformance/test/select-target-alignment.browser.test.ts':
    '.github/workflows/select-target-alignment-evidence.yml',
});

// Bound each CI worker to a deterministic share of the complete development inventory.
// The 44876125495 cycle disproved the former ten-shard estimate: an unmeasured
// Header suite alone took 641s rather than its 52s fallback. Preserve the 900s
// deadline and complete inventory; use more bounded, less concurrent workers.
// These estimates are planning admission, never executed acceptance evidence.
export const BROWSER_SHARD_COUNT = 18;
export const BROWSER_EXECUTION_BUDGET_SECONDS = 900;
export const BROWSER_SETUP_RESERVE_SECONDS = 180;
export const BROWSER_MAX_ESTIMATED_SECONDS =
  BROWSER_EXECUTION_BUDGET_SECONDS - BROWSER_SETUP_RESERVE_SECONDS;

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

// Measured wall-clock cost (seconds) of each development browser suite from the
// 2026-11-16 regression cycle 43837651044 (main f69d5969). Sorted round-robin
// assignment placed the heaviest suites (site-search-commands ~629s,
// demo-select-draft-projections ~420s, homepage-dogfood ~373s,
// site-native-links ~355s) into the same shards, so seven of eight shards hit
// the outer 900s cap before reporting a terminal summary. Weight-aware
// assignment spreads that cost instead of raising the cap. Suites without a
// measurement used the former median measured cost. Retain this history and
// take the larger of it and newer terminal-file observations below. An aborted
// file is not a terminal sample; failed terminal files are costs, not passes.
export const BROWSER_SUITE_WEIGHT_SECONDS = Object.freeze({
  'apps/www/src/components/documentation-image-preview.browser.test.ts': 90,
  'apps/www/src/content/docs/zh-cn/brutalist-passive-consumers.browser.test.ts': 55,
  'apps/www/src/content/docs/zh-cn/button-boundaries.browser.test.ts': 83,
  'apps/www/src/content/docs/zh-cn/code-scroll-chain.browser.test.ts': 54,
  'apps/www/src/content/docs/zh-cn/code-surfaces.browser.test.ts': 49,
  'apps/www/src/content/docs/zh-cn/contrast-probe.browser.test.ts': 11,
  'apps/www/src/content/docs/zh-cn/contrast-tooltip-warm-handoff.browser.test.ts': 59,
  'apps/www/src/content/docs/zh-cn/demo-base-controls.browser.test.ts': 23,
  'apps/www/src/content/docs/zh-cn/demo-base-table.browser.test.ts': 41,
  'apps/www/src/content/docs/zh-cn/demo-brutalist-button.browser.test.ts': 32,
  'apps/www/src/content/docs/zh-cn/demo-brutalist-controls.browser.test.ts': 58,
  'apps/www/src/content/docs/zh-cn/demo-brutalist-dialog.browser.test.ts': 7,
  'apps/www/src/content/docs/zh-cn/demo-brutalist-spinner.browser.test.ts': 24,
  'apps/www/src/content/docs/zh-cn/demo-composed-style-isolation.browser.test.ts': 24,
  'apps/www/src/content/docs/zh-cn/demo-field-family.browser.test.ts': 208,
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-material.browser.test.ts': 52,
  'apps/www/src/content/docs/zh-cn/demo-liquid-glass-portal.browser.test.ts': 176,
  'apps/www/src/content/docs/zh-cn/demo-new-projection-families.browser.test.ts': 59,
  'apps/www/src/content/docs/zh-cn/demo-prototype-style-closure.browser.test.ts': 29,
  'apps/www/src/content/docs/zh-cn/demo-select-draft-projections.browser.test.ts': 420,
  'apps/www/src/content/docs/zh-cn/demo-select-first-paint.browser.test.ts': 12,
  'apps/www/src/content/docs/zh-cn/demo-shadcn-controls.browser.test.ts': 132,
  'apps/www/src/content/docs/zh-cn/demo-shadcn-input.browser.test.ts': 70,
  'apps/www/src/content/docs/zh-cn/demo-shadcn-radio-group.browser.test.ts': 43,
  'apps/www/src/content/docs/zh-cn/demo-shadcn-tooltip.browser.test.ts': 8,
  'apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts': 53,
  'apps/www/src/content/docs/zh-cn/docs-content-flow.browser.test.ts': 34,
  'apps/www/src/content/docs/zh-cn/finf-alert-dialog-layout.browser.test.ts': 139,
  'apps/www/src/content/docs/zh-cn/home-demo-runtime.browser.test.ts': 104,
  'apps/www/src/content/docs/zh-cn/homepage-button-contract.browser.test.ts': 170,
  'apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts': 373,
  'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts': 47,
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame-fragment-control.browser.test.ts': 8,
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts': 174,
  'apps/www/src/content/docs/zh-cn/runtime-layout-parity.browser.test.ts': 63,
  'apps/www/src/content/docs/zh-cn/runtime-preview-surface.browser.test.ts': 24,
  'apps/www/src/content/docs/zh-cn/scroll-end-follow.browser.test.ts': 5,
  'apps/www/src/content/docs/zh-cn/site-copy-commands.browser.test.ts': 207,
  'apps/www/src/content/docs/zh-cn/site-native-links.browser.test.ts': 355,
  'apps/www/src/content/docs/zh-cn/site-search-commands.browser.test.ts': 629,
  'apps/www/src/content/docs/zh-cn/site-sidebar-disclosure.browser.test.ts': 68,
  'apps/www/src/content/docs/zh-cn/website-markup-provenance.browser.test.ts': 0,
  'apps/www/test/component-consumer-repairs.browser.test.ts': 22,
  'apps/www/test/radio-group-entry.browser.test.ts': 8,
  'apps/www/test/virtual-list-resize.browser.test.ts': 1,
  'packages/adapters/web-component/test/shadow-closeout.browser.test.ts': 63,
  'packages/prototypes/base/test/async-region.browser.test.ts': 3,
});

export function validateBrowserCostEvidence(evidence) {
  if (
    evidence?.schemaVersion !== 1 ||
    !Number.isSafeInteger(evidence.runId) ||
    evidence.runId < 1 ||
    !/^[a-f0-9]{40}$/.test(evidence.headSha ?? '') ||
    !Array.isArray(evidence.observations) ||
    !evidence.observations.length
  )
    throw new Error('Invalid browser cost evidence identity');
  const suites = new Set();
  for (const row of evidence.observations) {
    if (
      !/^(apps|packages|internal)\/[\w/.-]+\.browser\.test\.ts$/.test(row.suite ?? '') ||
      suites.has(row.suite) ||
      !Number.isFinite(row.durationMs) ||
      row.durationMs < 0 ||
      !Number.isSafeInteger(row.jobId) ||
      row.jobId < 1 ||
      row.jobUrl !==
        `https://github.com/Proto-UI/Proto-UI/actions/runs/${evidence.runId}/job/${row.jobId}` ||
      !/^[a-f0-9]{64}$/.test(row.logSha256 ?? '') ||
      !['passed', 'failed'].includes(row.fileOutcome)
    )
      throw new Error(`Invalid or duplicate browser cost observation: ${row.suite}`);
    suites.add(row.suite);
  }
  return evidence;
}

const observedCosts = {};
for (const file of [
  './fixtures/browser-suite-costs-44876125495.json',
  './fixtures/browser-suite-costs-45029016292.json',
]) {
  const evidence = validateBrowserCostEvidence(
    JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  );
  for (const { suite, durationMs } of evidence.observations) {
    observedCosts[suite] = Math.max(observedCosts[suite] ?? 0, Math.ceil(durationMs / 1000));
  }
}
// The passive-atoms file was still running when the old shard was killed. Its
// 600s reserve is explicitly an estimate, not an invented completion sample.
const interruptedSuiteReserves = {
  'apps/www/src/content/docs/zh-cn/demo-passive-atoms.browser.test.ts': 600,
};
export const DEFAULT_BROWSER_SUITE_WEIGHT_SECONDS = 120;

export function browserSuiteWeightSeconds(suite) {
  const known = [
    BROWSER_SUITE_WEIGHT_SECONDS[suite],
    observedCosts[suite],
    interruptedSuiteReserves[suite],
  ].filter((value) => value !== undefined);
  return known.length ? Math.max(...known) : DEFAULT_BROWSER_SUITE_WEIGHT_SECONDS;
}

export function browserShardCosts(shards = browserShards()) {
  return shards.map((suites) => ({
    estimatedSeconds: suites.reduce((sum, suite) => sum + browserSuiteWeightSeconds(suite), 0),
    setupReserveSeconds: BROWSER_SETUP_RESERVE_SECONDS,
    executionBudgetSeconds: BROWSER_EXECUTION_BUDGET_SECONDS,
  }));
}

export function assertBrowserShardCapacity(shards = browserShards()) {
  for (const [index, cost] of browserShardCosts(shards).entries()) {
    if (
      !Number.isFinite(cost.estimatedSeconds) ||
      cost.estimatedSeconds < 0 ||
      cost.estimatedSeconds > BROWSER_MAX_ESTIMATED_SECONDS
    )
      throw new Error(
        `Browser shard ${index + 1}/${shards.length} estimates ${cost.estimatedSeconds}s + ` +
          `${cost.setupReserveSeconds}s setup beyond ${cost.executionBudgetSeconds}s; ` +
          'rebalance the complete inventory before execution'
      );
  }
}

export function browserShards(suites = BROWSER_SUITES, count = BROWSER_SHARD_COUNT) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > suites.length ||
    new Set(suites).size !== suites.length
  )
    throw new Error('Browser shards must be nonempty and suites unique');
  // Longest-processing-time-first greedy assignment: place the heaviest
  // remaining suite into the lightest shard that still has capacity. Sorting
  // by (weight desc, name asc) makes the result independent of input order,
  // and the per-shard count cap keeps every shard bounded and nonempty.
  const capacity = Math.ceil(suites.length / count);
  const ordered = [...suites].sort(
    (left, right) =>
      browserSuiteWeightSeconds(right) - browserSuiteWeightSeconds(left) ||
      (left < right ? -1 : left > right ? 1 : 0)
  );
  const shards = Array.from({ length: count }, () => []);
  const loads = new Array(count).fill(0);
  for (const suite of ordered) {
    let target = -1;
    for (let index = 0; index < count; index += 1) {
      if (shards[index].length >= capacity) continue;
      if (target === -1 || loads[index] < loads[target]) target = index;
    }
    shards[target].push(suite);
    loads[target] += browserSuiteWeightSeconds(suite);
  }
  // Restore deterministic name order within each shard for stable receipts.
  return shards.map((shard) => shard.sort());
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
