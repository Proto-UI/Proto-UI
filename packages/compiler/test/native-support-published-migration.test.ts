// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { build } from 'esbuild';
import Vue2, { type ComponentOptions } from '../../adapters/vue2/node_modules/vue';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCompilerCli } from '../src/cli';
import { migrateNativeSupport } from '../src/native-support-migration';
import { IR_VERSION } from '../src/ir';

const require = createRequire(import.meta.url);
const temporary: string[] = [];
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
interface Capture {
  version: 1;
  origin: 'actual-fixed-compiler-cli';
  blobs: Record<string, string>;
  records: Record<
    string,
    {
      compilerCommit: string;
      source: string;
      sourceSHA256: string;
      cli: { code: number; stdout: string; stderr: string };
      files: Record<string, string>;
      provenanceSHA256: string;
    }
  >;
}
let capture: Capture;
const slotlessSources = {
  'slotless-label': `import {definePrototype} from '@proto.ui/core';
    import {asControlLabel} from '@proto.ui/hooks';
    export default definePrototype({name:'slotless-caption',setup(def){
      const label=asControlLabel().label();
      def.lifecycle.onCreated(()=>label.sync({naming:true,activation:true}));
      return r=>r.el('span','Current control name');
    }});`,
  'slotless-target': `import {definePrototype} from '@proto.ui/core';
    import {asControlLabel} from '@proto.ui/hooks';
    export default definePrototype({name:'slotless-command',setup(def){
      def.expose.event('commit',{payload:'void'});
      asControlLabel().target((run,request)=>{if(request.isCurrent())run.expose.emit('commit');});
      return r=>r.el('button','Command');
    }});`,
};
async function fresh() {
  const directory = await mkdtemp(path.join(tmpdir(), 'pui-published-migration-'));
  temporary.push(directory);
  return directory;
}
async function inventory(directory: string, prefix = ''): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const file of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = path.posix.join(prefix, file.name);
    if (file.isDirectory()) Object.assign(entries, await inventory(directory, name));
    else entries[name] = digest(await readFile(path.join(directory, name)));
  }
  return entries;
}
async function restore(directory: string, id: string) {
  const record = capture.records[id];
  expect(record.cli).toMatchObject({ code: 0, stderr: '' });
  expect(JSON.parse(record.cli.stdout)).toMatchObject({ ok: true, command: 'compile' });
  expect(digest(record.source)).toBe(record.sourceSHA256);
  for (const [filename, expected] of Object.entries(record.files)) {
    const contents = capture.blobs[expected];
    expect(digest(contents)).toBe(expected);
    const target = path.join(directory, id, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, { flag: 'wx' });
  }
  expect(await inventory(path.join(directory, id))).toEqual(record.files);
  const manifest = JSON.parse(capture.blobs[record.provenanceSHA256]);
  expect(manifest.irVersion).toBe(id === 'legacy-transition' ? 5 : 6);
  for (const file of manifest.artifacts) expect(record.files[file.path]).toBe(file.sha256);
}
async function plan(directory: string, ids: readonly string[]) {
  const filename = path.join(directory, 'plan.json');
  await writeFile(
    filename,
    JSON.stringify({
      version: 1,
      inputs: await Promise.all(
        ids.map(async (id) => ({
          id,
          directory: id,
          provenanceSHA256: digest(await readFile(path.join(directory, id, 'provenance.json'))),
        }))
      ),
    })
  );
  return filename;
}
async function cli(directory: string, args: string[]) {
  let stdout = '',
    stderr = '';
  const code = await runCompilerCli(args, {
    cwd: directory,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}
beforeAll(async () => {
  capture = JSON.parse(
    await readFile(
      fileURLToPath(
        new NodeURL('./fixtures/native-support-published-captures.json', import.meta.url)
      ),
      'utf8'
    )
  );
  expect(capture).toMatchObject({ version: 1, origin: 'actual-fixed-compiler-cli' });
  expect(capture.records['legacy-transition'].compilerCommit).toBe(
    'ce56274971f51590c8bccb33c1a2763637a88fc5'
  );
  for (const id of ['label', 'target', 'ordinary'])
    expect(capture.records[id].compilerCommit).toBe('08d8f9d9513003dab8b7ee2faf11609ad3ba1f84');
  for (const [expected, body] of Object.entries(capture.blobs)) expect(digest(body)).toBe(expected);
});
afterAll(async () => {
  await Promise.all(temporary.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('fixed published CLI support migration', () => {
  it('rejects an actual legacy Transition component before any output writes and preserves its bytes', async () => {
    const directory = await fresh();
    await restore(directory, 'ordinary');
    await restore(directory, 'legacy-transition');
    const filename = await plan(directory, ['ordinary', 'legacy-transition']);
    const before = await inventory(directory);
    const output = path.join(directory, 'migrated');
    let opened = 0;
    const result = await migrateNativeSupport(filename, output, async (target) => {
      opened++;
      return open(target, 'wx');
    });
    expect(result.ok).toBe(false);
    expect(opened).toBe(0);
    if (!result.ok)
      expect(
        result.diagnostics.some((diagnostic) =>
          /Legacy asTransition host protocol requires recompiling/.test(diagnostic.message)
        )
      ).toBe(true);
    const command = await cli(directory, [
      'migrate-native-support',
      'plan.json',
      '--output',
      'migrated',
      '--json',
    ]);
    expect(command).toMatchObject({ code: 1, stderr: '' });
    expect(command.stdout).toContain('requires recompiling its authored source');
    await expect(lstat(output)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await inventory(directory)).toEqual(before);
  });

  it('migrates exact IR6 ControlLabel and ordinary factories into a complete current ABI', async () => {
    const directory = await fresh();
    for (const id of ['ordinary', 'label', 'target']) await restore(directory, id);
    const currentInputs = {
      'new-label': capture.records.label.source,
      'new-target': capture.records.target.source,
      ...slotlessSources,
    };
    for (const [id, source] of Object.entries(currentInputs)) {
      const filename = path.join(directory, id + '.proto.ts');
      await writeFile(filename, source);
      const command = await cli(directory, [
        'compile',
        filename,
        '--root',
        directory,
        '--profile',
        'vue2-source-v1',
        '--output',
        id,
        '--json',
      ]);
      expect(command).toMatchObject({ code: 0, stderr: '' });
      const manifest = JSON.parse(
        await readFile(path.join(directory, id, 'provenance.json'), 'utf8')
      );
      expect(manifest.irVersion).toBe(IR_VERSION);
      expect(manifest.nativeSupport.features).toContain('control-label');
    }
    const ids = ['ordinary', 'label', 'target', ...Object.keys(currentInputs)];
    await plan(directory, ids);
    const before = await inventory(directory);
    const output = path.join(await fresh(), 'linked');
    const command = await cli(directory, [
      'migrate-native-support',
      'plan.json',
      '--output',
      output,
      '--json',
    ]);
    expect(command, command.stdout).toMatchObject({ code: 0, stderr: '' });
    for (const id of ids)
      for (const filename of ['Component.js', 'Component.js.map'])
        expect(await readFile(path.join(output, id, filename))).toEqual(
          await readFile(path.join(directory, id, filename))
        );
    expect(await inventory(directory)).toEqual(before);
    const shared = await inventory(path.join(output, '.proto-ui/shared/interaction'));
    expect(Object.keys(shared)).toContain('control-label-v1.ts');
    expect(Object.keys(shared)).toContain('control-label-types-v1.ts');
    for (const file of Object.keys(shared))
      expect(
        await readFile(path.join(output, '.proto-ui/shared/interaction', file), 'utf8')
      ).not.toMatch(/asTransition|declareTransition/);

    // Independent native consumers import the written output graph through the
    // real bundler. No virtual support, injected registry or component rewrite.
    const vueEntry = createRequire(
      fileURLToPath(new NodeURL('../../adapters/vue2/package.json', import.meta.url))
    ).resolve('vue');
    const floatingEntry = createRequire(
      fileURLToPath(new NodeURL('../../modules/positioning/package.json', import.meta.url))
    ).resolve('@floating-ui/dom');
    const outfile = path.join(await fresh(), 'consumer.cjs');
    const built = await build({
      stdin: {
        contents: `export {default as oldLabel} from './label/Component.js';
        export {default as oldTarget} from './target/Component.js';
        export {default as newLabel} from './new-label/Component.js';
        export {default as newTarget} from './new-target/Component.js';
        export {default as slotlessLabel} from './slotless-label/Component.js';
        export {default as slotlessTarget} from './slotless-target/Component.js';
        export {createControlLabelRef} from './.proto-ui/shared/interaction/control-label-v1';`,
        resolveDir: output,
        sourcefile: 'ordinary-consumer.ts',
        loader: 'ts',
      },
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node24',
      metafile: true,
      alias: { vue: vueEntry, '@floating-ui/dom': floatingEntry },
      external: [vueEntry],
      logLevel: 'silent',
    });
    expect(
      Object.keys(built.metafile!.inputs).filter(
        (filename) => filename.endsWith('/control-label-v1.ts') && filename.includes('/shared/')
      )
    ).toHaveLength(1);
    const modules = require(outfile) as {
      oldLabel: ComponentOptions<Vue2>;
      oldTarget: ComponentOptions<Vue2>;
      newLabel: ComponentOptions<Vue2>;
      newTarget: ComponentOptions<Vue2>;
      slotlessLabel: ComponentOptions<Vue2>;
      slotlessTarget: ComponentOptions<Vue2>;
      createControlLabelRef(): object;
    };
    for (const [Label, Target, slots] of [
      [modules.oldLabel, modules.newTarget, true],
      [modules.newLabel, modules.oldTarget, true],
      [modules.slotlessLabel, modules.slotlessTarget, false],
    ] as const) {
      let association = Object.freeze({ controlLabel: modules.createControlLabelRef() });
      let visible = true,
        commits = 0;
      const errors: unknown[] = [],
        previousHandler = Vue2.config.errorHandler;
      Vue2.config.errorHandler = (error) => {
        errors.push(error);
      };
      const app = new Vue2({
        render(h) {
          return h('article', [
            h(
              'section',
              visible
                ? [
                    h(
                      Label,
                      { ref: 'caption', props: { instanceAssociations: association } },
                      slots ? ['Published control name'] : undefined
                    ),
                  ]
                : []
            ),
            h('div', [
              h(
                Target,
                {
                  ref: 'command',
                  props: { instanceAssociations: association },
                  on: {
                    commit: () => {
                      commits++;
                    },
                  },
                },
                slots ? ['Command'] : undefined
              ),
            ]),
          ]);
        },
      }).$mount();
      document.body.append(app.$el);
      const flush = async () => {
        await Vue2.nextTick();
        for (let turn = 0; turn < 8; turn++) await Promise.resolve();
        await new Promise<void>((resolve) => {
          const probe = document.createElement('span');
          const observer = new MutationObserver(() => {
            observer.disconnect();
            resolve();
          });
          observer.observe(probe, { attributes: true });
          probe.setAttribute('data-flush', '');
        });
      };
      const click = (label: Element) => {
        for (const type of ['pointerdown', 'pointerup'])
          label.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              composed: true,
              cancelable: true,
              pointerType: 'mouse',
              pointerId: 1,
              button: 0,
              clientX: 10,
              clientY: 10,
            })
          );
        label.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            composed: true,
            cancelable: true,
            button: 0,
            detail: 1,
            clientX: 10,
            clientY: 10,
          })
        );
      };
      try {
        await flush();
        expect(errors).toEqual([]);
        const label = (app.$refs.caption as Vue2).$el,
          target = (app.$refs.command as Vue2).$el;
        expect(target.getAttribute('aria-labelledby')).toBe(label.id);
        expect(label.id).not.toBe('');
        click(label);
        await flush();
        expect(commits).toBe(1);
        association = Object.freeze({ controlLabel: modules.createControlLabelRef() });
        app.$forceUpdate();
        await flush();
        click((app.$refs.caption as Vue2).$el);
        await flush();
        expect(
          commits,
          slots
            ? 'migrated historical slot composition rebinds'
            : 'current slotless composition rebinds without a slot-forced update'
        ).toBe(2);
        const retired = (app.$refs.caption as Vue2).$el;
        visible = false;
        app.$forceUpdate();
        await flush();
        expect((app.$refs.command as Vue2).$el.hasAttribute('aria-labelledby')).toBe(false);
        click(retired);
        await flush();
        expect(commits).toBe(2);
        visible = true;
        app.$forceUpdate();
        await flush();
        const remounted = (app.$refs.caption as Vue2).$el;
        expect((app.$refs.command as Vue2).$el.getAttribute('aria-labelledby')).toBe(remounted.id);
        click(remounted);
        await flush();
        expect(commits).toBe(3);
      } finally {
        app.$destroy();
        app.$el.remove();
        await flush();
        Vue2.config.errorHandler = previousHandler;
      }
      expect(errors).toEqual([]);
    }
  });
});
