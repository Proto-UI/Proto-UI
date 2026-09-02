#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const artifactPath = process.env.POPPY_PREVIEW_ARTIFACT || '';
const controlPlane = process.env.POPPY_CONTROL_PLANE || '';
const secret = process.env.POPPY_PREVIEW_INGEST_SECRET || '';
const pr = process.env.PREVIEW_PR || '';
const headSHA = process.env.PREVIEW_SHA || '';
const runID = process.env.PREVIEW_RUN_ID || '';
const runAttempt = process.env.PREVIEW_RUN_ATTEMPT || '';

if (!artifactPath || !controlPlane || !secret)
  throw new Error('Poppy artifact upload configuration is incomplete');
if (!/^https:\/\//.test(controlPlane)) throw new Error('Poppy control plane must be HTTPS');
if (!/^[1-9][0-9]*$/.test(pr)) throw new Error('preview PR is malformed');
if (!/^[0-9a-f]{40}$/.test(headSHA)) throw new Error('preview head SHA is malformed');
if (!/^[1-9][0-9]*$/.test(runID) || !/^[1-9][0-9]*$/.test(runAttempt)) {
  throw new Error('preview run tuple is malformed');
}

const bytes = await readFile(artifactPath);
const signature = createHmac('sha256', secret).update(bytes).digest('hex');
const endpoint = new URL('/api/preview/deployments', controlPlane);
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/gzip',
    'X-Poppy-Signature-256': `sha256=${signature}`,
    'X-Poppy-Preview-PR': pr,
    'X-Poppy-Preview-Head-SHA': headSHA,
    'X-Poppy-Preview-Run-ID': runID,
    'X-Poppy-Preview-Run-Attempt': runAttempt,
  },
  body: bytes,
  signal: AbortSignal.timeout(60_000),
});

if (!response.ok) {
  throw new Error(
    `Poppy artifact upload failed (${response.status}): ${(await response.text()).slice(0, 1000)}`
  );
}

console.log(`Uploaded ${bytes.length} bytes for PR #${pr} head ${headSHA}.`);
