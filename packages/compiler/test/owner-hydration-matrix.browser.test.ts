// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from '../../../apps/www/node_modules/playwright-core';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { buildOwnerMatrix } from './owner-hydration-matrix-build';
import {
  ownerMatrixCases,
  type OwnerMatrixFixture,
  type OwnerMatrixJourney,
  type OwnerMatrixTarget,
} from './owner-hydration-matrix-fixture';
import { assertOwnerMatrix, assertServerOwnership } from './owner-hydration-matrix-assertions';

declare global {
  interface Window {
    OwnerBrowserMatrix: {
      run(
        target: OwnerMatrixTarget,
        journey: OwnerMatrixJourney,
        fixture: OwnerMatrixFixture
      ): Promise<unknown>;
      dispose(): Promise<unknown>;
    };
  }
}
const sha256 = (input: string) => createHash('sha256').update(input).digest('hex');
let browser: Browser | undefined,
  server: Server | undefined,
  baseUrl = '',
  evidenceDir = '';
let built: Awaited<ReturnType<typeof buildOwnerMatrix>>;
let provenance: Record<string, unknown>;

beforeAll(async () => {
  built = await buildOwnerMatrix();
  for (const { target, journey } of ownerMatrixCases)
    assertServerOwnership(built.fixtures[`${target}/${journey}`], journey);
  const evidenceRoot =
    process.env.COMPILER_EVIDENCE_DIR ?? process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  evidenceDir = evidenceRoot
    ? path.resolve(evidenceRoot, 'owner-hydration-matrix')
    : await mkdtemp(path.join(tmpdir(), 'proto-owner-matrix-'));
  await mkdir(evidenceDir, { recursive: true });
  const sourceFiles = [
    'packages/compiler/src/react-source.ts',
    'packages/compiler/src/react-ssr-source.ts',
    'packages/compiler/src/vue-source.ts',
    'packages/compiler/src/vue-ssr-support.ts',
    'packages/compiler/src/vue2-source.ts',
    'packages/compiler/src/vue2-ssr-entry.ts',
    'packages/compiler/src/owner-initial-data.ts',
    'packages/compiler/src/native-context.ts',
    'packages/compiler/test/owner-hydration-matrix-fixture.ts',
    'packages/compiler/test/owner-hydration-matrix-build.ts',
    'packages/compiler/test/owner-hydration-matrix-consumer.ts',
    'packages/compiler/test/owner-hydration-matrix-assertions.ts',
    'packages/compiler/test/owner-hydration-matrix.browser.test.ts',
    'packages/compiler/test/vue-owner-initial-graph.test.ts',
    'scripts/test/runtime-test-plan.mjs',
    'spec/tests/T-LIFECYCLE-OWNER-BROWSER-0001.yaml',
    'spec/contracts/C-LIFECYCLE-OWNER-INITIALIZATION-0001.yaml',
  ];
  provenance = {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    ...built.provenance,
    sourceBindings: await Promise.all(
      sourceFiles.map(async (file) => ({ file, sha256: sha256(await readFile(file, 'utf8')) }))
    ),
    bundleSha256: sha256(built.bundle),
    fixtureSha256: sha256(JSON.stringify(built.fixtures)),
    browserInputs: built.browserInputs,
    scope:
      'Private emitted React/Vue3/Vue2 adoption, native cleanup, current controlled input, State identity and Context graph reconstruction. Not canonical SSR admission, arbitrary state migration, application provenance or complete per-target acceptance.',
  };
  await writeFile(path.join(evidenceDir, 'provenance.json'), JSON.stringify(provenance, null, 2));
  await writeFile(path.join(evidenceDir, 'client.js'), built.bundle);
  await writeFile(path.join(evidenceDir, 'fixtures.json'), JSON.stringify(built.fixtures, null, 2));
  server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/client.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(built.bundle);
      return;
    }
    const key = request.url?.replace(/^\//, '').replace(/\/$/, '') ?? '';
    const fixture = built.fixtures[key];
    if (!fixture) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Generated owner matrix</title><style>body{font:18px system-ui;margin:28px;background:#f8fafc;color:#152238}h1{font-size:24px}section{border:1px solid #7393ad;padding:16px;margin:10px}output{font-size:28px;margin:12px;display:inline-block}button{font:inherit;padding:10px}article{border-left:3px solid #cbd5e1;padding-left:14px}</style></head><body><h1>Generated ${key} owner consumer</h1><div id="owner-matrix-host">${fixture.html}</div><script defer src="/client.js"></script></body></html>`
    );
  });
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No actual owner consumer address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve()))
    );
});

it.each(ownerMatrixCases)(
  'runs actual $target $journey across fresh ownership and terminal cleanup',
  async ({ target, journey }) => {
    if (!browser) throw new Error('Sandboxed browser did not start');
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    const errors: string[] = [],
      consoleMessages: { type: string; text: string }[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) =>
      consoleMessages.push({ type: message.type(), text: message.text() })
    );
    let observed: unknown,
      final: unknown,
      failure: string | null = null;
    try {
      expect((await page.goto(`${baseUrl}/${target}/${journey}/`))?.status()).toBe(200);
      await page.waitForFunction(() => !!window.OwnerBrowserMatrix);
      observed = await page.evaluate(
        ({ target, journey, fixture }) => window.OwnerBrowserMatrix.run(target, journey, fixture),
        { target, journey, fixture: built.fixtures[`${target}/${journey}`] }
      );
      await page.screenshot({
        path: path.join(evidenceDir, `${target}-${journey}.png`),
        fullPage: true,
      });
      final = await page.evaluate(() => window.OwnerBrowserMatrix.dispose());
      assertOwnerMatrix(journey, observed, final);
      expect(errors).toEqual([]);
    } catch (error) {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw error;
    } finally {
      await writeFile(
        path.join(evidenceDir, `${target}-${journey}.json`),
        JSON.stringify(
          {
            ...provenance,
            browser: browser.version(),
            target,
            journey,
            observed,
            final,
            errors,
            consoleMessages,
            failure,
            outcome: failure ? 'FAIL' : 'PASS',
          },
          null,
          2
        )
      );
      await page.close();
    }
  },
  30_000
);
