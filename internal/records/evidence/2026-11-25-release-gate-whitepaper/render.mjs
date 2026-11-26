import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = '/home/ezra/proto-ui-wc-budget-cb5d';
const base = '/home/ezra/proto-ui-wc-budget-cb5d-control/whitepaper-candidate-v4';
const require = createRequire(root + '/apps/www/package.json');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const rows = [];
try {
  for (const theme of ['light', 'dark'])
    for (const variant of ['', 'mobile.'])
      for (const locale of ['en', 'zh-cn']) {
        const name = 'whitepaper-evolution-feedback.' + variant + locale + '.svg';
        const page = await browser.newPage({
          viewport: { width: 1000, height: 1100 },
          deviceScaleFactor: 1,
          colorScheme: theme,
        });
        await page.goto('file://' + base + '/' + name);
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.evaluate(() => {
          const svg = document.documentElement,
            view = svg.viewBox.baseVal;
          const text = [...svg.querySelectorAll('text')].map((n) => {
            const b = n.getBBox(),
              s = getComputedStyle(n);
            return {
              text:
                [...n.querySelectorAll('tspan')].map((t) => t.textContent).join(' ') ||
                n.textContent,
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              fontSize: Number.parseFloat(s.fontSize),
              family: s.fontFamily,
              fill: s.fill,
            };
          });
          const cards = [...svg.querySelectorAll('[data-node],[data-diagnosis]')].map((g) => {
            const r = g.querySelector('rect'),
              b = r.getBBox();
            return {
              id: g.getAttribute('data-node') ?? g.getAttribute('data-diagnosis'),
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              overflow: [...g.querySelectorAll('text')].flatMap((n) => {
                const t = n.getBBox();
                return t.x < b.x + 4 ||
                  t.x + t.width > b.x + b.width - 4 ||
                  t.y < b.y + 4 ||
                  t.y + t.height > b.y + b.height - 4
                  ? [{ text: n.textContent, x: t.x, y: t.y, width: t.width, height: t.height }]
                  : [];
              }),
            };
          });
          return {
            markers: [...svg.querySelectorAll('marker[id^=evo] path')].map((n) => ({
              id: n.parentElement.id,
              fill: getComputedStyle(n).fill,
              wireStroke: getComputedStyle(svg.querySelector('.evo-wire')).stroke,
            })),
            canvas: { width: view.width, height: view.height },
            text,
            cards,
            canvasOverflow: text.filter(
              (t) =>
                t.x < 0 || t.y < 0 || t.x + t.width > view.width || t.y + t.height > view.height
            ),
          };
        });
        const png = name.replace('.svg', '-' + theme + '.png');
        await page.locator('svg').screenshot({ path: base + '/' + png });
        rows.push({
          name,
          theme,
          png,
          sourceSha256: createHash('sha256')
            .update(await readFile(base + '/' + name))
            .digest('hex'),
          ...metrics,
        });
        await page.close();
      }
  await writeFile(
    base + '/geometry.json',
    JSON.stringify(
      {
        kind: 'Direct native SVG diagnostic; not production article/Dialog acceptance',
        chromium: browser.version(),
        rows,
      },
      null,
      2
    ) + '\n'
  );
} finally {
  await browser.close();
}
