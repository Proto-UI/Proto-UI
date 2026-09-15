// @vitest-environment node
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';

// D-WEB-COMPONENT-SHADOW-PROFILE-0001-K; C-HOST-VIEW-ATTACHMENT-0001-C;
// C-AS-FOCUS-SCOPE-0002-J. These source-level edge probes complement the
// public-dist S1-S5 journeys; native keyboard traversal is the order oracle.
let browser: Awaited<ReturnType<typeof launchBrowser>>;
let script: string;
beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `
        export { sampleWebComponentScopeTargets as sample } from './packages/adapters/web-component/src/focus-scope-targets';
        export { AdaptToWebComponent as adapt } from './packages/adapters/web-component/src/adapt';
        export { definePrototype as define, tw } from '@proto.ui/core';
        export { asTextControl, asFocusEntry, asFocusScope } from '@proto.ui/hooks';
        export { declareTextControl } from '@proto.ui/module-text-control';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Closeout',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 30_000);
afterAll(async () => {
  await browser?.close();
});

describe('Shadow closeout native boundaries', () => {
  it.each(['onUnmounted', 'onBeforeDispose'] as const)(
    'retains moves and restores styled resources after reconnect inside %s',
    async (checkpoint) => {
      // D-WEB-COMPONENT-SHADOW-STYLE-0001-K: use the real Runtime in Chrome.
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.addScriptTag({ content: script });
        const observed = await page.evaluate(
          async ({ artifact, checkpoint }) => {
            const p = (window as any).Closeout;
            let host: any;
            let setups = 0;
            let scheme = 'light';
            const listeners = new Set<() => void>();
            const retained: (() => void)[] = [];
            const C = p.adapt(
              p.define({
                name: 'reentrant-shadow-generation',
                setup(def: any) {
                  const generation = ++setups;
                  let run: any;
                  def.lifecycle.onCreated((r: any) => {
                    run = r;
                  });
                  def.lifecycle[checkpoint](() => {
                    if (generation === 1) document.body.append(host);
                  });
                  def.expose('patch', () => run.feedback.style.patch(p.tw('p-2')));
                  return (r: any) => r.slot();
                },
              }),
              {
                shadow: {
                  mode: 'open',
                  presentation: 'split',
                  styleArtifact: artifact,
                  colorSchemeSource: {
                    get: () => scheme,
                    subscribe(listener: () => void) {
                      listeners.add(listener);
                      retained.push(listener);
                      return () => {
                        listeners.delete(listener);
                      };
                    },
                  },
                },
              }
            );
            host = new C();
            host.textContent = 'Consumer text survives';
            document.body.append(host);
            const first = host._splitResources;
            const carrier = document.createElement('section');
            document.body.append(carrier);
            carrier.append(host);
            await new Promise((resolve) => setTimeout(resolve, 10));
            const sameMove = host._splitResources === first && setups === 1;
            host.remove();
            await new Promise((resolve) => setTimeout(resolve, 20));
            const second = host._splitResources;
            host.getExposes().patch();
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const surface = second.surface.element;
            const styleGeometry = {
              padding: getComputedStyle(surface).paddingTop,
              positiveBox: surface.getBoundingClientRect().height > 0,
            };
            scheme = 'dark';
            retained[0]();
            first.dispose();
            const staleIsInert = host.getAttribute('data-pui-color-scheme') === 'light';
            retained[1]();
            const result = {
              sameMove,
              setups,
              staleIsInert,
              fresh:
                second !== first &&
                second.surface !== first.surface &&
                second.environment !== first.environment &&
                second.artifact !== first.artifact,
              connected: surface.isConnected,
              styles: host.shadowRoot.querySelectorAll('style').length,
              subscriptions: listeners.size,
              scheme: host.getAttribute('data-pui-color-scheme'),
              text: host.textContent,
              styleGeometry,
            };
            host.remove();
            await new Promise((resolve) => setTimeout(resolve, 10));
            carrier.remove();
            return {
              ...result,
              terminalSubscriptions: listeners.size,
              terminalNodes: host.shadowRoot.childNodes.length,
            };
          },
          { artifact: renderProtoShadowSplitStyleArtifact(['p-2']), checkpoint }
        );
        expect(observed).toEqual({
          sameMove: true,
          setups: 2,
          staleIsInert: true,
          fresh: true,
          connected: true,
          styles: 1,
          subscriptions: 1,
          scheme: 'dark',
          text: 'Consumer text survives',
          styleGeometry: { padding: '8px', positiveBox: true },
          terminalSubscriptions: 0,
          terminalNodes: 0,
        });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
  );
  it.each(['single', 'multiline'] as const)(
    'initially absent %s editor acquires no view lease',
    async (lineMode) => {
      const page = await browser.newPage();
      try {
        await page.addScriptTag({ content: script });
        const result = await page.evaluate(
          async ({ lineMode, artifact }) => {
            const p = (window as any).Closeout;
            let run: any;
            let mounts = 0;
            const C = p.adapt(
              p.define({
                name: 'closeout-absent-editor',
                modules: [
                  p.declareTextControl({ content: 'plain-text', engine: 'host', lineMode }),
                ],
                setup(def: any) {
                  const control = p.asTextControl();
                  def.lifecycle.onCreated((r: any) => {
                    run = r;
                    control.sync({ valueMode: 'uncontrolled', defaultValue: 'retained' });
                    r.lifecycle.setPresent(false);
                  });
                  def.lifecycle.onMounted(() => {
                    mounts++;
                  });
                  def.expose('show', () => run.lifecycle.setPresent(true));
                  return () => null;
                },
              }),
              { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
            );
            const outer = document.createElement('div');
            const host = new C();
            outer.attachShadow({ mode: 'open' }).append(host);
            document.body.append(outer);
            const absent = {
              mounts,
              editors: host.shadowRoot.querySelectorAll('input,textarea').length,
            };
            host.getExposes().show();
            await new Promise((r) => setTimeout(r, 30));
            const editor = host.shadowRoot.querySelector('input,textarea');
            editor.focus();
            return {
              absent,
              mounts,
              value: editor.value,
              visible: editor.getBoundingClientRect().height > 0,
              focused: host.shadowRoot.activeElement === editor,
            };
          },
          { lineMode, artifact: renderProtoShadowSplitStyleArtifact([]) }
        );
        expect(result).toEqual({
          absent: { mounts: 0, editors: 0 },
          mounts: 1,
          value: 'retained',
          visible: true,
          focused: true,
        });
      } finally {
        await page.close();
      }
    }
  );

  it('matches native scope-local tabindex order, descendant entry and trapped forward/reverse traversal', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate((artifact) => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-focus-scope',
            setup(def: any) {
              const scope = p.asFocusScope();
              scope.configure({ trap: true, loop: true, entry: 'manual' });
              const entry = p.asFocusEntry();
              entry.configure({ strategy: 'descendant-first', fallback: 'self' });
              def.expose('activate', () => scope.activate());
              def.expose('deactivate', () => scope.deactivate());
              def.expose('enter', () => entry.focus());
              return (r: any) => r.slot();
            },
          }),
          { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
        );
        const scope = new C();
        scope.id = 'scope';
        scope.innerHTML =
          '<div id="host"><button id="slotted" tabindex="3">S3</button><button id="slotted-first" tabindex="1">S1</button></div><button id="outer" tabindex="2">Outer</button><button id="last">Last</button>';
        scope.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML =
          '<slot></slot><button id="inner" tabindex="1">Inner</button>';
        document.body.append(scope);
      }, renderProtoShadowSplitStyleArtifact([]));
      const active = () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return el?.id;
        });
      const expected = ['outer', 'inner', 'slotted-first', 'slotted', 'last'];
      for (const index of [null, '1', '-1']) {
        await page.locator('#host').evaluate((el, index) => {
          if (index === null) el.removeAttribute('tabindex');
          else el.setAttribute('tabindex', index);
        }, index);
        const order =
          index === null
            ? expected
            : index === '1'
              ? ['host', 'inner', 'slotted-first', 'slotted', 'outer', 'last']
              : ['outer', 'last'];
        expect(
          await page.evaluate(() =>
            (window as any).Closeout.sample(document.getElementById('scope')).targets.map(
              (el: HTMLElement) => el.id
            )
          )
        ).toEqual(order);
        await page.locator(`#${order[0]}`).focus();
        for (const id of order.slice(1)) {
          await page.keyboard.press('Tab');
          expect(await active()).toBe(id);
        }
        for (const id of order.slice(0, -1).reverse()) {
          await page.keyboard.press('Shift+Tab');
          expect(await active()).toBe(id);
        }
      }
      await page.locator('#host').evaluate((el) => el.removeAttribute('tabindex'));
      await page.locator('#last').focus();
      await page.locator('#scope').evaluate((el: any) => el.getExposes().enter());
      expect(await active()).toBe('outer');
      await page.locator('#scope').evaluate((el: any) => el.getExposes().activate());
      for (const id of [...expected.slice(1), 'outer']) {
        await page.keyboard.press('Tab');
        expect(await active()).toBe(id);
      }
      for (const id of [...expected].reverse()) {
        await page.keyboard.press('Shift+Tab');
        expect(await active()).toBe(id);
      }
      for (const style of ['display:contents', 'visibility:hidden']) {
        await page.locator('#scope').evaluate((el: any) => el.getExposes().deactivate());
        await page.locator('#host').evaluate((el, style) => {
          el.setAttribute('tabindex', '1');
          el.setAttribute('style', style);
          el.shadowRoot!.querySelector('button')!.style.visibility = 'visible';
          for (const child of el.querySelectorAll('button')) child.style.visibility = 'visible';
        }, style);
        expect(
          await page.evaluate(() =>
            (window as any).Closeout.sample(document.getElementById('scope')).targets.map(
              (el: HTMLElement) => el.id
            )
          )
        ).toEqual(expected);
        await page.locator('#outer').focus();
        for (const id of expected.slice(1)) {
          await page.keyboard.press('Tab');
          expect(await active()).toBe(id);
        }
        for (const id of expected.slice(0, -1).reverse()) {
          await page.keyboard.press('Shift+Tab');
          expect(await active()).toBe(id);
        }
        await page.locator('#last').focus();
        await page.locator('#scope').evaluate((el: any) => el.getExposes().enter());
        expect(await active()).toBe('outer');
        await page.locator('#scope').evaluate((el: any) => el.getExposes().activate());
        for (const id of [...expected.slice(1), 'outer']) {
          await page.keyboard.press('Tab');
          expect(await active()).toBe(id);
        }
        for (const id of [...expected].reverse()) {
          await page.keyboard.press('Shift+Tab');
          expect(await active()).toBe(id);
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
