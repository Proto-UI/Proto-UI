import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inspectGpuiCargoGraph, resolveGpuiCargoExpectations } from './lib/cargo-graph.mjs';
import { GPUI_PROFILE_SOURCE } from '../../packages/compiler/src/gpui-dependency.ts';

const options = {};
const sourceOptions = ['--git', '--rev', '--registry', '--version'];
const platformOptions = [
  '--platform-git',
  '--platform-rev',
  '--platform-registry',
  '--platform-version',
];
for (let index = 2; index < process.argv.length; index++) {
  const name = process.argv[index];
  if (name === '--offline') {
    options.offline = true;
    continue;
  }
  if (
    ![
      '--manifest-path',
      '--profile',
      '--toolchain',
      '--output',
      ...sourceOptions,
      ...platformOptions,
    ].includes(name)
  ) {
    throw new Error(`Unknown option ${name}.`);
  }
  const value = process.argv[++index];
  if (!value || value.startsWith('--') || options[name] !== undefined) {
    throw new Error(`Provide one value for ${name}.`);
  }
  options[name] = value;
}
if (!options['--manifest-path']) {
  throw new Error(
    'Usage: node scripts/gpui/check-cargo-graph.mjs --manifest-path <Cargo.toml> (--profile gpui-source-v1 | --git <URL> --rev <full revision> | --registry <index URL> --version <exact version>) [--platform-git <URL> --platform-rev <full revision> | --platform-registry <index URL> --platform-version <exact version>] [--toolchain <version>] [--offline] [--output <receipt.json>]'
  );
}
function selectedSource(prefix = '') {
  const git = options[`--${prefix}git`];
  const revision = options[`--${prefix}rev`];
  const registry = options[`--${prefix}registry`];
  const version = options[`--${prefix}version`];
  const hasGit = git !== undefined || revision !== undefined;
  const hasRegistry = registry !== undefined || version !== undefined;
  if (hasGit && hasRegistry) {
    throw new Error(`Select either ${prefix}Git or ${prefix}registry options, not both.`);
  }
  if (hasGit) return { kind: 'git', git, revision };
  if (hasRegistry) return { kind: 'registry', registry, version };
}
let source;
if (options['--profile'] !== undefined) {
  if (options['--profile'] !== 'gpui-source-v1') {
    throw new Error(
      'Only the existing gpui-source-v1 profile is available; no future release is admitted.'
    );
  }
  if ([...sourceOptions, ...platformOptions].some((name) => options[name] !== undefined)) {
    throw new Error('Select a profile or explicit source options, not both.');
  }
  source = GPUI_PROFILE_SOURCE;
} else {
  source = selectedSource();
}
if (!source)
  throw new Error(
    'Select --profile, --git/--rev or --registry/--version before resolving dependencies.'
  );
const platformSource = selectedSource('platform-');
const graphOptions = {
  source,
  ...(platformSource ? { platformSource, requirePlatform: true } : {}),
};
const expectations = resolveGpuiCargoExpectations(graphOptions);
// Cargo discovers .cargo/config.toml from its working directory and ancestors,
// not from --manifest-path alone. Resolve caller-relative paths before selecting
// the consumer directory so its registry configuration and workspace ancestors
// are honored without relocating the caller's evidence output.
const manifestPath = path.resolve(options['--manifest-path']);
const cargoDirectory = path.dirname(manifestPath);
const outputPath = options['--output'] ? path.resolve(options['--output']) : undefined;
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
  manifestPath,
  ...(options.offline ? ['--offline'] : []),
];
// Never fall back to --no-deps, a lockfile string scan, or a successful skip.
// No --filter-platform means Cargo resolves dependencies for every target;
// feature unification is the all-features resolution, not every feature matrix.
function runCargo(args) {
  const result = spawnSync(cargo, args, {
    cwd: cargoDirectory,
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
  result = inspectGpuiCargoGraph(JSON.parse(metadataText), graphOptions);
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
  cwd: cargoDirectory,
  command,
  scope:
    'all features of workspace members, unfiltered targets; external features follow Cargo resolution; not compilation or OS input',
  metadataSha256:
    metadataText === undefined ? null : createHash('sha256').update(metadataText).digest('hex'),
  ...expectations,
  ...result,
};
if (outputPath) {
  const output = outputPath;
  mkdirSync(path.dirname(output), { recursive: true });
  if (metadataText !== undefined)
    writeFileSync(`${output}.metadata.json`, metadataText, { flag: 'wx' });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
