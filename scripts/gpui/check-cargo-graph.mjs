import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inspectGpuiCargoGraph } from './lib/cargo-graph.mjs';

const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const name = process.argv[index];
  if (name === '--offline') {
    options.offline = true;
    continue;
  }
  if (!['--manifest-path', '--git', '--rev', '--toolchain', '--output'].includes(name)) {
    throw new Error(`Unknown option ${name}.`);
  }
  const value = process.argv[++index];
  if (!value || value.startsWith('--') || options[name] !== undefined) {
    throw new Error(`Provide one value for ${name}.`);
  }
  options[name] = value;
}
if (!options['--manifest-path'] || !options['--git'] || !options['--rev']) {
  throw new Error(
    'Usage: node scripts/gpui/check-cargo-graph.mjs --manifest-path <Cargo.toml> --git <GPUI source URL> --rev <full revision> [--toolchain <version>] [--offline] [--output <receipt.json>]'
  );
}
if (!/^[a-f0-9]{40}$/.test(options['--rev'])) {
  throw new Error('Provide a full lowercase GPUI revision before resolving dependencies.');
}
const cargo = process.env.CARGO ?? 'cargo';
const toolchain = options['--toolchain'] ? [`+${options['--toolchain']}`] : [];
const command = [
  ...toolchain,
  'metadata',
  '--format-version',
  '1',
  '--locked',
  '--all-features',
  '--manifest-path',
  path.resolve(options['--manifest-path']),
  ...(options.offline ? ['--offline'] : []),
];
// Never fall back to --no-deps, a lockfile string scan, or a successful skip.
// No --filter-platform means Cargo resolves dependencies for every target;
// feature unification is the all-features resolution, not every feature matrix.
function runCargo(args) {
  const result = spawnSync(cargo, args, {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 || result.error) {
    throw Object.assign(
      new Error(result.error?.message ?? `Cargo exited with status ${result.status}.`),
      {
        exitCode: result.status,
        signal: result.signal,
        stderr: result.stderr,
      }
    );
  }
  return result.stdout;
}
let cargoVersion = null;
let metadataText;
let result;
let stage = 'cargo-version';
try {
  cargoVersion = runCargo([...toolchain, '--version', '--verbose']).trim();
  stage = 'cargo-metadata';
  metadataText = runCargo(command);
  stage = 'graph-inspection';
  result = inspectGpuiCargoGraph(JSON.parse(metadataText), {
    git: options['--git'],
    revision: options['--rev'],
  });
} catch (error) {
  // A missing toolchain, stale lock or unavailable dependency leaves explicit
  // failed evidence. It cannot acquire a graph digest or a successful skip.
  result = {
    ok: false,
    errors: [`${stage}: ${error.message}`],
    failure: {
      stage,
      exitCode: error.exitCode ?? null,
      signal: error.signal ?? null,
      stderr: error.stderr ?? null,
    },
  };
}
const receipt = {
  schemaVersion: 1,
  kind: 'locked-cargo-resolve-graph',
  cargoVersion,
  command,
  scope:
    'all features of workspace members, unfiltered targets; external features follow Cargo resolution; not compilation or OS input',
  metadataSha256:
    metadataText === undefined ? null : createHash('sha256').update(metadataText).digest('hex'),
  ...result,
};
if (options['--output']) {
  const output = path.resolve(options['--output']);
  mkdirSync(path.dirname(output), { recursive: true });
  if (metadataText !== undefined)
    writeFileSync(`${output}.metadata.json`, metadataText, { flag: 'wx' });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
