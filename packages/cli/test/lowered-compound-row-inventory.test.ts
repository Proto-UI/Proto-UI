import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

type Fixture = {
  rows?: string;
  binding?: string;
  before?: string;
  body?: string;
  after?: string;
  subject?: string;
};

async function observe({
  rows = "const ROWS = [['left', 'bg-primary'], ['right', 'bg-muted']] as const;",
  binding = 'const [position, paint]',
  before = '',
  body = '',
  after = '',
  subject = 'state.position',
}: Fixture = {}) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-compound-css-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.resolve(process.cwd(), 'tsconfig.json') })
    );
    await writeFile(
      path.join(directory, 'state.ts'),
      `import { defineAsHook } from '@proto.ui/core';
       export const asPosition = defineAsHook({ name: 'compound-position',
         setup(def) { def.state.enum('position', 'left', { options: ['left', 'right'] }); },
         projectHandle: result => ({ position: result.stateHandles.position })
       });`
    );
    const file = path.join(directory, 'entry.proto.ts');
    const source = `import { definePrototype, tw } from '@proto.ui/core';
      import { asPosition } from './state';
      declare const external: any;
      ${rows}
      export default definePrototype({ name: 'compound-css', setup(def) {
        const state = asPosition();
        ${before}
        for (${binding} of ROWS) {
          ${body}
          def.rule({ when: w => w.state(${subject}).eq(position),
            intent: i => i.feedback.style.use(tw(paint)) });
        }
        ${after}
      } });`;
    await writeFile(file, source);
    return {
      scan: scanRuleStateReads(source, file),
      comparisonScan: scanRuleStateReads(source.replace('tw(paint)', "tw('ring-2')"), file),
      tokens: await collectProtoStyleTokensFromFiles([file]),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('compound-row CSS inventory stays separate from complete lowering proof', () => {
  it.each([
    ['tuple rows', {}],
    [
      'object rows',
      {
        rows: "const ROWS = [{ position: 'left', paint: 'bg-primary' }, { position: 'right', paint: 'bg-muted' }] as const;",
        binding: 'const { position, paint }',
      },
    ],
  ] as const)('retains known comparison/token pairs from %s', async (_name, fixture) => {
    const { scan, comparisonScan, tokens } = await observe(fixture);
    expect(tokens.filter((token) => token.startsWith('data-[position=')).sort()).toEqual([
      'data-[position=left]:bg-primary',
      'data-[position=right]:bg-muted',
    ]);
    // A shared compound row has a second mutable alias layer. CSS resources
    // do not certify that layer, or turn the ordinary comparison proof green.
    expect(comparisonScan.unresolved.some(({ reason }) => reason === 'comparison')).toBe(true);
    expect(scan.usages).toEqual([]);
  });

  it.each([
    ['direct row write', { before: 'ROWS[0][0] = external;' }],
    ['later row write', { after: 'ROWS[0][0] = external;' }],
    ['row escape', { before: 'external(ROWS[0]);' }],
    ['whole-array escape', { before: 'external(ROWS);' }],
    ['retained alias', { before: 'const alias = ROWS[0]; external(alias);' }],
    [
      'reflective iterator replacement',
      {
        before:
          "Reflect.get(ROWS, '__proto__')[Symbol.iterator] = function* () { yield ['foreign', 'text-red-900']; };",
      },
    ],
  ] as const)('keeps %s outside the ordinary proof', async (_name, fixture) => {
    const { scan, comparisonScan, tokens } = await observe(fixture);
    expect(comparisonScan.unresolved.some(({ reason }) => reason === 'comparison')).toBe(true);
    expect(scan.usages).toEqual([]);
    // Known lexical words are a partial resource inventory. An opaque value
    // cannot become a fabricated finite comparison or a complete runtime claim.
    expect(tokens).not.toContain('data-[position=external]:bg-primary');
    expect(tokens).not.toContain('data-[position=foreign]:text-red-900');
  });

  it('does not recover a candidate from an overwritten comparison binding', async () => {
    const { scan, comparisonScan, tokens } = await observe({
      binding: 'let [position, paint]',
      body: 'position = external;',
    });
    expect(comparisonScan.unresolved.some(({ reason }) => reason === 'comparison')).toBe(true);
    expect(tokens.filter((token) => token.startsWith('data-[position='))).toEqual([]);
  });

  it('does not recover State identity from a foreign subject', async () => {
    const { scan, comparisonScan, tokens } = await observe({ subject: 'external' });
    expect(comparisonScan.unresolved.length).toBeGreaterThan(0);
    expect(tokens.filter((token) => token.startsWith('data-['))).toEqual([]);
  });

  it('does not create selector fragments from unsafe string candidates', async () => {
    const { scan, comparisonScan, tokens } = await observe({
      rows: "const ROWS = [['left right', 'bg-primary'], ['broken]value', 'bg-muted']];",
    });
    expect(comparisonScan.unresolved.some(({ reason }) => reason === 'comparison')).toBe(true);
    expect(tokens.filter((token) => token.startsWith('data-[position='))).toEqual([]);
  });
});
