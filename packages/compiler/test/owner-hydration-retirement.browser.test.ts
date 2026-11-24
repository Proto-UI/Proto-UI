// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from '../../../apps/www/node_modules/playwright-core';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { compileOwnerHydrationFixture, ownerHydrationSource } from './owner-hydration-fixture';

interface GeneratedHost extends HTMLElement {
  hydrationStatus: string;
  logicalOwner: symbol | null;
  getExposes(): { value: { get(): number } };
  setProps(props: { seed: number }): void;
  dispose(): void;
}
declare global {
  interface Window {
    OwnerHydrationFixture: { register(): void };
  }
}

const tagName = 'pui-browser-owner-retirement';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
let browser: Browser | undefined;
let server: Server | undefined;
let baseUrl = '';
let evidenceDir = '';
let provenance: Record<string, unknown>;

beforeAll(async () => {
  const fixture = compileOwnerHydrationFixture(tagName);
  const sources = new Map(fixture.files.map((file) => [file.path, file.contents]));
  const positioningRequire = createRequire(
    new URL('../../modules/positioning/package.json', import.meta.url)
  );
  const bundled = await build({
    entryPoints: ['Component.client.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'OwnerHydrationFixture',
    platform: 'browser',
    target: 'es2022',
    plugins: [
      {
        name: 'owner-hydration-generated-artifacts',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === '@floating-ui/dom')
              return { path: positioningRequire.resolve(args.path) };
            if (args.namespace && args.namespace !== 'owner-generated') return undefined;
            const target = path.posix.normalize(
              path.posix.join(path.posix.dirname(args.importer || 'Component.client.ts'), args.path)
            );
            for (const candidate of [target, `${target}.ts`])
              if (sources.has(candidate)) return { path: candidate, namespace: 'owner-generated' };
            throw new Error(`Generated dependency escaped artifact set: ${args.path}`);
          });
          builder.onLoad({ filter: /.*/, namespace: 'owner-generated' }, (args) => ({
            contents: sources.get(args.path)!,
            loader: 'ts',
          }));
        },
      },
    ],
  });
  const bundle = bundled.outputFiles[0].text;
  const evidenceRoot =
    process.env.COMPILER_EVIDENCE_DIR ?? process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  evidenceDir = evidenceRoot
    ? path.resolve(evidenceRoot, 'owner-hydration-retirement')
    : await mkdtemp(path.join(tmpdir(), 'proto-owner-hydration-'));
  await mkdir(evidenceDir, { recursive: true });
  provenance = {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceSha256: sha256(ownerHydrationSource),
    bundleSha256: sha256(bundle),
    artifacts: fixture.files.map((file) => ({ path: file.path, sha256: sha256(file.contents) })),
    hydrationArtifacts: fixture.server.hydrationArtifacts,
    scope:
      'Private generated WC SSR adoption and replacement, not canonical SSR target admission or application trust.',
  };
  await writeFile(path.join(evidenceDir, 'provenance.json'), JSON.stringify(provenance, null, 2));
  await writeFile(path.join(evidenceDir, 'client.js'), bundle);
  server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/client.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(bundle);
      return;
    }
    if (request.url !== '/') {
      response.writeHead(404).end();
      return;
    }
    const rendered = fixture.server.renderToString({ seed: 3 });
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Owner retirement consumer</title><style data-pui-ssr-css="${fixture.server.hydrationArtifacts.css}">${fixture.css}</style><style>body{font:18px sans-serif;margin:32px}output{display:block;font-size:48px;padding:24px;border:2px solid #5e7187}</style></head><body><h1>Generated owner replacement</h1>${rendered.html}<script defer src="/client.js"></script></body></html>`
    );
  });
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No generated consumer address');
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

it.each(['unmounted', 'disposed', 'terminal', 'same-checkpoint'] as const)(
  'keeps generated owner lifetime and visible updates correct through %s',
  async (scenario) => {
    if (!browser) throw new Error('Browser did not start');
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let failure: string | null = null;
    let observed: unknown;
    try {
      expect((await page.goto(baseUrl))?.status()).toBe(200);
      await page.waitForFunction(() => !!window.OwnerHydrationFixture);
      observed = await page.evaluate(
        async ({ tagName, scenario }) => {
          const host = document.querySelector<GeneratedHost>(tagName)!;
          const originalOutput = host.querySelector('output');
          const phases: string[] = [];
          const duringReconnect: (string | null)[] = [];
          let shouldReconnect = scenario !== 'same-checkpoint';
          host.addEventListener('phase', (event) => {
            const phase = (event as CustomEvent<string>).detail;
            phases.push(phase);
            if (phase === (scenario === 'terminal' ? 'disposed' : scenario) && shouldReconnect) {
              shouldReconnect = false;
              if (scenario === 'terminal') host.dispose();
              document.body.append(host);
              duringReconnect.push(host.logicalOwner === null ? null : 'active-owner');
            }
          });
          window.OwnerHydrationFixture.register();
          const adopted = host.hydrationStatus === 'adopted';
          const sameOutput = host.querySelector('output') === originalOutput;
          const originalOwner = host.logicalOwner;
          const originalState = host.getExposes().value;
          host.remove();
          if (scenario === 'same-checkpoint') document.body.append(host);
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
          const sameOwner = host.logicalOwner === originalOwner;
          let oldStateRetired = false;
          try {
            originalState.get();
          } catch {
            oldStateRetired = true;
          }
          if (scenario === 'terminal') {
            let rejectsProps = false;
            try {
              host.setProps({ seed: 9 });
            } catch {
              rejectsProps = true;
            }
            return {
              adopted,
              sameOutput,
              phases,
              duringReconnect,
              oldStateRetired,
              owner: host.logicalOwner === null ? null : 'active-owner',
              rejectsProps,
            };
          }
          const sameState = host.getExposes().value === originalState;
          host.setProps({ seed: 9 });
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
          return {
            adopted,
            sameOutput,
            phases,
            duringReconnect,
            oldStateRetired,
            sameOwner,
            sameState,
            state: host.getExposes().value.get(),
            text: host.querySelector('output')?.textContent,
          };
        },
        { tagName, scenario }
      );
      expect(observed).toMatchObject({ adopted: true, sameOutput: true });
      if (scenario === 'terminal') {
        expect(observed).toMatchObject({
          oldStateRetired: true,
          owner: null,
          rejectsProps: true,
          phases: ['created', 'mounted', 'unmounted', 'disposed'],
          duringReconnect: [null],
        });
      } else if (scenario === 'same-checkpoint') {
        expect(observed).toMatchObject({
          oldStateRetired: false,
          sameOwner: true,
          sameState: true,
          state: 9,
          text: '9',
          phases: ['created', 'mounted'],
        });
      } else {
        expect(observed).toMatchObject({
          oldStateRetired: true,
          sameOwner: false,
          sameState: false,
          state: 9,
          text: '9',
          phases: ['created', 'mounted', 'unmounted', 'disposed', 'created', 'mounted'],
          duringReconnect: [null],
        });
      }
      expect(errors).toEqual([]);
      await page.screenshot({ path: path.join(evidenceDir, `${scenario}.png`) });
    } catch (error) {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw error;
    } finally {
      await writeFile(
        path.join(evidenceDir, `${scenario}.json`),
        JSON.stringify(
          {
            ...provenance,
            browser: browser.version(),
            scenario,
            observed,
            errors,
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
