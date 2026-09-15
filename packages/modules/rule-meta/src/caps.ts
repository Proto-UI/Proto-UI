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
