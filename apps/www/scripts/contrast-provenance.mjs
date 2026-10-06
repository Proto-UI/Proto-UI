import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const GENERATED_CSS = [
  'apps/www/src/styles/proto-ui-tokens.generated.css',
  'apps/www/src/styles/proto-ui-style.css',
  'apps/www/src/styles/shadcn-theme.css',
];
const ENDPOINT = '/__pui_contrast_provenance';
const SERVER_HEADER = 'x-proto-ui-contrast-server';

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
}

function cleanIdentity(root) {
  const identity = git(root, ['rev-parse', '--verify', 'HEAD']).trim();
  const tree = git(root, ['rev-parse', '--verify', 'HEAD^{tree}']).trim();
  if (
    git(root, [
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--ignore-submodules=none',
    ])
  ) {
    throw new Error(
      'Contrast provenance requires a clean repository, including untracked files and submodules.'
    );
  }
  return { head: identity, tree };
}

/**
 * Pin all tracked sources to a clean commit, plus the docs' generated CSS bytes.
 * This is a local audit boundary, not a hermetic dependency or build attestation.
 * @param {string} root Actual repository root, not the docs application directory.
 * @returns {{ head: string, tree: string, generated: Record<string, string> }}
 */
export function readContrastProvenance(root) {
  root = realpathSync(root);
  if (realpathSync(git(root, ['rev-parse', '--show-toplevel']).trim()) !== root) {
    throw new Error('Contrast provenance requires the repository root.');
  }
  const before = cleanIdentity(root);
  const generated = {};
  for (const relative of GENERATED_CSS) {
    let bytes;
    try {
      bytes = readFileSync(path.join(root, relative));
    } catch {
      throw new Error(`Contrast provenance requires generated CSS: ${relative}`);
    }
    generated[relative] = createHash('sha256').update(bytes).digest('hex');
  }
  const after = cleanIdentity(root);
  if (before.head !== after.head || before.tree !== after.tree) {
    throw new Error('Contrast provenance changed while reading the repository.');
  }
  return { ...before, generated };
}

function isLocalRequest(req) {
  const address = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
  const host = req.headers.host;
  if (
    typeof host !== 'string' ||
    !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host)
  ) {
    return false;
  }
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    const expected = new URL(`${req.socket.encrypted ? 'https' : 'http'}://${host}`).origin;
    return new URL(origin).origin === expected && origin === expected;
  } catch {
    return false;
  }
}

/** Opt-in Vite development middleware; never installed in the production build/preview. */
export function contrastProvenancePlugin(root) {
  return {
    name: 'proto-ui-contrast-provenance',
    apply: /** @type {const} */ ('serve'),
    config() {
      root = realpathSync(root);
      const protectedDirectories = new Set([root]);
      for (const file of [
        ...git(root, ['ls-files', '-z']).split('\0').filter(Boolean),
        ...GENERATED_CSS,
      ]) {
        for (let directory = path.dirname(path.resolve(root, file)); directory !== root; ) {
          protectedDirectories.add(directory);
          directory = path.dirname(directory);
        }
      }
      const ignoredDirectories = new Set();
      return {
        server: {
          watch: {
            ignored(filename, stats) {
              const absolute = path.resolve(root, filename);
              const relative = path.relative(root, absolute);
              if (
                relative === '..' ||
                relative.startsWith(`..${path.sep}`) ||
                path.isAbsolute(relative)
              )
                return false;
              if (relative === '.git' || relative.startsWith(`.git${path.sep}`)) return true;
              if (protectedDirectories.has(absolute)) return false;
              if (ignoredDirectories.has(absolute)) return true;
              if (!stats?.isDirectory()) return false;
              try {
                git(root, ['check-ignore', '--quiet', '--', `${relative}${path.sep}`]);
                ignoredDirectories.add(absolute);
                return true;
              } catch {
                // Unknown/non-ignored paths remain watched; errors never drop source.
                return false;
              }
            },
          },
        },
      };
    },
    configureServer(server) {
      root = realpathSync(root);
      let stale = false;
      const serverId = randomUUID();
      const invalidate = (event, filename) => {
        if (stale || !['add', 'change', 'unlink', 'addDir', 'unlinkDir'].includes(event)) return;
        const absolute = path.resolve(root, filename);
        const relative = path.relative(root, absolute);
        if (
          !relative ||
          relative === '..' ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        )
          return;
        const portable = relative.split(path.sep).join('/');
        if (GENERATED_CSS.includes(portable)) {
          stale = true;
          console.warn(`[contrast-provenance] Generated CSS invalidated: ${event} ${portable}`);
          return;
        }
        try {
          // Tracked paths are never ignored by check-ignore. Normal ignored Vite,
          // Astro and dependency cache churn must not invalidate the source latch.
          // An unlinked directory no longer has filesystem type information.
          const candidate = event === 'unlinkDir' ? `${relative}${path.sep}` : relative;
          git(root, ['check-ignore', '--quiet', '--', candidate]);
        } catch (error) {
          // Exit 1 means a source path; any Git error also fails closed.
          stale = true;
          console.warn(
            `[contrast-provenance] Source watcher invalidated: ${event} ${portable}; Git ${error.status ?? error.code ?? 'error'}`
          );
        }
      };
      server.watcher.on('all', invalidate);
      // Workspace runtime/adapter/theme inputs can live outside Vite's docs root.
      server.watcher.add(root);
      let snapshot;
      try {
        snapshot = readContrastProvenance(root);
      } catch (error) {
        server.watcher.off('all', invalidate);
        throw error;
      }
      const serialized = JSON.stringify(snapshot);
      const response = JSON.stringify({ schemaVersion: 1, serverId, ...snapshot });
      server.httpServer?.once('close', () => server.watcher.off('all', invalidate));
      server.middlewares.use((req, res, next) => {
        // Apply before page middleware, and prevent reuse of a prior server's page.
        res.setHeader(SERVER_HEADER, serverId);
        res.setHeader('Cache-Control', 'no-store');
        if (!isLocalRequest(req)) {
          res.statusCode = 403;
          res.end('Contrast audit server accepts only same-origin loopback requests.');
          return;
        }
        if (req.url?.split('?')[0] !== ENDPOINT) {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET');
          res.end(JSON.stringify({ error: 'Use GET for contrast provenance.' }));
          return;
        }
        if (!stale) {
          try {
            stale = JSON.stringify(readContrastProvenance(root)) !== serialized;
            if (stale) console.warn('[contrast-provenance] Served source identity changed.');
          } catch (error) {
            stale = true;
            console.warn(`[contrast-provenance] Source recheck failed: ${error.message}`);
          }
        }
        if (stale) {
          res.statusCode = 409;
          // Never expose filenames, Git diagnostics, environment or source bytes.
          res.end(
            JSON.stringify({
              error: 'Contrast source provenance changed; restart the audit server.',
            })
          );
          return;
        }
        res.end(response);
      });
    },
  };
}
