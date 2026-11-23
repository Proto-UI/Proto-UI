// @vitest-environment happy-dom
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { writeArtifactSet } from '../src/artifact-output';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { checkTargetOperations, TARGET_PROFILES } from '../src/targets';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const roots: Root[] = [];
const directories: string[] = [];
let identity = 0;
afterEach(async () => {
  await React.act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark', 'light');
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

const source = `import {definePrototype,tw} from '@proto.ui/core';
export default definePrototype({name:'rule-meta-consumer',setup(def){
  def.props.define({present:{type:'boolean',default:true}});
  def.props.watch(['present'],(run,next)=>run.lifecycle.setPresent(next.present ?? true));
  def.feedback.style.use(tw('bg-white','text-sm','opacity-100'));
  def.rule({when:w=>w.meta('colorScheme').eq('dark'),intent:i=>i.feedback.style.use(tw('bg-black'))});
  def.rule({when:w=>w.meta('viewport.width').gte(768),intent:i=>i.feedback.style.use(tw('text-lg'))});
  def.rule({when:w=>w.meta('preference.forcedColors').eq('active'),intent:i=>i.feedback.style.use(tw('opacity-50'))});
  def.expose.event('created',{payload:'void'});
  def.expose.event('updated',{payload:'void'});
  def.lifecycle.onCreated(run=>run.expose.emit('created'));
  def.lifecycle.onUpdated(run=>run.expose.emit('updated'));
  return r=>r.slot();
}});`;

async function loadNative(authored = source) {
  const parsed = parsePrototype(authored, { fileName: 'rule-meta.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value);
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'generated-modules',
    `rule-meta-${process.pid}-${identity++}`
  );
  const written = await writeArtifactSet(
    [
      { path: 'Component.tsx', kind: 'source', contents: emitted.value.code },
      ...(emitted.value.supportingFiles ?? []),
    ],
    directory
  );
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  directories.push(directory);
  const file = path.join(directory, 'Component.tsx');
  const { CompiledComponent } = (await import(/* @vite-ignore */ file)) as {
    CompiledComponent: React.ComponentType<Record<string, unknown>>;
  };
  return { CompiledComponent, emitted: emitted.value };
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

it('projects native theme, width and forced-colors changes without resetting owners or native children', async () => {
  const queries = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    let state = queries.get(query);
    if (!state) {
      state = { matches: query === '(forced-colors: none)', listeners: new Set() };
      queries.set(query, state);
    }
    return {
      get matches() {
        return state!.matches;
      },
      addEventListener: (_event: string, callback: () => void) => state!.listeners.add(callback),
      removeEventListener: (_event: string, callback: () => void) =>
        state!.listeners.delete(callback),
    } as unknown as MediaQueryList;
  });
  const width = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700);
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { CompiledComponent, emitted } = await loadNative();
  const { host, root } = mount();
  let created = 0,
    updated = 0,
    commits = 0;
  const tree = (present: boolean) =>
    React.createElement(
      React.Profiler,
      {
        id: 'meta',
        onRender: () => {
          ++commits;
        },
      },
      React.createElement(
        CompiledComponent,
        {
          present,
          onCreated: () => {
            ++created;
          },
          onUpdated: () => {
            ++updated;
          },
        },
        React.createElement('input', { defaultValue: 'retained editor' })
      )
    );
  await React.act(async () => {
    root.render(tree(true));
  });
  const heldRoot = host.querySelector('[data-pui-root]')!;
  const input = host.querySelector('input')!;
  input.focus();
  input.setSelectionRange(2, 6);
  const originalCommits = commits;
  expect(tokens(heldRoot)).toEqual(new Set(['bg-white', 'text-sm', 'opacity-100']));
  await React.act(async () => {
    document.documentElement.dataset.theme = 'dark';
    width.mockReturnValue(800);
    window.dispatchEvent(new Event('resize'));
    queries.get('(forced-colors: none)')!.matches = false;
    queries.get('(forced-colors: active)')!.matches = true;
    for (const listener of queries.get('(forced-colors: active)')!.listeners) listener();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(tokens(heldRoot)).toEqual(new Set(['bg-black', 'text-lg', 'opacity-50']));
  expect(host.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
  expect([created, updated, commits]).toEqual([1, 0, originalCommits]);
  expect(emitted.code).not.toContain('@proto.ui/');
  expect(emitted.code).toContain('.meta("viewport.width")');
  expect(emitted.supportingFiles?.some((file) => file.path.endsWith('web-rule-source-v1.ts'))).toBe(
    true
  );
  const stale = [...queries.get('(forced-colors: active)')!.listeners];
  await React.act(async () => {
    root.render(tree(false));
  });
  expect(host.querySelector('[data-pui-root]')).toBeNull();
  expect(queries.get('(forced-colors: active)')!.listeners.size).toBe(0);
  expect(remove.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
  await React.act(async () => {
    for (const listener of stale) listener();
    await Promise.resolve();
  });
  await React.act(async () => {
    root.render(tree(true));
  });
  expect(tokens(host.querySelector('[data-pui-root]'))).toEqual(
    new Set(['bg-black', 'text-lg', 'opacity-50'])
  );
  expect(created).toBe(1);
  expect(add.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(2);
});

it('shares Document resources for exact authored dependencies and releases only the last lease', async () => {
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        matches: false,
        addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
        removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
      }) as unknown as MediaQueryList
  );
  const add = vi.spyOn(window, 'addEventListener');
  const themeOnly = source
    .replace(/  def\.rule\(\{when:w=>w\.meta\('viewport.width'\).*\n/, '')
    .replace(/  def\.rule\(\{when:w=>w\.meta\('preference.forcedColors'\).*\n/, '');
  const { CompiledComponent, emitted } = await loadNative(themeOnly);
  const first = mount(),
    second = mount();
  await React.act(async () => {
    first.root.render(React.createElement(CompiledComponent));
    second.root.render(React.createElement(CompiledComponent));
  });
  expect(listeners.size).toBe(1);
  expect(add.mock.calls.some(([event]) => event === 'resize')).toBe(false);
  expect(emitted.code).toContain('["colorScheme"]');
  await React.act(async () => {
    first.root.unmount();
  });
  roots.splice(roots.indexOf(first.root), 1);
  expect(listeners.size).toBe(1);
  await React.act(async () => {
    second.root.unmount();
  });
  roots.splice(roots.indexOf(second.root), 1);
  expect(listeners.size).toBe(0);
});

it('retains explicit unsupported profile and unknown meta-provider diagnostics', () => {
  const parsed = parsePrototype(source, { fileName: 'rule-meta.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  expect(checkTargetOperations(parsed.value, TARGET_PROFILES['react-dom-source-v1']).ok).toBe(true);
  expect(checkTargetOperations(parsed.value, TARGET_PROFILES['react-runtime-v1']).ok).toBe(true);
  for (const profile of [
    'react-dom-ssr-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
    'qt-source-v1',
    'flutter-source-v1',
    'gpui-source-v1',
  ] as const) {
    const result = checkTargetOperations(parsed.value, TARGET_PROFILES[profile]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.diagnostics.some((diagnostic) =>
          diagnostic.message.includes(
            TARGET_PROFILES[profile].implemented
              ? 'Live Rule Meta viewport.width'
              : 'no working emitter'
          )
        )
      ).toBe(true);
  }
  const unknown = parsePrototype(source.replace("meta('colorScheme')", "meta('private.theme')"));
  expect(unknown.ok).toBe(false);
  if (!unknown.ok)
    expect(
      unknown.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('independently admitted key')
      )
    ).toBe(true);
});

it('retains setup-selected Rule trees and first-class helper style handles', async () => {
  const authored = `import {definePrototype,tw,type DefHandle,type State,type StyleHandle} from '@proto.ui/core';
function paint(def:DefHandle, state:{active:State<boolean>}, recipes:{active:StyleHandle}, invalid?:State<boolean>) {
  def.rule({when:w=>invalid ? w.all(w.state(state.active).eq(true),w.state(invalid).eq(false),w.meta('viewport.width').gte(768)) : w.state(state.active).eq(true),
    intent:i=>i.feedback.style.use(recipes.active)});
}
export default definePrototype({name:'captured-style-helper',setup(def){
  const active=def.state.bool('active',true);
  const replacement=def.state.bool('replacement',false);
  const states={active};
  paint(def,states,{active:tw('ring-2')});
  states.active=replacement;
  def.expose.method('setActive',(value:boolean)=>active.set(value));
  return r=>r.slot();
}});`;
  const { CompiledComponent } = await loadNative(authored);
  const add = vi.spyOn(window, 'addEventListener');
  const { host, root } = mount();
  const ref = React.createRef<{ getExposes(): { setActive(value: boolean): void } }>();
  await React.act(async () => {
    root.render(React.createElement(CompiledComponent, { ref }, 'same authored helper'));
  });
  const heldRoot = host.querySelector('[data-pui-root]')!;
  expect(tokens(heldRoot)).toEqual(new Set(['ring-2']));
  expect(add.mock.calls.some(([event]) => event === 'resize')).toBe(false);
  await React.act(async () => {
    ref.current!.getExposes().setActive(false);
  });
  expect(tokens(heldRoot)).toEqual(new Set());
  await React.act(async () => {
    ref.current!.getExposes().setActive(true);
  });
  expect(tokens(heldRoot)).toEqual(new Set(['ring-2']));
  expect(host.querySelector('[data-pui-root]')).toBe(heldRoot);
});
