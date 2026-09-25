import type { CompilerDiagnostic, SourceSpan } from './ir';

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
