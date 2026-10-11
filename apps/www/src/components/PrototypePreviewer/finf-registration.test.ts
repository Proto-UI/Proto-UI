import { describe, expect, it } from 'vitest';
import { getDemoSourcePath, loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../../../../../packages/cli/src/registry/finf-components';
import chevronLeft from '../../../../../packages/prototypes/lucide/src/icons/chevron-left';
import chevronRight from '../../../../../packages/prototypes/lucide/src/icons/chevron-right';
import dropdownIntegration from '../../../../../internal/records/2026-10-10-finf-b-dropdown-composition-manifest.json';

function prototypeIds(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypeIds),
  ];
}

describe('Finf source-only batch entry points', () => {
  it.each([
    ['lucide-chevron-left-icon', chevronLeft],
    ['lucide-chevron-right-icon', chevronRight],
  ] as const)('loads the actual Calendar navigation icon export %s', async (id, prototype) => {
    await loadPrototype(id);
    expect(prototype.name).toBe(id);
    expect(getPrototype(id)).toBe(prototype);
  });

  for (const entry of Object.values(FINF_WORKSPACE_COMPONENT_ENTRIES)) {
    it(`${entry.id} resolves the actual demo and every registered atom`, async () => {
      const compositionDemo = dropdownIntegration.entries.find(
        (item) => item.subpath === entry.importPath
      )?.demo;
      const demoId = compositionDemo?.id ?? `demo-${entry.id}`;
      const demo = await loadDemo(demoId);
      if (compositionDemo) expect(getDemoSourcePath(demoId)).toBe(compositionDemo.path);
      assertDemoSpec(demo);
      const ids = [...new Set(prototypeIds(demo.root))];
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id).name).toBe(id);
      }
      for (const atom of entry.items) {
        const id = atom.elementName.slice('proto-ui-'.length);
        await loadPrototype(id);
        expect(getPrototype(id).name).toBe(id);
      }
    });
  }
});
