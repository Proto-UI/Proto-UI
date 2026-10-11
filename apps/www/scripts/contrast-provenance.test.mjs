import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { describe, it } from 'node:test';

import { contrastProvenancePlugin, readContrastProvenance } from './contrast-provenance.mjs';

const CSS_FILES = [
  'apps/www/src/styles/proto-ui-tokens.generated.css',
  'apps/www/src/styles/proto-ui-style.css',
  'apps/www/src/styles/shadcn-theme.css',
];
const THEME = 'packages/themes/theme.ts';
const ENDPOINT = '/__pui_contrast_provenance';
const HEADER = 'x-proto-ui-contrast-server';

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function put(root, relative, contents) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function repository(t, theme = 'export const color = "black";\n') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'contrast-provenance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'contrast-test@example.invalid');
  git(root, 'config', 'user.name', 'Contrast Test');
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'config', 'core.hooksPath', path.join(root, '.git', 'no-test-hooks'));
  put(root, '.gitignore', `${CSS_FILES.join('\n')}\nnode_modules/\n.astro/\n`);
  put(root, THEME, theme);
  put(root, 'packages/runtime/index.ts', 'export const runtime = true;\n');
  put(root, 'packages/adapters/react/index.ts', 'export const adapter = true;\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Fixture source');
  for (const file of CSS_FILES) put(root, file, `/* ${file} */\n:root { --color: black; }\n`);
  return root;
}

async function serve(t, root) {
  // Exercise actual HTTP and Git. Only Vite's watcher delivery is injected, so
  // these tests prove the latch, not real Vite/chokidar event coverage.
  const watcher = new EventEmitter();
  watcher.add = () => watcher;
  const middleware = [];
  const httpServer = createServer((req, res) => {
    let index = 0;
    const next = () => {
      const handler = middleware[index++];
      if (handler) handler(req, res, next);
      else {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><p>Served page</p>');
      }
    };
    next();
  });
  contrastProvenancePlugin(root).configureServer({
    watcher,
    httpServer,
    middlewares: { use: (handler) => middleware.push(handler) },
  });
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  t.after(
    () =>
      new Promise((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve()))
      )
  );
  const port = httpServer.address().port;
  return {
    watcher,
    port,
    get(url = ENDPOINT, headers = {}, method = 'GET') {
      return new Promise((resolve, reject) => {
        const req = request(
          {
            hostname: '127.0.0.1',
            port,
            path: url,
            method,
            agent: false,
            headers: { Host: `127.0.0.1:${port}`, ...headers },
          },
          (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
          }
        );
        req.on('error', reject);
        req.end();
      });
    },
  };
}

// Evaluate only the checked-in plugin-list expression with inert production
// factories. This checks the actual opt-in wiring without executing Astro config.
function configuredPlugins(root, flag) {
  const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  const start = config.indexOf('    plugins: [\n      ...(process.env.PROTO_UI_CONTRAST_AUDIT');
  assert.ok(start >= 0, 'The reviewed audit plugin-list expression must exist');
  const end = config.indexOf('\n    ],', start);
  assert.ok(end > start);
  const expression = config.slice(start + '    plugins: '.length, end + '\n    ]'.length);
  return new Function(
    'process',
    'contrastProvenancePlugin',
    'repositoryRoot',
    'protoUiSourcePlugin',
    'runtimeRetryUrlsPlugin',
    'websiteBundleGraphPlugin',
    'tailwindcss',
    `return (${expression});`
  )(
    { env: { PROTO_UI_CONTRAST_AUDIT: flag } },
    contrastProvenancePlugin,
    root,
    { name: 'source-control' },
    () => ({ name: 'runtime-retry-control' }),
    () => ({ name: 'bundle-graph-control' }),
    () => ({ name: 'tailwind-control' })
  );
}

describe('contrast source provenance', () => {
  for (const flag of [undefined, '0', '1']) {
    it(`installs the audit plugin only for explicit flag ${String(flag)}`, (t) => {
      const root = repository(t);
      const plugins = configuredPlugins(root, flag);
      const audit = plugins.filter((plugin) => plugin.name === contrastProvenancePlugin(root).name);
      assert.equal(audit.length, flag === '1' ? 1 : 0);
      assert.equal(plugins.length, flag === '1' ? 5 : 4);
      assert.deepEqual(
        plugins.slice(-4).map((plugin) => plugin.name),
        ['source-control', 'runtime-retry-control', 'bundle-graph-control', 'tailwind-control']
      );
      if (audit.length) {
        assert.equal(audit[0].apply, 'serve');
        for (const hook of [
          'resolveId',
          'load',
          'transform',
          'buildStart',
          'generateBundle',
          'writeBundle',
        ])
          assert.equal(audit[0][hook], undefined, `Audit profile must not install ${hook}`);
      }
    });
  }

  it('the installed Vite production resolver excludes the audit plugin even when opted in', async (t) => {
    const root = repository(t);
    const require = createRequire(new URL('../package.json', import.meta.url));
    const vitePath = createRequire(require.resolve('astro')).resolve('vite');
    const { resolveConfig } = await import(pathToFileURL(vitePath).href);
    const plugins = configuredPlugins(root, '1');
    const auditName = contrastProvenancePlugin(root).name;
    assert.ok(plugins.some((plugin) => plugin.name === auditName));
    const resolved = await resolveConfig(
      { root, configFile: false, plugins, logLevel: 'silent' },
      'build'
    );
    assert.equal(
      resolved.plugins.some((plugin) => plugin.name === auditName),
      false
    );
  });

  it('pins the full clean HEAD tree and exact generated CSS bytes reproducibly', (t) => {
    const root = repository(t);
    const expected = {
      head: git(root, 'rev-parse', 'HEAD'),
      tree: git(root, 'rev-parse', 'HEAD^{tree}'),
      generated: Object.fromEntries(
        CSS_FILES.map((file) => [
          file,
          createHash('sha256')
            .update(readFileSync(path.join(root, file)))
            .digest('hex'),
        ])
      ),
    };
    assert.deepEqual(readContrastProvenance(root), expected);
    assert.deepEqual(readContrastProvenance(root), expected);
    put(root, CSS_FILES[0], ':root { --color: white; }\n');
    const regenerated = readContrastProvenance(root);
    assert.equal(regenerated.head, expected.head);
    assert.equal(regenerated.tree, expected.tree);
    assert.notEqual(regenerated.generated[CSS_FILES[0]], expected.generated[CSS_FILES[0]]);
  });

  for (const state of ['unstaged', 'staged', 'untracked']) {
    it(`rejects ${state} theme source edits outside the documentation root`, (t) => {
      const root = repository(t);
      const target = state === 'untracked' ? 'packages/themes/new-theme.ts' : THEME;
      put(root, target, 'export const color = "white";\n');
      if (state === 'staged') git(root, 'add', target);
      assert.throws(() => readContrastProvenance(root), /clean repository/);
    });
  }

  it('rejects dirty runtime and adapter sources, not just themes', (t) => {
    const root = repository(t);
    for (const file of ['packages/runtime/index.ts', 'packages/adapters/react/index.ts']) {
      const original = readFileSync(path.join(root, file));
      put(root, file, 'export const changed = true;\n');
      assert.throws(() => readContrastProvenance(root), /clean repository/);
      put(root, file, original);
    }
  });

  it('does not ignore untracked changes inside a tracked submodule', (t) => {
    const root = repository(t);
    const child = repository(t);
    git(
      root,
      '-c',
      'protocol.file.allow=always',
      'submodule',
      'add',
      '--quiet',
      child,
      'packages/vendor'
    );
    git(root, 'commit', '--quiet', '-am', 'Track local submodule');
    const baseline = readContrastProvenance(root);
    put(root, 'packages/vendor/untracked.ts', 'export const dirty = true;\n');
    assert.throws(() => readContrastProvenance(root), /clean repository/);
    rmSync(path.join(root, 'packages/vendor/untracked.ts'));
    assert.deepEqual(readContrastProvenance(root), baseline);
  });

  for (const file of CSS_FILES) {
    it(`rejects a missing required generated output: ${path.basename(file)}`, (t) => {
      const root = repository(t);
      rmSync(path.join(root, file));
      assert.throws(() => readContrastProvenance(root), /requires generated CSS/);
    });
  }

  it('rejects a nested directory instead of silently changing the source boundary', (t) => {
    const root = repository(t);
    assert.throws(() => readContrastProvenance(path.join(root, 'apps/www')), /repository root/);
  });
});

describe('contrast development server provenance', () => {
  it('prunes nested ignored caches without dropping tracked or required generated inputs', (t) => {
    const root = repository(t);
    put(root, 'native/gpui/.gitignore', 'target/\n');
    put(root, 'native/gpui/target/cache/blob', 'discarded build cache');
    put(root, 'apps/www/dist/.gitignore', '*\n');
    put(root, 'apps/www/dist/required.ts', 'export const source = true;\n');
    git(root, 'add', 'native/gpui/.gitignore');
    git(root, 'add', '--force', 'apps/www/dist/.gitignore', 'apps/www/dist/required.ts');
    git(root, 'commit', '--quiet', '-m', 'Track source inside an otherwise ignored directory');
    const ignored = contrastProvenancePlugin(root).config().server.watch.ignored;
    for (const relative of ['native/gpui/target', 'apps/www/.astro', 'node_modules/.vite']) {
      const absolute = path.join(root, relative);
      mkdirSync(absolute, { recursive: true });
      assert.equal(ignored(absolute, statSync(absolute)), true);
    }
    for (const relative of ['apps/www/dist', 'apps/www/src/styles', 'packages/themes']) {
      const absolute = path.join(root, relative);
      assert.equal(ignored(absolute, statSync(absolute)), false);
    }
    for (const relative of ['apps/www/dist/required.ts', ...CSS_FILES]) {
      const absolute = path.join(root, relative);
      assert.equal(ignored(absolute, statSync(absolute)), false);
    }
    assert.equal(ignored(path.join(root, '.git')), true);
  });

  it('binds page headers to the startup snapshot, distinguishes another tree and a replacement server', async (t) => {
    const root = repository(t);
    const server = await serve(t, root);
    const response = await server.get();
    assert.equal(response.status, 200);
    const { schemaVersion, serverId, ...snapshot } = JSON.parse(response.body);
    assert.equal(schemaVersion, 1);
    assert.deepEqual(snapshot, readContrastProvenance(root));
    assert.equal(response.headers[HEADER], serverId);
    const page = await server.get('/demo');
    assert.equal(page.status, 200);
    assert.equal(page.headers[HEADER], serverId);
    assert.equal(page.headers['cache-control'], 'no-store');
    const replacement = await serve(t, root);
    const replacementIdentity = JSON.parse((await replacement.get()).body);
    assert.notEqual(replacementIdentity.serverId, serverId);
    assert.equal(replacementIdentity.head, snapshot.head);
    const other = await serve(t, repository(t, 'export const color = "red";\n'));
    const otherIdentity = JSON.parse((await other.get()).body);
    assert.notEqual(otherIdentity.head, snapshot.head);
    assert.notEqual(otherIdentity.tree, snapshot.tree);
  });

  it('latches an observed source change even when the source is restored before the endpoint is read', async (t) => {
    const root = repository(t);
    const baseline = readContrastProvenance(root);
    const server = await serve(t, root);
    const original = readFileSync(path.join(root, THEME));
    put(root, THEME, 'export const color = "white";\n');
    server.watcher.emit('all', 'change', path.join(root, THEME));
    put(root, THEME, original);
    assert.deepEqual(readContrastProvenance(root), baseline);
    assert.equal((await server.get()).status, 409);
    assert.equal((await server.get()).status, 409);
    const restarted = await serve(t, root);
    assert.equal((await restarted.get()).status, 200);
  });

  it('latches endpoint-detected dirty files without a watcher event and does not reveal source or filenames', async (t) => {
    const root = repository(t);
    const server = await serve(t, root);
    put(root, 'private-untracked-file.txt', 'secret-source-sentinel');
    const response = await server.get();
    assert.equal(response.status, 409);
    assert.doesNotMatch(
      response.body,
      /private-untracked-file|secret-source-sentinel|contrast-provenance-/
    );
    rmSync(path.join(root, 'private-untracked-file.txt'));
    assert.equal((await server.get()).status, 409);
  });

  it('rejects a different clean HEAD even when its source tree is identical', async (t) => {
    const root = repository(t);
    const server = await serve(t, root);
    git(root, 'commit', '--quiet', '--allow-empty', '-m', 'New revision');
    assert.equal((await server.get()).status, 409);
  });

  it('rejects generated CSS drift even though Git still reports a clean tree', async (t) => {
    const root = repository(t);
    const server = await serve(t, root);
    put(root, CSS_FILES[2], ':root { --color: white; }\n');
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.equal((await server.get()).status, 409);
  });

  it('latches generated CSS regeneration but ignores normal ignored cache output', async (t) => {
    const root = repository(t);
    const server = await serve(t, root);
    for (const file of ['apps/www/.astro/types.d.ts', 'node_modules/.vite/cache.js']) {
      put(root, file, 'generated cache');
      server.watcher.emit('all', 'add', path.join(root, file));
    }
    assert.equal((await server.get()).status, 200);
    for (const directory of ['apps/www/.astro', 'node_modules/.vite']) {
      const absolute = path.join(root, directory);
      rmSync(absolute, { recursive: true });
      server.watcher.emit('all', 'unlinkDir', absolute);
    }
    assert.equal((await server.get()).status, 200);
    const generated = path.join(root, CSS_FILES[0]);
    const original = readFileSync(generated);
    writeFileSync(generated, 'temporary generated contents');
    server.watcher.emit('all', 'change', generated);
    writeFileSync(generated, original);
    assert.equal((await server.get()).status, 409);
  });

  it('rejects foreign Hosts, cross-origin requests and mutation methods', async (t) => {
    const server = await serve(t, repository(t));
    assert.equal((await server.get(ENDPOINT, { Host: 'attacker.invalid' })).status, 403);
    assert.equal((await server.get('/demo', { Host: 'attacker.invalid' })).status, 403);
    assert.equal((await server.get(ENDPOINT, { Origin: 'https://attacker.invalid' })).status, 403);
    assert.equal((await server.get(ENDPOINT, { Origin: 'null' })).status, 403);
    assert.equal(
      (await server.get(ENDPOINT, { Origin: `http://127.0.0.1:${server.port}` })).status,
      200
    );
    const rejectedMethod = await server.get(ENDPOINT, {}, 'POST');
    assert.equal(rejectedMethod.status, 405);
    assert.equal(rejectedMethod.headers.allow, 'GET');
  });
});
