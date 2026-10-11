#!/usr/bin/env node

// Local draft distribution is deliberately separate from release admission.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  ROOT_DIR,
  buildPublicPackage,
  getPublicPackages,
  topoSortPackages,
} from './public-packages.mjs';

export const DRAFT_FAMILIES = ['bootstrap-2-3-2', 'liquid-glass'];
export const DRAFT_VERSION = '0.0.0-draft';

export function draftExports(manifest) {
  if (manifest.private !== true || manifest.protoUi?.release?.scan !== false)
    throw new Error('Draft builds require private:true and release.scan:false');
  return Object.fromEntries(
    Object.entries(manifest.exports).map(([subpath, entry]) => {
      const source = entry.default;
      if (
        !/^\.\/src\/(?:[\w-]+\/)*[\w.-]+\.ts$/.test(source) ||
        source.includes('..') ||
        entry.types !== source
      )
        throw new Error(`Unsupported draft source export: ${subpath}`);
      const stem = source.replace('./src/', './dist/').slice(0, -3);
      return [subpath, { types: `${stem}.d.ts`, import: `${stem}.js`, default: `${stem}.js` }];
    })
  );
}

export function localManifest(manifest, versions, exports = manifest.exports) {
  const result = {
    name: manifest.name,
    version: versions.get(manifest.name),
    private: true,
    type: 'module',
    sideEffects: manifest.sideEffects,
    description: `Local draft consumer artifact only. ${manifest.description ?? ''}`,
    exports,
    files: [
      'dist/',
      'README.md',
      'LICENSE',
      ...(manifest.protoUi?.release?.thirdPartyNotices ?? []),
    ],
    protoUi: {
      release: { scan: false },
      distribution: { kind: 'local-draft', publicAdmission: false },
    },
  };
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!manifest[field]) continue;
    result[field] = Object.fromEntries(
      Object.entries(manifest[field]).map(([name, version]) => {
        if (versions.has(name)) return [name, versions.get(name)];
        if (String(version).startsWith('workspace:'))
          throw new Error(`Unstaged workspace dependency: ${name}`);
        return [name, version];
      })
    );
  }
  if (manifest.peerDependenciesMeta) result.peerDependenciesMeta = manifest.peerDependenciesMeta;
  return result;
}

function run(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: 180000,
    env: {
      ...process.env,
      npm_config_offline: 'true',
      npm_config_ignore_scripts: 'true',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  });
  if (result.status !== 0)
    throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

export function buildDraftPackages(names, { pack = false } = {}) {
  const publicPackages = getPublicPackages();
  const byName = new Map(publicPackages.map((pkg) => [pkg.name, pkg]));
  const drafts = names.map((name) => {
    const family = DRAFT_FAMILIES.find((family) => name === `@proto.ui/prototypes-${family}`);
    if (!family) throw new Error(`Not an admitted local draft package: ${name}`);
    const dir = join(ROOT_DIR, 'packages/prototypes', family);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return { name, dir, manifest, exports: draftExports(manifest) };
  });
  if (!drafts.length) throw new Error('Specify at least one --package');
  const selected = new Set();
  function visit(name) {
    if (selected.has(name)) return;
    const pkg = byName.get(name);
    if (!pkg) throw new Error(`Unbuildable draft prerequisite: ${name}`);
    selected.add(name);
    for (const dependency of pkg.buildDeps) visit(dependency);
  }
  for (const pkg of drafts)
    for (const name of Object.keys(pkg.manifest.dependencies ?? {})) visit(name);
  const prerequisites = topoSortPackages(publicPackages).filter((pkg) => selected.has(pkg.name));
  // Use the normal compiler, explicit export roots and dependency order. Never
  // add private drafts to getPublicPackages or the release discovery graph.
  for (const pkg of prerequisites) buildPublicPackage(pkg);
  const outDir = mkdtempSync(join(tmpdir(), 'proto-ui-local-draft-'));
  const versions = new Map([...prerequisites, ...drafts].map((pkg) => [pkg.name, DRAFT_VERSION]));
  const packages = [];
  for (const pkg of [...prerequisites, ...drafts]) {
    const stageDir = join(outDir, pkg.name.replace('@proto.ui/', ''));
    mkdirSync(stageDir);
    if (pkg.exports) {
      buildPublicPackage(
        { ...pkg, manifest: { ...pkg.manifest, exports: pkg.exports } },
        { outDir: join(stageDir, 'dist'), validate: false }
      );
    } else cpSync(join(pkg.dir, 'dist'), join(stageDir, 'dist'), { recursive: true });
    const manifest = localManifest(pkg.manifest, versions, pkg.exports);
    for (const entry of Object.values(manifest.exports))
      for (const target of Object.values(entry)) {
        if (typeof target !== 'string' || target.includes('*')) continue;
        if (!existsSync(join(stageDir, target)))
          throw new Error(`${pkg.name}: missing built export ${target}`);
      }
    writeFileSync(join(stageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    for (const file of ['README.md', ...(pkg.manifest.protoUi?.release?.thirdPartyNotices ?? [])]) {
      if (existsSync(join(pkg.dir, file))) cpSync(join(pkg.dir, file), join(stageDir, file));
    }
    cpSync(join(ROOT_DIR, 'LICENSE'), join(stageDir, 'LICENSE'));
    const artifact = { name: pkg.name, stageDir, kind: 'local-draft', publicAdmission: false };
    if (pack) {
      const [packed] = JSON.parse(
        run(
          [
            join(ROOT_DIR, 'node_modules/npm/bin/npm-cli.js'),
            'pack',
            '--json',
            '--ignore-scripts',
            '--offline',
            '--pack-destination',
            outDir,
            '--cache',
            join(outDir, '.npm-cache'),
          ],
          stageDir
        )
      );
      artifact.tarball = join(outDir, packed.filename);
      artifact.sha256 = createHash('sha256').update(readFileSync(artifact.tarball)).digest('hex');
    }
    packages.push(artifact);
  }
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT_DIR, encoding: 'utf8' });
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT_DIR, encoding: 'utf8' });
  const report = {
    kind: 'local-draft',
    publicAdmission: false,
    sourceRevision: revision.stdout.trim(),
    dirty: !!dirty.stdout.trim(),
    consumerValidation: 'not-run',
    outDir,
    packages,
  };
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const names = [];
  let pack = false;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--package') names.push(process.argv[++i]);
    else if (process.argv[i] === '--pack') pack = true;
    else if (process.argv[i] !== '--') throw new Error(`Unknown argument: ${process.argv[i]}`);
  }
  console.log(JSON.stringify(buildDraftPackages(names, { pack }), null, 2));
}
