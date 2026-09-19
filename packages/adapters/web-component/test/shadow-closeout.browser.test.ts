// @vitest-environment node
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';

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
        export { asTextControl, asFocusEntry, asFocusScope, asFocusable } from '@proto.ui/hooks';
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
  it('preserves document precedence between Template dark and data conditions', async () => {
    // Generated stylesheet consumer fixture; no automatic Template projection.
    const tokens = ['dark:p-2', 'data-[open]:p-4'];
    const page = await browser.newPage();
    try {
      await page.addStyleTag({ content: renderProtoStyleTokenCss(tokens) });
      await page.evaluate(
        ({ tokens, css }) => {
          const light = document.createElement('div');
          light.className = 'dark';
          const reference = document.createElement('div');
          reference.id = 'reference';
          reference.textContent = 'Document';
          reference.setAttribute('data-pui-style', tokens.join(' '));
          light.append(reference);
          const host = document.createElement('div');
          host.id = 'shadow';
          host.setAttribute('data-pui-color-scheme', 'dark');
          const root = host.attachShadow({ mode: 'open' });
          const style = document.createElement('style');
          style.textContent = css;
          const local = reference.cloneNode(true) as HTMLElement;
          local.id = 'local';
          root.append(style, local);
          document.body.append(light, host);
        },
        {
          tokens,
          css: renderProtoShadowSplitStyleArtifact(tokens, {
            rootTokens: [],
            templateTokens: tokens,
          }).cssText,
        }
      );
      for (const open of [false, true, false]) {
        const result = await page.evaluate((open) => {
          const reference = document.querySelector<HTMLElement>('#reference')!;
          const local = document
            .querySelector('#shadow')!
            .shadowRoot!.querySelector<HTMLElement>('#local')!;
          for (const el of [reference, local]) el.toggleAttribute('data-open', open);
          return [reference, local].map((el) => getComputedStyle(el).paddingTop);
        }, open);
        expect(result[0]).toBe(open ? '16px' : '8px');
        expect(result[1]).toBe(result[0]);
      }
    } finally {
      await page.close();
    }
  });
  it.each(['light', 'direct', 'split'])(
    'refreshes native entry after input type changes in %s',
    async (profile) => {
      const page = await browser.newPage();
      try {
        await page.addScriptTag({ content: script });
        await page.evaluate(
          async ({ profile, artifact }) => {
            const p = (window as any).Closeout;
            const C = p.adapt(
              p.define({
                name: 'type-entry',
                setup() {
                  p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
                  return (r: any) => r.slot();
                },
              }),
              {
                shadow:
                  profile === 'light'
                    ? false
                    : profile === 'direct'
                      ? true
                      : { mode: 'open', presentation: 'split', styleArtifact: artifact },
              }
            );
            const before = document.createElement('button');
            before.id = 'before';
            before.textContent = 'Before';
            const host = new C();
            host.id = 'entry';
            host.innerHTML = '<input id="input" type="hidden">';
            const after = document.createElement('button');
            after.id = 'after';
            after.textContent = 'After';
            document.body.append(before, host, after);
            await new Promise(requestAnimationFrame);
          },
          { profile, artifact: renderProtoShadowSplitStyleArtifact([]) }
        );
        for (const hidden of [true, false, true, false]) {
          await page.locator('#entry').evaluate(async (host, hidden) => {
            host.querySelector('input')!.type = hidden ? 'hidden' : 'text';
            // A frame boundary follows delivery of native mutation records.
            await new Promise(requestAnimationFrame);
          }, hidden);
          expect(await page.locator('#entry').getAttribute('tabindex')).toBe(hidden ? '0' : null);
          await page.locator('#before').focus();
          await page.keyboard.press('Tab');
          expect(await page.evaluate(() => document.activeElement?.id)).toBe(
            hidden ? 'entry' : 'input'
          );
          await page.keyboard.press('Tab');
          expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
        }
      } finally {
        await page.close();
      }
    }
  );
  it('makes Template-local percentage CSS usable without a Root recipe', async () => {
    // D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001-F/K: this explicit stylesheet
    // consumer probe is not a claim of automatic WC Template style projection.
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const artifact = renderProtoShadowSplitStyleArtifact(['p-2', 'p-[10%]'], {
        rootTokens: ['p-2'],
        templateTokens: ['p-[10%]'],
      });
      const result = await page.evaluate(async (artifact) => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'template-style-scope',
            setup(def: any) {
              def.feedback.style.use(p.tw('p-2'));
              return (r: any) => r.el('div', { style: p.tw('p-[10%]') }, 'Template text');
            },
          }),
          { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
        );
        const host = new C();
        host.style.width = '240px';
        document.body.append(host);
        await new Promise(requestAnimationFrame);
        const surface = host._splitResources.surface.element as HTMLElement;
        const child = surface.querySelector('div') as HTMLElement;
        // WC Template handles remain ignored without a resolver. Explicitly
        // bind the generated ordinary selector in this CSS consumer fixture.
        child.setAttribute('data-pui-style', 'p-[10%]');
        const styles = getComputedStyle(surface);
        const contentWidth =
          surface.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
        return {
          rootPadding: styles.paddingTop,
          childPadding: parseFloat(getComputedStyle(child).paddingTop),
          contentWidth,
          visible: child.getBoundingClientRect().height > 0,
          rootTokens: host.getAttribute('data-pui-split-root-style'),
        };
      }, artifact);
      expect(result.rootPadding).toBe('8px');
      expect(result.childPadding).toBeCloseTo(result.contentWidth * 0.1, 1);
      expect(result.visible).toBe(true);
      expect(result.rootTokens).toBe('p-2');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
  it('keeps native same-name radio stops distinct across form owners and DOM trees', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      await page.setContent(
        '<div id="scope"><button id="before">Before</button><form id="one"><input id="a" type="radio" name="g"><input id="b" type="radio" name="g" checked></form><form id="two"><input id="c" type="radio" name="g"><input id="d" type="radio" name="g" checked></form><input id="e" type="radio" name="g" form="one"><input id="free" type="radio" name="g"><input id="unnamed-a" type="radio"><input id="unnamed-b" type="radio"><div id="host"></div><button id="after">After</button></div>'
      );
      await page.locator('#host').evaluate((el) => {
        el.attachShadow({ mode: 'open' }).innerHTML =
          '<input id="inner-a" type="radio" name="g"><input id="inner-b" type="radio" name="g" checked>';
      });
      for (const changed of [false, true]) {
        if (changed)
          await page.locator('#e').evaluate((el) => {
            (el as HTMLInputElement).checked = true;
          });
        const expected = [
          'before',
          ...(changed ? ['d', 'e'] : ['b', 'd']),
          'free',
          'unnamed-a',
          'unnamed-b',
          'inner-b',
          'after',
        ];
        expect(
          await page.evaluate(() =>
            (window as any).Closeout.sample(document.querySelector('#scope')).targets.map(
              (el: HTMLElement) => el.id
            )
          )
        ).toEqual(expected);
        await page.locator('#before').focus();
        for (const id of expected.slice(1)) {
          await page.keyboard.press('Tab');
          expect(
            await page.evaluate(() => {
              let el = document.activeElement;
              while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
              return el?.id;
            })
          ).toBe(id);
        }
        for (const id of expected.slice(0, -1).reverse()) {
          await page.keyboard.press('Shift+Tab');
          expect(
            await page.evaluate(() => {
              let el = document.activeElement;
              while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
              return el?.id;
            })
          ).toBe(id);
        }
      }
    } finally {
      await page.close();
    }
  });
  it.each(
    [
      'checked-first',
      'checked-second',
      'unchecked',
      'disabled-checked',
      'hidden-checked',
      'negative-checked',
      'focused-unchecked',
      'outside-checked',
      'programmatic-negative',
    ].flatMap((scenario) => [false, true].map((reverse) => ({ scenario, reverse })))
  )(
    'matches native radio Tab stops: $scenario (reverse: $reverse)',
    async ({ scenario, reverse }) => {
      // C-AS-FOCUS-SCOPE-0002-H/J: fresh native/trapped instances, real keys,
      // unchanged selection. Unchecked groups have direction-dependent entry.
      const paths: string[][] = [];
      for (const trapped of [false, true]) {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
          await page.addScriptTag({ content: script });
          const initial = await page.evaluate(
            ({ artifact, scenario, trapped }) => {
              const p = (window as any).Closeout;
              const C = p.adapt(
                p.define({
                  name: 'radio-scope',
                  setup(def: any) {
                    const scope = p.asFocusScope();
                    scope.configure({ trap: true, loop: true, entry: 'manual' });
                    def.expose('activate', () => scope.activate());
                    return (r: any) => r.slot();
                  },
                }),
                { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
              );
              const scope = new C();
              scope.id = 'scope';
              scope.innerHTML =
                '<button id="before">Before</button><input id="a" type="radio" name="group"><input id="b" type="radio" name="group"><input id="c" type="radio" name="group"><button id="after">After</button>';
              const a = scope.querySelector('#a') as HTMLInputElement;
              const b = scope.querySelector('#b') as HTMLInputElement;
              if (scenario !== 'unchecked') a.checked = true;
              if (scenario === 'checked-second') b.checked = true;
              if (scenario === 'disabled-checked') a.disabled = true;
              if (scenario === 'hidden-checked') a.hidden = true;
              if (scenario === 'negative-checked') a.tabIndex = -1;
              if (scenario === 'programmatic-negative') {
                a.tabIndex = -1;
                b.checked = true;
              }
              document.body.append(scope);
              if (scenario === 'outside-checked') {
                const outside = document.createElement('input');
                outside.type = 'radio';
                outside.name = 'group';
                outside.checked = true;
                document.body.prepend(outside);
              }
              if (trapped) scope.getExposes().activate();
              return [...scope.querySelectorAll('input')].map((el: any) => el.checked);
            },
            { artifact: renderProtoShadowSplitStyleArtifact([]), scenario, trapped }
          );
          await page
            .locator(
              scenario === 'programmatic-negative'
                ? '#a'
                : scenario === 'focused-unchecked'
                  ? '#b'
                  : reverse
                    ? '#after'
                    : '#before'
            )
            .focus();
          const path: string[] = [];
          for (
            let i = 0;
            i <
            (['focused-unchecked', 'outside-checked', 'programmatic-negative'].includes(scenario)
              ? 1
              : 2);
            i++
          ) {
            await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
            path.push(await page.evaluate(() => document.activeElement!.id));
          }
          if (scenario === 'unchecked') {
            // Chrome remembers the last focused member even without selection.
            await page.keyboard.press(reverse ? 'Tab' : 'Shift+Tab');
            path.push(await page.evaluate(() => document.activeElement!.id));
          }
          expect(
            await page
              .locator('#scope input')
              .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).checked))
          ).toEqual(initial);
          expect(errors).toEqual([]);
          paths.push(path);
        } finally {
          await page.close();
        }
      }
      const radio =
        scenario === 'checked-second'
          ? 'b'
          : scenario === 'checked-first'
            ? 'a'
            : reverse
              ? 'c'
              : scenario === 'unchecked'
                ? 'a'
                : 'b';
      const expected =
        scenario === 'programmatic-negative'
          ? [reverse ? 'before' : 'b']
          : scenario === 'outside-checked'
            ? [reverse ? 'before' : 'after']
            : scenario === 'focused-unchecked'
              ? [reverse ? 'a' : 'after']
              : [radio, reverse ? 'before' : 'after'];
      if (scenario === 'unchecked') expected.push(radio);
      expect(paths[0]).toEqual(expected);
      expect(paths[1]).toEqual(paths[0]);
    }
  );

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
  it('does not let split-editor focus retries reclaim focus after the caller moves on', async () => {
    // FOCUS_REQUEST_FOCUS_CAP must decide success from the deepest composed
    // active element: a focused editor inside the split open ShadowRoot leaves
    // document.activeElement on the host, and a false "pending" verdict would
    // schedule retries that steal focus back.
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate((artifact) => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-split-editor-focus',
            modules: [
              p.declareTextControl({ content: 'plain-text', engine: 'host', lineMode: 'single' }),
            ],
            setup(def: any) {
              const control = p.asTextControl();
              const focusable = p.asFocusable();
              focusable.configure({ disabled: false });
              def.lifecycle.onCreated(() => {
                control.sync({ valueMode: 'uncontrolled', defaultValue: 'editor' });
              });
              def.expose('enter', () => focusable.focus());
              return () => null;
            },
          }),
          { shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact } }
        );
        const host = new C();
        const after = document.createElement('button');
        after.id = 'after';
        after.textContent = 'after';
        document.body.append(host, after);
        (window as any).__host = host;
      }, renderProtoShadowSplitStyleArtifact([]));
      await page.evaluate(() => (window as any).__host.getExposes().enter());
      const editorFocused = await page.evaluate(() => {
        const host = (window as any).__host;
        const editor = host.shadowRoot.querySelector('input,textarea');
        return !!editor && host.shadowRoot.activeElement === editor;
      });
      expect(editorFocused).toBe(true);
      await page.locator('#after').focus();
      // Outwait the layout-scheduled retry window; no retry may reclaim focus.
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('recovers trapped traversal from the remembered pointer focus after focus leaves the scope', async () => {
    // C-AS-FOCUS-SCOPE-0002-I: the scope remembers its most recent native
    // focus (pointer or programmatic), so a Tab after focus moved to the
    // document body resumes from that anchor instead of the first target.
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-scope-recovery',
            setup(def: any) {
              const scope = p.asFocusScope();
              scope.configure({ trap: true, loop: true, entry: 'manual' });
              def.expose('activate', () => scope.activate());
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const scope = new C();
        scope.id = 'recovery-scope';
        scope.innerHTML =
          '<button id="ra">A</button><button id="rb">B</button><button id="rc">C</button>';
        document.body.append(scope);
        (window as any).__scope = scope;
      });
      const active = () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return el?.id ?? null;
        });
      await page.evaluate(() => (window as any).__scope.getExposes().activate());
      await page.locator('#rb').click();
      expect(await active()).toBe('rb');
      // Move focus to a blank, non-scope target without deactivating the trap.
      await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
      });
      expect(await active()).toBe('');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('rc');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('rb');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

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

  it('reprojects a composed entry after external radio selection and form reset', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-live-radio-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const form = document.createElement('form');
        const host = new C();
        host.id = 'radio-entry';
        host.innerHTML =
          '<input id="inside-radio" type="radio" name="entry-group" checked><label for="inside-radio">Inside</label>';
        const outside = document.createElement('input');
        outside.id = 'outside-radio';
        outside.type = 'radio';
        outside.name = 'entry-group';
        const label = document.createElement('label');
        label.htmlFor = outside.id;
        label.textContent = 'Outside';
        form.append(host, outside, label);
        document.body.append(form);
      });
      const projection = () =>
        page.evaluate(() => {
          const host = document.querySelector<HTMLElement>('#radio-entry')!;
          return {
            hostTabIndex: host.getAttribute('tabindex'),
            inside: document.querySelector<HTMLInputElement>('#inside-radio')!.checked,
            outside: document.querySelector<HTMLInputElement>('#outside-radio')!.checked,
          };
        });
      expect(await projection()).toEqual({ hostTabIndex: null, inside: true, outside: false });

      await page.locator('#outside-radio').click();
      expect(await projection()).toEqual({ hostTabIndex: '0', inside: false, outside: true });

      await page.locator('#inside-radio').click();
      expect(await projection()).toEqual({ hostTabIndex: null, inside: true, outside: false });

      await page.locator('#outside-radio').click();
      await page.locator('form').evaluate((form: HTMLFormElement) => form.reset());
      await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(resolve)));
      expect(await projection()).toEqual({ hostTabIndex: null, inside: true, outside: false });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('continues trapped traversal around deep focus in a negative-tabindex shadow host', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-negative-host-scope',
            setup(def: any) {
              const scope = p.asFocusScope();
              scope.configure({ trap: true, loop: true, entry: 'manual' });
              def.expose('activate', () => scope.activate());
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const scope = new C();
        scope.id = 'negative-host-scope';
        scope.innerHTML =
          '<button id="before-negative">Before</button><div id="negative-host" tabindex="-1"></div><button id="after-negative">After</button>';
        const host = scope.querySelector('#negative-host') as HTMLElement;
        host.attachShadow({ mode: 'open' }).innerHTML =
          '<button id="deep-negative-focus">Deep</button>';
        document.body.append(scope);
        scope.getExposes().activate();
      });
      const focusDeep = () =>
        page.evaluate(() => {
          document
            .querySelector('#negative-host-scope')!
            .querySelector('#negative-host')!
            .shadowRoot!.querySelector<HTMLElement>('#deep-negative-focus')!
            .focus();
        });
      const active = () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return el?.id ?? null;
        });

      await focusDeep();
      expect(await active()).toBe('deep-negative-focus');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('after-negative');

      await focusDeep();
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('before-negative');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

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
