import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import {
  assertDemoSpec,
  collectPrototypeIds,
  type DemoChild,
  type DemoSpec,
} from '../src/components/PrototypePreviewer/demo-types';
import { assertProjectionRecipeClosure } from '../src/components/PrototypePreviewer/projection-composition';
import {
  PROJECTION_FAMILY_MANIFESTS,
  validateProjectionFamilyManifest,
  type ProjectionFamilyManifest,
} from '../src/components/PrototypePreviewer/projection-families';
import { withShadcnRheaDemo } from '../src/content/docs/shadcn-demo-style';
import { createGhostDemo } from '../src/content/docs/demo_components/button/demo-button-ghost.demo';
import demo0 from '../src/content/docs/demo_components/button/demo-button.demo';
import demo1 from '../src/content/docs/demo_components/button/demo-button-default.demo';
import demo2 from '../src/content/docs/demo_components/button/demo-button-destructive.demo';
import demo3 from '../src/content/docs/demo_components/button/demo-button-disabled.demo';
import demo4 from '../src/content/docs/demo_components/button/demo-button-ghost.demo';
import demo5 from '../src/content/docs/demo_components/button/demo-button-outline.demo';
import demo6 from '../src/content/docs/demo_components/button/demo-button-secondary.demo';
import demo7 from '../src/content/docs/demo_components/button/demo-button-sizes.demo';
import demo8 from '../src/content/docs/demo_components/button/demo-button-variants.demo';
import demo9 from '../src/content/docs/demo-shadcn-accordion.demo';
import demo10 from '../src/content/docs/demo-shadcn-alert-dialog.demo';
import demo11 from '../src/content/docs/demo-shadcn-autocomplete.demo';
import demo12 from '../src/content/docs/zh-cn/demo-shadcn-calendar.demo';
import demo13 from '../src/content/docs/zh-cn/demo-shadcn-card.demo';
import demo14 from '../src/content/docs/zh-cn/demo-shadcn-carousel.demo';
import demo15 from '../src/content/docs/zh-cn/demo-shadcn-checkbox.demo';
import demo16 from '../src/content/docs/demo-shadcn-checkbox-group.demo';
import demo17 from '../src/content/docs/demo-shadcn-collapsible.demo';
import demo18 from '../src/content/docs/demo-shadcn-combobox.demo';
import demo19 from '../src/content/docs/demo-shadcn-command.demo';
import demo20 from '../src/content/docs/demo-shadcn-context-menu.demo';
import demo21 from '../src/content/docs/zh-cn/demo-shadcn-data-table.demo';
import demo22 from '../src/content/docs/zh-cn/demo-shadcn-date-picker.demo';
import demo23 from '../src/content/docs/zh-cn/demo-shadcn-dialog.demo';
import demo24 from '../src/content/docs/demo-shadcn-drawer.demo';
import demo25 from '../src/content/docs/demo-shadcn-drawer-scroll.demo';
import demo26 from '../src/content/docs/demo-shadcn-drawer-snap.demo';
import demo27 from '../src/content/docs/demo-shadcn-dropdown-destructive.demo';
import demo28 from '../src/content/docs/demo-shadcn-dropdown-inset.demo';
import demo29 from '../src/content/docs/zh-cn/demo-shadcn-dropdown-menu.demo';
import demo30 from '../src/content/docs/demo-shadcn-field.demo';
import demo31 from '../src/content/docs/demo-shadcn-fieldset.demo';
import demo32 from '../src/content/docs/demo-shadcn-form.demo';
import demo33 from '../src/content/docs/zh-cn/demo-shadcn-hover-card.demo';
import demo34 from '../src/content/docs/zh-cn/demo-shadcn-input.demo';
import demo35 from '../src/content/docs/demo-shadcn-input-otp.demo';
import demo36 from '../src/content/docs/zh-cn/demo-shadcn-label.demo';
import demo37 from '../src/content/docs/demo-shadcn-menubar.demo';
import demo38 from '../src/content/docs/zh-cn/demo-shadcn-message-scroller.demo';
import demo39 from '../src/content/docs/demo-shadcn-meter.demo';
import demo40 from '../src/content/docs/demo-shadcn-navigation-menu.demo';
import demo41 from '../src/content/docs/demo-shadcn-number-field.demo';
import demo42 from '../src/content/docs/demo-shadcn-popover.demo';
import demo43 from '../src/content/docs/demo-shadcn-progress.demo';
import demo44 from '../src/content/docs/zh-cn/demo-shadcn-radio-group.demo';
import demo45 from '../src/content/docs/zh-cn/demo-shadcn-resizable.demo';
import demo46 from '../src/content/docs/zh-cn/demo-shadcn-scroll-area.demo';
import demo47 from '../src/content/docs/zh-cn/demo-shadcn-select.demo';
import demo48 from '../src/content/docs/zh-cn/demo-shadcn-separator.demo';
import demo49 from '../src/content/docs/demo-shadcn-slider.demo';
import demo50 from '../src/content/docs/zh-cn/demo-shadcn-surface.demo';
import demo51 from '../src/content/docs/zh-cn/demo-shadcn-switch.demo';
import demo52 from '../src/content/docs/zh-cn/demo-shadcn-switch-compositions.demo';
import demo53 from '../src/content/docs/demo_components/tabs/demo-shadcn-tabs.demo';
import demo54 from '../src/content/docs/zh-cn/demo-shadcn-text.demo';
import demo55 from '../src/content/docs/zh-cn/demo-shadcn-textarea.demo';
import demo56 from '../src/content/docs/demo-shadcn-toast.demo';
import demo57 from '../src/content/docs/zh-cn/demo-shadcn-toggle.demo';
import demo58 from '../src/content/docs/demo-shadcn-toggle-group.demo';
import demo59 from '../src/content/docs/demo-shadcn-toolbar.demo';
import demo60 from '../src/content/docs/zh-cn/demo-shadcn-tooltip.demo';
import demo61 from '../src/content/docs/zh-cn/demo-shadcn-tree.demo';
import demo62 from '../src/content/docs/zh-cn/demo-shadcn-virtual-list.demo';
import demo63 from '../src/content/docs/demo-shadcn-async-region.demo';
import demo64 from '../src/content/docs/demo-shadcn-image.demo';
import demo65 from '../src/content/docs/demo-shadcn-live-region.demo';
import demo66 from '../src/content/docs/demo-shadcn-table.demo';
import demo67 from '../src/content/docs/demo-shadcn-transition.demo';
import calendarSelectionDemo from '../src/content/docs/zh-cn/demo-shadcn-calendar-selection.demo';
import datePickerSelectionDemo from '../src/content/docs/zh-cn/demo-shadcn-date-picker-selection.demo';
import sliderValuesDemo from '../src/content/docs/demo-shadcn-slider-values.demo';
import dataTableRecipesDemo from '../src/content/docs/zh-cn/demo-shadcn-data-table-recipes.demo';
import formValidationDemo from '../src/content/docs/demo-shadcn-form-validation.demo';
import selectInputDemo from '../src/content/docs/demo-shadcn-select-input.demo';
import fieldChoicesDemo from '../src/content/docs/demo-shadcn-field-choices.demo';
import { codeMap as codeMap0 } from '../src/content/docs/demo_components/button/buttonCode';
import { getButtonExampleFiles } from '../src/content/docs/demo_components/button/button-usage';
import inputShellDemo from '../src/content/docs/demo-shadcn-input-shell.demo';
import navigationPopoverDemo from '../src/content/docs/demo-shadcn-popover-navigation.demo';
import novaTabsDemo from '../src/content/docs/demo_components/tabs/demo-shadcn-tabs-preset-nova.demo';
import rheaTabsDemo from '../src/content/docs/demo_components/tabs/demo-shadcn-tabs-preset-rhea.demo';
import newYorkTabsDemo from '../src/content/docs/demo_components/tabs/demo-shadcn-tabs-preset-new-york-v4.demo';
import tabsProfileSwitchDemo from '../src/content/docs/demo_components/tabs/demo-shadcn-tabs-profile-switch.demo';
import { codeMap as codeMap1 } from '../src/content/docs/demo_components/shadcn-dialog/shadcnDialogCode';
import { codeMap as codeMap2 } from '../src/content/docs/demo_components/shadcn-hover-card/shadcnHoverCardCode';
import { codeMap as codeMap3 } from '../src/content/docs/demo_components/tabs/tabsCode';
import w1ButtonIconDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-icon.demo';
import w1ButtonLinkDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-link.demo';
import w1ButtonLoadingDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-loading.demo';
import w1ButtonRtlDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-rtl.demo';
import w1ButtonStyleProfilesDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-style-profiles.demo';
import w1ButtonWithIconDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-with-icon.demo';
import w1ButtonWrapDemo from '../src/content/docs/demo_components/button-examples/demo-shadcn-button-wrap.demo';
import w1CardDensityDemo from '../src/content/docs/demo_components/card/demo-shadcn-card-density.demo';
import w1CardDividersDemo from '../src/content/docs/demo_components/card/demo-shadcn-card-dividers.demo';
import w1CardImageDemo from '../src/content/docs/demo_components/card/demo-shadcn-card-image.demo';
import w1CardLoginDemo from '../src/content/docs/demo_components/card/demo-shadcn-card-login.demo';
import w1CardRtlDemo from '../src/content/docs/demo_components/card/demo-shadcn-card-rtl.demo';
import w1CardSmallDemo from '../src/content/docs/demo_components/card/demo-shadcn-card-small.demo';
import w1ImageA11yDemo from '../src/content/docs/demo_components/image/demo-shadcn-image-a11y.demo';
import w1ImageFitDemo from '../src/content/docs/demo_components/image/demo-shadcn-image-fit.demo';
import w1ImageLoadingDemo from '../src/content/docs/demo_components/image/demo-shadcn-image-loading.demo';
import w1ImageRadiusDemo from '../src/content/docs/demo_components/image/demo-shadcn-image-radius.demo';
import w1LabelBasicDemo from '../src/content/docs/demo_components/label/demo-shadcn-label-basic.demo';
import w1LabelFieldDemo from '../src/content/docs/demo_components/label/demo-shadcn-label-field.demo';
import w1LabelModesDemo from '../src/content/docs/demo_components/label/demo-shadcn-label-modes.demo';
import w1LabelRtlDemo from '../src/content/docs/demo_components/label/demo-shadcn-label-rtl.demo';
import w1SeparatorListDemo from '../src/content/docs/demo_components/separator/demo-shadcn-separator-list.demo';
import w1SeparatorMenuDemo from '../src/content/docs/demo_components/separator/demo-shadcn-separator-menu.demo';
import w1SeparatorRtlDemo from '../src/content/docs/demo_components/separator/demo-shadcn-separator-rtl.demo';
import w1SeparatorVerticalDemo from '../src/content/docs/demo_components/separator/demo-shadcn-separator-vertical.demo';
import w1StyleScopeDemo from '../src/content/docs/demo_components/style-scope/demo-shadcn-style-scope.demo';
import w1StyleScopeCompositeDemo from '../src/content/docs/demo_components/style-scope/demo-shadcn-style-scope-composite.demo';
import w1StyleScopeNestingDemo from '../src/content/docs/demo_components/style-scope/demo-shadcn-style-scope-nesting.demo';
import w1StyleScopeStateDemo from '../src/content/docs/demo_components/style-scope/demo-shadcn-style-scope-state-preservation.demo';
import w1SurfaceActionProfilesDemo from '../src/content/docs/demo_components/surface/demo-shadcn-surface-action-profiles.demo';
import w1SurfaceFadeDemo from '../src/content/docs/demo_components/surface/demo-shadcn-surface-fade.demo';
import w1SurfaceGeometryDemo from '../src/content/docs/demo_components/surface/demo-shadcn-surface-geometry.demo';
import w1SurfaceStatesDemo from '../src/content/docs/demo_components/surface/demo-shadcn-surface-states.demo';
import w1SurfaceVariantsDemo from '../src/content/docs/demo_components/surface/demo-shadcn-surface-variants.demo';
import w1TextActionProfilesDemo from '../src/content/docs/demo_components/text/demo-shadcn-text-action-profiles.demo';
import w1TextEditorialDemo from '../src/content/docs/demo_components/text/demo-shadcn-text-editorial.demo';
import w1TextRtlDemo from '../src/content/docs/demo_components/text/demo-shadcn-text-rtl.demo';
import w1TextScaleDemo from '../src/content/docs/demo_components/text/demo-shadcn-text-scale.demo';
import w1TextTonesDemo from '../src/content/docs/demo_components/text/demo-shadcn-text-tones.demo';
import w1ToggleControlledDemo from '../src/content/docs/demo_components/toggle/demo-shadcn-toggle-controlled.demo';
import w1ToggleDisabledDemo from '../src/content/docs/demo_components/toggle/demo-shadcn-toggle-disabled.demo';
import w1ToggleOutlineDemo from '../src/content/docs/demo_components/toggle/demo-shadcn-toggle-outline.demo';
import w1ToggleRtlDemo from '../src/content/docs/demo_components/toggle/demo-shadcn-toggle-rtl.demo';
import w1ToggleSizesDemo from '../src/content/docs/demo_components/toggle/demo-shadcn-toggle-sizes.demo';
import w1ToggleWithTextDemo from '../src/content/docs/demo_components/toggle/demo-shadcn-toggle-with-text.demo';
import w1ToggleGroupCustomDemo from '../src/content/docs/demo_components/toggle-group/demo-shadcn-toggle-group-custom.demo';
import w1ToggleGroupDisabledDemo from '../src/content/docs/demo_components/toggle-group/demo-shadcn-toggle-group-disabled.demo';
import w1ToggleGroupOutlineDemo from '../src/content/docs/demo_components/toggle-group/demo-shadcn-toggle-group-outline.demo';
import w1ToggleGroupSizesDemo from '../src/content/docs/demo_components/toggle-group/demo-shadcn-toggle-group-sizes.demo';
import w1ToggleGroupSpacingDemo from '../src/content/docs/demo_components/toggle-group/demo-shadcn-toggle-group-spacing.demo';
import w1ToggleGroupVerticalDemo from '../src/content/docs/demo_components/toggle-group/demo-shadcn-toggle-group-vertical.demo';
import w1ToolbarDisabledDemo from '../src/content/docs/demo_components/toolbar/demo-shadcn-toolbar-disabled.demo';
import w1ToolbarSizesDemo from '../src/content/docs/demo_components/toolbar/demo-shadcn-toolbar-sizes.demo';
import w1ToolbarVariantsDemo from '../src/content/docs/demo_components/toolbar/demo-shadcn-toolbar-variants.demo';
import w1ToolbarVerticalDemo from '../src/content/docs/demo_components/toolbar/demo-shadcn-toolbar-vertical.demo';

const demos: ReadonlyArray<readonly [string, DemoSpec]> = [
  ['demo-button', demo0],
  ['demo-button-default', demo1],
  ['demo-button-destructive', demo2],
  ['demo-button-disabled', demo3],
  ['demo-button-ghost', demo4],
  ['demo-button-outline', demo5],
  ['demo-button-secondary', demo6],
  ['demo-button-sizes', demo7],
  ['demo-button-variants', demo8],
  ['demo-shadcn-accordion', demo9],
  ['demo-shadcn-alert-dialog', demo10],
  ['demo-shadcn-autocomplete', demo11],
  ['demo-shadcn-calendar', demo12],
  ['demo-shadcn-card', demo13],
  ['demo-shadcn-carousel', demo14],
  ['demo-shadcn-checkbox', demo15],
  ['demo-shadcn-checkbox-group', demo16],
  ['demo-shadcn-collapsible', demo17],
  ['demo-shadcn-combobox', demo18],
  ['demo-shadcn-command', demo19],
  ['demo-shadcn-context-menu', demo20],
  ['demo-shadcn-data-table', demo21],
  ['demo-shadcn-date-picker', demo22],
  ['demo-shadcn-dialog', demo23],
  ['demo-shadcn-drawer', demo24],
  ['demo-shadcn-drawer-scroll', demo25],
  ['demo-shadcn-drawer-snap', demo26],
  ['demo-shadcn-dropdown-destructive', demo27],
  ['demo-shadcn-dropdown-inset', demo28],
  ['demo-shadcn-dropdown-menu', demo29],
  ['demo-shadcn-field', demo30],
  ['demo-shadcn-fieldset', demo31],
  ['demo-shadcn-form', demo32],
  ['demo-shadcn-hover-card', demo33],
  ['demo-shadcn-input', demo34],
  ['demo-shadcn-input-otp', demo35],
  ['demo-shadcn-label', demo36],
  ['demo-shadcn-menubar', demo37],
  ['demo-shadcn-message-scroller', demo38],
  ['demo-shadcn-meter', demo39],
  ['demo-shadcn-navigation-menu', demo40],
  ['demo-shadcn-number-field', demo41],
  ['demo-shadcn-popover', demo42],
  ['demo-shadcn-progress', demo43],
  ['demo-shadcn-radio-group', demo44],
  ['demo-shadcn-resizable', demo45],
  ['demo-shadcn-scroll-area', demo46],
  ['demo-shadcn-select', demo47],
  ['demo-shadcn-separator', demo48],
  ['demo-shadcn-slider', demo49],
  ['demo-shadcn-surface', demo50],
  ['demo-shadcn-switch', demo51],
  ['demo-shadcn-switch-compositions', demo52],
  ['demo-shadcn-tabs', demo53],
  ['demo-shadcn-text', demo54],
  ['demo-shadcn-textarea', demo55],
  ['demo-shadcn-toast', demo56],
  ['demo-shadcn-toggle', demo57],
  ['demo-shadcn-toggle-group', demo58],
  ['demo-shadcn-toolbar', demo59],
  ['demo-shadcn-tooltip', demo60],
  ['demo-shadcn-tree', demo61],
  ['demo-shadcn-virtual-list', demo62],
  ['demo-shadcn-async-region', demo63],
  ['demo-shadcn-image', demo64],
  ['demo-shadcn-live-region', demo65],
  ['demo-shadcn-table', demo66],
  ['demo-shadcn-transition', demo67],
  ['demo-shadcn-calendar-selection', calendarSelectionDemo],
  ['demo-shadcn-date-picker-selection', datePickerSelectionDemo],
  ['demo-shadcn-slider-values', sliderValuesDemo],
  ['demo-shadcn-data-table-recipes', dataTableRecipesDemo],
  ['demo-shadcn-form-validation', formValidationDemo],
  ['demo-shadcn-select-input', selectInputDemo],
  ['demo-shadcn-field-choices', fieldChoicesDemo],
  ['demo-shadcn-button-icon', w1ButtonIconDemo],
  ['demo-shadcn-button-link', w1ButtonLinkDemo],
  ['demo-shadcn-button-loading', w1ButtonLoadingDemo],
  ['demo-shadcn-button-rtl', w1ButtonRtlDemo],
  ['demo-shadcn-button-style-profiles', w1ButtonStyleProfilesDemo],
  ['demo-shadcn-button-with-icon', w1ButtonWithIconDemo],
  ['demo-shadcn-button-wrap', w1ButtonWrapDemo],
  ['demo-shadcn-card-density', w1CardDensityDemo],
  ['demo-shadcn-card-dividers', w1CardDividersDemo],
  ['demo-shadcn-card-image', w1CardImageDemo],
  ['demo-shadcn-card-login', w1CardLoginDemo],
  ['demo-shadcn-card-rtl', w1CardRtlDemo],
  ['demo-shadcn-card-small', w1CardSmallDemo],
  ['demo-shadcn-image-a11y', w1ImageA11yDemo],
  ['demo-shadcn-image-fit', w1ImageFitDemo],
  ['demo-shadcn-image-loading', w1ImageLoadingDemo],
  ['demo-shadcn-image-radius', w1ImageRadiusDemo],
  ['demo-shadcn-label-basic', w1LabelBasicDemo],
  ['demo-shadcn-label-field', w1LabelFieldDemo],
  ['demo-shadcn-label-modes', w1LabelModesDemo],
  ['demo-shadcn-label-rtl', w1LabelRtlDemo],
  ['demo-shadcn-separator-list', w1SeparatorListDemo],
  ['demo-shadcn-separator-menu', w1SeparatorMenuDemo],
  ['demo-shadcn-separator-rtl', w1SeparatorRtlDemo],
  ['demo-shadcn-separator-vertical', w1SeparatorVerticalDemo],
  ['demo-shadcn-style-scope', w1StyleScopeDemo],
  ['demo-shadcn-style-scope-composite', w1StyleScopeCompositeDemo],
  ['demo-shadcn-style-scope-state-preservation', w1StyleScopeStateDemo],
  ['demo-shadcn-surface-action-profiles', w1SurfaceActionProfilesDemo],
  ['demo-shadcn-surface-fade', w1SurfaceFadeDemo],
  ['demo-shadcn-surface-geometry', w1SurfaceGeometryDemo],
  ['demo-shadcn-surface-states', w1SurfaceStatesDemo],
  ['demo-shadcn-surface-variants', w1SurfaceVariantsDemo],
  ['demo-shadcn-text-action-profiles', w1TextActionProfilesDemo],
  ['demo-shadcn-text-editorial', w1TextEditorialDemo],
  ['demo-shadcn-text-rtl', w1TextRtlDemo],
  ['demo-shadcn-text-scale', w1TextScaleDemo],
  ['demo-shadcn-text-tones', w1TextTonesDemo],
  ['demo-shadcn-toggle-controlled', w1ToggleControlledDemo],
  ['demo-shadcn-toggle-disabled', w1ToggleDisabledDemo],
  ['demo-shadcn-toggle-outline', w1ToggleOutlineDemo],
  ['demo-shadcn-toggle-rtl', w1ToggleRtlDemo],
  ['demo-shadcn-toggle-sizes', w1ToggleSizesDemo],
  ['demo-shadcn-toggle-with-text', w1ToggleWithTextDemo],
  ['demo-shadcn-toggle-group-custom', w1ToggleGroupCustomDemo],
  ['demo-shadcn-toggle-group-disabled', w1ToggleGroupDisabledDemo],
  ['demo-shadcn-toggle-group-outline', w1ToggleGroupOutlineDemo],
  ['demo-shadcn-toggle-group-sizes', w1ToggleGroupSizesDemo],
  ['demo-shadcn-toggle-group-spacing', w1ToggleGroupSpacingDemo],
  ['demo-shadcn-toggle-group-vertical', w1ToggleGroupVerticalDemo],
  ['demo-shadcn-toolbar-disabled', w1ToolbarDisabledDemo],
  ['demo-shadcn-toolbar-sizes', w1ToolbarSizesDemo],
  ['demo-shadcn-toolbar-variants', w1ToolbarVariantsDemo],
  ['demo-shadcn-toolbar-vertical', w1ToolbarVerticalDemo],
];

const profileExamples = [
  {
    id: 'demo-shadcn-style-scope-nesting',
    page: 'style-scope.mdx',
    demo: w1StyleScopeNestingDemo,
    profiles: [
      ['shadcn-style-scope', 'rhea'],
      ['shadcn-style-scope', 'rhea'],
      ['shadcn-style-scope', 'new-york'],
      ['shadcn-card-root', 'new-york-v4'],
    ],
  },
  {
    id: 'demo-shadcn-tabs-profile-switch',
    page: 'tabs.mdx',
    demo: tabsProfileSwitchDemo,
    profiles: [
      ['shadcn-style-scope', 'rhea'],
      ['shadcn-style-scope', 'rhea'],
    ],
  },
  {
    id: 'demo-shadcn-input-shell',
    page: 'input-shell.mdx',
    demo: inputShellDemo,
    profiles: [],
  },
  {
    id: 'demo-shadcn-popover-navigation',
    page: 'popover.mdx',
    demo: navigationPopoverDemo,
    profiles: [['shadcn-popover-root', 'rhea']],
  },
  {
    id: 'demo-shadcn-tabs-preset-nova',
    page: 'tabs.mdx',
    demo: novaTabsDemo,
    profiles: [['shadcn-style-scope', 'nova']],
  },
  {
    id: 'demo-shadcn-tabs-preset-rhea',
    page: 'tabs.mdx',
    demo: rheaTabsDemo,
    profiles: [['shadcn-style-scope', 'rhea']],
  },
  {
    id: 'demo-shadcn-tabs-preset-new-york-v4',
    page: 'tabs.mdx',
    demo: newYorkTabsDemo,
    profiles: [['shadcn-style-scope', 'new-york-v4']],
  },
] as const;

function visit(node: DemoChild, action: (node: Exclude<DemoChild, string>) => void): void {
  if (typeof node === 'string') return;
  action(node);
  if (node.kind !== 'text') for (const child of node.children ?? []) visit(child, action);
}

function expectWcButtonProfile(id: string) {
  const html = getButtonExampleFiles(id).wc?.find((file) => file.name === 'index.html');
  if (!html) throw new Error(`Missing displayed WC Button example for ${id}`);

  const window = new Window({ settings: { disableJavaScriptEvaluation: true } });
  try {
    window.document.body.innerHTML = html.code;
    const buttons = [...window.document.querySelectorAll('proto-ui-shadcn-button')];
    expect(buttons.length, id).toBeGreaterThan(0);
    const scripts = window.document.querySelectorAll('script[type="module"]:not([src])');
    expect(scripts, id).toHaveLength(1);
    const code = scripts[0]!.textContent.trimStart();
    const adapterImport = "import { setElementProps } from '@proto.ui/adapter-web-component';";
    expect(code.startsWith(adapterImport), id).toBe(true);
    const calls: [unknown, { styleProfile?: unknown }][] = [];
    // Execute the authored caller at the setter boundary in the isolated document.
    new Function(
      'document',
      'HTMLElement',
      'CustomEvent',
      'setElementProps',
      code.slice(adapterImport.length)
    )(
      window.document,
      window.HTMLElement,
      window.CustomEvent,
      (button: unknown, props: { styleProfile?: unknown }) => calls.push([button, props])
    );
    expect(calls, id).toHaveLength(buttons.length);
    for (const [i, button] of buttons.entries()) {
      const [target, props] = calls[i]!;
      expect(target, id).toBe(button);
      expect(props.styleProfile, id).toBe('rhea');
    }
  } finally {
    window.happyDOM.abort();
  }
}

describe('ordinary Shadcn documentation demo policy', () => {
  it('preserves required setup and authored child types while declaring the real scope root', () => {
    const cleanup = () => undefined;
    const authored = {
      type: 'demo',
      root: { kind: 'box', children: ['typed authored child'] },
      setup: () => cleanup,
      authorKey: 'preserved',
    } satisfies DemoSpec & { authorKey: string };
    const wrapped = withShadcnRheaDemo(authored);
    const setup: typeof authored.setup = wrapped.setup;
    const child: typeof authored.root = wrapped.root.children[0];
    const kind: 'proto' = wrapped.root.kind;
    const prototypeId: 'shadcn-style-scope' = wrapped.root.prototypeId;
    const profile: 'rhea' = wrapped.root.props.styleProfile;
    const compatible: DemoSpec = wrapped;
    expect(setup).toBe(authored.setup);
    expect(setup()).toBe(cleanup);
    expect(child).toBe(authored.root);
    expect(wrapped.root).not.toBe(authored.root);
    expect(wrapped.root.children).toHaveLength(1);
    expect([kind, prototypeId, profile]).toEqual(['proto', 'shadcn-style-scope', 'rhea']);
    expect(compatible).toBe(wrapped);
    expect(wrapped.authorKey).toBe(authored.authorKey);
  });

  it('does not invent setup for an authored demo that has no setup', () => {
    const authored = { type: 'demo', root: { kind: 'text', text: 'static' } } satisfies DemoSpec;
    const wrapped = withShadcnRheaDemo(authored);
    const child: typeof authored.root = wrapped.root.children[0];
    expect(child).toBe(authored.root);
    expect('setup' in wrapped).toBe(false);
  });

  it('covers every actual Shadcn page demo ID in each locale', () => {
    const ordinaryIds = demos.map(([id]) => id);
    const expected = [...ordinaryIds, ...profileExamples.map(({ id }) => id)].sort();
    expect(expected).toHaveLength(136);
    for (const locale of ['en', 'zh-cn']) {
      const found = new Set<string>();
      const directory = resolve(
        process.cwd(),
        'apps/www/src/content/docs',
        locale,
        'ui-libraries/shadcn'
      );
      for (const file of readdirSync(directory).filter((name) => name.endsWith('.mdx'))) {
        const content = readFileSync(resolve(directory, file), 'utf8');
        const pageIds = [...content.matchAll(/demoId=["']([^"']+)["']/g)].map((match) => match[1]!);
        if (ordinaryIds.some((id) => pageIds.includes(id)))
          expect(content, `${locale}/${file}`).toContain('Shadcn Rhea');
        for (const id of pageIds) {
          const example = profileExamples.find((entry) => entry.id === id);
          if (example) expect(file, `${locale}/${id}`).toBe(example.page);
          found.add(id);
        }
      }
      expect([...found].sort(), locale).toEqual(expected);
    }
  });

  for (const { id, demo, profiles } of profileExamples) {
    it(`${id}: keeps its declared profile ownership`, () => {
      assertDemoSpec(demo);
      const declared: [string, unknown][] = [];
      visit(demo.root, (node) => {
        if (node.kind !== 'proto') return;
        if (node.prototypeId === 'shadcn-style-scope' || node.props?.styleProfile !== undefined)
          declared.push([node.prototypeId, node.props?.styleProfile]);
      });
      expect(declared).toEqual(profiles);
    });
  }

  for (const [id, demo] of demos) {
    it(`${id}: explicitly selects Rhea and exposes no conflicting leaf selection`, () => {
      assertDemoSpec(demo);
      expect(demo.root.kind).toBe('proto');
      if (demo.root.kind !== 'proto') throw new Error('ordinary demo lacks its public style scope');
      expect(demo.root.prototypeId).toBe('shadcn-style-scope');
      expect(demo.root.props).toEqual({ styleProfile: 'rhea' });
      expect(demo.root.className).toBe('contents');
      expect(demo.root.children).toHaveLength(1);
      const refs: string[] = [];
      visit(demo.root, (node) => {
        if (node.kind === 'text') return;
        if (node.ref) refs.push(node.ref);
        if (node.kind === 'proto' && node.props?.styleProfile !== undefined)
          expect(['rhea', 'inherit'], `${id}/${node.ref ?? node.prototypeId}`).toContain(
            node.props.styleProfile
          );
      });
      expect(new Set(refs).size).toBe(refs.length);
    });
  }

  it('demo-shadcn-tooltip: keeps both reported surfaces on the Shadcn Rhea projection', () => {
    const prototypeIds: string[] = [];
    const contentRefs: Array<string | undefined> = [];
    const contentProps: unknown[] = [];
    visit(demo60.root, (node) => {
      if (node.kind !== 'proto') return;
      prototypeIds.push(node.prototypeId);
      if (node.prototypeId !== 'shadcn-tooltip-content') return;
      contentRefs.push(node.ref);
      contentProps.push(node.props);
    });

    expect(demo60.root.kind).toBe('proto');
    if (demo60.root.kind !== 'proto') throw new Error('Tooltip demo lacks its style scope');
    expect(demo60.root.props).toEqual({ styleProfile: 'rhea' });
    expect(prototypeIds.filter((id) => id === 'shadcn-tooltip-root')).toHaveLength(2);
    expect(prototypeIds.filter((id) => id === 'shadcn-tooltip-trigger')).toHaveLength(2);
    expect(contentRefs).toEqual(['accountContent', 'notificationsContent']);
    expect(contentProps).toEqual([
      { side: 'top', align: 'center' },
      { side: 'top', align: 'center' },
    ]);
    expect(prototypeIds.some((id) => id.startsWith('base-tooltip'))).toBe(false);
  });

  it('keeps exact recipe dependency closure, including the public scope lineage', () => {
    const manifest: ProjectionFamilyManifest = PROJECTION_FAMILY_MANIFESTS.shadcn;
    validateProjectionFamilyManifest(manifest);
    for (const [id, demo] of demos) {
      const recipe = Object.values(manifest.families).find((entry) => entry.recipeId === id);
      if (!recipe) continue; // Legacy RuntimeBox demos do not invent a projection recipe.
      const actual = new Set<string>();
      collectPrototypeIds(demo.root, actual);
      expect([...actual].sort(), id).toEqual([...recipe.recipePrototypeIds].sort());
      expect(recipe.auxiliaryPrototypes, id).toContainEqual({
        basePrototypeId: null,
        prototypeId: 'shadcn-style-scope',
      });
      if (demo.root.kind !== 'proto') throw new Error('Canonical Rhea scope missing');
      const unscopedRoot = demo.root.children?.[0];
      if (!unscopedRoot) throw new Error('Canonical Rhea scope missing');
      expect(
        () =>
          assertProjectionRecipeClosure(unscopedRoot, recipe.recipePrototypeIds, recipe.recipeId),
        id
      ).toThrow(/missing required Prototype\(s\): shadcn-style-scope/);
    }
  });

  it('retains the explicit New York compatibility factory without using it as the ordinary example', () => {
    const legacy = createGhostDemo('new-york');
    const profiles: unknown[] = [];
    visit(legacy.root, (node) => {
      if (node.kind === 'proto') profiles.push(node.props?.styleProfile);
    });
    expect(profiles).toEqual(['new-york', 'new-york']);
    expect(demo4.root.kind).toBe('proto');
  });

  for (const [mapName, map] of [
    ['Button', codeMap0],
    ['Dialog', codeMap1],
    ['HoverCard', codeMap2],
    ['Tabs', codeMap3],
  ] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`${mapName}/${runtime}: displayed source explicitly declares the same profile`, () => {
        const snippets = Object.entries(map[runtime] ?? {}).filter(([id]) =>
          demos.some(([demoId]) => demoId === id)
        );
        expect(snippets.length).toBeGreaterThan(0);
        if (mapName === 'Button') expect(snippets).toHaveLength(9);
        for (const [id, snippet] of snippets) {
          if (mapName === 'Button' && runtime === 'wc') {
            expectWcButtonProfile(id);
            continue;
          }
          if (runtime === 'vue2') {
            expect(snippet, id).not.toMatch(/<script\s+setup/);
            expect(snippet, id).toContain("from '../proto-ui/components/vue2'");
            expect(snippet, id).toContain('components: {');
          }
          const controls = [...snippet.matchAll(/<(wc-shadcn-[\w-]+|Shadcn\w+)(\s[^<>]*>|>)/g)];
          expect(controls.length, id).toBeGreaterThan(0);
          for (const control of controls)
            expect(control[0], id).toMatch(/(?:styleProfile|style-profile)="rhea"/);
          expect(snippet, id).not.toMatch(
            /(?:styleProfile|style-profile)="(?:nova|new-york(?:-v4)?)"/
          );
        }
      });
    }
  }
});
