import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ENTRY_SOURCE_FILES = [
  'src/index.ts',
  'src/code-block/index.ts',
  'src/code-block/shared.ts',
  'src/code-block/styles.ts',
  'src/code-block/types.ts',
  'src/code-block/root.proto.ts',
  'src/code-block/header.proto.ts',
  'src/code-block/content.proto.ts',
] as const;
const PART_SOURCE_FILES = [
  'src/code-block/root.proto.ts',
  'src/code-block/header.proto.ts',
  'src/code-block/content.proto.ts',
] as const;
const FORBIDDEN_OWNERSHIP_MUTATIONS = [
  {
    label: 'Props, State, Context, Expose, Event, or a11y channel',
    pattern: /\b(?:props|state|context|expose|event|a11y)\b/,
    mutant: 'def.state.bool("selected", false)',
  },
  {
    label: 'command or trigger behavior',
    pattern: /\b(?:asButton|asTrigger|command)\b/,
    mutant: 'asButton()',
  },
  {
    label: 'semantic capability module',
    pattern: /@proto\.ui\/(?:hooks|module-(?:state|context|expose|event|a11y|scroll))/,
    mutant: 'import { createScrollModule } from "@proto.ui/module-scroll"',
  },
  {
    label: 'App-owned code metadata or host behavior',
    pattern:
      /\b(?:clipboard|copy|highlighter|highlightedTokens|language|filename|selection|scrollbar|scrollWidth|getBoundingClientRect)\b/i,
    mutant: 'def.props.define({ highlightedTokens: { type: "json" } })',
  },
  {
    label: 'App callback or event prop',
    pattern: /\bon[A-Z][A-Za-z0-9]*\b/,
    mutant: 'onCopy?: () => void',
  },
] as const;

function readEntrySource(file: (typeof ENTRY_SOURCE_FILES)[number]): string {
  return readFileSync(resolve(process.cwd(), 'packages/compositions/chatui', file), 'utf8');
}

describe('@proto.ui/compositions-chatui: CodeBlock ownership boundary', () => {
  it.each(FORBIDDEN_OWNERSHIP_MUTATIONS)(
    'rejects a $label mutation while allowing only anatomy and visual feedback',
    ({ pattern, mutant }) => {
      expect(pattern.test(mutant)).toBe(true);

      for (const file of ENTRY_SOURCE_FILES) {
        expect(readEntrySource(file), file).not.toMatch(pattern);
      }
    }
  );

  it('keeps every part limited to anatomy claims and visual feedback', () => {
    for (const file of PART_SOURCE_FILES) {
      const source = readEntrySource(file);
      expect(source, file).toContain('def.anatomy.claim');
      expect(source, file).toContain('def.feedback.style.use');
    }
  });
});
