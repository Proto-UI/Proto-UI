import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

describe('finite nested token inventories without semantic proof laundering', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'proto-token-tables-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
  async function collect(source: string, modules: Record<string, string> = {}) {
    for (const [name, body] of Object.entries(modules)) await writeFile(path.join(dir, name), body);
    const file = path.join(dir, 'entry.ts');
    await writeFile(file, `import { tw, definePrototype } from '@proto.ui/core';\n${source}`);
    return collectProtoStyleTokensFromFiles([file]);
  }
  const table = `const table = { a: { root: 'max-h-72', trigger: 'py-[2px]' }, b: { root: 'pb-0', trigger: 'scroll-py-0' } };`;
  const cases: Array<[string, string, string[]]> = [
    ["finite array join", "const a=['p-2','h-4']; tw(a.join(' '));", ["h-4", "p-2"]],
    ["nested joined template", "const base=['p-2','h-4'].join(' '); const table={root:`${base} bg-mint`}; tw(table.root);", ["bg-mint", "h-4", "p-2"]],
    ["opaque template islands", "tw(`p-2 ${external()} h-4`);", ["h-4", "p-2"]],
    ["opaque template no fragments", "tw(`bg-${external()}-500`);", []],
    ["opaque adjacency", "tw(`${external()}p-2`);", []],
    ["nested opaque template", "const inner=`p-2 ${external()} h-4`; tw(`${inner}`);", ["h-4", "p-2"]],
    ["unknown join spaces", "const a=['p-2',external(),'h-4']; tw(a.join(' '));", ["h-4", "p-2"]],
    ["unknown join empty", "const a=['bg-',external(),'-500']; tw(a.join(''));", []],
    ["finite join alternatives", "tw(['bg-',choose?'red':'blue','-500'].join(''));", ["bg-blue-500", "bg-red-500"]],
    ["nested opaque outer boundaries", "const inner=`2 ${external()} h-`; tw(`p-${inner}4`);", ["h-4", "p-2"]],
    ['repeat finite join', `const a=['p-2','h-4']; const x=a.join(' '); const y=a.join(' '); tw(y);`, ['h-4','p-2']],
    ['two static indices' , `${table} tw(table['a']['root']);`, ['max-h-72']],
    ['property chain', `${table} tw(table.a.trigger);`, ['py-[2px]']],
    ['unknown first key', `${table} tw(table[external()].root);`, ['max-h-72', 'pb-0']],
    ['unknown second key', `${table} tw(table.a[external()]);`, ['max-h-72', 'py-[2px]']],
    ['both unknown keys', `${table} tw(table[external()][external()]);`, ['max-h-72', 'pb-0', 'py-[2px]', 'scroll-py-0']],
    ['finite bound key', `${table} const key = flag ? 'a' : 'b'; tw(table[key].root);`, ['max-h-72', 'pb-0']],
    ['partial keys remain conservative', `${table} const key = flag ? 'a' : external(); tw(table[key].root);`, ['max-h-72', 'pb-0']],
    ['erased type syntax', `${table} tw((table as any satisfies object)!.a.root);`, ['max-h-72']],
    ['array variable loop', `${table} const keys = ['a', 'b'] as const; for (const key of keys) tw(table[key].root);`, ['max-h-72', 'pb-0']],
    ['array spread loop', `${table} const first = ['a']; const keys = [...first, 'b']; for (const key of keys) tw(table[key].root);`, ['max-h-72', 'pb-0']],
    ['same-entry alias', `${table} const alias = table; alias.a.root = 'h-8'; tw(table.a.root);`, ['h-8']],
    ['nested alias', `${table} const alias = table.a; alias.root = 'h-8'; tw(table.a.root);`, ['h-8']],
    ['conditional write', `${table} if (flag) table.a.root = 'h-8'; tw(table.a.root);`, ['h-8', 'max-h-72']],
    ['unknown member write', `${table} table.a[external()] = 'h-8'; tw(table.a.root);`, ['h-8', 'max-h-72']],
    ['unknown value keeps other members', `${table} table.a.root = external(); tw(table.b.root);`, ['pb-0']],
    ['deletion', `${table} delete table.a.root; tw(table.a.root);`, []],
    ['conditional deletion', `${table} if (flag) delete table.a.root; tw(table.a.root);`, ['max-h-72']],
    ['known spread order', `${table} const row = {...table.a, root: 'h-8'}; tw(row.root);`, ['h-8']],
    ['known later spread overwrites', `${table} const row = {root: 'h-8', ...table.a}; tw(row.root);`, ['max-h-72']],
    ['nullable spread retains prior', `${table} const maybe = flag ? table.a : null; const row = {root:'h-8', ...maybe}; tw(row.root);`, ['h-8', 'max-h-72']],
    ['opaque spread retains inventory', `${table} const row = {...table.a, ...external()}; tw(row.root);`, ['max-h-72']],
    ['finite interpolation', `const key = flag ? 'red' : 'blue'; tw(\`bg-\${key}-500\`);`, ['bg-blue-500', 'bg-red-500']],
    ['partial interpolation retains known branch', `const key = flag ? 'red' : external(); tw(\`bg-\${key}-500\`);`, ['bg-red-500']],
    ['cyclic graph terminates', `${table} table.a.self = table.a; tw(table.a.root);`, ['max-h-72']],
    ['lexical shadow', `${table} function paint(table) { tw(table.a.root); }`, []],
    ['unknown computed own key retains inventory', `const table = {[external()]:'h-8'}; tw(table[external()]);`, ['h-8']],
    ['unknown new member write retains inventory', `const table = {}; table[external()]='h-8'; tw(table[external()]);`, ['h-8']],
    ['numeric own key', `const table = {0:'h-8', 1:'h-9'}; tw(table[0]);`, ['h-8']],
    ['numeric array index', `const table = ['h-8', 'h-9']; tw(table[0]);`, ['h-8']],
    ['logical nullish member write keeps RHS', `const table = {}; table.root ??= 'h-8'; tw(table.root);`, ['h-8']],
    ['logical or member write keeps RHS', `const table = {}; table.root ||= 'h-8'; tw(table.root);`, ['h-8']],
    ['logical and member write keeps both', `const table = {root:'h-9'}; table.root &&= 'h-8'; tw(table.root);`, ['h-8', 'h-9']],
    ['partial Object.assign retains known incoming members', `const source = {root:'h-8', [external()]:'py-1'}; const target={}; Object.assign(target,source); tw(target.root);`, ['h-8', 'py-1']],
    ['bound tuple destructure', `const rows=[['h-8'],['h-9']]; for(const [name] of rows) tw(name);`, ['h-8', 'h-9']],
    ['bound object destructure', `const rows=[{root:'h-8'},{root:'h-9'}]; for(const {root:name} of rows) tw(name);`, ['h-8', 'h-9']],
    ['Object.assign overwrite', `${table} Object.assign(table.a, {root:'h-8'}); tw(table.a.root);`, ['h-8']],
    ['incomplete spread retains possible overwritten inventory', `const src={[external()]:'h-9'}; const row={root:'h-8',...src}; tw(row.root);`, ['h-8','h-9']],
    ['known after incomplete spread restores exactness', `const src={[external()]:'h-9'}; const row={...src,root:'h-8'}; tw(row.root);`, ['h-8']],
    ['nested declaration destructure alias', `${table} const {a:row}=table; row.root='h-8'; tw(table.a.root);`, ['h-8']],
    ['ordinary own prototype-named key', `const table = {constructor: {root:'h-8'}}; tw(table.constructor.root);`, ['h-8']],
  ];
  it.each(cases)('%s', async (_name, source, expected) => {
    expect(await collect(source)).toEqual([...expected].sort());
  });
  it('uses imported keys and preserves imported nested member maps', async () => {
    expect(await collect(`import { table, keys } from './tables'; for (const key of keys) tw(table[key].root);`, {
      'tables.ts': `export ${table} export const keys = ['a', 'b'] as const;`,
    })).toEqual(['max-h-72', 'pb-0']);
  });
  it('preserves same-entry aliases imported under two names', async () => {
    expect(await collect(`import { table as a, table as b } from './tables'; a.a.root = 'h-8'; tw(b.a.root);`, {
      'tables.ts': `export ${table}`,
    })).toEqual(['h-8']);
  });
  it('forks imported graphs per entry in either entry order', async () => {
    await writeFile(path.join(dir, 'tables.ts'), `export ${table}`);
    const a = path.join(dir, 'a.ts'); const b = path.join(dir, 'b.ts');
    await writeFile(a, `import {table} from './tables'; table.a.root='h-8'; tw(table.a.root);`);
    await writeFile(b, `import {table} from './tables'; tw(table.a.root);`);
    const expected = ['h-8', 'max-h-72'];
    expect(await collectProtoStyleTokensFromFiles([a, b])).toEqual(expected);
    expect(await collectProtoStyleTokensFromFiles([b, a])).toEqual(expected);
  });
  it('keeps aliases imported through two module paths within one entry', async () => {
    expect(await collect(`import {table as a} from './table'; import {table as b} from './bridge'; a.a.root='h-8'; tw(b.a.root);`, {
      'table.ts': `export ${table}`,
      'bridge.ts': `export {table} from './table';`,
    })).toEqual(['h-8']);
  });
  it('does not retain changed module contents across later collects', async () => {
    const entry = path.join(dir, 'entry.ts'); const module = path.join(dir, 'table.ts');
    await writeFile(entry, `import {table} from './table'; tw(table.a.root);`);
    await writeFile(module, `export const table={a:{root:'h-8'}};`);
    expect(await collectProtoStyleTokensFromFiles([entry])).toEqual(['h-8']);
    await writeFile(module, `export const table={a:{root:'h-9'}};`);
    expect(await collectProtoStyleTokensFromFiles([entry])).toEqual(['h-9']);
  });
  const rule = (declarations: string, state: string, expose: string, expected: string) => `
    export default definePrototype({name:'test', setup(def) {
      ${declarations}
      const flag = def.state.string(${state}, 'rest');
      def.expose.state(${expose}, flag);
      def.rule({when:w=>w.state(flag).eq(${expected}), intent:i=>i.feedback.style.use(tw('opacity-50'))});
    }});`;
  it.each([
    `const names=['owned']; const selected=names.join(mutate(names));`,
    `const names=['owned']; const selected=names.join('',mutate(names));`,
    `const selected=['owned',external()].join('');`,
    `const selected=\`owned\${external()}\`;`,
    `const names=['owned']; names.extra='other'; const selected=names.join('');`,
    `const names=['owned']; delete names[0]; const selected=names.join('');`,
    `const names=['owned']; names.length=0; const selected=names.join('');`,
    `const names=['owned']; names.join=external(); const selected=names.join('');`,
  ])('does not certify opaque join/template or mutated array shape: %s', async (declarations) => {
    const result=await collect(rule(declarations, 'selected', `'visible'`, `'hot'`));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
    expect(result).not.toContain('data-[ownedother=hot]:opacity-50');
    expect(result).not.toContain('data-[visible=hot]:opacity-50');
  });
  it('does not certify opaque joined Rule expected value', async () => {
    const result=await collect(rule(`const selected=['hot',external()].join('');`, `'owned'`, `'owned'`, 'selected'));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it('retains imported joined templates through a barrel', async () => {
    expect(await collect(`import {tokens} from './bridge'; tw(\`bg-mint \${tokens} h-4\`);`, {
      'style.ts': `export const tokens=['p-2','text-sm'].join(' ');`,
      'bridge.ts': `export {tokens} from './style';`,
    })).toEqual(['bg-mint','h-4','p-2','text-sm']);
  });
  it('does not certify known-plus-unknown state name', async () => {
    const result = await collect(rule(`const names={a:{name:'owned'}}; const key=externalCondition?'a':external();`, `names[key].name`, `'visible'`, `'hot'`));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
    expect(result).not.toContain('data-[visible=hot]:opacity-50');
  });
  it('does not certify an unknown Rule value through a nested table', async () => {
    const result = await collect(rule(`const values={a:{value:'hot'}}; const key=externalCondition?'a':external(); const expected=values[key].value;`, `'owned'`, `'owned'`, 'expected'));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it('does not certify a partially known expose name on an unknown declaration', async () => {
    const result = await collect(rule(`const names={a:{name:'visible'}}; const key=externalCondition?'a':external(); const exposed=names[key].name;`, 'external()', 'exposed', `'hot'`));
    expect(result).not.toContain('data-[visible=hot]:opacity-50');
  });
  it('does not certify a state name after a container escapes to an unknown call', async () => {
    const result = await collect(rule(`const names={a:{name:'owned'}}; const alias=names.a; external(alias);`, 'names.a.name', `'visible'`, `'hot'`));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it('keeps a partial imported array element unknown in state/Rule declarations', async () => {
    const result = await collect(`import {names} from './names';
      export default definePrototype({name:'test', setup(def) {
        for (const name of names) {
          const state=def.state.string(name, 'rest'); def.expose.state('visible',state);
          def.rule({when:w=>w.state(state).eq('hot'), intent:i=>i.feedback.style.use(tw('opacity-50'))});
        }
      }});`, {'names.ts': `export const names=[choose?'owned':external()] as const;`});
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
    expect(result).not.toContain('data-[visible=hot]:opacity-50');
  });
  it('does not use a dynamic write inventory as an exact state name', async () => {
    const result = await collect(rule(`const names={a:{name:'owned'}}; names.a[external()]='other';`, 'names.a.name', `'visible'`, `'hot'`));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
    expect(result).not.toContain('data-[other=hot]:opacity-50');
  });
  it.each(['[name]', '{name}'])('shadows outer exact names in bound loop pattern %s', async (pattern) => {
    const row = pattern === '[name]' ? '[external()]' : '{name:external()}';
    const result = await collect(`const name='owned'; const rows=[${row}];
      export default definePrototype({name:'test', setup(def) {
        for(const ${pattern} of rows) {
          const state=def.state.string(name,'rest'); def.expose.state('visible',state);
          def.rule({when:w=>w.state(state).eq('hot'),intent:i=>i.feedback.style.use(tw('opacity-50'))});
        }
      }});`);
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
    expect(result).not.toContain('data-[visible=hot]:opacity-50');
  });
  it('does not certify a name overwritten by an incomplete spread', async () => {
    const result=await collect(rule(`const src={[external()]:'other'}; const names={name:'owned',...src};`, 'names.name', `'visible'`, `'hot'`));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it('resolves finite keys through a named re-export alias', async () => {
    expect(await collect(`import {keys} from './bridge'; ${table} for(const key of keys) tw(table[key].root);`, {
      'context.ts': `export const ids=['a','b'] as const;`,
      'bridge.ts': `export {ids as keys} from './context';`,
    })).toEqual(['max-h-72','pb-0']);
  });
  it.each([
    `const names=[...external(),'owned']; const selected=names[1];`,
    `const names={name:'owned',get name(){return external()}}; const selected=names.name;`,
    `const name='owned'; const {name:selected}=external();`,
  ])('does not certify unknown positions/accessors/destructures: %s', async (declarations) => {
    const result=await collect(rule(declarations, 'selected', `'visible'`, `'hot'`));
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it('does not certify cached constants before unmodeled module effects', async () => {
    const result=await collect(`import {names} from './names';` + rule('', 'names.name', `'visible'`, `'hot'`), {
      'names.ts': `export const names={name:'owned'}; names.name=external();`,
    });
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it.each([
    `const ignored=mutate(names);`,
    `const ignored=(names.name=external());`,
  ])('does not certify cached constants before initializer effects: %s', async (effect) => {
    const result=await collect(`import {names} from './names';` + rule('', 'names.name', `'visible'`, `'hot'`), {
      'names.ts': `export const names={name:'owned'}; ${effect}`,
    });
    expect(result).not.toContain('data-[owned=hot]:opacity-50');
  });
  it('keeps exact known semantic names available', async () => {
    const result = await collect(rule(`const names={a:{name:'owned', value:'hot'}}; const expected=names.a.value;`, 'names.a.name', `'visible'`, 'expected'));
    expect(result).toContain('data-[owned=hot]:opacity-50');
  });
});
