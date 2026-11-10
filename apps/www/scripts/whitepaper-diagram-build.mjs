import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readContrastProvenance } from './contrast-provenance.mjs';
import { diagramSha256 } from './whitepaper-diagram-evidence-receipts.mjs';

// Same source-before/build/source-after discipline as reading-reference-production.
// The inventory includes emitted HTML, CSS, scripts and copied assets, so a later
// capture cannot silently combine a current SVG with stale production output.
export async function diagramBuildInventory(dist) {
  const files = [];
  const visit = async (directory) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else {
        assert.ok(entry.isFile(), 'Diagram build evidence requires regular files');
        const bytes = await fs.readFile(filename);
        files.push({
          path: path.relative(dist, filename).split(path.sep).join('/'),
          bytes: bytes.length,
          sha256: diagramSha256(bytes),
        });
      }
    }
  };
  await visit(dist);
  assert.ok(files.length > 0, 'A production build is required');
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { files, fileCount: files.length, sha256: diagramSha256(JSON.stringify(files)) };
}

function sourceIdentity(root, revision) {
  const source = readContrastProvenance(root);
  assert.equal(source.head, revision, 'Build and capture must use the exact candidate');
  return source;
}

export async function beginDiagramBuild({ root, directory, revision }) {
  assert.ok(directory && path.isAbsolute(directory), 'An absolute evidence directory is required');
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.whitepaper-diagram-build-start',
    source: sourceIdentity(root, revision),
    startedAtUTC: new Date().toISOString(),
    command: 'corepack pnpm@10.32.1 --filter apps-www build',
  };
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'build-start.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

export async function finishDiagramBuild({ root, directory, revision }) {
  const start = JSON.parse(await fs.readFile(path.join(directory, 'build-start.json'), 'utf8'));
  assert.equal(start.kind, 'proto-ui.whitepaper-diagram-build-start');
  const source = sourceIdentity(root, revision);
  assert.deepEqual(start.source, source, 'Source changed during the production build');
  const inventory = await diagramBuildInventory(path.join(root, 'apps/www/dist'));
  assert.deepEqual(sourceIdentity(root, revision), source, 'Source changed while binding the build');
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.whitepaper-diagram-build',
    sourceBeforeBuild: start.source,
    sourceAfterBuild: source,
    startedAtUTC: start.startedAtUTC,
    finishedAtUTC: new Date().toISOString(),
    command: start.command,
    inventory,
  };
  await fs.writeFile(path.join(directory, 'build.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

export async function verifyDiagramBuild({ root, directory, revision }) {
  const source = sourceIdentity(root, revision);
  const bytes = await fs.readFile(path.join(directory, 'build.json'));
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.kind, 'proto-ui.whitepaper-diagram-build');
  assert.deepEqual(receipt.sourceBeforeBuild, source);
  assert.deepEqual(receipt.sourceAfterBuild, source);
  const inventory = await diagramBuildInventory(path.join(root, 'apps/www/dist'));
  assert.deepEqual(inventory, receipt.inventory, 'Production bytes changed after the candidate build');
  return {
    file: 'build.json',
    sha256: diagramSha256(bytes),
    inventorySha256: inventory.sha256,
    fileCount: inventory.fileCount,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    directory: process.env.DIAGRAM_EVIDENCE_DIR,
    revision: process.env.CANDIDATE_SHA,
  };
  if (process.argv[2] === 'begin-build') await beginDiagramBuild(options);
  else if (process.argv[2] === 'finish-build') await finishDiagramBuild(options);
  else throw new Error('Expected begin-build or finish-build');
}
