import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { listComponentChoices } from '../src/registry/components';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../src/registry/finf-components';

describe('Finf workspace-source facade boundaries', () => {
  for (const entry of Object.values(FINF_WORKSPACE_COMPONENT_ENTRIES)) {
    it(`${entry.id} exposes each real atom without installed-release admission`, () => {
      for (const host of ['react', 'vue', 'vue2', 'wc'] as const) {
        expect(() => renderHostIndex(host, [entry.id])).toThrow(/workspace-source-only/);
        const source = renderHostIndex(host, [entry.id], { sourceMode: 'workspace' });
        expect(source).toContain(`from '${entry.importPath}'`);
        for (const atom of entry.items) expect(source).toContain(atom.prototypeImport);
      }
      expect(listComponentChoices().some((choice) => choice.value === entry.id)).toBe(false);
      const family = entry.packageName.slice('@proto.ui/prototypes-'.length);
      const component = entry.importPath.slice(entry.packageName.length + 1);
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve('packages/prototypes', family, 'package.json'), 'utf8')
      );
      const published = manifest.exports[`./${component}`] as {
        types?: string;
        import?: string;
        default?: string;
        proto?: string;
      };
      if (manifest.private) {
        expect(published).toEqual({
          types: `./src/${component}/index.ts`,
          default: `./src/${component}/index.ts`,
        });
      } else {
        expect(published).toMatchObject({
          types: `./dist/${component}/index.d.ts`,
          import: `./dist/${component}/index.js`,
          default: `./dist/${component}/index.js`,
        });
        // A published family may expose its authored entry for compiler source
        // resolution. Base does, and so does a published family that owns a
        // workspace-source facade such as the Shadcn Finf components. When the
        // entry is present it must name the authored source and never the built
        // output; this condition still does not admit the workspace-only CLI
        // facade.
        if (published.proto !== undefined)
          expect(published.proto).toBe(`./src/${component}/index.ts`);
      }
    });
  }
});
