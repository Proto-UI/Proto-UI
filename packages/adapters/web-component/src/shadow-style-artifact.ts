import type { ShadowOwnerShell } from './shadow-owner-shell';
import { createShadowStylesheetOwner, type ShadowStylesheetOwner } from './shadow-stylesheet-owner';

export const SHADOW_STYLE_ARTIFACT_KIND = 'proto-ui.shadow-style' as const;
export const SHADOW_STYLE_ARTIFACT_VERSION = 1 as const;
export const SHADOW_STYLE_ARTIFACT_ENVIRONMENT = 'host-color-scheme-v1' as const;

const ARTIFACT_FIELDS = new Set(['kind', 'version', 'cssText', 'environment']);
export type ShadowStyleArtifactV1 = Readonly<{
  kind: typeof SHADOW_STYLE_ARTIFACT_KIND;
  version: typeof SHADOW_STYLE_ARTIFACT_VERSION;
  cssText: string;
  environment: typeof SHADOW_STYLE_ARTIFACT_ENVIRONMENT;
}>;

export type ShadowStyleArtifactOwner = {
  readonly artifact: ShadowStyleArtifactV1;
  readonly stylesheet: ShadowStylesheetOwner;
  update(artifact: unknown): void;
  dispose(): void;
};

const artifactOwners = new WeakMap<ShadowRoot, ShadowStyleArtifactOwner>();

// Selector validation depends only on the exact immutable CSS string and the
// fixed v1 ABI. Repeated owners may share that result, never the input artifact
// or its accessor values. Bound both the entry count and retained UTF-16 units;
// an oversized stylesheet is still validated without retaining it here.
const VALIDATED_SELECTOR_LIMIT = 32;
const VALIDATED_SELECTOR_CODE_UNITS = 1_048_576;
const validatedSelectors = new Set<string>();
let validatedSelectorCodeUnits = 0;

/**
 * Validates the semantic artifact before any physical stylesheet mutation and
 * returns an immutable Adapter-owned copy.
 */
export function validateShadowStyleArtifact(artifact: unknown): ShadowStyleArtifactV1 {
  if (!artifact || typeof artifact !== 'object') {
    throw invalidArtifact('object');
  }

  const keys = Reflect.ownKeys(artifact);
  if (
    keys.length !== ARTIFACT_FIELDS.size ||
    keys.some((key) => typeof key !== 'string' || !ARTIFACT_FIELDS.has(key))
  ) {
    throw invalidArtifact('fields');
  }

  const candidate = artifact as Record<string, unknown>;
  const { kind, version, cssText, environment } = candidate;
  if (kind !== SHADOW_STYLE_ARTIFACT_KIND) {
    throw invalidArtifact('kind');
  }
  if (version !== SHADOW_STYLE_ARTIFACT_VERSION) {
    throw invalidArtifact('version');
  }
  if (typeof cssText !== 'string') {
    throw invalidArtifact('cssText');
  }
  if (environment !== SHADOW_STYLE_ARTIFACT_ENVIRONMENT) {
    throw invalidArtifact('environment');
  }

  validateSharedShadowSelectorAbi(cssText);

  return Object.freeze({
    kind: SHADOW_STYLE_ARTIFACT_KIND,
    version: SHADOW_STYLE_ARTIFACT_VERSION,
    cssText,
    environment: SHADOW_STYLE_ARTIFACT_ENVIRONMENT,
  });
}

/** Installs one validated artifact through the existing owner stylesheet. */
export function createShadowStyleArtifactOwner(
  shell: ShadowOwnerShell,
  artifact: unknown
): ShadowStyleArtifactOwner {
  const validated = validateShadowStyleArtifact(artifact);
  const current = artifactOwners.get(shell.root);
  if (current) {
    current.update(validated);
    return current;
  }

  const stylesheet = createShadowStylesheetOwner(shell, validated.cssText);
  let currentArtifact = validated;
  let disposed = false;

  const owner: ShadowStyleArtifactOwner = {
    get artifact() {
      return currentArtifact;
    },
    stylesheet,
    update(nextArtifact) {
      if (disposed) {
        throw new Error('shadow-style:disposed');
      }
      const next = validateShadowStyleArtifact(nextArtifact);
      stylesheet.update(next.cssText);
      currentArtifact = next;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stylesheet.dispose();
      if (artifactOwners.get(shell.root) === owner) artifactOwners.delete(shell.root);
    },
  };

  artifactOwners.set(shell.root, owner);
  return owner;
}

function validateSharedShadowSelectorAbi(cssText: string): void {
  if (validatedSelectors.has(cssText)) {
    validatedSelectors.delete(cssText);
    validatedSelectors.add(cssText);
    return;
  }

  validateShadowSelectorAbi(cssText);
  if (cssText.length > VALIDATED_SELECTOR_CODE_UNITS) return;

  while (
    validatedSelectors.size >= VALIDATED_SELECTOR_LIMIT ||
    validatedSelectorCodeUnits + cssText.length > VALIDATED_SELECTOR_CODE_UNITS
  ) {
    const oldest = validatedSelectors.values().next().value!;
    validatedSelectors.delete(oldest);
    validatedSelectorCodeUnits -= oldest.length;
  }
  validatedSelectors.add(cssText);
  validatedSelectorCodeUnits += cssText.length;
}

function validateShadowSelectorAbi(cssText: string): void {
  const selectors = stripShadowCssComments(cssText);
  const structuralCss = selectors.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '$1$1');
  const documentRule = structuralCss.match(
    /(?:^|[;{}])(?:(?!\s*@)[^;{}]*(:where\(\.dark\)|:where\(\[data-theme=|:root))[^;{}]*\{/
  );
  // The host marker is the artifact's only color-scheme selector context.
  // Match the media feature structurally across optional whitespace, casing,
  // values, negation and compound queries so an explicit host-dark rule can
  // never be gated a second time by the system preference.
  const systemColorSchemeRule = [...structuralCss.matchAll(/(?:^|[;{}])\s*(@[^;{}]*)\{/g)].find(
    (match) => {
      const decodedPrelude = decodeShadowCssEscapes(match[1]!);
      return (
        /^@media(?:\s|\()/i.test(decodedPrelude) && /\bprefers-color-scheme\b/i.test(decodedPrelude)
      );
    }
  );
  const hostContextMarker = findShadowDocumentThemeHostContext(structuralCss);
  const documentMarker = documentRule?.[1] ?? systemColorSchemeRule?.[1] ?? hostContextMarker;
  if (documentMarker) {
    throw invalidArtifact(documentMarker);
  }

  const hasUnscopedDarkToken = splitShadowSelectorFragments(selectors).some((selector) => {
    const normalized = selector.replace(/\s/g, '');
    if (/\[[^\]]*\\/.test(normalized)) return true;
    for (const token of normalized.matchAll(/\[data-pui-style~=(['"])([^'"]*)\1([is])?\]/gi)) {
      if (
        token[3] ||
        (/(?:^|:)dark:/i.test(token[2]!) &&
          (!/^(?::where\()?:host\(\[data-pui-color-scheme=(['"])dark\1\]\)\)?(?=$|[>+~.#[:])/.test(
            normalized
          ) ||
            hasShadowHostThemeGate(selector)))
      )
        return true;
    }
    return false;
  });
  if (hasUnscopedDarkToken) {
    throw invalidArtifact('dark');
  }
}

// Inspect only the leading host compound, including functional suffixes. A
// top-level combinator ends that scope; same-named Shadow-local descendants do
// not impose a second theme gate on the host. Keep quoted text and escaped
// delimiters out of the scan, and preserve whitespace consumed by CSS escapes.
function hasShadowHostThemeGate(selector: string): boolean {
  const structuralSelector = selector.trimStart().replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '$1$1');
  const tokens = structuralSelector.matchAll(
    /\\(?:[0-9a-f]{1,6}\s?|.)|([.[])\s*((?:[-\w\u0080-\uFFFF]|\\(?:[0-9a-f]{1,6}\s?|.))+)|([()[\]])|([\s>+~]+)/gi
  );
  let depth = 0;
  for (const match of tokens) {
    if (match[4] && depth === 0) break;
    if (match[1] === '[' || match[3] === '[' || match[3] === '(') depth += 1;
    else if (match[3] === ']' || match[3] === ')') depth = Math.max(0, depth - 1);
    if (!match[1]) continue;
    const name = decodeShadowCssEscapes(match[2]!);
    if (
      match[1] === '.' ? name === 'dark' || name === 'light' : name.toLowerCase() === 'data-theme'
    )
      return true;
  }
  return false;
}

function findShadowDocumentThemeHostContext(cssText: string): string | undefined {
  for (const match of cssText.matchAll(/:((?:[-\w]|\\(?:[0-9a-f]{1,6}\s?|.))+)\(([^)]*)\)/gi)) {
    if (decodeShadowCssEscapes(match[1]!).toLowerCase() !== 'host-context') continue;
    const argument = decodeShadowCssEscapes(match[2]!);
    if (
      /(?:^|[^\w-])\.dark(?![\w-])/i.test(argument) ||
      /\[\s*data-theme(?:\s|[*^$|~]?=|\])/i.test(argument) ||
      /:root(?![\w-])/i.test(argument)
    )
      return match[0];
  }
  return undefined;
}

// CSS identifiers may encode otherwise ordinary characters with a one-to-six
// digit hexadecimal escape plus optional trailing whitespace. Decode only an
// already isolated prelude or identifier: decoding before structural scanning could
// incorrectly promote an escaped delimiter into CSS syntax.
function decodeShadowCssEscapes(value: string): string {
  return value.replace(
    /\\(?:([0-9a-f]{1,6})(?:\r\n|\s)?|\r\n|[\n\f\r]|([\s\S])|$)/gi,
    (_escape, hex: string | undefined, literal: string | undefined) => {
      if (hex === undefined) return literal ?? '';
      const codePoint = Number.parseInt(hex, 16);
      return codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? '\uFFFD'
        : String.fromCodePoint(codePoint);
    }
  );
}

// Split rule preludes and top-level selector-list branches without treating
// commas inside functional selectors or attribute values as branch boundaries.
// Full CSS parsing is unnecessary for this bounded ABI check, but the scanner
// must still respect strings, escapes and bracket/parenthesis nesting.
function splitShadowSelectorFragments(cssText: string): string[] {
  const fragments: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  for (const token of cssText.matchAll(
    /\\[\s\S]?|"(?:\\[\s\S]?|[^"\\])*"?|'(?:\\[\s\S]?|[^'\\])*'?|[()[\]{},]/g
  )) {
    const character = token[0];
    if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets = Math.max(0, brackets - 1);
    else if (
      character === '{' ||
      character === '}' ||
      (character === ',' && !parentheses && !brackets)
    ) {
      fragments.push(cssText.slice(start, token.index));
      start = token.index! + 1;
    }
  }
  fragments.push(cssText.slice(start));
  return fragments;
}

// Literal fragments stay byte-for-byte intact. Consume an unterminated comment
// as one preserved fragment, so malformed input is neither removed nor rescanned.
export function stripShadowCssComments(cssText: string): string {
  return cssText.replace(
    /\\[\s\S]?|"(?:\\[\s\S]?|[^"\\])*"?|'(?:\\[\s\S]?|[^'\\])*'?|\/\*[\s\S]*?(\*\/|$)/g,
    (fragment, closing: string | undefined) => (closing === '*/' ? '' : fragment)
  );
}

function invalidArtifact(reason: string): Error {
  return new Error(`invalid shadow-style:${reason}`);
}
