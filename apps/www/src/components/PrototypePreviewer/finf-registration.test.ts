import { describe, expect, it } from 'vitest';
import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../../../../../packages/cli/src/registry/finf-components';

function prototypeIds(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypeIds),
  ];
}

describe('Finf source-only batch entry points', () => {
  for (const entry of Object.values(FINF_WORKSPACE_COMPONENT_ENTRIES)) {
    it(`${entry.id} resolves the actual demo and every registered atom`, async () => {
      const demo = await loadDemo(`demo-${entry.id}`);
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
