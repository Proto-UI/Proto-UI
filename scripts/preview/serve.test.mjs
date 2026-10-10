import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createPreviewServer } from './serve.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'intranet-preview-server-'));
  const generation = 'p596-r100-a1';
  await mkdir(join(root, 'sites', generation, 'en'), { recursive: true });
  await writeFile(
    join(root, 'sites', generation, 'en', 'index.html'),
    '<h1>Exact preview content</h1>'
  );
  await writeFile(join(root, 'sites', generation, 'app.js'), 'globalThis.previewLoaded = true;');
  const manifest = {
    checkedAt: new Date().toISOString(),
    previews: [{ pr: '596', head_sha: 'a'.repeat(40), status: 'ready', generation }],
  };
  const save = () => writeFile(join(root, 'current.json'), JSON.stringify(manifest));
  await save();
  const server = createPreviewServer({ root, domain: 'preview.example.internal', port: 8188 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  const get = (
    path,
    { host = `${generation}.preview.example.internal:8188`, method = 'GET', headers = {} } = {}
  ) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          path,
          method,
          headers: { Host: host, ...headers },
        },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks).toString(),
            })
          );
        }
      );
      req.on('error', reject);
      req.end();
    });
  return { manifest, save, get };
}

test('serves root-relative assets only on the admitted generation origin', async (t) => {
  const { get } = await fixture(t);
  const document = await get('/en/');
  assert.equal(document.status, 200);
  assert.equal(document.body, '<h1>Exact preview content</h1>');
  assert.match(document.headers['cache-control'], /no-store/);
  const canonical = await get('/en?mode=review');
  assert.equal(canonical.status, 308);
  assert.equal(canonical.headers.location, '/en/?mode=review');
  const asset = await get('/app.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(
    (await get('/en/', { host: 'p597-r100-a1.preview.example.internal:8188' })).status,
    410
  );
  assert.equal((await get('/en/', { host: 'gitea.example.internal:8188' })).status, 404);
  assert.equal((await get('/%2e%2e/current.json')).status, 400);
  assert.equal((await get('/app.js', { method: 'POST' })).status, 405);
});

test('rejects service-worker fetches even when the requested asset is otherwise admitted', async (t) => {
  const { get } = await fixture(t);
  const page = await get('/en/');
  assert.match(page.headers['content-security-policy'], /worker-src 'none'/);
  assert.equal((await get('/app.js', { headers: { 'Service-Worker': 'script' } })).status, 403);
  assert.equal(
    (await get('/app.js', { headers: { 'Sec-Fetch-Dest': 'serviceworker' } })).status,
    403
  );
});

test('revokes existing files on a removed generation and expires an abandoned publisher lease', async (t) => {
  const { get, manifest, save } = await fixture(t);
  manifest.previews[0].status = 'failed';
  await save();
  assert.equal((await get('/en/')).status, 410);
  manifest.previews[0].status = 'ready';
  manifest.checkedAt = new Date(Date.now() - 300_001).toISOString();
  await save();
  assert.equal((await get('/en/')).status, 503);
  assert.equal((await get('/', { host: 'preview.example.internal:8188' })).status, 503);
});

test('does not present a failed synchronization as an empty healthy catalog', async (t) => {
  const { get, manifest, save } = await fixture(t);
  manifest.error = 'Synchronization failed';
  manifest.previews = [];
  await save();
  assert.equal((await get('/', { host: 'preview.example.internal:8188' })).status, 503);
});
