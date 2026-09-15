import fs from 'node:fs/promises';
import path from 'node:path';

export type StyleOutput = { path: string; content: string };

async function existingStat(file: string) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function canonicalPath(file: string): Promise<string> {
  try {
    return await fs.realpath(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return path.join(await canonicalPath(path.dirname(file)), path.basename(file));
  }
}

/** Read-only preflight. Fold case conservatively, including on case-sensitive volumes. */
export async function validateStyleOutputPaths(files: readonly string[]) {
  const targets: { path: string; key: string; inode?: string }[] = [];
  for (const file of files) {
    if (typeof file !== 'string' || !file.trim()) throw new Error('Missing style output path');
    const absolute = path.resolve(file);
    const stat = await existingStat(absolute);
    if (stat && !stat.isFile()) {
      throw new Error(
        `Style output must be a regular file, not a symlink or directory: ${absolute}`
      );
    }
    const canonical = await canonicalPath(absolute);
    const key = canonical.normalize('NFC').toLowerCase();
    const inode = stat ? `${stat.dev}:${stat.ino}` : undefined;
    for (const previous of targets) {
      if (
        key === previous.key ||
        key.startsWith(previous.key + path.sep) ||
        previous.key.startsWith(key + path.sep) ||
        (inode && inode === previous.inode)
      ) {
        throw new Error(`Conflicting style output paths: ${previous.path} and ${absolute}`);
      }
    }
    targets.push({ path: absolute, key, inode });
  }
}

/** Stage a complete generation before replacement; recover caught failures, not crashes.
 * The IO seam is internal and exists to exercise failures at each write boundary. */
export async function writeStyleOutputSet(outputs: readonly StyleOutput[], io = fs) {
  await validateStyleOutputPaths(outputs.map((output) => output.path));
  const staged: {
    target: string;
    dir: string;
    next: string;
    backup?: string;
    replaced: boolean;
  }[] = [];
  let retainBackups = false;
  try {
    for (const output of outputs) {
      const target = path.resolve(output.path);
      await io.mkdir(path.dirname(target), { recursive: true });
      const dir = await io.mkdtemp(path.join(path.dirname(target), '.pui-style-'));
      const item = {
        target,
        dir,
        next: path.join(dir, 'next'),
        backup: undefined as string | undefined,
        replaced: false,
      };
      staged.push(item);
      const stat = await existingStat(target);
      if (stat) {
        item.backup = path.join(dir, 'previous');
        await io.copyFile(target, item.backup);
      }
      await io.writeFile(item.next, output.content, 'utf8');
      if (stat) await io.chmod(item.next, stat.mode & 0o777);
    }
    for (const item of staged) {
      await io.rename(item.next, item.target);
      item.replaced = true;
    }
  } catch (error) {
    const recoveryErrors: unknown[] = [];
    for (const item of [...staged].reverse()) {
      if (!item.replaced) continue;
      try {
        if (item.backup) await io.rename(item.backup, item.target);
        else await io.unlink(item.target);
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
    }
    if (recoveryErrors.length) {
      retainBackups = true;
      throw new AggregateError(
        [error, ...recoveryErrors],
        `Style output recovery incomplete; inspect retained staging/backups: ${staged.map((item) => item.dir).join(', ')}`
      );
    }
    throw error;
  } finally {
    if (!retainBackups) {
      // Only remove directories created by this invocation. Empty output parents may remain.
      const cleanup = await Promise.allSettled(
        staged.map((item) => io.rm(item.dir, { recursive: true, force: true }))
      );
      const failures = cleanup.flatMap((result, index) =>
        result.status === 'rejected' ? [staged[index].dir] : []
      );
      if (failures.length)
        console.warn(`[proto-ui] Could not remove staging directories: ${failures.join(', ')}`);
    }
  }
}
