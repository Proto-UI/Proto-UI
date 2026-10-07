// @vitest-environment happy-dom
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { writeArtifactSet } from '../src/artifact-output';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Handle = {
  update(): void;
  getExposes(): { count: { get(): number }; setCount(value: number): void };
};
type Component = React.ForwardRefExoticComponent<
  Record<string, unknown> & React.RefAttributes<Handle>
>;
const roots: Root[] = [];
const directories: string[] = [];
let identity = 0;
afterEach(async () => {
  await React.act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

const source = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'react-style-owner',setup(def){
  def.props.define({active:{type:'boolean',default:true},present:{type:'boolean',default:true},command:{type:'number',default:0}});
  const count=def.state.numberDiscrete('count',0);
  def.expose.state('count',count);
  def.expose.method('setCount',(value:number)=>{count.set(value);});
  def.feedback.style.use(tw('bg-blue','text-white'));
  const withdrawn=def.feedback.style.use(tw('opacity-25'));
  withdrawn();
  const baseActive=def.state.bool('base-active',true);
  def.rule({when:w=>w.state(baseActive).eq(true),intent:i=>i.feedback.style.use(tw('bg-green','rounded-lg'))});
  def.rule({when:w=>w.prop('active').eq(true),intent:i=>i.feedback.style.use(tw('bg-yellow'))});
  def.rule({when:w=>w.state(count).eq(1),intent:i=>i.feedback.style.use(tw('bg-red'))});
  const cancelled=def.rule({when:w=>w.t(),intent:i=>i.feedback.style.use(tw('opacity-25'))});
  cancelled.dispose();
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? true);});
  def.props.watch(['command'],(run,next)=>{
    if(next.command===1){run.feedback.style.patch(tw('bg-black'));}
    if(next.command===2){run.feedback.style.suppress(tw('bg-white'),tw('text-black'));}
    if(next.command===3){run.feedback.style.clearPatch();}
    if(next.command===4){baseActive.set(false);}
  });
  def.expose.event('mounted',{payload:'void'});
  def.expose.event('updated',{payload:'void'});
  def.expose.event('unmounted',{payload:'void'});
  def.expose.event('beforeDispose',{payload:'void'});
  def.lifecycle.onMounted(run=>{run.expose.emit('mounted');});
  def.lifecycle.onUpdated(run=>{run.expose.emit('updated');});
  def.lifecycle.onUnmounted(run=>{run.expose.emit('unmounted');});
  def.lifecycle.onBeforeDispose(run=>{run.expose.emit('beforeDispose');});
  return r=>r.el('output',{style:tw('bg-white','text-black')},[count.get(),r.slot()]);
}});`;

async function loadNative() {
  const parsed = parsePrototype(source, { fileName: 'react-style.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `react-style-${process.pid}-${identity++}`
  );
  const artifacts = [
    { path: 'Component.tsx', kind: 'source' as const, contents: emitted.value.code },
    ...(emitted.value.supportingFiles ?? []),
  ];
  const written = await writeArtifactSet(artifacts, directory);
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  directories.push(directory);
  const filename = path.join(directory, 'Component.tsx');
  // Generated modules are chosen at runtime, not available to static import analysis.
  return ((await import(/* @vite-ignore */ filename)) as { CompiledComponent: Component })
    .CompiledComponent;
}
function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  return { host, root };
}
function tokens(element: Element | null) {
  return new Set(element?.getAttribute('data-pui-style')?.split(' ').filter(Boolean) ?? []);
}

describe('native React style projection without semantic template updates', () => {
  it('withdraws later Rules to earlier/base winners without changing text, rendering, or Root identity', async () => {
    const CompiledComponent = await loadNative();
    const { host, root } = mount();
    const ref = React.createRef<Handle>();
    let commits = 0;
    let updates = 0;
    const tree = (active: boolean) =>
      React.createElement(
        React.Profiler,
        {
          id: 'native-style',
          onRender: () => {
            ++commits;
          },
        },
        React.createElement(CompiledComponent, {
          ref,
          active,
          onUpdated: () => {
            ++updates;
          },
        })
      );
    await React.act(async () => {
      root.render(tree(true));
    });
    const heldRoot = host.querySelector('[data-pui-root]')!;
    const output = host.querySelector('output')!;
    const handle = ref.current!;
    expect(tokens(heldRoot)).toEqual(new Set(['bg-yellow', 'text-white', 'rounded-lg']));
    expect(tokens(output)).toEqual(new Set(['bg-white', 'text-black']));
    expect(output.textContent).toBe('0');
    const initialCommits = commits;
    await React.act(async () => {
      handle.getExposes().setCount(1);
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-red', 'text-white', 'rounded-lg']));
    expect(handle.getExposes().count.get()).toBe(1);
    expect(output.textContent).toBe('0');
    expect(commits).toBe(initialCommits);
    expect(updates).toBe(0);
    expect(host.querySelector('[data-pui-root]')).toBe(heldRoot);
    await React.act(async () => {
      handle.getExposes().setCount(0);
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-yellow', 'text-white', 'rounded-lg']));
    await React.act(async () => {
      root.render(tree(false));
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-green', 'text-white', 'rounded-lg']));
    expect(host.querySelector('output')).toBe(output);
    expect(updates).toBe(0);
    await React.act(async () => {
      handle.getExposes().setCount(1);
      handle.update();
    });
    expect(host.querySelector('[data-pui-root]')).toBe(heldRoot);
    expect(host.querySelector('output')?.textContent).toBe('1');
    expect(updates).toBe(1);
  });

  it('applies patches above Rules, suppresses groups, and reveals the setup base after Rule withdrawal', async () => {
    const CompiledComponent = await loadNative();
    const { host, root } = mount();
    const ref = React.createRef<Handle>();
    let updates = 0;
    const tree = (command: number) =>
      React.createElement(CompiledComponent, {
        ref,
        command,
        active: false,
        onUpdated: () => {
          ++updates;
        },
      });
    await React.act(async () => {
      root.render(tree(0));
    });
    const heldRoot = host.querySelector('[data-pui-root]')!;
    await React.act(async () => {
      root.render(tree(1));
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-black', 'text-white', 'rounded-lg']));
    await React.act(async () => {
      ref.current!.getExposes().setCount(1);
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-black', 'text-white', 'rounded-lg']));
    await React.act(async () => {
      root.render(tree(2));
    });
    expect(tokens(heldRoot)).toEqual(new Set(['rounded-lg']));
    await React.act(async () => {
      root.render(tree(3));
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-red', 'text-white', 'rounded-lg']));
    await React.act(async () => {
      ref.current!.getExposes().setCount(0);
      root.render(tree(4));
    });
    expect(tokens(heldRoot)).toEqual(new Set(['bg-blue', 'text-white']));
    expect(tokens(host.querySelector('output'))).toEqual(new Set(['bg-white', 'text-black']));
    expect(host.querySelector('output')?.textContent).toBe('0');
    expect(host.querySelector('[data-pui-root]')).toBe(heldRoot);
    expect(updates).toBe(0);
  });

  it('replays retained patches and current Rules on reattach, retains its owner, and clears terminal helper projection', async () => {
    const CompiledComponent = await loadNative();
    const { host, root } = mount();
    const ref = React.createRef<Handle>();
    const lifecycle: string[] = [];
    const tree = (present: boolean, command: number) =>
      React.createElement(CompiledComponent, {
        ref,
        present,
        command,
        active: false,
        onMounted: () => lifecycle.push('mounted'),
        onUnmounted: () => lifecycle.push('unmounted'),
        onBeforeDispose: () => lifecycle.push('beforeDispose'),
      });
    await React.act(async () => {
      root.render(tree(true, 0));
    });
    const handle = ref.current!;
    const state = handle.getExposes().count;
    const setCount = handle.getExposes().setCount;
    await React.act(async () => {
      setCount(1);
      root.render(tree(true, 1));
    });
    const firstRoot = host.querySelector('[data-pui-root]')!;
    expect(tokens(firstRoot)).toEqual(new Set(['bg-black', 'text-white', 'rounded-lg']));
    await React.act(async () => {
      root.render(tree(false, 1));
    });
    expect(host.querySelector('[data-pui-root]')).toBeNull();
    expect(firstRoot.hasAttribute('data-pui-style')).toBe(false);
    await React.act(async () => {
      setCount(0);
    });
    expect(state.get()).toBe(0);
    await React.act(async () => {
      root.render(tree(true, 1));
    });
    const secondRoot = host.querySelector('[data-pui-root]')!;
    expect(ref.current).toBe(handle);
    expect(handle.getExposes().count).toBe(state);
    expect(handle.getExposes().setCount).toBe(setCount);
    expect(tokens(secondRoot)).toEqual(new Set(['bg-black', 'text-white', 'rounded-lg']));
    await React.act(async () => {
      setCount(1);
      root.render(tree(true, 3));
    });
    expect(tokens(secondRoot)).toEqual(new Set(['bg-red', 'text-white', 'rounded-lg']));
    expect(host.querySelector('output')?.textContent).toBe('0');
    await React.act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);
    expect(secondRoot.hasAttribute('data-pui-style')).toBe(false);
    expect(lifecycle).toEqual(['mounted', 'unmounted', 'mounted', 'unmounted', 'beforeDispose']);
    expect(() => setCount(0)).toThrow(/terminal disposal/);
    expect(() => state.get()).toThrow(/terminal disposal/);
    expect(() => handle.update()).toThrow(/terminal disposal/);
  });
});
