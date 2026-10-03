import { cap } from '@proto.ui/core';

export type RuleMetaGetter = (key: string) => unknown;

export const RULE_META_GET_CAP = cap<RuleMetaGetter>('@proto.ui/rule-meta/get');

export type ColorSchemeInvalidationSource = {
  readonly getter: RuleMetaGetter;
  /** Invalidations are asynchronous to subscription; the consumer samples after attaching. */
  subscribe(invalidate: () => void): () => void;
};

export const RULE_META_COLOR_SCHEME_SOURCE_CAP = cap<ColorSchemeInvalidationSource>(
  '@proto.ui/rule-meta/color-scheme-source'
);

/** Separate draft vocabulary; legacy Meta keys (including reducedMotion) stay sampled. */
export const PREFERENCE_VALUES = {
  'preference.reducedMotion': ['no-preference', 'reduce'],
  'preference.reducedTransparency': ['no-preference', 'reduce'],
  'preference.contrast': ['no-preference', 'less', 'more', 'custom'],
  'preference.forcedColors': ['none', 'active'],
} as const;
export type PreferenceKey = keyof typeof PREFERENCE_VALUES;
export type PreferenceValue = (typeof PREFERENCE_VALUES)[PreferenceKey][number] | 'unknown';
export function isPreferenceKey(key: string): key is PreferenceKey {
  return Object.prototype.hasOwnProperty.call(PREFERENCE_VALUES, key);
}
export function normalizePreferenceValue(key: PreferenceKey, value: unknown): PreferenceValue {
  return (PREFERENCE_VALUES[key] as readonly unknown[]).includes(value)
    ? (value as PreferenceValue)
    : 'unknown';
}
export type PreferenceInvalidationSource = {
  readonly getter: RuleMetaGetter;
  /** Fixed authored keys only; no synchronous notification or delivered preference cache. */
  subscribe(keys: readonly PreferenceKey[], invalidate: () => void): () => void;
};
export const RULE_META_PREFERENCE_SOURCE_CAP = cap<PreferenceInvalidationSource>(
  '@proto.ui/rule-meta/preference-source'
);
