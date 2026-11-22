import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureCurrentBrowserEvidence,
  verifyRecordedBrowserEvidence,
} from './browser-evidence.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const inventoryFile = 'internal/compiler/website-demo-migrations.json';
const outputFile = 'internal/compiler/browser-demo-delivery.json';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const browserProfiles = [
  'web-component-source-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
];
const controls = [
  'ordinary-documentation-preview-before-compiler-load',
  'edit-reject-recover-same-revision-source-and-preview',
  'cancel-running-edit-and-reopen-fresh-owner',
  'chinese-documentation-route-and-navigation-cleanup',
  'loaded-compiler-target-and-wasm-bindings',
  'source-and-asset-stability',
];
const candidateRoutes = new Map([
  ['/en/ui-libraries/base/button/', 'en'],
  ['/zh-cn/ui-libraries/base/button/', 'zh'],
]);
export async function verifyBrowserReceipt(
  receipt,
  { capture = captureCurrentBrowserEvidence } = {}
) {
  if (
    receipt?.kind !== 'canonical-wasm-docs-browser-v1' ||
    !receipt.browser ||
    receipt.compilerBuild?.execution !== 'quickjs-wasm' ||
    !/^[a-f0-9]{64}$/.test(receipt.compilerBuild.compilerSha256) ||
    !Array.isArray(receipt.cases) ||
    !receipt.sourceFiles ||
    typeof receipt.sourceFiles !== 'object'
  )
    throw new Error(
      'Browser receipt does not identify an actual browser/Worker/compiler execution.'
    );
  if (!Object.keys(receipt.sourceFiles).length)
    throw new Error('Missing browser receipt source binding inventory.');
  if (receipt.buildManifest?.kind !== 'canonical-browser-build-inputs-v1')
    throw new Error('Missing browser receipt compiler/build/target input manifest.');
  verifyRecordedBrowserEvidence(receipt, await capture());
  return new Map(receipt.cases.map((entry) => [entry.name, entry]));
}

export async function createBrowserDeliveryIndex({ receipt } = {}) {
  const inventoryBytes = await readFile(path.join(root, inventoryFile));
  const inventory = JSON.parse(inventoryBytes);
  const cases = receipt ? await verifyBrowserReceipt(receipt) : new Map();
  const common = receipt && controls.every((name) => cases.get(name)?.status === 'passed');
  const pages = inventory.pages.map((page) => {
    const language = candidateRoutes.get(page.route);
    return {
      page: page.file,
      route: page.route,
      status: language ? 'candidate' : 'pending',
      ...(language
        ? {
            prototypeId: 'base-button',
            targets: browserProfiles.map((profile) => ({
              profile,
              status:
                common &&
                cases.get(`${language === 'zh' ? 'zh-' : ''}base-button-${profile}`)?.status ===
                  'passed'
                  ? 'browser-executed-awaiting-independent-acceptance'
                  : 'pending-browser-execution',
            })),
          }
        : {}),
    };
  });
  const candidates = pages.filter((page) => page.status === 'candidate');
  if (candidates.length !== candidateRoutes.size)
    throw new Error('A selected documentation page disappeared from the preserved inventory.');
  return {
    schemaVersion: 1,
    ownerIssue: 817,
    meaning:
      'Execution overlay; the complete prior source inventory and all its rejected rows remain unchanged. No parent completion is inferred.',
    inventory: {
      path: inventoryFile,
      sha256: digest(inventoryBytes),
      sourceProvenance: inventory.sourceProvenance,
      pages: inventory.pages.length,
      demos: inventory.demos.length,
      prototypes: inventory.prototypes.length,
    },
    receipt: receipt
      ? {
          head: receipt.head,
          browser: receipt.browser,
          compilerBuild: receipt.compilerBuild,
          sourceFilesSha256: digest(JSON.stringify(receipt.sourceFiles)),
          buildManifestSha256: digest(JSON.stringify(receipt.buildManifest)),
          sourceStability: receipt.sourceStability,
          service: receipt.service,
          cases: receipt.cases,
        }
      : null,
    pages,
    demos: inventory.demos.map((demo) => ({
      id: demo.id,
      source: demo.file,
      status: 'pending-full-demo-migration',
    })),
    prototypes: inventory.prototypes.map((prototype) => ({
      id: prototype.id,
      entry: prototype.entry ?? null,
      priorSnapshotNodeAdmission: prototype.statuses.nodeAdmission,
      status:
        prototype.id === 'base-button'
          ? 'selected-candidate-see-page-target-rows'
          : 'pending-browser-execution',
    })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receiptArg = process.argv.indexOf('--receipt');
  const receipt =
    receiptArg >= 0 ? JSON.parse(await readFile(process.argv[receiptArg + 1], 'utf8')) : undefined;
  const result = await createBrowserDeliveryIndex({ receipt });
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if ((await readFile(path.join(root, outputFile), 'utf8')) !== serialized)
      throw new Error('Browser migration overlay needs regeneration with its original receipt.');
  } else {
    await writeFile(path.join(root, outputFile), serialized);
  }
  console.log(
    JSON.stringify({
      output: outputFile,
      inventory: {
        pages: result.pages.length,
        demos: result.demos.length,
        prototypes: result.prototypes.length,
      },
      executedPageTargets: result.pages
        .flatMap((page) => page.targets ?? [])
        .filter((row) => row.status.startsWith('browser-executed')).length,
    })
  );
}
