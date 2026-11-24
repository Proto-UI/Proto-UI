import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { inspectGpuiCargoGraph, resolveGpuiCargoExpectations } from '../lib/cargo-graph.mjs';

// These source descriptors are graph fixtures, not released GPUI versions or
// evidence that the standalone repository currently contains buildable source.
const revision = 'a'.repeat(40);
const git = 'https://github.com/zed-industries/zed';
const gitSource = `git+${git}?rev=${revision}#${revision}`;
const registry = 'https://github.com/rust-lang/crates.io-index';
const registrySource = `registry+${registry}`;
const version = '0.0.0-migration-fixture';
const source = { kind: 'registry', registry, version };
const packageOf = (id, name, source, version) => ({ id, name, source, version });
const nodeOf = (id, packages = []) => ({
  id,
  deps: packages.map((pkg) => ({ pkg, name: `alias-${pkg}`, dep_kinds: [] })),
});
function metadata(gpuiSource = registrySource, gpuiVersion = version) {
  return {
    version: 1,
    workspace_members: ['app', 'sdk'],
    packages: [
      packageOf('app', 'consumer', null, '0.1.0'),
      packageOf('sdk', 'proto-ui-gpui-native', null, '0.2.0'),
      packageOf('gpui', 'gpui', gpuiSource, gpuiVersion),
    ],
    resolve: {
      nodes: [nodeOf('app', ['sdk', 'gpui']), nodeOf('sdk', ['gpui']), nodeOf('gpui')],
    },
  };
}
function addPackage(value, pkg, parent = 'app') {
  value.packages.push(pkg);
  value.resolve.nodes.push(nodeOf(pkg.id));
  value.resolve.nodes
    .find(({ id }) => id === parent)
    .deps.push({
      pkg: pkg.id,
      name: 'unrelated_alias',
      dep_kinds: [{ kind: 'build', target: 'cfg(target_os = "none")' }],
    });
}

test('registry admission binds the exact source and independently the exact version', () => {
  const result = inspectGpuiCargoGraph(metadata(), { source });
  assert.equal(result.ok, true);
  assert.deepEqual(result.expectedDependency, source);
  assert.equal(result.expectedSource, registrySource);
  assert.equal(result.expectedVersion, version);
  assert.deepEqual(result.expectedPlatform, {
    required: false,
    dependency: null,
    source: null,
    version: null,
  });
  assert.deepEqual(result.gpuiPlatform, []);
  const wrongSource = metadata('registry+https://registry.example.invalid/index');
  assert.match(
    inspectGpuiCargoGraph(wrongSource, { source }).errors.join('\n'),
    /GPUI source mismatch/
  );
  const wrongVersion = metadata(registrySource, '0.0.0-other-fixture');
  assert.match(
    inspectGpuiCargoGraph(wrongVersion, { source }).errors.join('\n'),
    /GPUI version mismatch/
  );
  const localPatch = metadata(null);
  assert.match(inspectGpuiCargoGraph(localPatch, { source }).errors.join('\n'), /a local path/);
});

test('registry prerelease and build metadata are exact identities, not version ranges', () => {
  const selected = { ...source, version: '0.0.0-migration.1+fixture.001' };
  assert.equal(
    inspectGpuiCargoGraph(metadata(registrySource, selected.version), { source: selected }).ok,
    true
  );
  for (const actual of ['0.0.0-migration.2+fixture.001', '0.0.0-migration.1+fixture.002']) {
    assert.match(
      inspectGpuiCargoGraph(metadata(registrySource, actual), { source: selected }).errors.join(
        '\n'
      ),
      /GPUI version mismatch/
    );
  }
});

test('explicit registry and sparse Cargo source IDs are matched without inventing a prefix', () => {
  assert.equal(
    inspectGpuiCargoGraph(metadata(), { source: { ...source, registry: registrySource } }).ok,
    true
  );
  const sparse = 'sparse+https://registry.example.invalid/index/';
  const selected = { ...source, registry: sparse };
  const result = inspectGpuiCargoGraph(metadata(sparse), { source: selected });
  assert.equal(result.ok, true);
  assert.equal(result.expectedSource, sparse);
  assert.deepEqual(result.expectedDependency, selected);
  for (const actual of [
    'registry+https://registry.example.invalid/index/',
    'registry+' + sparse,
    sparse.slice(0, -1),
  ]) {
    assert.match(
      inspectGpuiCargoGraph(metadata(actual), { source: selected }).errors.join('\n'),
      /GPUI source mismatch/
    );
  }
  for (const invalid of [
    'registry+' + sparse,
    'sparse+registry+https://registry.example.invalid/index',
    'registry+registry+https://registry.example.invalid/index',
    'registry+',
    'sparse+file:///fixture',
    'javascript:fixture',
  ]) {
    assert.throws(() => resolveGpuiCargoExpectations({ source: { ...source, registry: invalid } }));
  }
});

test('an explicit standalone Git source remains distinct from the old repository at the same SHA', () => {
  const standalone = { kind: 'git', git: 'https://github.com/zed-industries/gpui', revision };
  const matching = `git+${standalone.git}?rev=${revision}#${revision}`;
  assert.equal(inspectGpuiCargoGraph(metadata(matching), { source: standalone }).ok, true);
  assert.match(
    inspectGpuiCargoGraph(metadata(gitSource), { source: standalone }).errors.join('\n'),
    /GPUI source mismatch/
  );
  assert.deepEqual(
    inspectGpuiCargoGraph(metadata(gitSource), { source: { kind: 'git', git, revision } }),
    inspectGpuiCargoGraph(metadata(gitSource), { git, revision })
  );
});

for (const duplicate of [
  gitSource,
  'git+https://github.com/zed-industries/gpui?rev=' + revision + '#' + revision,
  'registry+https://registry.example.invalid/index',
]) {
  test(`a transitive aliased GPUI from ${duplicate} cannot hide behind the same version`, () => {
    const value = metadata();
    addPackage(value, packageOf('other', 'gpui', duplicate, version), 'sdk');
    assert.deepEqual(inspectGpuiCargoGraph(value, { source }).errors, [
      'Expected exactly one resolved GPUI package; found 2: gpui, other',
    ]);
  });
}

test('Git admission checks any platform crate against the same source commit by default', () => {
  const value = metadata(gitSource);
  assert.equal(inspectGpuiCargoGraph(value, { git, revision }).ok, true);
  addPackage(value, packageOf('platform', 'gpui_platform', gitSource, '0.1.0'));
  const matching = inspectGpuiCargoGraph(value, { git, revision });
  assert.equal(matching.ok, true);
  assert.equal(matching.expectedPlatform.required, false);
  assert.equal(matching.gpuiPlatform.length, 1);
  value.packages.at(-1).source = gitSource.replace('zed-industries/zed', 'zed-industries/gpui');
  assert.match(
    inspectGpuiCargoGraph(value, { git, revision }).errors.join('\n'),
    /GPUI platform source mismatch/
  );
  value.packages.at(-1).source = gitSource.replaceAll(revision, 'b'.repeat(40));
  assert.match(
    inspectGpuiCargoGraph(value, { git, revision }).errors.join('\n'),
    /GPUI platform source mismatch/
  );
});

test('registry admission requires a platform expectation when the graph includes that crate', () => {
  const value = metadata();
  addPackage(
    value,
    packageOf('platform', 'gpui_platform', registrySource, '0.0.0-platform-fixture')
  );
  assert.match(
    inspectGpuiCargoGraph(value, { source }).errors.join('\n'),
    /requires its own exact platformSource/
  );
  const platformSource = { ...source, version: '0.0.0-platform-fixture' };
  const result = inspectGpuiCargoGraph(value, { source, platformSource });
  assert.equal(result.ok, true);
  assert.equal(result.expectedPlatform.required, true);
  assert.equal(result.expectedPlatform.version, platformSource.version);
  assert.match(
    inspectGpuiCargoGraph(value, { source, platformSource: source }).errors.join('\n'),
    /GPUI platform version mismatch/
  );
  value.packages.at(-1).source = gitSource;
  assert.match(
    inspectGpuiCargoGraph(value, { source, platformSource }).errors.join('\n'),
    /GPUI platform source mismatch/
  );
});

test('explicit platform identity can be required or optional without ignoring mismatch', () => {
  const platformSource = { ...source, version: '0.0.0-platform-fixture' };
  assert.match(
    inspectGpuiCargoGraph(metadata(), { source, platformSource }).errors.join('\n'),
    /exactly one resolved GPUI platform package; found 0/
  );
  assert.equal(
    inspectGpuiCargoGraph(metadata(), { source, platformSource, requirePlatform: false }).ok,
    true
  );
  const value = metadata();
  addPackage(value, packageOf('platform', 'gpui_platform', registrySource, '0.0.0-other-fixture'));
  assert.match(
    inspectGpuiCargoGraph(value, { source, platformSource, requirePlatform: false }).errors.join(
      '\n'
    ),
    /GPUI platform version mismatch/
  );
  const foreignGit = { kind: 'git', git: 'https://github.com/example/gpui', revision };
  value.packages.at(-1).source = `git+${foreignGit.git}?rev=${revision}#${revision}`;
  assert.equal(inspectGpuiCargoGraph(value, { source, platformSource: foreignGit }).ok, true);
});

test('duplicate platform identities are rejected even when the platform is optional', () => {
  const value = metadata(gitSource);
  addPackage(value, packageOf('platform', 'gpui_platform', gitSource, '0.1.0'));
  addPackage(value, packageOf('other-platform', 'gpui_platform', registrySource, '0.1.0'), 'sdk');
  assert.deepEqual(inspectGpuiCargoGraph(value, { git, revision }).errors, [
    'Expected at most one resolved GPUI platform package; found 2: platform, other-platform',
  ]);
});

test('an absent SDK stays legal only with the existing explicit requireSdk false option', () => {
  const value = metadata();
  value.packages.find(({ id }) => id === 'sdk').name = 'ordinary-library';
  assert.equal(inspectGpuiCargoGraph(value, { source }).ok, false);
  assert.equal(inspectGpuiCargoGraph(value, { source, requireSdk: false }).ok, true);
});

test('source descriptors reject incomplete, ambiguous and floating identities', () => {
  for (const invalid of [
    null,
    {},
    { kind: 'path', path: '.' },
    { kind: 'git', git },
    { kind: 'git', git, revision: 'main' },
    { kind: 'git', git, revision: 'ABCDEF'.repeat(7).slice(0, 40) },
    { kind: 'git', git, revision, version },
    { ...source, git },
    { ...source, registry: 'crates-io' },
    { ...source, registry: registry + '?token=fixture' },
  ]) {
    assert.throws(() => resolveGpuiCargoExpectations({ source: invalid }));
  }
  for (const invalid of [
    '*',
    '^0.3',
    '=0.3.0',
    '>=0.3.0',
    'v0.3.0',
    '0.3',
    '01.2.3',
    '1.2.3-alpha.01',
    '1.2.3-',
    '1.2.3 ',
    '',
  ]) {
    assert.throws(
      () => resolveGpuiCargoExpectations({ source: { ...source, version: invalid } }),
      /exact complete registry version/
    );
  }
  assert.throws(() => resolveGpuiCargoExpectations({ source, git, revision }), /not both/);
  assert.throws(
    () => resolveGpuiCargoExpectations({ source, requirePlatform: true }),
    /own exact platformSource/
  );
  assert.throws(
    () => resolveGpuiCargoExpectations({ source, platformSource: { kind: 'registry', registry } }),
    /exact complete registry version/
  );
  assert.throws(() => resolveGpuiCargoExpectations({ source, requireSdk: 'false' }), /Boolean/);
});

const script = fileURLToPath(new URL('../check-cargo-graph.mjs', import.meta.url));
function invoke(t, args) {
  const root = mkdtempSync(path.join(tmpdir(), 'proto-ui-cargo-source-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = path.join(root, 'receipt.json');
  const result = spawnSync(
    process.execPath,
    [script, '--manifest-path', path.join(root, 'Cargo.toml'), ...args, '--output', output],
    {
      encoding: 'utf8',
      env: { ...process.env, CARGO: path.join(root, 'absent-cargo') },
    }
  );
  return { result, output };
}

test('CLI profile selects the unchanged commit and records expectation even when Cargo is absent', (t) => {
  const { result, output } = invoke(t, ['--profile', 'gpui-source-v1']);
  assert.equal(result.status, 1);
  const receipt = JSON.parse(readFileSync(output, 'utf8'));
  assert.deepEqual(receipt.expectedDependency, {
    kind: 'git',
    git,
    revision: '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8',
  });
  assert.equal(receipt.failure.stage, 'cargo-version');
  assert.equal(receipt.metadataSha256, null);
  assert.equal(existsSync(`${output}.metadata.json`), false);
});

test('CLI registry selection retains independently specified platform version in failure evidence', (t) => {
  const { result, output } = invoke(t, [
    '--registry',
    registry,
    '--version',
    version,
    '--platform-registry',
    registry,
    '--platform-version',
    '0.0.0-platform-fixture',
  ]);
  assert.equal(result.status, 1);
  const receipt = JSON.parse(readFileSync(output, 'utf8'));
  assert.deepEqual(receipt.expectedDependency, source);
  assert.equal(receipt.expectedPlatform.required, true);
  assert.equal(receipt.expectedPlatform.version, '0.0.0-platform-fixture');
  assert.equal(receipt.failure.stage, 'cargo-version');
  assert.equal(receipt.metadataSha256, null);
});

for (const [name, args, error] of [
  ['no source', [], /Select --profile/],
  ['future profile', ['--profile', 'gpui-standalone-v1'], /Only the existing/],
  [
    'mixed profile and source',
    ['--profile', 'gpui-source-v1', '--git', git, '--rev', revision],
    /profile or explicit source/,
  ],
  [
    'mixed profile and platform',
    ['--profile', 'gpui-source-v1', '--platform-git', git, '--platform-rev', revision],
    /profile or explicit source/,
  ],
  [
    'mixed source kinds',
    ['--git', git, '--rev', revision, '--registry', registry, '--version', version],
    /not both/,
  ],
  ['incomplete Git', ['--git', git], /full lowercase Git revision/],
  ['incomplete registry', ['--registry', registry], /exact complete registry version/],
  [
    'floating version',
    ['--registry', registry, '--version', '*'],
    /exact complete registry version/,
  ],
  [
    'incomplete platform',
    ['--registry', registry, '--version', version, '--platform-registry', registry],
    /exact complete registry version/,
  ],
  [
    'mixed platform kinds',
    [
      '--registry',
      registry,
      '--version',
      version,
      '--platform-git',
      git,
      '--platform-rev',
      revision,
      '--platform-registry',
      registry,
      '--platform-version',
      version,
    ],
    /not both/,
  ],
  ['duplicate selector', ['--git', git, '--rev', revision, '--rev', revision], /one value/],
]) {
  test(`CLI rejects ${name} before executing Cargo`, (t) => {
    const { result, output } = invoke(t, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
    assert.equal(existsSync(output), false);
  });
}

const cargo = process.env.CARGO ?? 'cargo';
const cargoProbe = spawnSync(cargo, ['--version'], { encoding: 'utf8' });
const requireCargo = process.env.PROTO_UI_REQUIRE_CARGO_GRAPH_TESTS === '1';

// A local registry with real .crate archives exercises Cargo's parser, registry
// source IDs, checksums and lock enforcement. These empty fixture packages are
// not implementations of GPUI and establish no native/API compatibility.
test(
  'actual Cargo registry graph enforces exact sources, independent platform versions and mixed-source rejection',
  {
    skip:
      cargoProbe.status !== 0 && !requireCargo
        ? 'Cargo unavailable; real registry resolver evidence was not executed'
        : false,
  },
  async (t) => {
    assert.equal(
      cargoProbe.status,
      0,
      `Cargo is required: ${cargoProbe.error ?? cargoProbe.stderr}`
    );
    const root = mkdtempSync(path.join(tmpdir(), 'proto-ui-cargo-registry-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const localRegistry = path.join(root, 'registry');
    mkdirSync(path.join(localRegistry, 'index/gp/ui'), { recursive: true });
    const registryUrl = 'https://registry.example.invalid/index';
    const platformVersion = '0.0.0-platform-fixture';
    // The native-consumer CI job has a shared CARGO_TARGET_DIR. Keep these
    // synthetic packages and every Cargo operation out of that consumer cache,
    // while retaining the selected toolchain and executable from the caller.
    const fixtureTarget = path.join(root, 'target');
    const env = {
      ...process.env,
      CARGO_HOME: path.join(root, 'cargo-home'),
      CARGO_TARGET_DIR: fixtureTarget,
    };
    function run(command, args, cwd) {
      const result = spawnSync(command, args, {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.equal(
        result.status,
        0,
        `${command} ${args.join(' ')}: ${result.error ?? result.stderr}`
      );
      return result.stdout;
    }
    function crate(directory, name, crateVersion, dependencies = '') {
      mkdirSync(path.join(directory, 'src'), { recursive: true });
      writeFileSync(
        path.join(directory, 'Cargo.toml'),
        `[package]\nname = "${name}"\nversion = "${crateVersion}"\nedition = "2021"\n${dependencies}`
      );
      writeFileSync(path.join(directory, 'src/lib.rs'), 'pub fn resolver_fixture() {}\n');
    }
    for (const [name, crateVersion] of [
      ['gpui', version],
      ['gpui_platform', platformVersion],
    ]) {
      const directory = path.join(root, `package-${name}`);
      crate(directory, name, crateVersion);
      run(cargo, ['package', '--no-verify', '--allow-dirty', '--offline'], directory);
      const archive = `${name}-${crateVersion}.crate`;
      const archivePath = path.join(fixtureTarget, 'package', archive);
      const checksum = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
      copyFileSync(archivePath, path.join(localRegistry, archive));
      writeFileSync(
        path.join(localRegistry, 'index/gp/ui', name),
        JSON.stringify({
          name,
          vers: crateVersion,
          deps: [],
          cksum: checksum,
          features: {},
          yanked: false,
        }) + '\n'
      );
    }
    let sequence = 0;
    function workspace(includePlatform = false, extra = '') {
      const directory = path.join(root, `workspace-${sequence++}`);
      crate(
        directory,
        'consumer',
        '0.1.0',
        `
[workspace]
resolver = "2"
members = ["sdk"]
[workspace.dependencies]
gpui = { version = "=${version}", registry = "fixture" }
[dependencies]
gpui.workspace = true
sdk = { package = "proto-ui-gpui-native", path = "sdk" }
${includePlatform ? `platform_alias = { package = "gpui_platform", version = "=${platformVersion}", registry = "fixture" }` : ''}
${extra}
`
      );
      crate(
        path.join(directory, 'sdk'),
        'proto-ui-gpui-native',
        '0.2.0',
        '[dependencies]\ngpui.workspace = true\n'
      );
      mkdirSync(path.join(directory, '.cargo'));
      writeFileSync(
        path.join(directory, '.cargo/config.toml'),
        `
[registries.fixture]
index = "${registryUrl}"
[source.fixture]
registry = "${registryUrl}"
replace-with = "fixture-local"
[source.fixture-local]
local-registry = ${JSON.stringify(localRegistry)}
`
      );
      // Registry packages come only from this local replacement. The one mixed
      // Git case needs a first file:// checkout, which Cargo disallows offline.
      run(cargo, ['generate-lockfile', ...(extra ? [] : ['--offline'])], directory);
      return directory;
    }
    const registryArgs = ['--registry', registryUrl, '--version', version];
    const platformArgs = [
      '--platform-registry',
      registryUrl,
      '--platform-version',
      platformVersion,
    ];
    function admission(directory, args, ok, invocation = {}) {
      const output = path.join(directory, `receipt-${sequence++}.json`);
      const manifest = path.join(directory, invocation.manifest ?? 'Cargo.toml');
      const caller = invocation.cwd ?? directory;
      const argumentPath = (filename) =>
        invocation.relativePaths ? path.relative(caller, filename) : filename;
      const lock = path.join(directory, 'Cargo.lock');
      const before = existsSync(lock) ? readFileSync(lock) : null;
      const result = spawnSync(
        process.execPath,
        [
          script,
          '--manifest-path',
          argumentPath(manifest),
          ...args,
          '--offline',
          '--output',
          argumentPath(output),
        ],
        { cwd: caller, env, encoding: 'utf8' }
      );
      assert.equal(result.status, ok ? 0 : 1, result.error?.message ?? result.stderr);
      const receipt = JSON.parse(readFileSync(output, 'utf8'));
      assert.equal(receipt.ok, ok);
      assert.equal(receipt.cwd, path.dirname(manifest));
      assert.equal(receipt.command[receipt.command.indexOf('--manifest-path') + 1], manifest);
      assert.ok(receipt.command.includes('--locked'));
      assert.ok(receipt.command.includes('--all-features'));
      assert.ok(receipt.command.includes('--offline'));
      assert.ok(!receipt.command.includes('--no-deps'));
      assert.ok(!receipt.command.includes('--filter-platform'));
      if (before)
        assert.deepEqual(readFileSync(lock), before, 'Admission must not modify the lock');
      if (receipt.metadataSha256 !== null) {
        const resolved = JSON.parse(readFileSync(`${output}.metadata.json`, 'utf8'));
        assert.equal(
          realpathSync(resolved.target_directory),
          realpathSync(fixtureTarget),
          'Cargo must use the fixture target directory instead of an inherited consumer cache'
        );
      }
      return { receipt, output };
    }
    await t.test(
      'real registry package and shared SDK resolve at the exact selected source/version',
      () => {
        const { receipt, output } = admission(workspace(), registryArgs, true);
        assert.equal(receipt.gpui[0].source, `registry+${registryUrl}`);
        assert.equal(receipt.gpui[0].version, version);
        assert.equal(receipt.sdk.length, 1);
        assert.match(receipt.metadataSha256, /^[a-f0-9]{64}$/);
        assert.ok(JSON.parse(readFileSync(`${output}.metadata.json`, 'utf8')).resolve);
      }
    );
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    await t.test(
      'a compiler-root invocation honors external registry config and caller-relative paths',
      () => {
        const directory = workspace(true);
        const { receipt, output } = admission(directory, [...registryArgs, ...platformArgs], true, {
          cwd: repository,
          relativePaths: true,
        });
        assert.equal(receipt.gpui[0].source, `registry+${registryUrl}`);
        assert.equal(receipt.gpuiPlatform[0].version, platformVersion);
        assert.ok(existsSync(output), 'The receipt remains at the caller-relative output path');
        assert.ok(existsSync(`${output}.metadata.json`));
      }
    );
    await t.test(
      'a child manifest discovers its workspace parent registry config from a foreign caller',
      () => {
        const directory = workspace(true);
        const { receipt } = admission(directory, [...registryArgs, ...platformArgs], true, {
          cwd: repository,
          manifest: 'sdk/Cargo.toml',
          relativePaths: true,
        });
        assert.equal(receipt.cwd, path.join(directory, 'sdk'));
        assert.equal(receipt.gpui[0].source, `registry+${registryUrl}`);
        assert.equal(receipt.sdk.length, 1);
      }
    );
    await t.test('wrong registry, version and Git expectations do not match', () => {
      const directory = workspace();
      assert.match(
        admission(
          directory,
          ['--registry', registry, '--version', version],
          false
        ).receipt.errors.join('\n'),
        /GPUI source mismatch/
      );
      assert.match(
        admission(
          directory,
          ['--registry', registryUrl, '--version', '0.0.0-other-fixture'],
          false
        ).receipt.errors.join('\n'),
        /GPUI version mismatch/
      );
      assert.match(
        admission(directory, ['--git', git, '--rev', revision], false).receipt.errors.join('\n'),
        /GPUI source mismatch/
      );
    });
    await t.test('platform alias has its independently selected registry version', () => {
      const directory = workspace(true);
      const { receipt } = admission(directory, [...registryArgs, ...platformArgs], true);
      assert.equal(receipt.gpuiPlatform[0].version, platformVersion);
      assert.equal(receipt.gpuiPlatform[0].source, `registry+${registryUrl}`);
      assert.match(
        admission(directory, registryArgs, false).receipt.errors.join('\n'),
        /own exact platformSource/
      );
      assert.match(
        admission(
          directory,
          [...registryArgs, '--platform-registry', registryUrl, '--platform-version', version],
          false
        ).receipt.errors.join('\n'),
        /GPUI platform version mismatch/
      );
    });
    await t.test('explicit platform requirement fails when its package is absent', () => {
      assert.match(
        admission(workspace(), [...registryArgs, ...platformArgs], false).receipt.errors.join('\n'),
        /exactly one resolved GPUI platform package; found 0/
      );
    });
    await t.test('a same-version Git GPUI under a build alias is still a second package', () => {
      const directory = path.join(root, 'legacy-git');
      crate(directory, 'gpui', version);
      run('git', ['init', '-q'], directory);
      run('git', ['add', '.'], directory);
      run(
        'git',
        [
          '-c',
          'user.name=Proto UI resolver fixture',
          '-c',
          'user.email=fixture@example.invalid',
          '-c',
          'commit.gpgsign=false',
          'commit',
          '-qm',
          'resolver fixture',
        ],
        directory
      );
      const sha = run('git', ['rev-parse', 'HEAD'], directory).trim();
      const consumer = workspace(
        false,
        `[build-dependencies]\nlegacy = { package = "gpui", git = ${JSON.stringify(pathToFileURL(directory).href)}, rev = "${sha}" }\n`
      );
      const { receipt } = admission(consumer, registryArgs, false);
      assert.equal(receipt.gpui.length, 2);
      assert.match(receipt.errors.join('\n'), /exactly one resolved GPUI package; found 2/);
    });
    await t.test(
      'missing registry lock remains failed metadata evidence and is not regenerated',
      () => {
        const directory = workspace();
        rmSync(path.join(directory, 'Cargo.lock'));
        const { receipt, output } = admission(directory, registryArgs, false);
        assert.equal(receipt.failure.stage, 'cargo-metadata');
        assert.equal(receipt.failure.exitCode, 101);
        assert.equal(receipt.metadataSha256, null);
        assert.equal(existsSync(path.join(directory, 'Cargo.lock')), false);
        assert.equal(existsSync(`${output}.metadata.json`), false);
      }
    );
  }
);
