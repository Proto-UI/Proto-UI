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
      expect(manifest.exports[`./${component}`]).toEqual(
        manifest.private
          ? { types: `./src/${component}/index.ts`, default: `./src/${component}/index.ts` }
          : {
              types: `./dist/${component}/index.d.ts`,
              import: `./dist/${component}/index.js`,
              default: `./dist/${component}/index.js`,
            }
      );
    });
  }
});

describe('explicit Virtual List Web materialization boundary', () => {
  it('exports the opt-in Web subpath without pulling it into the portable root', () => {
    const manifest = JSON.parse(fs.readFileSync('packages/prototypes/base/package.json', 'utf8'));
    expect(manifest.exports['./virtual-list/web']).toEqual({
      types: './dist/virtual-list/web/index.d.ts',
      import: './dist/virtual-list/web/index.js',
      default: './dist/virtual-list/web/index.js',
    });
    expect(
      fs.readFileSync('packages/prototypes/base/src/virtual-list/web/index.ts', 'utf8')
    ).toContain('attachWebVirtualList');
    expect(
      fs.readFileSync('packages/prototypes/base/src/virtual-list/index.ts', 'utf8')
    ).not.toMatch(/(?:from|import)\s*['"]\.\/web/);
    expect(fs.readFileSync('packages/prototypes/base/src/index.ts', 'utf8')).not.toContain(
      'virtual-list/web'
    );
  });
});
