import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertValidDeploymentID } from './deployment-id.mjs';

const script = fileURLToPath(new URL('./report.mjs', import.meta.url));
const sha = 'a'.repeat(40);
const secret = 's'.repeat(32);

function validEnv(overrides = {}) {
  return {
    POPPY_CONTROL_PLANE: 'https://poppy.example',
    POPPY_PREVIEW_INGEST_SECRET: secret,
    POPPY_PREVIEW_FALLBACK_MODE: 'true',
    PREVIEW_PR: '596',
    PREVIEW_SHA: sha,
    PREVIEW_AUTHOR: 'contributor',
    PREVIEW_AUTHOR_ID: '42',
    PREVIEW_PROJECT: 'poppy-proto-ui-pr-596',
    PREVIEW_ORIGIN: 'https://poppy.example',
    PREVIEW_DEPLOYMENT_ID: 'poppy-artifact-596-exact-head',
    PREVIEW_RUN_ID: '123',
    PREVIEW_RUN_ATTEMPT: '2',
    ...overrides,
  };
}

function run(status, env, preload) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, script, status],
      {
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('Ready sends the exact non-empty deployment ID in the signed lifecycle payload', async () => {
  const deploymentID = 'poppy-artifact-596-exact-head';
  const expectedPayload = {
    pr: 596,
    head_sha: sha,
    author_login: 'contributor',
    author_id: 42,
    project: 'poppy-proto-ui-pr-596',
    origin: 'https://poppy.example',
    deployment_id: deploymentID,
    run_id: 123,
    run_attempt: 2,
    status: 'ready',
  };
  const body = JSON.stringify(expectedPayload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  const preload = `
    globalThis.fetch = async (input, init) => {
      if (String(input) !== 'https://poppy.example/api/preview/deployments') throw new Error('wrong endpoint');
      if (init.body !== ${JSON.stringify(body)}) throw new Error('wrong lifecycle body');
      if (init.headers['X-Poppy-Signature-256'] !== 'sha256=${signature}') throw new Error('wrong signature');
      return new Response('', { status: 200 });
    };
  `;
  const result = await run('ready', validEnv({ PREVIEW_DEPLOYMENT_ID: deploymentID }), preload);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Reported preview status ready for PR #596/);
});

test('invalid Ready deployment IDs fail before the first network request', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'poppy-report-preflight-'));
  try {
    for (const [name, deploymentID] of [
      ['empty', ''],
      ['too-long', 'x'.repeat(256)],
      ['carriage-return', 'bad\rid'],
      ['line-feed', 'bad\nid'],
    ]) {
      const marker = path.join(root, name);
      const preload = `
        const { appendFileSync } = await import('node:fs');
        globalThis.fetch = async () => {
          appendFileSync(${JSON.stringify(marker)}, 'called');
          return new Response('', { status: 200 });
        };
      `;
      const result = await run('ready', validEnv({ PREVIEW_DEPLOYMENT_ID: deploymentID }), preload);
      assert.notEqual(result.code, 0, name);
      assert.match(result.stderr + result.stdout, /deployment.*ID/i, name);
      await assert.rejects(access(marker), { code: 'ENOENT' }, `${name} reached fetch`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lifecycle reports reject non-origin endpoints before fetch', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'poppy-report-origin-'));
  const cases = [
    ['http-control-plane', { POPPY_CONTROL_PLANE: 'http://poppy.example' }],
    ['credentialed-control-plane', { POPPY_CONTROL_PLANE: 'https://user@poppy.example' }],
    ['ported-control-plane', { POPPY_CONTROL_PLANE: 'https://poppy.example:444' }],
    ['path-control-plane', { POPPY_CONTROL_PLANE: 'https://poppy.example/api' }],
    ['query-control-plane', { POPPY_CONTROL_PLANE: 'https://poppy.example/?route=other' }],
    ['fragment-control-plane', { POPPY_CONTROL_PLANE: 'https://poppy.example/#other' }],
    ['ported-fallback', { PREVIEW_ORIGIN: 'https://poppy.example:444' }],
    ['query-fallback', { PREVIEW_ORIGIN: 'https://poppy.example/?route=other' }],
  ];
  try {
    for (const [name, overrides] of cases) {
      const marker = path.join(root, name);
      const preload = `
        const { appendFileSync } = await import('node:fs');
        globalThis.fetch = async () => {
          appendFileSync(${JSON.stringify(marker)}, 'called');
          return new Response('', { status: 200 });
        };
      `;
      const result = await run('ready', validEnv(overrides), preload);
      assert.notEqual(result.code, 0, name);
      assert.match(result.stderr + result.stdout, /HTTPS origin/i, name);
      await assert.rejects(access(marker), { code: 'ENOENT' }, `${name} reached fetch`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deployment ID validation matches the pinned handler for every lifecycle status', () => {
  for (const status of ['building', 'failed', 'closed']) {
    assert.doesNotThrow(() => assertValidDeploymentID(status, ''));
  }
  assert.doesNotThrow(() => assertValidDeploymentID('ready', 'x'.repeat(255)));
  assert.throws(() => assertValidDeploymentID('ready', ''), /missing its ID/);
  assert.throws(() => assertValidDeploymentID('ready', 'x'.repeat(256)), /invalid deployment ID/);
  for (const control of ['\r', '\n', '\0']) {
    assert.throws(
      () => assertValidDeploymentID('failed', `bad${control}id`),
      /invalid deployment ID/
    );
  }
});

test('a rejected Closed report exhausts retries and exits nonzero', async () => {
  const preload = `
    globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 0; };
    globalThis.fetch = async () => {
      console.log('closed-fetch-attempt');
      return new Response('rejected', { status: 503 });
    };
  `;
  const result = await run(
    'closed',
    validEnv({ PREVIEW_ORIGIN: '', PREVIEW_DEPLOYMENT_ID: '' }),
    preload
  );
  assert.notEqual(result.code, 0);
  assert.equal(result.stdout.match(/closed-fetch-attempt/g)?.length, 5);
  assert.match(result.stderr + result.stdout, /Poppy ingest returned 503/);
});
