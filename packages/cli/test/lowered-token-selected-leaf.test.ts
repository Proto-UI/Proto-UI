import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

async function observe(declaration: string, token: string, later = '') {
  const directory = await mkdtemp(path.join(tmpdir(), 'lowered-selected-leaf-'));
  try {
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `import { definePrototype, tw } from '@proto.ui/core';
declare const key: string;
declare const external: string;
declare function mutate(value: unknown): void;
export default definePrototype({ name: 'selected-leaf-consumer', setup(def) {
  const flag = def.state.bool('internalFlag', false);
  def.expose.state('visible', flag);
  ${declaration}
  def.rule({ when: w => w.state(controls.ready).eq(true),
    intent: i => i.feedback.style.use(tw(${token})) });
  ${later}
} });`;
    await writeFile(file, source);
    return {
      scan: scanRuleStateReads(source, file),
      tokens: await collectProtoStyleTokensFromFiles([file]),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('own token leaves beside a State handle', () => {
  const flat = "const controls = { ready: flag, className: 'bg-red' };";
  const nested = "const controls = { ready: flag, palette: { className: 'bg-red' } };";

  it.each([
    ['literal element', flat, "controls['className']"],
    ['dot', flat, 'controls.className'],
    ['nested literal path', nested, "controls.palette['className']"],
  ])('keeps actual collector coverage for the %s', async (_label, declaration, token) => {
    const { scan, tokens } = await observe(declaration, token);
    expect(tokens).toContain('data-[internal-flag]:bg-red');
    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it.each([
    ['State selected as token', flat, 'controls.ready', ''],
    ['unknown selected key', flat, 'controls[key]', ''],
    [
      'deferred selected-leaf write',
      flat,
      'controls.className',
      'function later() { controls.className = external; }',
    ],
    ['owner escape', flat, 'controls.className', 'mutate(controls);'],
    ['nested owner escape', nested, 'controls.palette.className', 'mutate(controls.palette);'],
  ])('does not certify a %s', async (_label, declaration, token, later) => {
    const { scan } = await observe(declaration, token, later);
    expect(scan.usages).toEqual([]);
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['intent']);
  });
});
