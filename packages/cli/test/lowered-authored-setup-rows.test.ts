import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const rule = `for (const row of ROWS) {
  def.rule({ when: w => w.state(direction).eq(row),
    intent: i => i.feedback.style.use(tw('bg-primary')) });
}`;

async function observe({
  imports = "import { definePrototype, tw } from '@proto.ui/core';",
  factory = 'definePrototype',
  before = '',
  after = '',
}: { imports?: string; factory?: string; before?: string; after?: string } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lowered-authored-setup-rows-'));
  try {
    await writeFile(
      path.join(directory, 'rows.ts'),
      "export const ROWS = ['left', 'right'] as const;"
    );
    const file = path.join(directory, 'consumer.proto.ts');
    const source = `${imports}
import { ROWS } from './rows';
export default ${factory}({ name: 'rows', setup(def) {
  const direction = def.state.string('direction', 'left');
  def.expose.state('direction', direction);
  ${before}
  ${rule}
  ${after}
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

describe('finite rows captured by an authored setup', () => {
  for (const [name, imports, factory] of [
    [
      'canonical factory',
      "import { definePrototype, tw } from '@proto.ui/core';",
      'definePrototype',
    ],
    [
      'renamed factory',
      "import { definePrototype as authored, tw } from '@proto.ui/core';",
      'authored',
    ],
  ]) {
    it(`proves the actual rows through the ${name} instead of escaping its entire body`, async () => {
      const { scan, tokens } = await observe({ imports, factory });
      expect(scan.unresolved).toEqual([]);
      expect(scan.exposedLocals).toEqual([
        { state: 'direction', exposedAs: 'direction', attribute: 'direction' },
        { state: 'direction', exposedAs: 'direction', attribute: 'direction' },
      ]);
      expect(tokens).toContain('data-[direction=left]:bg-primary');
      expect(tokens).toContain('data-[direction=right]:bg-primary');
    });
  }

  for (const [name, options] of [
    ['an actual opaque call receiving the array', { before: 'mutate(ROWS);' }],
    ['a later return exposing the array', { after: 'return ROWS;' }],
    [
      'a deferred opaque call receiving the array',
      { after: 'def.lifecycle.onCreated(() => mutate(ROWS));' },
    ],
    ['a member write after the loop', { after: "ROWS[0] = 'changed';" }],
    [
      'a same-named local factory',
      {
        imports: "import { tw } from '@proto.ui/core'; const definePrototype = value => value;",
      },
    ],
    [
      'an ordinary unknown callback owner',
      {
        imports: "import { tw } from '@proto.ui/core';",
        factory: 'consume',
      },
    ],
  ] as const) {
    it(`keeps ${name} unresolved`, async () => {
      const { scan } = await observe(options);
      expect(scan.exposedLocals).toEqual([]);
      expect(scan.unresolved).toEqual([
        { reason: 'comparison', expression: 'w.state(direction).eq(row)' },
      ]);
    });
  }
});
