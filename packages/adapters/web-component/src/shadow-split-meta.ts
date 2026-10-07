import type { ShadowColorSchemeEnvironmentOwner } from './shadow-color-scheme-environment';

export type ShadowSplitMetaGetter = (key: string) => unknown;

export type ShadowSplitMetaOptions = Readonly<{
  environment: Pick<ShadowColorSchemeEnvironmentOwner, 'colorScheme'>;
  baseGetMeta: ShadowSplitMetaGetter;
}>;

/**
 * Composes the private split-profile meta view without changing the existing
 * public getMeta replacement semantics.
 */
export function createShadowSplitMetaGetter({
  environment,
  baseGetMeta,
}: ShadowSplitMetaOptions): ShadowSplitMetaGetter {
  return (key) => (key === 'colorScheme' ? environment.colorScheme : baseGetMeta(key));
}
