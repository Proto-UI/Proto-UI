import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { codeMap as codeMap0 } from '../src/content/docs/demo_components/button/buttonCode';
import { codeMap as codeMap1 } from '../src/content/docs/demo_components/shadcn-dialog/shadcnDialogCode';
import { codeMap as codeMap2 } from '../src/content/docs/demo_components/shadcn-hover-card/shadcnHoverCardCode';
import { codeMap as codeMap3 } from '../src/content/docs/demo_components/tabs/tabsCode';

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
];

function visit(node: DemoChild, action: (node: Exclude<DemoChild, string>) => void): void {
  if (typeof node === 'string') return;
  action(node);
  if (node.kind !== 'text') for (const child of node.children ?? []) visit(child, action);
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

  it('covers every actual Shadcn page demo ID, not a selected subset', () => {
    const found = new Set<string>();
    for (const locale of ['en', 'zh-cn']) {
      const directory = resolve(
        process.cwd(),
        'apps/www/src/content/docs',
        locale,
        'ui-libraries/shadcn'
      );
      for (const file of readdirSync(directory).filter((name) => name.endsWith('.mdx'))) {
        const content = readFileSync(resolve(directory, file), 'utf8');
        for (const match of content.matchAll(/demoId=["']([^"']+)["']/g)) found.add(match[1]!);
        expect(content, `${locale}/${file}`).toContain('Shadcn Rhea');
      }
    }
    expect([...found].sort()).toEqual(demos.map(([id]) => id).sort());
    expect(found.size).toBe(63);
  });

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
        for (const [id, snippet] of snippets) {
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
