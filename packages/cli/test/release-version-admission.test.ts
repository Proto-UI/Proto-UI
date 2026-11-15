// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertRequiredProtoUiRelease, CLI_RELEASE_VERSION } from '../src/services/package-manager';

const adapter = '@proto.ui/adapter-react';
const prototype = '@proto.ui/prototypes-shadcn';
const roots: string[] = [];

function project(manifest: Record<string, unknown>) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pui-release-admission-'));
  roots.push(cwd);
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(manifest));
  return {
    cwd,
    check: () =>
      assertRequiredProtoUiRelease({
        cwd,
        projectPkg: manifest,
        requiredPackages: [adapter, prototype],
        packageManager: 'npm',
      }),
    install: (name: string, metadata: unknown) => {
      const directory = path.join(cwd, 'node_modules', name);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(metadata));
      return directory;
    },
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('required official package release admission', () => {
  it('preserves exact declarations before first install and missing-package planning', () => {
    const fixture = project({ dependencies: { [adapter]: CLI_RELEASE_VERSION, react: '^19' } });
    const before = fs.readFileSync(path.join(fixture.cwd, 'package.json'), 'utf8');
    expect(fixture.check).not.toThrow();
    expect(fs.readFileSync(path.join(fixture.cwd, 'package.json'), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(fixture.cwd, 'node_modules'))).toBe(false);
  });

  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])(
    'rejects a different release in %s even before installation',
    (field) => {
      const fixture = project({ [field]: { [adapter]: '0.2.0' } });
      expect(fixture.check).toThrow(`${field} declares "0.2.0"`);
      expect(fixture.check).toThrow(
        `npm install --save --save-exact ${adapter}@${CLI_RELEASE_VERSION}`
      );
    }
  );

  it.each(['next', 'latest', '*', `^${CLI_RELEASE_VERSION}`, `>=${CLI_RELEASE_VERSION}`, 42, null])(
    'rejects a non-exact declaration %s even with a matching installed version',
    (value) => {
      const fixture = project({ dependencies: { [adapter]: value } });
      fixture.install(adapter, { name: adapter, version: CLI_RELEASE_VERSION });
      expect(fixture.check).toThrow('release mismatch');
    }
  );

  it('does not hide a conflicting duplicate dependency behind the first matching declaration', () => {
    const fixture = project({
      dependencies: { [adapter]: CLI_RELEASE_VERSION },
      devDependencies: { [adapter]: '0.2.0' },
    });
    expect(fixture.check).toThrow('devDependencies declares "0.2.0"');
  });

  it('rejects stale installed metadata despite an exact updated declaration', () => {
    const fixture = project({ dependencies: { [adapter]: CLI_RELEASE_VERSION } });
    fixture.install(adapter, { name: adapter, version: '0.2.0' });
    expect(fixture.check).toThrow('installed identity is "@proto.ui/adapter-react"@"0.2.0"');
  });

  it.each([
    'file:../candidate.tgz',
    'link:../candidate',
    'workspace:*',
    `npm:${adapter}@${CLI_RELEASE_VERSION}`,
  ])('accepts %s only with the actual matching package identity', (specifier) => {
    const fixture = project({ dependencies: { [adapter]: specifier } });
    expect(fixture.check).toThrow('no installed package identity');
    const directory = fixture.install(adapter, {
      name: adapter,
      version: CLI_RELEASE_VERSION,
      exports: {},
    });
    // Admission must not execute package code or require an exported metadata path.
    fs.writeFileSync(path.join(directory, 'index.js'), 'throw new Error("must not execute");');
    expect(fixture.check).not.toThrow();
  });

  it.each([
    ['file:../candidate.tgz', { name: '@unrelated/adapter', version: CLI_RELEASE_VERSION }],
    ['file:../candidate.tgz', { name: adapter, version: '0.2.0' }],
    [
      `npm:${adapter}@${CLI_RELEASE_VERSION}`,
      { name: '@unrelated/adapter', version: CLI_RELEASE_VERSION },
    ],
    [`npm:${adapter}@${CLI_RELEASE_VERSION}`, { name: adapter, version: '0.2.0' }],
  ])('rejects a misleading installed identity for %s', (specifier, metadata) => {
    const fixture = project({ dependencies: { [adapter]: specifier } });
    fixture.install(adapter, metadata);
    expect(fixture.check).toThrow('installed identity');
  });

  it.each([
    `npm:@unrelated/adapter@${CLI_RELEASE_VERSION}`,
    `npm:${adapter}@next`,
    `npm:${adapter}@0.2.0`,
  ])('does not admit the alias %s through matching installed metadata', (specifier) => {
    const fixture = project({ dependencies: { [adapter]: specifier } });
    fixture.install(adapter, { name: adapter, version: CLI_RELEASE_VERSION });
    expect(fixture.check).toThrow('release mismatch');
  });

  it.each([null, [], { name: adapter }, 'invalid'])(
    'rejects invalid installed metadata %s',
    (metadata) => {
      const fixture = project({ dependencies: { [adapter]: CLI_RELEASE_VERSION } });
      fixture.install(adapter, metadata);
      expect(fixture.check).toThrow('release mismatch');
    }
  );

  it('ignores unrelated framework and Proto UI packages outside this required consumer', () => {
    const fixture = project({
      dependencies: { [adapter]: CLI_RELEASE_VERSION, react: '^18', '@proto.ui/cli': '0.2.0' },
    });
    expect(fixture.check).not.toThrow();
  });

  it('reads a hoisted local package from a consumer ancestor without requiring package exports', () => {
    const manifest = { dependencies: { [adapter]: 'workspace:*' } };
    const fixture = project(manifest);
    fixture.install(adapter, { name: adapter, version: CLI_RELEASE_VERSION, exports: {} });
    const child = path.join(fixture.cwd, 'apps', 'consumer');
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(path.join(child, 'package.json'), JSON.stringify(manifest));
    expect(() =>
      assertRequiredProtoUiRelease({
        cwd: child,
        projectPkg: manifest,
        requiredPackages: [adapter],
        packageManager: 'pnpm',
      })
    ).not.toThrow();
  });

  it('reads the actual metadata behind a local package symlink', () => {
    const fixture = project({ dependencies: { [adapter]: 'link:../candidate' } });
    const candidate = path.join(fixture.cwd, 'candidate');
    fs.mkdirSync(candidate);
    fs.writeFileSync(
      path.join(candidate, 'package.json'),
      JSON.stringify({ name: adapter, version: CLI_RELEASE_VERSION })
    );
    fs.mkdirSync(path.join(fixture.cwd, 'node_modules', '@proto.ui'), { recursive: true });
    fs.symlinkSync(candidate, path.join(fixture.cwd, 'node_modules', adapter), 'junction');
    expect(fixture.check).not.toThrow();
    fs.writeFileSync(
      path.join(candidate, 'package.json'),
      JSON.stringify({ name: adapter, version: '0.2.0' })
    );
    expect(fixture.check).toThrow('installed identity');
  });
});
