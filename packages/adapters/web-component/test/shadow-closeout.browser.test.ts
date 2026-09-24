// @vitest-environment node
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../../../cli/src/generated/brutalist-style-tokens';

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
        export { getLogicalParent, getProtoParent } from './packages/adapters/web-component/src/platform/instance-tree';
        export { definePrototype as define, tw } from '@proto.ui/core';
        export { createRootStyleEffect, lowerRootStyleTokens, resolveRootStyleEntry } from '@proto.ui/core/internal';
        export { asTextControl, asFocusEntry, asFocusScope, asFocusable, asOverlay } from '@proto.ui/hooks';
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
  it.each([
    ['shadcn', SHADCN_STYLE_TOKENS],
    ['brutalist', BRUTALIST_STYLE_TOKENS],
  ] as const)(
    'styles a Template descendant from the %s preset Shadow closure',
    async (_name, tokens) => {
      const page = await browser.newPage();
      try {
        const display = await page.evaluate((artifact) => {
          const host = document.createElement('div');
          const root = host.attachShadow({ mode: 'open' });
          const style = document.createElement('style');
          style.textContent = artifact.cssText;
          const descendant = document.createElement('span');
          descendant.setAttribute('data-pui-style', 'block');
          root.append(style, descendant);
          document.body.append(host);
          return getComputedStyle(descendant).display;
        }, renderProtoShadowSplitStyleArtifact(tokens));
        expect(display).toBe('block');
      } finally {
        await page.close();
      }
    }
  );

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
          const foreignWindow = frame.contentWindow!;
          foreignDocument.documentElement.dataset.theme = 'dark';
          let sourceReducedMotion = false;
          let destinationReducedMotion = true;
          const media = (matches: () => boolean) => (query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)' ? matches() : false,
            addEventListener() {},
            removeEventListener() {},
          });
          Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: media(() => sourceReducedMotion),
          });
          Object.defineProperty(foreignWindow, 'matchMedia', {
            configurable: true,
            value: media(() => destinationReducedMotion),
          });

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
          const initialReducedMotion = resources.getMeta('reducedMotion');

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
            reducedMotion: adoptedResources.getMeta('reducedMotion'),
          };
          sourceReducedMotion = true;
          const afterSourceReducedMotionChange = adoptedResources.getMeta('reducedMotion');
          destinationReducedMotion = false;
          const afterDestinationReducedMotionChange = adoptedResources.getMeta('reducedMotion');
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
            getMeta: (key: string) =>
              key === 'reducedMotion' ? 'explicit-reduced-motion' : undefined,
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
            reducedMotion: (explicitHost as any)._splitResources.getMeta('reducedMotion'),
          };
          frame.remove();
          return {
            initialReducedMotion,
            adopted,
            afterSourceReducedMotionChange,
            afterDestinationReducedMotionChange,
            afterOldDocumentChange,
            afterNewDocumentChange,
            explicit,
          };
        },
        renderProtoShadowSplitStyleArtifact(['block'])
      );
      expect(result).toEqual({
        initialReducedMotion: 'no-preference',
        adopted: {
          marker: 'dark',
          resourcesRetained: true,
          environmentRetained: true,
          surfaceRetained: true,
          artifactRetained: true,
          sourceRebound: true,
          reducedMotion: 'reduce',
        },
        afterSourceReducedMotionChange: 'reduce',
        afterDestinationReducedMotionChange: 'no-preference',
        afterOldDocumentChange: 'dark',
        afterNewDocumentChange: 'light',
        explicit: {
          environmentRetained: true,
          sourceRetained: true,
          subscriptions: 1,
          marker: 'light',
          reducedMotion: 'explicit-reduced-motion',
        },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('rebinds the default non-split color Rule source with its adopted document', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        document.documentElement.dataset.theme = 'light';
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        foreignDocument.documentElement.dataset.theme = 'dark';
        const C = p.adapt(
          p.define({
            name: 'closeout-default-meta-adoption',
            setup(def: any) {
              def.props.define({ enabled: { type: 'boolean', default: true } });
              def.feedback.style.use(p.tw('bg-primary'));
              def.rule({
                when: (w: any) =>
                  w.all(w.prop('enabled').eq(true), w.meta('colorScheme').eq('dark')),
                intent: (i: any) => i.feedback.style.use(p.tw('bg-black')),
              });
              return (r: any) => r.slot();
            },
          }),
          { schedule: (task: () => void) => task() }
        );
        const host = new C();
        document.body.append(host);
        const settle = async () => {
          await new Promise<void>((resolve) => queueMicrotask(resolve));
          await new Promise<void>((resolve) => queueMicrotask(resolve));
        };
        await settle();
        const initial = host.getAttribute('data-pui-style');
        foreignDocument.adoptNode(host);
        foreignDocument.body.append(host);
        await settle();
        const adopted = host.getAttribute('data-pui-style');
        document.documentElement.dataset.theme = 'dark';
        await settle();
        const afterSourceChange = host.getAttribute('data-pui-style');
        foreignDocument.documentElement.dataset.theme = 'light';
        await settle();
        const afterDestinationChange = host.getAttribute('data-pui-style');
        frame.remove();
        return { initial, adopted, afterSourceChange, afterDestinationChange };
      });
      expect(result).toEqual({
        initial: 'bg-primary',
        adopted: 'bg-black',
        afterSourceChange: 'bg-black',
        afterDestinationChange: 'bg-primary',
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('refreshes adopted logical ancestry through a destination-realm ShadowRoot', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        let childSetups = 0;
        const Parent = p.adapt(
          p.define({ name: 'closeout-adopted-logical-parent', setup: () => (r: any) => r.slot() })
        );
        const Child = p.adapt(
          p.define({
            name: 'closeout-adopted-logical-child',
            setup() {
              childSetups += 1;
              return (r: any) => r.slot();
            },
          })
        );
        const oldParent = new Parent();
        const child = new Child();
        oldParent.append(child);
        document.body.append(oldParent);

        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const nextParent = foreignDocument.adoptNode(new Parent());
        foreignDocument.body.append(nextParent);
        const carrier = foreignDocument.createElement('div');
        nextParent.append(carrier);
        const destinationRoot = carrier.attachShadow({ mode: 'open' });
        const childToken = (child as any)._instanceToken;
        const nextToken = (nextParent as any)._instanceToken;
        const adoptedChild = foreignDocument.adoptNode(child);
        const adopted = {
          parent: p.getProtoParent(child),
          logical: p.getLogicalParent(childToken),
        };
        destinationRoot.append(adoptedChild);
        const nested = {
          parent: p.getProtoParent(child) === nextParent,
          logical: p.getLogicalParent(childToken) === nextToken,
          destinationRealm: destinationRoot.ownerDocument === foreignDocument,
          setups: childSetups,
        };
        frame.remove();
        return {
          adopted: {
            parent: adopted.parent === null,
            logical: adopted.logical === null,
          },
          nested,
        };
      });
      expect(result).toEqual({
        adopted: { parent: true, logical: true },
        nested: { parent: true, logical: true, destinationRealm: true, setups: 1 },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('clears and rebinds logical ancestry during ordinary same-document reparenting', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const p = (window as any).Closeout;
        const Parent = p.adapt(
          p.define({ name: 'closeout-reparent-owner', setup: () => (r: any) => r.slot() })
        );
        const Child = p.adapt(
          p.define({ name: 'closeout-reparent-child', setup: () => (r: any) => r.slot() })
        );
        const first = new Parent();
        const second = new Parent();
        const plain = document.createElement('div');
        const child = new Child();
        first.append(child);
        document.body.append(first, plain, second);
        const childToken = (child as any)._instanceToken;
        const initial = p.getLogicalParent(childToken) === (first as any)._instanceToken;

        plain.append(child);
        const cleared = p.getLogicalParent(childToken) === null;

        second.append(child);
        const rebound = p.getLogicalParent(childToken) === (second as any)._instanceToken;
        return { initial, cleared, rebound };
      });
      expect(result).toEqual({ initial: true, cleared: true, rebound: true });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('routes portal input through the current Window after connected cross-document adoption', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        let setups = 0;
        let presses = 0;
        let keys = 0;
        const C = p.adapt(
          p.define({
            name: 'closeout-adopted-portal-event-route',
            setup(def: any) {
              setups += 1;
              def.event.on('press.commit', () => presses++);
              def.event.onGlobal('key.down', () => keys++);
              def.expose('snapshot', () => ({ setups, presses, keys }));
              return (r: any) => r.slot();
            },
          })
        );
        const host = new C();
        const button = document.createElement('button');
        button.textContent = 'Press';
        host.append(button);
        document.body.append(host);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const portal = p.createPortal();
        portal.mount(button);
        button.click();
        const beforeAdoption = host.getExposes().snapshot();
        portal.unmount(button);

        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const foreignWindow = frame.contentWindow!;
        foreignDocument.adoptNode(host);
        foreignDocument.body.append(host);
        const destinationButton = foreignDocument.createElement('button');
        destinationButton.textContent = 'Destination press';
        host.append(destinationButton);
        portal.mount(destinationButton);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));
        const afterOldWindow = host.getExposes().snapshot();
        foreignWindow.dispatchEvent(
          new (foreignWindow as any).KeyboardEvent('keydown', { key: 'A' })
        );
        const afterNewWindow = host.getExposes().snapshot();
        destinationButton.click();
        const afterAdoption = host.getExposes().snapshot();
        const projectedIntoCurrentBody = destinationButton.parentElement === foreignDocument.body;

        portal.unmount(destinationButton);
        frame.remove();
        return {
          beforeAdoption,
          afterOldWindow,
          afterNewWindow,
          afterAdoption,
          projectedIntoCurrentBody,
        };
      });
      expect(result).toEqual({
        beforeAdoption: { setups: 1, presses: 1, keys: 0 },
        afterOldWindow: { setups: 1, presses: 1, keys: 0 },
        afterNewWindow: { setups: 1, presses: 1, keys: 1 },
        afterAdoption: { setups: 1, presses: 2, keys: 1 },
        projectedIntoCurrentBody: true,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('moves modal body-lock ownership across connected cross-document adoption', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        let setups = 0;
        const C = p.adapt(
          p.define({
            name: 'closeout-adopted-modal-lock',
            setup(def: any) {
              setups += 1;
              const overlay = p.asOverlay();
              overlay.keepMounted();
              overlay.configure({ modal: true, portal: false });
              def.expose('open', () => overlay.openOverlay('programmatic'));
              def.expose('close', () => overlay.close('programmatic'));
              def.expose('setups', () => setups);
              return (r: any) => r.slot();
            },
          })
        );
        const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;

        const closed = new C();
        document.body.append(closed);
        await settle();
        foreignDocument.adoptNode(closed);
        foreignDocument.body.append(closed);
        closed.getExposes().open();
        await settle();
        const afterClosedAdoption = {
          oldBody: document.body.style.overflow,
          newBody: foreignDocument.body.style.overflow,
          setups: closed.getExposes().setups(),
        };
        closed.getExposes().close();
        await settle();

        const open = new C();
        document.body.append(open);
        await settle();
        open.getExposes().open();
        await settle();
        const beforeOpenAdoption = {
          oldBody: document.body.style.overflow,
          newBody: foreignDocument.body.style.overflow,
        };
        foreignDocument.adoptNode(open);
        foreignDocument.body.append(open);
        await settle();
        const afterOpenAdoption = {
          oldBody: document.body.style.overflow,
          newBody: foreignDocument.body.style.overflow,
          setups: open.getExposes().setups(),
        };
        open.getExposes().close();
        await settle();
        const afterClose = {
          oldBody: document.body.style.overflow,
          newBody: foreignDocument.body.style.overflow,
        };
        frame.remove();
        return { afterClosedAdoption, beforeOpenAdoption, afterOpenAdoption, afterClose };
      });
      expect(result).toEqual({
        afterClosedAdoption: { oldBody: '', newBody: 'hidden', setups: 1 },
        beforeOpenAdoption: { oldBody: 'hidden', newBody: '' },
        afterOpenAdoption: { oldBody: '', newBody: 'hidden', setups: 2 },
        afterClose: { oldBody: '', newBody: '' },
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

  it.each([false, true])(
    'recovers trapped traversal from remembered programmatic-only focus (reverse: %s)',
    async (reverse) => {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.addScriptTag({ content: script });
        await page.evaluate(() => {
          const p = (window as any).Closeout;
          const C = p.adapt(
            p.define({
              name: 'closeout-programmatic-history-scope',
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
          scope.id = 'programmatic-history-scope';
          scope.innerHTML =
            '<button id="pha">A</button><button id="phb" tabindex="-1">B</button><button id="phc">C</button>';
          document.body.append(scope);
          (window as any).__scope = scope;
        });
        await page.evaluate(() => (window as any).__scope.getExposes().activate());
        await page.locator('#phb').focus();
        await page.evaluate(() => {
          document.body.tabIndex = -1;
          document.body.focus();
        });
        await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
        expect(await page.evaluate(() => document.activeElement?.id)).toBe(reverse ? 'pha' : 'phc');
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
  );

  it('recovers trapped forward and reverse traversal from remembered SVG focus', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-svg-scope-recovery',
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
        scope.id = 'svg-recovery-scope';
        scope.innerHTML =
          '<button id="svg-recovery-before">Before</button><svg><a id="svg-recovery-link" href="#destination" tabindex="0"><text>SVG</text></a></svg><button id="svg-recovery-after">After</button>';
        document.body.append(scope);
        scope.getExposes().activate();
      });
      const active = () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return el?.id ?? null;
        });
      const focusSvgThenBlank = async () => {
        await page.locator('#svg-recovery-link').focus();
        expect(await active()).toBe('svg-recovery-link');
        await page.evaluate(() => {
          document.body.tabIndex = -1;
          document.body.focus();
        });
        expect(await active()).toBe('');
      };

      await focusSvgThenBlank();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('svg-recovery-after');

      await focusSvgThenBlank();
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('svg-recovery-before');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('skips a sampled target whose native focus request is rejected', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        customElements.define(
          'closeout-rejected-focus',
          class extends HTMLElement {
            focus() {}
          }
        );
        const C = p.adapt(
          p.define({
            name: 'closeout-rejected-focus-scope',
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
        scope.id = 'rejected-focus-scope';
        scope.innerHTML =
          '<closeout-rejected-focus id="rejected-focus" tabindex="0"></closeout-rejected-focus><button id="accepted-focus">Accepted</button>';
        document.body.append(scope);
        document.body.tabIndex = -1;
        document.body.focus();
        scope.getExposes().activate();
      });

      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('accepted-focus');
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

  it('reprojects a checkbox-dependent entry after its form resets', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: '#reset-checkbox:checked + button { visibility: hidden; }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-reset-checkbox-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const form = document.createElement('form');
        const host = new C();
        host.id = 'reset-checkbox-entry';
        host.innerHTML =
          '<input id="reset-checkbox" type="checkbox" tabindex="-1"><button id="reset-dependent">Target</button>';
        form.append(host);
        document.body.append(form);
      });
      const tabIndex = () =>
        page.locator('#reset-checkbox-entry').evaluate((host) => host.getAttribute('tabindex'));
      expect(await tabIndex()).toBeNull();
      await page.locator('#reset-checkbox').click();
      await expect.poll(tabIndex).toBe('0');
      await page.locator('form').evaluate((form: HTMLFormElement) => form.reset());
      await expect.poll(tabIndex).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects radio entries after in-entry checked and form-id attributes change', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-radio-attribute-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const checkedHost = new C();
        checkedHost.id = 'checked-attribute-entry';
        checkedHost.innerHTML = '<input id="checked-inside" type="radio" name="checked-group">';
        const checkedOutside = document.createElement('input');
        checkedOutside.type = 'radio';
        checkedOutside.name = 'checked-group';
        checkedOutside.checked = true;

        const formHost = new C();
        formHost.id = 'form-id-entry';
        formHost.innerHTML = '<form id="entry-form"><input type="radio" name="form-group"></form>';
        const formOutside = document.createElement('input');
        formOutside.type = 'radio';
        formOutside.name = 'form-group';
        formOutside.setAttribute('form', 'entry-form');
        formOutside.checked = true;
        document.body.append(checkedHost, checkedOutside, formHost, formOutside);
      });
      await page.waitForFunction(
        () =>
          document.querySelector('#checked-attribute-entry')?.getAttribute('tabindex') === '0' &&
          document.querySelector('#form-id-entry')?.getAttribute('tabindex') === '0'
      );

      await page.locator('#checked-inside').evaluate((radio) => radio.setAttribute('checked', ''));
      await page.locator('#entry-form').evaluate((form) => {
        form.id = 'renamed-entry-form';
      });
      await page.waitForFunction(
        () =>
          document.querySelector('#checked-attribute-entry')?.getAttribute('tabindex') === null &&
          document.querySelector('#form-id-entry')?.getAttribute('tabindex') === null
      );
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

  it('reprojects descendant entry at a native visibility transition endpoint', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: `
          #transition-entry button { transition: visibility 80ms linear; }
          #transition-entry.conceal button { visibility: hidden; }
        `,
      });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-transition-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          })
        );
        const host = new C();
        host.id = 'transition-entry';
        const button = document.createElement('button');
        button.textContent = 'Transition target';
        host.append(button);
        document.body.append(host);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const completed = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('visibility transition timeout')),
            1000
          );
          button.addEventListener(
            'transitionend',
            (event) => {
              if (event.propertyName !== 'visibility') return;
              clearTimeout(timeout);
              resolve(event.propertyName);
            },
            { once: true }
          );
        });
        host.classList.add('conceal');
        const start = {
          visibility: getComputedStyle(button).visibility,
          hostTabIndex: host.getAttribute('tabindex'),
        };
        const property = await completed;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const end = {
          visibility: getComputedStyle(button).visibility,
          hostTabIndex: host.getAttribute('tabindex'),
        };
        return { start, property, end };
      });
      expect(result).toEqual({
        start: { visibility: 'visible', hostTabIndex: null },
        property: 'visibility',
        end: { visibility: 'hidden', hostTabIndex: '0' },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry when a delayed transition starts affecting visibility', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: `
          #delayed-transition-entry button {
            visibility: hidden;
            transition: visibility 120ms linear 120ms;
          }
          #delayed-transition-entry.reveal button { visibility: visible; }
        `,
      });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-delayed-transition-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          })
        );
        const host = new C();
        host.id = 'delayed-transition-entry';
        const button = document.createElement('button');
        button.textContent = 'Delayed transition target';
        host.append(button);
        document.body.append(host);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const started = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('transitionstart timeout')), 1000);
          button.addEventListener(
            'transitionstart',
            (event) => {
              if (event.propertyName !== 'visibility') return;
              clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        });
        host.classList.add('reveal');
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const delayed = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        await started;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const active = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        return { delayed, active };
      });
      expect(result).toEqual({
        delayed: { visibility: 'hidden', fallback: '0' },
        active: { visibility: 'visible', fallback: null },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry when a delayed animation starts affecting visibility', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: `
          #delayed-animation-entry button { visibility: hidden; }
          #delayed-animation-entry.reveal button {
            animation: reveal-delayed-entry 120ms linear 120ms;
          }
          @keyframes reveal-delayed-entry {
            from, to { visibility: visible; }
          }
        `,
      });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-delayed-animation-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          })
        );
        const host = new C();
        host.id = 'delayed-animation-entry';
        const button = document.createElement('button');
        button.textContent = 'Delayed animation target';
        host.append(button);
        document.body.append(host);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );

        const started = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('animationstart timeout')), 1000);
          button.addEventListener(
            'animationstart',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        });
        const initial = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        host.classList.add('reveal');
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const delayed = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        await started;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const active = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        return { initial, delayed, active };
      });
      expect(result).toEqual({
        initial: { visibility: 'hidden', fallback: '0' },
        delayed: { visibility: 'hidden', fallback: '0' },
        active: { visibility: 'visible', fallback: null },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry across intermediate animation keyframe states', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: `
          #keyframe-entry.run button { animation: keyframe-entry-visibility 20s linear infinite; }
          @keyframes keyframe-entry-visibility {
            0%, 20% { visibility: visible; }
            25%, 75% { visibility: hidden; }
            80%, 100% { visibility: visible; }
          }
        `,
      });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-keyframe-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          })
        );
        const host = new C();
        host.id = 'keyframe-entry';
        const button = document.createElement('button');
        button.textContent = 'Animated eligibility';
        host.append(button);
        document.body.append(host);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        const started = new Promise<void>((resolve) =>
          button.addEventListener('animationstart', () => resolve(), { once: true })
        );
        host.classList.add('run');
        await started;
        const animation = button.getAnimations()[0]!;
        const waitFor = async (predicate: () => boolean) => {
          for (let frame = 0; frame < 120; frame += 1) {
            if (predicate()) return;
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
          throw new Error('entry animation projection timeout');
        };

        animation.currentTime = 10_000;
        await waitFor(
          () =>
            getComputedStyle(button).visibility === 'hidden' &&
            host.getAttribute('tabindex') === '0'
        );
        const hidden = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };

        animation.currentTime = 19_000;
        await waitFor(
          () =>
            getComputedStyle(button).visibility === 'visible' &&
            host.getAttribute('tabindex') === null
        );
        const visible = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        animation.cancel();
        return { hidden, visible };
      });
      expect(result).toEqual({
        hidden: { visibility: 'hidden', fallback: '0' },
        visible: { visibility: 'visible', fallback: null },
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

  it('reprojects descendant entry after non-viewport media-query changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content:
          '@media (prefers-reduced-motion: reduce) { #media-entry-button { visibility: hidden; } }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-media-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'media-entry';
        host.innerHTML = '<button id="media-entry-button">Button</button>';
        document.body.append(host);
      });
      await page.waitForFunction(
        () => document.querySelector('#media-entry')?.getAttribute('tabindex') === null
      );

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(
        () => document.querySelector('#media-entry')?.getAttribute('tabindex') === '0'
      );

      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(
        () => document.querySelector('#media-entry')?.getAttribute('tabindex') === null
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry after arbitrary author media-query changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.emulateMedia({ contrast: 'no-preference' });
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content:
          '@media (prefers-contrast: more) { #arbitrary-media-entry-button { visibility: hidden; } }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-arbitrary-media-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'arbitrary-media-entry';
        host.innerHTML = '<button id="arbitrary-media-entry-button">Button</button>';
        document.body.append(host);
      });
      await page.waitForFunction(
        () => document.querySelector('#arbitrary-media-entry')?.getAttribute('tabindex') === null
      );

      await page.emulateMedia({ contrast: 'more' });
      await page.waitForFunction(
        () => document.querySelector('#arbitrary-media-entry')?.getAttribute('tabindex') === '0'
      );

      await page.emulateMedia({ contrast: 'no-preference' });
      await page.waitForFunction(
        () => document.querySelector('#arbitrary-media-entry')?.getAttribute('tabindex') === null
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry after an external relational-selector dependency changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: '.relational-wrapper:has(.flag) #relational-entry-button { visibility: hidden; }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-relational-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const wrapper = document.createElement('div');
        wrapper.className = 'relational-wrapper';
        const inner = document.createElement('div');
        const host = new C();
        host.id = 'relational-entry';
        host.innerHTML = '<button id="relational-entry-button">Button</button>';
        inner.append(host);
        wrapper.append(inner);
        document.body.append(wrapper);
        (window as any).__relationalWrapper = wrapper;
      });
      await page.waitForFunction(
        () => document.querySelector('#relational-entry')?.getAttribute('tabindex') === null
      );

      await page.evaluate(() => {
        const flag = document.createElement('span');
        flag.className = 'flag';
        (window as any).__relationalWrapper.append(flag);
      });
      await page.waitForFunction(
        () => document.querySelector('#relational-entry')?.getAttribute('tabindex') === '0'
      );

      await page.evaluate(() => document.querySelector('.flag')?.remove());
      await page.waitForFunction(
        () => document.querySelector('#relational-entry')?.getAttribute('tabindex') === null
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry after a preceding sibling selector changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: '.sibling-entry-flag.active ~ .sibling-entry button { visibility: hidden; }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-sibling-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const wrapper = document.createElement('div');
        const flag = document.createElement('div');
        flag.className = 'sibling-entry-flag';
        const host = new C();
        host.id = 'sibling-entry';
        host.className = 'sibling-entry';
        host.innerHTML = '<button>Button</button>';
        wrapper.append(flag, host);
        document.body.append(wrapper);
        (window as any).__siblingEntryFlag = flag;
      });
      await page.waitForFunction(
        () => document.querySelector('#sibling-entry')?.getAttribute('tabindex') === null
      );

      await page.evaluate(() => (window as any).__siblingEntryFlag.classList.add('active'));
      await page.waitForFunction(
        () => document.querySelector('#sibling-entry')?.getAttribute('tabindex') === '0'
      );

      await page.evaluate(() => (window as any).__siblingEntryFlag.classList.remove('active'));
      await page.waitForFunction(
        () => document.querySelector('#sibling-entry')?.getAttribute('tabindex') === null
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry after a preceding popover toggles selector matching', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.addStyleTag({
        content: '#entry-popover:popover-open ~ .popover-entry button { visibility: hidden; }',
      });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-popover-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const popover = document.createElement('div');
        popover.id = 'entry-popover';
        popover.popover = 'manual';
        const host = new C();
        host.id = 'popover-entry';
        host.className = 'popover-entry';
        host.innerHTML = '<button>Target</button>';
        document.body.append(popover, host);
        (window as any).__entryPopover = popover;
      });
      const tabIndex = () =>
        page.locator('#popover-entry').evaluate((host) => host.getAttribute('tabindex'));
      expect(await tabIndex()).toBeNull();
      await page.evaluate(() => (window as any).__entryPopover.showPopover());
      await expect.poll(tabIndex).toBe('0');
      await page.evaluate(() => (window as any).__entryPopover.hidePopover());
      await expect.poll(tabIndex).toBeNull();
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
      expect(result.error).toMatch(/conditional-composite/);
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

  it('rebinds a retained focus-entry observation graph to its adopted document', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-retained-adopted-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'retained-adopted-entry';
        const button = document.createElement('button');
        button.textContent = 'Entry';
        host.append(button);
        document.body.append(host);
        const settle = (view: Window) =>
          new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
        await settle(window);
        const initial = host.getAttribute('tabindex');

        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const foreignWindow = frame.contentWindow!;
        const style = foreignDocument.createElement('style');
        foreignDocument.head.append(style);
        foreignDocument.adoptNode(host);
        foreignDocument.body.append(host);
        await settle(foreignWindow);
        const adopted = host.getAttribute('tabindex');

        style.sheet!.insertRule('#retained-adopted-entry button { visibility: hidden; }');
        await Promise.resolve();
        const hidden = host.getAttribute('tabindex');
        style.sheet!.deleteRule(0);
        await Promise.resolve();
        const visible = host.getAttribute('tabindex');
        frame.remove();
        return { initial, adopted, hidden, visible };
      });
      expect(result).toEqual({ initial: null, adopted: null, hidden: '0', visible: null });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('rebinds retained scope focus history to its adopted document', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-retained-adopted-scope-history',
            setup(def: any) {
              const scope = p.asFocusScope();
              scope.configure({ trap: true, loop: true, entry: 'manual' });
              def.expose('activate', () => scope.activate());
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'adopted-history-scope';
        host.innerHTML =
          '<button id="adopted-history-before">Before</button><button id="adopted-history-middle">Middle</button><button id="adopted-history-after">After</button>';
        document.body.append(host);
        host.getExposes().activate();
        const frame = document.createElement('iframe');
        frame.id = 'adopted-history-frame';
        document.body.append(frame);
        frame.contentDocument!.adoptNode(host);
        frame.contentDocument!.body.append(host);
      });
      const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
      const active = () =>
        frame.evaluate(() => {
          let element = document.activeElement;
          while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
          return element?.id;
        });

      await frame.locator('#adopted-history-middle').focus();
      await frame.locator('body').evaluate((body: HTMLElement) => {
        body.tabIndex = -1;
        body.focus();
      });
      await page.keyboard.press('Tab');
      expect(await active()).toBe('adopted-history-after');

      await frame.locator('#adopted-history-middle').focus();
      await frame.locator('body').evaluate((body: HTMLElement) => body.focus());
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('adopted-history-before');
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

  it('preserves native DOM parent and query behavior while a portal is projected', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(() => {
        const p = (window as any).Closeout;
        const origin = document.createElement('section');
        const projected = document.createElement('div');
        projected.id = 'native-parent-portal';
        origin.append(projected);
        document.body.append(origin);
        const portal = p.createPortal();
        portal.mount(projected);
        const mounted = {
          parentNodeIsBody: projected.parentNode === document.body,
          parentElementIsBody: projected.parentElement === document.body,
          rootIsDocument: projected.getRootNode() === document,
          absentFromOriginQuery: origin.querySelector('#native-parent-portal') === null,
          presentInBodyQuery: document.body.querySelector('#native-parent-portal') === projected,
        };
        projected.parentNode!.removeChild(projected);
        const removed = {
          parentNode: projected.parentNode,
          absentFromBodyQuery: document.body.querySelector('#native-parent-portal') === null,
        };
        portal.unmount(projected);
        const restored = {
          parentNodeIsOrigin: projected.parentNode === origin,
          presentInOriginQuery: origin.querySelector('#native-parent-portal') === projected,
        };
        origin.remove();
        return { mounted, removed, restored };
      });
      expect(result).toEqual({
        mounted: {
          parentNodeIsBody: true,
          parentElementIsBody: true,
          rootIsDocument: true,
          absentFromOriginQuery: true,
          presentInBodyQuery: true,
        },
        removed: { parentNode: null, absentFromBodyQuery: true },
        restored: { parentNodeIsOrigin: true, presentInOriginQuery: true },
      });
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

  it('reprojects entry eligibility for a recursively wrapped body relational selector', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const style = document.createElement('style');
        style.textContent =
          ':where(:is(body)):has(> .wrapped-body-entry-flag) #wrapped-body-entry button { visibility: hidden; }';
        const C = p.adapt(
          p.define({
            name: 'closeout-wrapped-body-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'wrapped-body-entry';
        host.innerHTML = '<button>Inside</button>';
        document.head.append(style);
        document.body.append(host);
      });
      const hostTabIndex = () =>
        page.locator('#wrapped-body-entry').evaluate((host) => host.getAttribute('tabindex'));
      expect(await hostTabIndex()).toBeNull();

      await page.evaluate(() => {
        const flag = document.createElement('span');
        flag.className = 'wrapped-body-entry-flag';
        document.body.append(flag);
      });
      await page.waitForFunction(
        () => document.querySelector('#wrapped-body-entry')?.getAttribute('tabindex') === '0'
      );
      expect(await hostTabIndex()).toBe('0');

      await page.locator('.wrapped-body-entry-flag').evaluate((flag) => flag.remove());
      await page.waitForFunction(
        () => !document.querySelector('#wrapped-body-entry')?.hasAttribute('tabindex')
      );
      expect(await hostTabIndex()).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry eligibility when only an external container ancestor resizes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const style = document.createElement('style');
        style.textContent = `
          #entry-query-layout { display: grid; grid-template-columns: auto minmax(0, 1fr); width: 600px; }
          #entry-query-container { container-type: inline-size; }
          @container (width < 300px) {
            #entry-query-button { visibility: hidden; }
          }
        `;
        const C = p.adapt(
          p.define({
            name: 'closeout-container-query-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const layout = document.createElement('div');
        layout.id = 'entry-query-layout';
        const spacer = document.createElement('div');
        spacer.id = 'entry-query-spacer';
        spacer.style.width = '100px';
        const container = document.createElement('div');
        container.id = 'entry-query-container';
        const host = new C();
        host.id = 'container-query-entry';
        host.innerHTML = '<button id="entry-query-button">Inside</button>';
        container.append(host);
        layout.append(spacer, container);
        document.head.append(style);
        document.body.append(layout);
      });
      const hostTabIndex = () =>
        page.locator('#container-query-entry').evaluate((host) => host.getAttribute('tabindex'));
      expect(await hostTabIndex()).toBeNull();

      // Only this sibling mutates. The entry subtree and its composed
      // ancestors receive no DOM/attribute change; the container ancestor's
      // ResizeObserver delivery owns the re-projection.
      await page.locator('#entry-query-spacer').evaluate((spacer: HTMLElement) => {
        spacer.style.width = '400px';
      });
      await page.waitForFunction(
        () => document.querySelector('#container-query-entry')?.getAttribute('tabindex') === '0'
      );
      expect(await hostTabIndex()).toBe('0');

      await page.locator('#entry-query-spacer').evaluate((spacer: HTMLElement) => {
        spacer.style.width = '100px';
      });
      await page.waitForFunction(
        () => !document.querySelector('#container-query-entry')?.hasAttribute('tabindex')
      );
      expect(await hostTabIndex()).toBeNull();
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

  it('keeps a logical portal branch in trapped forward and reverse traversal', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-portaled-focus-scope',
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
        scope.id = 'portaled-focus-scope';
        scope.innerHTML =
          '<button id="portal-before">Before</button><section id="portal-branch"><button id="portal-target">Portaled</button><span id="portal-shadow-host"></span></section><button id="portal-after">After</button>';
        const shadowTarget = document.createElement('button');
        shadowTarget.id = 'portal-shadow-target';
        shadowTarget.textContent = 'Portaled shadow';
        scope
          .querySelector('#portal-shadow-host')!
          .attachShadow({ mode: 'open' })
          .append(shadowTarget);
        document.body.append(scope);
        const portal = p.createPortal();
        portal.mount(scope.querySelector('#portal-branch'));
        (scope as any)._testPortal = portal;
        scope.getExposes().activate();
      });
      expect(
        await page.evaluate(() =>
          (window as any).Closeout.sample(
            document.getElementById('portaled-focus-scope')
          ).targets.map((el: HTMLElement) => el.id)
        )
      ).toEqual(['portal-before', 'portal-target', 'portal-shadow-target', 'portal-after']);
      const active = () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return el?.id;
        });

      await page.locator('#portal-before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('portal-target');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('portal-shadow-target');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('portal-after');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('portal-before');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('portal-after');
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('portal-shadow-target');

      await page.locator('body').evaluate((body: HTMLElement) => {
        body.tabIndex = -1;
        body.focus();
      });
      await page.keyboard.press('Tab');
      expect(await active()).toBe('portal-after');

      await page
        .locator('#portal-shadow-host')
        .evaluate((host) => (host.shadowRoot!.querySelector('button') as HTMLElement).focus());
      await page.locator('body').evaluate((body: HTMLElement) => body.focus());
      await page.keyboard.press('Shift+Tab');
      expect(await active()).toBe('portal-target');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects descendant entry when a body-mounted portal target changes eligibility', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-portaled-entry-projection',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const host = new C();
        host.id = 'portaled-entry-projection';
        const branch = document.createElement('section');
        const button = document.createElement('button');
        button.textContent = 'Portaled entry target';
        branch.append(button);
        host.append(branch);
        document.body.append(host);
        await new Promise<void>((resolve) => queueMicrotask(resolve));

        const portal = p.createPortal();
        portal.mount(branch);
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const initial = host.getAttribute('tabindex');
        button.disabled = true;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const disabled = host.getAttribute('tabindex');
        button.disabled = false;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const restored = host.getAttribute('tabindex');
        portal.unmount(branch);
        return { initial, disabled, restored };
      });
      expect(result).toEqual({ initial: null, disabled: '0', restored: null });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('moves an active portal projection with its adopted logical owner', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        let setups = 0;
        let presses = 0;
        const C = p.adapt(
          p.define({
            name: 'closeout-active-portal-adoption',
            setup(def: any) {
              setups += 1;
              def.event.on('press.commit', () => presses++);
              def.expose('snapshot', () => ({ setups, presses }));
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const settle = (view: Window) =>
          new Promise<void>((resolve) =>
            view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve()))
          );
        const origin = document.createElement('section');
        const host = new C();
        host.id = 'active-portal-owner';
        const button = document.createElement('button');
        button.textContent = 'Portal press';
        host.append(button);
        origin.append(host);
        document.body.append(origin);
        await settle(window);
        const controller = (host as any)._controller;
        const generation = (host as any)._runtimeGeneration;
        const portal = p.createPortal();
        portal.mount(button);
        await settle(window);
        const before = {
          inOldBody: document.body.querySelector('button') === button,
          parentNodeIsOldBody: button.parentNode === document.body,
          ownerDocument: button.ownerDocument === document,
          snapshot: host.getExposes().snapshot(),
        };

        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const foreignWindow = frame.contentWindow!;
        foreignDocument.adoptNode(origin);
        foreignDocument.body.append(origin);
        const immediate = {
          oldBodyClean: document.body.querySelector('button') !== button,
          inNewBody: foreignDocument.body.querySelector('button') === button,
          parentNodeIsNewBody: button.parentNode === foreignDocument.body,
          ownerDocument: button.ownerDocument === foreignDocument,
        };
        button.click();
        const immediateSnapshot = host.getExposes().snapshot();
        await settle(foreignWindow);
        const after = {
          oldBodyClean: document.body.querySelector('button') !== button,
          inNewBody: foreignDocument.body.querySelector('button') === button,
          parentNodeIsNewBody: button.parentNode === foreignDocument.body,
          ownerDocument: button.ownerDocument === foreignDocument,
          markerMoved: Array.from(host.childNodes as NodeListOf<ChildNode>).some(
            (node) => node.nodeType === 8
          ),
          controllerRetained: (host as any)._controller === controller,
          generationRetained: (host as any)._runtimeGeneration === generation,
          snapshot: host.getExposes().snapshot(),
        };
        portal.unmount(button);
        portal.mount(button);
        document.adoptNode(origin);
        const abandonedImmediate = {
          inDestinationBody: document.body.querySelector('button') === button,
          ownerDocument: button.ownerDocument === document,
        };
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const abandonedAfterCheckpoint = {
          destinationBodyClean: document.body.querySelector('button') !== button,
          restoredToOrigin: button.parentElement === host,
          originDisconnected: !origin.isConnected,
        };
        portal.unmount(button);
        frame.remove();
        return {
          before,
          immediate,
          immediateSnapshot,
          after,
          abandonedImmediate,
          abandonedAfterCheckpoint,
        };
      });
      expect(result).toEqual({
        before: {
          inOldBody: true,
          parentNodeIsOldBody: true,
          ownerDocument: true,
          snapshot: { setups: 1, presses: 0 },
        },
        immediate: {
          oldBodyClean: true,
          inNewBody: true,
          parentNodeIsNewBody: true,
          ownerDocument: true,
        },
        immediateSnapshot: { setups: 1, presses: 1 },
        after: {
          oldBodyClean: true,
          inNewBody: true,
          parentNodeIsNewBody: true,
          ownerDocument: true,
          markerMoved: true,
          controllerRetained: true,
          generationRetained: true,
          snapshot: { setups: 1, presses: 1 },
        },
        abandonedImmediate: {
          inDestinationBody: true,
          ownerDocument: true,
        },
        abandonedAfterCheckpoint: {
          destinationBodyClean: true,
          restoredToOrigin: true,
          originDisconnected: true,
        },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry after motion completes on an external composed ancestor', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-external-motion-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent =
          '.wrapper { visibility: visible; transition: visibility 80ms linear; } .wrapper.hidden { visibility: hidden; }';
        const wrapper = document.createElement('div');
        wrapper.className = 'wrapper';
        const slot = document.createElement('slot');
        wrapper.append(slot);
        root.append(style, wrapper);
        const host = new C();
        host.id = 'external-motion-entry';
        host.innerHTML = '<button>Inside</button>';
        carrier.append(host);
        document.body.append(carrier);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        const initial = host.getAttribute('tabindex');
        let endpoints = 0;
        const ended = new Promise<void>((resolve) => {
          wrapper.addEventListener(
            'transitionend',
            () => {
              endpoints += 1;
              resolve();
            },
            { once: true }
          );
        });
        wrapper.classList.add('hidden');
        await ended;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        return {
          initial,
          endpoints,
          visibility: getComputedStyle(wrapper).visibility,
          fallback: host.getAttribute('tabindex'),
        };
      });
      expect(result).toEqual({
        initial: null,
        endpoints: 1,
        visibility: 'hidden',
        fallback: '0',
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry when an arbitrary author attribute changes external CSS eligibility', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-external-author-attribute-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: true }
        );
        const style = document.createElement('style');
        style.textContent = `.external-author-state[data-state='closed'] button { visibility: hidden; }`;
        const wrapper = document.createElement('div');
        wrapper.className = 'external-author-state';
        const host = new C();
        host.id = 'external-author-attribute-entry';
        host.innerHTML = '<button id="external-author-attribute-button">Target</button>';
        wrapper.append(host);
        document.head.append(style);
        document.body.append(wrapper);
      });
      const host = page.locator('#external-author-attribute-entry');
      const wrapper = page.locator('.external-author-state');
      expect(await host.getAttribute('tabindex')).toBe(null);

      await wrapper.evaluate((element) => element.setAttribute('data-state', 'closed'));
      await page.waitForFunction(
        () =>
          document.querySelector('#external-author-attribute-entry')?.getAttribute('tabindex') ===
          '0'
      );
      expect(
        await page
          .locator('#external-author-attribute-button')
          .evaluate((target) => getComputedStyle(target).visibility)
      ).toBe('hidden');

      await wrapper.evaluate((element) => element.setAttribute('data-state', 'open'));
      await page.waitForFunction(
        () => !document.querySelector('#external-author-attribute-entry')?.hasAttribute('tabindex')
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects zero-size entry descendants after direct CSSOM eligibility assignments', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-cssom-assignment-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent =
          '#cssom-zero-button { position: absolute; width: 0; height: 0; padding: 0; border: 0; }';
        document.head.append(style);
        const rule = style.sheet!.cssRules[0] as CSSStyleRule;
        const host = new C();
        host.id = 'cssom-assignment-entry';
        host.innerHTML = '<button id="cssom-zero-button">Zero</button>';
        document.body.append(host);
        const settle = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          );
        await settle();
        const initial = host.getAttribute('tabindex');
        rule.style.display = 'none';
        await settle();
        const displayHidden = host.getAttribute('tabindex');
        rule.style.display = '';
        await settle();
        const displayRestored = host.getAttribute('tabindex');
        rule.style.contentVisibility = 'hidden';
        await settle();
        const contentHidden = host.getAttribute('tabindex');
        rule.style.contentVisibility = '';
        await settle();
        return {
          initial,
          displayHidden,
          displayRestored,
          contentHidden,
          contentRestored: host.getAttribute('tabindex'),
        };
      });
      expect(result).toEqual({
        initial: null,
        displayHidden: '0',
        displayRestored: null,
        contentHidden: '0',
        contentRestored: null,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('rebinds active portal adoption after its origin moves to another owner', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const Owner = p.adapt(
          p.define({ name: 'closeout-portal-rebind-owner', setup: () => (r: any) => r.slot() })
        );
        const Child = p.adapt(
          p.define({ name: 'closeout-portal-rebind-child', setup: () => (r: any) => r.slot() })
        );
        const first = new Owner();
        const second = new Owner();
        const wrapper = document.createElement('div');
        const child = new Child();
        child.id = 'portal-rebind-child';
        wrapper.append(child);
        first.append(wrapper);
        document.body.append(first, second);
        const portal = p.createPortal();
        portal.mount(child);

        second.append(wrapper);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        foreignDocument.adoptNode(second);
        foreignDocument.body.append(second);
        const immediate = {
          ownerDocument: child.ownerDocument === foreignDocument,
          inDestinationBody: foreignDocument.body.querySelector('#portal-rebind-child') === child,
          oldBodyClean: document.body.querySelector('#portal-rebind-child') === null,
        };
        portal.unmount(child);
        frame.remove();
        return immediate;
      });
      expect(result).toEqual({ ownerDocument: true, inDestinationBody: true, oldBodyClean: true });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback after selector-only checked state changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-checked-selector-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent = '#checked-selector-entry input:checked + button { visibility: hidden }';
        const host = new C();
        host.id = 'checked-selector-entry';
        host.innerHTML =
          '<input id="checked-selector-toggle" type="checkbox" tabindex="-1"><button id="checked-selector-target">Target</button>';
        document.head.append(style);
        document.body.append(host);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const initial = host.getAttribute('tabindex');
        (host.querySelector('#checked-selector-toggle') as HTMLInputElement).checked = true;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        return {
          initial,
          visibility: getComputedStyle(host.querySelector('#checked-selector-target')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
      });
      expect(result).toEqual({ initial: null, visibility: 'hidden', fallback: '0' });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback after custom validity changes selector state', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-validity-selector-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent =
          '#validity-selector-entry input:invalid + button { visibility: hidden }';
        const host = new C();
        host.id = 'validity-selector-entry';
        host.innerHTML = '<input tabindex="-1"><button>Target</button>';
        document.head.append(style);
        document.body.append(host);
        const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
        await settle();
        const input = host.querySelector('input')!;
        const button = host.querySelector('button')!;
        const initial = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        input.setCustomValidity('invalid');
        await settle();
        const invalid = {
          visibility: getComputedStyle(button).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        input.setCustomValidity('');
        await settle();
        return {
          initial,
          invalid,
          restored: {
            visibility: getComputedStyle(button).visibility,
            fallback: host.getAttribute('tabindex'),
          },
        };
      });
      expect(result).toEqual({
        initial: { visibility: 'visible', fallback: null },
        invalid: { visibility: 'hidden', fallback: '0' },
        restored: { visibility: 'visible', fallback: null },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback after native input stepping crosses range boundaries', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-step-selector-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent =
          '.step-selector-entry input:out-of-range + button { visibility: hidden }';
        document.head.append(style);
        const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
        const observations = [];
        for (const [method, initial] of [
          ['stepUp', -1],
          ['stepDown', 11],
        ] as const) {
          const host = new C();
          host.className = 'step-selector-entry';
          host.innerHTML = `<input type="number" min="0" max="10" step="1" value="${initial}" tabindex="-1"><button>Target</button>`;
          document.body.append(host);
          await settle();
          const input = host.querySelector('input')!;
          const button = host.querySelector('button')!;
          const before = {
            outOfRange: input.validity.rangeOverflow || input.validity.rangeUnderflow,
            visibility: getComputedStyle(button).visibility,
            fallback: host.getAttribute('tabindex'),
          };
          input[method]();
          await settle();
          observations.push({
            method,
            before,
            after: {
              value: input.valueAsNumber,
              outOfRange: input.validity.rangeOverflow || input.validity.rangeUnderflow,
              visibility: getComputedStyle(button).visibility,
              fallback: host.getAttribute('tabindex'),
            },
          });
          host.remove();
        }
        style.remove();
        return observations;
      });
      expect(result).toEqual([
        {
          method: 'stepUp',
          before: { outOfRange: true, visibility: 'hidden', fallback: '0' },
          after: { value: 0, outOfRange: false, visibility: 'visible', fallback: null },
        },
        {
          method: 'stepDown',
          before: { outOfRange: true, visibility: 'hidden', fallback: '0' },
          after: { value: 10, outOfRange: false, visibility: 'visible', fallback: null },
        },
      ]);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it.each(['input', 'textarea'] as const)(
    'reprojects entry fallback after direct %s value changes selector state',
    async (tag) => {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.addScriptTag({ content: script });
        const result = await page.evaluate(async (controlTag) => {
          const p = (window as any).Closeout;
          const C = p.adapt(
            p.define({
              name: `closeout-${controlTag}-value-selector-entry`,
              setup() {
                p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
                return (r: any) => r.slot();
              },
            }),
            { shadow: false }
          );
          const id = `${controlTag}-value-selector-entry`;
          const style = document.createElement('style');
          style.textContent = `#${id} ${controlTag}:placeholder-shown + button { visibility: hidden }`;
          const host = new C();
          host.id = id;
          host.innerHTML =
            controlTag === 'input'
              ? '<input placeholder="Hint" tabindex="-1"><button>Target</button>'
              : '<textarea placeholder="Hint" tabindex="-1"></textarea><button>Target</button>';
          document.head.append(style);
          document.body.append(host);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const control = host.querySelector(controlTag) as HTMLInputElement | HTMLTextAreaElement;
          const button = host.querySelector('button')!;
          const initial = {
            visibility: getComputedStyle(button).visibility,
            fallback: host.getAttribute('tabindex'),
          };
          control.value = 'ready';
          await new Promise<void>((resolve) => queueMicrotask(resolve));
          const filled = {
            visibility: getComputedStyle(button).visibility,
            fallback: host.getAttribute('tabindex'),
          };
          control.value = '';
          await new Promise<void>((resolve) => queueMicrotask(resolve));
          return {
            initial,
            filled,
            empty: {
              visibility: getComputedStyle(button).visibility,
              fallback: host.getAttribute('tabindex'),
            },
          };
        }, tag);
        expect(result).toEqual({
          initial: { visibility: 'hidden', fallback: '0' },
          filled: { visibility: 'visible', fallback: null },
          empty: { visibility: 'hidden', fallback: '0' },
        });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
  );

  it('reprojects a slotted entry when an external ShadowRoot stylesheet finishes loading', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let requestStarted!: () => void;
    let releaseResponse!: () => void;
    const started = new Promise<void>((resolve) => (requestStarted = resolve));
    const released = new Promise<void>((resolve) => (releaseResponse = resolve));
    await page.route('**/external-entry.css', async (route) => {
      requestStarted();
      await released;
      await route.fulfill({
        contentType: 'text/css',
        body: '::slotted(#external-shadow-link-entry) { visibility: hidden; }',
      });
    });
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-external-shadow-link-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://proto-ui.test/external-entry.css';
        const slot = document.createElement('slot');
        root.append(link, slot);
        const host = new C();
        host.id = 'external-shadow-link-entry';
        host.innerHTML = '<button>Target</button>';
        carrier.append(host);
        (window as any).__externalEntrySheetLoaded = new Promise<void>((resolve, reject) => {
          link.addEventListener('load', () => resolve(), { once: true });
          link.addEventListener('error', () => reject(new Error('stylesheet failed')), {
            once: true,
          });
        });
        document.body.append(carrier);
      });
      await started;
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      );
      expect(await page.locator('#external-shadow-link-entry').getAttribute('tabindex')).toBe(null);
      releaseResponse();
      const result = await page.evaluate(async () => {
        await (window as any).__externalEntrySheetLoaded;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        const host = document.querySelector<HTMLElement>('#external-shadow-link-entry')!;
        return {
          visibility: getComputedStyle(host.querySelector('button')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
      });
      expect(result).toEqual({ visibility: 'hidden', fallback: '0' });
      expect(errors).toEqual([]);
    } finally {
      releaseResponse();
      await page.close();
    }
  });

  it('reprojects entry fallback across selector-only hover state changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-hover-selector-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent = '#hover-selector-entry:hover button { visibility: hidden }';
        const host = new C();
        host.id = 'hover-selector-entry';
        host.innerHTML = '<button id="hover-selector-target">Target</button>';
        document.head.append(style);
        document.body.append(host);
      });
      expect(await page.locator('#hover-selector-entry').getAttribute('tabindex')).toBe(null);
      await page.locator('#hover-selector-entry').hover();
      await page.waitForFunction(
        () => document.querySelector('#hover-selector-entry')?.getAttribute('tabindex') === '0'
      );
      expect(
        await page
          .locator('#hover-selector-target')
          .evaluate((target) => getComputedStyle(target).visibility)
      ).toBe('hidden');
      await page.mouse.move(0, 0);
      await page.waitForFunction(
        () => !document.querySelector('#hover-selector-entry')?.hasAttribute('tabindex')
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback across focus-driven selector state changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-focus-selector-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent =
          '#focus-switch:focus + #focus-selector-entry button { visibility: hidden }';
        const input = document.createElement('input');
        input.id = 'focus-switch';
        const host = new C();
        host.id = 'focus-selector-entry';
        host.innerHTML = '<button>Target</button>';
        document.head.append(style);
        document.body.append(input, host);
        const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
        await settle();
        const initial = host.getAttribute('tabindex');
        input.focus();
        await settle();
        const focused = {
          visibility: getComputedStyle(host.querySelector('button')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        input.blur();
        await settle();
        return { initial, focused, restored: host.getAttribute('tabindex') };
      });
      expect(result).toEqual({
        initial: null,
        focused: { visibility: 'hidden', fallback: '0' },
        restored: null,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback after CSS rule selector and media changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-css-rule-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent = `
          #selector-no-match button { visibility: hidden }
          @media (max-width: 1px) { #css-rule-entry button { visibility: hidden } }
        `;
        const host = new C();
        host.id = 'css-rule-entry';
        host.innerHTML = '<button>Target</button>';
        document.head.append(style);
        document.body.append(host);
        const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
        await settle();
        const initial = host.getAttribute('tabindex');
        const selectorRule = style.sheet!.cssRules[0] as CSSStyleRule;
        selectorRule.selectorText = '#css-rule-entry button';
        await settle();
        const selectorChanged = host.getAttribute('tabindex');
        selectorRule.selectorText = '#selector-no-match button';
        await settle();
        const selectorRestored = host.getAttribute('tabindex');
        const mediaRule = style.sheet!.cssRules[1] as CSSMediaRule;
        mediaRule.media.appendMedium('all');
        await settle();
        const mediaChanged = host.getAttribute('tabindex');
        mediaRule.media.deleteMedium('all');
        await settle();
        return {
          initial,
          selectorChanged,
          selectorRestored,
          mediaChanged,
          mediaRestoredVisibility: getComputedStyle(host.querySelector('button')!).visibility,
          mediaRestored: host.getAttribute('tabindex'),
        };
      });
      expect(result).toEqual({
        initial: null,
        selectorChanged: '0',
        selectorRestored: null,
        mediaChanged: '0',
        mediaRestoredVisibility: 'visible',
        mediaRestored: null,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback after nested Shadow style Text mutations', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-shadow-style-text-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const host = new C();
        const carrier = document.createElement('div');
        const root = carrier.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        const text = document.createTextNode('button { visibility: hidden; }');
        style.append(text);
        root.append(style, document.createElement('button'));
        host.append(carrier);
        document.body.append(host);
        const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
        await settle();
        const initial = host.getAttribute('tabindex');
        text.data = 'button { visibility: visible; }';
        await settle();
        const visible = host.getAttribute('tabindex');
        text.nodeValue = 'button { visibility: hidden; }';
        await settle();
        return { initial, visible, hiddenAgain: host.getAttribute('tabindex') };
      });
      expect(result).toEqual({ initial: '0', visible: null, hiddenAgain: '0' });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback after CSSStyleSheet disabled state changes', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-disabled-sheet-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.textContent = '#disabled-sheet-entry button { visibility: hidden }';
        const host = new C();
        host.id = 'disabled-sheet-entry';
        host.innerHTML = '<button id="disabled-sheet-target">Target</button>';
        document.head.append(style);
        document.body.append(host);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const initial = host.getAttribute('tabindex');
        (style.sheet as CSSStyleSheet).disabled = true;
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        return {
          initial,
          visibility: getComputedStyle(host.querySelector('#disabled-sheet-target')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
      });
      expect(result).toEqual({ initial: '0', visibility: 'visible', fallback: null });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('reprojects entry fallback when style type changes eligibility', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-style-type-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const style = document.createElement('style');
        style.type = 'text/plain';
        style.textContent = '#style-type-entry button { visibility: hidden }';
        const host = new C();
        host.id = 'style-type-entry';
        host.innerHTML = '<button id="style-type-target">Target</button>';
        document.head.append(style);
        document.body.append(host);
        const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await settle();
        const initial = {
          visibility: getComputedStyle(host.querySelector('#style-type-target')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        style.type = 'text/css';
        await settle();
        const enabled = {
          visibility: getComputedStyle(host.querySelector('#style-type-target')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        style.type = 'text/plain';
        await settle();
        return {
          initial,
          enabled,
          disabledAgain: {
            visibility: getComputedStyle(host.querySelector('#style-type-target')!).visibility,
            fallback: host.getAttribute('tabindex'),
          },
        };
      });
      expect(result).toEqual({
        initial: { visibility: 'visible', fallback: null },
        enabled: { visibility: 'hidden', fallback: '0' },
        disabledAgain: { visibility: 'visible', fallback: null },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('rebinds target-selector invalidation after document adoption and tears it down', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-target-adoption-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const host = new C();
        host.id = 'target-adoption-entry';
        host.innerHTML = '<button id="target-adoption-button">Target</button>';
        document.body.append(host);
        const frame = document.createElement('iframe');
        frame.srcdoc =
          '<!doctype html><style>#target-adoption-entry:target button { visibility: hidden }</style><body></body>';
        document.body.append(frame);
        await new Promise<void>((resolve) =>
          frame.addEventListener('load', () => resolve(), { once: true })
        );
        const frameWindow = frame.contentWindow!;
        const frameDocument = frame.contentDocument!;
        frameDocument.adoptNode(host);
        frameDocument.body.append(host);
        const settle = () =>
          new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
        await settle();
        const initial = {
          visibility: frameWindow.getComputedStyle(host.querySelector('button')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        const changed = new Promise<void>((resolve) =>
          frameWindow.addEventListener('hashchange', () => resolve(), { once: true })
        );
        frameWindow.location.hash = 'target-adoption-entry';
        await changed;
        await settle();
        const targeted = {
          visibility: frameWindow.getComputedStyle(host.querySelector('button')!).visibility,
          fallback: host.getAttribute('tabindex'),
        };
        host.remove();
        await Promise.resolve();
        let writesAfterTeardown = 0;
        const setAttribute = host.setAttribute;
        const removeAttribute = host.removeAttribute;
        host.setAttribute = function (...args: Parameters<HTMLElement['setAttribute']>) {
          writesAfterTeardown += 1;
          return setAttribute.apply(this, args);
        };
        host.removeAttribute = function (...args: Parameters<HTMLElement['removeAttribute']>) {
          writesAfterTeardown += 1;
          return removeAttribute.apply(this, args);
        };
        const cleared = new Promise<void>((resolve) =>
          frameWindow.addEventListener('hashchange', () => resolve(), { once: true })
        );
        frameWindow.location.hash = '';
        await cleared;
        await settle();
        return { initial, targeted, writesAfterTeardown };
      });
      expect(result).toEqual({
        initial: { visibility: 'visible', fallback: null },
        targeted: { visibility: 'hidden', fallback: '0' },
        writesAfterTeardown: 0,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('does not hand trapped traversal to an iframe browsing context', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      await page.evaluate(() => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-iframe-scope',
            setup(def: any) {
              const scope = p.asFocusScope();
              scope.configure({ trap: true, loop: true, entry: 'manual' });
              def.expose('activate', () => scope.activate());
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const host = new C();
        host.id = 'iframe-scope';
        host.innerHTML =
          '<button id="iframe-before">Before</button><iframe id="unmanaged-frame" srcdoc="<button id=inside>Inside</button>"></iframe><button id="iframe-after">After</button>';
        document.body.append(host);
        (host as any).getExposes().activate();
        (host.querySelector('#iframe-before') as HTMLElement).focus();
      });
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('iframe-after');
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('matches native image-map entry eligibility for selected srcset sources', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const valid =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      await page.evaluate((source) => {
        const p = (window as any).Closeout;
        const C = p.adapt(
          p.define({
            name: 'closeout-srcset-map-entry',
            setup() {
              p.asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const before = document.createElement('button');
        before.id = 'srcset-before';
        const host = new C();
        host.id = 'srcset-map-entry';
        host.innerHTML =
          '<map name="srcset-entry-map" style="display:block"><area id="srcset-area" href="#destination" shape="rect" coords="0,0,1,1" tabindex="0" style="display:block"></map>';
        const image = document.createElement('img');
        image.id = 'srcset-image';
        image.useMap = '#srcset-entry-map';
        image.srcset = `${source} 1x`;
        document.body.append(before, host, image);
      }, valid);
      await page.waitForFunction(() => {
        const image = document.querySelector('#srcset-image') as HTMLImageElement;
        return image.complete && image.naturalWidth === 1 && !!image.currentSrc;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const initial = await page.evaluate(() => {
        const host = document.querySelector('#srcset-map-entry')!;
        const image = document.querySelector('#srcset-image') as HTMLImageElement;
        (document.querySelector('#srcset-before') as HTMLElement).focus();
        return {
          fallback: host.getAttribute('tabindex'),
          src: image.getAttribute('src'),
          currentSrc: !!image.currentSrc,
          naturalWidth: image.naturalWidth,
        };
      });
      await page.keyboard.press('Tab');
      const initialActive = await page.evaluate(() => (document.activeElement as HTMLElement)?.id);

      await page.evaluate(() => {
        (document.querySelector('#srcset-image') as HTMLImageElement).srcset =
          'data:image/gif;base64,broken 1x';
      });
      await page.waitForFunction(() => {
        const image = document.querySelector('#srcset-image') as HTMLImageElement;
        return image.complete && image.naturalWidth === 0;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const failed = await page.locator('#srcset-map-entry').getAttribute('tabindex');

      await page.evaluate((source) => {
        (document.querySelector('#srcset-image') as HTMLImageElement).srcset = `${source} 1x`;
      }, valid);
      await page.waitForFunction(() => {
        const image = document.querySelector('#srcset-image') as HTMLImageElement;
        return image.complete && image.naturalWidth === 1 && !!image.currentSrc;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const restored = await page.evaluate(() => {
        (document.querySelector('#srcset-before') as HTMLElement).focus();
        return document.querySelector('#srcset-map-entry')!.getAttribute('tabindex');
      });
      await page.keyboard.press('Tab');
      const restoredActive = await page.evaluate(() => (document.activeElement as HTMLElement)?.id);

      await page.evaluate(() => {
        (document.querySelector('#srcset-image') as HTMLImageElement).removeAttribute('srcset');
      });
      await page.waitForFunction(
        () => !(document.querySelector('#srcset-image') as HTMLImageElement).currentSrc
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const removed = await page.locator('#srcset-map-entry').getAttribute('tabindex');
      expect({ initial, initialActive, failed, restored, restoredActive, removed }).toEqual({
        initial: { fallback: null, src: null, currentSrc: true, naturalWidth: 1 },
        initialActive: 'srcset-area',
        failed: '0',
        restored: null,
        restoredActive: 'srcset-area',
        removed: '0',
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('installs host display and detached-view rules in the adopted document', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addScriptTag({ content: script });
      const result = await page.evaluate(async () => {
        const p = (window as any).Closeout;
        let normalSetups = 0;
        let detachedSetups = 0;
        const Normal = p.adapt(
          p.define({
            name: 'closeout-adopted-host-display',
            setup() {
              normalSetups += 1;
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const Detached = p.adapt(
          p.define({
            name: 'closeout-adopted-detached-display',
            setup(def: any) {
              detachedSetups += 1;
              def.lifecycle.onCreated((run: any) => run.lifecycle.setPresent(false));
              return (r: any) => r.slot();
            },
          }),
          { shadow: false }
        );
        const settle = (view: Window) =>
          new Promise<void>((resolve) =>
            view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve()))
          );
        const normal = new Normal();
        const detached = new Detached();
        normal.id = 'adopted-host-display';
        detached.id = 'adopted-detached-display';
        document.body.append(normal, detached);
        await settle(window);
        const normalController = (normal as any)._controller;
        const detachedController = (detached as any)._controller;
        const normalGeneration = (normal as any)._runtimeGeneration;
        const detachedGeneration = (detached as any)._runtimeGeneration;
        const before = {
          normal: getComputedStyle(normal).display,
          detached: getComputedStyle(detached).display,
        };
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument!;
        const foreignWindow = frame.contentWindow!;
        const clean = foreignDocument.getElementById('proto-ui-wc-host-display') === null;
        foreignDocument.adoptNode(normal);
        foreignDocument.body.append(normal);
        foreignDocument.adoptNode(detached);
        foreignDocument.body.append(detached);
        await settle(foreignWindow);
        const after = {
          normal: foreignWindow.getComputedStyle(normal).display,
          detached: foreignWindow.getComputedStyle(detached).display,
          detachedMarker: detached.hasAttribute('data-pui-view-detached'),
          ruleInstalled: foreignDocument.getElementById('proto-ui-wc-host-display') !== null,
          controllersRetained:
            (normal as any)._controller === normalController &&
            (detached as any)._controller === detachedController,
          generationsRetained:
            (normal as any)._runtimeGeneration === normalGeneration &&
            (detached as any)._runtimeGeneration === detachedGeneration,
          setups: [normalSetups, detachedSetups],
        };
        frame.remove();
        return { clean, before, after };
      });
      expect(result).toEqual({
        clean: true,
        before: { normal: 'block', detached: 'none' },
        after: {
          normal: 'block',
          detached: 'none',
          detachedMarker: true,
          ruleInstalled: true,
          controllersRetained: true,
          generationsRetained: true,
          setups: [1, 1],
        },
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
