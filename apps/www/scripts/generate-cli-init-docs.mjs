import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cli = path.join(repo, 'packages/cli');
const output = path.join(repo, 'apps/www/src/generated/cli-init.generated.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function scanGenerated(root, prefix = '') {
  if (
    prefix &&
    (path.posix.isAbsolute(prefix) ||
      prefix.split('/').some((part) => !part || part === '.' || part === '..') ||
      prefix.includes('\\'))
  )
    throw new Error('Invalid generated relative path');
  const entries = [];
  for (const entry of (await readdir(path.join(root, prefix), { withFileTypes: true })).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  )) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory()))
      throw new Error(`Unsupported generated entry: ${relative}`);
    if (entry.isDirectory()) {
      entries.push({ path: relative, kind: 'directory' });
      entries.push(...(await scanGenerated(root, relative)));
    } else {
      const bytes = await readFile(path.join(root, relative));
      const content = bytes.toString('utf8');
      if (!Buffer.from(content).equals(bytes))
        throw new Error(`Non-UTF8 generated file: ${relative}`);
      entries.push({
        path: relative,
        kind: 'file',
        bytes: bytes.length,
        sha256: sha256(bytes),
        content,
      });
    }
  }
  return entries;
}
export function directoryText(entries) {
  const lines = ['your-project/'];
  const visit = (parent, indent) => {
    const children = entries.filter((entry) => path.posix.dirname(entry.path) === (parent || '.'));
    children.forEach((entry, index) => {
      const last = index === children.length - 1;
      lines.push(
        `${indent}${last ? '└── ' : '├── '}${path.posix.basename(entry.path)}${entry.kind === 'directory' ? '/' : ''}`
      );
      if (entry.kind === 'directory') visit(entry.path, indent + (last ? '    ' : '│   '));
    });
  };
  visit('', '');
  return lines.join('\n') + '\n';
}
async function digestTree(root) {
  return sha256(JSON.stringify((await scanGenerated(root)).map(({ content, ...entry }) => entry)));
}
export async function generateCliInitDocs() {
  // A failed build must not retain an old successful-looking documentation fixture.
  await rm(output, { force: true });
  let publication;
  const temporary = await mkdtemp(path.join(tmpdir(), 'proto-ui-init-docs-'));
  try {
    const project = path.join(temporary, 'project');
    const home = path.join(temporary, 'home');
    await mkdir(project);
    await mkdir(home);
    const env = { PATH: process.env.PATH ?? '', HOME: home, TMPDIR: temporary, CI: '1' };
    // Build here, not only in a package script: direct extraction cannot pair
    // current source provenance with stale or partially built CLI output.
    const build = spawnSync(
      process.execPath,
      [path.join(repo, 'scripts/build/public-packages.mjs'), '--package', '@proto.ui/cli'],
      {
        cwd: repo,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
        env,
      }
    );
    if (build.error || build.signal || build.status !== 0)
      throw new Error(
        `CLI build failed: ${build.error?.message ?? build.signal ?? build.status}\n${build.stderr}\n${build.stdout}`
      );
    const sourceTreeHash = await digestTree(path.join(cli, 'src'));
    const buildTreeHash = await digestTree(path.join(cli, 'dist'));
    const argv = ['init', '--no-interactive', '--no-install', '--prototypes', 'shadcn'];
    const result = spawnSync(process.execPath, [path.join(cli, 'bin/proto-ui.js'), ...argv], {
      cwd: project,
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      env,
    });
    if (result.error || result.signal || result.status !== 0)
      throw new Error(
        `CLI init failed: ${result.error?.message ?? result.signal ?? result.status}\n${result.stderr}`
      );
    const entries = await scanGenerated(project);
    const files = entries.filter((entry) => entry.kind === 'file');
    const expected = [
      'proto-ui/config.json',
      'src/styles/proto-ui-style.css',
      'src/styles/proto-ui-tokens.generated.css',
      'src/styles/shadcn-theme.css',
    ];
    if (JSON.stringify(files.map((entry) => entry.path).sort()) !== JSON.stringify(expected.sort()))
      throw new Error(
        'CLI init output files changed; review the documentation generation contract.'
      );
    const expectedDirectories = [
      'proto-ui',
      'proto-ui/adapters',
      'proto-ui/components',
      'proto-ui/prototypes',
      'src',
      'src/styles',
    ];
    if (
      JSON.stringify(
        entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path)
      ) !== JSON.stringify(expectedDirectories)
    )
      throw new Error('CLI init directory contract changed.');
    if (
      sourceTreeHash !== (await digestTree(path.join(cli, 'src'))) ||
      buildTreeHash !== (await digestTree(path.join(cli, 'dist')))
    )
      throw new Error('CLI source or build changed during extraction.');
    const pkg = JSON.parse(await readFile(path.join(cli, 'package.json'), 'utf8'));
    const manifest = {
      schemaVersion: 1,
      cli: {
        name: pkg.name,
        version: pkg.version,
        sourceTreeHash,
        buildTreeHash,
        entryHash: sha256(await readFile(path.join(cli, 'bin/proto-ui.js'))),
        packageHash: sha256(await readFile(path.join(cli, 'package.json'))),
        extractorHash: sha256(await readFile(fileURLToPath(import.meta.url))),
      },
      invocation: { executable: 'node', entry: 'packages/cli/bin/proto-ui.js', argv },
      inputs: [],
      entries,
      directory: directoryText(entries),
    };
    await mkdir(path.dirname(output), { recursive: true });
    publication = await mkdtemp(path.join(path.dirname(output), '.cli-init-'));
    const next = path.join(publication, 'manifest.json');
    await writeFile(next, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    await rename(next, output);
    console.log(`[docs] extracted real ${pkg.name}@${pkg.version} init: ${files.length} files`);
    return manifest;
  } finally {
    if (publication) await rm(publication, { recursive: true, force: true });
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await generateCliInitDocs();
