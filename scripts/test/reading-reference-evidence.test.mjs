import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { waitForServerReadiness } from './server-readiness.mjs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';
import YAML from 'yaml';
import { collectReadingReference } from '../../apps/www/scripts/reading-reference-collector.mjs';
import {
  allowOwnRequest,
  hashReadingObservation,
  observationFailures,
  pngDimensions,
  readSourceBinding,
  routeOwnResponse,
  safeEvidenceURL,
  sanitizeDiagnostic,
  READING_CASES,
  READING_VIEWPORT,
} from '../../apps/www/scripts/reading-reference-contract.mjs';

import {
  beginReadingBuild,
  finishReadingBuild,
  readingBuildInventory,
  startReadingPreview,
  verifyReadingBuild,
  READING_PREVIEW_PORT,
} from '../../apps/www/scripts/reading-reference-production.mjs';

const collectorPath = 'apps/www/scripts/reading-reference-collector.mjs';
const runner = readFileSync('apps/www/scripts/capture-reading-reference.mjs', 'utf8');
const workflow = YAML.parse(
  readFileSync('.github/workflows/reading-reference-evidence.yml', 'utf8')
);
const fixture = `<header><button aria-label="Preferences"><svg></svg><span>Menu</span></button></header>
<main data-pagefind-body><h1 style="color: rgb(20, 20, 20)"><span data-typography-prototype="shadcn-text-root" style="color: rgb(90, 90, 90)"><span data-site-typography-slot>Native heading</span></span></h1>
<p id="body" style="color: rgb(20, 20, 20);font-size: 16px"><span data-typography-prototype="shadcn-text-root" style="color: rgb(90, 90, 90);font-size: 15px"><span data-site-typography-slot>Authored <em>body</em> with source.</span></span></p>
<ul><li>A source item</li></ul><h2>Chapter</h2><div data-previewer-id="radio" data-projection-runtime="wc"><div class="pui-projection-controls"><button>Web Components</button></div><p>Interactive demo labels</p></div>
<div data-code-example><div data-code-toolbar><button>Copy code</button></div><pre>const source = 1;</pre></div></main>
<div class="pagination-links"><a href="/next"><span>Next page</span></a></div>`;

async function observe(html = fixture, options = {}) {
  const window = new Window({ url: 'https://reference.example/zh-cn/start-here/quick-start/' });
  window.document.body.innerHTML = html;
  window.document.documentElement.setAttribute('data-theme', 'light');
  window.document.documentElement.style.zoom = '1';
  window.document.body.style.zoom = '1';
  Object.defineProperty(window.document, 'fonts', {
    configurable: true,
    value: options.restricted
      ? { status: 'loaded' }
      : {
          status: 'loaded',
          *[Symbol.iterator]() {
            yield { family: 'Fixture Font', status: 'loaded' };
          },
        },
  });
  // happy-dom is a structural unit fixture, not a browser paint observation.
  window.Range.prototype.getClientRects ??= () => [];
  const before = window.document.documentElement.outerHTML;
  const sandbox = {
    document: window.document,
    location: window.location,
    getComputedStyle: window.getComputedStyle.bind(window),
    innerWidth: 1180,
    innerHeight: 757,
    outerWidth: 1180,
    outerHeight: 757,
    devicePixelRatio: 1,
    scrollX: 0,
    scrollY: 0,
    visualViewport: { width: 1180, height: 757, scale: 1, offsetLeft: 0, offsetTop: 0 },
    matchMedia: () => ({ matches: false }),
    ...(options.restricted ? { WeakMap: undefined } : { navigator: window.navigator }),
  };
  const result = await runInNewContext(`(${collectReadingReference.toString()})()`, sandbox);
  assert.equal(
    window.document.documentElement.outerHTML,
    before,
    'Collector must not mutate the fixture DOM.'
  );
  return hashReadingObservation(JSON.parse(JSON.stringify(result)));
}

describe('matched reading-reference collector', () => {
  it('collects real native document roles without the stale markdown class', async () => {
    const result = await observe();
    assert.deepEqual(result.errors, []);
    assert.equal(result.roles.p.count, 1);
    assert.equal(result.roles.li.count, 1);
    assert.equal(result.roles.h1.count, 1);
    assert.equal(result.roles.h3.status, 'absent-role');
    assert.equal(result.roles.caption.status, 'absent-role');
    assert.equal(result.roles.pagination.count, 1);
    assert.equal(result.roles.p.samples[0].sourceText, 'Authored body with source.');
    assert.equal(result.roles.p.samples[0].container.style.color, 'rgb(20, 20, 20)');
    const leaf = result.roles.p.samples[0].actualTextLeaves[0];
    assert.equal(leaf.style.color, 'rgb(90, 90, 90)');
    assert.equal(leaf.style.fontSize, '15px');
    assert.equal(leaf.textSurface.attributes['data-typography-prototype'], 'shadcn-text-root');
    assert.ok(
      leaf.backgroundAncestorChain.some((entry) => entry.path.endsWith('body:nth-of-type(1)'))
    );
    assert.equal(
      result.prose.blocks.find(({ role }) => role === 'p').text,
      'Authored body with source.'
    );
    assert.equal(result.contentHashStatus, 'sha256-utf8-host-postprocessed');
  });
  it('retains zero/missing roles as failures rather than passing an empty sample', async () => {
    const missing = await observe(
      '<div class="sl-markdown-content"><p>Old selector only</p></div>'
    );
    assert.equal(missing.main, null);
    assert.equal(missing.roles.p.status, 'failed-absent');
    assert.ok(missing.errors.some((error) => error.includes('main[data-pagefind-body]')));
    const empty = await observe('<main data-pagefind-body><h1>Title</h1><p></p></main>');
    assert.equal(empty.roles.p.samples[0].status, 'failed-empty-text');
    assert.ok(empty.errors.some((error) => error.includes('zero actual text leaves')));
    assert.ok(
      observationFailures(empty, READING_CASES[0]).some((error) =>
        error.includes('zero actual text leaves')
      )
    );
    const noPaginationText = await observe(fixture.replace('<span>Next page</span>', ''));
    assert.ok(
      observationFailures(noPaginationText, READING_CASES[0]).some((error) =>
        error.includes('role pagination has zero actual text leaves')
      )
    );
  });
  it('retains visible aria-hidden title paint while separating it from authored prose matching', async () => {
    const result = await observe(
      fixture.replace(
        '<ul>',
        '<p class="starlight-aside__title" aria-hidden="true" style="color: rgb(77, 77, 77)">Note</p><ul>'
      )
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.roles.p.count, 2);
    const title = result.roles.p.samples.find(
      ({ container }) => container.attributes['aria-hidden'] === 'true'
    );
    assert.equal(title.actualTextLeaves[0].text, 'Note');
    assert.equal(title.actualTextLeaves[0].style.color, 'rgb(77, 77, 77)');
    assert.ok(title.actualTextLeaves[0].ariaHiddenAncestor);
    assert.equal(
      title.authoredProseMembership,
      'excluded-aria-hidden-or-decoration; visual-text-retained'
    );
    assert.ok(!result.prose.blocks.some(({ normalizedText }) => normalizedText === 'Note'));
  });
  it('separates interactive text from prose hashes and ignores carrier-only changes', async () => {
    const first = await observe();
    const changedDemo = await observe(
      fixture
        .replace('Interactive demo labels', 'Different demo')
        .replace('Web Components', 'React')
    );
    assert.equal(first.prose.normalizedTextSha256, changedDemo.prose.normalizedTextSha256);
    assert.notEqual(
      first.interactiveText[0].normalizedTextSha256,
      changedDemo.interactiveText[0].normalizedTextSha256
    );
    const wrapped = await observe(fixture.replace('Authored ', '<span>Authored </span>'));
    assert.equal(first.prose.normalizedTextSha256, wrapped.prose.normalizedTextSha256);
    const changedProse = await observe(fixture.replace('Authored ', 'Changed '));
    assert.notEqual(first.prose.normalizedTextSha256, changedProse.prose.normalizedTextSha256);
  });
  it('preserves actual white-space between inline native source nodes', async () => {
    const result = await observe(
      '<main data-pagefind-body><h1>Title</h1><p><em>First</em> <strong>second</strong></p></main>'
    );
    assert.equal(result.roles.p.samples[0].sourceText, 'First second');
    assert.equal(
      result.prose.blocks.find(({ role }) => role === 'p').normalizedText,
      'First second'
    );
  });
  it('keeps geometry and text leaves distinct from unperformed hit-testing', async () => {
    const result = await observe();
    const control = result.surfaces.header.entries[0].controls[0];
    assert.equal(control.hitTesting, 'not-performed');
    assert.equal(control.visiblePaint.glyphs.length, 1);
    assert.equal(control.visiblePaint.textLeaves[0].text, 'Menu');
    assert.match(control.hitboxGeometry.limitation, /not pixel segmentation.*clicked hit-testing/);
    assert.equal(
      result.projections.find(({ attributes }) => attributes['data-previewer-id'] === 'radio')
        .attributes['data-projection-runtime'],
      'wc'
    );
  });
  it('works with restricted read-only DOM: no navigator/crypto/TreeWalker/font iterator', async () => {
    const result = await observe(fixture, { restricted: true });
    assert.deepEqual(result.errors, []);
    assert.equal(result.browser.navigatorStatus, 'unavailable-in-observer');
    assert.equal(result.fonts.faceEnumeration, 'unavailable-in-observer');
    assert.equal(result.fonts.faces, null);
    assert.equal(result.roles.p.samples[0].actualTextLeaves[0].style.color, 'rgb(90, 90, 90)');
    assert.match(result.prose.normalizedTextSha256, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(
      readFileSync(collectorPath, 'utf8'),
      /fetch\(|createTreeWalker|NodeFilter|crypto\.|TextEncoder|\.click\(|setAttribute\(|style\.[\w]+\s*=/
    );
  });
  it('rejects actual viewport, scale, zoom, theme and font-readiness mismatches', async () => {
    const result = await observe();
    assert.deepEqual(observationFailures(result, READING_CASES[0]), []);
    result.viewport.innerWidth = 1165;
    result.viewport.devicePixelRatio = 2;
    result.viewport.rootZoom = '0.9';
    result.fonts.status = 'loading';
    const failures = observationFailures(result, READING_CASES[1]);
    assert.ok(failures.some((failure) => failure.includes('viewport differs')));
    assert.ok(failures.some((failure) => failure.includes('DPR')));
    assert.ok(failures.some((failure) => failure.includes('CSS zoom')));
    assert.ok(failures.some((failure) => failure.includes('theme')));
    assert.ok(failures.some((failure) => failure.includes('fonts')));
  });
});

describe('bounded reading-reference runner and workflow', () => {
  it('registers only two exact routes, two themes and the matched 1180x757 viewport', () => {
    assert.equal(READING_CASES.length, 4);
    assert.equal(new Set(READING_CASES.map(({ id }) => id)).size, 4);
    assert.deepEqual(READING_VIEWPORT, { width: 1180, height: 757 });
    assert.deepEqual(
      [...new Set(READING_CASES.map(({ route }) => route))],
      ['/zh-cn/start-here/quick-start/', '/zh-cn/ui-libraries/shadcn/radio-group/']
    );
    assert.match(runner, /for \(const target of requestedCases\)/);
    assert.match(runner, /const viewport = target.viewport \?\? READING_VIEWPORT/);
    assert.match(runner, /browser-harness\.ts/);
    assert.match(runner, /deviceScaleFactor: 1/);
    assert.match(runner, /serviceWorkers: 'block'/);
  });
  it('rejects external URLs and admits only same-origin WebSocket URLs', () => {
    const base = 'http://127.0.0.1:4321';
    for (const target of [`${base}/route`, 'ws://127.0.0.1:4321/'])
      assert.equal(allowOwnRequest(target, base), true);
    for (const target of [
      'https://example.com',
      'http://127.0.0.1:4322',
      'http://127.0.0.1.evil:4321',
      'https://127.0.0.1:4321',
      'data:text/html,example',
      'invalid',
    ])
      assert.equal(allowOwnRequest(target, base), false, target);
    assert.match(runner, /PROTO_UI_BROWSER_BASE_URL is not allowed/);
    assert.match(runner, /context\.route\('\*\*\/\*'/);
    assert.match(runner, /context\.routeWebSocket\('\*\*\/\*'/);
  });
  it('blocks every 30x before following or fulfilling, including same-origin redirects', async () => {
    const base = 'http://127.0.0.1:4321';
    for (const status of Array.from({ length: 100 }, (_, index) => 300 + index)) {
      for (const location of ['https://outside.invalid/leak', `${base}/other`, '/relative']) {
        const trace = { followed: 0, fulfilled: 0, disposed: 0, aborted: [], failures: [] };
        const response = {
          status: () => status,
          headers: () => ({ location }),
          dispose: async () => {
            trace.disposed += 1;
          },
        };
        const route = {
          request: () => ({ url: () => `${base}/redirect` }),
          // This adversarial transport emulates following when the explicit
          // zero-redirect bound is lost. A final-URL-only check is too late.
          fetch: async (options) => {
            if (options?.maxRedirects !== 0) {
              trace.followed += 1;
              return { ...response, status: () => 200 };
            }
            assert.equal(options.maxRetries, 0);
            assert.equal(options.timeout, 30_000);
            return response;
          },
          continue: async () => {
            trace.followed += 1;
          },
          fulfill: async () => {
            trace.fulfilled += 1;
          },
          abort: async (code) => trace.aborted.push(code),
        };
        assert.equal(
          await routeOwnResponse(route, base, (failure) => trace.failures.push(failure)),
          'blocked-redirect'
        );
        assert.equal(trace.followed, 0, `${status}: redirect was contacted before admission`);
        assert.equal(trace.fulfilled, 0, `${status}: redirect reached the browser`);
        assert.equal(trace.disposed, 1);
        assert.deepEqual(trace.aborted, ['blockedbyclient']);
        assert.deepEqual(trace.failures, [
          { kind: 'redirect-response', url: `${base}/redirect`, status, location },
        ]);
      }
    }
  });
  it('passes original non-redirect assets through and closes response buffers', async () => {
    const base = 'http://127.0.0.1:4321';
    for (const [asset, contentType, bytes] of [
      ['/index', 'text/html', Buffer.from('<h1>Native source</h1>')],
      ['/module.js', 'text/javascript', Buffer.from('export const value = 1;')],
      ['/font.woff2', 'font/woff2', Buffer.from([0, 2, 128, 255])],
      ['/style.css', 'text/css', Buffer.from('p { color: inherit; }')],
    ]) {
      const failures = [];
      const events = [];
      const response = {
        status: () => 200,
        headers: () => ({ 'content-type': contentType }),
        body: async () => bytes,
        dispose: async () => events.push('dispose'),
      };
      const route = {
        request: () => ({ url: () => `${base}${asset}` }),
        fetch: async (options) => {
          assert.equal(options.maxRedirects, 0);
          events.push('fetch');
          return response;
        },
        fulfill: async (options) => {
          assert.equal(options.response, response);
          assert.deepEqual(await options.response.body(), bytes);
          assert.equal(options.response.headers()['content-type'], contentType);
          events.push('fulfill');
        },
        abort: async () => assert.fail('A normal asset must not be aborted'),
        continue: async () => assert.fail('No HTTP request may bypass response admission'),
      };
      assert.equal(
        await routeOwnResponse(route, base, (failure) => failures.push(failure)),
        'fulfilled'
      );
      assert.deepEqual(events, ['fetch', 'fulfill', 'dispose']);
      assert.deepEqual(failures, []);
    }
  });
  it('rejects external requests without fetching and records transport failure without fallback', async () => {
    const base = 'http://127.0.0.1:4321';
    for (const external of [true, false]) {
      const url = external ? 'https://outside.invalid/module.js' : `${base}/failed`;
      const failures = [];
      let fetches = 0;
      const aborts = [];
      const route = {
        request: () => ({ url: () => url }),
        fetch: async () => {
          fetches += 1;
          throw new Error('fixture transport failure');
        },
        fulfill: async () => assert.fail('Failure must not be fulfilled'),
        continue: async () => assert.fail('Failure must not use unrestricted fallback'),
        abort: async (code) => aborts.push(code),
      };
      assert.equal(
        await routeOwnResponse(route, base, (failure) => failures.push(failure)),
        external ? 'blocked-external' : 'failed-request'
      );
      assert.equal(fetches, external ? 0 : 1);
      assert.equal(failures[0].kind, external ? 'external-request' : 'request-error');
      assert.deepEqual(aborts, [external ? 'blockedbyclient' : 'failed']);
    }
  });
  it('binds no-follow to locked Playwright and preserves the strict WebSocket origin gate', () => {
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve('playwright-core/package.json', {
      paths: [path.resolve('apps/www')],
    });
    const packageRoot = path.dirname(packagePath);
    assert.equal(JSON.parse(readFileSync(packagePath, 'utf8')).version, '1.58.2');
    const fetchSource = readFileSync(path.join(packageRoot, 'lib/server/fetch.js'), 'utf8');
    assert.match(fetchSource, /maxRedirects = maxRedirects === 0 \? -1 : maxRedirects/);
    assert.match(
      fetchSource,
      /redirectStatus\.includes\(response\.statusCode\) && options\.maxRedirects >= 0/
    );
    assert.match(runner, /routeOwnResponse\(route, baseUrl/);
    assert.match(runner, /startReadingPreview\(\)/);
    assert.doesNotMatch(runner, /startServer\(|stopServer\(/);
    assert.doesNotMatch(runner, /route\.continue\(/);
    assert.match(
      runner,
      /if \(allowOwnRequest\(socket\.url\(\), baseUrl\)\) socket\.connectToServer\(\)/
    );
  });
  it(
    'proves locked APIRequest no-follow against two real loopback listeners',
    { timeout: 15_000 },
    async () => {
      const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
      const { request } = require('playwright-core');
      let sinkHits = 0;
      let ownHits = 0;
      let sinkURL;
      const bytes = Buffer.from([0, 1, 128, 255]);
      const sink = createServer((_req, res) => {
        sinkHits += 1;
        res.end('must not be reached');
      });
      const own = createServer((req, res) => {
        ownHits += 1;
        if (req.url === '/redirect') {
          res.writeHead(302, { location: sinkURL });
          res.end();
        } else {
          res.writeHead(200, { 'content-type': 'font/woff2' });
          res.end(bytes);
        }
      });
      const listen = async (server) => {
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        return `http://127.0.0.1:${server.address().port}`;
      };
      let context;
      try {
        sinkURL = await listen(sink);
        const base = await listen(own);
        context = await request.newContext();
        const failures = [];
        const makeRoute = (pathname) => ({
          request: () => ({ url: () => `${base}${pathname}` }),
          // Real pinned APIRequestContext; Route.fetch delegates to this same
          // transport. No Chromium/route interception claim is made here.
          fetch: (options) => context.fetch(`${base}${pathname}`, { ...options, timeout: 2_000 }),
          abort: async (code) => assert.equal(code, 'blockedbyclient'),
          fulfill: async ({ response }) => {
            assert.equal(pathname, '/asset');
            assert.deepEqual(await response.body(), bytes);
          },
          continue: async () => assert.fail('Unrestricted continuation is forbidden'),
        });
        assert.equal(
          await routeOwnResponse(makeRoute('/redirect'), base, (failure) => failures.push(failure)),
          'blocked-redirect'
        );
        assert.equal(sinkHits, 0, 'Redirect destination must never be contacted');
        assert.equal(
          await routeOwnResponse(makeRoute('/asset'), base, (failure) => failures.push(failure)),
          'fulfilled'
        );
        assert.equal(failures.length, 1);
        assert.equal(failures[0].status, 302);
        assert.equal(ownHits, 2);
        await assert.rejects(
          waitForServerReadiness(`${base}/redirect`, {
            timeoutMs: 2_000,
            rejectRedirects: true,
            report: () => {},
          }),
          /Refusing documentation readiness redirect/
        );
        assert.equal(ownHits, 3);
        assert.equal(sinkHits, 0, 'Readiness must not follow a redirect either');
        // Legacy callers deliberately keep their original default. Both
        // endpoints are this test's own loopback fixtures, never the Internet.
        await waitForServerReadiness(`${base}/redirect`, { timeoutMs: 2_000, report: () => {} });
        assert.equal(ownHits, 4);
        assert.equal(sinkHits, 1, 'Default readiness redirect behavior is unchanged');
      } finally {
        await context?.dispose();
        await Promise.all(
          [sink, own].map((server) => new Promise((resolve) => server.close(resolve)))
        );
      }
    }
  );
  it('redacts query/fragment/user-info before preserving URL failures and error messages', async () => {
    const diagnostic =
      'WebSocket ws://127.0.0.1:5173/channel?fixture_token=not-a-real-secret#fixture failed';
    assert.equal(sanitizeDiagnostic(diagnostic), 'WebSocket ws://127.0.0.1:5173/channel failed');
    assert.equal(
      safeEvidenceURL('https://fixture:password@outside.invalid/path?a=1#b'),
      'https://outside.invalid/path'
    );
    assert.equal(safeEvidenceURL('/relative?fixture=one#two'), '/relative');
    assert.equal(
      allowOwnRequest('ws://127.0.0.1:5173/', 'http://127.0.0.1:4398'),
      false,
      'Do not widen ownership to arbitrary loopback ports'
    );
    const failures = [];
    await routeOwnResponse(
      {
        request: () => ({ url: () => 'https://outside.invalid/path?fixture_token=value#fragment' }),
        abort: async () => {},
      },
      'http://127.0.0.1:4398',
      (failure) => failures.push(failure)
    );
    assert.equal(failures[0].url, 'https://outside.invalid/path');
    const sanitized = sanitizeDiagnostic(
      'Error at http://127.0.0.1:4398/a?x=1#y and https://outside.invalid/b?z=2'
    );
    assert.equal(sanitized, 'Error at http://127.0.0.1:4398/a and https://outside.invalid/b');
    for (const location of [
      '/relative?fixture_token=fixture-value#fragment',
      '../relative?fixture_token=fixture-value#fragment',
      '//fixture-user:fixture-pass@outside.invalid/relative?fixture_token=fixture-value#fragment',
    ]) {
      const diagnostic = sanitizeDiagnostic(
        `Error: Refusing documentation readiness redirect: http://127.0.0.1:4398/doc -> HTTP 302 Location ${location}`
      );
      assert.ok(!diagnostic.includes('fixture_token'), diagnostic);
      assert.ok(!diagnostic.includes('fixture-value'), diagnostic);
      assert.ok(!diagnostic.includes('fixture-pass'), diagnostic);
      assert.ok(!diagnostic.includes('#fragment'), diagnostic);
      assert.match(diagnostic, /Location .*relative$/);
    }
    assert.match(runner, /safeEvidenceURL\(socket\.url\(\)\)/);
    assert.match(runner, /safeEvidenceURL\(request\.url\(\)\)/);
    assert.match(runner, /entry\.error = sanitizeDiagnostic/);
  });
  it('binds production output to the clean source before preview and rejects changed or absent bytes', async () => {
    const temp = mkdtempSync(path.join(os.tmpdir(), 'reading-production-'));
    const root = path.join(temp, 'repo');
    const out = path.join(temp, 'evidence');
    mkdirSync(root);
    const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
      git(['init', '--quiet']);
      writeFileSync(path.join(root, '.gitignore'), '/apps/www/dist/\n');
      git(['add', '.gitignore']);
      git([
        '-c',
        'user.name=Contract Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--quiet',
        '-m',
        'Fixture',
      ]);
      const expectedHead = git(['rev-parse', 'HEAD']);
      const options = { root, out, expectedHead };
      await beginReadingBuild(options);
      for (const route of new Set(READING_CASES.map(({ route }) => route))) {
        const directory = path.join(root, 'apps/www/dist', route.slice(1));
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          path.join(directory, 'index.html'),
          '<main>Structural build fixture only</main>'
        );
      }
      const receipt = await finishReadingBuild(options);
      assert.equal(receipt.sourceBeforeBuild.actualGitHead, expectedHead);
      assert.equal(receipt.sourceAfterBuild.actualGitHead, expectedHead);
      assert.equal(receipt.inventory.fileCount, 2);
      assert.equal((await verifyReadingBuild(options)).inventory.sha256, receipt.inventory.sha256);
      const html = path.join(root, 'apps/www/dist/zh-cn/start-here/quick-start/index.html');
      writeFileSync(html, 'Changed bytes after receipt');
      await assert.rejects(verifyReadingBuild(options), /bytes changed/);
      rmSync(html);
      await assert.rejects(
        readingBuildInventory(path.join(root, 'apps/www/dist')),
        /Missing production reading route/
      );
      const incorrect = { ...receipt, sourceBeforeBuild: { actualGitHead: '0'.repeat(40) } };
      writeFileSync(path.join(out, 'production-build.json'), JSON.stringify(incorrect));
      await assert.rejects(verifyReadingBuild(options), /does not match/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    assert.ok(runner.indexOf('verifyReadingBuild(') < runner.indexOf('startReadingPreview()'));
  });
  it('owns the supported production preview, rejects fallback and keeps readiness no-follow', async () => {
    const calls = [];
    const reports = [];
    let stopped = 0;
    const preview = {
      server: { address: () => ({ address: '127.0.0.1', port: READING_PREVIEW_PORT }) },
      closed: () => new Promise(() => {}),
      stop: async () => {
        stopped += 1;
      },
    };
    const owned = await startReadingPreview(
      { root: '/fixture' },
      {
        start: async (config) => {
          assert.deepEqual(config, { root: '/fixture/apps/www', port: READING_PREVIEW_PORT });
          return preview;
        },
        readiness: async (url, options) => {
          calls.push(url);
          assert.equal(options.rejectRedirects, true);
          options.report('Probe http://127.0.0.1:4398/path?fixture_token=value');
        },
        report: (message) => reports.push(message),
      }
    );
    assert.equal(owned.mode, 'astro-production-preview-no-hmr');
    assert.equal(calls.length, 2);
    assert.ok(calls.every((url) => new URL(url).port === String(READING_PREVIEW_PORT)));
    assert.ok(reports.every((line) => !line.includes('fixture_token')));
    assert.equal(stopped, 0);
    await owned.preview.stop();
    await assert.rejects(
      startReadingPreview(
        {},
        {
          start: async () => ({
            ...preview,
            server: { address: () => ({ address: '127.0.0.1', port: 5173 }) },
          }),
        }
      ),
      /exact owned loopback/
    );
    assert.equal(stopped, 2);
    await assert.rejects(
      startReadingPreview(
        {},
        {
          start: async () => preview,
          readiness: async () => {
            throw new Error('fixture readiness failure');
          },
        }
      ),
      /fixture readiness failure/
    );
    assert.equal(stopped, 3);
  });
  it('reads PNG dimensions from original bytes and rejects JPEG/downscaled claims', () => {
    const png = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.write('IHDR', 12);
    png.writeUInt32BE(1180, 16);
    png.writeUInt32BE(757, 20);
    assert.deepEqual(pngDimensions(png), READING_VIEWPORT);
    assert.throws(() => pngDimensions(Buffer.from([255, 216, 255])), /original PNG/);
    assert.match(runner, /dimensions\.width !== viewport\.width/);
    for (const field of [
      'mtimeUTC',
      'originalURL',
      'finalURL',
      'pageErrors',
      'sha256',
      'fullPage',
      'browserVersion',
    ])
      assert.ok(runner.includes(field), field);
  });
  it('requires an exact clean SHA including no untracked files and leaves its test fixture isolated', () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'reading-binding-'));
    const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    try {
      git(['init', '--quiet']);
      writeFileSync(path.join(cwd, 'fixture.txt'), 'Fixture source\n');
      git(['add', 'fixture.txt']);
      git([
        '-c',
        'user.name=Contract Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--quiet',
        '-m',
        'Fixture',
      ]);
      const head = git(['rev-parse', 'HEAD']);
      assert.equal(readSourceBinding(head, cwd).actualGitHead, head);
      assert.throws(() => readSourceBinding('main', cwd), /full lowercase/);
      assert.throws(() => readSourceBinding('0'.repeat(40), cwd), /SHA mismatch/);
      writeFileSync(path.join(cwd, 'untracked.txt'), 'must reject');
      assert.throws(() => readSourceBinding(head, cwd), /worktree must be clean/);
      rmSync(path.join(cwd, 'untracked.txt'));
      writeFileSync(path.join(cwd, 'fixture.txt'), 'modified');
      assert.throws(() => readSourceBinding(head, cwd), /worktree must be clean/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
    assert.equal(
      (runner.match(/readSourceBinding\(process\.env\.PROTO_UI_EXPECTED_HEAD\)/g) ?? []).length,
      3
    );
    assert.match(runner, /sourceSha: null/);
  });
  it('retains failures, uses read-only exact-head checkout and an independent bounded job', () => {
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    for (const owner of [
      'apps/www/scripts/search-production-preview.mjs',
      'apps/www/package.json',
      'apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx',
      'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/radio-group.mdx',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      'scripts/test/server-readiness.mjs',
      'scripts/test/server-readiness.d.mts',
      'apps/www/src/components/site-text-recipes*',
      'apps/www/src/components/site-typography*',
      'apps/www/src/components/override/MarkdownContent.astro',
      'apps/www/src/components/override/TwoColumnContent.astro',
      'apps/www/src/styles/markdown.css',
      'packages/prototypes/base/src/text/**',
      'packages/prototypes/shadcn/src/text/**',
      'packages/cli/src/services/proto-style-css.ts',
    ])
      assert.ok(
        workflow.on.pull_request.paths.includes(owner),
        `Missing reading owner trigger ${owner}`
      );

    assert.deepEqual(Object.keys(workflow.jobs), ['capture']);
    const job = workflow.jobs.capture;
    assert.equal(job.strategy, undefined);
    assert.equal(job['timeout-minutes'], 25);
    const build = job.steps.find(
      (step) => step.name === 'Build the exact clean candidate and bind production bytes'
    );
    assert.equal(build['timeout-minutes'], 10);
    assert.ok(build.run.indexOf('begin-build') < build.run.indexOf('--filter apps-www build'));
    assert.ok(build.run.indexOf('--filter apps-www build') < build.run.indexOf('finish-build'));
    assert.equal(build.env.PROTO_UI_EXPECTED_HEAD, '${{ env.CANDIDATE_SHA }}');
    const checkout = job.steps.find(({ uses }) => uses === 'actions/checkout@v4');
    assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
    assert.equal(checkout.with['persist-credentials'], false);
    const capture = job.steps.find(
      (step) => step.name === 'Capture two routes and both themes at the actual reference viewport'
    );
    assert.match(capture.run, /timeout --signal=TERM --kill-after=10s 600s/);
    assert.match(
      capture.run,
      /node --import tsx apps\/www\/scripts\/capture-reading-reference.mjs/
    );
    const artifact = job.steps.find(({ uses }) => uses === 'actions/upload-artifact@v4');
    assert.equal(artifact.if, 'always()');
    assert.match(runner, /entry\.outcome = 'failed'/);
    assert.match(runner, /await context\.close\(\);\s*await save\(\)/);
    assert.match(runner, /process\.exitCode = 1/);
    assert.doesNotMatch(runner, /addStyleTag|setContent\(|evaluate\([^\n]*style/);
    assert.equal(
      (runner.match(/\.click\(/g) ?? []).length,
      1,
      'Only the native theme button may be clicked'
    );
    assert.match(runner, /locator\('header \[data-theme-toggle\]'\)\.click\(\)/);
    assert.match(runner, /colorScheme: 'light'/);
  });
});
