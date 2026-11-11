import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { getAllPackages, ROOT_DIR } from './lib.mjs';

// Parent-run evidence entry point. Nothing executes merely by preparing this file.
// The outer process supplies an owned container; the inner process uses actual
// release tarballs and a consumer outside the repository's resolution ancestry.
const argv = process.argv.slice(2);
const inside = argv.includes('--inside');
const options = new Map();
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--inside') continue;
  assert(argv[index].startsWith('--') && argv[index + 1], 'expected --option value');
  options.set(argv[index].slice(2), argv[++index]);
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const childEnv = { ...process.env };
for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'TSX_TSCONFIG_PATH']) delete childEnv[key];
for (const key of Object.keys(childEnv)) {
  if (key.startsWith('GIT_')) delete childEnv[key];
}
Object.assign(childEnv, {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_NO_LAZY_FETCH: '1',
});
// A bounded child heap is independent of package resolution; no inherited
// loader, workspace alias or user NODE_OPTIONS enters any evidence process.
childEnv.NODE_OPTIONS = '--max-old-space-size=4096';
const steps = [];
let logDirectory;

function command(label, executable, args, cwd, timeout = 180000, input) {
  const stdoutPath = join(logDirectory, `${label}.stdout.log`);
  const stderrPath = join(logDirectory, `${label}.stderr.log`);
  const stdout = openSync(stdoutPath, 'wx', 0o600);
  const stderr = openSync(stderrPath, 'wx', 0o600);
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = spawnSync(executable, args, {
      cwd,
      env: childEnv,
      stdio: [input === undefined ? 'ignore' : 'pipe', stdout, stderr],
      input,
      timeout,
      killSignal: 'SIGKILL',
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  const receipt = {
    label,
    executable,
    args,
    cwd,
    timeout,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
    stdout: stdoutPath,
    stderr: stderrPath,
    stdoutBytes: lstatSync(stdoutPath).size,
    stderrBytes: lstatSync(stderrPath).size,
    classification:
      result.error?.code === 'ETIMEDOUT'
        ? 'deadline'
        : result.error
          ? 'spawn-error'
          : result.signal
            ? 'signal'
            : result.status === 0
              ? 'passed'
              : 'nonzero-exit',
  };
  const failed = result.error || result.status !== 0;
  if (failed) {
    const detailPath = ['owned-udocker-run', 'container-run'].includes(label)
      ? join(dirname(logDirectory), 'evidence', 'execution.json')
      : [
            'packed-consumer',
            'corrected-packed-consumer',
            'repaired-static-module-consumer',
          ].includes(label)
        ? join(dirname(logDirectory), 'consumer-observations.json')
        : null;
    if (detailPath) {
      receipt.detailReport = { path: detailPath, exists: existsSync(detailPath) };
      if (receipt.detailReport.exists) {
        try {
          const detailBytes = readFileSync(detailPath);
          const detail = JSON.parse(detailBytes.toString('utf8'));
          receipt.detailReport.sha256 = digest(detailBytes);
          receipt.detailReport.complete = detail.complete;
          receipt.detailReport.failures = (detail.phases ?? detail.results ?? [])
            .filter((row) => row.status !== 'passed')
            .map((row) => ({ id: row.id, status: row.status, error: row.error }));
        } catch (error) {
          receipt.detailReport.readError = String(error?.message ?? error);
        }
      }
    }
  }
  steps.push(receipt);
  json(join(logDirectory, 'commands.json'), steps);
  if (failed) {
    const details = receipt.detailReport
      ? `; result details ${receipt.detailReport.path}; failed phases/probes ${(receipt.detailReport.failures ?? []).map((row) => row.id).join(', ')}`
      : '';
    const error = new Error(
      `${label} failed (${receipt.classification}, status ${result.status}, signal ${result.signal}); stdout ${stdoutPath}; stderr ${stderrPath}${details}`,
      { cause: result.error }
    );
    error.commandReceipt = receipt;
    throw error;
  }
  return readFileSync(stdoutPath, 'utf8');
}

function contained(root, path) {
  const rel = relative(root, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function files(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const name = join(prefix, entry.name);
      const path = join(root, name);
      assert(!entry.isSymbolicLink(), `unexpected package symlink: ${path}`);
      return entry.isDirectory() ? files(root, name) : [name];
    })
    .sort();
}

function dependencyClosure(packages, roots) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const selected = new Set();
  const visit = (name) => {
    if (selected.has(name)) return;
    const pkg = byName.get(name);
    assert(pkg, `missing public package ${name}`);
    selected.add(name);
    for (const dependency of pkg.internalDeps) visit(dependency);
  };
  roots.forEach(visit);
  return [...selected].sort();
}

function prepareGitMetadata(snapshot, sourceHead, sourceTree, sourceBranch) {
  const directory = join(snapshot, 'git-metadata');
  const template = join(dirname(snapshot), 'git-template-empty');
  mkdirSync(template);
  const sourceGit = (label, args) => command(label, 'git', args, ROOT_DIR);
  const indexPath = resolve(
    ROOT_DIR,
    sourceGit('source-index-path', ['rev-parse', '--git-path', 'index']).trim()
  );
  const indexStat = lstatSync(indexPath);
  assert(
    indexStat.isFile() && indexStat.uid === process.getuid(),
    'source index is not owned regular metadata'
  );
  const indexInitial = readFileSync(indexPath);
  const entries = sourceGit('source-index-entries', ['ls-files', '--stage', '-z']);
  const objectFormat = sourceGit('source-object-format', [
    'rev-parse',
    '--show-object-format',
  ]).trim();
  command(
    'portable-git-init',
    'git',
    ['init', '--bare', `--object-format=${objectFormat}`, `--template=${template}`, directory],
    ROOT_DIR
  );
  // This public identity is newly configured for deriveRepositoryId. No source
  // config, credential helper, remote settings, hooks or reflogs are copied.
  writeFileSync(
    join(directory, 'config'),
    '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = false\n[remote "origin"]\n\turl = https://github.com/Proto-UI/Proto-UI.git\n'
  );
  const portableGit = (label, args, input) =>
    command(
      label,
      'git',
      [
        '--git-dir',
        directory,
        '--work-tree',
        join(snapshot, 'tree'),
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'gc.auto=0',
        '-c',
        'maintenance.auto=false',
        ...args,
      ],
      ROOT_DIR,
      180000,
      input
    );
  portableGit('portable-git-fetch', [
    '-c',
    'protocol.file.allow=always',
    'fetch',
    '--depth=1',
    '--no-tags',
    '--no-write-fetch-head',
    '--no-recurse-submodules',
    pathToFileURL(ROOT_DIR).href,
    sourceHead,
  ]);
  portableGit('portable-git-branch', ['update-ref', `refs/heads/${sourceBranch}`, sourceHead]);
  portableGit('portable-git-head', ['symbolic-ref', 'HEAD', `refs/heads/${sourceBranch}`]);
  const blobIds = [
    ...new Set(
      entries
        .split('\0')
        .filter(Boolean)
        .flatMap((entry) => {
          const match = /^([0-9]{6}) ([a-f0-9]+) [0-3]\t/.exec(entry);
          assert(match, 'invalid source index entry');
          return match[1] === '160000' ? [] : [match[2]];
        })
    ),
  ];
  const availability = portableGit(
    'portable-index-object-readback',
    ['cat-file', '--batch-check'],
    `${blobIds.join('\n')}\n`
  );
  const missing = availability
    .trim()
    .split('\n')
    .filter((line) => line.endsWith(' missing'))
    .map((line) => line.split(' ')[0]);
  if (missing.length > 0) {
    command(
      'source-index-extra-objects',
      'git',
      ['pack-objects', '--stdout'],
      ROOT_DIR,
      180000,
      `${missing.join('\n')}\n`
    );
    portableGit(
      'portable-index-extra-objects',
      ['index-pack', '--stdin'],
      readFileSync(join(logDirectory, 'source-index-extra-objects.stdout.log'))
    );
  }
  const finalEntries = sourceGit('source-index-final-entries', ['ls-files', '--stage', '-z']);
  assert.equal(finalEntries, entries, 'source staged entries changed during metadata export');
  const indexAdmitted = readFileSync(indexPath);
  writeFileSync(join(directory, 'index'), indexAdmitted, { mode: indexStat.mode & 0o777 });
  const sharedPath = sourceGit('source-shared-index-path', [
    'rev-parse',
    '--shared-index-path',
  ]).trim();
  if (sharedPath) {
    const shared = resolve(ROOT_DIR, sharedPath);
    const name = shared.split(sep).at(-1);
    assert(/^sharedindex\.[a-f0-9]+$/.test(name));
    cpSync(shared, join(directory, name));
  }
  assert.equal(sourceGit('source-head-final', ['rev-parse', 'HEAD']).trim(), sourceHead);
  assert.equal(sourceGit('source-tree-final', ['rev-parse', 'HEAD^{tree}']).trim(), sourceTree);
  assert.equal(sourceGit('source-branch-final', ['branch', '--show-current']).trim(), sourceBranch);
  assert.equal(portableGit('portable-head-readback', ['rev-parse', 'HEAD']).trim(), sourceHead);
  assert.equal(
    portableGit('portable-tree-readback', ['rev-parse', 'HEAD^{tree}']).trim(),
    sourceTree
  );
  assert.equal(
    portableGit('portable-branch-readback', ['branch', '--show-current']).trim(),
    sourceBranch
  );
  assert.equal(portableGit('portable-index-readback', ['ls-files', '--stage', '-z']), entries);
  assert(
    !existsSync(join(directory, 'objects/info/alternates')),
    'portable metadata must not depend on shared object storage'
  );
  const members = files(directory).map((path) => {
    assert(
      ['HEAD', 'config', 'index', 'shallow'].includes(path) ||
        path.startsWith('objects/') ||
        path.startsWith('refs/heads/') ||
        /^sharedindex\.[a-f0-9]+$/.test(path),
      `unexpected Git metadata role: ${path}`
    );
    const bytes = readFileSync(join(directory, path));
    return {
      path,
      bytes: bytes.length,
      mode: lstatSync(join(directory, path)).mode & 0o777,
      sha256: digest(bytes),
    };
  });
  // This role describes the new Git configuration, not the contents of the
  // exact tracked objects/index retained in this separately mounted metadata.
  return {
    role: 'credential-free-real-git-metadata',
    directory: 'git-metadata',
    head: sourceHead,
    tree: sourceTree,
    branch: sourceBranch,
    objectFormat,
    shallow:
      portableGit('portable-shallow-readback', ['rev-parse', '--is-shallow-repository']).trim() ===
      'true',
    shallowBoundary: existsSync(join(directory, 'shallow'))
      ? readFileSync(join(directory, 'shallow'), 'utf8').trim().split('\n')
      : [],
    index: {
      initialRawSha256: digest(indexInitial),
      admittedRawSha256: digest(indexAdmitted),
      semanticSha256: digest(entries),
      entries: entries.split('\0').filter(Boolean).length,
      extraBlobObjects: missing.length,
      boundary:
        'Raw cache bytes may refresh; complete staged mode/blob/stage/path entries must remain identical.',
    },
    identity:
      'New canonical public origin only; source Git configuration, credential-helper settings, remote settings, hooks and reflogs are not copied. Exact tracked objects/index are retained; no new commit or canonical-origin fetch.',
    members,
  };
}

function copyConsumerSources(repository, consumer) {
  return ['hook-closeout.mjs', 'hook-closeout.types.ts', 'hook-closeout.proto.ts'].map((name) => {
    const source = join(
      repository,
      'scripts/release/consumer-smoke',
      name.endsWith('.ts') ? `${name}.txt` : name
    );
    const bytes = readFileSync(source);
    cpSync(source, join(consumer, name));
    assert.equal(digest(readFileSync(join(consumer, name))), digest(bytes));
    return { path: name, sha256: digest(bytes), bytes: bytes.length };
  });
}

function retainedPackageReadback() {
  const root = '/retained';
  const binding = JSON.parse(
    readFileSync(join(root, 'evidence/package-export-binding.json'), 'utf8')
  );
  const installed = [];
  for (const pkg of binding.packages) {
    assert.equal(
      digest(readFileSync(join(root, 'evidence/release', pkg.tarball))),
      pkg.tarballSha256,
      pkg.tarball
    );
    const packageRoot = join(root, 'work/consumer/node_modules', pkg.name);
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.version, pkg.version, pkg.name);
    assert.deepEqual(manifest.exports, pkg.exports, pkg.name);
    for (const file of pkg.files)
      assert.equal(
        digest(readFileSync(join(packageRoot, file.path))),
        file.sha256,
        `${pkg.name}/${file.path}`
      );
    installed.push({
      name: pkg.name,
      files: files(packageRoot).map((path) => ({
        path,
        sha256: digest(readFileSync(join(packageRoot, path))),
      })),
    });
  }
  return {
    packages: binding.packages.length,
    bindingSha256: digest(readFileSync(join(root, 'evidence/package-export-binding.json'))),
    manifestSha256: digest(readFileSync(join(root, 'evidence/release/pack-manifest.json'))),
    lockSha256: digest(readFileSync(join(root, 'work/consumer/package-lock.json'))),
    installedMembershipSha256: digest(JSON.stringify(installed)),
  };
}

async function runInside() {
  assert.match(process.version, /^v24\./, 'the real container entry must run on Node24');
  assert(!process.env.NODE_PATH && !process.env.NODE_OPTIONS, 'consumer isolation environment');
  logDirectory = '/evidence/logs';
  mkdirSync(logDirectory, { recursive: true });
  const report = {
    schemaVersion: 1,
    kind: 'issue-1154-current-container-execution',
    evidenceClass: 'new-current-source-evidence; never historical recovery',
    source: JSON.parse(readFileSync('/source/source-binding.json', 'utf8')),
    node: {
      version: process.version,
      executable: process.execPath,
      executableSha256: digest(readFileSync(process.execPath)),
      uid: process.getuid(),
      uidMeaning: 'runtime-reported; PRoot uid0 is emulated, not host privilege',
    },
    phases: [],
    complete: false,
    nativeBrowserAcceptance: 'not-exercised; actual WC Adapter on pinned happy-dom',
    historicalGenericContractAcceptance: 'not-established',
    scope: options.get('scope') ?? 'full-preparation',
  };
  const phase = async (id, action) => {
    const row = { id, status: 'running', startedAt: new Date().toISOString() };
    report.phases.push(row);
    try {
      await action();
      row.status = 'passed';
    } catch (error) {
      row.status = 'failed';
      row.error = String(error?.stack ?? error);
      if (error?.commandReceipt) row.command = error.commandReceipt;
    }
    row.finishedAt = new Date().toISOString();
    json('/evidence/execution.json', report);
    return row.status === 'passed';
  };
  try {
    const copied = await phase('exact-source-copy', () => {
      for (const entry of report.source.members) {
        const input = join('/source/tree', entry.path);
        const target = join('/work/repo', entry.path);
        mkdirSync(dirname(target), { recursive: true });
        if (entry.kind === 'symlink') {
          assert.equal(readlinkSync(input), entry.target);
          symlinkSync(entry.target, target);
        } else {
          assert.equal(digest(readFileSync(input)), entry.sha256, entry.path);
          cpSync(input, target, { preserveTimestamps: true });
        }
      }
    });
    if (!copied) return;
    const repository = '/work/repo';
    const metadataReady = await phase('exact-git-metadata-copy', () => {
      const metadata = report.source.gitMetadata;
      assert(
        metadata?.role === 'credential-free-real-git-metadata',
        'actual Git metadata is required'
      );
      for (const member of metadata.members) {
        const input = join('/source', metadata.directory, member.path);
        const target = join(repository, '.git', member.path);
        const bytes = readFileSync(input);
        assert.equal(digest(bytes), member.sha256, member.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bytes, { mode: member.mode });
      }
      const observed = {
        head: command('git-head-readback', 'git', ['rev-parse', 'HEAD'], repository).trim(),
        tree: command('git-tree-readback', 'git', ['rev-parse', 'HEAD^{tree}'], repository).trim(),
        branch: command(
          'git-branch-readback',
          'git',
          ['branch', '--show-current'],
          repository
        ).trim(),
        semanticIndexSha256: digest(
          command('git-index-readback', 'git', ['ls-files', '--stage', '-z'], repository)
        ),
      };
      assert.equal(observed.head, metadata.head);
      assert.equal(observed.tree, metadata.tree);
      assert.equal(observed.branch, metadata.branch);
      assert.equal(observed.semanticIndexSha256, metadata.index.semanticSha256);
      report.gitMetadataReadback = observed;
    });
    if (!metadataReady) return;
    const runtimeReady = await phase('actual-container-tool-identities', () => {
      report.tools = {
        git: command('tool-git', 'git', ['--version'], repository).trim(),
        npm: command('tool-npm', 'npm', ['--version'], repository).trim(),
        corepack: command('tool-corepack', 'corepack', ['--version'], repository).trim(),
      };
    });
    if (!runtimeReady) return;
    if (['correction-r2', 'fixture-repair'].includes(report.scope)) {
      const fixtureRepair = report.scope === 'fixture-repair';
      const reuseReady = await phase('retained-inputs-and-corrected-source-binding', () => {
        const reuse = report.source.reuse;
        assert(reuse, 'retained-input execution requires the explicit prior-run role');
        for (const input of reuse.receipts)
          assert.equal(
            digest(readFileSync(join('/retained', input.path))),
            input.sha256,
            input.path
          );
        const prior = JSON.parse(readFileSync('/retained/evidence/execution.json', 'utf8'));
        for (const id of ['real-package-pack-and-consumer-install', 'actual-packed-cli-init-add']) {
          assert(
            prior.phases.some((row) => row.id === id && row.status === 'passed'),
            `missing actual retained prerequisite ${id}`
          );
        }
        const isPackageInput = (path) =>
          path.startsWith('packages/') ||
          path.startsWith('scripts/build/') ||
          ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'VERSION', '.npmrc'].includes(
            path
          );
        const priorInputs = prior.source.members.filter((member) => isPackageInput(member.path));
        assert.deepEqual(
          report.source.members.filter((member) => isPackageInput(member.path)),
          priorInputs,
          'retained packages must not certify different package source'
        );
        report.retainedPackageBefore = retainedPackageReadback();
        mkdirSync('/work/consumer');
        for (const name of ['package.json', 'package-lock.json', 'tsconfig.json'])
          cpSync(join('/retained/work/consumer', name), join('/work/consumer', name));
        cpSync('/retained/work/consumer/proto-ui', '/work/consumer/proto-ui', { recursive: true });
        symlinkSync('/retained/work/consumer/node_modules', '/work/consumer/node_modules', 'dir');
        if (!fixtureRepair) {
          symlinkSync('/retained/work/repo/node_modules', join(repository, 'node_modules'), 'dir');
          // Corepack cache metadata is writable, so copy its exact retained cache
          // into the new run rather than allowing writes into the old run.
          cpSync('/retained/work/corepack', '/work/corepack', { recursive: true });
          childEnv.COREPACK_ENABLE_NETWORK = '0';
        }
        report.consumerSource = copyConsumerSources(repository, '/work/consumer');
        report.reusedInput = reuse;
      });
      if (!reuseReady) return;
      if (fixtureRepair) {
        await phase('repaired-static-module-declarations', () => {
          command(
            'repaired-static-module-consumer',
            process.execPath,
            [
              '--import',
              'tsx',
              'hook-closeout.mjs',
              '/evidence/consumer-observations.json',
              'static-module-declarations',
            ],
            '/work/consumer'
          );
        });
      } else {
        await phase('corrected-public-generic-probes', () => {
          command(
            'corrected-packed-consumer',
            process.execPath,
            [
              '--import',
              'tsx',
              'hook-closeout.mjs',
              '/evidence/consumer-observations.json',
              'current-public-legacy-defineHook',
              'unchanged-authored-raw-value-tuple-once',
            ],
            '/work/consumer'
          );
        });
        await phase('corrected-packed-generic-type-boundary', () => {
          command(
            'corrected-packed-types',
            process.execPath,
            ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
            '/work/consumer'
          );
        });
        await phase('check:agent-operations-with-real-git', () => {
          command(
            'git-dependent-agent-operations',
            'corepack',
            ['pnpm@10.32.1', '-s', 'check:agent-operations'],
            repository,
            900000
          );
        });
      }
      await phase('retained-package-and-index-readback', () => {
        report.retainedPackageAfter = retainedPackageReadback();
        assert.deepEqual(report.retainedPackageAfter, report.retainedPackageBefore);
        report.gitIndexAfter = digest(
          command('git-index-after-check', 'git', ['ls-files', '--stage', '-z'], repository)
        );
        assert.equal(report.gitIndexAfter, report.source.gitMetadata.index.semanticSha256);
      });
      return;
    }
    const pnpm = (...args) =>
      command(`pnpm-${steps.length}`, 'corepack', ['pnpm@10.32.1', ...args], repository, 900000);
    const installed = await phase('locked-workspace-install', () => {
      assert.equal(pnpm('--version').trim(), '10.32.1');
      pnpm('install', '--frozen-lockfile');
    });
    if (!installed) return;
    const packed = await phase('real-package-pack-and-consumer-install', () => {
      // Select from the exact read-only source manifests, never workspace aliases.
      const names = dependencyClosure(getAllPackages(), [
        '@proto.ui/cli',
        '@proto.ui/core',
        '@proto.ui/adapter-web-component',
        '@proto.ui/prototypes-base',
      ]);
      command(
        'release-pack',
        process.execPath,
        [
          join(repository, 'scripts/release/publish.mjs'),
          '--pack',
          '--only',
          names.join(','),
          '--out-dir',
          '/evidence/release',
        ],
        repository,
        1200000
      );
      const manifest = JSON.parse(readFileSync('/evidence/release/pack-manifest.json', 'utf8'));
      assert.deepEqual(manifest.packages.map((entry) => entry.name).sort(), names);
      mkdirSync('/work/consumer');
      const dependencies = Object.fromEntries(
        manifest.packages.map((entry) => [
          entry.name,
          `file:${join('/evidence/release', entry.tarball)}`,
        ])
      );
      json('/work/consumer/package.json', {
        name: 'issue-1154-packed-consumer',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: {
          ...dependencies,
          '@happy-dom/global-registrator': '15.11.7',
          'happy-dom': '15.11.7',
          typescript: '5.9.3',
          tsx: '4.21.0',
        },
      });
      command(
        'consumer-install',
        'npm',
        ['install', '--no-audit', '--no-fund'],
        '/work/consumer',
        600000
      );
      const packageBindings = [];
      const lock = JSON.parse(readFileSync('/work/consumer/package-lock.json', 'utf8'));
      for (const entry of manifest.packages) {
        const installedRoot = join('/work/consumer/node_modules', entry.name);
        assert(contained('/work/consumer', realpathSync(installedRoot)), entry.name);
        const installedManifest = JSON.parse(
          readFileSync(join(installedRoot, 'package.json'), 'utf8')
        );
        assert.equal(installedManifest.version, manifest.releaseVersion, entry.name);
        const stagedRoot = join('/evidence/release', entry.stage);
        const stagedManifest = JSON.parse(readFileSync(join(stagedRoot, 'package.json'), 'utf8'));
        assert.deepEqual(installedManifest.exports, stagedManifest.exports, entry.name);
        const bindings = files(stagedRoot).map((name) => {
          const expected = readFileSync(join(stagedRoot, name));
          const actual = readFileSync(join(installedRoot, name));
          assert.equal(digest(actual), digest(expected), `${entry.name}/${name}`);
          return { path: name, sha256: digest(actual), bytes: actual.length };
        });
        packageBindings.push({
          name: entry.name,
          version: installedManifest.version,
          tarball: entry.tarball,
          tarballSha256: digest(readFileSync(join('/evidence/release', entry.tarball))),
          exports: installedManifest.exports,
          files: bindings,
        });
      }
      for (const [path, entry] of Object.entries(lock.packages)) {
        if (!/(?:^|\/)node_modules\/@proto\.ui\//.test(path)) continue;
        assert(entry.resolved?.startsWith('file:'), `registry/workspace escape: ${path}`);
        assert.equal(entry.version, manifest.releaseVersion, path);
      }
      json('/evidence/package-export-binding.json', {
        releaseVersion: manifest.releaseVersion,
        packages: packageBindings,
      });
      cpSync('/work/consumer/package-lock.json', '/evidence/consumer-package-lock.json');
    });
    if (packed) {
      const cli = '/work/consumer/node_modules/@proto.ui/cli/bin/proto-ui.js';
      await phase('actual-packed-cli-init-add', () => {
        command('cli-help', process.execPath, [cli, '--help'], '/work/consumer');
        command(
          'cli-init',
          process.execPath,
          [cli, 'init', '--yes', '--no-interactive', '--no-styles'],
          '/work/consumer'
        );
        command(
          'cli-add',
          process.execPath,
          [
            cli,
            'add',
            'wc',
            'base-collapsible',
            '--language',
            'js',
            '--no-install',
            '--no-interactive',
          ],
          '/work/consumer'
        );
        const facade = '/work/consumer/proto-ui/components/wc/index.js';
        const source = readFileSync(facade, 'utf8');
        assert(
          source.includes('@proto.ui/prototypes-base') && source.includes('AdaptToWebComponent')
        );
        cpSync('/work/consumer/proto-ui', '/evidence/generated-proto-ui', { recursive: true });
        json('/evidence/facade-source-binding.json', {
          generatedBy: 'actual installed CLI init/add',
          files: files('/work/consumer/proto-ui').map((path) => ({
            path,
            sha256: digest(readFileSync(join('/work/consumer/proto-ui', path))),
          })),
        });
      });
      report.consumerSource = copyConsumerSources(repository, '/work/consumer');
      await phase('actual-generated-wc-consumer-and-generic-probes', () => {
        command(
          'packed-consumer',
          process.execPath,
          ['--import', 'tsx', 'hook-closeout.mjs', '/evidence/consumer-observations.json'],
          '/work/consumer'
        );
      });
      await phase('packed-generic-type-boundary', () => {
        json('/work/consumer/tsconfig.json', {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
            lib: ['ES2022', 'DOM'],
          },
          files: ['hook-closeout.types.ts'],
        });
        command(
          'packed-types',
          process.execPath,
          ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
          '/work/consumer'
        );
      });
      for (const profile of ['web-component-source-v1', 'gpui-source-v1']) {
        await phase(`unchanged-source-canonical-compiler-${profile}`, () => {
          command(
            `compiler-${profile}`,
            process.execPath,
            [
              '--import',
              'tsx',
              join(repository, 'packages/compiler/src/cli-entry.ts'),
              'compile',
              '/work/consumer/hook-closeout.proto.ts',
              '--root',
              '/work/consumer',
              '--output',
              `/evidence/compiler-${profile}`,
              '--profile',
              profile,
              '--json',
            ],
            repository
          );
        });
      }
    }
    // Keep outcomes independent: a failed generic probe cannot hide projection debt.
    await phase('disposable-agent-projection-generation', () => pnpm('-s', 'spec:docs:agent'));
    for (const script of ['check:public-docs', 'check:agent-doc', 'check:agent-operations']) {
      await phase(script, () => pnpm('-s', script));
    }
    await phase('bilingual-mdx-types', () => pnpm('-s', 'check:types:docs'));
    await phase('bilingual-format', () =>
      pnpm(
        'exec',
        'prettier',
        '--check',
        'apps/www/src/content/docs/en/specifications/as-hook.mdx',
        'apps/www/src/content/docs/zh-cn/specifications/as-hook.mdx'
      )
    );
    await phase('rendered-bilingual-projection', async () => {
      pnpm('-s', 'docs:build');
      const { parse } = await import(join(repository, 'node_modules/parse5/dist/index.js'));
      const observations = [];
      for (const locale of ['en', 'zh-cn']) {
        const path = join(repository, 'apps/www/dist', locale, 'specifications/as-hook/index.html');
        const bytes = readFileSync(path);
        const page = parse(bytes.toString('utf8'));
        const text = (node) =>
          node.nodeName === '#text'
            ? node.value
            : ['script', 'style'].includes(node.tagName)
              ? ''
              : (node.childNodes ?? []).map(text).join(' ');
        const visible = text(page).replace(/\s+/g, ' ');
        assert(visible.includes('defineHook'));
        assert(visible.includes('2026-10-11'));
        assert(visible.includes('35'));
        assert(locale === 'en' ? visible.includes('historical') : visible.includes('历史'));
        assert(locale === 'en' ? visible.includes('current-source') : visible.includes('当前源码'));
        cpSync(path, `/evidence/as-hook-${locale}.html`);
        observations.push({
          locale,
          htmlSha256: digest(bytes),
          evidence: 'actual Astro build HTML; no browser visual/input claim',
          historicalEvidenceSeparated: true,
          currentExecutionNotInferredFromHistory: true,
        });
      }
      json('/evidence/rendered-projections.json', observations);
    });
  } catch (error) {
    report.unexpectedFailure = String(error?.stack ?? error);
    throw error;
  } finally {
    report.complete =
      !Object.hasOwn(report, 'unexpectedFailure') &&
      report.phases.length > 0 &&
      report.phases.every((row) => row.status === 'passed');
    report.finishedAt = new Date().toISOString();
    report.commands = steps;
    json('/evidence/execution.json', report);
    if (!report.complete) process.exitCode = 1;
  }
}

function runOuter() {
  const runtime = options.get('runtime') ?? 'docker';
  const userMode = options.get('engine') === 'udocker';
  const reuseRoot = options.has('reuse-run')
    ? realpathSync(resolve(options.get('reuse-run')))
    : null;
  const retainedScope = ['correction-r2', 'fixture-repair'].includes(options.get('scope'));
  assert(
    reuseRoot ? userMode && retainedScope : !retainedScope,
    'retained-input execution requires udocker, an explicit retained scope and --reuse-run'
  );
  const image = options.get('image') ?? 'node:24.21.0-bookworm';
  const nodeRoot = resolve(
    options.get('node-root') ?? '/tmp/pui-node24-1155/node-v24.21.0-linux-x64'
  );
  const output = resolve(options.get('out-dir') ?? `/tmp/priority1154-container-${Date.now()}`);
  assert(!contained(ROOT_DIR, output), 'evidence must be outside source');
  assert(
    !reuseRoot || (!contained(reuseRoot, output) && !contained(output, reuseRoot)),
    'new output must not overlap the retained run'
  );
  assert(!existsSync(output), 'use a new evidence directory; preserve all prior attempts');
  mkdirSync(output, { mode: 0o700 });
  logDirectory = join(output, 'host-logs');
  mkdirSync(logDirectory);
  const safeImageInspect = [
    'image',
    'inspect',
    image,
    '--format',
    '{"id":{{json .Id}},"repoDigests":{{json .RepoDigests}},"os":{{json .Os}},"architecture":{{json .Architecture}}}',
  ];
  let imageBinding = null;
  if (!options.has('prepare-only') && !userMode) {
    let inspected;
    try {
      inspected = command('image-admission', runtime, safeImageInspect, ROOT_DIR);
    } catch (error) {
      if (!options.has('pull-image')) throw error;
      command('owned-image-acquisition', runtime, ['pull', image], ROOT_DIR, 600000);
      inspected = command('image-admission-after-pull', runtime, safeImageInspect, ROOT_DIR);
    }
    imageBinding = JSON.parse(inspected);
    assert.equal(imageBinding.os, 'linux');
    assert.equal(imageBinding.architecture, 'amd64');
    assert.match(imageBinding.id, /^sha256:[a-f0-9]{64}$/);
    json(join(output, 'image-binding.json'), imageBinding);
  }
  const snapshot = join(output, 'source');
  const tree = join(snapshot, 'tree');
  mkdirSync(tree, { recursive: true });
  const listing = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: ROOT_DIR, env: childEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  assert.equal(listing.status, 0);
  const paths = [...new Set(listing.stdout.split('\0').filter(Boolean))].sort();
  const members = [];
  const exclusions = [];
  for (const path of paths) {
    assert(!isAbsolute(path) && contained(ROOT_DIR, resolve(ROOT_DIR, path)), path);
    if (path.split('/').some((part) => part.startsWith('.env'))) {
      exclusions.push({
        path,
        role: 'environment/credential configuration; omitted from working-tree copy only; tracked bytes may remain accessible in separately mounted Git metadata',
      });
      continue;
    }
    const source = join(ROOT_DIR, path);
    const target = join(tree, path);
    const stat = lstatSync(source);
    mkdirSync(dirname(target), { recursive: true });
    if (stat.isSymbolicLink()) {
      const link = readlinkSync(source);
      assert(!isAbsolute(link) && contained(tree, resolve(dirname(target), link)), path);
      symlinkSync(link, target);
      members.push({ path, kind: 'symlink', target: link });
    } else {
      assert(stat.isFile(), path);
      const bytes = readFileSync(source);
      if (path.split('/').at(-1) === '.npmrc') {
        assert(
          !/(?:_auth|password|token|username)\s*=/i.test(bytes.toString('utf8')),
          'credential-bearing npm configuration cannot enter the working-tree copy'
        );
      }
      writeFileSync(target, bytes, { mode: stat.mode & 0o777 });
      assert.equal(
        digest(readFileSync(source)),
        digest(bytes),
        `source changed during copy: ${path}`
      );
      members.push({
        path,
        kind: 'file',
        bytes: bytes.length,
        mode: stat.mode & 0o777,
        sha256: digest(bytes),
      });
    }
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT_DIR,
    env: childEnv,
    encoding: 'utf8',
  });
  const headTree = spawnSync('git', ['rev-parse', 'HEAD^{tree}'], {
    cwd: ROOT_DIR,
    env: childEnv,
    encoding: 'utf8',
  });
  const branch = spawnSync('git', ['branch', '--show-current'], {
    cwd: ROOT_DIR,
    env: childEnv,
    encoding: 'utf8',
  });
  assert.equal(head.status, 0);
  assert.equal(headTree.status, 0);
  assert.equal(branch.status, 0);
  const sourceBinding = {
    repository: 'github.com:Proto-UI/Proto-UI',
    root: ROOT_DIR,
    head: head.stdout.trim(),
    tree: headTree.stdout.trim(),
    branch: branch.stdout.trim(),
    evidenceClass: 'fresh source snapshot including owned uncommitted files',
    members,
    exclusions,
    membershipSha256: digest(JSON.stringify(members)),
    hostNodeBinarySha256: digest(readFileSync(join(nodeRoot, 'bin/node'))),
    hostNodeBinary: join(nodeRoot, 'bin/node'),
    hostNodeVersion: command(
      'host-node-identity',
      join(nodeRoot, 'bin/node'),
      ['--version'],
      ROOT_DIR
    ).trim(),
    hostNodeVersionBoundary:
      'host binary identity; do not substitute it for actual container Node version',
  };
  sourceBinding.gitMetadata = prepareGitMetadata(
    snapshot,
    sourceBinding.head,
    sourceBinding.tree,
    sourceBinding.branch
  );
  if (reuseRoot) {
    const receiptPaths = [
      'evidence/execution.json',
      'evidence/consumer-observations.json',
      'evidence/package-export-binding.json',
      'evidence/release/pack-manifest.json',
      'evidence/facade-source-binding.json',
      'work/consumer/package.json',
      'work/consumer/package-lock.json',
      'work/consumer/tsconfig.json',
    ];
    sourceBinding.reuse = {
      role: 'actual-completed-r1-inputs',
      root: reuseRoot,
      receipts: receiptPaths.map((path) => ({
        path,
        sha256: digest(readFileSync(join(reuseRoot, path))),
      })),
      roots:
        options.get('scope') === 'fixture-repair'
          ? ['evidence', 'work/consumer']
          : ['evidence', 'work/consumer', 'work/repo', 'work/corepack'],
      policy:
        'Retained tarballs/package inputs are read and bound; new source, fixture copies, Git metadata, work and receipts belong to the fresh selected-scope run.',
    };
  }
  json(join(snapshot, 'source-binding.json'), sourceBinding);
  cpSync(join(snapshot, 'source-binding.json'), join(output, 'source-binding.json'));
  // Enumerate the physical snapshot independently, including hidden files.
  const physical = (directory, prefix = '') =>
    readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? physical(join(directory, entry.name), join(prefix, entry.name))
          : [join(prefix, entry.name)]
      )
      .sort();
  assert.deepEqual(physical(tree), members.map((entry) => entry.path).sort());
  for (const entry of members) {
    if (entry.kind === 'file')
      assert.equal(digest(readFileSync(join(ROOT_DIR, entry.path))), entry.sha256);
    else assert.equal(readlinkSync(join(ROOT_DIR, entry.path)), entry.target);
  }
  command(
    'source-archive',
    'tar',
    ['-czf', join(output, 'source.tar.gz'), '-C', snapshot, '.'],
    ROOT_DIR
  );
  const extracted = join(output, 'archive-readback');
  mkdirSync(extracted);
  command(
    'source-archive-extraction',
    'tar',
    ['-xzf', join(output, 'source.tar.gz'), '-C', extracted],
    ROOT_DIR
  );
  assert.deepEqual(physical(extracted), physical(snapshot));
  for (const path of physical(snapshot)) {
    const original = join(snapshot, path);
    const restored = join(extracted, path);
    const stat = lstatSync(original);
    assert.equal(lstatSync(restored).mode & 0o777, stat.mode & 0o777, path);
    if (stat.isSymbolicLink()) assert.equal(readlinkSync(restored), readlinkSync(original), path);
    else assert.equal(digest(readFileSync(restored)), digest(readFileSync(original)), path);
  }
  json(join(output, 'source-archive-readback.json'), {
    status: 'passed',
    members: physical(snapshot).length,
    archiveSha256: digest(readFileSync(join(output, 'source.tar.gz'))),
    boundary:
      'current-source archive membership, modes and bytes; not historical evidence recovery',
  });
  mkdirSync(join(output, 'work'));
  mkdirSync(join(output, 'evidence'));
  if (options.has('prepare-only')) {
    json(join(output, 'runtime-neutral-entry.json'), {
      source: snapshot,
      sourceMount: '/source',
      sourceReadOnly: true,
      work: join(output, 'work'),
      workMount: '/work',
      evidence: join(output, 'evidence'),
      evidenceMount: '/evidence',
      hostNodeRoot: nodeRoot,
      hostNodeMountRequired: false,
      executable: '/usr/local/bin/node',
      requiredNodeMajor: 24,
      args: [
        '--max-old-space-size=4096',
        '/source/tree/scripts/release/hook-closeout-container.mjs',
        '--inside',
        ...(reuseRoot ? ['--scope', options.get('scope')] : []),
      ],
      environment: {
        HOME: '/work/home',
        COREPACK_HOME: '/work/corepack',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        HUSKY: '0',
        CI: '1',
      },
      execution:
        'not-run; parent binds actual OCI image/engine and supported resource restrictions',
      isolation: 'record actual engine; this entry does not assert kernel namespaces or cgroups',
    });
    return;
  }
  if (userMode) {
    const receiptPath = options.get('runtime-receipt');
    assert(receiptPath, 'an actual owned-runtime setup receipt is required');
    const ready = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert(
      ready.container.id && ready.container.directory,
      'missing actual OCI container identity'
    );
    assert.equal(ready.host.uid, process.getuid(), 'owned runtime host uid changed');
    const runtimeRoot = dirname(ready.container.directory);
    Object.assign(childEnv, {
      UDOCKER_DIR: ready.container.directory,
      UDOCKER_TMP: join(runtimeRoot, 'tmp'),
      UDOCKER_NOSYSCONF: 'true',
      UDOCKER_KEYSTORE: join(runtimeRoot, 'keystore'),
    });
    const runArgs = [
      'run',
      `--volume=${snapshot}:/source`,
      `--volume=${join(output, 'work')}:/work`,
      `--volume=${join(output, 'evidence')}:/evidence`,
      ...(reuseRoot
        ? sourceBinding.reuse.roots.map(
            (path) => `--volume=${join(reuseRoot, path)}:/retained/${path}`
          )
        : []),
      '--workdir=/work',
      '--env=HOME=/work/home',
      '--env=COREPACK_HOME=/work/corepack',
      '--env=PATH=/usr/local/bin:/usr/bin:/bin',
      '--env=HUSKY=0',
      '--env=CI=1',
      ready.container.id,
      '/usr/local/bin/node',
      '--max-old-space-size=4096',
      '/source/tree/scripts/release/hook-closeout-container.mjs',
      '--inside',
      ...(reuseRoot ? ['--scope', options.get('scope')] : []),
    ];
    json(join(output, 'container-plan.json'), {
      runtime,
      runtimeReceipt: receiptPath,
      runtimeReceiptSha256: digest(readFileSync(receiptPath)),
      container: ready.container,
      args: runArgs,
      deadlineMs: reuseRoot ? 1200000 : 2700000,
      reusedInputs: sourceBinding.reuse ?? null,
      isolation:
        'actual user-space PRoot OCI execution; no kernel namespace/cgroup or read-only-bind claim',
      network: 'shared host stack; no network-namespace claim',
      cleanup:
        'Main retains setup/source/work/evidence and retires only this exact owned container after receipts',
    });
    command(
      'owned-udocker-run',
      'timeout',
      ['--signal=TERM', '--kill-after=20s', reuseRoot ? '1200s' : '2700s', runtime, ...runArgs],
      ROOT_DIR,
      reuseRoot ? 1230000 : 2730000
    );
    return;
  }
  const name = `pui1154-${process.pid}-${Date.now()}`;
  const runArgs = [
    'run',
    '--rm',
    '--name',
    name,
    '--label',
    'proto-ui.issue=1154',
    '--label',
    `proto-ui.run=${name}`,
    '--user',
    `${process.getuid()}:${process.getgid()}`,
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--cpus=2',
    '--memory=8g',
    '--memory-swap=8g',
    '--pids-limit=384',
    '--shm-size=128m',
    '--network=bridge',
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,size=256m',
    '--mount',
    `type=bind,src=${snapshot},dst=/source,readonly`,
    '--mount',
    `type=bind,src=${join(output, 'work')},dst=/work`,
    '--mount',
    `type=bind,src=${join(output, 'evidence')},dst=/evidence`,
    '--mount',
    `type=bind,src=${nodeRoot},dst=/opt/node24,readonly`,
    '--env',
    'HOME=/work/home',
    '--env',
    'COREPACK_HOME=/work/corepack',
    '--env',
    'PATH=/opt/node24/bin:/usr/local/bin:/usr/bin:/bin',
    '--env',
    'HUSKY=0',
    '--env',
    'CI=1',
    '--workdir',
    '/work',
    imageBinding.id,
    '/opt/node24/bin/node',
    '/source/tree/scripts/release/hook-closeout-container.mjs',
    '--inside',
  ];
  json(join(output, 'container-plan.json'), {
    name,
    runtime,
    image: imageBinding,
    args: runArgs,
    deadlineMs: 2700000,
    outboundNetwork:
      'bridge for locked dependency and exact tarball consumer acquisition; no host networking or published ports',
    cleanup: 'only the container bearing both owned labels; evidence/source/work retained',
  });
  try {
    command('container-run', runtime, runArgs, ROOT_DIR, 2700000);
  } finally {
    // A timed-out client must not leave its container running. Inspect only the
    // ownership label, never the container configuration or environment.
    const owned = spawnSync(
      runtime,
      ['container', 'inspect', name, '--format', '{{index .Config.Labels "proto-ui.run"}}'],
      { encoding: 'utf8' }
    );
    if (owned.status === 0 && owned.stdout.trim() === name) {
      command('owned-container-removal', runtime, ['rm', '--force', name], ROOT_DIR);
    }
    json(join(output, 'host-commands.json'), steps);
  }
}

if (inside) await runInside();
else runOuter();
