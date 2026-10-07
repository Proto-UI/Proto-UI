import path from 'node:path';
import type { CompilerDiagnostic, SourceSpan } from './ir';

export interface DiagnosticFormatOptions {
  /** Original source text keyed by its relative source-graph identity. No filesystem reads. */
  sources?: Readonly<Record<string, string>>;
  color?: boolean;
}

export interface CompilerDiagnosticsJson {
  diagnostics: CompilerDiagnostic[];
}

const TAB_WIDTH = 4;
const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const controls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

function escapeControls(text: string): string {
  return text.replace(controls, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Unsafe file identities are redacted, never resolved against cwd or the environment. */
function displayFile(file: string): string {
  if (/^<[A-Za-z][\w-]*>$/.test(file)) return file;
  if (
    !file ||
    /^[A-Za-z][A-Za-z\d+.-]*:/.test(file) ||
    /^[\\/~]/.test(file) ||
    /[\u0000-\u001f\u007f-\u009f?#\u2028\u2029\u202a-\u202e\u2066-\u2069]/.test(file)
  ) return '<source>';
  const normalized = path.posix.normalize(file.replace(/\\/g, '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.endsWith('/'))
    return '<source>';
  return normalized;
}

function displayMessage(message: string, originalFile: string): string {
  // Error messages can contain workstation paths even when their span is relative.
  const withoutFile = displayFile(originalFile) === '<source>' && originalFile
    ? message.split(originalFile).join('<source>')
    : message;
  return escapeControls(withoutFile).replace(
    /(^|[\s'"`(=:[{])(?:file:\/\/\/|[A-Za-z]:[\\/]|\/(?=\S)|\\\\)[^\s'"`<>{}\[\],;)]*/g,
    '$1<absolute-path>'
  );
}

function publicDiagnostic(diagnostic: CompilerDiagnostic): CompilerDiagnostic {
  const { code, category, message, span } = diagnostic;
  // Deliberate allowlist: do not serialize Error stacks, causes, environment or arbitrary fields.
  return {
    code: escapeControls(code),
    category,
    message: displayMessage(message, span.file),
    span: {
      file: displayFile(span.file),
      start: span.start,
      end: span.end,
      line: span.line,
      column: span.column,
      endLine: span.endLine,
      endColumn: span.endColumn,
    },
  };
}

/** Deterministic JSON-ready diagnostics, preserving order, categories and UTF-16 spans. */
export function diagnosticsJson(diagnostics: readonly CompilerDiagnostic[]): CompilerDiagnosticsJson {
  return { diagnostics: diagnostics.map(publicDiagnostic) };
}

interface SourceLine {
  start: number;
  end: number;
  text: string;
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const endings = /\r\n|[\r\n\u2028\u2029]/g;
  let start = 0;
  for (let match = endings.exec(source); match; match = endings.exec(source)) {
    lines.push({ start, end: match.index, text: source.slice(start, match.index) });
    start = match.index + match[0].length;
  }
  lines.push({ start, end: source.length, text: source.slice(start) });
  return lines;
}

function lineAt(lines: readonly SourceLine[], offset: number): number {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lines[middle].start <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

function isWide(code: number): boolean {
  return code >= 0x1100 && (
    code <= 0x115f || code === 0x2329 || code === 0x232a ||
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
    (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) || (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

function graphemeWidth(text: string): number {
  if (/\p{Emoji_Presentation}/u.test(text) || /\uFE0F|\u20E3/u.test(text)) return 2;
  let width = 0;
  for (const character of text) {
    if (/[\p{Mark}\p{Format}]/u.test(character)) continue;
    width = Math.max(width, isWide(character.codePointAt(0)!) ? 2 : 1);
  }
  return width;
}

interface DisplayLine {
  text: string;
  startColumn: number;
  endColumn: number;
}

/** Expand tabs and map UTF-16 boundaries onto terminal cells, including whole graphemes. */
function displayLine(text: string, start: number, end: number): DisplayLine {
  let output = '';
  let column = 0;
  let startColumn = 0;
  let endColumn = 0;
  for (const part of graphemes.segment(text)) {
    const from = part.index;
    const to = from + part.segment.length;
    const escaped = escapeControls(part.segment);
    const rendered = part.segment === '\t' ? ' '.repeat(TAB_WIDTH - column % TAB_WIDTH) : escaped;
    const width = part.segment === '\t' || escaped !== part.segment ? rendered.length : graphemeWidth(part.segment);
    if (start >= to) startColumn = column + width;
    else if (start >= from) startColumn = column;
    if (end >= to) endColumn = column + width;
    else if (end > from) endColumn = column + width;
    output += rendered;
    column += width;
  }
  return { text: output, startColumn, endColumn };
}

function sourceFor(file: string, sources: DiagnosticFormatOptions['sources']): string | undefined {
  if (!sources || displayFile(file) === '<source>') return undefined;
  if (Object.prototype.hasOwnProperty.call(sources, file)) return sources[file];
  const normalized = displayFile(file);
  if (Object.prototype.hasOwnProperty.call(sources, normalized)) return sources[normalized];
  // Sources may use './' or Windows separators without changing their graph identity.
  for (const key of Object.keys(sources)) {
    if (displayFile(key) === normalized) return sources[key];
  }
  return undefined;
}

function position(span: SourceSpan): string {
  const start = `${span.file}:${span.line}:${span.column}`;
  return span.line === span.endLine && span.column === span.endColumn
    ? start
    : `${start}-${span.endLine}:${span.endColumn}`;
}

/**
 * Format original-source diagnostics. Header columns remain one-based UTF-16 (TypeScript
 * and source-map convention); excerpt carets use visible cells and four-column tab stops.
 * Spans are end-exclusive. No generated-source mapping is guessed or input executed.
 */
export function formatCompilerDiagnostic(
  diagnostic: CompilerDiagnostic,
  options: DiagnosticFormatOptions = {}
): string {
  const visible = publicDiagnostic(diagnostic);
  const source = sourceFor(diagnostic.span.file, options.sources);
  const validOffsets = source !== undefined &&
    Number.isInteger(diagnostic.span.start) && Number.isInteger(diagnostic.span.end) &&
    diagnostic.span.start >= 0 && diagnostic.span.end >= diagnostic.span.start && diagnostic.span.end <= source.length;
  const lines = validOffsets ? sourceLines(source!) : undefined;
  let first = 0;
  let last = 0;
  if (lines) {
    first = lineAt(lines, diagnostic.span.start);
    last = lineAt(lines, diagnostic.span.end);
    // Source offsets, not stale line/column metadata, are authoritative when text is supplied.
    visible.span.line = first + 1;
    visible.span.column = Math.min(diagnostic.span.start, lines[first].end) - lines[first].start + 1;
    visible.span.endLine = last + 1;
    visible.span.endColumn = Math.min(diagnostic.span.end, lines[last].end) - lines[last].start + 1;
    if (last > first && diagnostic.span.end === lines[last].start) last--;
  }
  const paint = (text: string, code: number) => options.color ? `\u001b[${code}m${text}\u001b[0m` : text;
  const header = `${position(visible.span)}: ${paint(visible.code, 31)} [${visible.category}] ${visible.message.replace(/\n/g, '\n  ')}`;
  if (!lines) return `${header}\n  (${source === undefined ? 'source unavailable' : 'source span unavailable'})`;
  const output = [header];
  const gutterWidth = String(last + 1).length;
  for (let index = first; index <= last; index++) {
    const line = lines[index];
    const start = Math.max(0, Math.min(diagnostic.span.start - line.start, line.text.length));
    const end = Math.max(start, Math.min(diagnostic.span.end - line.start, line.text.length));
    const rendered = displayLine(line.text, start, end);
    const gutter = String(index + 1).padStart(gutterWidth, ' ');
    const marker = ' '.repeat(rendered.startColumn) + '^' + '~'.repeat(Math.max(1, rendered.endColumn - rendered.startColumn) - 1);
    output.push(` ${gutter} | ${rendered.text}`, ` ${' '.repeat(gutterWidth)} | ${paint(marker, 31)}`);
  }
  return output.join('\n');
}

/** Every diagnostic is retained in compiler order; callers choose the final newline. */
export function formatCompilerDiagnostics(
  diagnostics: readonly CompilerDiagnostic[],
  options: DiagnosticFormatOptions = {}
): string {
  return diagnostics.map((diagnostic) => formatCompilerDiagnostic(diagnostic, options)).join('\n\n');
}
