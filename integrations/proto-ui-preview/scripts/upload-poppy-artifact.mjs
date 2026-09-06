#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { appendFile, lstat, readFile } from 'node:fs/promises';
import process from 'node:process';

import { assertCompressedArchiveSize } from './prepare-fallback-artifact.mjs';

const artifactPath = process.env.POPPY_PREVIEW_ARTIFACT || '';
const secret = process.env.POPPY_PREVIEW_INGEST_SECRET || '';
const repository = process.env.PREVIEW_REPOSITORY || '';
const prText = process.env.PREVIEW_PR || '';
const headSHA = process.env.PREVIEW_SHA || '';
const runIDText = process.env.PREVIEW_RUN_ID || '';
const runAttemptText = process.env.PREVIEW_RUN_ATTEMPT || '';

let controlPlane;
try {
  controlPlane = new URL(process.env.POPPY_CONTROL_PLANE || '');
} catch {
  throw new Error('Poppy control plane must be an HTTPS origin');
}
if (
  controlPlane.protocol !== 'https:' ||
  controlPlane.username ||
  controlPlane.password ||
  controlPlane.port ||
  controlPlane.pathname !== '/' ||
  controlPlane.search ||
  controlPlane.hash
) {
  throw new Error('Poppy control plane must be an HTTPS origin');
}
if (secret.length < 32) throw new Error('POPPY_PREVIEW_INGEST_SECRET is missing or too short');
if (repository !== 'Proto-UI/Proto-UI') throw new Error('preview repository binding is invalid');
if (!/^[1-9][0-9]*$/.test(prText)) throw new Error('preview PR is malformed');
if (!/^[0-9a-f]{40}$/.test(headSHA)) throw new Error('preview head SHA is malformed');
if (!/^[1-9][0-9]*$/.test(runIDText) || !/^[1-9][0-9]*$/.test(runAttemptText)) {
  throw new Error('preview run tuple is malformed');
}
const pr = Number(prText);
const runID = Number(runIDText);
const runAttempt = Number(runAttemptText);
if (![pr, runID, runAttempt].every(Number.isSafeInteger)) {
  throw new Error('preview tuple exceeds safe integer bounds');
}
if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required for the deployment ID');

const stat = await lstat(artifactPath).catch(() => null);
if (!stat?.isFile() || stat.isSymbolicLink()) {
  throw new Error('Poppy preview artifact must be a regular file');
}
assertCompressedArchiveSize(stat.size);
const bytes = await readFile(artifactPath);
if (bytes.byteLength !== stat.size) throw new Error('Poppy preview artifact changed while reading');
assertCompressedArchiveSize(bytes.byteLength);

const signature = createHmac('sha256', secret).update(bytes).digest('hex');
const endpoint = new URL('/api/preview/deployments', controlPlane);
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/gzip',
    'X-Poppy-Signature-256': `sha256=${signature}`,
    'X-Poppy-Preview-Repository': repository,
    'X-Poppy-Preview-PR': prText,
    'X-Poppy-Preview-Head-SHA': headSHA,
    'X-Poppy-Preview-Run-ID': runIDText,
    'X-Poppy-Preview-Run-Attempt': runAttemptText,
  },
  body: bytes,
  signal: AbortSignal.timeout(60_000),
});

if (!response.ok) {
  throw new Error(
    `Poppy artifact upload failed (${response.status}): ${(await response.text()).slice(0, 1000)}`
  );
}
const acknowledgement = await response.json().catch(() => null);
if (
  acknowledgement?.accepted !== true ||
  acknowledgement.pr !== pr ||
  acknowledgement.head_sha !== headSHA ||
  acknowledgement.run_id !== runID ||
  acknowledgement.run_attempt !== runAttempt
) {
  throw new Error('Poppy artifact acknowledgement does not match the immutable preview tuple');
}

const deploymentID = `poppy-artifact-${prText}-${headSHA}-${runIDText}-${runAttemptText}`;
if (deploymentID.length > 255 || /[\r\n\0]/.test(deploymentID)) {
  throw new Error('derived fallback deployment ID is invalid');
}
await appendFile(process.env.GITHUB_OUTPUT, `deployment_id=${deploymentID}\n`);
console.log(`Uploaded ${bytes.length} bytes for PR #${prText} head ${headSHA}.`);
