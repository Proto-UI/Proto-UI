import { verifyProductionBrowserEvidence } from './browser-production.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { assertSameBrowserEvidence, assertSameInputFiles, digest } from './browser-inputs.mjs';
import { verifyOwnedBrowserService } from './browser-service.mjs';

/** Rebuild instead of trusting a cached build.json or a receipt-supplied list. */
export async function captureCurrentBrowserEvidence() {
  const directory = await mkdtemp(path.join(tmpdir(), 'pui-browser-evidence-'));
  try {
    const { buildBrowserAssets } = await tsImport('./browser-assets.ts', import.meta.url);
    const assets = await buildBrowserAssets(directory);
    return JSON.parse(assets.get('input-manifest.json'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function browserEvidenceRecord(manifest) {
  const { sourceFiles, ...buildManifest } = manifest;
  return { sourceFiles, buildManifest };
}

export function verifyRecordedBrowserEvidence(receipt, current) {
  verifyOwnedBrowserService(receipt.service);
  if (receipt.service.mode === 'runner-owned-production-static')
    verifyProductionBrowserEvidence(receipt);
  const recorded = { ...receipt.buildManifest, sourceFiles: receipt.sourceFiles };
  assertSameBrowserEvidence(recorded, current);
  const sourceSha256 = digest(JSON.stringify(receipt.sourceFiles));
  const manifestSha256 = digest(JSON.stringify(recorded));
  if (
    receipt.sourceStability?.status !== 'passed' ||
    receipt.sourceStability.beforeSha256 !== sourceSha256 ||
    receipt.sourceStability.afterSha256 !== sourceSha256 ||
    receipt.sourceStability.manifestSha256 !== manifestSha256
  )
    throw new Error('Browser receipt has no successful final input/asset stability check.');
  if (
    receipt.service?.inputManifestSha256 !== manifestSha256 ||
    JSON.stringify(receipt.service?.assets) !== JSON.stringify(current.assets) ||
    JSON.stringify(receipt.compilerBuild) !== JSON.stringify(current.compilerBuild)
  )
    throw new Error('Browser service assets do not bind the current local compiler/target inputs.');
  assertSameInputFiles(receipt.loadedAssets, current.assets);
  const wasmDigests = new Set(
    Object.entries(current.sourceFiles)
      .filter(([file]) => file.endsWith('.wasm'))
      .map(([, sha256]) => sha256)
  );
  if (
    !Array.isArray(receipt.loadedWasm) ||
    !receipt.loadedWasm.length ||
    receipt.loadedWasm.some((entry) => !wasmDigests.has(entry.sha256))
  )
    throw new Error('Browser receipt does not bind the actually loaded Worker WASM bytes.');
}
