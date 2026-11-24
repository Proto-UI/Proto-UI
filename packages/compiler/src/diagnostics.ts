export interface SourceSpan {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticCategory =
  | 'input'
  | 'typecheck'
  | 'frontend'
  | 'ir'
  | 'llvm'
  | 'codegen'
  | 'io';

export interface CompilerDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly category: DiagnosticCategory;
  readonly message: string;
  readonly span?: SourceSpan;
}

export type CompileResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly CompilerDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly CompilerDiagnostic[] };

export function ok<T>(value: T, diagnostics: readonly CompilerDiagnostic[] = []): CompileResult<T> {
  return { ok: true, value, diagnostics };
}

export function err<T = never>(diagnostics: readonly CompilerDiagnostic[]): CompileResult<T> {
  return { ok: false, diagnostics };
}

export function diagnostic(
  code: string,
  category: DiagnosticCategory,
  message: string,
  span?: SourceSpan,
  severity: DiagnosticSeverity = 'error'
): CompilerDiagnostic {
  return span ? { code, severity, category, message, span } : { code, severity, category, message };
}

export function formatDiagnostic(d: CompilerDiagnostic): string {
  const loc = d.span ? `${d.span.file}:${d.span.line}:${d.span.column} ` : '';
  return `${loc}${d.severity}[${d.code}/${d.category}]: ${d.message}`;
}

export function formatDiagnostics(list: readonly CompilerDiagnostic[]): string {
  return list.map(formatDiagnostic).join('\n');
}
