// @vitest-environment node
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { createHostSurfaceProjection } from '@proto.ui/adapter-base';
import type { FOCUS_SET_ENTRY_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import type { createWebComponentModules } from '../src/runtime/modules';
import type { createWebComponentPortalMount } from '../src/portal-mount';
import { launchBrowser } from '../../../../apps/www/src/content/docs/zh-cn/browser-harness';

type NativeWindow = Window & {
  EntryPotential: {
    createModules: typeof createWebComponentModules;
    createSurface: typeof createHostSurfaceProjection;
    entryCap: typeof FOCUS_SET_ENTRY_FOCUSABLE_CAP;
    createPortal: typeof createWebComponentPortalMount;
  };
  entryPotentialCase: {
    target: HTMLElement;
    reveal(): void;
  };
};

let browser: Awaited<ReturnType<typeof launchBrowser>>;
let script: string;
beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `
        export { createWebComponentModules as createModules } from './packages/adapters/web-component/src/runtime/modules';
        export { createWebComponentPortalMount as createPortal } from './packages/adapters/web-component/src/portal-mount';
        export { createHostSurfaceProjection as createSurface } from '@proto.ui/adapter-base';
        export { FOCUS_SET_ENTRY_FOCUSABLE_CAP as entryCap } from '@proto.ui/module-focus';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'EntryPotential',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
  });
  script = result.outputFiles[0].text;
  browser = await launchBrowser();
}, 30_000);
afterAll(async () => {
  await browser?.close();
});

describe('WC entry stylesheet graph restoration in native Chrome', () => {
  it.each(['append', 'upgrade', 'late-root', 'portal'] as const)(
    'restores non-viewport media eligibility after %s creates the first candidate',
    async (mode) => {
      const page = await browser.newPage();
      try {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.addScriptTag({ content: script });
        const empty = await page.evaluate(async (mode) => {
          const win = window as unknown as NativeWindow;
          const api = win.EntryPotential;
          const target = document.createElement('div');
          const carrier = document.createElement('div');
          const css = '@media (prefers-reduced-motion: reduce) { button { visibility: hidden; } }';
          const style = document.createElement('style');
          style.textContent = css;
          document.head.append(style);
          const appendShadowButton = (element: HTMLElement) => {
            const root = element.attachShadow({ mode: 'open' });
            const shadowStyle = document.createElement('style');
            shadowStyle.textContent = css;
            root.append(shadowStyle, document.createElement('button'));
          };
          const name = 'entry-potential-native-carrier';
          let descendant: HTMLElement | undefined;
          if (mode === 'late-root') {
            customElements.define(name, class extends HTMLElement {});
            descendant = document.createElement(name);
            target.append(descendant);
          } else if (mode === 'upgrade') {
            descendant = document.createElement(name);
            target.append(descendant);
          } else if (mode === 'portal') target.append(carrier);
          document.body.append(target);
          const modules = api.createModules({
            el: target,
            surfaceProjection: api.createSurface(target),
            instanceToken: {} as never,
            router: { rootTarget: target, globalTarget: window },
            rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
            effectsPort: {} as never,
            textControlTarget: null,
            imageViewTarget: null,
            getMeta: () => undefined,
            setExposes() {},
            runInCallbackScope: (fn) => fn(),
            isViewReady: () => true,
            isEntryAcquisitionReady: () => true,
            subscribeTargetReady: () => () => {},
            retryTargetReady() {},
          });
          const set = modules.focus!({ prototypeName: 'entry-potential-native' }).find(
            ([key]) => key === api.entryCap
          )![1] as (
            target: HTMLElement,
            config: { strategy: 'descendant-first'; fallback: 'self' },
            enabled: boolean
          ) => void;
          set(target, { strategy: 'descendant-first', fallback: 'self' }, true);
          if (mode === 'portal') api.createPortal().mount(carrier);
          win.entryPotentialCase = {
            target,
            reveal() {
              if (mode === 'upgrade') {
                customElements.define(
                  name,
                  class extends HTMLElement {
                    constructor() {
                      super();
                      appendShadowButton(this);
                    }
                  }
                );
              } else if (mode === 'late-root') appendShadowButton(descendant!);
              else (mode === 'portal' ? carrier : target).append(document.createElement('button'));
            },
          };
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          );
          return target.getAttribute('tabindex');
        }, mode);
        expect(empty).toBe('0');
        await page.evaluate(() => (window as unknown as NativeWindow).entryPotentialCase.reveal());
        const sample = () =>
          page.evaluate(async () => {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
            return (window as unknown as NativeWindow).entryPotentialCase.target.getAttribute(
              'tabindex'
            );
          });
        expect(await sample()).toBe(null);
        // This changes a real MediaQueryList without a viewport resize, DOM
        // mutation, stylesheet edit or direct request to rebuild the graph.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        expect(await sample()).toBe('0');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        expect(await sample()).toBe(null);
      } finally {
        await page.close();
      }
    }
  );
});
