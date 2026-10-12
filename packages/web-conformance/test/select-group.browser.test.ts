// @vitest-environment node
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { collectProtoStyleTokens } from '../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderPrefixedThemeCss,
} from '../../cli/src/services/proto-style-css';
import { SHADCN_THEME_CSS } from '../../cli/src/legacy/type';
import type * as Fixture from './fixtures/select-group-native';

declare global {
  interface Window {
    selectGroupProof: typeof Fixture;
  }
}
let browser: Browser, bundle: string, css: string;
const ref = (name: string) => `[data-demo-ref="${name}"]`;
beforeAll(async () => {
  const tokens = (await collectProtoStyleTokens('packages/prototypes/shadcn/src/select')).map(
    (token) => {
      if (typeof token !== 'string') throw new TypeError('Expected style token string');
      return token;
    }
  );
  css = renderPrefixedThemeCss(SHADCN_THEME_CSS) + '\n' + renderProtoStyleTokenCss(tokens);
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixtures/select-group-native.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'selectGroupProof',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  if (!result.outputFiles[0]) throw new Error('Missing grouped Select bundle');
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    chromiumSandbox: true,
  });
}, 60_000);
afterAll(async () => browser?.close());
async function names(page: Page) {
  return page.evaluate(() => {
    const relation = (name: string) => {
      const group = document.querySelector(`[data-demo-ref="${name}"]`)!;
      const id = group.getAttribute('aria-labelledby');
      return {
        role: group.getAttribute('role'),
        id,
        label: id ? document.getElementById(id)?.textContent : null,
      };
    };
    return {
      frameworks: relation('frameworks'),
      nested: relation('nested'),
      platform: relation('platform'),
    };
  });
}
// New York style reference: shadcn-ui/ui 02cad611, registry/new-york-v4/ui/select.tsx.
// Native browser DOM/CSS/input evidence is not assistive-technology or GPUI evidence.
for (const direction of ['ltr', 'rtl'] as const)
  for (const theme of ['light', 'dark'] as const)
    for (const rem of [16, 32])
      it(`real grouped Select: ${direction} ${theme} rem${rem}`, async () => {
        const context = await browser.newContext({
          viewport: { width: 1100, height: 1100 },
          colorScheme: theme,
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
          await page.route('**/*', (route) => route.abort());
          await page.setContent(
            `<!doctype html><html class="${theme}" style="font-size:${rem}px"><head></head><body></body></html>`
          );
          await page.addStyleTag({
            content:
              css +
              '\n*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--pui-background);color:var(--pui-foreground)}button{font-family:inherit}',
          });
          await page.addScriptTag({ content: bundle });
          await page.evaluate((dir) => window.selectGroupProof.mount(dir), direction);
          await page.locator(ref('trigger')).click();
          await page.locator(ref('react')).waitFor({ state: 'visible' });
          await page.waitForFunction(() => window.selectGroupProof.readState().phase === 'entered');
          expect(await page.evaluate(() => window.selectGroupProof.readState().diagnostic)).toBe(
            ''
          );
          const initialNames = await names(page);
          expect(initialNames.frameworks).toMatchObject({
            role: 'group',
            label: 'Framework adapters',
          });
          expect(initialNames.nested).toMatchObject({ role: 'group', label: 'Legacy adapter' });
          expect(initialNames.platform).toMatchObject({ role: 'group', label: 'Web platform' });
          expect(new Set(Object.values(initialNames).map((group) => group.id)).size).toBe(3);
          const geometry = await page.evaluate(() => {
            const sample = (name: string) => {
              const node = document.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
              const rect = node.getBoundingClientRect(),
                style = getComputedStyle(node);
              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                paddingLeft: style.paddingLeft,
                paddingRight: style.paddingRight,
                paddingTop: style.paddingTop,
                paddingBottom: style.paddingBottom,
                marginLeft: style.marginLeft,
                marginRight: style.marginRight,
                marginTop: style.marginTop,
                marginBottom: style.marginBottom,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                color: style.color,
                background: style.backgroundColor,
                pointerEvents: style.pointerEvents,
                direction: style.direction,
                text: node.textContent,
                hidden: node.getAttribute('aria-hidden'),
                tabIndex: node.tabIndex,
                tokens: node.getAttribute('data-pui-style'),
              };
            };
            const probe = document.createElement('div');
            probe.style.cssText = 'color:var(--pui-muted-foreground);background:var(--pui-border)';
            document.body.append(probe);
            const colors = {
              label: getComputedStyle(probe).color,
              separator: getComputedStyle(probe).backgroundColor,
            };
            probe.remove();
            return {
              colors,
              parts: Object.fromEntries(
                [
                  'trigger',
                  'content',
                  'surface',
                  'viewport',
                  'frameworks',
                  'framework-label',
                  'react',
                  'vue',
                  'nested',
                  'nested-label',
                  'vue2',
                  'separator',
                  'platform',
                  'platform-label',
                  'wc',
                ].map((name) => [name, sample(name)])
              ),
            };
          });
          for (const [name, part] of Object.entries(geometry.parts)) {
            expect(part.width, name).toBeGreaterThan(0);
            expect(part.height, name).toBeGreaterThan(0);
            expect(part.direction, name).toBe(direction);
          }
          for (const name of ['framework-label', 'nested-label', 'platform-label']) {
            const label = geometry.parts[name];
            expect(label.paddingLeft).toBe(`${rem * 0.5}px`);
            expect(label.paddingRight).toBe(`${rem * 0.5}px`);
            expect(label.paddingTop).toBe(`${rem * 0.375}px`);
            expect(label.paddingBottom).toBe(`${rem * 0.375}px`);
            expect(label.fontSize).toBe(`${rem * 0.75}px`);
            expect(label.lineHeight).toBe(`${rem}px`);
            expect(label.color).toBe(geometry.colors.label);
            expect(label.tabIndex).toBe(-1);
          }
          const separator = geometry.parts.separator;
          expect(separator.height).toBe(1);
          expect(separator.marginLeft).toBe(`${rem * -0.25}px`);
          expect(separator.marginRight).toBe(`${rem * -0.25}px`);
          expect(separator.marginTop).toBe(`${rem * 0.25}px`);
          expect(separator.marginBottom).toBe(`${rem * 0.25}px`);
          expect(separator.background).toBe(geometry.colors.separator);
          expect(separator.pointerEvents).toBe('none');
          expect(separator.hidden).toBe('true');
          expect(separator.text).toBe('');
          expect(separator.tabIndex).toBe(-1);
          expect(geometry.parts['framework-label'].y).toBeLessThan(geometry.parts.react.y);
          expect(geometry.parts.vue.y).toBeLessThan(geometry.parts['nested-label'].y);
          expect(geometry.parts.vue2.y).toBeLessThan(separator.y);
          expect(separator.y).toBeLessThan(geometry.parts['platform-label'].y);
          expect(geometry.parts['platform-label'].y).toBeLessThan(geometry.parts.wc.y);
          const evidence = process.env.PROTO_UI_TARGET_ALIGNMENT_EVIDENCE;
          if (evidence) {
            await mkdir(evidence, { recursive: true });
            const stem = `grouped-select-${direction}-${theme}-rem${rem}`;
            await page.screenshot({ path: join(evidence, `${stem}.png`), fullPage: true });
          }
          // Structural lifecycle must never commit a new selection or steal another group's name.
          await page.evaluate(() => window.selectGroupProof.setLabel('removed'));
          expect(await page.evaluate(() => window.selectGroupProof.readState().diagnostic)).toBe(
            ''
          );
          await page.waitForFunction(() => window.selectGroupProof.readState().phase === 'entered');
          const removed = await names(page);
          expect(removed.frameworks.id).toBeNull();
          expect(removed.nested).toEqual(initialNames.nested);
          expect(removed.platform).toEqual(initialNames.platform);
          expect(await page.evaluate(() => window.selectGroupProof.readState().value)).toBe(
            'react'
          );
          await page.evaluate(() => window.selectGroupProof.setLabel('rebound'));
          expect(await page.evaluate(() => window.selectGroupProof.readState().diagnostic)).toBe(
            ''
          );
          await page.waitForFunction(() => window.selectGroupProof.readState().phase === 'entered');
          const rebound = await names(page);
          expect(rebound.frameworks.label).toBe('Framework adapters (rebound)');
          expect(rebound.frameworks.id).toBeTruthy();
          expect(rebound.nested).toEqual(initialNames.nested);
          expect(rebound.platform).toEqual(initialNames.platform);
          expect(await page.evaluate(() => window.selectGroupProof.readState().value)).toBe(
            'react'
          );
          // The real roving collection includes only options, including across nested groups.
          await page.locator(ref('react')).focus();
          for (const option of ['vue', 'vue2', 'wc']) {
            await page.keyboard.press('ArrowDown');
            expect(
              await page.evaluate(() => document.activeElement?.getAttribute('data-demo-ref'))
            ).toBe(option);
          }
          await page.keyboard.press('Enter');
          expect(await page.evaluate(() => window.selectGroupProof.readState().value)).toBe('wc');
          expect(await page.locator(ref('trigger')).textContent()).toContain('Web Components');
          expect(errors).toEqual([]);
          if (evidence) {
            await writeFile(
              join(evidence, `grouped-select-${direction}-${theme}-rem${rem}.json`),
              JSON.stringify(
                {
                  direction,
                  theme,
                  rem,
                  upstream: 'shadcn-ui/ui@02cad611:registry/new-york-v4/ui/select.tsx',
                  scope:
                    'React native browser; not AT or native GPUI (hidden wire gap remains out of scope)',
                  initialNames,
                  removed,
                  rebound,
                  geometry,
                  keyboardPath: ['react', 'vue', 'vue2', 'wc'],
                  finalState: await page.evaluate(() => window.selectGroupProof.readState()),
                  errors,
                },
                null,
                2
              )
            );
          }
        } finally {
          await page.evaluate(() => window.selectGroupProof?.unmount());
          await context.close();
        }
      }, 30_000);
