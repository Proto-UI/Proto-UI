import type { CompilerDiagnostic, SourceSpan } from './ir';

/** Diagnostic-only sentinel; it is never a valid authored/IR source span. */
export function unknownDiagnosticSpan(file = '<unknown>'): SourceSpan {
  return { file, start: -1, end: -1, line: 0, column: 0, endLine: 0, endColumn: 0 };
}

export function isUnknownDiagnosticSpan(span: SourceSpan): boolean {
  return (
    span.start === -1 &&
    span.end === -1 &&
    span.line === 0 &&
    span.column === 0 &&
    span.endLine === 0 &&
    span.endColumn === 0
  );
}

/** Preserve the original exception evidence without assuming every failure is an Error. */
export function unexpectedFailureEvidence(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? `${error.name}: ${error.message}`)
    : String(error);
}

/** A checked compiler rejection, as distinct from an unexpected implementation exception. */
export class CompilerRejection extends Error {
  constructor(readonly diagnostic: CompilerDiagnostic) {
    super(diagnostic.message);
    this.name = 'CompilerRejection';
  }
}

export function reject(
  code: string,
  message: string,
  span: SourceSpan,
  category: CompilerDiagnostic['category'] = 'unsupported-input'
): never {
  throw new CompilerRejection({ code, category, message, span });
}
