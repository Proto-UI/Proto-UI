import fs from 'node:fs/promises';
import path from 'node:path';

export type StyleOutput = { path: string; content: string };

async function existingStat(file: string, io: Pick<typeof fs, 'lstat'> = fs) {
  try {
    return await io.lstat(file, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function canonicalPath(file: string, io: Pick<typeof fs, 'realpath'> = fs): Promise<string> {
  try {
    return await io.realpath(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return path.join(await canonicalPath(path.dirname(file), io), path.basename(file));
  }
}

/** Read-only preflight. Fold case conservatively, including on case-sensitive volumes. */
export async function validateStyleOutputPaths(
  files: readonly string[],
  io: Pick<typeof fs, 'lstat' | 'realpath'> = fs
) {
  const targets: { path: string; key: string; inode?: string; size?: bigint }[] = [];
  for (const file of files) {
    if (typeof file !== 'string' || !file.trim()) throw new Error('Missing style output path');
    const absolute = path.resolve(file);
    const stat = await existingStat(absolute, io);
    if (stat && !stat.isFile()) {
      throw new Error(
        `Style output must be a regular file, not a symlink or directory: ${absolute}`
      );
    }
    const canonical = await canonicalPath(absolute, io);
    const key = canonical.normalize('NFC').toLowerCase();
    // Some Windows volumes report unreliable inode values (zero or shared
    // across distinct files). Treat zero as unknown, and require matching
    // size before calling two paths hard-link aliases: linked entries always
    // share one physical size. Use BigInt lstat so 64-bit FUSE/overlay inodes
    // above Number.MAX_SAFE_INTEGER never collide after float rounding.
    const inode = stat && stat.ino !== 0n ? `${stat.dev}:${stat.ino}` : undefined;
    const size = stat?.size;
    for (const previous of targets) {
      if (
        key === previous.key ||
        key.startsWith(previous.key + path.sep) ||
        previous.key.startsWith(key + path.sep) ||
        (inode !== undefined && inode === previous.inode && size === previous.size)
      ) {
        throw new Error(`Conflicting style output paths: ${previous.path} and ${absolute}`);
      }
    }
    targets.push({ path: absolute, key, inode, size });
  }
}

/** Stage a complete generation before replacement; recover caught failures, not crashes.
 * The IO seam is internal and exists to exercise failures at each write boundary. */
export async function writeStyleOutputSet(outputs: readonly StyleOutput[], io = fs) {
  await validateStyleOutputPaths(
    outputs.map((output) => output.path),
    io
  );
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
      const stat = await existingStat(target, io);
      if (stat) {
        item.backup = path.join(dir, 'previous');
        await io.copyFile(target, item.backup);
      }
      await io.writeFile(item.next, output.content, 'utf8');
      if (stat) await io.chmod(item.next, Number(stat.mode & 0o777n));
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
