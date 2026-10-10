import { createServer } from 'node:http';
import { open, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const generationPattern = /^p[1-9][0-9]*-r[1-9][0-9]*-a[1-9][0-9]*$/;
const types = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  })
);
const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
};
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export function createPreviewServer({ root, domain, port, leaseMilliseconds = 300_000 }) {
  const directory = resolve(root);
  if (
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(domain) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('A dedicated DNS suffix and valid port are required');
  }
  if (
    !Number.isSafeInteger(leaseMilliseconds) ||
    leaseMilliseconds < 1000 ||
    leaseMilliseconds > 300_000
  ) {
    throw new Error('The publication lease must not exceed five minutes');
  }
  return createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    try {
      if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Read-only preview\n');
      // This is checked independently of CSP, including worker imports and a
      // malicious page that attempts to register another asset as its worker.
      if (
        request.headers['service-worker'] ||
        ['serviceworker', 'worker', 'sharedworker'].includes(request.headers['sec-fetch-dest'])
      ) {
        return reply(403, 'Workers are disabled\n');
      }
      const authority = String(request.headers.host || '').toLowerCase();
      const suffix = port === 80 ? '' : `:${port}`;
      const host = authority.endsWith(suffix)
        ? authority.slice(0, suffix ? -suffix.length : undefined)
        : '';
      if (authority !== `${host}${suffix}` || (host !== domain && !host.endsWith(`.${domain}`)))
        return reply(404, 'Unknown preview origin\n');
      const rawPath = String(request.url || '').split('?')[0];
      let pathname;
      try {
        pathname = decodeURIComponent(rawPath);
      } catch {
        return reply(400, 'Invalid path\n');
      }
      if (
        pathname.length > 4096 ||
        !pathname.startsWith('/') ||
        /[\\\u0000-\u001f\u007f]/.test(pathname) ||
        pathname.split('/').some((part) => part === '.' || part === '..')
      ) {
        return reply(400, 'Invalid path\n');
      }
      let manifest;
      try {
        manifest = JSON.parse(await readFile(join(directory, 'current.json'), 'utf8'));
      } catch {
        return reply(503, 'Preview catalog unavailable\n');
      }
      if (manifest.error) return reply(503, 'Preview synchronization unavailable\n');
      const age = Date.now() - Date.parse(manifest.checkedAt);
      if (
        !Number.isFinite(age) ||
        age < -5000 ||
        age > leaseMilliseconds ||
        !Array.isArray(manifest.previews)
      )
        return reply(503, 'Preview catalog lease expired\n');
      if (host === domain) {
        if (pathname !== '/') return reply(404, 'Not found\n');
        const rows = manifest.previews
          .map((item) => {
            const label = `PR #${item.pr} — ${item.head_sha} — ${item.status}`;
            return `<li>${item.status === 'ready' && generationPattern.test(item.generation) ? `<a href="http://${item.generation}.${domain}${suffix}/">${escapeHTML(label)}</a>` : escapeHTML(label)}</li>`;
          })
          .join('\n');
        response.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          request.method === 'HEAD'
            ? undefined
            : `<!doctype html><html lang="en"><meta charset="utf-8"><title>Proto UI intranet previews</title><h1>Proto UI intranet previews</h1><p>Untrusted contributor content. Intranet access only; no Poppy login.</p><p>Checked ${escapeHTML(manifest.checkedAt)}. Availability expires after five minutes without a successful refresh.</p><ul>${rows}</ul></html>`
        );
        return;
      }
      const generation = host.slice(0, -(domain.length + 1));
      if (
        !generationPattern.test(generation) ||
        !manifest.previews.some((item) => item.status === 'ready' && item.generation === generation)
      )
        return reply(410, 'Preview generation is not current\n');
      const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const filePath = join(directory, 'sites', generation, relative.slice(1));
      let file;
      try {
        file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return reply(404, 'Not found\n');
        throw error;
      }
      const info = await file.stat();
      if (info.isDirectory() && !pathname.endsWith('/')) {
        await file.close();
        const query = String(request.url || '').slice(rawPath.length);
        response.writeHead(308, { ...headers, Location: `${rawPath}/${query}` });
        response.end();
        return;
      }
      if (!info.isFile() || info.size > 25 * 1024 * 1024) {
        await file.close();
        return reply(404, 'Not found\n');
      }
      response.writeHead(200, {
        ...headers,
        'Content-Type': types.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
        'Content-Length': info.size,
      });
      if (request.method === 'HEAD') {
        await file.close();
        response.end();
        return;
      }
      const stream = file.createReadStream();
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) reply(503, 'Preview unavailable\n');
      else response.destroy();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const server = createPreviewServer(config);
  server.listen(config.port, config.bind, () =>
    console.log(`Preview listening on ${config.bind}:${config.port}`)
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
