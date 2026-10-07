// @vitest-environment node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const ROUTE = '/en/ui-libraries/base/table/';
const VERSION = '19.2.6';
const fixtureUrl = `/@fs/${path.resolve('apps/www/test/fixtures/table-react19.ts').replaceAll('\\', '/')}`;
type FixtureWindow = Window & { __tableReact19Unmount?: () => void };
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// C-TABLE-STRUCTURE-0001 PLACEMENT, HEADER-RELATIONS, CHURN, A11Y-PROJECTION.
// A-REACT-18-19-0001-TABLE / T-TABLE-STRUCTURE-0001-CASE-A11Y-BOUNDARY.
describe.sequential('real React 19 Table browser consumer', () => {
  it('projects counts, spans, caption and ordered headers, then invalidates and recovers', async () => {
    const context = await browser.newContext({ viewport: { width: 1100, height: 820 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
      // Keep native browser imports outside Vitest's SSR callback transform.
      const versions = await page.evaluate(`(async () => {
          const [React, ReactDOMClient, ReactDOM, fixture] = await Promise.all([
            import(${JSON.stringify(`https://esm.sh/react@${VERSION}`)}),
            import(${JSON.stringify(`https://esm.sh/react-dom@${VERSION}/client`)}),
            import(${JSON.stringify(`https://esm.sh/react-dom@${VERSION}`)}),
            import(${JSON.stringify(fixtureUrl)}),
          ]);
          const host = document.createElement('div');
          host.id = 'table-react19-consumer';
          document.body.appendChild(host);
          window.__tableReact19Unmount = fixture.mountTableReact19(
            host,
            React,
            ReactDOMClient
          );
          return { react: React.version, reactDom: ReactDOM.version };
        })()`);
      expect(versions).toEqual({ react: VERSION, reactDom: VERSION });
      const host = page.locator('#table-react19-consumer');
      const table = host.locator('.fixture-table');
      const value = host.locator('.fixture-value');
      await page.waitForFunction(
        () =>
          document.querySelector('#table-react19-consumer .fixture-table')?.getAttribute('role') ===
          'table'
      );

      const attributes = async (selector: string, names: string[]) =>
        host
          .locator(selector)
          .evaluate(
            (node, names) =>
              Object.fromEntries(names.map((name) => [name, node.getAttribute(name)])),
            names
          );
      const captionId = await host.locator('.fixture-caption').getAttribute('id');
      const ownerId = await host.locator('.fixture-owner').getAttribute('id');
      const quarterId = await host.locator('.fixture-quarter').getAttribute('id');
      const valueId = await value.getAttribute('id');
      for (const id of [captionId, ownerId, quarterId, valueId]) expect(id).toBeTruthy();
      expect(ownerId).not.toBe('owner-key');
      expect(quarterId).not.toBe('quarter-key');
      expect(
        await attributes('.fixture-table', ['aria-rowcount', 'aria-colcount', 'aria-labelledby'])
      ).toEqual({ 'aria-rowcount': '3', 'aria-colcount': '3', 'aria-labelledby': captionId });
      expect(
        await host
          .locator('[role="row"]')
          .evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-rowindex')))
      ).toEqual(['1', '2', '3']);
      expect(
        await attributes('.fixture-quarter', [
          'role',
          'aria-rowindex',
          'aria-colindex',
          'aria-colspan',
        ])
      ).toEqual({
        role: 'columnheader',
        'aria-rowindex': '1',
        'aria-colindex': '1',
        'aria-colspan': '3',
      });
      expect(
        await attributes('.fixture-owner', [
          'role',
          'aria-rowindex',
          'aria-colindex',
          'aria-rowspan',
        ])
      ).toEqual({
        role: 'rowheader',
        'aria-rowindex': '2',
        'aria-colindex': '1',
        'aria-rowspan': '2',
      });
      expect(
        await attributes('.fixture-value', [
          'role',
          'aria-rowindex',
          'aria-colindex',
          'aria-rowspan',
          'aria-colspan',
          'aria-labelledby',
        ])
      ).toEqual({
        role: 'cell',
        'aria-rowindex': '2',
        'aria-colindex': '2',
        'aria-rowspan': '1',
        'aria-colspan': '2',
        'aria-labelledby': `${ownerId} ${quarterId} ${valueId}`,
      });
      expect(
        await attributes('.fixture-tail', ['aria-rowindex', 'aria-colindex', 'aria-colspan'])
      ).toEqual({ 'aria-rowindex': '3', 'aria-colindex': '2', 'aria-colspan': '2' });

      await host.locator('[data-table-action="reverse"]').click();
      await page.waitForFunction(
        ({ ownerId, quarterId, valueId }) =>
          document
            .querySelector('#table-react19-consumer .fixture-value')
            ?.getAttribute('aria-labelledby') === `${quarterId} ${ownerId} ${valueId}`,
        { ownerId, quarterId, valueId }
      );

      await host.locator('[data-table-action="invalidate"]').click();
      await page.waitForFunction(
        () =>
          !document.querySelector('#table-react19-consumer .fixture-table')?.hasAttribute('role')
      );
      for (const selector of [
        '.fixture-table',
        '.fixture-caption',
        '.fixture-heading-row',
        '.fixture-data-row',
        '.fixture-tail-row',
        '.fixture-quarter',
        '.fixture-owner',
        '.fixture-value',
        '.fixture-tail',
      ]) {
        expect(
          await attributes(selector, [
            'role',
            'aria-rowcount',
            'aria-colcount',
            'aria-rowindex',
            'aria-colindex',
            'aria-rowspan',
            'aria-colspan',
            'aria-labelledby',
          ])
        ).toEqual(
          Object.fromEntries(
            [
              'role',
              'aria-rowcount',
              'aria-colcount',
              'aria-rowindex',
              'aria-colindex',
              'aria-rowspan',
              'aria-colspan',
              'aria-labelledby',
            ].map((name) => [name, null])
          )
        );
      }
      expect(await value.textContent()).toBe('Ada');

      await host.locator('[data-table-action="recover"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#table-react19-consumer .fixture-table')?.getAttribute('role') ===
          'table'
      );
      expect(await table.getAttribute('aria-labelledby')).toBe(captionId);
      expect(await value.getAttribute('aria-labelledby')).toBe(
        `${quarterId} ${ownerId} ${valueId}`
      );
      expect(await attributes('.fixture-table', ['aria-rowcount', 'aria-colcount'])).toEqual({
        'aria-rowcount': '3',
        'aria-colcount': '3',
      });
      expect(await value.textContent()).toBe('Ada');

      if (process.env.PROTO_UI_TABLE_SCREENSHOT_DIR) {
        await mkdir(process.env.PROTO_UI_TABLE_SCREENSHOT_DIR, { recursive: true });
        await host.screenshot({
          path: path.join(process.env.PROTO_UI_TABLE_SCREENSHOT_DIR, 'react19.png'),
        });
      }
      await page.evaluate(() => (window as FixtureWindow).__tableReact19Unmount?.());
      await page.waitForFunction(
        () => document.querySelector('#table-react19-consumer')?.childElementCount === 0
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }, 90_000);
});
