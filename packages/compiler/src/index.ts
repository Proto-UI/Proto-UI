/** Availability of the replacement compiler. This module does not compile source. */
export const COMPILER_STATUS = Object.freeze({
  implementation: 'not-implemented',
  legacyImplementation: 'retired',
  frontend: Object.freeze({
    implementation: 'partial',
    analysisComplete: false,
    languageVersion: '0.4',
  }),
  targets: Object.freeze({
    react: 'not-implemented',
    gpui: 'not-implemented',
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
      'The legacy Proto UI compiler has been retired. The replacement Proto language compiler ' +
        'is not implemented for React, GPUI, Vue 2, Vue 3 or Web Components. No artifact was generated.'
    );
    this.name = 'CompilerUnavailableError';
  }
}

/** Consumers must check availability before offering compilation. */
export function requireCompilerImplementation(): never {
  throw new CompilerUnavailableError();
}
