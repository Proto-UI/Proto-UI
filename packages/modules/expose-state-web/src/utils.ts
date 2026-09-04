/**
 * Semantics the Web projection names directly instead of normalizing. Exported
 * so a static analyzer can reproduce the same attribute without depending on
 * this module at runtime; `packages/cli/test/prototype-style-tokens.test.ts`
 * asserts the two stay identical.
 */
export const OFFICIAL_EXPOSED_STATE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  '@interaction/disabled': 'disabled',
  '@interaction/hovered': 'hovered',
  '@interaction/pressed': 'pressed',
  '@interaction/focused': 'focused',
  '@focus/focused': 'focused',
  '@interaction/focusVisible': 'focus-visible',
  '@focus/focusVisible': 'focus-visible',
  '@accessibility/expanded': 'expanded',
  '@accessibility/invalid': 'invalid',
  '@accessibility/selected': 'selected',
  '@accessibility/checked': 'checked',
  '@accessibility/current': 'current',
});

function mapOfficialSemanticName(semantic: string): string | null {
  // The table inherits `Object.prototype`, so a semantic spelled `constructor`
  // or `toString` would otherwise resolve to the inherited function.
  return Object.hasOwn(OFFICIAL_EXPOSED_STATE_NAMES, semantic)
    ? OFFICIAL_EXPOSED_STATE_NAMES[semantic]
    : null;
}

export function createExposeStateWebNameMap(semantic: string) {
  const official = mapOfficialSemanticName(semantic);
  if (official) {
    return {
      dataAttr: `data-${official}`,
      cssVar: `--pui-${official}`,
    };
  }

  const base = semantic
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return {
    dataAttr: `data-${base}`,
    cssVar: `--pui-${base}`,
  };
}

export function createExposeStateWebNativeVariantPolicy({ semantic }: { semantic?: string }) {
  switch (semantic) {
    case '@interaction/hovered':
    case '@interaction/pressed':
    case '@accessibility/expanded':
    case '@accessibility/invalid':
    case '@accessibility/selected':
    case '@accessibility/checked':
    case '@accessibility/current':
      return true;
    case '@interaction/disabled':
    case '@interaction/focused':
    case '@interaction/focusVisible':
    case '@focus/focused':
    case '@focus/focusVisible':
      return false;
    default:
      return true;
  }
}
