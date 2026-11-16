// @vitest-environment happy-dom
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { compileProject } from '../src/project';
import { writeProjectCompilation } from '../src/project-output';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Handle = { update(): void; getExposes(): { count: { get(): number } } };
type Component = React.ForwardRefExoticComponent<
  Record<string, unknown> & React.RefAttributes<Handle>
>;
const directories: string[] = [];
const roots: Root[] = [];
afterEach(async () => {
  await React.act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

const sources = {
  'keys.ts': `import {createContextKey} from '@proto.ui/core';
    export const KEY=createContextKey<{value:number}>('same-debug-name');
    export const OTHER=createContextKey<{value:number}>('same-debug-name');`,
  'bridge.ts': `export {KEY as ALIAS, OTHER} from './keys';`,
  'provider.proto.ts': `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
    export default definePrototype({name:'provider',setup(def){
      def.props.define({seed:{type:'number',default:1}});
      def.context.provide(KEY,{value:1});
      def.lifecycle.onCreated(run=>{run.context.update(KEY,{value:run.props.get().seed ?? 1});});
      def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed ?? 1});});
      return r=>r.el('section',r.slot());
    }});`,
  'consumer.proto.ts': `import {definePrototype} from '@proto.ui/core';import {ALIAS} from './bridge';
    export default definePrototype({name:'consumer',setup(def){
      const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);
      def.context.subscribe(ALIAS,(_run,next)=>{count.set(next.value);});
      def.lifecycle.onCreated(run=>{count.set(run.context.read(ALIAS).value);});
      return r=>r.el('output',r.read.context.read(ALIAS).value);
    }});`,
  ...Object.fromEntries(
    ['KEY', 'OTHER'].map((key) => [
      `${key.toLowerCase()}.proto.ts`,
      `import {definePrototype} from '@proto.ui/core';import {${key}} from './keys';
    export default definePrototype({name:'optional-${key.toLowerCase()}',setup(def){
      const count=def.state.numberDiscrete('count',0);def.expose.state('count',count);
      def.context.trySubscribe(${key},(_run,next)=>{count.set(next?.value ?? -1);});
      def.lifecycle.onCreated(run=>{count.set(run.context.tryRead(${key})?.value ?? -1);});
      return r=>r.el('output',r.read.context.tryRead(${key})?.value ?? 'missing');
    }});`,
    ])
  ),
};
const sourcePaths = {
  'provider.proto.ts': 'Provider.tsx',
  'consumer.proto.ts': 'Consumer.tsx',
  'key.proto.ts': 'Optional.tsx',
  'other.proto.ts': 'Other.tsx',
};

async function fixture() {
  const directory = await mkdtemp(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules', 'project-context-')
  );
  directories.push(directory);
  const root = path.join(directory, 'author');
  await mkdir(root);
  for (const [name, source] of Object.entries(sources))
    await writeFile(path.join(root, name), source);
  const result = await compileProject({
    root,
    entries: Object.keys(sourcePaths),
    profile: 'react-dom-source-v1',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return { directory, generation: result.value };
}

async function publish(project: Awaited<ReturnType<typeof fixture>>, name: string) {
  const directory = path.join(project.directory, name);
  const result = await writeProjectCompilation(project.generation, directory, { sourcePaths });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const components: Record<string, Component> = {};
  for (const sourcePath of Object.values(sourcePaths)) {
    const filename = path.join(directory, sourcePath);
    const module = (await import(/* @vite-ignore */ filename)) as { CompiledComponent: Component };
    components[path.basename(sourcePath, '.tsx')] = module.CompiledComponent;
  }
  return components;
}

describe('published multi-entry React Context consumer', () => {
  it('uses ordinary generated imports for shared declaration identity, nearest scopes and terminal disposal', async () => {
    const { Provider, Consumer, Optional, Other } = await publish(await fixture(), 'output');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    const parent = React.createRef<Handle>();
    const direct = React.createRef<Handle>();
    const nested = React.createRef<Handle>();
    const optional = React.createRef<Handle>();
    const other = React.createRef<Handle>();
    const tree = (seed: number, include = true) =>
      React.createElement(
        Provider,
        { seed, ref: parent },
        include
          ? React.createElement(
              'div',
              null,
              React.createElement(Consumer, { ref: direct }),
              React.createElement(Optional, { ref: optional }),
              React.createElement(Other, { ref: other }),
              React.createElement(
                Provider,
                { seed: 30 },
                React.createElement(Consumer, { ref: nested })
              )
            )
          : null
      );
    await React.act(async () => {
      root.render(tree(7));
    });
    expect(
      [direct.current, optional.current, other.current, nested.current].map((ref) =>
        ref!.getExposes().count.get()
      )
    ).toEqual([7, 7, -1, 30]);
    expect([...host.querySelectorAll('output')].map((output) => output.textContent)).toEqual([
      '7',
      '7',
      'missing',
      '30',
    ]);
    const held = direct.current!;
    const heldState = held.getExposes().count;
    await React.act(async () => {
      root.render(tree(8));
    });
    expect(heldState.get()).toBe(8);
    expect(host.querySelector('output')?.textContent).toBe('7');
    expect(nested.current!.getExposes().count.get()).toBe(30);
    await React.act(async () => {
      held.update();
    });
    expect(host.querySelector('output')?.textContent).toBe('8');
    await React.act(async () => {
      root.render(tree(8, false));
    });
    await React.act(async () => {
      parent.current!.update();
    });
    expect(direct.current).toBeNull();
    expect(() => heldState.get()).toThrow(/terminal disposal/);
  });

  it('keeps independently published graphs isolated even when their source and debug names match', async () => {
    const project = await fixture();
    const first = await publish(project, 'first');
    const second = await publish(project, 'second');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    const local = React.createRef<Handle>();
    const separate = React.createRef<Handle>();
    await React.act(async () => {
      root.render(
        React.createElement(
          first.Provider,
          { seed: 12 },
          React.createElement(first.Optional, { ref: local }),
          React.createElement(second.Optional, { ref: separate })
        )
      );
    });
    expect(local.current!.getExposes().count.get()).toBe(12);
    expect(separate.current!.getExposes().count.get()).toBe(-1);
    expect([...host.querySelectorAll('output')].map((output) => output.textContent)).toEqual([
      '12',
      'missing',
    ]);
  });
});
