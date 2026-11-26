import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const helper = `export function acquire(def) {
  const selected = def.state.bool('private-choice', false);
  return selected;
}`;
const entry = (body: string) => `
  import { definePrototype, tw } from '@proto.ui/core';
  import { acquire } from './helper';
  export default definePrototype({ name: 'private-callback-relay', setup(def) {
    def.props.define({ flag: { type: 'boolean' } });
    const selected = acquire(def);
    ${body}
    def.rule({ when: w => w.state(selected).eq(true),
      intent: i => i.feedback.style.use(tw('bg-primary')) });
  } });
`;
const sync = `const sync = (run) => { selected.set(run.props.get().flag); };
  def.lifecycle.onCreated(sync);`;

describe('returned local State through private native callback relays', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-callback-relay-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    await writeFile(path.join(directory, 'helper.ts'), helper);
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const scan = async (body: string) => {
    const file = path.join(directory, 'entry.proto.ts');
    await writeFile(file, entry(body));
    const inventory = scanRuleStateReadInventory([file]);
    expect(inventory.evaluated).toHaveLength(1);
    expect(inventory.evaluated[0].declarationOnly).toBe(false);
    return inventory.evaluated[0];
  };
  it('closes a lifecycle callback also called with the exact native Props callback parameter', async () => {
    const row = await scan(`${sync} def.props.watch(['flag'], (run) => { sync(run); });`);
    expect(row.unresolved).toEqual([]);
    expect(row.exposedLocals).toEqual([]);
    expect(row.usages).toEqual([]);
  });
  it('closes a zero-argument private reset called only by an exact native event wrapper', async () => {
    const row = await scan(`const clear = () => { selected.set(false); };
      def.lifecycle.onUnmounted(clear);
      const onChange = (_run, _event) => { clear(); };
      def.event.on('change', onChange);`);
    expect(row.unresolved).toEqual([]);
    expect(row.exposedLocals).toEqual([]);
  });
  it.each([
    [
      'callback alias',
      `${sync} const alias = sync; def.props.watch(['flag'], (run) => { alias(run); });`,
    ],
    [
      'callback escape',
      `${sync} opaque(sync); def.props.watch(['flag'], (run) => { sync(run); });`,
    ],
    ['returned callback', `${sync} def.props.watch(['flag'], (run) => { return sync; });`],
    ['unknown registration', `${sync} schedule((run) => { sync(run); });`],
    [
      'foreign registration receiver',
      `${sync} foreign.props.watch(['flag'], (run) => { sync(run); });`,
    ],
    [
      'effectful relay argument',
      `${sync} def.props.watch(['flag'], (run) => { sync(opaque()); });`,
    ],
    [
      'reassigned wrapper parameter',
      `${sync} def.props.watch(['flag'], (run) => { run = foreign; sync(run); });`,
    ],
    [
      'stored relay result',
      `${sync} def.props.watch(['flag'], (run) => { const result = sync(run); });`,
    ],
    ['synchronous setup call', `${sync} sync(foreign);`],
    [
      'callback reassignment',
      `${sync.replace('const sync', 'let sync')} sync = foreign; def.props.watch(['flag'], (run) => { sync(run); });`,
    ],
    [
      'wrapper escape',
      `${sync} const onChange = (run) => { sync(run); }; def.props.watch(['flag'], onChange); opaque(onChange);`,
    ],
    [
      'State method replacement',
      `${sync} def.props.watch(['flag'], (run) => { selected.set = foreign; sync(run); });`,
    ],
    [
      'recursive callback',
      `const sync = (run) => { selected.set(true); sync(run); }; def.lifecycle.onCreated(sync);`,
    ],
  ])('keeps %s unresolved', async (_label, body) => {
    expect((await scan(body)).unresolved).toContainEqual({
      expression: 'selected',
      reason: 'subject',
    });
  });
});
