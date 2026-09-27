import { createServer } from 'node:http';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from '../../../apps/workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type { Browser } from '../../../apps/www/node_modules/playwright-core/types/types';
import { buttonCases, evaluateButtonCase } from '../src/conformance/button-cases';
import { assessCase } from '../src/conformance/result';
import type { IdentityNormalization, SemanticCheckpoint } from '../src/conformance/trace';
import { writeCaseEvidence } from './case-evidence';

export interface BrowserFixture {
  browser: Browser;
  baseUrl: string;
  evidenceDir: string;
  close(): Promise<void>;
}

/** One fixture server and browser per suite; a shared evidence root enables CI collection. */
export async function startBrowserFixture(prefix: string): Promise<BrowserFixture> {
  const evidenceDir = process.env.COMPILER_EVIDENCE_DIR
    ? path.resolve(process.env.COMPILER_EVIDENCE_DIR, prefix)
    : await mkdtemp(path.join(tmpdir(), `proto-compiler-${prefix}-`));
  await mkdir(evidenceDir, { recursive: true });
  const server = createServer();
  const vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('./fixtures/differential-browser/vite.config.ts', import.meta.url)
    ),
    server: { middlewareMode: true, hmr: { server } },
  });
  server.on('request', vite.middlewares);
  let browser: Browser | undefined;
  const close = async () => {
    try {
      await browser?.close();
    } finally {
      try {
        await vite.close();
      } finally {
        if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  };
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Compiler fixture has no TCP address');
    browser = await launchBrowser();
    console.log(`Compiler ${prefix} browser evidence: ${evidenceDir}`);
    return { browser, baseUrl: `http://127.0.0.1:${address.port}`, evidenceDir, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Persist observed inputs to assessment, including FAIL/BLOCKED; callers assert acceptance after. */
export async function recordBrowserCase(
  fixture: BrowserFixture,
  id: string,
  reference: readonly SemanticCheckpoint[],
  candidate: readonly SemanticCheckpoint[],
  identities?: { reference?: IdentityNormalization; candidate?: IdentityNormalization },
  harnessError?: string
) {
  const definition = buttonCases().find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unregistered case ${id}`);
  const result = harnessError
    ? assessCase({ id, requiredCriteria: definition.requiredCriteria, harnessError })
    : evaluateButtonCase(id, reference, candidate, identities);
  await writeCaseEvidence(
    fixture.evidenceDir,
    result,
    reference,
    candidate,
    identities,
    fixture.browser.version(),
    harnessError
  );
  return result;
}
