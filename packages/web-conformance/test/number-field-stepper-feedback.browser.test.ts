// @vitest-environment node
import { build } from 'esbuild';
import { chromium, type Browser, type Locator, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type {
  AdaptToWebComponent,
  setElementProps,
  WebComponentAdapterElement,
} from '../../adapters/web-component/src';
import { BRUTALIST_THEME_CSS } from '../../cli/src/legacy/type';
import { collectProtoStyleTokens } from '../../cli/src/services/prototype-style-tokens';
import {
  renderPrefixedThemeCss,
  renderProtoStyleTokenCss,
} from '../../cli/src/services/proto-style-css';
import type * as BaseNumberField from '../../prototypes/base/src/number-field';
import type * as BrutalistNumberField from '../../prototypes/brutalist/src/number-field';
import type * as LiquidNumberField from '../../prototypes/liquid-glass/src/number-field';
import { renderThemeCss } from '../../prototypes/liquid-glass/src/theme';

type Root = WebComponentAdapterElement<typeof BaseNumberField.numberFieldRoot>;
type Group = {
  root: Root;
  changes: Array<number | null>;
  patch(props: BaseNumberField.NumberFieldRootProps): void;
};
declare global {
  interface Window {
    NumberFieldConsumer: {
      base: typeof BaseNumberField;
      brutalist: typeof BrutalistNumberField;
      liquid: typeof LiquidNumberField;
      adapt: typeof AdaptToWebComponent;
      setElementProps: typeof setElementProps;
    };
    numberGroups: Record<'base' | 'family', Group>;
  }
}

let browser: Browser;
let script: string;
const families = ['brutalist', 'liquid-glass'] as const;
type Family = (typeof families)[number];
const styles = new Map<Family, string>();
beforeAll(async () => {
  for (const family of families) {
    const tokens = await collectProtoStyleTokens(`packages/prototypes/${family}/src/number-field`);
    styles.set(
      family,
      (family === 'brutalist' ? renderPrefixedThemeCss(BRUTALIST_THEME_CSS) : renderThemeCss()) +
        '\n' +
        renderProtoStyleTokenCss(
          tokens.map((token) => {
            if (typeof token !== 'string') throw new TypeError('Expected a collected style token');
            return token;
          })
        )
    );
  }
  const result = await build({
    stdin: {
      contents: `
        export * as base from './packages/prototypes/base/src/number-field';
        export * as brutalist from './packages/prototypes/brutalist/src/number-field';
        export * as liquid from './packages/prototypes/liquid-glass/src/number-field';
        export {AdaptToWebComponent as adapt} from './packages/adapters/web-component/src/adapt';
        export {setElementProps} from './packages/adapters/web-component/src/props';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'NumberFieldConsumer',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = result.outputFiles[0].text;
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}, 30000);
afterAll(async () => browser?.close());

async function mount(page: Page, family: Family) {
  await page.setContent('<main style="padding:80px"></main>');
  await page.addStyleTag({ content: styles.get(family)! });
  await page.addScriptTag({ content: script });
  await page.evaluate((family) => {
    const p = window.NumberFieldConsumer;
    const groups = {} as Window['numberGroups'];
    for (const [name, parts] of [
      ['base', p.base],
      ['family', family === 'brutalist' ? p.brutalist : p.liquid],
    ] as const) {
      const {
        numberFieldRoot,
        numberFieldLabel,
        numberFieldInput,
        numberFieldIncrement,
        numberFieldDecrement,
      } = parts;
      const options = { shadow: false } as const;
      const RootElement = p.adapt(numberFieldRoot, options);
      const LabelElement = p.adapt(numberFieldLabel, options);
      const InputElement = p.adapt(numberFieldInput, options);
      const IncrementElement = p.adapt(numberFieldIncrement, options);
      const DecrementElement = p.adapt(numberFieldDecrement, options);
      const root = new RootElement();
      const label = new LabelElement();
      const input = new InputElement();
      const increment = new IncrementElement();
      const decrement = new DecrementElement();
      root.id = name;
      root.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:32px';
      increment.id = `${name}-increment`;
      decrement.id = `${name}-decrement`;
      increment.textContent = '+';
      decrement.textContent = '-';
      label.textContent = `${name} quantity`;
      let props: BaseNumberField.NumberFieldRootProps = { defaultValue: 20, step: 2 };
      p.setElementProps(root, props);
      const changes: Group['changes'] = [];
      root.addEventListener('valueChange', (event) => {
        if (event instanceof CustomEvent) changes.push(event.detail.value);
      });
      root.append(label, decrement, input, increment);
      document.querySelector('main')!.append(root);
      groups[name] = {
        root,
        changes,
        patch(patch) {
          props = { ...props, ...patch };
          p.setElementProps(root, props);
        },
      };
    }
    window.numberGroups = groups;
  }, family);
  await expect.poll(() => page.locator('#family input').inputValue()).toBe('20');
  await expect.poll(() => page.locator('#base input').inputValue()).toBe('20');
}

async function paint(target: Locator) {
  return target.evaluate(async (element) => {
    // Settle the Adapter's projection and the family's real CSS shadow transition.
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    await promise;
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      shadow: style.boxShadow,
      opacity: style.opacity,
      cursor: style.cursor,
    };
  });
}

async function values(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.entries(window.numberGroups).map(([name, group]) => [
        name,
        { value: group.root.getExposes().getValue(), changes: [...group.changes] },
      ])
    )
  );
}

async function patch(page: Page, props: BaseNumberField.NumberFieldRootProps) {
  await page.evaluate((props) => {
    for (const group of Object.values(window.numberGroups)) group.patch(props);
  }, props);
}

for (const family of families) {
  describe(`${family} NumberField physical feedback`, () => {
    it.each(['increment', 'decrement'] as const)(
      '%s paints physical transitions while Base owns value requests',
      async (part) => {
        const page = await browser.newPage({ colorScheme: 'light' });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await mount(page, family);
          const target = page.locator(`#family-${part}`);
          const sibling = page.locator(
            `#family-${part === 'increment' ? 'decrement' : 'increment'}`
          );
          const rest = await paint(target);
          const siblingRest = await paint(sibling);
          expect(rest.background).not.toBe('rgba(0, 0, 0, 0)');
          expect(rest.shadow).not.toBe('none');

          await target.hover();
          const hover = await paint(target);
          if (family === 'brutalist') {
            expect(hover.background).not.toBe(rest.background);
            expect(hover.shadow).toBe(rest.shadow);
          } else {
            expect(hover.background).toBe(rest.background);
            expect(hover.shadow).not.toBe(rest.shadow);
          }
          expect(await paint(sibling)).toEqual(siblingRest);
          await page.mouse.down();
          const pressed = await paint(target);
          expect(pressed.background).not.toBe(hover.background);
          if (family === 'liquid-glass') expect(pressed.shadow).toBe(rest.shadow);
          expect(await values(page)).toEqual({
            family: { value: 20, changes: [] },
            base: { value: 20, changes: [] },
          });

          // Native pointerup also emits click. Exactly one Base step must result.
          await page.mouse.up();
          expect(await paint(target)).toEqual(hover);
          const stepped = part === 'increment' ? 22 : 18;
          await page.locator(`#base-${part}`).click();
          expect(await values(page)).toEqual({
            family: { value: stepped, changes: [stepped] },
            base: { value: stepped, changes: [stepped] },
          });
          await page.mouse.move(1, 1);
          expect(await paint(target)).toEqual(rest);

          for (const end of ['pointerleave', 'pointercancel']) {
            await target.hover();
            await page.mouse.down();
            expect((await paint(target)).background).toBe(pressed.background);
            if (end === 'pointerleave') await page.mouse.move(1, 1);
            else {
              // Cancellation is injected as a standard DOM event; other pointer input is native.
              await target.dispatchEvent('pointercancel', {
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                bubbles: true,
                composed: true,
              });
            }
            expect(await paint(target)).toEqual(rest);
            await page.mouse.move(1, 1);
            await page.mouse.up();
            expect((await values(page)).family).toEqual({ value: stepped, changes: [stepped] });
          }

          for (const contact of ['hover', 'press']) {
            await target.hover();
            if (contact === 'press') await page.mouse.down();
            await patch(page, { disabled: true });
            const disabled = await paint(target);
            expect(disabled.opacity).toBe(family === 'brutalist' ? '0.5' : '1');
            expect(disabled.cursor).toBe('not-allowed');
            // The disabled routes must also ignore programmatically dispatched input.
            for (const type of ['pointerenter', 'pointerdown']) {
              await target.dispatchEvent(type, {
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
              });
              expect(await paint(target)).toEqual(disabled);
            }
            await target.evaluate((element: HTMLElement) => element.click());
            expect((await values(page)).family).toEqual({ value: stepped, changes: [stepped] });
            await patch(page, { disabled: false });
            expect(await paint(target)).toEqual(rest);
            await page.mouse.move(1, 1);
            if (contact === 'press') await page.mouse.up();
            await target.hover();
            expect(await paint(target)).toEqual(hover);
            await page.mouse.move(1, 1);
            expect(await paint(target)).toEqual(rest);
          }

          // A controlled owner may refuse the request; both families must match Base.
          await patch(page, { value: 40 });
          await expect.poll(() => page.locator('#family input').inputValue()).toBe('40');
          await target.click();
          await page.locator(`#base-${part}`).click();
          const proposed = part === 'increment' ? 42 : 38;
          expect(await values(page)).toEqual({
            family: { value: 40, changes: [stepped, proposed] },
            base: { value: 40, changes: [stepped, proposed] },
          });
          expect(await page.locator('#family input').inputValue()).toBe('40');
          expect(errors).toEqual([]);
        } finally {
          await page.close();
        }
      },
      30000
    );
  });
}
