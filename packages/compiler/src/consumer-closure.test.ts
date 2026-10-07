// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyConsumerClosure } from './consumer-closure';
import type { ConsumerClosureExpectation } from './consumer-closure';

const temporary: string[] = [];
type Manifest = Record<string, unknown>;

async function writeJson(filename: string, value: unknown) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, JSON.stringify(value));
}

/** A genuine npm-style gzip tar archive containing a package manifest. */
function packedManifest(name: string, version: string): Buffer {
  const contents = Buffer.from(JSON.stringify({ name, version }));
  const header = Buffer.alloc(512);
  header.write('package/package.json');
  header.write('0000644\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  header.write(`${contents.length.toString(8).padStart(11, '0')}\0`, 124);
  header.write('00000000000\0', 136);
  header.fill(32, 148, 156);
  header.write('0', 156);
  header.write('ustar\0', 257);
  header.write('00', 263);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  return gzipSync(
    Buffer.concat([
      header,
      contents,
      Buffer.alloc((512 - (contents.length % 512)) % 512),
      Buffer.alloc(1024),
    ])
  );
}

async function consumer() {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-consumer-closure-'));
  temporary.push(root);
  const expected: ConsumerClosureExpectation = {
    profile: 'react-dom-source-v1',
    dependencies: [
      { name: 'react', version: '19.2.6', role: 'target' },
      { name: 'react-dom', version: '19.2.6', role: 'target' },
    ],
    generatedFiles: ['generated/Component.tsx'],
    provenanceFile: 'generated/provenance.json',
  };
  const manifest: Manifest = {
    name: 'clean-consumer',
    version: '1.0.0',
    private: true,
    dependencies: { react: '19.2.6', 'react-dom': '19.2.6' },
  };
  const locks: Record<string, Manifest> = {
    '': { name: 'clean-consumer', version: '1.0.0', dependencies: manifest.dependencies },
  };
  const install = async (
    name: string,
    version: string,
    edges: Manifest = {},
    location = `node_modules/${name}`
  ) => {
    const directory = path.join(root, location);
    await writeJson(path.join(directory, 'package.json'), { name, version, ...edges });
    const { devDependencies: _developmentOnly, ...lockedEdges } = edges;
    locks[location] = {
      version,
      resolved: `https://registry.invalid/${name}/package-${version}.tgz`,
      ...lockedEdges,
    };
    return directory;
  };
  const save = async () => {
    await writeJson(path.join(root, 'package.json'), manifest);
    await writeJson(path.join(root, 'package-lock.json'), { lockfileVersion: 3, packages: locks });
  };
  await install('react', '19.2.6', { devDependencies: { typescript: '^5.0.0' } });
  await install('react-dom', '19.2.6', {
    dependencies: { scheduler: '0.27.0' },
    peerDependencies: { react: '19.2.6' },
  });
  await install('scheduler', '0.27.0');
  await save();
  await writeJson(path.join(root, expected.provenanceFile), {
    profile: expected.profile,
    backend: expected.profile,
    dependencies: expected.dependencies,
  });
  await writeFile(
    path.join(root, 'generated/Component.tsx'),
    'import * as React from "react"; import { createRoot } from "react-dom/client"; export const Component = () => <div />;'
  );
  return { root, expected, manifest, locks, install, save };
}

async function packedConsumer() {
  const fixture = await consumer();
  const name = '@proto.ui/host-helper';
  const bytes = packedManifest(name, '1.2.3');
  const tarballPath = path.join(fixture.root, 'release/host-helper.tgz');
  await mkdir(path.dirname(tarballPath));
  await writeFile(tarballPath, bytes);
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  const dependency = { name, version: '1.2.3', role: 'host-bridge' as const };
  const expected: ConsumerClosureExpectation = {
    ...fixture.expected,
    dependencies: [...fixture.expected.dependencies, dependency],
    helpers: [{ name, version: '1.2.3', classification: 'host-bridge', delivery: 'dependency' }],
    tarballs: { [name]: { path: 'release/host-helper.tgz', integrity } },
  };
  (fixture.manifest.dependencies as Record<string, string>)[name] = 'file:release/host-helper.tgz';
  await fixture.install(name, '1.2.3');
  fixture.locks[`node_modules/${name}`].resolved = 'file:release/host-helper.tgz';
  fixture.locks[`node_modules/${name}`].integrity = integrity;
  await fixture.save();
  await writeJson(path.join(fixture.root, expected.provenanceFile), {
    profile: expected.profile,
    dependencies: expected.dependencies,
    helpers: expected.helpers,
  });
  return { ...fixture, expected, name, tarballPath, bytes, integrity };
}

afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('installed compiler-output consumer closure', () => {
  it('reports installed transitive cost, not declarations or absent optional/platform lock records', async () => {
    const fixture = await consumer();
    const optionalDependencies = {
      '@vendor/installed-platform': '2.0.0',
      '@vendor/absent-platform': '2.0.0',
    };
    await fixture.install('react-dom', '19.2.6', {
      dependencies: { scheduler: '0.27.0' },
      peerDependencies: { react: '19.2.6' },
      optionalDependencies,
    });
    await fixture.install('@vendor/installed-platform', '2.0.0', {
      optional: true,
      os: ['linux'],
      cpu: ['x64'],
    });
    fixture.locks['node_modules/@vendor/absent-platform'] = {
      version: '2.0.0',
      optional: true,
      os: ['darwin'],
      cpu: ['arm64'],
    };
    await fixture.save();
    const result = await verifyConsumerClosure(fixture.root, fixture.expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    expect(result.value.external.map((entry) => entry.name).sort()).toEqual([
      '@vendor/installed-platform',
      'react',
      'react-dom',
      'scheduler',
    ]);
    expect(result.value.external.find((entry) => entry.name === 'scheduler')?.declared).toBe(false);
    expect(
      result.value.external.find((entry) => entry.name === '@vendor/installed-platform')?.optional
    ).toBe(true);
    expect(result.value.lockOnly).toEqual([
      {
        name: '@vendor/absent-platform',
        path: 'node_modules/@vendor/absent-platform',
        version: '2.0.0',
        optional: true,
        dev: false,
        os: ['darwin'],
        cpu: ['arm64'],
      },
    ]);
  });

  it('parses sources without executing them or mistaking comments/strings for imports', async () => {
    const fixture = await consumer();
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      '// import "@proto.ui/core";\nconst text = "require(\\\"leaked\\\")";\nthrow new Error("this consumer source must never execute");\nexport { createRoot } from "react-dom/client";'
    );
    const result = await verifyConsumerClosure(fixture.root, fixture.expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    expect(result.value.imports.map((entry) => entry.specifier)).toEqual(['react-dom/client']);
  });

  it('follows local re-exports and rejects importing an installed but undeclared transitive package', async () => {
    const fixture = await consumer();
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export { Mount } from "./mount.js";'
    );
    await writeFile(
      path.join(fixture.root, 'generated/mount.tsx'),
      'import scheduler from "scheduler"; export const Mount = () => <div />;'
    );
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'undeclared-import', package: 'scheduler', path: 'generated/mount.tsx' }],
    });
  });

  it('rejects nonliteral dynamic imports instead of claiming an unknown closure is empty', async () => {
    const fixture = await consumer();
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export async function load(name: string) { return import(name); }'
    );
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'dynamic-import' }],
    });
  });

  it('rejects a static require leak even when nested in an uncalled function', async () => {
    const fixture = await consumer();
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export function load() { return require("undeclared-runtime"); }'
    );
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'undeclared-import', package: 'undeclared-runtime' }],
    });
  });

  it('recognizes CommonJS module.require rather than overlooking a member-call import', async () => {
    const fixture = await consumer();
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export function load() { return module["require"]("undeclared-runtime"); }'
    );
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'undeclared-import', package: 'undeclared-runtime' }],
    });
  });

  it('rejects internal transitives reached only through native target roots, including nested installs', async () => {
    const fixture = await consumer();
    await fixture.install('scheduler', '0.27.0', {
      dependencies: { '@proto.ui/core': '0.3.0-alpha.1' },
    });
    await fixture.install(
      '@proto.ui/core',
      '0.3.0-alpha.1',
      {},
      'node_modules/scheduler/node_modules/@proto.ui/core'
    );
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'undeclared-package', package: '@proto.ui/core' }],
    });
  });

  it('does not attribute unrelated installed application or workspace packages to emitted output', async () => {
    const fixture = await consumer();
    await fixture.install('@proto.ui/app-widget', '3.0.0');
    const workspace = path.join(fixture.root, 'workspace/widget');
    await writeJson(path.join(workspace, 'package.json'), {
      name: '@app/local-widget',
      version: '1.0.0',
    });
    await mkdir(path.join(fixture.root, 'node_modules/@app'));
    await symlink(workspace, path.join(fixture.root, 'node_modules/@app/local-widget'), 'dir');
    (fixture.manifest.dependencies as Record<string, string>)['@app/local-widget'] =
      'file:workspace/widget';
    fixture.locks['node_modules/@app/local-widget'] = { link: true, resolved: 'workspace/widget' };
    await fixture.save();
    const result = await verifyConsumerClosure(fixture.root, fixture.expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    expect(result.value.internal).toEqual([]);
    expect(result.value.external.map((entry) => entry.name).sort()).toEqual([
      'react',
      'react-dom',
      'scheduler',
    ]);
  });

  it('requires the installed required transitive graph even if the missing package remains in the lockfile', async () => {
    const fixture = await consumer();
    await rm(path.join(fixture.root, 'node_modules/scheduler'), { recursive: true });
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'missing-package', package: 'scheduler' }],
    });
  });

  it('rejects a matching lock/manifest install when it has the wrong profile version', async () => {
    const fixture = await consumer();
    await fixture.install('react', '18.3.1', { devDependencies: { typescript: '^5.0.0' } });
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'version-mismatch', package: 'react' }],
    });
  });

  it('rejects manifest dependency tampering that disagrees with the installed lock resolution', async () => {
    const fixture = await consumer();
    await writeJson(path.join(fixture.root, 'node_modules/react-dom/package.json'), {
      name: 'react-dom',
      version: '19.2.6',
      dependencies: { scheduler: '0.27.0', '@proto.ui/core': '0.3.0-alpha.1' },
      peerDependencies: { react: '19.2.6' },
    });
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'lock-mismatch', package: 'react-dom' }],
    });
  });

  it('rejects the wrong on-disk profile before attributing an install to the requested backend', async () => {
    const fixture = await consumer();
    await writeJson(path.join(fixture.root, fixture.expected.provenanceFile), {
      profile: 'react-runtime-v1',
      dependencies: fixture.expected.dependencies,
    });
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'profile-mismatch' }],
    });
  });

  it('rejects workspace symlinks even when the workspace itself is inside the consumer root', async () => {
    const fixture = await consumer();
    const workspace = path.join(fixture.root, 'workspace/react');
    await writeJson(path.join(workspace, 'package.json'), { name: 'react', version: '19.2.6' });
    await rm(path.join(fixture.root, 'node_modules/react'), { recursive: true });
    await symlink(workspace, path.join(fixture.root, 'node_modules/react'), 'dir');
    fixture.locks['node_modules/react'] = { link: true, resolved: 'workspace/react' };
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'unsafe-path', package: 'react' }],
    });
  });

  it('rejects an escaping package-manifest symlink, not just the package directory path', async () => {
    const fixture = await consumer();
    const outside = await mkdtemp(path.join(tmpdir(), 'proto-consumer-outside-'));
    temporary.push(outside);
    await writeJson(path.join(outside, 'package.json'), { name: 'react', version: '19.2.6' });
    const installedManifest = path.join(fixture.root, 'node_modules/react/package.json');
    await rm(installedManifest);
    await symlink(path.join(outside, 'package.json'), installedManifest);
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'unsafe-path', package: 'react' }],
    });
  });

  it('reports a dependency helper from installed package/realpath evidence and verified packed bytes', async () => {
    const fixture = await packedConsumer();
    const result = await verifyConsumerClosure(fixture.root, fixture.expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    expect(result.value.internal.map((entry) => entry.name)).toEqual([fixture.name]);
    const helper = result.value.helpers[0];
    expect(helper.delivery).toBe('dependency');
    if (helper.delivery !== 'dependency') throw new Error('Wrong helper delivery');
    expect(helper.packages[0].realPath).toBe(
      await realpath(path.join(fixture.root, 'node_modules', fixture.name))
    );
    expect(helper.packages[0].tarball?.integrity).toBe(
      `sha512-${createHash('sha512')
        .update(await readFile(fixture.tarballPath))
        .digest('base64')}`
    );
  });

  it('checks packed internal transitives without permitting generated imports of those transitives', async () => {
    const fixture = await packedConsumer();
    const child = '@proto.ui/child-helper';
    const bytes = packedManifest(child, '2.0.0');
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    await writeFile(path.join(fixture.root, 'release/child.tgz'), bytes);
    await writeJson(path.join(fixture.root, 'node_modules', fixture.name, 'package.json'), {
      name: fixture.name,
      version: '1.2.3',
      dependencies: { [child]: '2.0.0' },
    });
    fixture.locks[`node_modules/${fixture.name}`].dependencies = { [child]: '2.0.0' };
    await fixture.install(child, '2.0.0');
    fixture.locks[`node_modules/${child}`].resolved = 'file:release/child.tgz';
    fixture.locks[`node_modules/${child}`].integrity = integrity;
    await fixture.save();
    const expected: ConsumerClosureExpectation = {
      ...fixture.expected,
      tarballs: {
        ...fixture.expected.tarballs,
        [child]: { path: 'release/child.tgz', version: '2.0.0', integrity },
      },
    };
    const result = await verifyConsumerClosure(fixture.root, expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    expect(result.value.internal.find((entry) => entry.name === child)).toMatchObject({
      declared: false,
      roles: ['host-bridge'],
      tarball: { integrity },
    });
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      `export * from ${JSON.stringify(child)};`
    );
    expect(await verifyConsumerClosure(fixture.root, expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'undeclared-import', package: child }],
    });
  });

  it('checks every reachable installed duplicate against the expected packed artifact', async () => {
    const fixture = await consumer();
    const bytes = packedManifest('react', '19.2.6');
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    await mkdir(path.join(fixture.root, 'release'));
    await writeFile(path.join(fixture.root, 'release/react.tgz'), bytes);
    await writeFile(path.join(fixture.root, 'release/other-react.tgz'), bytes);
    const nested = 'node_modules/react-dom/node_modules/react';
    await fixture.install('react', '19.2.6', {}, nested);
    (fixture.manifest.dependencies as Record<string, string>).react = 'file:release/react.tgz';
    for (const location of ['node_modules/react', nested]) {
      fixture.locks[location].resolved = 'file:release/react.tgz';
      fixture.locks[location].integrity = integrity;
    }
    await fixture.save();
    const expected: ConsumerClosureExpectation = {
      ...fixture.expected,
      tarballs: { react: { path: 'release/react.tgz', version: '19.2.6', integrity } },
    };
    const result = await verifyConsumerClosure(fixture.root, expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    expect(
      result.value.external
        .filter((entry) => entry.name === 'react')
        .map((entry) => entry.lockPath)
        .sort()
    ).toEqual(['node_modules/react', nested].sort());
    fixture.locks[nested].resolved = 'file:release/other-react.tgz';
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'tarball-path-mismatch', package: 'react' }],
    });
  });

  it('rejects resolving a different tarball even with the same package name, version and archive bytes', async () => {
    const fixture = await packedConsumer();
    await writeFile(path.join(fixture.root, 'release/other.tgz'), fixture.bytes);
    (fixture.manifest.dependencies as Record<string, string>)[fixture.name] =
      'file:release/other.tgz';
    fixture.locks[`node_modules/${fixture.name}`].resolved = 'file:release/other.tgz';
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'tarball-path-mismatch', package: fixture.name }],
    });
  });

  it('rejects the lockfile integrity when only the separately supplied expected integrity matches', async () => {
    const fixture = await packedConsumer();
    fixture.locks[`node_modules/${fixture.name}`].integrity =
      `sha512-${createHash('sha512').update('different archive').digest('base64')}`;
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'integrity-mismatch' }],
    });
  });

  it('hashes the actual archive bytes rather than trusting matching expected/lock integrity strings', async () => {
    const fixture = await packedConsumer();
    await writeFile(fixture.tarballPath, packedManifest(fixture.name, '9.9.9'));
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'integrity-mismatch' }],
    });
  });

  it('requires the strongest SRI digest even if an additional weaker token matches', async () => {
    const fixture = await packedConsumer();
    fixture.locks[`node_modules/${fixture.name}`].integrity =
      `sha512-${createHash('sha512').update('wrong').digest('base64')} sha1-${createHash('sha1').update(fixture.bytes).digest('base64')}`;
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'integrity-mismatch' }],
    });
  });

  it('does not report an inline helper cost when the helper exists only in provenance', async () => {
    const fixture = await consumer();
    const expected: ConsumerClosureExpectation = {
      ...fixture.expected,
      helpers: [
        {
          name: 'createOwner',
          version: '1',
          classification: 'native-lowering',
          delivery: 'inline',
        },
      ],
    };
    await writeJson(path.join(fixture.root, expected.provenanceFile), {
      profile: expected.profile,
      dependencies: expected.dependencies,
      helpers: expected.helpers,
    });
    expect(await verifyConsumerClosure(fixture.root, expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'missing-helper' }],
    });
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export function createOwner() { return { label: "雪" }; }'
    );
    const result = await verifyConsumerClosure(fixture.root, expected);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.failures));
    const helper = result.value.helpers[0];
    if (helper.delivery !== 'inline') throw new Error('Wrong helper delivery');
    const evidence = helper.declarations[0];
    expect(evidence.utf8Bytes).toBe(
      Buffer.byteLength('export function createOwner() { return { label: "雪" }; }')
    );
  });

  it('rejects traversal in generated imports and package lock paths without reading outside the consumer', async () => {
    const fixture = await consumer();
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export * from "../../outside.ts";'
    );
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'unsafe-path' }],
    });
    await writeFile(
      path.join(fixture.root, 'generated/Component.tsx'),
      'export const Component = 1;'
    );
    fixture.locks['../outside/node_modules/leaked'] = { version: '1.0.0', optional: true };
    await fixture.save();
    expect(await verifyConsumerClosure(fixture.root, fixture.expected)).toMatchObject({
      ok: false,
      failures: [{ code: 'unsafe-path' }],
    });
  });
});
