import { describe, expect, it } from 'vitest';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';
import navWithIconsShadcn from '../../content/docs/demo_components/navigation-menu/demo-shadcn-navigation-menu-with-icons.demo';
import navWithIconsBrutalist from '../../content/docs/demo_components/navigation-menu/demo-brutalist-navigation-menu-with-icons.demo';
import navWithIconsBootstrap from '../../content/docs/demo_components/navigation-menu/demo-bootstrap-2-3-2-navigation-menu-with-icons.demo';
import navWithIconsLiquid from '../../content/docs/demo_components/navigation-menu/demo-liquid-glass-navigation-menu-with-icons.demo';
import badgeWithIconBrutalist from '../../content/docs/demo_components/badge/demo-brutalist-badge-with-icon.demo';
import comboboxShadcn from '../../content/docs/demo-shadcn-combobox.demo';
import drawerShadcn from '../../content/docs/demo-shadcn-drawer.demo';

function collectPrototypeIds(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(collectPrototypeIds),
  ];
}

function collectText(node: DemoChild): string[] {
  if (typeof node === 'string') return [node];
  if (node.kind === 'text') return [node.value];
  return (node.children ?? []).flatMap(collectText);
}

describe('demo Lucide icon registration', () => {
  const iconIds = [
    'lucide-chevron-down-icon',
    'lucide-chevron-up-icon',
    'lucide-chevron-left-icon',
    'lucide-chevron-right-icon',
    'lucide-arrow-left-icon',
    'lucide-arrow-right-icon',
    'lucide-arrow-up-icon',
    'lucide-arrow-down-icon',
    'lucide-star-icon',
    'lucide-plus-icon',
    'lucide-minus-icon',
    'lucide-check-icon',
    'lucide-x-icon',
    'lucide-circle-icon',
    'lucide-circle-dot-icon',
    'lucide-circle-check-icon',
    'lucide-circle-alert-icon',
    'lucide-layout-grid-icon',
    'lucide-calendar-icon',
    'lucide-chart-bar-icon',
    'lucide-ellipsis-icon',
    'lucide-external-link-icon',
  ] as const;

  it('loads every registered Lucide icon prototype used by component demos', async () => {
    for (const id of iconIds) {
      await loadPrototype(id);
      expect(getPrototype(id).name).toBe(id);
    }
  });

  it.each([
    ['shadcn-navigation-menu-with-icons', navWithIconsShadcn],
    ['brutalist-navigation-menu-with-icons', navWithIconsBrutalist],
    ['bootstrap-2-3-2-navigation-menu-with-icons', navWithIconsBootstrap],
    ['liquid-glass-navigation-menu-with-icons', navWithIconsLiquid],
    ['brutalist-badge-with-icon', badgeWithIconBrutalist],
    ['shadcn-combobox', comboboxShadcn],
    ['shadcn-drawer', drawerShadcn],
  ] as const)('%s uses real Lucide prototypes instead of character glyphs', async (_name, demo) => {
    assertDemoSpec(demo);
    const ids = [...new Set(collectPrototypeIds(demo.root))];
    expect(ids.some((id) => id.startsWith('lucide-'))).toBe(true);
    for (const id of ids) {
      await loadPrototype(id);
      expect(getPrototype(id).name).toBe(id);
    }
    const text = collectText(demo.root).join(' ');
    expect(text).not.toMatch(/[▾▸○◔●▦═▲✓★‹›←→↑↓⋯]/);
  });
});
