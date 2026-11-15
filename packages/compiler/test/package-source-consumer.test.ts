// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Vue from 'vue';
import { expect, it } from 'vitest';
import { compileFile, writeCompilation } from '../src/compile';

it('imports a separately installed authored source package into an ordinary reactive Vue tree', async () => {
  const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'package-consumer-'));
  const root = path.join(directory, 'consumer');
  const packageRoot = path.join(root, 'node_modules/ordinary-library');
  const output = path.join(directory, 'output');
  let app: Vue.App | undefined;
  try {
    await mkdir(path.join(packageRoot, 'src'), { recursive: true });
    await writeFile(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: 'ordinary-library',
        exports: { '.': { proto: './src/index.ts', default: './dist/index.js' } },
      })
    );
    await writeFile(
      path.join(packageRoot, 'src/index.ts'),
      `export {default} from './counter.proto';`
    );
    await writeFile(
      path.join(packageRoot, 'src/counter.proto.ts'),
      `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'published-counter',setup(def){
  def.props.define({seed:{type:'number',default:1}});
  const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);
  def.expose.event('disposed',{payload:'void'});
  def.lifecycle.onCreated(run=>{count.set(run.props.get().seed);});
  def.props.watch(['seed'],(run,next)=>{count.set(next.seed);run.update();});
  def.lifecycle.onBeforeDispose(run=>{run.expose.emit('disposed');});
  return r=>r.el('output',[count.get(),r.slot()]);
}});`
    );
    await writeFile(
      path.join(root, 'entry.proto.ts'),
      `import Published from 'ordinary-library';export {Published as default};`
    );
    const compiled = await compileFile('entry.proto.ts', { root, profile: 'vue-source-v1' });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const written = await writeCompilation(compiled.value, output);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    const { default: Component } = await import(
      /* @vite-ignore */ path.join(output, 'Component.ts')
    );
    const seed = Vue.ref(2);
    const visible = Vue.ref(true);
    let disposals = 0;
    const container = document.createElement('main');
    document.body.append(container);
    const NativeWrapper = Vue.defineComponent({
      setup(_props, { slots }) {
        return () => Vue.h('article', slots.default?.());
      },
    });
    app = Vue.createApp({
      setup() {
        return () =>
          Vue.h(NativeWrapper, null, {
            default: () =>
              visible.value
                ? Vue.h(
                    Component,
                    { seed: seed.value, onDisposed: () => disposals++ },
                    {
                      default: () =>
                        Vue.h('button', { onClick: () => seed.value++ }, 'native increment'),
                    }
                  )
                : Vue.h('span', 'unmounted'),
          });
      },
    });
    app.mount(container);
    await Vue.nextTick();
    expect(container.querySelector('article output')?.textContent).toBe('2native increment');
    container.querySelector<HTMLButtonElement>('button')!.click();
    await Vue.nextTick();
    await Vue.nextTick();
    expect(container.querySelector('output')?.textContent).toBe('3native increment');
    for (const next of [7, 11]) {
      seed.value = next;
      await Vue.nextTick();
      await Vue.nextTick();
      expect(container.querySelector('output')?.textContent).toBe(`${next}native increment`);
    }
    visible.value = false;
    await Vue.nextTick();
    expect(disposals).toBe(1);
    seed.value = 17;
    visible.value = true;
    await Vue.nextTick();
    expect(container.querySelector('output')?.textContent).toBe('17native increment');
    app.unmount();
    app = undefined;
    expect(disposals).toBe(2);
    container.remove();
  } finally {
    app?.unmount();
    document.body.replaceChildren();
    await rm(directory, { recursive: true, force: true });
  }
});
