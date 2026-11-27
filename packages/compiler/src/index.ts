/** Availability of the replacement compiler. This module does not compile source. */
export const COMPILER_STATUS = Object.freeze({
  implementation: 'partial',
  legacyImplementation: 'retired',
  frontend: Object.freeze({
    implementation: 'partial',
    analysisComplete: false,
    languageVersion: '0.4',
  }),
  targets: Object.freeze({
    react: 'partial',
    gpui: 'partial',
    vue2: 'not-implemented',
    vue3: 'not-implemented',
    'web-components': 'not-implemented',
  }),
} as const);

export type CompilerTarget = keyof typeof COMPILER_STATUS.targets;

export class CompilerUnavailableError extends Error {
  readonly code = 'PUI_COMPILER_NOT_IMPLEMENTED';

  constructor() {
    super(
      'This portable entry exposes compiler availability. Use the Node compiler with an explicit source entry and target.'
    );
    this.name = 'CompilerUnavailableError';
  }
}

/** Consumers must check availability before offering compilation. */
export function requireCompilerImplementation(): never {
  throw new CompilerUnavailableError();
}
