// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMPONENT_REGISTRY,
  WORKSPACE_COMPONENT_REGISTRY,
  getComponentEntry,
  listComponentChoices,
} from '../src/registry/components';
import { renderHostIndex } from '../src/services/codegen';
describe('public registry and explicit workspace admission stay disjoint', () => {
  it('never places a source-only entry in public discovery, including future draft families', () => {
    const choices = listComponentChoices().map((choice) => choice.value);
    for (const [id, entry] of Object.entries(WORKSPACE_COMPONENT_REGISTRY)) {
      expect(entry.sourceOnly, id).toBe(true);
      expect(COMPONENT_REGISTRY, id).not.toHaveProperty(id);
      expect(choices, id).not.toContain(id);
      expect(getComponentEntry(id)).toBe(entry);
    }
    for (const [id, entry] of Object.entries(COMPONENT_REGISTRY)) {
      expect(entry.sourceOnly, id).not.toBe(true);
      const manifest = JSON.parse(
        readFileSync(
          `packages/prototypes/${entry.packageName.replace('@proto.ui/prototypes-', '')}/package.json`,
          'utf8'
        )
      );
      expect(manifest.private, id).not.toBe(true);
      expect(manifest.protoUi?.release?.scan, id).not.toBe(false);
    }
  });
  for (const family of ['bootstrap-2-3-2', 'liquid-glass'])
    it(`${family} Field, Select and Text require explicit workspace generation for every Web runtime`, () => {
      for (const component of ['field', 'select', 'text']) {
        const id = `${family}-${component}`;
        expect(WORKSPACE_COMPONENT_REGISTRY[id]?.sourceOnly).toBe(true);
        expect(COMPONENT_REGISTRY).not.toHaveProperty(id);
        for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
          expect(() => renderHostIndex(runtime, [id])).toThrow(/workspace-source-only/);
          expect(() => renderHostIndex(runtime, [id], { sourceMode: 'installed' })).toThrow(
            /workspace-source-only/
          );
          expect(renderHostIndex(runtime, [id], { sourceMode: 'workspace' })).toContain(
            `@proto.ui/prototypes-${family}/${component}`
          );
        }
        expect(() => renderHostIndex('gpui', [id], { sourceMode: 'workspace' })).toThrow(
          /unsupported host/
        );
      }
    });
});
