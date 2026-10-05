import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  readSourceBinding,
  READING_ROUTES,
  sanitizeDiagnostic,
} from './reading-reference-contract.mjs';
import { startStrictPreview } from './search-production-preview.mjs';
import { waitForServerReadiness } from '../../../scripts/test/server-readiness.mjs';

export const READING_PREVIEW_PORT = 4398;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function readingBuildInventory(dist) {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (entry.isFile()) {
        const bytes = await readFile(filename);
        files.push({
          path: path.relative(dist, filename).split(path.sep).join('/'),
          bytes: bytes.length,
          sha256: digest(bytes),
        });
      } else throw new Error('Production evidence refuses non-file build entries.');
    }
  };
  await visit(dist);
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  for (const { route } of READING_ROUTES) {
    const html = `${route.replace(/^\//, '')}index.html`;
    if (!files.some((file) => file.path === html))
      throw new Error(`Missing production reading route: ${html}`);
  }
  return { fileCount: files.length, sha256: digest(JSON.stringify(files)), files };
}

export async function beginReadingBuild({ root = process.cwd(), out, expectedHead }) {
  await mkdir(out, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    kind: 'reading-production-build-start',
    source: readSourceBinding(expectedHead, root),
    startedAtUTC: new Date().toISOString(),
  };
  await writeFile(
    path.join(out, 'production-build-start.json'),
    `${JSON.stringify(receipt, null, 2)}\n`
  );
  return receipt;
}

export async function finishReadingBuild({ root = process.cwd(), out, expectedHead }) {
  const start = JSON.parse(await readFile(path.join(out, 'production-build-start.json'), 'utf8'));
  if (
    start.kind !== 'reading-production-build-start' ||
    start.source.actualGitHead !== expectedHead
  )
    throw new Error('Production build start receipt does not match the expected source.');
  const receipt = {
    schemaVersion: 1,
    kind: 'reading-production-build',
    sourceBeforeBuild: start.source,
    sourceAfterBuild: readSourceBinding(expectedHead, root),
    startedAtUTC: start.startedAtUTC,
    finishedAtUTC: new Date().toISOString(),
    command: 'corepack pnpm@10.32.1 --filter apps-www build',
    dist: 'apps/www/dist',
    inventory: await readingBuildInventory(path.join(root, 'apps/www/dist')),
  };
  await writeFile(path.join(out, 'production-build.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export async function verifyReadingBuild({ root = process.cwd(), out, expectedHead }) {
  const source = readSourceBinding(expectedHead, root);
  const receipt = JSON.parse(await readFile(path.join(out, 'production-build.json'), 'utf8'));
  if (
    receipt.kind !== 'reading-production-build' ||
    receipt.sourceBeforeBuild?.actualGitHead !== source.actualGitHead ||
    receipt.sourceAfterBuild?.actualGitHead !== source.actualGitHead
  )
    throw new Error('Production build receipt does not match the clean candidate source.');
  const inventory = await readingBuildInventory(path.join(root, 'apps/www/dist'));
  if (
    inventory.sha256 !== receipt.inventory?.sha256 ||
    inventory.fileCount !== receipt.inventory?.fileCount
  )
    throw new Error('Production build bytes changed after the source-bound build receipt.');
  return receipt;
}

/** Own exactly one supported Astro production preview. No Vite dev/HMR server. */
export async function startReadingPreview(
  { root = process.cwd(), port = READING_PREVIEW_PORT } = {},
  dependencies = {}
) {
  const {
    start = startStrictPreview,
    readiness = waitForServerReadiness,
    report = console.log,
  } = dependencies;
  const preview = await start({ root: path.join(root, 'apps/www'), port });
  try {
    const address = preview.server.address();
    if (
      !address ||
      typeof address === 'string' ||
      address.address !== '127.0.0.1' ||
      address.port !== port
    )
      throw new Error('Production reading preview did not bind its exact owned loopback address.');
    const baseUrl = `http://127.0.0.1:${port}`;
    const closed = preview.closed().then(() => {
      throw new Error('Owned production reading preview closed before readiness.');
    });
    for (const { route } of READING_ROUTES)
      await Promise.race([
        readiness(`${baseUrl}${route}`, {
          timeoutMs: 60_000,
          rejectRedirects: true,
          report: (message) => report(sanitizeDiagnostic(message)),
        }),
        closed,
      ]);
    return {
      preview,
      baseUrl,
      address: { address: address.address, port: address.port },
      mode: 'astro-production-preview-no-hmr',
    };
  } catch (error) {
    await preview.stop();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = {
      out: process.env.PROTO_UI_READING_EVIDENCE_DIR,
      expectedHead: process.env.PROTO_UI_EXPECTED_HEAD,
    };
    if (!options.out)
      throw new Error('PROTO_UI_READING_EVIDENCE_DIR is required for build ownership.');
    if (process.argv[2] === 'begin-build') await beginReadingBuild(options);
    else if (process.argv[2] === 'finish-build') await finishReadingBuild(options);
    else throw new Error('Expected begin-build or finish-build.');
  } catch (error) {
    console.error(sanitizeDiagnostic(error instanceof Error ? error.stack : String(error)));
    process.exitCode = 1;
  }
}
