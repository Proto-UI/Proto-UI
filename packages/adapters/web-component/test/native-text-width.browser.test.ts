// @vitest-environment node
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';

let browser: Awaited<ReturnType<typeof launchBrowser>>;
let script: string;
const out = process.env.PROTO_UI_NATIVE_WIDTH_EVIDENCE;
beforeAll(async () => {
  const result = await build({
    entryPoints: ['packages/adapters/web-component/test/fixtures/native-width.mjs'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'NativeWidth',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
    nodePaths: [path.resolve('apps/www/node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  script = result.outputFiles[0].text;
  browser = await launchBrowser();
  if (out) await mkdir(out, { recursive: true });
}, 30_000);
afterAll(async () => {
  await browser?.close();
});

describe('exact-source native full-width editor composition', () => {
  it.each([false, true])(
    'retains four-runtime geometry and editing with reset=%s',
    async (reset) => {
      const facts: any[] = [];
      for (const font of [100, 200]) {
        for (const runtime of ['react', 'wc', 'vue', 'vue2']) {
          const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
          page.setDefaultTimeout(2_000);
          const pageErrors: string[] = [];
          page.on('pageerror', (error) => pageErrors.push(String(error)));
          await page.route('**/*', (route) => {
            pageErrors.push(`Unexpected network request: ${route.request().url()}`);
            return route.abort();
          });
          try {
            await page.setContent(
              `<!doctype html><style>html{font-size:${font}%} ${reset ? '*{box-sizing:border-box}' : ''}</style>`
            );
            await page.addStyleTag({ content: renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS) });
            await page.addScriptTag({ content: script });
            const result = await page.evaluate(
              async ({ runtime, font, reset }) => {
                const rows: any[] = [];
                (window as any).__nativeWidthFacts = rows;
                for (const kind of ['input', 'textarea']) {
                  for (const width of [144, 224, 360]) {
                    for (const layout of ['plain', 'padded-sibling', 'padded-two-siblings']) {
                      for (const variant of ['placeholder', 'long-value', 'disabled', 'readOnly']) {
                        try {
                          const parent = document.createElement('section');
                          // Only the consumer parent and its independent sibling are styled.
                          // No editor/Proto selector, width override or compensating CSS.
                          parent.style.cssText = `display:flex;width:${width}px;gap:8px;${layout !== 'plain' ? 'padding:12px;border:2px solid;' : ''}`;
                          if (layout !== 'plain') {
                            const sibling = document.createElement('span');
                            sibling.style.cssText = 'width:24px;flex:none';
                            sibling.textContent = 'A';
                            parent.append(sibling);
                          }
                          const mount = document.createElement('div');
                          // display:contents makes the actual Adapter Root the flex item.
                          mount.style.display = 'contents';
                          parent.append(mount);
                          if (layout === 'padded-two-siblings') {
                            const sibling = document.createElement('span');
                            sibling.style.cssText = 'width:16px;flex:none';
                            sibling.textContent = 'B';
                            parent.append(sibling);
                          }
                          const label = document.createElement('p');
                          label.textContent = `${runtime} ${kind} ${width}px ${layout} ${variant} ${font}% reset=${reset}`;
                          document.body.append(label, parent);
                          await (window as any).NativeWidth.mount(runtime, kind, mount, {
                            defaultValue:
                              variant === 'long-value'
                                ? 'Long native editor value '.repeat(12)
                                : '',
                            placeholder: 'Search or type a long placeholder',
                            disabled: variant === 'disabled',
                            readOnly: variant === 'readOnly',
                          });
                          const editor = mount.querySelector('input,textarea') as
                            | HTMLInputElement
                            | HTMLTextAreaElement;
                          if (!editor) throw new Error(`${runtime}/${kind}: missing editor`);
                          const expectedValue =
                            variant === 'long-value' ? 'Long native editor value '.repeat(12) : '';
                          const before = editor.value;
                          editor.dataset.nativeWidthIndex = String(rows.length);
                          if (!editor.disabled) {
                            editor.focus();
                            editor.setSelectionRange(1, Math.min(5, before.length));
                          }
                          const box = editor.getBoundingClientRect();
                          const parentStyle = getComputedStyle(parent);
                          const available =
                            parent.clientWidth -
                            parseFloat(parentStyle.paddingLeft) -
                            parseFloat(parentStyle.paddingRight) -
                            (layout === 'padded-two-siblings'
                              ? 56
                              : layout === 'padded-sibling'
                                ? 32
                                : 0);
                          rows.push({
                            runtime,
                            font,
                            reset,
                            kind,
                            width,
                            layout,
                            variant,
                            editorWidth: box.width,
                            available,
                            parentWidth: parent.getBoundingClientRect().width,
                            editorBoxSizing: getComputedStyle(editor).boxSizing,
                            expectedValue,
                            initialValue: before,
                            valuePreserved: editor.value === expectedValue,
                            disabled: editor.disabled,
                            readOnly: editor.readOnly,
                            focused: !editor.disabled && document.activeElement === editor,
                            selection: [editor.selectionStart, editor.selectionEnd],
                            editorIndex: editor.dataset.nativeWidthIndex,
                          });
                        } catch (error) {
                          rows.push({
                            runtime,
                            font,
                            reset,
                            kind,
                            width,
                            layout,
                            variant,
                            error: String(error),
                          });
                        }
                      }
                    }
                  }
                }
                return rows;
              },
              { runtime, font, reset }
            );
            for (const row of result) {
              if (row.error || row.variant !== 'long-value') continue;
              const target = page.locator(`[data-native-width-index="${row.editorIndex}"]`);
              try {
                const edited = 'Actual native keyboard editing';
                await target.fill(edited);
                await target.press('Control+Home');
                for (let i = 0; i < 3; i++) await target.press('Shift+ArrowRight');
                row.editedValue = await target.inputValue();
                row.editedSelection = await target.evaluate((node) => [
                  (node as HTMLInputElement).selectionStart,
                  (node as HTMLInputElement).selectionEnd,
                ]);
              } catch (error) {
                row.error = String(error);
              }
            }
            facts.push(...result);
            for (const error of pageErrors) facts.push({ runtime, font, reset, error });
            if (out)
              await writeFile(
                path.join(out, `native-width-reset-${reset}.json`),
                JSON.stringify(facts, null, 2)
              );
            if (out)
              await page.screenshot({
                path: path.join(out, `${runtime}-${font}-reset-${reset}.png`),
                fullPage: true,
              });
            if (out && (result.some((row: any) => row.error) || pageErrors.length)) {
              await writeFile(
                path.join(out, `${runtime}-${font}-reset-${reset}-failure.html`),
                await page.content()
              );
            }
          } catch (error) {
            const partial = await page
              .evaluate(() => (window as any).__nativeWidthFacts ?? [])
              .catch(() => []);
            facts.push(...partial, { runtime, font, reset, error: String(error) });
            if (out) {
              await writeFile(
                path.join(out, `native-width-reset-${reset}.json`),
                JSON.stringify(facts, null, 2)
              );
              await page
                .screenshot({
                  path: path.join(out, `${runtime}-${font}-reset-${reset}-failure.png`),
                })
                .catch(() => undefined);
              await writeFile(
                path.join(out, `${runtime}-${font}-reset-${reset}-failure.html`),
                await page.content().catch(() => 'Unavailable')
              );
            }
          } finally {
            await page.close();
          }
        }
      }
      if (out)
        await writeFile(
          path.join(out, `native-width-reset-${reset}.json`),
          JSON.stringify(facts, null, 2)
        );
      for (const fact of facts) {
        expect(fact.error, JSON.stringify(fact)).toBeUndefined();
        const key = ['font', 'kind', 'width', 'layout', 'variant'];
        const reference = facts.find(
          (row) => row.runtime === 'react' && key.every((k) => row[k] === fact[k])
        );
        expect(fact.editorWidth, JSON.stringify(fact)).toBeGreaterThan(0);
        if (reset)
          expect(
            Math.abs(fact.editorWidth - fact.available),
            JSON.stringify(fact)
          ).toBeLessThanOrEqual(1);
        expect(fact.valuePreserved, JSON.stringify(fact)).toBe(true);
        if (fact.variant === 'long-value') {
          expect(fact.editedValue).toBe('Actual native keyboard editing');
          expect(fact.editedSelection).toEqual([0, 3]);
        }
        expect(fact.disabled, JSON.stringify(fact)).toBe(fact.variant === 'disabled');
        expect(fact.readOnly, JSON.stringify(fact)).toBe(fact.variant === 'readOnly');
        if (!fact.disabled) expect(fact.focused, JSON.stringify(fact)).toBe(true);
        expect(
          Math.abs(fact.editorWidth - reference.editorWidth),
          JSON.stringify({ fact, reference })
        ).toBeLessThanOrEqual(1);
      }
    },
    180_000
  );
});
