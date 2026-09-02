import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const script = fileURLToPath(new URL('./upload-poppy-artifact.mjs', import.meta.url));

function run(env, preload) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, script],
      {
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('uploads the raw tarball with the signed immutable preview tuple', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'poppy-artifact-'));
  const artifact = path.join(root, 'preview.tar.gz');
  const bytes = Buffer.from('trusted tarball bytes');
  const secret = 'secret';
  await writeFile(artifact, bytes);
  try {
    const result = await run(
      {
        POPPY_PREVIEW_ARTIFACT: artifact,
        POPPY_CONTROL_PLANE: 'https://poppy.example',
        POPPY_PREVIEW_INGEST_SECRET: secret,
        PREVIEW_PR: '596',
        PREVIEW_SHA: 'a'.repeat(40),
        PREVIEW_RUN_ID: '123',
        PREVIEW_RUN_ATTEMPT: '2',
      },
      `globalThis.fetch = async (input, init) => {
        if (String(input) !== 'https://poppy.example/api/preview/deployments') throw new Error('wrong endpoint');
        if (init.body.length !== ${bytes.length}) throw new Error('body was transformed');
        if (init.headers['X-Poppy-Signature-256'] !== 'sha256=${createHmac('sha256', secret).update(bytes).digest('hex')}') throw new Error('wrong signature');
        if (init.headers['X-Poppy-Preview-PR'] !== '596' || init.headers['X-Poppy-Preview-Head-SHA'] !== '${'a'.repeat(40)}' || init.headers['X-Poppy-Preview-Run-ID'] !== '123' || init.headers['X-Poppy-Preview-Run-Attempt'] !== '2') throw new Error('wrong tuple');
        return new Response('', { status: 202 });
      };`
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects non-HTTPS control planes before reading or uploading', async () => {
  const result = await run(
    {
      POPPY_PREVIEW_ARTIFACT: '/nonexistent',
      POPPY_CONTROL_PLANE: 'http://poppy.example',
      POPPY_PREVIEW_INGEST_SECRET: 'secret',
      PREVIEW_PR: '596',
      PREVIEW_SHA: 'a'.repeat(40),
      PREVIEW_RUN_ID: '123',
      PREVIEW_RUN_ATTEMPT: '1',
    },
    ''
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /HTTPS/);
});
