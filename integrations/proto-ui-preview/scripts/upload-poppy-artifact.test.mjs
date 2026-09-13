import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./upload-poppy-artifact.mjs', import.meta.url));
const sha = 'a'.repeat(40);
const secret = 's'.repeat(32);

function run(env, preload = '') {
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

async function uploadFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'poppy-artifact-upload-'));
  const artifact = path.join(root, 'preview.tar.gz');
  const output = path.join(root, 'github-output');
  const bytes = Buffer.from('trusted tarball bytes');
  await writeFile(artifact, bytes);
  return { root, artifact, output, bytes };
}

function validEnv(fixture) {
  return {
    POPPY_PREVIEW_ARTIFACT: fixture.artifact,
    POPPY_CONTROL_PLANE: 'https://poppy.example',
    POPPY_PREVIEW_INGEST_SECRET: secret,
    PREVIEW_REPOSITORY: 'Proto-UI/Proto-UI',
    PREVIEW_PR: '596',
    PREVIEW_SHA: sha,
    PREVIEW_RUN_ID: '123',
    PREVIEW_RUN_ATTEMPT: '2',
    GITHUB_OUTPUT: fixture.output,
  };
}

test('validates the real handler acknowledgement and emits an immutable deployment ID', async () => {
  const fixture = await uploadFixture();
  try {
    const signature = createHmac('sha256', secret).update(fixture.bytes).digest('hex');
    const result = await run(
      validEnv(fixture),
      `globalThis.fetch = async (input, init) => {
        if (String(input) !== 'https://poppy.example/api/preview/deployments') throw new Error('wrong endpoint');
        if (init.body.length !== ${fixture.bytes.length}) throw new Error('body was transformed');
        if (init.headers['X-Poppy-Signature-256'] !== 'sha256=${signature}') throw new Error('wrong signature');
        if (init.headers['X-Poppy-Preview-Repository'] !== 'Proto-UI/Proto-UI') throw new Error('wrong repository');
        if (init.headers['X-Poppy-Preview-PR'] !== '596' || init.headers['X-Poppy-Preview-Head-SHA'] !== '${sha}' || init.headers['X-Poppy-Preview-Run-ID'] !== '123' || init.headers['X-Poppy-Preview-Run-Attempt'] !== '2') throw new Error('wrong tuple');
        return Response.json({ accepted: true, pr: 596, head_sha: '${sha}', run_id: 123, run_attempt: 2 });
      };`
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Uploaded .* PR #596/);
    const output = await readFile(fixture.output, 'utf8');
    assert.equal(output, `deployment_id=poppy-artifact-596-${sha}-123-2\n`);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('rejects an acknowledgement for any other immutable tuple', async () => {
  const fixture = await uploadFixture();
  try {
    const result = await run(
      validEnv(fixture),
      `globalThis.fetch = async () => Response.json({ accepted: true, pr: 596, head_sha: '${'b'.repeat(40)}', run_id: 123, run_attempt: 2 });`
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /acknowledgement does not match/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('rejects non-HTTPS or non-origin control planes before reading or uploading', async () => {
  for (const controlPlane of [
    'http://poppy.example',
    'https://user@poppy.example',
    'https://poppy.example/path',
  ]) {
    const result = await run({
      POPPY_PREVIEW_ARTIFACT: '/nonexistent',
      POPPY_CONTROL_PLANE: controlPlane,
      POPPY_PREVIEW_INGEST_SECRET: secret,
      PREVIEW_REPOSITORY: 'Proto-UI/Proto-UI',
      PREVIEW_PR: '596',
      PREVIEW_SHA: sha,
      PREVIEW_RUN_ID: '123',
      PREVIEW_RUN_ATTEMPT: '1',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /HTTPS origin/);
  }
});

test('rejects missing repository binding, weak authentication, and malformed tuple values', async () => {
  const fixture = await uploadFixture();
  try {
    const cases = [
      { PREVIEW_REPOSITORY: '' },
      { PREVIEW_REPOSITORY: 'attacker/repo' },
      { POPPY_PREVIEW_INGEST_SECRET: 'short' },
      { PREVIEW_PR: '0' },
      { PREVIEW_SHA: 'not-a-sha' },
      { PREVIEW_RUN_ID: '0' },
      { PREVIEW_RUN_ATTEMPT: '0' },
    ];
    for (const mutation of cases) {
      const result = await run({ ...validEnv(fixture), ...mutation });
      assert.notEqual(result.status, 0, JSON.stringify(mutation));
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('rejects a symlink instead of following an unexpected archive path', async (t) => {
  const fixture = await uploadFixture();
  const link = path.join(fixture.root, 'linked.tar.gz');
  try {
    try {
      await symlink(fixture.artifact, link, 'file');
    } catch (error) {
      if (error?.code === 'EPERM') {
        t.skip('symlink creation is unavailable on this Windows host');
        return;
      }
      throw error;
    }
    const result = await run({ ...validEnv(fixture), POPPY_PREVIEW_ARTIFACT: link });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /regular file/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
