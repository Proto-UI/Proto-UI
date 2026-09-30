import path from 'node:path';
import type { SourceSpan } from './ir';

export interface SourceMapV3 {
  version: 3;
  file: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export interface SourceMapSource {
  /** Relative identity in the author's source graph, not a workstation filename. */
  path: string;
  content?: string;
}

export interface SourceMapMapping {
  /** One-based UTF-16 positions in the final emitted text. */
  generatedLine: number;
  generatedColumn: number;
  /** Original author location, including after helper or hook expansion. */
  source: SourceSpan;
  name?: string;
}

export interface SourceMapInput {
  file: string;
  sources: readonly SourceMapSource[];
  mappings: readonly SourceMapMapping[];
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// Keep positions compatible with source-map consumers using signed 32-bit offsets.
const MAX_POSITION = 0x7fffffff;

function relativePath(value: string, label: string): string {
  if (
    typeof value !== 'string' ||
    !value ||
    /^[A-Za-z][A-Za-z\d+.-]*:/.test(value) ||
    /^[\\/]/.test(value) ||
    /[\u0000-\u001f\u007f?#]/.test(value)
  ) {
    throw new TypeError(`${label} must be a safe relative path.`);
  }
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.endsWith('/')
  ) {
    throw new TypeError(`${label} must identify a file inside the relative source graph.`);
  }
  return normalized;
}

function integer(value: number, minimum: number, label: string): void {
  if (!Number.isInteger(value) || value < minimum || value > MAX_POSITION) {
    throw new TypeError(`${label} must be an integer between ${minimum} and ${MAX_POSITION}.`);
  }
}

function checkSpan(span: SourceSpan, label: string): void {
  if (!span || typeof span !== 'object') throw new TypeError(`${label} requires a SourceSpan.`);
  integer(span.start, 0, `${label}.start`);
  integer(span.end, 0, `${label}.end`);
  integer(span.line, 1, `${label}.line`);
  integer(span.column, 1, `${label}.column`);
  integer(span.endLine, 1, `${label}.endLine`);
  integer(span.endColumn, 1, `${label}.endColumn`);
  if (
    span.end < span.start ||
    span.endLine < span.line ||
    (span.endLine === span.line && span.endColumn < span.column)
  ) {
    throw new TypeError(`${label} has a reversed source span.`);
  }
}

function vlq(value: number): string {
  // Arithmetic rather than bitwise shifts avoids signed 32-bit overflow.
  let encoded = value < 0 ? -value * 2 + 1 : value * 2;
  let result = '';
  do {
    let digit = encoded % 32;
    encoded = Math.floor(encoded / 32);
    if (encoded > 0) digit += 32;
    result += BASE64[digit];
  } while (encoded > 0);
  return result;
}

/**
 * Build a standard v3 map without reading files or executing author input.
 * Mappings must arrive in strictly increasing generated order; duplicates and
 * ambiguous rewrites are errors, not silently sorted or overwritten. Only the
 * generated-column delta resets per line. Original/source/name deltas persist
 * across generated lines, as required by the source-map format.
 */
export function buildSourceMap(input: SourceMapInput): SourceMapV3 {
  if (!input || typeof input !== 'object') throw new TypeError('Source map input is required.');
  const file = relativePath(input.file, 'Generated file');
  if (!Array.isArray(input.sources) || !Array.isArray(input.mappings)) {
    throw new TypeError('Source map sources and mappings must be arrays.');
  }

  const contents = new Map<string, string | undefined>();
  let hasContents = false;
  for (const source of input.sources) {
    if (!source || typeof source !== 'object') throw new TypeError('Invalid source map source.');
    const identity = relativePath(source.path, 'Source file');
    if (contents.has(identity)) throw new TypeError(`Duplicate source file: ${identity}.`);
    if (source.content !== undefined && typeof source.content !== 'string') {
      throw new TypeError(`Source content for ${identity} must be a string.`);
    }
    contents.set(identity, source.content);
    hasContents ||= source.content !== undefined;
  }
  const sources = [...contents.keys()].sort();
  const sourceIndices = new Map(sources.map((source, index) => [source, index]));
  const uniqueNames = new Set<string>();
  for (const [index, mapping] of input.mappings.entries()) {
    const label = `Mapping ${index}`;
    if (!mapping || typeof mapping !== 'object') throw new TypeError(`${label} is invalid.`);
    if (mapping.name !== undefined) {
      if (typeof mapping.name !== 'string') throw new TypeError(`${label}.name must be a string.`);
      uniqueNames.add(mapping.name);
    }
  }
  const names = [...uniqueNames].sort();
  const nameIndices = new Map(names.map((name, index) => [name, index]));

  const chunks: string[] = [];
  let line = 1;
  let column = 0;
  let sourceIndex = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let nameIndex = 0;
  let hasSegment = false;
  for (const [index, mapping] of input.mappings.entries()) {
    const label = `Mapping ${index}`;
    integer(mapping.generatedLine, 1, `${label}.generatedLine`);
    integer(mapping.generatedColumn, 1, `${label}.generatedColumn`);
    if (
      mapping.generatedLine < line ||
      (mapping.generatedLine === line && hasSegment && mapping.generatedColumn - 1 <= column)
    ) {
      throw new TypeError(`${label} is duplicate or out of generated order.`);
    }
    checkSpan(mapping.source, `${label}.source`);
    const identity = relativePath(mapping.source.file, `${label}.source.file`);
    const nextSource = sourceIndices.get(identity);
    if (nextSource === undefined) {
      throw new TypeError(`${label} refers to an undeclared source file: ${identity}.`);
    }
    if (mapping.generatedLine !== line) {
      chunks.push(';'.repeat(mapping.generatedLine - line));
      line = mapping.generatedLine;
      column = 0;
      hasSegment = false;
    }
    if (hasSegment) chunks.push(',');
    const nextColumn = mapping.generatedColumn - 1;
    const nextLine = mapping.source.line - 1;
    const nextOriginalColumn = mapping.source.column - 1;
    chunks.push(
      vlq(nextColumn - column),
      vlq(nextSource - sourceIndex),
      vlq(nextLine - originalLine),
      vlq(nextOriginalColumn - originalColumn)
    );
    column = nextColumn;
    sourceIndex = nextSource;
    originalLine = nextLine;
    originalColumn = nextOriginalColumn;
    if (mapping.name !== undefined) {
      const nextName = nameIndices.get(mapping.name)!;
      chunks.push(vlq(nextName - nameIndex));
      nameIndex = nextName;
    }
    hasSegment = true;
  }

  return {
    version: 3,
    file,
    sources,
    ...(hasContents ? { sourcesContent: sources.map((source) => contents.get(source) ?? null) } : {}),
    names,
    mappings: chunks.join(''),
  };
}
