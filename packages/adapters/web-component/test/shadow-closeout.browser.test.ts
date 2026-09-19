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
        export { createShadowColorSchemeEnvironmentOwner as createEnvironment } from './packages/adapters/web-component/src/shadow-color-scheme-environment';
        export { createWebComponentPortalMount as createPortal } from './packages/adapters/web-component/src/portal-mount';
        export { createShadowSplitEffectsPort as createSplitEffects } from './packages/adapters/web-component/src/shadow-split-effects';
        export { AdaptToWebComponent as adapt } from './packages/adapters/web-component/src/adapt';
        export { definePrototype as define, tw } from '@proto.ui/core';
        export { createRootStyleEffect, lowerRootStyleTokens, resolveRootStyleEntry } from '@proto.ui/core/internal';
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
  it('binds a default Shadow environment to the host document and window', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        document.documentElement.dataset.theme = 'light';
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const foreignWindow = frame.contentWindow!;
        foreignDocument.documentElement.removeAttribute('data-theme');
        foreignDocument.documentElement.className = '';

        let matches = true;
        const listeners = new Set<() => void>();
        Object.defineProperty(foreignWindow, 'matchMedia', {
          configurable: true,
          value: () => ({
            get matches() {
              return matches;
            },
            addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
            removeEventListener: (_type: string, listener: () => void) =>
              listeners.delete(listener),
          }),
        });
        const host = foreignDocument.createElement('x-shadow-foreign-environment');
        foreignDocument.body.append(host);
        const owner = p.createEnvironment(host);
        const initial = {
          scheme: owner.colorScheme,
          marker: host.getAttribute('data-pui-color-scheme'),
        };

        matches = false;
        for (const listener of listeners) listener();
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const updated = {
          scheme: owner.colorScheme,
          marker: host.getAttribute('data-pui-color-scheme'),
        };
        owner.dispose();
        frame.remove();
        return { initial, updated };
      });
      expect(result).toEqual({
        initial: { scheme: 'dark', marker: 'dark' },
        updated: { scheme: 'light', marker: 'light' },
      });
    } finally {
      await page.close();
    }
  });

  it('rebinds only the default split environment during synchronous cross-document adoption', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(
        async (artifact) => {
          const p = (window as any).Closeout;
          const profile = { mode: 'open', presentation: 'split', styleArtifact: artifact };
          const createPrototype = (name: string) =>
            p.define({
              name,
              setup(def: any) {
                def.feedback.style.use(p.tw('block'));
                return (r: any) => r.slot();
              },
            });
          const settle = () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
          document.documentElement.dataset.theme = 'light';
          const frame = document.createElement('iframe');
          document.body.append(frame);
          const foreignDocument = frame.contentDocument!;
          foreignDocument.documentElement.dataset.theme = 'dark';

          const DefaultElement = p.adapt(createPrototype('closeout-default-adoption'), {
            shadow: profile,
            schedule: (task: () => void) => task(),
          });
          const defaultHost = new DefaultElement();
          document.body.append(defaultHost);
          await settle();
          const resources = (defaultHost as any)._splitResources;
          const environment = resources.environment;
          const source = environment.source;
          const surface = resources.surface;
          const artifactOwner = resources.artifact;

          foreignDocument.adoptNode(defaultHost);
          foreignDocument.body.append(defaultHost);
          await settle();
          const adoptedResources = (defaultHost as any)._splitResources;
          const adopted = {
            marker: defaultHost.getAttribute('data-pui-color-scheme'),
            resourcesRetained: adoptedResources === resources,
            environmentRetained: adoptedResources.environment === environment,
            surfaceRetained: adoptedResources.surface === surface,
            artifactRetained: adoptedResources.artifact === artifactOwner,
            sourceRebound: adoptedResources.environment.source !== source,
          };
          document.documentElement.dataset.theme = 'dark';
          await settle();
          const afterOldDocumentChange = defaultHost.getAttribute('data-pui-color-scheme');
          foreignDocument.documentElement.dataset.theme = 'light';
          await settle();
          const afterNewDocumentChange = defaultHost.getAttribute('data-pui-color-scheme');

          let explicitSubscriptions = 0;
          const explicitSource = {
            get: () => 'light',
            subscribe() {
              explicitSubscriptions += 1;
              return () => {};
            },
          };
          const ExplicitElement = p.adapt(createPrototype('closeout-explicit-adoption'), {
            shadow: { ...profile, colorSchemeSource: explicitSource },
            schedule: (task: () => void) => task(),
          });
          const explicitHost = new ExplicitElement();
          document.body.append(explicitHost);
          await settle();
          const explicitEnvironment = (explicitHost as any)._splitResources.environment;
          foreignDocument.adoptNode(explicitHost);
          foreignDocument.body.append(explicitHost);
          await settle();
          const explicit = {
            environmentRetained:
              (explicitHost as any)._splitResources.environment === explicitEnvironment,
            sourceRetained: explicitEnvironment.source === explicitSource,
            subscriptions: explicitSubscriptions,
            marker: explicitHost.getAttribute('data-pui-color-scheme'),
          };
          frame.remove();
          return { adopted, afterOldDocumentChange, afterNewDocumentChange, explicit };
        },
        renderProtoShadowSplitStyleArtifact(['block'])
      );
      expect(result).toEqual({
        adopted: {
          marker: 'dark',
          resourcesRetained: true,
          environmentRetained: true,
          surfaceRetained: true,
          artifactRetained: true,
          sourceRebound: true,
        },
        afterOldDocumentChange: 'dark',
        afterNewDocumentChange: 'light',
        explicit: {
          environmentRetained: true,
          sourceRetained: true,
          subscriptions: 1,
          marker: 'light',
        },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

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

  it('reprojects entries after external fieldset and image disclosure changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const createEntry = (name: string, shadow = true) =>
          p.adapt(
            p.define({
              name,
              setup() {
                p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
                return (r: any) => r.slot();
              },
            }),
            { shadow }
          );
        const settle = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          );

        const FieldsetEntry = createEntry('closeout-external-fieldset-entry');
        const fieldset = document.createElement('fieldset');
        const fieldsetHost = new FieldsetEntry();
        fieldsetHost.append(document.createElement('input'));
        fieldset.append(fieldsetHost);
        document.body.append(fieldset);

        const MapEntry = createEntry('closeout-external-map-entry', false);
        const mapHost = new MapEntry();
        mapHost.id = 'observed-map-entry';
        const map = document.createElement('map');
        map.name = 'closeout-observed-details-map';
        map.style.display = 'block';
        const area = document.createElement('area');
        area.id = 'observed-details-area';
        area.href = '#destination';
        area.tabIndex = 0;
        area.style.display = 'block';
        map.append(area);
        mapHost.append(map);
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const image = document.createElement('img');
        image.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        image.useMap = '#closeout-observed-details-map';
        details.append(summary, image);
        document.body.append(mapHost, details);
        await settle();

        const snapshot = () => ({
          fieldset: fieldsetHost.getAttribute('tabindex'),
          image: mapHost.getAttribute('tabindex'),
        });
        const initial = snapshot();
        fieldset.disabled = true;
        details.open = true;
        await settle();
        const changed = snapshot();
        const directOpen = p.sample(mapHost).targets.map((target: HTMLElement) => target.id);
        fieldset.disabled = false;
        details.open = false;
        await settle();
        const directClosed = p.sample(mapHost).targets.map((target: HTMLElement) => target.id);
        return { initial, changed, restored: snapshot(), directOpen, directClosed };
      });
      expect(result).toEqual({
        initial: { fieldset: null, image: '0' },
        changed: { fieldset: '0', image: null },
        restored: { fieldset: null, image: '0' },
        directOpen: ['observed-details-area'],
        directClosed: ['observed-map-entry'],
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry after CSS-only media-query eligibility changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width: 800, height: 600 });
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: '@media (max-width: 500px) { #css-only-entry-button { display: none; } }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-css-only-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'css-only-entry';
        host.innerHTML = '<button id="css-only-entry-button">Button</button>';
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = '.entry-outer-hidden { visibility: hidden; }';
        const outer = document.createElement('div');
        outer.append(document.createElement('slot'));
        root.append(style, outer);
        carrier.append(host);
        document.body.append(carrier);
        (window as any).__cssOnlyEntryOuter = outer;
        (window as any).__cssOnlyEntryStyle = style;
      });
      await page.waitForFunction(
        () => document.querySelector('#css-only-entry')?.getAttribute('tabindex') === null
      );

      const visibleBox = await page.locator('#css-only-entry-button').boundingBox();
      await page.evaluate(() => {
        (window as any).__cssOnlyEntryStyle.textContent = 'div { visibility: hidden; }';
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      await page.evaluate(() => {
        const replacement = document.createElement('style');
        replacement.textContent = '.entry-outer-hidden { visibility: hidden; }';
        (window as any).__cssOnlyEntryStyle.replaceWith(replacement);
        (window as any).__cssOnlyEntryStyle = replacement;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();
      await page.evaluate(() =>
        (window as any).__cssOnlyEntryOuter.classList.add('entry-outer-hidden')
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      await page.evaluate(() =>
        (window as any).__cssOnlyEntryOuter.classList.remove('entry-outer-hidden')
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (window as any).__cssGroupingRule = sheet.insertRule(
          '@media all {}',
          sheet.cssRules.length
        );
        const group = sheet.cssRules[(window as any).__cssGroupingRule] as CSSMediaRule;
        group.insertRule('#css-only-entry-button { visibility: hidden; }', 0);
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        const group = sheet.cssRules[(window as any).__cssGroupingRule] as CSSMediaRule;
        group.deleteRule(0);
        sheet.deleteRule((window as any).__cssGroupingRule);
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (window as any).__cssVisibilityRule = sheet.insertRule(
          '#css-only-entry-button { visibility: hidden; }',
          sheet.cssRules.length
        );
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      expect(await page.locator('#css-only-entry-button').boundingBox()).toEqual(visibleBox);
      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        sheet.deleteRule((window as any).__cssVisibilityRule);
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (window as any).__cssDeclarationRule = sheet.insertRule(
          '#css-only-entry-button {}',
          sheet.cssRules.length
        );
        (sheet.cssRules[(window as any).__cssDeclarationRule] as CSSStyleRule).style.visibility =
          'hidden';
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (sheet.cssRules[(window as any).__cssDeclarationRule] as CSSStyleRule).style.visibility =
          '';
        sheet.deleteRule((window as any).__cssDeclarationRule);
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (window as any).__cssDeclarationRule = sheet.insertRule(
          '#css-only-entry-button {}',
          sheet.cssRules.length
        );
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();
      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (sheet.cssRules[(window as any).__cssDeclarationRule] as CSSStyleRule).style.cssText =
          'visibility: hidden;';
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      expect(await page.locator('#css-only-entry-button').boundingBox()).toEqual(visibleBox);
      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (sheet.cssRules[(window as any).__cssDeclarationRule] as CSSStyleRule).style.cssText = '';
        sheet.deleteRule((window as any).__cssDeclarationRule);
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        (window as any).__cssOnlyRule = sheet.insertRule(
          '#css-only-entry-button { display: none; }',
          sheet.cssRules.length
        );
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');
      await page.evaluate(() => {
        const sheet = Array.from(document.styleSheets).at(-1) as CSSStyleSheet;
        sheet.deleteRule((window as any).__cssOnlyRule);
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();

      await page.setViewportSize({ width: 400, height: 600 });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBe('0');

      await page.setViewportSize({ width: 800, height: 600 });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      expect(await page.locator('#css-only-entry').getAttribute('tabindex')).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry when populated sheets are adopted into document and shadow roots', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-adopted-sheet-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );

        const documentHost = new C();
        documentHost.id = 'document-adopted-entry';
        documentHost.innerHTML = '<button id="document-adopted-button">Document</button>';

        const shadowHost = new C();
        shadowHost.id = 'shadow-adopted-entry';
        const carrier = document.createElement('div');
        carrier.id = 'adopted-sheet-carrier';
        carrier.attachShadow({ mode: 'open' }).innerHTML =
          '<button id="shadow-adopted-button">Shadow</button>';
        shadowHost.append(carrier);
        (window as any).__originalDocumentAdoptedSetter = Object.getOwnPropertyDescriptor(
          Document.prototype,
          'adoptedStyleSheets'
        )!.set;
        (window as any).__originalShadowAdoptedSetter = Object.getOwnPropertyDescriptor(
          ShadowRoot.prototype,
          'adoptedStyleSheets'
        )!.set;
        document.body.append(documentHost, shadowHost);
      });
      await page.waitForFunction(
        () =>
          document.querySelector('#document-adopted-entry')?.getAttribute('tabindex') === null &&
          document.querySelector('#shadow-adopted-entry')?.getAttribute('tabindex') === null
      );
      const settleStyles = () =>
        page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
      expect(
        await page.evaluate(
          () =>
            Object.getOwnPropertyDescriptor(Document.prototype, 'adoptedStyleSheets')!.set !==
            (window as any).__originalDocumentAdoptedSetter
        )
      ).toBe(true);
      expect(
        await page.evaluate(
          () =>
            Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'adoptedStyleSheets')!.set !==
            (window as any).__originalShadowAdoptedSetter
        )
      ).toBe(true);

      await page.evaluate(() => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('#document-adopted-button { visibility: hidden; }');
        (window as any).__documentAdoptedEntrySheet = sheet;
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      });
      await settleStyles();
      expect(await page.locator('#document-adopted-entry').getAttribute('tabindex')).toBe('0');
      expect(
        await page
          .locator('#document-adopted-button')
          .evaluate((el) => getComputedStyle(el).visibility)
      ).toBe('hidden');

      await page.evaluate(() => {
        const sheet = (window as any).__documentAdoptedEntrySheet as CSSStyleSheet;
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          (candidate) => candidate !== sheet
        );
      });
      await settleStyles();
      expect(await page.locator('#document-adopted-entry').getAttribute('tabindex')).toBeNull();

      await page.evaluate(() => {
        const root = document.querySelector('#adopted-sheet-carrier')!.shadowRoot!;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('#shadow-adopted-button { visibility: hidden; }');
        (window as any).__shadowAdoptedEntrySheet = sheet;
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      });
      await settleStyles();
      expect(await page.locator('#shadow-adopted-entry').getAttribute('tabindex')).toBe('0');
      expect(
        await page
          .locator('#adopted-sheet-carrier')
          .evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('button')!).visibility)
      ).toBe('hidden');

      await page.evaluate(() => {
        const root = document.querySelector('#adopted-sheet-carrier')!.shadowRoot!;
        const sheet = (window as any).__shadowAdoptedEntrySheet as CSSStyleSheet;
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
          (candidate) => candidate !== sheet
        );
      });
      await settleStyles();
      expect(await page.locator('#shadow-adopted-entry').getAttribute('tabindex')).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('uses rendered Light DOM eligibility for descendant entry fallback', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-light-rendered-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const host = new C();
        const button = document.createElement('button');
        host.append(button);
        document.body.append(host);
        const frame = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          );
        await frame();
        const visible = host.getAttribute('tabindex');
        button.style.visibility = 'hidden';
        await frame();
        const hidden = host.getAttribute('tabindex');
        button.style.visibility = '';
        await frame();
        return { visible, hidden, restored: host.getAttribute('tabindex') };
      });
      expect(result).toEqual({ visible: null, hidden: '0', restored: null });
    } finally {
      await page.close();
    }
  });

  it('rebuilds external entry ancestry after slot reassignment', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-slot-reassignment-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const hidden = document.createElement('div');
        hidden.inert = true;
        const hiddenSlot = document.createElement('slot');
        hiddenSlot.name = 'entry';
        hidden.append(hiddenSlot);
        const visibleSlot = document.createElement('slot');
        visibleSlot.name = 'visible';
        root.append(hidden, visibleSlot);
        const host = new C();
        host.slot = 'entry';
        host.innerHTML = '<button>inside</button>';
        carrier.append(host);
        document.body.append(carrier);
        const frame = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          );
        await frame();
        const hiddenState = host.getAttribute('tabindex');
        hiddenSlot.name = 'old';
        visibleSlot.name = 'entry';
        await frame();
        const visibleState = host.getAttribute('tabindex');
        visibleSlot.name = 'visible';
        hiddenSlot.name = 'entry';
        await frame();
        return {
          hiddenState,
          visibleState,
          hiddenAgain: host.getAttribute('tabindex'),
          assignedVisible: host.assignedSlot === hiddenSlot,
        };
      });
      expect(result).toEqual({
        hiddenState: '0',
        visibleState: null,
        hiddenAgain: '0',
        assignedVisible: true,
      });
    } finally {
      await page.close();
    }
  });

  it('samples native SVG links and explicit SVG tabindex targets', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const scope = document.createElement('div');
        scope.innerHTML =
          '<svg><a id="svg-link" href="#destination"><text>link</text></a><circle id="svg-circle" tabindex="0"></circle><rect id="svg-container"></rect></svg>';
        document.body.append(scope);
        return (window as any).Closeout.sample(scope).targets.map((el: Element) => el.id);
      });
      expect(result).toEqual(['svg-link', 'svg-circle']);
    } finally {
      await page.close();
    }
  });

  it('prunes a slotted scope through hidden flat-tree ancestors outside the container', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const hidden = document.createElement('div');
        hidden.id = 'flat-tree-hidden';
        const slot = document.createElement('slot');
        hidden.append(slot);
        root.append(hidden);
        const scope = document.createElement('div');
        scope.id = 'slotted-scope';
        scope.innerHTML = '<button id="slotted-inside" tabindex="0"></button>';
        carrier.append(scope);
        document.body.append(carrier);
        const sample = () =>
          (window as any).Closeout.sample(scope).targets.map((el: HTMLElement) => el.id);
        const visible = sample();
        hidden.setAttribute('inert', '');
        const inert = sample();
        hidden.removeAttribute('inert');
        hidden.style.contentVisibility = 'hidden';
        const skipped = sample();
        hidden.style.contentVisibility = '';
        return {
          assigned: scope.assignedSlot === slot,
          visible,
          inert,
          skipped,
          restored: sample(),
        };
      });
      expect(result).toEqual({
        assigned: true,
        visible: ['slotted-inside'],
        inert: [],
        skipped: [],
        restored: ['slotted-inside'],
      });
    } finally {
      await page.close();
    }
  });

  it('prunes a scope in closed details content while retaining the first summary branch', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const p = (window as any).Closeout;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const summaryScope = document.createElement('div');
        summaryScope.innerHTML = '<button id="summary-scope-button"></button>';
        summary.append(summaryScope);
        const contentScope = document.createElement('div');
        contentScope.innerHTML = '<button id="details-content-button"></button>';
        details.append(summary, contentScope);
        document.body.append(details);
        const sample = (scope: HTMLElement) =>
          p.sample(scope).targets.map((target: HTMLElement) => target.id);
        const closed = { summary: sample(summaryScope), content: sample(contentScope) };
        details.open = true;
        const open = sample(contentScope);
        details.open = false;
        return { closed, open, closedAgain: sample(contentScope) };
      });
      expect(result).toEqual({
        closed: { summary: ['summary-scope-button'], content: [] },
        open: ['details-content-button'],
        closedAgain: [],
      });
    } finally {
      await page.close();
    }
  });

  it('rejects conditional composite display before native split targets diverge', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(
        (artifact) => {
          const p = (window as any).Closeout;
          const host = document.createElement('x-conditional-composite-split');
          const root = host.attachShadow({ mode: 'open' });
          const style = document.createElement('style');
          style.textContent = artifact.cssText;
          const surface = document.createElement('div');
          root.append(style, surface);
          document.body.append(host);
          const effects = p.createSplitEffects({
            host,
            surface,
            artifact,
            prototypeName: 'conditional-composite',
          });
          effects.queueStyle(p.createRootStyleEffect([p.resolveRootStyleEntry('block', 'setup')]));
          effects.requestFlush();
          const snapshot = () => ({
            root: host.getAttribute('data-pui-split-root-style'),
            surface: surface.getAttribute('data-pui-style'),
            hostDisplay: getComputedStyle(host).display,
            surfaceDisplay: getComputedStyle(surface).display,
          });
          const before = snapshot();
          let error: string | null = null;
          try {
            effects.queueStyle(p.lowerRootStyleTokens(['inline-flex'], 'data-[open]'));
            effects.requestFlush();
          } catch (caught) {
            error = String(caught);
          }
          const after = snapshot();
          effects.dispose();
          return { before, after, error };
        },
        renderProtoShadowSplitStyleArtifact(['block', 'inline-flex', 'data-[open]:inline-flex'])
      );
      expect(result.error).toMatch(/conditional composite recipe is not implemented/);
      expect(result.after).toEqual(result.before);
      expect(result.before).toEqual({
        root: 'block',
        surface: 'block',
        hostDisplay: 'grid',
        surfaceDisplay: 'block',
      });
    } finally {
      await page.close();
    }
  });

  it('preserves logical split padding axes in a vertical writing mode', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(
        ({ artifact, documentCss }) => {
          const p = (window as any).Closeout;
          const documentStyle = document.createElement('style');
          documentStyle.textContent = documentCss;
          document.head.append(documentStyle);
          const carrier = document.createElement('div');
          carrier.style.writingMode = 'vertical-rl';
          const reference = document.createElement('div');
          reference.textContent = 'Logical';
          reference.setAttribute('data-pui-style', 'inline-flex border px-2 py-1');
          const host = document.createElement('x-writing-mode-split');
          const root = host.attachShadow({ mode: 'open' });
          const shadowStyle = document.createElement('style');
          shadowStyle.textContent = artifact.cssText;
          const surface = document.createElement('div');
          surface.textContent = 'Logical';
          root.append(shadowStyle, surface);
          carrier.append(reference, host);
          document.body.append(carrier);
          const effects = p.createSplitEffects({
            host,
            surface,
            artifact,
            prototypeName: 'writing',
          });
          const tokens = ['inline-flex', 'border', 'px-2', 'py-1'];
          effects.queueStyle(
            p.createRootStyleEffect(
              tokens.map((token: string) => p.resolveRootStyleEntry(token, 'setup'))
            )
          );
          effects.requestFlush();
          const rect = (element: Element) => {
            const box = element.getBoundingClientRect();
            return { width: box.width, height: box.height };
          };
          const hostStyle = getComputedStyle(host);
          const surfaceStyle = getComputedStyle(surface);
          const geometry = { reference: rect(reference), host: rect(host), surface: rect(surface) };
          const modes = [getComputedStyle(host).writingMode, getComputedStyle(surface).writingMode];
          const metrics = {
            host: [
              hostStyle.paddingTop,
              hostStyle.paddingRight,
              hostStyle.paddingBottom,
              hostStyle.paddingLeft,
            ],
            surface: [
              surfaceStyle.marginTop,
              surfaceStyle.marginRight,
              surfaceStyle.marginBottom,
              surfaceStyle.marginLeft,
            ],
          };
          effects.dispose();
          return { geometry, modes, metrics };
        },
        {
          artifact: renderProtoShadowSplitStyleArtifact(['inline-flex', 'border', 'px-2', 'py-1']),
          documentCss: renderProtoStyleTokenCss(['inline-flex', 'border', 'px-2', 'py-1']),
        }
      );
      expect(result.modes).toEqual(['vertical-rl', 'vertical-rl']);
      expect(result.metrics).toEqual({
        host: ['8px', '4px', '8px', '4px'],
        surface: ['-9px', '-5px', '-9px', '-5px'],
      });
      expect(result.geometry.host).toEqual(result.geometry.reference);
      expect(result.geometry.surface).toEqual(result.geometry.reference);
    } finally {
      await page.close();
    }
  });

  it('applies conditional native text padding only to the editor surface', async () => {
    const page = await browser.newPage();
    try {
      const result = await page.evaluate(
        (artifact) => {
          const host = document.createElement('x-native-padding-split');
          host.setAttribute('data-pui-split-root-style', 'data-[invalid]:p-4');
          host.setAttribute('data-pui-split-text-control', '');
          host.setAttribute('data-invalid', '');
          const root = host.attachShadow({ mode: 'open' });
          const style = document.createElement('style');
          style.textContent = artifact.cssText;
          const input = document.createElement('input');
          input.setAttribute('data-pui-split-surface', '');
          input.setAttribute('data-pui-style', 'data-[invalid]:p-4');
          root.append(style, input);
          document.body.append(host);
          const hostStyle = getComputedStyle(host);
          const inputStyle = getComputedStyle(input);
          return {
            hostPadding: [
              hostStyle.paddingTop,
              hostStyle.paddingRight,
              hostStyle.paddingBottom,
              hostStyle.paddingLeft,
            ],
            inputPadding: [
              inputStyle.paddingTop,
              inputStyle.paddingRight,
              inputStyle.paddingBottom,
              inputStyle.paddingLeft,
            ],
          };
        },
        renderProtoShadowSplitStyleArtifact(['data-[invalid]:p-4'])
      );
      expect(result).toEqual({
        hostPadding: ['0px', '0px', '0px', '0px'],
        inputPadding: ['16px', '16px', '16px', '16px'],
      });
    } finally {
      await page.close();
    }
  });

  it('excludes an image-map area when its associated slotted image is not rendered', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const scope = document.createElement('div');
        scope.innerHTML =
          '<map name="slotted-map" style="display:block"><area id="slotted-area" href="#a" tabindex="0" style="display:block"></map>';
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const wrapper = document.createElement('div');
        const slot = document.createElement('slot');
        wrapper.append(slot);
        root.append(wrapper);
        const image = document.createElement('img');
        image.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        image.useMap = '#slotted-map';
        carrier.append(image);
        document.body.append(scope, carrier);
        const sample = () =>
          (window as any).Closeout.sample(scope).targets.map((el: HTMLElement) => el.id);
        const visible = sample();
        wrapper.hidden = true;
        const hidden = sample();
        wrapper.hidden = false;
        return { assigned: image.assignedSlot === slot, visible, hidden, restored: sample() };
      });
      expect(result).toEqual({
        assigned: true,
        visible: ['slotted-area'],
        hidden: [],
        restored: ['slotted-area'],
      });
    } finally {
      await page.close();
    }
  });

  it('excludes an image-map area while its external image is in closed details content', async () => {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const scope = document.createElement('div');
        scope.innerHTML =
          '<map name="details-map" style="display:block"><area id="details-area" href="#destination" tabindex="0" style="display:block"></map>';
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'summary';
        const image = document.createElement('img');
        image.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        image.useMap = '#details-map';
        details.append(summary, image);
        document.body.append(scope, details);
        const sample = () =>
          (window as any).Closeout.sample(scope).targets.map((el: HTMLElement) => el.id);
        const closed = sample();
        details.open = true;
        const open = sample();
        details.open = false;
        summary.append(image);
        return { closed, open, summary: sample() };
      });
      expect(result).toEqual({ closed: [], open: ['details-area'], summary: ['details-area'] });
    } finally {
      await page.close();
    }
  });

  it('samples and resolves adopted focus descendants in their owning iframe realm', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-adopted-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const host = foreignDocument.adoptNode(new C());
        host.id = 'adopted-entry';
        const button = foreignDocument.createElement('button');
        button.id = 'foreign-button';
        button.textContent = 'Foreign';
        const details = foreignDocument.createElement('details');
        const summary = foreignDocument.createElement('summary');
        summary.id = 'foreign-summary';
        summary.textContent = 'Summary';
        const closedInput = foreignDocument.createElement('input');
        closedInput.id = 'foreign-closed-input';
        details.append(summary, closedInput);
        const firstRadio = foreignDocument.createElement('input');
        firstRadio.id = 'foreign-radio-a';
        firstRadio.type = 'radio';
        firstRadio.name = 'foreign-group';
        const checkedRadio = foreignDocument.createElement('input');
        checkedRadio.id = 'foreign-radio-b';
        checkedRadio.type = 'radio';
        checkedRadio.name = 'foreign-group';
        checkedRadio.checked = true;
        const foreignShadowHost = foreignDocument.createElement('div');
        const foreignShadowButton = foreignDocument.createElement('button');
        foreignShadowButton.id = 'foreign-shadow-button';
        foreignShadowHost.attachShadow({ mode: 'open' }).append(foreignShadowButton);
        host.append(button, details, firstRadio, checkedRadio, foreignShadowHost);
        foreignDocument.body.append(host);
        await new Promise<void>((resolve) =>
          frame.contentWindow!.requestAnimationFrame(() => resolve())
        );
        const sample = p.sample(host);
        const observed = {
          targets: sample.targets.map((target: HTMLElement) => target.id),
          fallback: host.getAttribute('tabindex'),
          ownerMatches: button.ownerDocument === foreignDocument,
        };
        frame.remove();
        return observed;
      });
      expect(result).toEqual({
        targets: ['foreign-button', 'foreign-summary', 'foreign-radio-b', 'foreign-shadow-button'],
        fallback: null,
        ownerMatches: true,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects an adopted radio entry after foreign-realm checkedness changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-adopted-radio-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const host = foreignDocument.adoptNode(new C());
        const inside = foreignDocument.createElement('input');
        inside.type = 'radio';
        inside.name = 'foreign-entry-group';
        const outside = foreignDocument.createElement('input');
        outside.type = 'radio';
        outside.name = 'foreign-entry-group';
        outside.checked = true;
        const form = foreignDocument.createElement('form');
        host.append(inside);
        form.append(host, outside);
        foreignDocument.body.append(form);
        await new Promise<void>((resolve) =>
          frame.contentWindow!.requestAnimationFrame(() => resolve())
        );
        const initial = host.getAttribute('tabindex');
        inside.click();
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const updated = host.getAttribute('tabindex');
        const checked = [inside.checked, outside.checked];
        frame.remove();
        return { initial, updated, checked };
      });
      expect(result).toEqual({ initial: '0', updated: null, checked: [true, false] });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reclaims a portal whose origin host leaves a foreign ShadowRoot', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const carrier = foreignDocument.createElement('div');
        const origin = carrier.attachShadow({ mode: 'open' });
        const parent = foreignDocument.createElement('section');
        const portal = foreignDocument.createElement('div');
        origin.append(parent);
        parent.append(portal);
        foreignDocument.body.append(carrier);
        const mount = p.createPortal();
        mount.mount(portal);
        const mounted = foreignDocument.body.lastElementChild === portal;
        carrier.remove();
        await new Promise<void>((resolve) =>
          frame.contentWindow!.requestAnimationFrame(() => resolve())
        );
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const reclaimed = !portal.isConnected && origin.contains(portal);
        mount.unmount(portal);
        frame.remove();
        return { mounted, reclaimed };
      });
      expect(result).toEqual({ mounted: true, reclaimed: true });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects a composed radio entry after its form owner changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-radio-form-owner-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const formA = document.createElement('form');
        formA.id = 'form-a';
        const formB = document.createElement('form');
        formB.id = 'form-b';
        const host = new C();
        host.id = 'radio-form-entry';
        host.innerHTML =
          '<input id="inside-form-radio" type="radio" name="entry-group" form="form-a">';
        const outside = document.createElement('input');
        outside.type = 'radio';
        outside.name = 'entry-group';
        outside.setAttribute('form', 'form-a');
        outside.checked = true;
        document.body.append(formA, formB, host, outside);
      });
      const hostTabIndex = () =>
        page.locator('#radio-form-entry').evaluate((host) => host.getAttribute('tabindex'));
      expect(await hostTabIndex()).toBe('0');

      await page
        .locator('#inside-form-radio')
        .evaluate((radio) => radio.setAttribute('form', 'form-b'));
      await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(resolve)));
      expect(await hostTabIndex()).toBeNull();

      await page
        .locator('#inside-form-radio')
        .evaluate((radio) => radio.setAttribute('form', 'form-a'));
      await page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(resolve)));
      expect(await hostTabIndex()).toBe('0');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects a composed radio entry after external group membership changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-external-radio-membership-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const formA = document.createElement('form');
        formA.id = 'external-radio-form-a';
        const formB = document.createElement('form');
        formB.id = 'external-radio-form-b';
        const host = new C();
        host.id = 'external-radio-membership-entry';
        host.innerHTML =
          '<input id="inside-membership-radio" type="radio" name="entry-group" form="external-radio-form-a">';
        const outside = document.createElement('input');
        outside.id = 'outside-membership-radio';
        outside.type = 'radio';
        outside.name = 'entry-group';
        outside.setAttribute('form', formA.id);
        outside.checked = true;
        document.body.append(formA, formB, host, outside);
      });
      const hostTabIndex = () =>
        page
          .locator('#external-radio-membership-entry')
          .evaluate((host) => host.getAttribute('tabindex'));
      const settle = () =>
        page.evaluate(() => new Promise<void>((resolve) => queueMicrotask(resolve)));
      expect(await hostTabIndex()).toBe('0');

      await page
        .locator('#outside-membership-radio')
        .evaluate((radio) => radio.setAttribute('name', 'other-group'));
      await settle();
      expect(await hostTabIndex()).toBeNull();

      await page
        .locator('#outside-membership-radio')
        .evaluate((radio) => radio.setAttribute('name', 'entry-group'));
      await settle();
      expect(await hostTabIndex()).toBe('0');

      await page
        .locator('#outside-membership-radio')
        .evaluate((radio) => radio.setAttribute('form', 'external-radio-form-b'));
      await settle();
      expect(await hostTabIndex()).toBeNull();

      await page
        .locator('#outside-membership-radio')
        .evaluate((radio) => radio.setAttribute('form', 'external-radio-form-a'));
      await settle();
      expect(await hostTabIndex()).toBe('0');

      await page.locator('#outside-membership-radio').evaluate((radio) => radio.remove());
      await settle();
      expect(await hostTabIndex()).toBeNull();

      await page.evaluate(() => {
        const outside = document.createElement('input');
        outside.id = 'outside-membership-radio-replacement';
        outside.type = 'radio';
        outside.name = 'entry-group';
        outside.setAttribute('form', 'external-radio-form-a');
        outside.checked = true;
        document.body.append(outside);
      });
      await settle();
      expect(await hostTabIndex()).toBe('0');
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
          '<button id="deep-negative-focus">Deep</button><svg><a id="deep-negative-focus-svg" href="#destination" tabindex="0"><text>Deep SVG</text></a></svg>';
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

      await page.evaluate(() => {
        (
          document
            .querySelector('#negative-host-scope')!
            .querySelector('#negative-host')!
            .shadowRoot!.querySelector('#deep-negative-focus-svg') as SVGElement
        ).focus();
      });
      expect(await active()).toBe('deep-negative-focus-svg');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('after-negative');

      await page.evaluate(() => {
        (
          document
            .querySelector('#negative-host-scope')!
            .querySelector('#negative-host')!
            .shadowRoot!.querySelector('#deep-negative-focus-svg') as SVGElement
        ).focus();
      });
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

  it('keeps a projected self-entry container in trapped forward and reverse traversal', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-self-entry-scope',
            setup(def: any) {
              const scope = p.asFocusScope();
              scope.configure({ trap: true, loop: true, entry: 'manual' });
              p.asFocusEntry().configure({ strategy: 'self', fallback: 'self' });
              def.expose('activate', () => scope.activate());
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const scope = new C();
        scope.id = 'self-entry-scope';
        scope.innerHTML = '<button id="self-entry-child">Child</button>';
        document.body.append(scope);
      });
      await page.waitForFunction(
        () => document.querySelector('#self-entry-scope')?.getAttribute('tabindex') === '0'
      );
      await page.locator('#self-entry-scope').evaluate((scope: any) => {
        scope.getExposes().activate();
        scope.focus();
      });
      const active = () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return el?.id;
        });
      expect(await active()).toBe('self-entry-scope');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('self-entry-child');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('self-entry-scope');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('self-entry-child');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('self-entry-scope');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
