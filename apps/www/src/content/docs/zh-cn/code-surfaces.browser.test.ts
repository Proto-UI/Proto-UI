// @vitest-environment node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { highlightCode } from '../../../components/PrototypePreviewer/code-highlight';
import { launchBrowser, startServer, stopServer } from './browser-harness';

// Issue #630 acceptance; website presentation only, not a Prototype guarantee.
const ROUTE = '/zh-cn/ui-libraries/base/transition/';
const QUICK_START = '/zh-cn/start-here/quick-start/';
let browser: Browser;
let baseUrl: string;

type CodeStyleFacts = {
  background: string;
  color: string;
  font: string;
  size: string;
  lineHeight: string;
};

type SurfaceFacts = {
  ec: CodeStyleFacts;
  preview: CodeStyleFacts;
  ecCode: CodeStyleFacts;
  previewCode: CodeStyleFacts;
  border: [string, string];
  radius: [string, string];
  documentOverflow: number;
};

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function ready(page: Page): Promise<void> {
  await page.waitForSelector('[data-code-panel-init="1"]:visible');
  await page.waitForFunction(() => customElements.get('wc-shadcn-button'));
  // CodePanel initializes before the async Previewer mount replaces its SSR pre.
  // Wait for that replacement before Playwright can retain an element to measure.
  await page.waitForFunction(() => {
    const shell = [...document.querySelectorAll<HTMLElement>('[data-code-shell]')].find((element) =>
      element.checkVisibility()
    );
    if (!shell) return false;
    const previewer = shell.closest('[data-previewer-id]') as
      | (HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } })
      | null;
    // CodeExample owns a CodePanel without an async Previewer runtime.
    return !previewer || Boolean(previewer.__previewer__?.getCurrentRuntime());
  });
}

async function surfaceFacts(page: Page): Promise<SurfaceFacts> {
  return page.evaluate(() => {
    const ec = document.querySelector<HTMLElement>('.expressive-code pre')!;
    const preview = [...document.querySelectorAll<HTMLElement>('.proto-previewer__code')].find(
      (element) => element.checkVisibility()
    )!;
    const card = preview.closest<HTMLElement>('.proto-previewer, .code-example')!;
    const facts = (element: HTMLElement): CodeStyleFacts => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        font: style.fontFamily,
        size: style.fontSize,
        lineHeight: style.lineHeight,
      };
    };
    return {
      ec: facts(ec),
      preview: facts(preview),
      ecCode: facts(ec.querySelector('code')!),
      previewCode: facts(preview.querySelector('code')!),
      border: [getComputedStyle(ec).borderLeftColor, getComputedStyle(card).borderLeftColor],
      radius: [
        getComputedStyle(ec.closest('.frame')!).borderRadius,
        getComputedStyle(card).borderRadius,
      ],
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function expectSurfaces(page: Page): Promise<SurfaceFacts> {
  const facts = await surfaceFacts(page);
  expect(facts.preview).toEqual(facts.ec);
  expect(facts.previewCode).toEqual(facts.ecCode);
  expect(facts.ec.size).toBe('13px');
  expect(facts.ec.lineHeight).toBe('24px');
  expect(facts.radius).toEqual(['12px', '12px']);
  expect(facts.border[0]).toBe(facts.border[1]);
  expect(facts.documentOverflow).toBeLessThanOrEqual(1);
  return facts;
}

async function expectCopyControls(page: Page): Promise<void> {
  const panel = page.locator('[data-code-shell]:visible').first();
  const toggle = panel.locator('[data-code-toggle]');
  if (await toggle.isVisible()) await toggle.click();
  await page.mouse.move(0, 0);
  const ec = page.locator('.expressive-code .copy button').first();
  const preview = panel.locator('[data-copy]');
  for (const control of [ec, preview]) {
    expect(await control.isVisible()).toBe(true);
    const facts = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      const icon = element.matches('button')
        ? getComputedStyle(element, '::after')
        : getComputedStyle(element.querySelector('svg')!);
      return {
        width: style.width,
        height: style.height,
        radius: style.borderRadius,
        opacity: style.opacity,
        glyph: [icon.width, icon.height],
      };
    });
    expect(facts).toEqual({
      width: '32px',
      height: '32px',
      radius: '6px',
      opacity: '1',
      glyph: ['18px', '18px'],
    });
    await page.keyboard.press('Tab');
    await control.focus();
    expect(
      await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return [element.matches(':focus-visible'), style.outlineStyle, style.outlineWidth];
      })
    ).toEqual([true, 'solid', '2px']);
  }
  expect(await ec.evaluate((element) => getComputedStyle(element.parentElement!).opacity)).toBe(
    '1'
  );
  expect(await preview.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    await ec.evaluate((element) => getComputedStyle(element).backgroundColor)
  );
}

// Compare actual EC output against the same source rendered by the Previewer's
// highlighter, in its real code panel. Character colors avoid pinning span splits.
async function paletteProbe(page: Page): Promise<void> {
  const source = await page
    .locator('.expressive-code pre[data-language="ts"]')
    .evaluate((pre) =>
      [...pre.querySelectorAll('.ec-line .code')].map((line) => line.textContent).join('\n')
    );
  const html = await highlightCode(source, 'typescript');
  await page
    .locator('[data-code-content]')
    .first()
    .evaluate((content, highlighted) => {
      content.innerHTML = highlighted;
    }, html);
  const palettes = await page.evaluate(() => {
    const colors = (root: Element) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const result: [string, string][] = [];
      while (walker.nextNode()) {
        const text = walker.currentNode;
        for (const character of text.textContent ?? '') {
          if (!/\s/.test(character))
            result.push([character, getComputedStyle(text.parentElement!).color]);
        }
      }
      return result;
    };
    return {
      ec: colors(document.querySelector('.expressive-code pre[data-language="ts"]')!),
      preview: colors(document.querySelector('.proto-previewer__code')!),
    };
  });
  expect(palettes.preview).toEqual(palettes.ec);
  // A real author override must win without participating in an !important fight.
  await page.addStyleTag({
    content: '.proto-previewer__code span[style] { color: rgb(1, 2, 3); }',
  });
  expect(
    await page
      .locator('.proto-previewer__code span[style]')
      .first()
      .evaluate((element) => getComputedStyle(element).color)
  ).toBe('rgb(1, 2, 3)');
  expect(
    await page
      .locator('.proto-previewer__code')
      .first()
      .evaluate((element) => {
        element.style.backgroundColor = 'rgb(4, 5, 6)';
        return getComputedStyle(element).backgroundColor;
      })
  ).toBe('rgb(4, 5, 6)');
}

async function retainEvidence(page: Page, name: string, facts: unknown): Promise<void> {
  const directory = process.env.PROTO_UI_CODE_EVIDENCE_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${name}.json`), JSON.stringify(facts, null, 2));
  await page
    .locator(
      name.endsWith('-install') ? '.install-command-card:visible' : '[data-code-shell]:visible'
    )
    .first()
    .evaluate((element) => element.scrollIntoView({ block: 'center' }));
  // CDP capture does not wait for unrelated external webfonts to finish loading.
  const session = await page.context().newCDPSession(page);
  const image = await session.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(directory, `${name}.png`), Buffer.from(image.data, 'base64'));
  if (name.endsWith('-expanded')) {
    await page
      .locator('.expressive-code')
      .first()
      .evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const markdown = await session.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(directory, `${name}-markdown.png`), Buffer.from(markdown.data, 'base64'));
  }
  await session.detach();
}

describe.sequential('code-surface dogfood matrix (#630, #420, #568)', () => {
  for (const width of [1440, 390, 320]) {
    for (const theme of ['light', 'dark'] as const) {
      it(`shares tokens, palette, controls and scroll at ${width}px/${theme}`, async () => {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          // Explicit site selection must win over the opposite OS preference.
          colorScheme: theme === 'dark' ? 'light' : 'dark',
        });
        const page = await context.newPage();
        try {
          await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
          await ready(page);
          await page.evaluate((mode) => {
            document.documentElement.dataset.theme = mode;
          }, theme);
          const facts = await expectSurfaces(page);
          const pre = page.locator('.proto-previewer__code').first();
          const collapsed = await pre.evaluate((element) => {
            const content = element.closest('[data-code-content]')!;
            return {
              expanded: element.closest<HTMLElement>('[data-code-shell]')!.dataset.codeExpanded,
              selectable: getComputedStyle(content).userSelect !== 'none',
              overflow: getComputedStyle(element).overflowX,
              scrollable: element.scrollWidth > element.clientWidth,
            };
          });
          expect(collapsed).toEqual({
            expanded: 'false',
            selectable: true,
            overflow: 'auto',
            scrollable: true,
          });
          await pre.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          const token = pre
            .locator('.line')
            .first()
            .locator('span')
            .filter({ hasText: /^wc-base-transition$/ });
          const bounds = (await token.boundingBox())!;
          await page.mouse.move(bounds.x + 1, bounds.y + bounds.height / 2);
          await page.mouse.down();
          await page.mouse.move(bounds.x + bounds.width - 1, bounds.y + bounds.height / 2, {
            steps: 8,
          });
          await page.mouse.up();
          expect(await page.evaluate(() => getSelection()?.toString())).toBe('wc-base-transition');
          await page.evaluate(() => getSelection()?.removeAllRanges());
          await pre.focus();
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(
            () => document.querySelector('.proto-previewer__code')!.scrollLeft > 0
          );
          await retainEvidence(page, `${width}-${theme}-collapsed`, { facts, collapsed });
          await expectCopyControls(page);
          await retainEvidence(page, `${width}-${theme}-expanded`, await surfaceFacts(page));
          await paletteProbe(page);
        } finally {
          await context.close();
        }
      }, 90_000);
    }
  }

  it('retains CodeExample and install tokens across navigation and Astro reinitialization', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.evaluate(() => {
        sessionStorage.setItem('codeSurfaceSwaps', '0');
        document.addEventListener('astro:after-swap', () => {
          sessionStorage.setItem(
            'codeSurfaceSwaps',
            String(Number(sessionStorage.getItem('codeSurfaceSwaps')) + 1)
          );
        });
      });
      await page.getByRole('button', { name: '菜单', exact: true }).click();
      await page.locator(`a[href="${QUICK_START}"]`).first().click();
      await page.waitForURL(`**${QUICK_START}`);
      await ready(page);
      // The current site uses document navigation, not ClientRouter swaps.
      expect(await page.evaluate(() => sessionStorage.getItem('codeSurfaceSwaps'))).toBe('0');
      expect(
        await page.evaluate(() =>
          performance.getEntriesByType('navigation').map((entry) => entry.name)
        )
      ).toEqual([`${baseUrl}${QUICK_START}`]);
      const expectedInstall = new Map<string, CodeStyleFacts>();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((mode) => {
          document.documentElement.dataset.theme = mode;
        }, theme);
        const facts = await expectSurfaces(page);
        expectedInstall.set(theme, facts.ec);
        await expectCopyControls(page);
        await page.evaluate(() => {
          document.dispatchEvent(new Event('astro:page-load'));
          document.dispatchEvent(new Event('astro:page-load'));
        });
        expect(await surfaceFacts(page)).toEqual(facts);
        await expectCopyControls(page);
        await retainEvidence(page, `390-${theme}-after-navigation`, { facts });
      }
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/shadcn/button/`, {
        waitUntil: 'domcontentloaded',
      });
      await ready(page);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((mode) => {
          document.documentElement.dataset.theme = mode;
        }, theme);
        const facts = { ec: expectedInstall.get(theme)! };
        const install = await page
          .locator('.install-command-card:visible')
          .first()
          .evaluate((element) => {
            const style = getComputedStyle(element);
            const code = getComputedStyle(element.querySelector('code')!);
            return {
              background: style.backgroundColor,
              color: code.color,
              radius: style.borderRadius,
              font: code.fontFamily,
              size: code.fontSize,
              lineHeight: code.lineHeight,
            };
          });
        expect(install).toEqual({ ...facts.ec, radius: '12px' });
        const body = page.locator('.install-command-card__body:visible').first();
        expect(
          await body.evaluate((element) => {
            const style = getComputedStyle(element);
            return (
              element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
            );
          })
        ).toBeLessThanOrEqual(parseFloat(install.lineHeight) + 1);
        await retainEvidence(page, `390-${theme}-install`, { facts, install });
      }
    } finally {
      await context.close();
    }
  }, 90_000);
});
