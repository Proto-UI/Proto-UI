/** Same clean-checkout probe for the reviewed before/candidate. Public website
 * content only. Actual Text/Surface leaves, never wrapper font-size stand-ins. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Page } from 'playwright-core';
import { launchBrowser, startServer, stopServer } from '../src/content/docs/zh-cn/browser-harness';
import { verifyRevision } from './homepage-evidence-contract';
import { readReadingReflow } from '../src/content/docs/zh-cn/reading-reflow-evidence';
const { values } = parseArgs({
  options: {
    'revision-kind': { type: 'string' },
    'expected-revision': { type: 'string' },
    out: { type: 'string' },
    'quick-preview': { type: 'boolean', default: false },
  },
});
const kind = values['revision-kind'];
const quickPreview = values['quick-preview'] === true;
assert.ok(kind === 'baseline' || kind === 'candidate');
assert.ok(values.out && values['expected-revision']);
assert.ok(!process.env.PROTO_UI_BROWSER_BASE_URL);
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
verifyRevision(
  revision,
  values['expected-revision'],
  git('status', '--porcelain', '--untracked-files=all')
);
const out = path.resolve(values.out);
await mkdir(out, { recursive: true });
const script = fileURLToPath(import.meta.url);
const report = {
  revisionKind: kind,
  revision,
  scriptSha256: createHash('sha256')
    .update(await readFile(script))
    .digest('hex'),
  capturedAt: new Date().toISOString(),
  limits:
    'Chromium simulated CSS-pixel viewports. Fonts are measured on actual public Text leaves. Screenshots require human visual review; no physical device or complete accessibility claim.',
  cases: [] as Array<Record<string, unknown>>,
  failures: [] as string[],
};
const save = () => writeFile(path.join(out, 'metrics.json'), JSON.stringify(report, null, 2));
const base = await startServer(['/zh-cn/', '/zh-cn/start-here/what-you-saw/']);
const browser = await launchBrowser();
async function homeReady(page: Page, family = 'shadcn') {
  await page.waitForFunction((family) => {
    const r = document.querySelector<HTMLElement>('[data-homepage-runtime]');
    return r?.dataset.runtimeState === 'ready' && r.dataset.family === family;
  }, family);
}
async function switchFamily(page: Page) {
  const trigger = page.locator(
    '#home-preferences [data-projection-control="family"] [role="combobox"]'
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  await page
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', { name: 'Brutalist', exact: true })
    .click();
  await homeReady(page, 'brutalist');
}
try {
  const configurations = [390, 1440].flatMap((width) =>
    ['zh-cn', 'en'].flatMap((locale) =>
      (['light', 'dark'] as const).map((theme) => ({
        width,
        locale,
        theme,
        family: 'shadcn' as const,
      }))
    )
  );
  const fullVariants = [
    ...configurations,
    ...(['light', 'dark'] as const).map((theme) => ({
      width: 1440,
      locale: 'zh-cn',
      theme,
      family: 'brutalist' as const,
    })),
  ];
  const variants = quickPreview
    ? (['shadcn', 'brutalist'] as const).map((family) => ({
        width: 1440,
        locale: 'zh-cn',
        theme: family === 'shadcn' ? ('light' as const) : ('dark' as const),
        family,
      }))
    : fullVariants;
  for (const v of variants)
    for (const target of quickPreview
      ? v.family === 'shadcn'
        ? (['quick-start', 'docs'] as const)
        : (['docs'] as const)
      : v.family === 'shadcn'
        ? (['home', 'docs', 'quick-start'] as const)
        : (['home', 'docs'] as const)) {
      const id = `${v.locale}-${v.width}-${v.theme}-${v.family}-${target}`;
      const context = await browser.newContext({
        viewport: { width: v.width, height: 1000 },
        colorScheme: v.theme,
        reducedMotion: 'reduce',
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const entry: Record<string, unknown> = {
        id,
        ...v,
        target,
        screenshots: [],
        pageErrors: errors,
      };
      report.cases.push(entry);
      const shot = async (name: string, fullPage = false) => {
        const f = `${id}-${name}.png`;
        await page.screenshot({ path: path.join(out, f), fullPage });
        (entry.screenshots as string[]).push(f);
      };
      try {
        if (target === 'home') {
          await page.goto(`${base}/${v.locale}/`, { waitUntil: 'networkidle' });
          await homeReady(page);
          if (v.family === 'brutalist') await switchFamily(page);
          await page.evaluate(() => window.scrollTo(0, 0));
          await shot('initial');
          await shot('full', true);
          const facts = await page.evaluate(() => {
            const [slogan, title, caption] = [
              '[data-site-typography="slogan"] [data-typography-prototype]',
              '.home-gallery__title [data-projection-prototype$="-text-root"]',
              '.home-gallery__caption [data-projection-prototype$="-text-root"]',
            ].map((selector) => {
              const e = document.querySelector<HTMLElement>(selector);
              if (!e || !e.hasAttribute('data-pui-root'))
                throw new Error('Expected the actual public Text leaf');
              const c = getComputedStyle(e);
              return {
                prototype: e.dataset.projectionPrototype ?? e.dataset.typographyPrototype,
                tokens: e.getAttribute('data-pui-style'),
                fontSize: parseFloat(c.fontSize),
                fontWeight: c.fontWeight,
                lineHeight: c.lineHeight,
              };
            });
            const card = document.querySelector<HTMLElement>(
              '[data-gallery-demo] [data-projection-prototype$="-surface-root"]'
            )!;
            const primary = document.querySelector<HTMLElement>(
              '[data-demo-ref="gallery-primary"]'
            )!;
            return {
              slogan,
              title,
              caption,
              cardPadding: getComputedStyle(card).padding,
              gridGap: getComputedStyle(document.querySelector('.home-gallery')!).gap,
              primary: {
                height: primary.getBoundingClientRect().height,
                fontSize: parseFloat(getComputedStyle(primary).fontSize),
              },
              overflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
          entry.home = facts;
          assert.ok(facts.overflow <= 1);
          assert.equal(facts.primary.fontSize, 14);
          assert.ok(Math.abs(facts.primary.height - (v.family === 'brutalist' ? 40 : 32)) <= 1);
          if (kind === 'candidate') {
            assert.equal(facts.slogan.fontSize, v.width === 390 ? 24 : 36);
            assert.equal(facts.cardPadding, '20px');
            assert.equal(facts.gridGap, v.width === 390 ? '20px' : '24px');
            assert.equal(facts.title.fontSize, 16);
            assert.equal(facts.caption.fontSize, 12);
          }
          if (v.width === 390)
            await page.locator('.site-header-menu [data-demo-ref="home-menu"]').click();
          const selects = await page
            .locator('#home-preferences [role="combobox"]')
            .evaluateAll((nodes) =>
              nodes
                .filter((e) => (e as HTMLElement).checkVisibility())
                .map((e) => ({
                  height: e.getBoundingClientRect().height,
                  overflow: e.scrollWidth - e.clientWidth,
                }))
            );
          entry.headerSelects = selects;
          assert.equal(selects.length, 2);
          for (const select of selects) {
            assert.ok(select.overflow <= 1);
            if (kind === 'candidate')
              assert.ok(Math.abs(select.height - (v.width === 390 ? 44 : 36)) <= 1);
          }
          if (v.width === 390) await page.keyboard.press('Escape');
        } else if (target === 'quick-start') {
          await page.goto(`${base}/${v.locale}/start-here/quick-start/`, {
            waitUntil: 'networkidle',
          });
          await page.waitForFunction(() => {
            const headings = [...document.querySelectorAll('main :is(h2,h3,h4)')];
            return (
              headings.length > 0 &&
              headings.every((heading) => heading.querySelector('[data-typography-prototype]'))
            );
          });
          if (kind === 'candidate')
            await page.waitForSelector('.starlight-aside--note[data-note-surface-view="ready"]');
          if (kind === 'candidate')
            await page.waitForFunction(() => {
              const title = document.querySelector<HTMLElement>(
                '.starlight-aside--note .starlight-aside__title [data-typography-prototype]'
              );
              return title?.dataset.typographyRole === 'label';
            });
          entry.information = await page
            .locator('.starlight-aside--note')
            .first()
            .evaluate((note) => {
              const surface = note.querySelector<HTMLElement>('.site-note-surface-paint');
              const title = note.querySelector<HTMLElement>(
                '.starlight-aside__title [data-typography-prototype]'
              );
              const style = surface ? getComputedStyle(surface) : getComputedStyle(note);
              return {
                label: note.getAttribute('aria-label'),
                text: note.textContent,
                prototype: surface?.getAttribute('data-projection-prototype') ?? null,
                titlePrototype: title?.dataset.typographyPrototype ?? null,
                radius: style.borderTopLeftRadius,
                border: style.borderTopWidth,
                background: style.backgroundColor,
                semanticTag: note.localName,
                passiveRole: surface?.getAttribute('role') ?? null,
                passiveTabindex: surface?.getAttribute('tabindex') ?? null,
                iconCount: note.querySelectorAll('.starlight-aside__icon').length,
              };
            });
          if (kind === 'candidate') {
            const info = entry.information as Record<string, unknown>;
            assert.equal(info.prototype, 'shadcn-surface-root');
            assert.equal(info.titlePrototype, 'shadcn-text-root');
            assert.equal(info.semanticTag, 'aside');
            assert.equal(info.passiveRole, null);
            assert.equal(info.passiveTabindex, null);
            assert.equal(info.iconCount, 1);
            assert.ok(parseFloat(String(info.radius)) > 0);
          }
          const rhythm = await page.evaluate(() => ({
            headings: [...document.querySelectorAll<HTMLElement>('main :is(h2,h3,h4)')].map(
              (heading) => {
                const leaf = heading.querySelector<HTMLElement>('[data-typography-prototype]');
                if (!leaf) throw new Error('Heading requires an actual public Text projection');
                const paint = getComputedStyle(leaf);
                return {
                  tag: heading.localName,
                  label: heading.textContent,
                  prototype: leaf.dataset.typographyPrototype,
                  size: parseFloat(paint.fontSize),
                  lineHeight: paint.lineHeight,
                  sectionMargin: getComputedStyle(heading.closest('.sl-heading-wrapper') ?? heading)
                    .marginTop,
                };
              }
            ),
            bodies: [
              ...document.querySelectorAll<HTMLElement>(
                '[data-doc-flow] > p [data-typography-prototype]'
              ),
            ].map((leaf) => parseFloat(getComputedStyle(leaf).fontSize)),
            overflow: document.documentElement.scrollWidth - innerWidth,
          }));
          entry.rhythm = rhythm;
          await shot('initial');
          if (v.width === 1440) {
            const spacing = await page.evaluate(() => {
              const header = document.querySelector<HTMLElement>('[data-docs-site-header]')!;
              const brand = header.querySelector<HTMLElement>('.site-header-brand a')!;
              const links = [
                ...header.querySelectorAll<HTMLElement>('[data-site-header-desktop-navigation] a'),
              ];
              return {
                brandToNav:
                  links[0]!.getBoundingClientRect().left - brand.getBoundingClientRect().right,
                navGaps: links
                  .slice(1)
                  .map(
                    (link, i) =>
                      link.getBoundingClientRect().left - links[i]!.getBoundingClientRect().right
                  ),
              };
            });
            entry.headerSpacing = spacing;
            if (kind === 'candidate') {
              assert.ok(Math.abs(spacing.brandToNav - 32) <= 1);
              for (const gap of spacing.navGaps) assert.ok(Math.abs(gap - 24) <= 1);
            }
            const intermediate = [];
            for (const width of [1024, 1279]) {
              await page.setViewportSize({ width, height: 1000 });
              const visible = await page.locator('.right-sidebar-container').isVisible();
              intermediate.push({ width, tocVisible: visible });
              await shot(`toc-${width}`);
              if (kind === 'candidate')
                assert.equal(visible, false, 'TOC keeps its existing xl visibility boundary');
            }
            entry.intermediateToc = intermediate;
            const trigger = page.locator(
              '[data-docs-site-header] [data-adapter-select-root] [role="combobox"]'
            );
            await page.setViewportSize({ width: 390, height: 1000 });
            await page.waitForFunction(
              () =>
                !!document.querySelector(
                  '[data-site-header-compact-context] [data-site-header-preferences]'
                )
            );
            await page.locator('[data-site-menu-button]').click();
            await trigger.click();
            const popup = await trigger.getAttribute('aria-controls');
            // The fixture creates a same-document history entry; traversal is
            // the browser's real Back operation, not a dispatched popstate.
            await page.evaluate(() => history.pushState(null, '', '#header-history-regression'));
            await page.goBack();
            // The original ec6 baseline has no history-close listener. Record
            // that state; only the candidate is required to close its owner.
            if (kind === 'candidate') {
              await page.waitForFunction(
                () =>
                  document
                    .querySelector('[data-site-menu-button]')
                    ?.getAttribute('aria-expanded') === 'false'
              );
              await page.locator(`[id=${JSON.stringify(popup)}]`).waitFor({ state: 'hidden' });
            }
            const historyState = {
              menuOpen: await page.locator('[data-site-menu-button]').getAttribute('aria-expanded'),
              selectOpen: await trigger.getAttribute('aria-expanded'),
              popupVisible: await page.locator(`[id=${JSON.stringify(popup)}]`).isVisible(),
            };
            entry.historyClose = historyState;
            await shot('history-close');
            if (kind === 'candidate')
              assert.deepEqual(historyState, {
                menuOpen: 'false',
                selectOpen: 'false',
                popupVisible: false,
              });
            else {
              if (historyState.popupVisible) await page.keyboard.press('Escape');
              if (
                (await page.locator('[data-site-menu-button]').getAttribute('aria-expanded')) ===
                'true'
              )
                await page.locator('[data-site-menu-button]').click();
            }
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.waitForFunction(
              () =>
                !!document.querySelector(
                  '[data-site-header-context] [data-site-header-preferences]'
                )
            );
            if (kind === 'candidate')
              await page.waitForFunction(() =>
                document
                  .querySelector(
                    '[data-docs-site-header] [data-adapter-select-root] [role="combobox"]'
                  )
                  ?.getAttribute('data-pui-style')
                  ?.includes('border-transparent')
              );
            entry.restoredDesktopTrigger = await trigger.getAttribute('data-pui-style');
            await shot('desktop-restored');
            if (kind === 'candidate')
              assert.match(String(entry.restoredDesktopTrigger), /border-transparent/);
          }
          assert.ok(rhythm.headings.some((heading) => heading.tag === 'h2'));
          assert.ok(rhythm.overflow <= 1);
          if (kind === 'candidate') {
            for (const heading of rhythm.headings) {
              assert.equal(
                heading.size,
                heading.tag === 'h2' ? 24 : heading.tag === 'h3' ? 20 : 18
              );
              assert.equal(heading.sectionMargin, '40px');
            }
            for (const size of rhythm.bodies) assert.equal(size, 16);
          }
          const code = page.locator('[data-code-example]').first();
          await code.scrollIntoViewIfNeeded();
          const file = code.getByRole('tab', { name: 'src/App.tsx', exact: true });
          if (await file.count()) await file.click();
          const expand = code.locator('[data-code-toggle]:visible').first();
          if (await expand.count()) await expand.click();
          await shot('code-example');
          assert.ok(await code.locator('pre:visible').count());
          entry.codeExample = await code.evaluate((element) => ({
            overflow: document.documentElement.scrollWidth - innerWidth,
            labels: [...element.querySelectorAll<HTMLElement>('[role="tab"]')]
              .filter((tab) => tab.checkVisibility())
              .map((tab) => tab.textContent),
            code: [...element.querySelectorAll<HTMLElement>('pre')]
              .filter((pre) => pre.checkVisibility())
              .map((pre) => ({
                size: getComputedStyle(pre).fontSize,
                width: pre.clientWidth,
                scrollWidth: pre.scrollWidth,
              })),
          }));
        } else {
          const route =
            v.family === 'brutalist'
              ? `/${v.locale}/ui-libraries/brutalist/components/button/`
              : `/${v.locale}/start-here/what-you-saw/`;
          await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
          await page.waitForSelector('h1 [data-typography-prototype]');
          if (v.width === 390) {
            await page.waitForSelector('[data-site-contents-button]');
            await page.locator('[data-site-contents-button]').click();
          }
          await page.waitForFunction(() =>
            [
              ...document.querySelectorAll<HTMLElement>(
                '.sidebar-pane a[data-site-link-appearance="sidebar"]'
              ),
            ].some((e) => e.checkVisibility() && e.querySelector('[data-pui-root]'))
          );
          const read = () =>
            page.evaluate(() => {
              const [left, right] = [
                '.sidebar-pane a[data-site-link-appearance="sidebar"]',
                '.right-sidebar a[data-site-link-appearance="toc"]',
              ].map((selector) =>
                [...document.querySelectorAll<HTMLAnchorElement>(selector)]
                  .filter((e) => e.checkVisibility())
                  .map((link) => {
                    const surface = link.querySelector<HTMLElement>(
                      '[data-projection-prototype$="-surface-root"],wc-site-shadcn-surface,wc-site-brutalist-surface'
                    )!;
                    const text = link.querySelector<HTMLElement>(
                      'wc-site-shadcn-text,wc-site-brutalist-text,[data-projection-prototype$="-text-root"]'
                    )!;
                    if (!surface || !text)
                      throw new Error('Navigation requires real Surface/Text leaves');
                    const c = getComputedStyle(text),
                      s = getComputedStyle(surface);
                    return {
                      label: link.textContent?.trim(),
                      href: link.getAttribute('href'),
                      current: link.getAttribute('aria-current'),
                      inView: link.hasAttribute('in-view'),
                      textHeight: text.getBoundingClientRect().height,
                      textLineHeight: parseFloat(c.lineHeight),
                      surfaceHeight: surface.getBoundingClientRect().height,
                      hitHeight: link.getBoundingClientRect().height,
                      padding: s.padding,
                      fontSize: parseFloat(c.fontSize),
                      fontWeight: c.fontWeight,
                      tokens: surface.getAttribute('data-pui-style'),
                      textTokens: text.getAttribute('data-pui-style'),
                    };
                  })
              );
              return {
                left,
                right,
                bodySize: parseFloat(
                  getComputedStyle(
                    document.querySelector('[data-doc-flow] p [data-typography-prototype]')!
                  ).fontSize
                ),
                overflow: document.documentElement.scrollWidth - innerWidth,
              };
            });
          await shot('navigation');
          const facts = await read();
          entry.navigation = facts;
          assert.ok(facts.overflow <= 1);
          assert.ok(facts.left.length > 0);
          if (v.width === 1440) assert.ok(facts.right.length > 0);
          if (kind === 'candidate')
            for (const row of [...facts.left, ...facts.right]) {
              const minimum = v.width === 390 ? 44 : 32;
              assert.ok(row.surfaceHeight >= minimum - 1);
              if (row.textHeight <= row.textLineHeight + 1)
                assert.ok(
                  Math.abs(row.surfaceHeight - minimum) <= 1,
                  `Unwrapped ${row.label} must be ${minimum}px, got ${row.surfaceHeight}`
                );
              assert.equal(row.fontSize, 14);
              assert.equal(
                row.padding,
                v.family === 'brutalist' && row.current && row.current !== 'false'
                  ? '2px 6px'
                  : '4px 8px'
              );
              assert.equal(
                row.fontWeight,
                row.current && row.current !== 'false'
                  ? v.family === 'brutalist'
                    ? '600'
                    : '500'
                  : v.family === 'brutalist'
                    ? '500'
                    : '400'
              );
              if (row.inView && !row.current)
                assert.ok(
                  !row.tokens
                    ?.split(/\s+/)
                    .includes(v.family === 'brutalist' ? 'bg-main' : 'bg-accent')
                );
            }
          if (kind === 'candidate') assert.equal(facts.bodySize, 16);
          if (v.width === 1440) {
            const toc = page
              .locator('.right-sidebar a[data-site-link-appearance="toc"]:visible')
              .nth(1);
            if (await toc.count()) {
              // Reproduction fixture: embedded galleries can contribute hidden
              // headings that are intentionally absent from the generated TOC.
              await page.evaluate(() => {
                const fixture = document.createElement('div');
                fixture.hidden = true;
                fixture.dataset.densityUnlinkedHeadingFixture = '';
                const heading = document.createElement('h3');
                heading.id = 'density-unlinked-modal-title';
                heading.textContent = 'Embedded gallery modal';
                fixture.append(heading);
                document.querySelector('main')!.append(fixture);
                window.dispatchEvent(new Event('resize'));
              });
              entry.unlinkedHeadingFixture =
                'Hidden embedded h3 without a generated TOC link; original page words unchanged';
              const href = await toc.getAttribute('href');
              await toc.click();
              await page.waitForFunction(
                (href) => location.hash === new URL(href!, location.href).hash,
                href
              );
              await page.evaluate(
                () =>
                  new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                  )
              );
              const landing = await page.evaluate(() => {
                const heading = document.getElementById(decodeURIComponent(location.hash.slice(1)));
                return {
                  hash: location.hash,
                  scrollY,
                  scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
                  maximumScrollY: Math.max(
                    0,
                    document.documentElement.scrollHeight - document.documentElement.clientHeight
                  ),
                  viewportHeight: innerHeight,
                  header: document.querySelector('header')?.getBoundingClientRect().toJSON(),
                  heading: heading?.getBoundingClientRect().toJSON(),
                  scrollMarginTop: heading ? getComputedStyle(heading).scrollMarginTop : null,
                  current: [...document.querySelectorAll('.right-sidebar a[aria-current]')].map(
                    (e) => ({
                      href: e.getAttribute('href'),
                      current: e.getAttribute('aria-current'),
                    })
                  ),
                };
              });
              entry.anchorLanding = landing;
              await save();
              // A short page can already fit the full target while native scrolling
              // is clamped at the bottom. Its reading-position current stays valid.
              const targetReachedCurrentLine =
                !!landing.heading && landing.heading.top <= (landing.header?.height ?? 0) + 33;
              if (kind === 'candidate' && !targetReachedCurrentLine) {
                assert.ok(
                  Math.abs(landing.scrollY - landing.maximumScrollY) <= 1,
                  'Only actual bottom clamping permits a non-current target'
                );
                assert.ok(
                  landing.heading &&
                    landing.heading.top >= 0 &&
                    landing.heading.bottom <= landing.viewportHeight,
                  'The clamped native target must already be fully visible'
                );
                entry.anchorConstraint =
                  'Native scroll is bottom-clamped; target is already visible, current follows reading position';
              }
              if (kind === 'candidate' && targetReachedCurrentLine)
                await page.waitForFunction(
                  (href) =>
                    [...document.querySelectorAll<HTMLAnchorElement>('.right-sidebar a')]
                      .find((a) => a.checkVisibility() && a.getAttribute('href') === href)
                      ?.getAttribute('aria-current') === 'true',
                  href
                );
              await page.mouse.move(0, 0);
              const moved = await read();
              entry.afterTocNavigation = moved;
              await shot('toc-selected');
              assert.equal(moved.right.filter((x) => x.current && x.current !== 'false').length, 1);
              if (kind === 'candidate')
                assert.equal(
                  moved.right.filter((x) =>
                    x.tokens
                      ?.split(/\s+/)
                      .includes(v.family === 'brutalist' ? 'bg-main' : 'bg-accent')
                  ).length,
                  1
                );
              await page.evaluate(() => {
                document.querySelector('[data-density-unlinked-heading-fixture]')?.remove();
                window.dispatchEvent(new Event('resize'));
              });
              if (kind === 'candidate') {
                await page.evaluate(() => {
                  document.documentElement.style.fontSize = '200%';
                  window.scrollTo(0, 0);
                });
                await page.evaluate(
                  () =>
                    new Promise<void>((resolve) =>
                      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                    )
                );
                const reflow = await page.evaluate(readReadingReflow);
                entry.text200Reflow = reflow;
                await shot('text200-reflow');
                assert.equal(reflow.rootFontSize, 32, 'Keep actual 200% root text');
                assert.equal(reflow.overflow, 0, 'Enlarged reading layout must stay in viewport');
                assert.ok(reflow.boxes['.docs-sidebar'].width >= 14 * reflow.rootFontSize);
                assert.ok(reflow.boxes['.right-sidebar'].width >= 12 * reflow.rootFontSize);
                assert.ok(
                  reflow.boxes['.right-sidebar'].width <= reflow.boxes['.main-pane'].width + 1
                );
                for (const control of reflow.controls) {
                  assert.ok(
                    control.width > 0 && control.height > 0,
                    `${control.selector} stays present`
                  );
                  assert.ok(
                    control.left >= 0 && control.right <= reflow.viewportWidth,
                    `${control.selector} stays reachable at 200% text`
                  );
                }
                assert.ok(
                  reflow.boxes['.right-sidebar-panel sl-toc'].width >= 12 * reflow.rootFontSize,
                  'The actual visible TOC, not only its wrapper, gets reading space'
                );
                for (const link of reflow.visibleTocLinks)
                  assert.ok(
                    link.width >= 10 * reflow.rootFontSize,
                    `Visible TOC link ${link.label} must not collapse into fragmented words`
                  );
                const overview = page
                  .locator('.right-sidebar a[data-site-link-appearance="toc"]:visible')
                  .first();
                await overview.click();
                await page.waitForFunction(() => {
                  const title = document.querySelector('main h1[id]')!.getBoundingClientRect();
                  const header = document.querySelector('header')!.getBoundingClientRect();
                  return title.top >= header.bottom - 1;
                });
                entry.overviewText200 = await page.evaluate(() => ({
                  stressOnly: true,
                  textPercent: 200,
                  hash: location.hash,
                  scrollY,
                  title: document.querySelector('main h1[id]')!.getBoundingClientRect().toJSON(),
                  header: document.querySelector('header')!.getBoundingClientRect().toJSON(),
                  margin: getComputedStyle(document.querySelector('main h1[id]')!).scrollMarginTop,
                }));
                await shot('overview-text200');
                assert.equal(await overview.getAttribute('aria-current'), 'true');
              }
            }
          }
        }
        assert.deepEqual(errors, []);
        entry.outcome = 'passed';
      } catch (e) {
        entry.outcome = 'failed';
        entry.error = e instanceof Error ? e.stack : String(e);
        report.failures.push(`${id}: ${String(e)}`);
        await shot('failure').catch(() => {});
      } finally {
        await save();
        await context.close();
      }
    }
} finally {
  await browser.close();
  await stopServer();
  await save();
}
assert.deepEqual(
  report.failures,
  [],
  'Visual density evidence preserves every failure and requires the candidate invariants'
);
