import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { CompilerRejection, reject, unknownDiagnosticSpan } from './diagnostics';
import type { SourceSpan } from './ir';

export interface SourceEdge {
  specifier: string;
  node: ts.ImportDeclaration | ts.ExportDeclaration;
  typeOnly: boolean;
}

/** A source identity, never an absolute host path or a path outside the source root. */
export function sourceName(file: string): string {
  const span = unknownDiagnosticSpan();
  if (
    typeof file !== 'string' ||
    !file ||
    file.includes('\0') ||
    /^[A-Za-z]:/.test(file) ||
    file.startsWith('/') ||
    file.startsWith('\\\\')
  ) {
    reject(
      'PUI1003',
      'Source graph identities must be relative paths, not absolute paths.',
      span,
      'invalid-input'
    );
  }
  const normalized = path.posix.normalize(file.replace(/\\/g, '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    reject(
      'PUI1003',
      'Source identity must remain inside the explicit relative source graph.',
      span,
      'invalid-input'
    );
  }
  return normalized;
}

/** Origin tracing must not decide whether a requested filesystem path is admitted. */
export function diagnosticInputOrigin(file: string): SourceSpan {
  try {
    return unknownDiagnosticSpan(sourceName(file));
  } catch (error) {
    if (error instanceof CompilerRejection) return unknownDiagnosticSpan();
    throw error;
  }
}

export function isLocalSourceSpecifier(specifier: string): boolean {
  const normalized = specifier.replace(/\\/g, '/');
  return (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('./') ||
    normalized.startsWith('../')
  );
}

/** Candidate order is shared by the explicit source graph and the filesystem loader. */
export function localSourceCandidates(base: string): string[] {
  return [base, `${base}.ts`, `${base}.proto.ts`, path.posix.join(base, 'index.ts')];
}

/** Resolve a local specifier to a normalized source-root-relative candidate base. */
export function localSourceBase(importer: string, specifier: string): string {
  if (!isLocalSourceSpecifier(specifier))
    throw new TypeError(`Not a local source specifier: ${specifier}`);
  const base = path.posix.join(
    path.posix.dirname(sourceName(importer)),
    specifier.replace(/\\/g, '/')
  );
  return base === '.' ? base : sourceName(base);
}

/** Retain type-only edges without loading them as part of the runtime closure. */
export function sourceEdges(file: ts.SourceFile): SourceEdge[] {
  const edges: SourceEdge[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    let typeOnly = false;
    let hasTypeBindings = false;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      typeOnly = !!clause?.isTypeOnly;
      hasTypeBindings = !!(
        clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.some((element) => element.isTypeOnly)
      );
      if (
        clause &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length > 0 &&
        clause.namedBindings.elements.every((element) => element.isTypeOnly)
      )
        typeOnly = true;
    } else {
      typeOnly = statement.isTypeOnly;
      hasTypeBindings = !!(
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some((element) => element.isTypeOnly)
      );
      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length > 0 &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)
      )
        typeOnly = true;
    }
    edges.push({ specifier: statement.moduleSpecifier.text, node: statement, typeOnly });
    if (hasTypeBindings && !typeOnly)
      edges.push({ specifier: statement.moduleSpecifier.text, node: statement, typeOnly: true });
  }
  return edges;
}

export function runtimeSourceEdges(file: ts.SourceFile): SourceEdge[] {
  return sourceEdges(file).filter((edge) => !edge.typeOnly);
}

/** Missing optional type edges may be deferred; traversal and I/O errors may not. */
export class MissingLocalSourceError extends Error {}

/**
 * Find a regular source file beneath a declared root without evaluating it.
 * The importer and returned identity are source-root-relative. Both lexical
 * traversal and symlink traversal outside the root are rejected.
 */
export async function resolveLocalSource(
  root: string,
  importer: string,
  specifier: string
): Promise<string> {
  const rootPath = await realpath(root);
  const base = localSourceBase(importer, specifier);
  for (const candidate of localSourceCandidates(base)) {
    let absolute: string;
    try {
      absolute = await realpath(path.resolve(rootPath, candidate));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      )
        continue;
      throw error;
    }
    const relative = path.relative(rootPath, absolute).split(path.sep).join('/');
    if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative))
      throw new Error(`Local source ${specifier} escapes the declared project root.`);
    if (!(await stat(absolute)).isFile()) continue;
    return sourceName(relative);
  }
  throw new MissingLocalSourceError(
    `Missing local source ${specifier} in ${sourceName(importer)}.`
  );
}
