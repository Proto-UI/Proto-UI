import { once } from 'node:events';
import { createServer } from 'node:http';

function deadline(result, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), 15_000);
  });
  return Promise.race([result, timeout]).finally(() => clearTimeout(timer));
}

/** Each resource has one real browser request and an independently controlled response. */
export async function openTabsServer(t) {
  const resources = new Map();
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><main id="app"></main><aside id="panel-surface"></aside>');
      return;
    }
    const resource = resources.get(url.pathname);
    if (request.method !== 'GET' || !resource) {
      response.writeHead(404).end('Unknown loopback resource');
      return;
    }
    resource.serve(url.searchParams.get('selected'), response);
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  t.after(async () => {
    for (const resource of resources.values()) resource.release();
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    resource(selected, text, { status = 200, held = true } = {}) {
      const path = `/tabs/${resources.size + 1}`;
      const request = Promise.withResolvers();
      const closed = Promise.withResolvers();
      const gate = Promise.withResolvers();
      if (!held) gate.resolve();
      let requests = 0;
      const resource = {
        path,
        get requests() { return requests; },
        requested: () => deadline(request.promise, `GET ${path}`),
        closed: () => deadline(closed.promise, `HTTP close for ${path}`),
        release: gate.resolve,
        serve(actual, response) {
          requests++;
          request.resolve(actual);
          response.once('close', () => closed.resolve({ finished: response.writableFinished }));
          if (actual !== selected || requests !== 1) {
            response.writeHead(409).end(`Unexpected request for ${path} (${actual})`);
            return;
          }
          void gate.promise.then(() => {
            if (response.destroyed) return;
            response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
            response.end(text);
          });
        },
      };
      resources.set(path, resource);
      return resource;
    },
  };
}
