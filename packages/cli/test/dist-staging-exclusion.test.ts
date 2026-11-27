import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectSourceFiles } from '../src/services/prototype-style-tokens';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length) {
    await rm(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('collectSourceFiles build-staging isolation', () => {
  it('excludes dist, dist.staging-*, and dist.previous-* directories while preserving src files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'proto-dist-staging-'));
    tempDirs.push(root);

    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'dist'), { recursive: true });
    await mkdir(path.join(root, 'dist.staging-12345-abcd1234'), { recursive: true });
    await mkdir(path.join(root, 'dist.previous-12345-efgh5678'), { recursive: true });

    const srcFile = path.join(root, 'src', 'button.proto.ts');
    await writeFile(srcFile, 'export const ok = true;\n');
    await writeFile(path.join(root, 'dist', 'button.proto.js'), 'export const built = true;\n');
    await writeFile(
      path.join(root, 'dist.staging-12345-abcd1234', 'button.proto.js'),
      'export const staged = true;\n'
    );
    await writeFile(
      path.join(root, 'dist.previous-12345-efgh5678', 'button.proto.js'),
      'export const backup = true;\n'
    );

    const files = await collectSourceFiles(root);
    expect(files).toEqual([srcFile]);
  });
});
