import { lstatSync, mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function parseConsumerArtifactArgs(argv, rootDir) {
  const options = { keep: false, help: false, workDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--keep') options.keep = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--work-dir') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--work-dir expects a path');
      if (options.workDir) throw new Error('--work-dir must be supplied only once');
      options.workDir = path.resolve(rootDir, value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function canonicalPath(value) {
  let ancestor = path.resolve(value);
  const remaining = [];
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
    remaining.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  return path.resolve(realpathSync(ancestor), ...remaining);
}

function outsideSource(directory, rootDir) {
  const output = canonicalPath(directory);
  const relative = path.relative(canonicalPath(rootDir), output);
  if (
    !relative ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  )
    throw new Error('Packed consumer artifacts must stay outside the source checkout');
  return output;
}

/** Reserve an owned output without replacing an earlier consumer or receipt. */
export function reserveConsumerArtifacts(options, { rootDir, prefix, temporaryRoot = tmpdir() }) {
  if (!options.workDir) {
    const parent = outsideSource(temporaryRoot, rootDir);
    mkdirSync(parent, { recursive: true });
    return mkdtempSync(path.join(parent, prefix));
  }
  const output = outsideSource(options.workDir, rootDir);
  mkdirSync(path.dirname(output), { recursive: true });
  mkdirSync(output);
  return output;
}
