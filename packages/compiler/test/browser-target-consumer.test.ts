// @vitest-environment happy-dom
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { execFile } from 'node:child_process';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BrowserSourceAsset } from '../../../scripts/compiler/browser-assets';
import {
  compiledPreviewDocument,
  type BrowserTargetAssets,
} from '../../../apps/www/src/components/PrototypePreviewer/compiled-preview-sandbox';
import { compilePrototype } from '../src/memory';
import { prepareBrowserPreview, previewStyleTokens } from '../src/browser/preview-artifact';

const profiles = [
  'web-component-source-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
] as const;

/**
 * Executes the actual trusted preview launcher, framework bundles and generated
 * modules in the DOM test host. Only the import-map transport is replaced by an
 * esbuild closed-graph linker. This is not iframe, WASM or native-browser evidence.
 */
async function mountTarget(
  source: Pick<BrowserSourceAsset, 'source' | 'entry' | 'files' | 'sourceImports'>,
  target: BrowserTargetAssets,
  expectedFailure = false
) {
  const compiled = compilePrototype(source.source, {
    fileName: source.entry,
    files: source.files,
    sourceImports: source.sourceImports,
    profile: target.profile,
  });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const preview = prepareBrowserPreview(
    compiled.value.output,
    ['click'],
    previewStyleTokens(compiled.value.ir)
  );
  const revision = `consumer-${target.profile}`;
  const token = 'dom-consumer-fixture';
  const html = compiledPreviewDocument(preview, target, revision, token, [
    { props: { disabled: false }, text: '运行动作' },
    { props: { disabled: true }, text: '已禁用' },
  ]);
  const script = html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)![1];
  const payload = JSON.parse(script.match(/^const input=(.*);$/m)![1]);
  const modules: Record<string, string> = {
    ...target.modules,
    ...preview.modules,
    'pui:preview-budget': payload.budget,
  };
  // The launcher contains mutually exclusive target branches. Only unselected
  // framework imports are inert; every reached import must use its real bundle.
  for (const id of ['react', 'react-dom', 'react-dom/client', 'vue'])
    if (!(id in modules)) modules[id] = 'export default undefined;';
  const linked = await build({
    stdin: {
      contents: script.replace(
        'await import(input.preview.entry)',
        `await import(${JSON.stringify(preview.entry)})`
      ),
      sourcefile: 'actual-preview-launcher.js',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
    plugins: [
      {
        name: 'closed-preview-graph',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, ({ path }) => {
            if (!(path in modules)) throw new Error(`Unclosed preview import: ${path}`);
            return { path, namespace: 'preview' };
          });
          builder.onLoad({ filter: /.*/, namespace: 'preview' }, ({ path }) => ({
            contents: modules[path],
            loader: 'js',
          }));
        },
      },
    ],
  });
  const messages: Record<string, unknown>[] = [];
  const parent = { postMessage: (message: Record<string, unknown>) => messages.push(message) };
  // An isolated Window gives generated queueMicrotask failures real DOM error
  // event delivery. Vitest's global Window aliases Node's queueMicrotask and
  // disables that delivery, so it cannot stand in for this document's realm.
  const browser = new Window({
    url: 'http://preview.invalid/',
    settings: { disableErrorCapturing: false },
  });
  Object.defineProperty(browser, 'parent', { value: parent });
  const stage = browser.document.createElement('div');
  stage.id = 'stage';
  browser.document.body.append(stage);
  let objectURL = 0;
  class FixtureURL extends browser.URL {
    static createObjectURL() {
      return `blob:dom-fixture/${++objectURL}`;
    }
    static revokeObjectURL() {}
  }
  Object.defineProperty(browser, 'URL', { value: FixtureURL });
  let disposal: Promise<void> | undefined;
  const dispose = () =>
    (disposal ??= (async () => {
      try {
        browser.dispatchEvent(
          new browser.MessageEvent('message', {
            source: parent as never,
            data: { type: 'dispose', revision, token },
          })
        );
        await expect.poll(() => messages.some((message) => message.type === 'disposed')).toBe(true);
      } finally {
        await browser.happyDOM.abort();
        browser.close();
      }
    })());
  try {
    // The payload is inert source text. Only canonical generated JS and trusted
    // framework/launcher code are executed, just as in the product document.
    expect(browser.eval('[typeof require,typeof module,typeof exports,typeof process]')).toEqual([
      'undefined',
      'undefined',
      'undefined',
      'undefined',
    ]);
    browser.eval(linked.outputFiles[0].text);
    await expect
      .poll(() => messages.find((message) => /preview-(ready|error)/.test(String(message.type))))
      .toBeDefined();
    if (expectedFailure) {
      // A framework may catch lifecycle errors internally. Its ordinary error
      // hook must report that failure and must never publish a successful mount.
      await new Promise((resolve) =>
        browser.requestAnimationFrame(() => browser.requestAnimationFrame(resolve))
      );
      expect(messages.filter((message) => message.type === 'preview-error')).toEqual([
        expect.objectContaining({ message: 'mount failure control' }),
      ]);
      expect(messages.some((message) => message.type === 'preview-ready')).toBe(false);
    } else {
      expect(messages.filter((message) => message.type === 'preview-error')).toEqual([]);
      expect(messages.some((message) => message.type === 'preview-ready')).toBe(true);
    }
    return { stage: stage as unknown as HTMLElement, messages, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

describe('actual browser target bundles and generated consumers', () => {
  let assets: Map<string, string>;
  let source: BrowserSourceAsset;
  beforeAll(async () => {
    // Build with the real Node toolchain, outside the DOM host's URL globals.
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `const {buildBrowserTargets,readBrowserSource}=await import('./scripts/compiler/browser-assets.ts');
const targets=await buildBrowserTargets();
console.log(JSON.stringify({assets:[...targets.assets],source:await readBrowserSource('base-button')}));`,
      ],
      {
        cwd: fileURLToPath(new NodeURL('../../../', import.meta.url)),
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    const prepared = JSON.parse(stdout);
    assets = new Map(prepared.assets);
    source = prepared.source;
  }, 30_000);

  for (const profile of profiles)
    it(`${profile} links, renders caller content, delivers enabled actions and retires`, async () => {
      const target: BrowserTargetAssets = JSON.parse(assets.get(`targets/${profile}.json`)!);
      const fixture = await mountTarget(source, target);
      try {
        const buttons = [...fixture.stage.querySelectorAll<HTMLElement>('[role="button"]')];
        expect(buttons.map((button) => button.textContent)).toEqual(['运行动作', '已禁用']);
        expect(buttons[1].getAttribute('aria-disabled')).toBe('true');
        buttons[0].click();
        buttons[1].click();
        expect(fixture.messages.filter((message) => message.type === 'preview-event')).toEqual([
          expect.objectContaining({ name: 'click', index: 0 }),
        ]);
        await fixture.dispose();
        buttons[0].click();
        expect(fixture.messages.filter((message) => message.type === 'preview-event')).toHaveLength(
          1
        );
        expect(fixture.messages.some((message) => message.type === 'disposed')).toBe(true);
        expect(fixture.messages.filter((message) => message.type === 'cleanup-error')).toEqual([]);
      } finally {
        await fixture.dispose();
      }
    });

  for (const profile of ['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1'])
    it(`${profile} reports both framework-caught mount failures without ready`, async () => {
      const target: BrowserTargetAssets = JSON.parse(assets.get(`targets/${profile}.json`)!);
      const fixture = await mountTarget(
        {
          source: `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'broken-owner',setup(def){
  def.lifecycle.onMounted(()=>{throw 'mount failure control';});
}});`,
          entry: 'mount-failure.proto.ts',
          files: {},
          sourceImports: {},
        },
        target,
        true
      );
      await fixture.dispose();
      expect(fixture.messages.some((message) => message.type === 'disposed')).toBe(true);
      expect(fixture.messages.filter((message) => message.type === 'cleanup-error')).toEqual([
        expect.objectContaining({ message: 'Secondary preview error: mount failure control' }),
      ]);
    });

  for (const profile of ['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1'])
    for (const hook of ['onUnmounted', 'onBeforeDispose'])
      it(`${profile} preserves both owners' ${hook} failures before disposal acknowledgement`, async () => {
        const target: BrowserTargetAssets = JSON.parse(assets.get(`targets/${profile}.json`)!);
        const fixture = await mountTarget(
          {
            source: `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'cleanup-owner',setup(def){
  def.props.define({disabled:{type:'boolean',default:false}});
  let disabled=false;
  def.lifecycle.onCreated(run=>{disabled=run.props.get().disabled;});
  def.lifecycle.${hook}(()=>{throw disabled ? 'disabled cleanup control' : 'enabled cleanup control';});
}});`,
            entry: 'cleanup-failure.proto.ts',
            files: {},
            sourceImports: {},
          },
          target
        );
        try {
          await fixture.dispose();
          const failures = fixture.messages.filter((message) => message.type === 'cleanup-error');
          expect(failures).toHaveLength(1);
          expect(String(failures[0].message).split(' | ').sort()).toEqual([
            'Cleanup error: disabled cleanup control',
            'Cleanup error: enabled cleanup control',
          ]);
          expect(fixture.messages.filter((message) => message.type === 'preview-error')).toEqual(
            []
          );
          expect(fixture.messages.indexOf(failures[0])).toBeLessThan(
            fixture.messages.findIndex((message) => message.type === 'disposed')
          );
        } finally {
          await fixture.dispose();
        }
      });

  for (const profile of ['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1'])
    it(`${profile} retains the primary mount failure and separate cleanup failures`, async () => {
      const target: BrowserTargetAssets = JSON.parse(assets.get(`targets/${profile}.json`)!);
      const fixture = await mountTarget(
        {
          source: `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'failed-mount-and-cleanup',setup(def){
  def.props.define({disabled:{type:'boolean',default:false}});
  let disabled=false;
  def.lifecycle.onCreated(run=>{disabled=run.props.get().disabled;});
  def.lifecycle.onMounted(()=>{if(!disabled)throw 'mount failure control';});
  def.lifecycle.onBeforeDispose(()=>{throw disabled ? 'disabled cleanup control' : 'enabled cleanup control';});
}});`,
          entry: 'mount-and-cleanup-failure.proto.ts',
          files: {},
          sourceImports: {},
        },
        target,
        true
      );
      try {
        await fixture.dispose();
        expect(fixture.messages.filter((message) => message.type === 'preview-error')).toEqual([
          expect.objectContaining({ message: 'mount failure control' }),
        ]);
        const failures = fixture.messages.filter((message) => message.type === 'cleanup-error');
        expect(failures).toHaveLength(1);
        expect(
          String(failures[0].message)
            .split(' | ')
            .map((message) => message.replace(/^(?:Cleanup error|Secondary preview error): /, ''))
            .sort()
        ).toEqual(['disabled cleanup control', 'enabled cleanup control']);
        expect(fixture.messages.indexOf(failures[0])).toBeLessThan(
          fixture.messages.findIndex((message) => message.type === 'disposed')
        );
      } finally {
        await fixture.dispose();
      }
    });
});
