import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { inspectGpuiCargoGraph } from '../lib/cargo-graph.mjs';

const revision = 'a'.repeat(40);
const git = 'https://github.com/zed-industries/zed';
const expectedSource = `git+${git}?rev=${revision}#${revision}`;
const packageOf = (id, name, source = null) => ({ id, name, source, version: '0.2.0' });
const nodeOf = (id, ids = []) => ({
  id,
  deps: ids.map((pkg) => ({
    pkg,
    name: `alias-${pkg}`,
    dep_kinds: [{ kind: 'build', target: 'cfg(unix)' }],
  })),
});
function metadata() {
  return {
    version: 1,
    workspace_members: ['app', 'component-a', 'component-b', 'sdk'],
    packages: [
      packageOf('app', 'native-consumer'),
      packageOf('component-a', 'first-component'),
      packageOf('component-b', 'second-component'),
      packageOf('sdk', 'proto-ui-gpui-native'),
      packageOf('gpui', 'gpui', expectedSource),
    ],
    resolve: {
      nodes: [
        nodeOf('app', ['component-a', 'component-b', 'gpui']),
        nodeOf('component-a', ['sdk']),
        nodeOf('component-b', ['sdk']),
        nodeOf('sdk', ['gpui']),
        nodeOf('gpui'),
      ],
    },
  };
}
const inspect = (value) => inspectGpuiCargoGraph(value, { git, revision });

test('accepts two components, their shared SDK and one actual GPUI package', () => {
  assert.deepEqual(inspect(metadata()), {
    ok: true,
    errors: [],
    expectedDependency: { kind: 'git', git, revision },
    expectedSource,
    expectedVersion: null,
    expectedPlatform: {
      required: false,
      dependency: { kind: 'git', git, revision },
      source: expectedSource,
      version: null,
    },
    requireSdk: true,
    workspaceMembers: ['app', 'component-a', 'component-b', 'sdk'],
    resolvedPackages: 5,
    gpui: [packageOf('gpui', 'gpui', expectedSource)],
    gpuiPlatform: [],
    sdk: [packageOf('sdk', 'proto-ui-gpui-native')],
  });
});

test('rejects a same-revision GPUI from another source URL', () => {
  const value = metadata();
  value.packages.at(-1).source = expectedSource.replace('zed-industries/zed', 'other/zed');
  assert.deepEqual(inspect(value).errors, [
    `GPUI source mismatch: expected ${expectedSource}; resolved ${value.packages.at(-1).source}.`,
  ]);
});

test('resolves names through package IDs, including target/build aliases and transitive packages', () => {
  const value = metadata();
  value.packages.push(
    packageOf('legacy', 'gpui', 'registry+https://github.com/rust-lang/crates.io-index')
  );
  value.resolve.nodes.push(nodeOf('legacy'));
  value.resolve.nodes
    .find(({ id }) => id === 'sdk')
    .deps.push({
      name: 'unrelated-looking-alias',
      pkg: 'legacy',
      dep_kinds: [{ kind: 'build', target: 'cfg(target_os = "none")' }],
    });
  assert.deepEqual(inspect(value).errors, [
    'Expected exactly one resolved GPUI package; found 2: gpui, legacy',
  ]);
});

test('another dependency revision is irrelevant, and lock-only unreachable packages are not counted', () => {
  const value = metadata();
  value.packages.push(
    packageOf('unrelated', 'other-library', expectedSource),
    packageOf('not-reached', 'gpui', 'path+file:///unrelated')
  );
  value.resolve.nodes.push(nodeOf('unrelated'), nodeOf('not-reached'));
  value.resolve.nodes[0].deps.push({ name: 'other', pkg: 'unrelated', dep_kinds: [] });
  assert.equal(inspect(value).ok, true);
  assert.equal(inspect(value).resolvedPackages, 6);
});

test('rejects two reachable SDK package identities', () => {
  const value = metadata();
  value.packages.push(packageOf('other-sdk', 'proto-ui-gpui-native'));
  value.resolve.nodes.push(nodeOf('other-sdk', ['gpui']));
  value.resolve.nodes[0].deps.push({ name: 'sdk-alias', pkg: 'other-sdk', dep_kinds: [] });
  assert.deepEqual(inspect(value).errors, [
    'Expected exactly one shared Proto UI GPUI SDK package; found 2: sdk, other-sdk',
  ]);
});

test('missing or truncated resolve evidence never passes as a dependency check', () => {
  const absent = metadata();
  absent.resolve = null;
  assert.throws(
    () => inspect(absent),
    /Complete Cargo metadata with a resolve graph is required; --no-deps is not evidence/
  );
  const truncated = metadata();
  truncated.resolve.nodes.pop();
  assert.throws(() => inspect(truncated), /missing a dependency of sdk/);
  const noSdk = metadata();
  noSdk.packages.find(({ id }) => id === 'sdk').name = 'some-other-library';
  assert.deepEqual(inspect(noSdk).errors, [
    'Expected exactly one shared Proto UI GPUI SDK package; found 0: ',
  ]);
});

const cargo = process.env.CARGO ?? 'cargo';
const cargoProbe = spawnSync(cargo, ['--version'], { encoding: 'utf8' });
const requireCargo = process.env.PROTO_UI_REQUIRE_CARGO_GRAPH_TESTS === '1';
const script = fileURLToPath(new URL('../check-cargo-graph.mjs', import.meta.url));

test('an unavailable Cargo executable retains failed evidence without fabricating metadata', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'proto-ui-cargo-unavailable-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = path.join(root, 'failed.json');
  const result = spawnSync(
    process.execPath,
    [
      script,
      '--manifest-path',
      path.join(root, 'Cargo.toml'),
      '--git',
      git,
      '--rev',
      revision,
      '--output',
      output,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, CARGO: path.join(root, 'absent-cargo') },
    }
  );
  assert.equal(result.status, 1);
  const receipt = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(receipt.ok, false);
  assert.equal(receipt.cargoVersion, null);
  assert.equal(receipt.metadataSha256, null);
  assert.equal(receipt.failure.stage, 'cargo-version');
  assert.equal(existsSync(`${output}.metadata.json`), false);
});

// These tiny Git packages have no external dependencies and no GPUI substitute
// is used for a native behavior claim. They exercise Cargo's real TOML parser,
// resolver, package IDs and lock enforcement, independently of our graph walker.
test(
  'actual Cargo graph rejects legal TOML bypasses and preserves legal formatting',
  {
    skip:
      cargoProbe.status !== 0 && !requireCargo
        ? 'Cargo unavailable; real resolver evidence was not executed'
        : false,
  },
  async (t) => {
    assert.equal(
      cargoProbe.status,
      0,
      `Cargo is required: ${cargoProbe.error ?? cargoProbe.stderr}`
    );
    const root = mkdtempSync(path.join(tmpdir(), 'proto-ui-cargo-graph-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    function run(command, args, cwd = root) {
      const result = spawnSync(command, args, {
        cwd,
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
    function crate(directory, name, dependencies = '', version = '0.2.0') {
      mkdirSync(path.join(directory, 'src'), { recursive: true });
      writeFileSync(
        path.join(directory, 'Cargo.toml'),
        `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\n${dependencies}`
      );
      writeFileSync(path.join(directory, 'src/lib.rs'), 'pub fn probe() {}\n');
    }
    function gitCrate(name, packageName, version) {
      const directory = path.join(root, name);
      crate(directory, packageName, '', version);
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
      return {
        git: pathToFileURL(directory).href,
        revision: run('git', ['rev-parse', 'HEAD'], directory).trim(),
      };
    }
    const pinned = gitCrate('pinned-gpui', 'gpui', '0.2.2');
    // Equal names and versions still form distinct packages at different sources.
    const legacy = gitCrate('legacy-gpui', 'gpui', '0.2.2');
    const other = gitCrate('other-library', 'other-library', '1.0.0');
    const declaration = ({ git, revision }) => `git = "${git}", rev = "${revision}"`;
    let sequence = 0;
    function workspace(
      extra = '',
      rootGpui = 'gpui = { workspace = true } # a legitimate comment'
    ) {
      const directory = path.join(root, `workspace-${sequence++}`);
      crate(
        directory,
        'native-consumer',
        `
[workspace]
resolver = "2"
members = ["component-a", "component-b", "sdk"]

[workspace.dependencies]
gpui = { ${declaration(pinned)} }

[dependencies]
${rootGpui}
first = { path = "component-a" }
second = { path = "component-b" }
unrelated = { package = "other-library", ${declaration(other)} }
${extra}
`
      );
      for (const name of ['component-a', 'component-b']) {
        crate(
          path.join(directory, name),
          name === 'component-a' ? 'first' : 'second',
          '\n[dependencies]\ngpui.workspace = true\nsdk = { package = "proto-ui-gpui-native", path = "../sdk" }\n'
        );
      }
      crate(
        path.join(directory, 'sdk'),
        'proto-ui-gpui-native',
        '\n[dependencies.gpui]\nworkspace = true\n'
      );
      // The source repositories are local. This creates the first lock deliberately;
      // every admission check after it is --locked and cannot repair stale evidence.
      // Cargo's --offline refuses even the first checkout of a file:// Git URL.
      // Initial resolution reads only these local source repositories; subsequent
      // admission calls use --offline as well as --locked.
      run(cargo, ['generate-lockfile'], directory);
      return directory;
    }
    const cases = [
      ['comment, dotted inheritance, subtable and unrelated full rev', '', undefined, true],
      [
        'quoted table and multiline dependency fields',
        '\n["dependencies"."gpui"]\nworkspace = true\n',
        '',
        true,
      ],
      [
        'direct package alias',
        `gpui_legacy = { package = "gpui", ${declaration(legacy)} }`,
        undefined,
        false,
      ],
      [
        'inactive target dependency',
        `[target.'cfg(target_os = "none")'.dependencies]\ngpui_legacy = { package = "gpui", ${declaration(legacy)} }`,
        undefined,
        false,
      ],
      [
        'build dependency',
        `[build-dependencies]\ngpui_legacy = { package = "gpui", ${declaration(legacy)} }`,
        undefined,
        false,
      ],
      [
        'dev dependency',
        `[dev-dependencies]\ngpui_legacy = { package = "gpui", ${declaration(legacy)} }`,
        undefined,
        false,
      ],
      [
        'dependency subtable',
        `[dependencies.gpui_legacy]\npackage = "gpui"\ngit = "${legacy.git}"\nrev = "${legacy.revision}"`,
        undefined,
        false,
      ],
      [
        'optional alias enabled by all-features',
        `gpui_legacy = { package = "gpui", ${declaration(legacy)}, optional = true }`,
        undefined,
        false,
      ],
    ];
    for (const [name, extra, rootGpui, ok] of cases) {
      await t.test(name, () => {
        const directory = workspace(extra, rootGpui);
        const output = path.join(directory, 'graph.json');
        const result = spawnSync(
          process.execPath,
          [
            script,
            '--manifest-path',
            path.join(directory, 'Cargo.toml'),
            '--git',
            pinned.git,
            '--rev',
            pinned.revision,
            '--offline',
            '--output',
            output,
          ],
          { encoding: 'utf8' }
        );
        assert.equal(result.status, ok ? 0 : 1, result.stderr || result.stdout);
        const receipt = JSON.parse(readFileSync(output, 'utf8'));
        assert.equal(receipt.ok, ok);
        assert.deepEqual(
          receipt.errors,
          ok
            ? []
            : [
                `Expected exactly one resolved GPUI package; found 2: ${receipt.gpui.map(({ id }) => id).join(', ')}`,
              ]
        );
        assert.equal(receipt.sdk.length, 1);
        assert.ok(receipt.command.includes('--locked'));
        assert.ok(receipt.command.includes('--all-features'));
        assert.ok(!receipt.command.includes('--filter-platform'));
        assert.ok(JSON.parse(readFileSync(`${output}.metadata.json`, 'utf8')).resolve);
      });
    }
    await t.test('--no-deps metadata cannot prove the graph', () => {
      const directory = workspace();
      const value = JSON.parse(
        run(
          cargo,
          ['metadata', '--format-version', '1', '--locked', '--offline', '--no-deps'],
          directory
        )
      );
      assert.throws(() => inspectGpuiCargoGraph(value, pinned), /Complete Cargo metadata/);
    });
    await t.test('an external SDK with the same package name is a distinct identity', () => {
      const foreign = path.join(root, 'foreign-sdk');
      crate(
        foreign,
        'proto-ui-gpui-native',
        `\n[workspace]\n[dependencies]\ngpui = { ${declaration(pinned)} }\n`,
        '0.3.0'
      );
      const directory = workspace(
        `foreign_sdk = { package = "proto-ui-gpui-native", path = "${foreign.replaceAll('\\', '/')}" }`
      );
      const value = JSON.parse(
        run(
          cargo,
          ['metadata', '--format-version', '1', '--locked', '--all-features', '--offline'],
          directory
        )
      );
      const result = inspectGpuiCargoGraph(value, pinned);
      assert.equal(result.gpui.length, 1);
      assert.equal(result.sdk.length, 2);
      assert.deepEqual(result.errors, [
        `Expected exactly one shared Proto UI GPUI SDK package; found 2: ${result.sdk.map(({ id }) => id).join(', ')}`,
      ]);
    });
    await t.test('a missing lockfile fails rather than silently resolving or skipping', () => {
      const directory = workspace();
      rmSync(path.join(directory, 'Cargo.lock'));
      const output = path.join(directory, 'failed.json');
      const result = spawnSync(
        process.execPath,
        [
          script,
          '--manifest-path',
          path.join(directory, 'Cargo.toml'),
          '--git',
          pinned.git,
          '--rev',
          pinned.revision,
          '--offline',
          '--output',
          output,
        ],
        { encoding: 'utf8' }
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /lock file|lockfile|--locked/);
      const receipt = JSON.parse(readFileSync(output, 'utf8'));
      assert.equal(receipt.ok, false);
      assert.equal(receipt.metadataSha256, null);
      assert.equal(receipt.failure.stage, 'cargo-metadata');
      assert.equal(receipt.failure.exitCode, 101);
      assert.equal(existsSync(`${output}.metadata.json`), false);
    });
  }
);

test(
  'actual native consumer generation preserves a unique Cargo composition and every test target',
  {
    skip:
      cargoProbe.status !== 0 && !requireCargo
        ? 'Cargo unavailable; generated manifest parsing was not executed'
        : false,
  },
  (t) => {
    assert.equal(
      cargoProbe.status,
      0,
      `Cargo is required: ${cargoProbe.error ?? cargoProbe.stderr}`
    );
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    const fixture = path.join(repository, 'packages/compiler/test/fixtures/gpui-ordinary-values');
    const root = mkdtempSync(path.join(tmpdir(), 'proto-ui-gpui-generation-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const output = path.join(root, 'generated');
    const run = (command, args) => {
      const result = spawnSync(command, args, {
        cwd: repository,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.equal(
        result.status,
        0,
        `${command} ${args.join(' ')}: ${result.error ?? result.stderr}`
      );
      return result.stdout;
    };
    run(process.execPath, ['--import', 'tsx', path.join(fixture, 'produce.mjs'), output]);
    const manifest = path.join(output, 'transition/Cargo.toml');
    const lockfile = path.join(output, 'transition/Cargo.lock');
    const originalLock = readFileSync(path.join(fixture, 'Cargo.lock'));
    assert.deepEqual(readFileSync(lockfile), originalLock);
    // This checks the actual emitted TOML and target inventory without fetching
    // dependencies. It is not graph admission: the separate full metadata gate
    // still requires --locked, all dependencies and one shared SDK/GPUI identity.
    const metadata = JSON.parse(
      run(cargo, [
        'metadata',
        '--format-version',
        '1',
        '--no-deps',
        '--locked',
        '--offline',
        '--all-features',
        '--manifest-path',
        manifest,
      ])
    );
    assert.equal(metadata.resolve, null);
    assert.equal(metadata.packages.length, 1);
    const consumer = metadata.packages[0];
    assert.equal(consumer.name, 'proto-ui-gpui-consumer-transition');
    const expectedModules = [
      'transition',
      'base_button',
      'base_toggle',
      'base_label',
      'named_button',
      'generic_label',
      'generic_setup_label',
      'generic_label_target',
      'ordinary',
      'plain',
      'validation',
      'roundtrip',
      'scalars',
      'scroll_reader',
      'public_mutation',
      'external_scroll',
      'hook_pending',
      'hook_failed',
      'hook_undefined',
      'hook_project_failed',
      'hook_options',
      'hook_options_factory',
      'hook_options_multiple',
      'hook_options_nested',
      'hook_conditional',
      'hook_conditional_taken',
      'hook_conditional_multiple',
      'render_mutation',
      'validation_retry',
      'duplicate',
      'created_failure',
      'focus_scope',
      'focus_target',
      'cold',
      'context_a',
      'context_b',
      'context_child',
      'mutant',
    ];
    const receipt = JSON.parse(readFileSync(path.join(output, 'source-receipt.json'), 'utf8'));
    assert.deepEqual(receipt.modules.map(({ name }) => name).sort(), [...expectedModules].sort());
    const lockedConsumers = [
      ...originalLock
        .toString('utf8')
        .matchAll(/^\[\[package\]\]\r?\nname = "(proto-ui-gpui-consumer-[a-z0-9-]+)"/gm),
    ].map((match) => match[1]);
    assert.deepEqual(
      receipt.modules.map(({ packageName }) => packageName).sort(),
      lockedConsumers.sort(),
      'Every retained consumer package in the original Cargo lock must still be generated'
    );
    const dependencies = consumer.dependencies.filter(({ name }) =>
      name.startsWith('proto-ui-gpui-consumer-')
    );
    assert.deepEqual(
      dependencies.map(({ rename }) => rename).sort(),
      expectedModules.filter((name) => name !== 'transition').sort()
    );
    for (const dependency of dependencies) {
      assert.equal(
        dependency.name,
        'proto-ui-gpui-consumer-' + dependency.rename.replaceAll('_', '-')
      );
      assert.equal(
        realpathSync(dependency.path),
        realpathSync(path.join(output, dependency.rename))
      );
      assert.deepEqual(dependency.features, ['test-support']);
    }
    const targets = {
      ordinary: 'consumer.rs',
      control_label: 'control-label-consumer.rs',
      style_mapping: 'style-mapping-consumer.rs',
      a11y_activation: 'a11y-activation-consumer.rs',
      scroll_pause: 'scroll-pause-consumer.rs',
      scroll_reader: 'scroll-reader-consumer.rs',
    };
    assert.deepEqual(
      consumer.targets
        .filter(({ kind }) => kind.includes('test'))
        .map(({ name }) => name)
        .sort(),
      Object.keys(targets).sort()
    );
    for (const [target, source] of Object.entries(targets)) {
      assert.deepEqual(
        readFileSync(path.join(output, 'transition/tests', target + '.rs')),
        readFileSync(path.join(fixture, source))
      );
    }
    assert.deepEqual(readFileSync(lockfile), originalLock, 'Manifest parsing must retain the lock');
  }
);
