// Issue #1191 mobile Popover shell evidence capture.
// Run from the apps/www directory: cd apps/www && node scripts/capture-issue-1191-evidence.mjs
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { chromium } from 'playwright-core';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || 'test/evidence/issue-1191';
const VIEWPORTS = [320, 390, 1188, 1279, 1280, 1440, 1920];
const FONT_SIZES = [16, 20, 24, 32];
const DOCS_ROUTE = '/zh-cn/start-here/what-you-saw/';

let devServer = null;
let serverOutput = '';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (!addr || typeof addr === 'string') {
        s.close();
        reject(new Error('no port'));
        return;
      }
      s.close((err) => (err ? reject(err) : resolve(addr.port)));
    });
  });
}

async function waitReady(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready. Output:\n${serverOutput.slice(-4000)}`);
}

async function startServer() {
  const port = await availablePort();
  const executable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  // Style gen is already done by the repo setup; just start astro dev
  devServer = spawn(
    executable,
    [
      'pnpm@10.32.1',
      '--filter',
      'apps-www',
      'exec',
      'astro',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: process.cwd() + '/../..', // repo root for pnpm filter
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );
  devServer.stdout?.on('data', (c) => (serverOutput += c.toString()));
  devServer.stderr?.on('data', (c) => (serverOutput += c.toString()));
  const url = `http://127.0.0.1:${port}`;
  await waitReady(url + DOCS_ROUTE);
  return url;
}

async function stopServer() {
  if (!devServer || devServer.exitCode !== null || !devServer.pid) return;
  try {
    process.kill(-devServer.pid, 'SIGTERM');
  } catch {}
  await new Promise((r) => setTimeout(r, 3000));
  try {
    if (devServer.exitCode === null) process.kill(-devServer.pid, 'SIGKILL');
  } catch {}
}

async function captureViewport(browser, baseUrl, width, fontSize, results) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.addInitScript((fs) => {
    document.documentElement.style.fontSize = `${fs}px`;
  }, fontSize);

  await page.goto(`${baseUrl}${DOCS_ROUTE}`, { waitUntil: 'networkidle', timeout: 60_000 });

  const contentsButton = page.locator('[data-site-contents-command] [data-site-contents-button]');
  const hasContents = (await contentsButton.count()) > 0;

  const m = { viewport: { width, fontSize }, errors: [] };
  m.hasContentsButton = hasContents;
  m.isMobileViewport = width < 1024;

  m.docOverflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));

  m.treeInFlow = await page.evaluate(() => {
    const tree = document.querySelector('nav.docs-sidebar');
    return tree ? !tree.hasAttribute('data-site-contents-popover-tree') : null;
  });

  if (hasContents && width < 1024) {
    try {
      const menuBtn = page.locator('[data-site-header-menu]');
      if (
        (await menuBtn.count()) > 0 &&
        (await menuBtn.getAttribute('aria-expanded')) === 'false'
      ) {
        await menuBtn.click();
        await page.waitForTimeout(500);
      }
      if (await contentsButton.isVisible()) {
        await contentsButton.click();
        await page.waitForTimeout(1500);
      }

      m.popoverOpen = await page.evaluate(() => {
        const b = document.querySelector(
          '[data-site-contents-command] [data-site-contents-button]'
        );
        return b?.getAttribute('aria-expanded') === 'true';
      });

      const dialogEl = page.getByRole('dialog');
      m.dialogCount = await dialogEl.count();
      if (m.dialogCount > 0) {
        m.ariaModal = await dialogEl.first().getAttribute('aria-modal');
      }

      m.maskPresent = await page.evaluate(
        () =>
          !!document.querySelector(
            '[data-pui-overlay-mask], [data-pui-dialog-mask], .pui-projection-overlay-mask'
          )
      );

      m.closeButtonPresent = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return null;
        return d.querySelector('button[class*="close"], [data-pui-popover-close]') !== null;
      });

      m.treeInSlot = await page.evaluate(() => {
        const t = document.querySelector('nav.docs-sidebar');
        return t?.parentElement?.hasAttribute('data-site-contents-slot') ?? null;
      });

      m.treeMarked = await page.evaluate(() =>
        document.querySelector('nav.docs-sidebar')?.hasAttribute('data-site-contents-popover-tree')
      );

      m.treeCount = await page.evaluate(() => document.querySelectorAll('nav.docs-sidebar').length);

      m.tocAboveArticle = await page.evaluate(() => {
        const toc = document.querySelector(
          '.right-sidebar, [data-starlight-toc], aside:not(.sl-astro-toc-sidebar)'
        );
        const article = document.querySelector('main article, .sl-markdown-content, main');
        if (!toc || !article) return null;
        const tr = toc.getBoundingClientRect();
        const ar = article.getBoundingClientRect();
        return { tocTop: tr.top, articleTop: ar.top, tocAbove: tr.top < ar.top };
      });

      m.scrollOwners = await page.evaluate(() => {
        const tree = document.querySelector('nav.docs-sidebar');
        if (!tree) return null;
        const owners = [];
        let n = tree;
        while (n && n !== document.body && n !== document.documentElement) {
          const s = getComputedStyle(n);
          if (s.overflowY === 'auto' || s.overflowY === 'scroll')
            owners.push({
              tag: n.tagName,
              id: n.id,
              cls: (n.className || '').slice(0, 60),
              ovY: s.overflowY,
              maxH: s.maxHeight,
            });
          n = n.parentElement;
        }
        const pane = tree.querySelector('#starlight__sidebar');
        if (pane) {
          const ps = getComputedStyle(pane);
          if (ps.overflowY === 'auto' || ps.overflowY === 'scroll')
            owners.push({ tag: 'INNER', id: pane.id, ovY: ps.overflowY, maxH: ps.maxHeight });
        }
        return owners;
      });

      m.popoverGeometry = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return null;
        const r = d.getBoundingClientRect();
        const s = getComputedStyle(d);
        return {
          rect: {
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            left: r.left,
          },
          style: {
            pos: s.position,
            radius: s.borderRadius,
            border: s.borderWidth,
            ovY: s.overflowY,
            maxH: s.maxHeight,
            bg: s.backgroundColor,
            blur: s.backdropFilter,
          },
        };
      });

      m.linksPreserved = await page.evaluate(() => {
        const t = document.querySelector('nav.docs-sidebar');
        return t
          ? {
              linkCount: t.querySelectorAll('a[href]').length,
              currentPage: !!t.querySelector('[aria-current="page"]'),
              detailsCount: t.querySelectorAll('details').length,
            }
          : null;
      });

      m.focusTrap = await page.evaluate(() => {
        // Check if focus is trapped in the dialog
        const d = document.querySelector('[role="dialog"]');
        if (!d) return null;
        return {
          hasFocus: d.contains(document.activeElement) || d === document.activeElement,
          activeTag: document.activeElement?.tagName,
        };
      });

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${width}x${fontSize}-popover-open.png`),
        fullPage: false,
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${width}x${fontSize}-closed.png`),
        fullPage: false,
      });

      m.focusAfterClose = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        cls: (document.activeElement?.className || '').slice(0, 60),
      }));

      m.popoverClosed = await page.evaluate(() => {
        const b = document.querySelector(
          '[data-site-contents-command] [data-site-contents-button]'
        );
        return b?.getAttribute('aria-expanded') === 'false';
      });
    } catch (e) {
      m.errors.push(`interaction: ${e.message?.slice(0, 300)}`);
    }
  } else {
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `${width}x${fontSize}-default.png`),
      fullPage: false,
    });
  }

  results.push(m);
  await context.close();
}

async function main() {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  console.log('Starting dev server...');
  const baseUrl = await startServer();
  console.log(`Ready: ${baseUrl}`);

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });

  const results = [];

  for (const width of VIEWPORTS) {
    for (const fontSize of FONT_SIZES) {
      process.stdout.write(`  ${width}x${fontSize}... `);
      try {
        await captureViewport(browser, baseUrl, width, fontSize, results);
        console.log('ok');
      } catch (e) {
        console.log(`FAIL: ${e.message?.slice(0, 150)}`);
        results.push({ viewport: { width, fontSize }, errors: [e.message?.slice(0, 200)] });
      }
    }
  }

  // no-JS fallback at 390x16
  process.stdout.write('  noJS 390x16... ');
  try {
    const noJs = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });
    const np = await noJs.newPage();
    await np.goto(`${baseUrl}${DOCS_ROUTE}`, { waitUntil: 'networkidle', timeout: 60_000 });
    const noJsM = await np.evaluate(() => {
      const t = document.querySelector('nav.docs-sidebar');
      const pane = document.querySelector('.mobile-sidebar-pane');
      const p = pane ? getComputedStyle(pane) : null;
      return {
        treeVisible: t ? t.getBoundingClientRect().height > 0 : false,
        treeLinks: t ? t.querySelectorAll('a[href]').length : 0,
        paneDisplay: p?.display,
        paneMaxH: p?.maxHeight,
        paneOverflowY: p?.overflowY,
      };
    });
    await np.screenshot({ path: path.join(EVIDENCE_DIR, '390x16-nojs.png'), fullPage: false });
    results.push({ noJS: noJsM });
    await noJs.close();
    console.log('ok');
  } catch (e) {
    console.log(`FAIL: ${e.message?.slice(0, 150)}`);
  }

  await browser.close();
  await stopServer();

  const reportPath = path.join(EVIDENCE_DIR, 'report.json');
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        route: DOCS_ROUTE,
        viewports: VIEWPORTS,
        fontSizes: FONT_SIZES,
        results,
      },
      null,
      2
    )
  );
  console.log(`\nReport: ${reportPath}`);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  await stopServer();
  process.exit(1);
});
