import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const facts = `import { defineAsHook } from '@proto.ui/core';
  export const asFacts = defineAsHook({name:'relay-facts',setup(def){
    const disabled = def.state.bool('disabled',false);
    def.expose.state('disabled',disabled);
  }});`;
const watch = `if(disabled && 'watch' in disabled) disabled.watch((_run,event)=>{
  if(event.type === 'next' && event.next) clear();
});`;
const helper = `export function paint(def,disabled) {
  const hovered = def.state.bool('privateHover',false);
  const clear = () => hovered.set(false,'clear');
  def.event.on('pointer.enter',()=>{if(!disabled?.get())hovered.set(true,'enter');});
  def.event.on('pointer.leave',clear);
  def.lifecycle.onUnmounted(clear);
  ${watch}
  return hovered;
}`;
const entry = (prefix = '', suffix = '', argument = 'facts.stateHandles.disabled') => `
  import { definePrototype, tw } from '@proto.ui/core';
  import { asFacts } from './facts';
  import { paint } from './paint';
  export default definePrototype({name:'borrowed-relay',setup(def){
    const facts = asFacts();
    ${prefix}
    const hovered = paint(def,${argument});
    def.rule({when:w=>w.state(hovered).eq(true),intent:i=>i.feedback.style.use(tw('bg-primary'))});
    ${suffix}
  }});`;

describe('source borrowed State with a closed zero-argument callback relay', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-borrowed-relay-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const scan = async (changes: Record<string, string> = {}) => {
    const files = [];
    for (const [name, text] of Object.entries({
      'facts.ts': facts,
      'paint.ts': helper,
      'entry.proto.ts': entry(),
      ...changes,
    })) {
      const file = path.join(directory, name);
      await writeFile(file, text);
      files.push(file);
    }
    return { files, inventory: scanRuleStateReadInventory(files) };
  };
  it('retains the actual Rule and raw token while keeping the returned handle private', async () => {
    const { files, inventory } = await scan();
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
    expect(inventory.evaluated.flatMap((row) => row.usages)).toEqual([]);
    expect(inventory.evaluated.flatMap((row) => row.exposedLocals)).toEqual([]);
    expect(await collectProtoStyleTokensFromFiles(files)).toEqual(['bg-primary']);
  });
  it.each([
    ['unguarded receiver', helper.replace(watch, `disabled.watch(()=>{clear();});`)],
    ['static member spelling', helper.replace('disabled.watch(', 'disabled["watch"](')],
    ['named inline wrapper', helper.replace('(_run,event)=>{', 'function wrapper(_run,event){')],
    [
      'wrapper parameter shadows its self binding',
      helper.replace('(_run,event)=>{', 'function wrapper(wrapper,event){'),
    ],
    [
      'wrapper local shadows its self binding',
      helper.replace(
        '(_run,event)=>{',
        'function wrapper(_run,event){ const wrapper = 1; consume(wrapper);'
      ),
    ],
    [
      'named clear without self uses',
      helper.replace(
        "() => hovered.set(false,'clear')",
        "function clearPrivate(){hovered.set(false,'clear');}"
      ),
    ],
    [
      'clear local shadows its self binding',
      helper.replace(
        "() => hovered.set(false,'clear')",
        "function clearPrivate(){const clearPrivate=1;consume(clearPrivate);hovered.set(false,'clear');}"
      ),
    ],
    ['discarded parenthesized clear invocation', helper.replace(' clear();', ' (clear());')],
    ['two closed calls', helper.replace(' clear();', ' { clear(); clear(); }')],
  ])('closes %s', async (_name, source) => {
    const { inventory } = await scan({ 'paint.ts': source });
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
  });
  it('uses the current source argument through a caller const alias', async () => {
    const { inventory } = await scan({
      'entry.proto.ts': entry('const disabled = facts.stateHandles.disabled;', '', 'disabled'),
    });
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
  });
  it.each([
    ['direct method write', 'facts.stateHandles.disabled.watch = foreign;'],
    ['aliased method write', 'const alias = facts.stateHandles.disabled; alias.watch = foreign;'],
    ['Object.assign method write', 'Object.assign(facts.stateHandles.disabled,{watch:foreign});'],
    ['source receiver escapes', 'opaque(facts.stateHandles.disabled);'],
    [
      'repeated capture mutation',
      'const again=asFacts(); again.stateHandles.disabled.watch=foreign;',
    ],
  ])(
    'proves private relay identity only after %s, without certifying the borrowed method',
    async (_name, prefix) => {
      const { files, inventory } = await scan({
        'entry.proto.ts': entry(prefix),
      });
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([]);
      expect(inventory.evaluated.flatMap((row) => row.exposedLocals)).toEqual([]);
      expect(await collectProtoStyleTokensFromFiles(files)).toEqual(['bg-primary']);
    }
  );
  it.each([
    ['unknown receiver', { 'entry.proto.ts': entry('', '', 'foreign') }],
    [
      'type-only receiver',
      {
        'entry.proto.ts': entry('const disabled = foreign as State<boolean>;', '', 'disabled'),
      },
    ],
    [
      'watch-shaped object',
      {
        'entry.proto.ts': entry('const disabled = {get:()=>false,watch:foreign};', '', 'disabled'),
      },
    ],
    [
      'side-effecting invocation argument',
      {
        'entry.proto.ts': entry('', '', 'opaque(facts.stateHandles.disabled)'),
      },
    ],
    ['foreign Def', { 'entry.proto.ts': entry().replace('paint(def,', 'paint(foreign,') }],
    [
      'receiver default',
      {
        'paint.ts': helper.replace('paint(def,disabled)', 'paint(def,disabled=foreign)'),
      },
    ],
    [
      'receiver reassignment',
      {
        'paint.ts': helper.replace('const hovered =', 'disabled = foreign; const hovered ='),
      },
    ],
    [
      'receiver escape in helper',
      {
        'paint.ts': helper.replace('const hovered =', 'opaque(disabled); const hovered ='),
      },
    ],
    [
      'receiver alias in helper',
      {
        'paint.ts': helper.replace('const hovered =', 'const alias=disabled; const hovered ='),
      },
    ],
    [
      'receiver method write in helper',
      {
        'paint.ts': helper.replace('const hovered =', 'disabled.watch=foreign; const hovered ='),
      },
    ],
    ['optional watch call', { 'paint.ts': helper.replace('disabled.watch(', 'disabled.watch?.(') }],
    [
      'optional watch receiver',
      { 'paint.ts': helper.replace('disabled.watch(', 'disabled?.watch(') },
    ],
    [
      'wrong watch slot',
      {
        'paint.ts': helper.replace('disabled.watch(', 'disabled.watch("wrong",'),
      },
    ],
    [
      'spread watch callback',
      {
        'paint.ts': helper.replace(watch, `disabled.watch(...[()=>{clear();}]);`),
      },
    ],
    [
      'extra watch callback',
      {
        'paint.ts': helper.replace(watch, `disabled.watch(()=>{clear();},()=>{});`),
      },
    ],
    [
      'stored watch callback',
      {
        'paint.ts': helper.replace(
          watch,
          `const callback=()=>{clear();}; disabled.watch(callback);`
        ),
      },
    ],
    [
      'async wrapper',
      {
        'paint.ts': helper.replace('(_run,event)=>{', 'async (_run,event)=>{'),
      },
    ],
    [
      'generator wrapper',
      {
        'paint.ts': helper.replace('(_run,event)=>{', 'function* wrapper(_run,event){'),
      },
    ],
    [
      'wrapper parameter default',
      {
        'paint.ts': helper.replace('(_run,event)=>{', '(_run,event=foreign)=>{'),
      },
    ],
    ['wrapper rest parameter', { 'paint.ts': helper.replace('(_run,event)=>{', '(...event)=>{') }],
    [
      'wrapper destructuring',
      { 'paint.ts': helper.replace('(_run,event)=>{', '(_run,{event})=>{') },
    ],
    [
      'third wrapper parameter',
      {
        'paint.ts': helper.replace('(_run,event)=>{', '(_run,event,extra)=>{'),
      },
    ],
    [
      'wrapper this',
      {
        'paint.ts': helper.replace('(_run,event)=>{', '(_run,event)=>{ opaque(this);'),
      },
    ],
    [
      'wrapper arguments',
      {
        'paint.ts': helper.replace('(_run,event)=>{', 'function(_run,event){ opaque(arguments);'),
      },
    ],
    [
      'wrapper eval',
      {
        'paint.ts': helper.replace('(_run,event)=>{', '(_run,event)=>{ eval("clear");'),
      },
    ],
    [
      'wrapper self escape',
      {
        'paint.ts': helper.replace(
          '(_run,event)=>{',
          'function wrapper(_run,event){ opaque(wrapper);'
        ),
      },
    ],
    [
      'wrapper self returned',
      {
        'paint.ts': helper.replace(
          '(_run,event)=>{',
          'function wrapper(_run,event){ if(flag)return wrapper;'
        ),
      },
    ],
    [
      'wrapper self alias',
      {
        'paint.ts': helper.replace(
          '(_run,event)=>{',
          'function wrapper(_run,event){ const alias=wrapper;'
        ),
      },
    ],
    [
      'wrapper self recursion',
      {
        'paint.ts': helper.replace('(_run,event)=>{', 'function wrapper(_run,event){ wrapper();'),
      },
    ],
    ['clear argument', { 'paint.ts': helper.replace(' clear();', ' clear(event);') }],
    ['optional clear call', { 'paint.ts': helper.replace(' clear();', ' clear?.();') }],
    ['clear call method', { 'paint.ts': helper.replace(' clear();', ' clear.call(null);') }],
    ['clear apply method', { 'paint.ts': helper.replace(' clear();', ' clear.apply(null,[]);') }],
    ['clear bind method', { 'paint.ts': helper.replace(' clear();', ' clear.bind(null)();') }],
    [
      'clear alias',
      {
        'paint.ts': helper.replace(' clear();', ' { const alias=clear; alias(); }'),
      },
    ],
    ['clear returned', { 'paint.ts': helper.replace(' clear();', ' return clear;') }],
    ['clear result returned', { 'paint.ts': helper.replace(' clear();', ' return clear();') }],
    ['clear stored', { 'paint.ts': helper.replace(' clear();', ' opaque({clear});') }],
    ['clear escapes', { 'paint.ts': helper.replace(' clear();', ' opaque(clear);') }],
    ['nested deferred relay', { 'paint.ts': helper.replace(' clear();', ' opaque(()=>clear());') }],
    [
      'clear has a parameter',
      {
        'paint.ts': helper.replace('const clear = () =>', 'const clear = (event) =>'),
      },
    ],
    [
      'clear reassigned',
      {
        'paint.ts': helper
          .replace('const clear =', 'let clear =')
          .replace(watch, 'clear=foreign;' + watch),
      },
    ],
    [
      'clear self escape',
      {
        'paint.ts': helper.replace(
          "() => hovered.set(false,'clear')",
          "function reset(){opaque(reset);hovered.set(false,'clear');}"
        ),
      },
    ],
    [
      'clear self returned',
      {
        'paint.ts': helper.replace(
          "() => hovered.set(false,'clear')",
          "function reset(){hovered.set(false,'clear');return reset;}"
        ),
      },
    ],
    [
      'clear self alias',
      {
        'paint.ts': helper.replace(
          "() => hovered.set(false,'clear')",
          "function reset(){const alias=reset;hovered.set(false,'clear');}"
        ),
      },
    ],
    [
      'clear self recursion',
      {
        'paint.ts': helper.replace(
          "() => hovered.set(false,'clear')",
          "function reset(){reset();hovered.set(false,'clear');}"
        ),
      },
    ],
    [
      'no native clear registration',
      {
        'paint.ts': helper
          .replace("def.event.on('pointer.leave',clear);", '')
          .replace('def.lifecycle.onUnmounted(clear);', ''),
      },
    ],
    [
      'wrong native clear slot',
      {
        'paint.ts': helper
          .replace("def.event.on('pointer.leave',clear);", 'def.event.on(clear,()=>{});')
          .replace('def.lifecycle.onUnmounted(clear);', ''),
      },
    ],
    [
      'direct private State in wrapper',
      {
        'paint.ts': helper.replace(' clear();', " hovered.set(false,'direct');"),
      },
    ],
    [
      'private State escape from clear',
      {
        'paint.ts': helper.replace("() => hovered.set(false,'clear')", '()=>opaque(hovered)'),
      },
    ],
    [
      'private State exposure',
      {
        'paint.ts': helper.replace(
          'return hovered;',
          "def.expose.state('publicHover',hovered); return hovered;"
        ),
      },
    ],
    ['caller State escape', { 'entry.proto.ts': entry('', 'opaque(hovered);') }],
    [
      'caller State exposure',
      {
        'entry.proto.ts': entry('', "def.expose.state('publicHover',hovered);"),
      },
    ],
  ] satisfies Array<[string, Record<string, string>]>)(
    'retains unknown for %s',
    async (_name, changes) => {
      const { inventory } = await scan(changes);
      expect(inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
        expression: 'hovered',
        reason: 'subject',
      });
    }
  );
  it('does not transfer the native call source to an independently unknown invocation', async () => {
    const other = entry('', '', 'foreign').replace("name:'borrowed-relay'", "name:'foreign-relay'");
    const { inventory } = await scan({ 'other.proto.ts': other });
    expect(inventory.evaluated).toHaveLength(2);
    expect(inventory.evaluated.filter((row) => row.unresolved.length === 0)).toHaveLength(1);
    expect(inventory.evaluated.flatMap((row) => row.unresolved)).toEqual([
      { expression: 'hovered', reason: 'subject' },
    ]);
  });
});
