import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2/tabs';
import * as liquid from '@proto.ui/prototypes-liquid-glass/tabs';
import {
  WORKSPACE_COMPONENT_REGISTRY,
  COMPONENT_REGISTRY,
} from '../../../../../packages/cli/src/registry/components';
import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { collectPrototypeIds } from './demo-types';
import { resolveProjectionRecipe, resolveProjectionPart } from './projection-families';
for (const [family, exports] of [
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', liquid],
] as const)
  it(`${family} registers exactly four real draft Tabs exports, demo parts and source-only CLI entry`, async () => {
    const entry = WORKSPACE_COMPONENT_REGISTRY[`${family}-tabs`]!;
    expect(COMPONENT_REGISTRY[`${family}-tabs`]).toBeUndefined();
    expect(entry.sourceOnly).toBe(true);
    expect(entry.items.map((item) => item.prototypeImport)).toEqual([
      'tabsRoot',
      'tabsList',
      'tabsTrigger',
      'tabsContent',
    ]);
    const ids = new Set<string>();
    const demo = await loadDemo(`demo-${family}-tabs`);
    collectPrototypeIds(demo.root, ids);
    expect([...ids].sort()).toEqual(
      ['root', 'list', 'trigger', 'content'].map((part) => `${family}-tabs-${part}`).sort()
    );
    for (const [part, key] of [
      ['root', 'tabsRoot'],
      ['list', 'tabsList'],
      ['trigger', 'tabsTrigger'],
      ['content', 'tabsContent'],
    ] as const) {
      const id = `${family}-tabs-${part}`;
      expect(exports[key].name).toBe(id);
      await loadPrototype(id);
      expect(getPrototype(id)).toBe(exports[key]);
      expect(resolveProjectionPart(family, 'tabs', part).prototypeId).toBe(id);
    }
    expect(resolveProjectionRecipe(`demo-${family}-tabs`)).toEqual({
      projectionFamilyId: family,
      familyId: 'tabs',
    });
    const manifest = JSON.parse(readFileSync(`packages/prototypes/${family}/package.json`, 'utf8'));
    expect(manifest.exports['./tabs']).toEqual({
      types: './src/tabs/index.ts',
      default: './src/tabs/index.ts',
    });
  });
