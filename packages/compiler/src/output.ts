import fs from 'node:fs';
import path from 'node:path';

export interface GeneratedArtifact {
  readonly destination: string;
  readonly content: string | Uint8Array;
}

function existingStat(file: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Check the leaf as well as every ancestor, including dangling symbolic links. */
function assertPlainPath(file: string): void {
  const absolute = path.resolve(file);
  const parts = absolute.slice(path.parse(absolute).root.length).split(path.sep).filter(Boolean);
  let current = path.parse(absolute).root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    const stat = existingStat(current);
    if (stat?.isSymbolicLink())
      throw new Error('Refusing a symbolic link in a generated output path: ' + current);
    if (stat && index < parts.length - 1 && !stat.isDirectory())
      throw new Error('Generated output ancestor is not a directory: ' + current);
  }
}

function sameFile(left: fs.Stats | undefined, right: fs.Stats): boolean {
  return !!left && left.dev === right.dev && left.ino === right.ino;
}

/**
 * Serialize compiler writers, prepare every byte before publication, and reserve new paths
 * with an atomic hard link. A concurrent no-overwrite invocation can never replace a winner.
 */
export function writeGeneratedArtifacts(
  outDir: string,
  artifacts: readonly GeneratedArtifact[],
  overwrite: boolean
): void {
  assertPlainPath(outDir);
  for (const artifact of artifacts) assertPlainPath(artifact.destination);
  fs.mkdirSync(outDir, { recursive: true });
  assertPlainPath(outDir);
  const lock = path.join(outDir, '.proto-compiler-write.lock');
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('Output collision: another compiler invocation is writing ' + outDir);
    throw error;
  }

  let staging: string | undefined;
  const published: { destination: string; identity: fs.Stats; backup?: string }[] = [];
  try {
    for (const artifact of artifacts) {
      assertPlainPath(artifact.destination);
      const existing = existingStat(artifact.destination);
      if (existing && !existing.isFile())
        throw new Error('Generated output is not a regular file: ' + artifact.destination);
      if (existing && !overwrite)
        throw new Error(
          'Output already exists; use --overwrite to replace generated artifacts: ' +
            artifact.destination
        );
    }
    staging = fs.mkdtempSync(path.join(outDir, '.proto-compiler-stage-'));
    const prepared = artifacts.map((artifact, index) => {
      const source = path.join(staging!, String(index));
      fs.writeFileSync(source, artifact.content, { flag: 'wx' });
      return { ...artifact, source, identity: fs.statSync(source) };
    });
    for (const artifact of prepared) {
      fs.mkdirSync(path.dirname(artifact.destination), { recursive: true });
      assertPlainPath(artifact.destination);
      let backup: string | undefined;
      if (overwrite && existingStat(artifact.destination)) {
        backup = artifact.source + '.previous';
        fs.linkSync(artifact.destination, backup);
      }
      if (overwrite) fs.renameSync(artifact.source, artifact.destination);
      else fs.linkSync(artifact.source, artifact.destination);
      published.push({ destination: artifact.destination, identity: artifact.identity, backup });
    }
  } catch (error) {
    for (const artifact of published.reverse()) {
      // Roll back only a path still owned by this transaction.
      if (!sameFile(existingStat(artifact.destination), artifact.identity)) continue;
      if (artifact.backup) fs.renameSync(artifact.backup, artifact.destination);
      else fs.unlinkSync(artifact.destination);
    }
    throw error;
  } finally {
    if (staging) fs.rmSync(staging, { recursive: true, force: true });
    fs.rmdirSync(lock);
  }
}
