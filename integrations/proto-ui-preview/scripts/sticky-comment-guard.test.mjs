import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./sticky-comment.mjs', import.meta.url));
const sha = 'a'.repeat(40);

function run({ pullState = 'open', liveSHA = sha, status = 'fallback-unavailable' } = {}) {
  const preload = `
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      if (url.pathname.endsWith('/issues/596/comments') && method === 'GET') return Response.json([]);
      if (url.pathname.endsWith('/pulls/596') && method === 'GET') {
        return Response.json({ state: '${pullState}', head: { sha: '${liveSHA}' } });
      }
      if (url.pathname.endsWith('/issues/596/comments') && method === 'POST') {
        return Response.json({ id: 1 }, { status: 201 });
      }
      throw new Error('unexpected mutation or request: ' + method + ' ' + url.pathname);
    };
  `;
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, script],
      {
        env: {
          ...process.env,
          GITHUB_TOKEN: 'token',
          GITHUB_REPOSITORY: 'Proto-UI/Proto-UI',
          PREVIEW_PR: '596',
          PREVIEW_SHA: sha,
          PREVIEW_PROJECT: 'poppy-proto-ui-pr-596',
          PREVIEW_ORIGIN: '',
          PREVIEW_STATUS: status,
          PREVIEW_RUN_URL: 'https://github.com/Proto-UI/Proto-UI/actions/runs/123',
        },
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

test('writes only after an immediate open and exact-head recheck', async () => {
  const result = await run();
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Created the preview comment/);
});

test('fails closed before mutation when the head is stale', async () => {
  const result = await run({ liveSHA: 'b'.repeat(40) });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr + result.stdout, /no longer matches the live pull request/);
  assert.doesNotMatch(result.stderr + result.stdout, /unexpected mutation/);
});

test('fails closed before an open-state write after the pull request closes', async () => {
  const result = await run({ pullState: 'closed' });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr + result.stdout, /no longer matches the live pull request/);
  assert.doesNotMatch(result.stderr + result.stdout, /unexpected mutation/);
});

test('cleanup states require the same exact head and a closed pull request', async () => {
  const current = await run({ pullState: 'closed', status: 'fallback-closed' });
  assert.equal(current.code, 0, current.stderr || current.stdout);
  const reopened = await run({ pullState: 'open', status: 'fallback-closed' });
  assert.notEqual(reopened.code, 0);
  assert.match(reopened.stderr + reopened.stdout, /no longer matches the live pull request/);
});
