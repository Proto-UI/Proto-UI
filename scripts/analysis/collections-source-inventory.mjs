import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Hash physical source paths, including names Git would quote in line-based output. */
export async function readCollectionsSourceInventory(cwd = process.cwd()) {
  const scope = ['packages', 'apps/www/src', 'scripts/analysis', 'spec'];
  const list = (...options) =>
    execFileSync('git', ['ls-files', '-z', ...options, '--', ...scope], {
      cwd,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
  const paths = [...new Set([...list(), ...list('--others', '--exclude-standard')])].sort();
  const digest = createHash('sha256');
  for (const file of paths) {
    digest.update(file + '\0');
    digest.update(await readFile(path.join(cwd, file)));
  }
  return { paths, sha256: digest.digest('hex') };
}
