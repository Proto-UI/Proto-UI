import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDir = resolve(process.cwd(), 'packages/compositions/chatui/src/message');
const sourceFiles = readdirSync(sourceDir, { recursive: true, encoding: 'utf8' }).filter((file) =>
  file.endsWith('.ts')
);
const forbidden = [
  {
    label: 'a second State, Event, Context, Expose, or accessibility owner',
    pattern: /\b(?:def|run)\.(?:state|event|context|expose|a11y)\b|\basAccessible\s*\(/,
    mutant: 'def.state.bool("streaming", false)',
  },
  {
    label: 'an implicitly installed semantic control or capability',
    pattern: /@proto\.ui\/(?:hooks|module-|prototypes-)|\bas(?:Button|Trigger)\s*\(/,
    mutant: 'import { asButton } from "@proto.ui/prototypes-base/button"',
  },
  {
    label: 'App-owned message metadata or action callbacks',
    pattern: /\b(?:messageId|sender|timestamp|delivery|streaming|onRetry|onCopy|onEdit|onBranch)\b/,
    mutant: 'onRetry?: () => void',
  },
] as const;

describe('@proto.ui/compositions-chatui: Message ownership boundary', () => {
  it.each(forbidden)('rejects $label in the composition source', ({ pattern, mutant }) => {
    expect(pattern.test(mutant)).toBe(true);
    for (const file of sourceFiles) {
      expect(readFileSync(resolve(sourceDir, file), 'utf8'), file).not.toMatch(pattern);
    }
  });

  it('contains no untyped or unfinished implementation surface', () => {
    for (const file of sourceFiles) {
      expect(readFileSync(resolve(sourceDir, file), 'utf8'), file).not.toMatch(/\bany\b|\bTODO\b/);
    }
  });
});
