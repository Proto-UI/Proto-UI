// @vitest-environment node
import { SourceMap, type SourceMapPayload } from 'node:module';
import { describe, expect, it } from 'vitest';
import type { SourceSpan } from '../src/ir';
import { buildSourceMap, type SourceMapInput } from '../src/source-map';

function span(file: string, line: number, column: number): SourceSpan {
  return { file, line, column, start: 0, end: 0, endLine: line, endColumn: column };
}

function consume(input: SourceMapInput): SourceMap {
  // Node's payload type makes optional v3 fields mandatory and disallows null
  // content entries. The runtime accepts the standard v3 payload unchanged.
  return new SourceMap(buildSourceMap(input) as SourceMapPayload);
}

describe('standard source-map consumer lookup', () => {
  it('resolves expanded helper locations across files, lines and negative deltas', () => {
    const map = consume({
      file: 'Component.tsx',
      sources: [
        { path: 'src/helpers.proto.ts', content: '\n'.repeat(40) },
        { path: 'src/button.proto.ts', content: '\n'.repeat(20) },
      ],
      mappings: [
        {
          generatedLine: 2,
          generatedColumn: 3,
          source: span('src/helpers.proto.ts', 35, 70),
          name: 'zHelper',
        },
        {
          generatedLine: 2,
          generatedColumn: 18,
          source: span('src/button.proto.ts', 8, 4),
          name: 'aButton',
        },
        { generatedLine: 4, generatedColumn: 1, source: span('src/helpers.proto.ts', 2, 9) },
        {
          generatedLine: 5,
          generatedColumn: 7,
          source: span('src/button.proto.ts', 12, 2),
          name: 'zHelper',
        },
      ],
    });

    expect(map.findEntry(0, 0)).toEqual({});
    expect(map.findEntry(1, 2)).toMatchObject({
      generatedLine: 1,
      generatedColumn: 2,
      originalSource: 'src/helpers.proto.ts',
      originalLine: 34,
      originalColumn: 69,
    });
    expect(map.findEntry(1, 17)).toMatchObject({
      generatedLine: 1,
      generatedColumn: 17,
      originalSource: 'src/button.proto.ts',
      originalLine: 7,
      originalColumn: 3,
    });
    expect(map.findEntry(3, 0)).toMatchObject({
      generatedLine: 3,
      generatedColumn: 0,
      originalSource: 'src/helpers.proto.ts',
      originalLine: 1,
      originalColumn: 8,
    });
    expect(map.findEntry(4, 6)).toMatchObject({
      generatedLine: 4,
      generatedColumn: 6,
      originalSource: 'src/button.proto.ts',
      originalLine: 11,
      originalColumn: 1,
    });
    expect(map.findOrigin(2, 3)).toMatchObject({
      name: 'zHelper',
      fileName: 'src/helpers.proto.ts',
      lineNumber: 35,
      columnNumber: 70,
    });
    expect(map.findOrigin(2, 18)).toMatchObject({
      name: 'aButton',
      fileName: 'src/button.proto.ts',
      lineNumber: 8,
      columnNumber: 4,
    });
    expect(map.findOrigin(5, 7)).toMatchObject({
      name: 'zHelper',
      fileName: 'src/button.proto.ts',
      lineNumber: 12,
      columnNumber: 2,
    });
  });

  it('keeps emitted bytes deterministic when source graph enumeration changes', () => {
    const input: SourceMapInput = {
      file: './Component.tsx',
      sources: [{ path: 'src\\z.proto.ts', content: 'z' }, { path: './src/a.proto.ts' }],
      mappings: [
        { generatedLine: 1, generatedColumn: 1, source: span('src/z.proto.ts', 1, 1), name: 'z' },
        { generatedLine: 1, generatedColumn: 9, source: span('src/a.proto.ts', 2, 3), name: 'a' },
      ],
    };
    expect(JSON.stringify(buildSourceMap(input))).toBe(
      JSON.stringify(
        buildSourceMap({
          ...input,
          sources: [...input.sources].reverse(),
        })
      )
    );
    expect(consume(input).findEntry(0, 8)).toMatchObject({
      originalSource: 'src/a.proto.ts',
      originalLine: 1,
      originalColumn: 2,
    });
  });

  it('leaves an empty map without fabricated author locations', () => {
    expect(consume({ file: 'Component.tsx', sources: [], mappings: [] }).findEntry(0, 0)).toEqual(
      {}
    );
  });

  it('delivers the matching embedded author text without inventing missing source content', () => {
    const map = consume({
      file: 'Component.tsx',
      sources: [
        { path: 'helper.proto.ts', content: 'export const helper = true;\n' },
        { path: 'button.proto.ts' },
        { path: 'empty.proto.ts', content: '' },
      ],
      mappings: [
        { generatedLine: 1, generatedColumn: 1, source: span('helper.proto.ts', 1, 14) },
        { generatedLine: 2, generatedColumn: 1, source: span('button.proto.ts', 1, 1) },
        { generatedLine: 3, generatedColumn: 1, source: span('empty.proto.ts', 1, 1) },
      ],
    });
    const originalText = (line: number) => {
      const entry = map.findEntry(line, 0);
      if (!('originalSource' in entry)) throw new Error('Expected an original author location.');
      return map.payload.sourcesContent[map.payload.sources.indexOf(entry.originalSource)];
    };
    expect(originalText(0)).toBe('export const helper = true;\n');
    expect(originalText(1)).toBeNull();
    expect(originalText(2)).toBe('');
  });

  it.each([
    '/home/user/private.proto.ts',
    'C:\\Users\\author\\private.proto.ts',
    '\\\\server\\private.proto.ts',
    '../private.proto.ts',
    'src/../../private.proto.ts',
    'file:///home/user/private.proto.ts',
    'https://example.com/private.proto.ts',
    'src/private.proto.ts\0',
  ])('rejects unsafe source identity %s before consumer delivery', (file) => {
    expect(() =>
      buildSourceMap({ file: 'Component.tsx', sources: [{ path: file }], mappings: [] })
    ).toThrow(TypeError);
    expect(() => buildSourceMap({ file, sources: [], mappings: [] })).toThrow(TypeError);
  });

  it('rejects aliases for the same source rather than selecting arbitrary content', () => {
    expect(() =>
      buildSourceMap({
        file: 'Component.tsx',
        sources: [{ path: 'src/a.proto.ts' }, { path: './src/a.proto.ts' }],
        mappings: [],
      })
    ).toThrow(/Duplicate source file/);
  });

  it.each([
    [2, 1, 1, 1], // Reversed line.
    [1, 9, 1, 3], // Reversed column.
    [1, 3, 1, 3], // Duplicate generated position, even with a different source.
  ])(
    'rejects ambiguous generated order (%i:%i then %i:%i)',
    (line, column, nextLine, nextColumn) => {
      expect(() =>
        buildSourceMap({
          file: 'Component.tsx',
          sources: [{ path: 'a.proto.ts' }, { path: 'b.proto.ts' }],
          mappings: [
            { generatedLine: line, generatedColumn: column, source: span('a.proto.ts', 1, 1) },
            {
              generatedLine: nextLine,
              generatedColumn: nextColumn,
              source: span('b.proto.ts', 1, 1),
            },
          ],
        })
      ).toThrow(/duplicate or out of generated order/);
    }
  );

  it('rejects unknown sources and malformed generated or original coordinates', () => {
    const input: SourceMapInput = {
      file: 'Component.tsx',
      sources: [{ path: 'a.proto.ts' }],
      mappings: [{ generatedLine: 1, generatedColumn: 1, source: span('a.proto.ts', 1, 1) }],
    };
    const mapping = input.mappings[0];
    expect(() =>
      buildSourceMap({
        ...input,
        mappings: [{ ...mapping, source: span('missing.proto.ts', 1, 1) }],
      })
    ).toThrow(/undeclared source/);
    expect(() =>
      buildSourceMap({ ...input, mappings: [{ ...mapping, generatedLine: 0 }] })
    ).toThrow(/generatedLine/);
    expect(() =>
      buildSourceMap({ ...input, mappings: [{ ...mapping, generatedColumn: 1.5 }] })
    ).toThrow(/generatedColumn/);
    expect(() =>
      buildSourceMap({ ...input, mappings: [{ ...mapping, source: span('a.proto.ts', 1, 0) }] })
    ).toThrow(/source.column/);
    expect(() =>
      buildSourceMap({
        ...input,
        mappings: [{ ...mapping, source: { ...mapping.source, end: -1 } }],
      })
    ).toThrow(/source.end/);
    expect(() =>
      buildSourceMap({
        ...input,
        mappings: [{ ...mapping, source: { ...mapping.source, line: 2 } }],
      })
    ).toThrow(/reversed source span/);
  });
});
