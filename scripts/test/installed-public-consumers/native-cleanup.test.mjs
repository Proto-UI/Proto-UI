import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { closeNativeResources } from './native-cleanup.mjs';
async function listen() {
  const server = createServer((request, response) => response.end('owned'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}
test('closes the owned listener after successful browser retirement', async () => {
  const server = await listen();
  let called = 0;
  const failures = await closeNativeResources(
    {
      async close() {
        called++;
      },
    },
    server
  );
  assert.equal(called, 1);
  assert.equal(server.listening, false);
  assert.deepEqual(failures, []);
});
test('browser close rejection cannot skip the actual server close', async () => {
  const server = await listen();
  const failures = await closeNativeResources(
    {
      async close() {
        throw new Error('browser-disconnected');
      },
    },
    server
  );
  assert.equal(server.listening, false);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].resource, 'browser');
  assert.match(failures[0].error, /browser-disconnected/);
});
test('server close failure is retained instead of a clean terminal result', async () => {
  const server = await listen();
  const original = server.close.bind(server);
  server.close = () => {
    throw new Error('server-close-failed');
  };
  try {
    const failures = await closeNativeResources(undefined, server);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].resource, 'server');
    assert.match(failures[0].error, /server-close-failed/);
  } finally {
    await new Promise((resolve) => original(resolve));
  }
});
