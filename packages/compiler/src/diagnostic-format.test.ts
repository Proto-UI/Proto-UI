// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CompilerDiagnostic } from './ir';
import {
  diagnosticsJson,
  formatCompilerDiagnostic,
  formatCompilerDiagnostics,
} from './diagnostic-format';
import { parsePrototype } from './parser';

function diagnostic(start: number, end: number, file = 'src/example.proto.ts'): CompilerDiagnostic {
  return {
    code: 'PUI1004',
    category: 'unsupported-input',
    message: 'This operation is not supported.',
    span: { file, start, end, line: 1, column: start + 1, endLine: 1, endColumn: end + 1 },
  };
}

function excerpt(source: string, start: number, end: number): string[] {
  return formatCompilerDiagnostic(diagnostic(start, end), {
    sources: { 'src/example.proto.ts': source },
  })
    .split('\n')
    .slice(1);
}

describe('original-source diagnostic presentation', () => {
  it('uses four-column tab stops at the current visible column for both text and carets', () => {
    expect(excerpt('ab\tx\ty', 5, 6)).toEqual([' 1 | ab  x   y', '   |         ^']);
    expect(excerpt('ab\tx', 2, 3)).toEqual([' 1 | ab  x', '   |   ^~']);
  });

  it('maps UTF-16 offsets through emoji, combining marks, wide text and grapheme clusters', () => {
    const source = '😀e\u0301界\tbad';
    const start = source.indexOf('bad');
    const formatted = formatCompilerDiagnostic(diagnostic(start, source.length), {
      sources: { 'src/example.proto.ts': source },
    });
    expect(formatted.split('\n')[0]).toContain(
      'src/example.proto.ts:1:7-1:10: PUI1004 [unsupported-input]'
    );
    expect(formatted.split('\n').slice(1)).toEqual([' 1 | 😀é界   bad', '   |         ^~~']);
    const family = '👩‍👩‍👦';
    expect(excerpt(`${family}bad`, family.length, family.length + 3)).toEqual([
      ` 1 | ${family}bad`,
      '   |   ^~~',
    ]);
    // A UTF-16 boundary inside a surrogate pair must not create a broken character/caret.
    expect(excerpt('😀x', 1, 2)).toEqual([' 1 | 😀x', '   | ^~']);
  });

  it('shows every covered line, recognizes CRLF, and treats range ends as exclusive', () => {
    const source = 'before\r\n\talpha\r\n\tbeta\r\nafter';
    const start = source.indexOf('alpha');
    const end = source.indexOf('after');
    const formatted = formatCompilerDiagnostic(diagnostic(start, end), {
      sources: { 'src/example.proto.ts': source },
    });
    expect(formatted.split('\n')[0]).toContain('src/example.proto.ts:2:2-4:1:');
    expect(formatted.split('\n').slice(1)).toEqual([
      ' 2 |     alpha',
      '   |     ^~~~~',
      ' 3 |     beta',
      '   | ^~~~~~~~',
    ]);
    expect(excerpt('a\nbc\nd', 0, 4)).toEqual([' 1 | a', '   | ^', ' 2 | bc', '   | ^~']);
  });

  it('renders an EOF point and an empty selected line without dropping the location', () => {
    expect(excerpt('abc\n', 4, 4)).toEqual([' 2 | ', '   | ^']);
    expect(excerpt('a\n\nb', 2, 3)).toEqual([' 2 | ', '   | ^']);
  });

  it('retains reported original positions when source is missing or offsets cannot be trusted', () => {
    const value = diagnostic(2, 5);
    value.span.line = 8;
    value.span.column = 3;
    value.span.endLine = 9;
    value.span.endColumn = 1;
    expect(formatCompilerDiagnostic(value)).toBe(
      'src/example.proto.ts:8:3-9:1: PUI1004 [unsupported-input] This operation is not supported.\n  (source unavailable)'
    );
    expect(formatCompilerDiagnostic(value, { sources: { 'src/example.proto.ts': 'x' } })).toBe(
      'src/example.proto.ts:8:3-9:1: PUI1004 [unsupported-input] This operation is not supported.\n  (source span unavailable)'
    );
  });

  it('normalizes graph identities without exposing absolute/traversing paths or arbitrary error fields', () => {
    const unsafe = [
      '/home/private/project/example.proto.ts',
      'C:\\private\\project\\example.proto.ts',
      '\\\\server\\private\\example.proto.ts',
      '../../private/example.proto.ts',
      'file:///private/example.proto.ts',
    ];
    for (const file of unsafe) {
      const value = Object.assign(diagnostic(0, 0, file), {
        message: `Cannot load '${file}' or /home/private/config.json`,
        stack: 'secret-stack',
        environment: { TOKEN: 'secret-token' },
      });
      const json = JSON.stringify(diagnosticsJson([value]));
      const text = formatCompilerDiagnostic(value);
      expect(json).not.toContain(file.replace(/\\/g, '\\\\'));
      expect(text).not.toContain(file);
      expect(json + text).not.toContain('/home/private');
      expect(json + text).not.toMatch(/secret-stack|secret-token|TOKEN/);
      expect(text).toContain('<source>:1:1: PUI1004 [unsupported-input]');
    }
    const relative = diagnostic(0, 1, '.\\src\\example.proto.ts');
    expect(formatCompilerDiagnostic(relative, { sources: { 'src/example.proto.ts': 'x' } })).toBe(
      'src/example.proto.ts:1:1-1:2: PUI1004 [unsupported-input] This operation is not supported.\n 1 | x\n   | ^'
    );
  });

  it('escapes authored terminal controls and adds only optional formatter color', () => {
    const value = diagnostic(1, 2);
    value.message = 'Unsupported \u001b[2Joperation';
    const options = { sources: { 'src/example.proto.ts': '\u001bx' } };
    const plain = formatCompilerDiagnostic(value, options);
    const color = formatCompilerDiagnostic(value, { ...options, color: true });
    expect(plain).not.toContain('\u001b');
    expect(plain.split('\n').slice(1)).toEqual([' 1 | \\u001bx', '   |       ^']);
    expect(color.replace(/\u001b\[\d+m/g, '')).toBe(plain);
  });

  it('preserves real compiler rejection codes, categories, locations and multiple errors in both formats', () => {
    const source = `import { definePrototype } from '@proto.ui/core';
export default definePrototype({name:'bad',async setup(def){}});`;
    const unsupported = parsePrototype(source, { fileName: 'bad.proto.ts' });
    const invalid = parsePrototype(source, { fileName: '../bad.proto.ts' });
    if (unsupported.ok || invalid.ok) throw new Error('Expected actual frontend rejections');
    expect(unsupported.diagnostics[0]).toMatchObject({
      code: 'PUI1004',
      category: 'unsupported-input',
    });
    expect(invalid.diagnostics[0]).toMatchObject({ code: 'PUI1003', category: 'invalid-input' });
    const diagnostics = [...unsupported.diagnostics, ...invalid.diagnostics];
    const text = formatCompilerDiagnostics(diagnostics, { sources: { 'bad.proto.ts': source } });
    expect(text).toContain('PUI1004 [unsupported-input]');
    expect(text).toContain('PUI1003 [invalid-input]');
    expect(text).toContain('bad.proto.ts:2:');
    expect(text).not.toContain('compiler-defect');
    const json = diagnosticsJson(diagnostics);
    expect(JSON.stringify(json)).toBe(JSON.stringify(diagnosticsJson(diagnostics)));
    expect(json.diagnostics.map(({ code, category }) => [code, category])).toEqual([
      ['PUI1004', 'unsupported-input'],
      ['PUI1003', 'invalid-input'],
    ]);
  });
});
