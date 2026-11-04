import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import canonicalCheckbox from '../../content/docs/demo_components/base-checkbox/demo-base-checkbox.demo';
import controlledCheckbox from '../../content/docs/zh-cn/demo-base-checkbox-controlled-states.demo';
import { buildDemoRegistry } from './demo-registry';
// Do not mock or replace this import: module initialization must collect the
// production ../../content/**/*.demo.ts glob, including every locale/subfolder.
import { getAvailableDemos, getDemoSourcePath, loadDemo } from './demo-modules';

// Independent filesystem inventory, not a production-exported list or a mock
// of import.meta.glob. Nested directories and every locale remain in scope.
function contentDemoPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return contentDemoPaths(path);
    return entry.isFile() && entry.name.endsWith('.demo.ts') ? [path] : [];
  });
}

describe('production demo registry', () => {
  it('initializes the full content registry and preserves both Checkbox recipes', async () => {
    const root = process.cwd();
    const expected = contentDemoPaths(resolve(root, 'apps/www/src/content'))
      .map((path) => {
        const sourcePath = relative(root, path).split('\\').join('/');
        const filename = sourcePath.split('/').pop()!;
        return [filename.slice(0, -'.demo.ts'.length), sourcePath] as const;
      })
      .sort(([a], [b]) => a.localeCompare(b));
    const actual = getAvailableDemos()
      .map((id) => [id, getDemoSourcePath(id)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    expect(actual).toEqual(expected);
    expect(getAvailableDemos()).toContain('demo-base-checkbox');
    expect(getAvailableDemos()).toContain('demo-base-checkbox-controlled-states');
    expect(getDemoSourcePath('demo-base-checkbox')).toBe(
      'apps/www/src/content/docs/demo_components/base-checkbox/demo-base-checkbox.demo.ts'
    );
    expect(getDemoSourcePath('demo-base-checkbox-controlled-states')).toBe(
      'apps/www/src/content/docs/zh-cn/demo-base-checkbox-controlled-states.demo.ts'
    );
    expect(await loadDemo('demo-base-checkbox')).toBe(canonicalCheckbox);
    expect(await loadDemo('demo-base-checkbox-controlled-states')).toBe(controlledCheckbox);
  });

  it.each(['demo-liquid-glass-button', 'demo-liquid-glass-select'])(
    'loads the unrelated %s recipe through the same production registry',
    async (demoId) => {
      expect(getAvailableDemos()).toContain(demoId);
      expect(await loadDemo(demoId)).toMatchObject({ type: 'demo' });
    }
  );

  it('rejects the original cross-directory duplicate basename instead of overwriting it', () => {
    const canonicalPath =
      '../../content/docs/demo_components/base-checkbox/demo-base-checkbox.demo.ts';
    const conflictingPath = '../../content/docs/zh-cn/demo-base-checkbox.demo.ts';
    const loaders = {
      [canonicalPath]: async () => ({ default: canonicalCheckbox }),
      [conflictingPath]: async () => ({ default: controlledCheckbox }),
    };
    expect(() => buildDemoRegistry(loaders)).toThrow(
      '[PrototypePreviewer] demo ID 冲突: "demo-base-checkbox"。\n' +
        '请确保 *.demo.ts 文件名唯一。\n' +
        `冲突文件: ${conflictingPath}`
    );
  });
});
