// @vitest-environment node
import { mkdtemp, mkdir, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype, writeCompilation } from '../src/compile';

const temporary: string[] = [];
const source = `import {definePrototype} from '@proto.ui/core'; export default definePrototype({name:'fixture',setup(def){ const flag=def.state.bool('flag',false); def.expose.state('flag',flag); }});`;

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-compiler-delivery-'));
  temporary.push(root);
  const compilation = compilePrototype(source);
  if (!compilation.ok) throw new Error(JSON.stringify(compilation.diagnostics));
  return { directory: path.join(root, 'fresh'), compilation: compilation.value };
}

afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('transactional create-only compiler delivery', () => {
  it.each(['Component.tsx', 'provenance.json'])(
    'rolls back owned partial %s bytes and permits a clean retry',
    async (failingName) => {
      const { directory, compilation } = await fixture();
      const result = await writeCompilation(compilation, directory, async (filename) => {
        const handle = await open(filename, 'wx');
        return {
          async writeFile(contents) {
            if (path.basename(filename) === failingName) {
              await handle.writeFile(contents.slice(0, 16));
              throw Object.assign(new Error('Injected partial write: no space'), {
                code: 'ENOSPC',
              });
            }
            await handle.writeFile(contents);
          },
          async close() {
            await handle.close();
          },
        };
      });
      expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI3002' }] });
      await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
      const retry = await writeCompilation(compilation, directory);
      expect(retry.ok).toBe(true);
      expect(await readFile(path.join(directory, 'Component.tsx'), 'utf8')).toBe(
        compilation.output.code
      );
      expect(
        JSON.parse(await readFile(path.join(directory, 'provenance.json'), 'utf8')).profile
      ).toBe('react-runtime-v1');
    }
  );

  it('never overwrites or removes a pre-existing destination', async () => {
    const { directory, compilation } = await fixture();
    await mkdir(directory);
    await writeFile(path.join(directory, 'Component.tsx'), 'consumer edits');
    const result = await writeCompilation(compilation, directory);
    expect(result.ok).toBe(false);
    expect(await readFile(path.join(directory, 'Component.tsx'), 'utf8')).toBe('consumer edits');
    expect(await readdir(directory)).toEqual(['Component.tsx']);
  });

  it('does not unlink a file whose exclusive creation failed after directory reservation', async () => {
    const { directory, compilation } = await fixture();
    const result = await writeCompilation(compilation, directory, async (filename) => {
      await writeFile(filename, 'foreign collision', { flag: 'wx' });
      return open(filename, 'wx');
    });
    expect(result.ok).toBe(false);
    expect(await readFile(path.join(directory, 'Component.tsx'), 'utf8')).toBe('foreign collision');
    expect(await readdir(directory)).toEqual(['Component.tsx']);
  });

  it('rejects unsupported source before a caller has any artifact to deliver', () => {
    const rejected = compilePrototype(
      source.replace('const flag=', "fetch('https://example.invalid'); const flag=")
    );
    expect(rejected).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1004' }] });
    expect('value' in rejected).toBe(false);
  });
});
