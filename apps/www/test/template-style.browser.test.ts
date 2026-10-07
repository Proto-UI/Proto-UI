// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createServer as createViteServer,
  type ViteDevServer,
} from '../../workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../src/content/docs/zh-cn/browser-harness';
import { CALLER_STYLE, OWNED_STYLE } from './fixtures/template-style/tokens';

let server: Server;
let vite: ViteDevServer;
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';
const baseline = process.env.PROTO_UI_TEMPLATE_BASELINE === '1';
const mode = baseline ? 'baseline' : 'candidate';
beforeAll(async () => {
  evidenceDir =
    process.env.PROTO_UI_TEMPLATE_EVIDENCE_DIR ??
    (await mkdtemp(path.join(tmpdir(), 'template-style-evidence-')));
  await mkdir(evidenceDir, { recursive: true });
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, `vite-${mode}`),
    configFile: fileURLToPath(new URL('./fixtures/template-style/vite.config.ts', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Template fixture needs a TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
}, 60_000);
afterAll(async () => {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
}, 60_000);

it('paints all four actual adapters from generated PUI CSS and preserves ownership across transitions', async () => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(baseUrl);
    await page.waitForSelector('body[data-ready="true"]');
    const facts = () => page.evaluate(() => (window as any).templateStyleFixture.facts());
    const styled = await facts();
    // Retain actual initial paint even when a later assertion fails.
    const provenance = {
      fixtureHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      adapterSource: process.env.PROTO_UI_TEMPLATE_SOURCE_SHA ?? 'same as fixtureHead',
      browser: browser.version(),
    };
    await page.screenshot({ path: path.join(evidenceDir, `${mode}-styled.png`), fullPage: true });
    await writeFile(
      path.join(evidenceDir, `${mode}-initial-facts.json`),
      JSON.stringify(
        { mode, status: 'observed-before-assertions', ...provenance, styled, errors },
        null,
        2
      )
    );
    expect(styled).toHaveLength(4);
    // Ready means the initial framework commit and ownership snapshot both completed.
    expect(styled.map((entry: any) => entry.originalRootCarrier)).toEqual([
      'p-8 p-1', // WC keeps the caller-owned carrier before its own feedback contribution.
      'p-1',
      'p-1',
      'p-1',
    ]);
    for (const [index, entry] of styled.entries()) {
      expect(entry.padding).toBe(baseline ? '0px' : '16px');
      expect(entry.background).toBe(baseline ? 'rgba(0, 0, 0, 0)' : 'rgb(0, 68, 204)');
      expect(entry.ownedCarrier).toBe(baseline ? null : 'block w-16 h-8 p-4 bg-[#04c] opacity-100');
      expect(entry.ownedClass).toBe(
        index === 0 ? null : 'block w-16 h-8 p-4 bg-[#04c] opacity-100'
      );
      expect(entry.inlineStyle).toBeNull();
    }
    const assertOwnership = (entries: any[]) => {
      for (const entry of entries) {
        expect(entry.rootIdentity).toBe(true);
        expect(entry.rootCarrier).toBe(entry.originalRootCarrier);
        expect(entry.slotIdentity).toBe(true);
        expect(entry.slotClass).toBe('caller-slot p-8');
        expect(entry.slotCarrier).toBe(CALLER_STYLE);
      }
    };
    assertOwnership(styled);
    for (const phase of ['empty', 'absent', 'styled']) {
      await page.evaluate((value) => (window as any).templateStyleFixture.update(value), phase);
      const current = await facts();
      assertOwnership(current);
      if (phase !== 'styled')
        for (const entry of current) {
          expect(entry.ownedCarrier).toBeNull();
          expect(entry.padding).toBe('0px');
          expect(entry.background).toBe('rgba(0, 0, 0, 0)');
        }
      else
        expect(current.map((entry: any) => entry.ownedCarrier)).toEqual(
          styled.map((entry: any) => entry.ownedCarrier)
        );
    }
    await page.evaluate(() => (window as any).templateStyleFixture.resolver());
    const resolved = await facts();
    expect(resolved[0].resolverInput).toBe(OWNED_STYLE);
    expect(resolved[0].padding).toBe('3px');
    expect(resolved[0].background).toBe('rgb(22, 163, 74)');
    assertOwnership(resolved);
    await page.screenshot({ path: path.join(evidenceDir, `${mode}-resolver.png`), fullPage: true });
    await page.evaluate(() => (window as any).templateStyleFixture.dispose());
    expect(await page.locator('[data-pui-root]').count()).toBe(0);
    expect(await page.locator('[data-pui-style]').count()).toBe(0);
    expect(errors).toEqual([]);
    await writeFile(
      path.join(evidenceDir, `${mode}-facts.json`),
      JSON.stringify(
        {
          mode,
          status: 'passed',
          ...provenance,
          styled,
          resolved,
          errors,
        },
        null,
        2
      )
    );
  } finally {
    await page.close();
  }
}, 60_000);
