import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

/** A real intent: the variant is a prefix on tokens, so a stub yields nothing. */
const rule = (condition: string) =>
  `def.rule({ when: (w) => ${condition}, intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

describe('default import hook binding', () => {
  it('does not certify the built-in hook table for a default import that is not a producer', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'default-import-nonproducer-'));
    try {
      // The default export is an ordinary value, not an authored producer.
      await writeFile(
        path.join(dir, 'custom.ts'),
        ['export default { checked: true };'].join('\n')
      );
      const file = path.join(dir, 'consumer.proto.ts');
      const source = [
        "import asCheckboxRoot from './custom';",
        'const { checked } = asCheckboxRoot().stateHandles;',
        rule('w.state(checked).eq(true)'),
      ].join('\n');
      await writeFile(file, source);

      const scan = scanRuleStateReads(source, file, createHookSourceSummaryContext());
      // The local spelling names the module's default export, so the built-in
      // `asCheckboxRoot` table proves nothing about it.
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'checked', reason: 'subject' }]);

      const tokens = await collectProtoStyleTokensFromFiles([file]);
      expect(tokens).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^data-\[checked\]/)])
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves a default import that is a proven producer', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'default-import-producer-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export default defineAsHook({ name: 'checkbox', setup(d) { d.state.bool('ready', false); } });",
        ].join('\n')
      );
      const file = path.join(dir, 'consumer.proto.ts');
      const source = [
        "import myCheckbox from './producer';",
        'const { ready } = myCheckbox().stateHandles;',
        rule('w.state(ready).eq(true)'),
      ].join('\n');
      await writeFile(file, source);

      const scan = scanRuleStateReads(source, file, createHookSourceSummaryContext());
      // The source summary proves the producer, so the authored state is read
      // through the imported default rather than a built-in table.
      expect(scan.usages).toEqual([{ hook: 'myCheckbox', state: 'ready' }]);
      expect(scan.unresolved).toEqual([]);

      const tokens = await collectProtoStyleTokensFromFiles([file]);
      expect(tokens).toContain('data-[ready]:bg-primary');
      expect(tokens).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^data-\[checked\]/)])
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('still certifies a named import of a built-in hook', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'default-import-named-control-'));
    try {
      const file = path.join(dir, 'consumer.proto.ts');
      const source = [
        "import { asCheckboxRoot } from '@proto.ui/hooks';",
        'const { checked } = asCheckboxRoot().stateHandles;',
        rule('w.state(checked).eq(true)'),
      ].join('\n');
      await writeFile(file, source);

      const scan = scanRuleStateReads(source, file, createHookSourceSummaryContext());
      expect(scan.usages).toEqual([{ hook: 'asCheckboxRoot', state: 'checked' }]);
      expect(scan.unresolved).toEqual([]);

      const tokens = await collectProtoStyleTokensFromFiles([file]);
      expect(tokens).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
