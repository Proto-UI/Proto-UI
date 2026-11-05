// @vitest-environment node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type { Browser, Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { emitVue2Source } from '../src/vue2-source';
import type { GeneratedModule, PrototypeIR } from '../src/ir';
import { editingInput, physicalRootInput } from './vue2-native-editor-fixtures';

interface NativeObservation {
  tagName: string;
  value: string;
  defaultValue: string;
  rows?: number;
  readOnly: boolean;
  placeholder: string;
  minLength: string | null;
  rootMarker: string | null;
  selection: [number | null, number | null];
  data: { style?: string; attrs: Record<string, unknown> };
}
interface EditorBridge {
  observe(label: string): NativeObservation;
  setProps(patch: Record<string, string | boolean>): Promise<void>;
  repaint(): Promise<void>;
  holdEditor(): void;
  staleInput(value: string): boolean;
  trace: unknown[];
}
declare global {
  interface Window {
    __nativeEditor: EditorBridge;
  }
}

const handoff = 'if (commit.vnode.data?.domProps) delete commit.vnode.data.domProps.value;';
const bundles = new Map<string, string>();
let browser: Browser;
let baseUrl: string;
let evidenceDir: string;
let sequence = 0;
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const bundle = bundles.get(url.pathname);
  response.setHeader('Cache-Control', 'no-store');
  if (bundle !== undefined) {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundle);
  } else if (url.pathname === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><meta charset="utf-8"><title>Native Vue2 editor consumer</title>');
  } else {
    response.statusCode = 404;
    response.end();
  }
});

beforeAll(async () => {
  evidenceDir = process.env.COMPILER_EVIDENCE_DIR
    ? path.join(path.resolve(process.env.COMPILER_EVIDENCE_DIR), 'vue2-native-editor')
    : await mkdtemp(path.join(tmpdir(), 'compiler-vue2-native-editor-'));
  await mkdir(evidenceDir, { recursive: true });
  const listening = Promise.withResolvers<void>();
  server.once('error', listening.reject);
  server.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Native fixture has no TCP address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
}, 30_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    if (server.listening) {
      const closed = Promise.withResolvers<void>();
      server.close((error) => (error ? closed.reject(error) : closed.resolve()));
      await closed.promise;
    }
  }
});

async function consumer(
  input: PrototypeIR,
  removeHandoff: boolean,
  journey: (page: Page, module: GeneratedModule) => Promise<void>
) {
  const directory = path.join(evidenceDir, `consumer-${++sequence}`);
  await mkdir(directory, { recursive: true });
  const result = emitVue2Source(input);
  await writeFile(path.join(directory, 'input.json'), JSON.stringify(input, null, 2), {
    flag: 'wx',
  });
  await writeFile(path.join(directory, 'module.json'), JSON.stringify(result, null, 2), {
    flag: 'wx',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  if (removeHandoff && !result.value.code.includes(handoff))
    throw new Error('Native handoff mutation did not match');
  const module = removeHandoff
    ? { ...result.value, code: result.value.code.replace(handoff, '') }
    : result.value;
  const files = [
    { path: 'Component.js', contents: module.code },
    ...(module.supportingFiles ?? []),
  ];
  for (const file of files) {
    const destination = path.join(directory, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.contents, { flag: 'wx' });
  }
  // An ordinary consumer of the emitted component. The bridge only drives native
  // framework props/updates and observes physical DOM; it does not implement Text.
  const entry = `import Vue from 'vue';
import Component from './Component.js';
const props=Vue.observable({value:'seed',seed:'seed',hint:'before',present:true});
const app=new Vue({render(h){return h(Component,{props:{...props}});}}).$mount();
document.body.append(app.$el);
const child=app.$children[0], trace=[];
let held;
const settle=async()=>{await Vue.nextTick();await Vue.nextTick();await Promise.resolve();};
function observe(label){
 const root=child.$el;
 if(!(root instanceof HTMLInputElement||root instanceof HTMLTextAreaElement))throw new Error('Physical native editor absent');
 const value={tagName:root.tagName,value:root.value,defaultValue:root.defaultValue,rows:root instanceof HTMLTextAreaElement?root.rows:undefined,readOnly:root.readOnly,placeholder:root.placeholder,minLength:root.getAttribute('minlength'),rootMarker:root.getAttribute('data-pui-root'),selection:[root.selectionStart,root.selectionEnd],data:{style:child._vnode.data.style,attrs:child._vnode.data.attrs}};
 trace.push({label,value});return value;
}
window.__nativeEditor={trace,observe,
 async setProps(patch){Object.assign(props,patch);await settle();},
 async repaint(){child.$forceUpdate();await settle();},
 holdEditor(){held=child.$el;},
 staleInput(value){if(!held)throw new Error('Missing retired editor');held.value=value;held.dispatchEvent(new InputEvent('input',{bubbles:true}));return held.isConnected;}
};
await settle();
window.__nativeEditor.observe('mounted');
`;
  const entryFile = path.join(directory, 'Consumer.js');
  await writeFile(entryFile, entry, { flag: 'wx' });
  const vue2 = createRequire(
    fileURLToPath(new URL('../../adapters/vue2/package.json', import.meta.url))
  );
  const bundled = await build({
    entryPoints: [entryFile],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    alias: { vue: vue2.resolve('vue/dist/vue.runtime.esm.js') },
    metafile: true,
  });
  const javascript = bundled.outputFiles[0].text;
  await writeFile(path.join(directory, 'consumer-bundle.js'), javascript, { flag: 'wx' });
  await writeFile(
    path.join(directory, 'bundle-graph.json'),
    JSON.stringify(bundled.metafile, null, 2),
    { flag: 'wx' }
  );
  const route = `/consumer-${sequence}.js`;
  bundles.set(route, javascript);
  const page = await browser.newPage({ viewport: { width: 700, height: 400 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === baseUrl
      ? route.continue()
      : route.abort('blockedbyclient')
  );
  try {
    await page.goto(baseUrl);
    await page.addScriptTag({ type: 'module', url: baseUrl + route });
    await page.waitForFunction(() => Boolean(window.__nativeEditor?.trace.length));
    await journey(page, module);
    expect(errors).toEqual([]);
  } finally {
    const trace = await page.evaluate(() => window.__nativeEditor?.trace ?? []);
    await writeFile(
      path.join(directory, 'native-observations.json'),
      JSON.stringify(
        {
          test: expect.getState().currentTestName,
          browser: browser.version(),
          input: input.source,
          componentSha256: createHash('sha256').update(module.code).digest('hex'),
          removeHandoff,
          errors,
          trace,
        },
        null,
        2
      ),
      { flag: 'wx' }
    );
    await page.screenshot({ path: path.join(directory, 'native.png') });
    await page.close();
    bundles.delete(route);
  }
}

function nativeField(object: unknown, name: string): unknown {
  if (!object || typeof object !== 'object') throw new Error(`Missing native observation ${name}`);
  return Reflect.get(object, name);
}

describe('Vue2 compile-time root-data demand in Chrome (replacement physical Text oracle)', () => {
  it('preserves legal physical root attributes and style: text', async () => {
    await consumer(physicalRootInput('text'), false, async (page, module) => {
      const root = await page.evaluate(() => window.__nativeEditor.observe('physical-properties'));
      const data = root.data;
      expect(module.code).toContain('function __puiRootData(');
      expect(root.rootMarker).toBe('');
      expect(root.tagName).toBe('TEXTAREA');
      expect(nativeField(data, 'style')).toBeUndefined();
      expect(nativeField(data, 'attrs')).toMatchObject({
        rows: 3,
        minLength: null,
        placeholder: 'hint',
        readOnly: '',
      });
      expect(nativeField(root, 'value')).toBe('seed');
      expect(nativeField(root, 'rows')).toBe(3);
      expect(nativeField(root, 'readOnly')).toBe(true);
      expect(root.minLength).toBeNull();
      expect(root.placeholder).toBe('hint');
    });
  });

  for (const lineMode of ['single', 'multiline'] as const) {
    it(`retains uncontrolled editing through repaint, props and a new native view: ${lineMode}`, async () => {
      await consumer(editingInput(lineMode, false), false, async (page) => {
        const editor = page.locator('input,textarea');
        expect((await page.evaluate(() => window.__nativeEditor.observe('initial'))).value).toBe(
          'seed'
        );
        await editor.fill('edited');
        await editor.evaluate((element) => {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
            element.setSelectionRange(1, 4);
        });
        await page.evaluate(() => window.__nativeEditor.repaint());
        const repainted = await page.evaluate(() => window.__nativeEditor.observe('repainted'));
        expect(repainted.value).toBe('edited');
        expect(repainted.selection).toEqual([1, 4]);
        await page.evaluate(() =>
          window.__nativeEditor.setProps({ seed: 'later-default', hint: 'after' })
        );
        const patched = await page.evaluate(() => window.__nativeEditor.observe('props'));
        expect(patched.value).toBe('edited');
        expect(patched.defaultValue).toBe('later-default');
        expect(patched.placeholder).toBe('after');
        await page.evaluate(() => window.__nativeEditor.holdEditor());
        await page.evaluate(() => window.__nativeEditor.setProps({ present: false }));
        expect(await editor.count()).toBe(0);
        expect(await page.evaluate(() => window.__nativeEditor.staleInput('stale'))).toBe(false);
        await page.evaluate(() => window.__nativeEditor.setProps({ present: true }));
        expect((await page.evaluate(() => window.__nativeEditor.observe('remounted'))).value).toBe(
          'edited'
        );
      });
    });

    it(`preserves controlled synchronization and composition through repaint and remount: ${lineMode}`, async () => {
      await consumer(editingInput(lineMode, true), false, async (page) => {
        const editor = page.locator('input,textarea');
        expect((await page.evaluate(() => window.__nativeEditor.observe('initial'))).value).toBe(
          'seed'
        );
        await editor.fill('proposal');
        await page.evaluate(() => window.__nativeEditor.repaint());
        expect(
          (await page.evaluate(() => window.__nativeEditor.observe('proposal-restored'))).value
        ).toBe('seed');
        // Synthetic composition facts in a real browser, not an OS IME claim.
        await editor.evaluate((element) => {
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement))
            throw new Error('Missing editor');
          element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
          element.value = 'composing';
          element.dispatchEvent(
            new InputEvent('input', { bubbles: true, data: 'composing', isComposing: true })
          );
        });
        await page.evaluate(() => window.__nativeEditor.setProps({ hint: 'during-ime' }));
        await page.evaluate(() => window.__nativeEditor.repaint());
        expect(
          (await page.evaluate(() => window.__nativeEditor.observe('composing-repaint'))).value
        ).toBe('composing');
        await page.evaluate(() => window.__nativeEditor.setProps({ value: 'accepted' }));
        expect(
          (await page.evaluate(() => window.__nativeEditor.observe('composing-sync'))).value
        ).toBe('composing');
        await editor.dispatchEvent('compositionend', { bubbles: true, data: 'composing' });
        await page.evaluate(() => window.__nativeEditor.repaint());
        expect(
          (await page.evaluate(() => window.__nativeEditor.observe('composition-ended'))).value
        ).toBe('accepted');
        await page.evaluate(() => window.__nativeEditor.holdEditor());
        await page.evaluate(() => window.__nativeEditor.setProps({ present: false }));
        expect(await editor.count()).toBe(0);
        expect(await page.evaluate(() => window.__nativeEditor.staleInput('stale'))).toBe(false);
        await page.evaluate(() => window.__nativeEditor.setProps({ present: true }));
        expect((await page.evaluate(() => window.__nativeEditor.observe('remounted'))).value).toBe(
          'accepted'
        );
      });
    });
  }

  it('detects removal of only the native value handoff with the native Vue2 patcher', async () => {
    await consumer(editingInput('multiline', false), true, async (page) => {
      await page.evaluate(() => window.__nativeEditor.repaint());
      expect(
        (await page.evaluate(() => window.__nativeEditor.observe('handoff-removed'))).value
      ).toBe('');
    });
  });
});
