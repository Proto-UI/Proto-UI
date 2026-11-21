import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { FINF_LEDGER } from './package-budget-policy.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => {
  throw new Error(`[package-budgets] ${message}`);
};

// Include the measurement implementation and resolution inputs as well as the
// package sources. An uncommitted local measurement is useful, but must never
// be presented as evidence of the named commit's clean tree.
export const BUDGET_SOURCE_SCOPE = Object.freeze([
  'packages',
  'scripts/analysis',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  FINF_LEDGER,
]);

export function captureBudgetSource(root) {
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const head = git(['rev-parse', 'HEAD']).trim();
  const tree = git(['rev-parse', 'HEAD^{tree}']).trim();
  const allStatus = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const sourceStatus = git([
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--',
    ...BUDGET_SOURCE_SCOPE,
  ]);
  const paths = [
    ...new Set(
      git([
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        ...BUDGET_SOURCE_SCOPE,
      ])
        .split('\0')
        .filter(Boolean)
    ),
  ].sort();
  if (!paths.length) fail('empty package measurement source inventory');
  const files = new Map(
    paths.map((path) => {
      const contents = readFileSync(resolve(root, path));
      return [path, { bytes: contents.length, sha256: sha256(contents) }];
    })
  );
  return {
    files,
    receipt: {
      head,
      tree,
      workingTreeClean: allStatus.length === 0,
      measuredSourceMatchesHead: sourceStatus.length === 0,
      scope: [...BUDGET_SOURCE_SCOPE],
      fileCount: files.size,
      fingerprintSha256: sha256(JSON.stringify([...files])),
      statusSha256: sha256(sourceStatus),
    },
  };
}

export function assertStableBudgetSource(before, after) {
  for (const snapshot of [before, after]) {
    if (
      !/^[a-f0-9]{40}$/.test(snapshot?.receipt?.head ?? '') ||
      !/^[a-f0-9]{40}$/.test(snapshot?.receipt?.tree ?? '') ||
      !/^[a-f0-9]{64}$/.test(snapshot?.receipt?.fingerprintSha256 ?? '') ||
      !/^[a-f0-9]{64}$/.test(snapshot?.receipt?.statusSha256 ?? '') ||
      !Number.isSafeInteger(snapshot?.receipt?.fileCount) ||
      snapshot.receipt.fileCount <= 0
    )
      fail('missing or invalid source stability receipt');
  }
  for (const key of ['head', 'tree', 'fileCount', 'fingerprintSha256', 'statusSha256']) {
    if (before?.receipt?.[key] !== after?.receipt?.[key]) {
      fail(`measurement source changed during the run (${key}); discard mixed-source results`);
    }
  }
}

export function assertBudgetCandidate(source, { requireClean = false, expectedSha } = {}) {
  const receipt = source?.receipt;
  if (expectedSha !== undefined) {
    if (!/^[a-f0-9]{40}$/.test(expectedSha)) fail('invalid expected candidate SHA');
    if (receipt?.head !== expectedSha)
      fail('budget source HEAD differs from the expected candidate SHA');
  }
  if (
    requireClean &&
    (receipt?.workingTreeClean !== true || receipt?.measuredSourceMatchesHead !== true)
  ) {
    fail('canonical package budgets require a clean candidate source tree');
  }
}

function packageOwner(path) {
  const parts = path.split('/');
  if (parts[0] !== 'packages') return parts.slice(0, 2).join('/');
  return parts
    .slice(0, ['adapters', 'modules', 'prototypes', 'spec'].includes(parts[1]) ? 3 : 2)
    .join('/');
}

// esbuild's bytesInOutput attribute minified bytes before compression. They
// explain retained code, not additive gzip costs. Keep complete input hashes
// so an investigator can reproduce a particular closure, including dead inputs.
export function describeBudgetClosure({ metafile, root, source }) {
  if (
    !metafile?.inputs ||
    !metafile?.outputs ||
    !Object.keys(metafile.inputs).length ||
    !Object.keys(metafile.outputs).length
  )
    fail('missing bundle dependency metadata');
  const retained = new Map();
  for (const output of Object.values(metafile.outputs)) {
    if (!output.inputs || !Number.isSafeInteger(output.bytes) || output.bytes <= 0) {
      fail('invalid bundle output dependency metadata');
    }
    for (const [path, info] of Object.entries(output.inputs)) {
      if (
        !Number.isSafeInteger(info.bytesInOutput) ||
        info.bytesInOutput < 0 ||
        !Object.hasOwn(metafile.inputs, path)
      )
        fail('invalid retained dependency measurement');
      retained.set(path, (retained.get(path) ?? 0) + info.bytesInOutput);
    }
  }
  const inputs = Object.entries(metafile.inputs)
    .map(([path, info]) => {
      const normalized = relative(root, resolve(root, path)).replaceAll('\\', '/');
      if (isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
        fail(`dependency escapes measured source tree: ${path}`);
      }
      const file = source.files.get(normalized);
      if (!file || file.bytes !== info.bytes)
        fail(`dependency is not bound to captured source: ${path}`);
      return {
        path: normalized,
        sourceBytes: file.bytes,
        sourceSha256: file.sha256,
        retainedBytes: retained.get(path) ?? 0,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const groups = new Map();
  for (const input of inputs) {
    const name = packageOwner(input.path);
    groups.set(name, (groups.get(name) ?? 0) + input.retainedBytes);
  }
  const contributions = [...groups]
    .map(([path, retainedBytes]) => ({ path, retainedBytes }))
    .sort((a, b) => b.retainedBytes - a.retainedBytes || a.path.localeCompare(b.path));
  return {
    attributionUnit: 'minified bytes before gzip; gzip contributions are not additive',
    inputCount: inputs.length,
    retainedInputCount: inputs.filter((input) => input.retainedBytes > 0).length,
    fingerprintSha256: sha256(JSON.stringify(inputs)),
    contributions,
    inputs,
  };
}
