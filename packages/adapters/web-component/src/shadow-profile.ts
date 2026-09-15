import { validateShadowStyleArtifact, type ShadowStyleArtifactV1 } from './shadow-style-artifact';
import type { ShadowColorSchemeSource } from './shadow-color-scheme-environment';

export type WebComponentShadowSplitOptions = Readonly<{
  mode: 'open';
  presentation: 'split';
  styleArtifact: ShadowStyleArtifactV1;
  colorSchemeSource?: ShadowColorSchemeSource;
}>;

/** Normalize before registration; never turn a malformed object into direct Shadow. */
export function normalizeShadowProfile(value: unknown): boolean | WebComponentShadowSplitOptions {
  if (value === undefined || value === false) return false;
  if (value === true) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      '[WC Adapter] invalid shadow profile. Expected boolean or an open split object.'
    );
  }
  const input = value as Record<string, unknown>;
  const fields = new Set(['mode', 'presentation', 'styleArtifact', 'colorSchemeSource']);
  if (
    Reflect.ownKeys(input).some((key) => typeof key !== 'string' || !fields.has(key)) ||
    input.mode !== 'open' ||
    input.presentation !== 'split'
  ) {
    throw new Error('[WC Adapter] invalid shadow split profile fields or discriminants.');
  }
  const styleArtifact = validateShadowStyleArtifact(input.styleArtifact);
  const source = input.colorSchemeSource as ShadowColorSchemeSource | undefined;
  if (
    source !== undefined &&
    (!source || typeof source.get !== 'function' || typeof source.subscribe !== 'function')
  ) {
    throw new Error('[WC Adapter] shadow colorSchemeSource requires get() and subscribe().');
  }
  return Object.freeze({
    mode: 'open',
    presentation: 'split',
    styleArtifact,
    colorSchemeSource: source,
  });
}
