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

  validateShadowSelectorAbi(cssText);

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
  const documentMarker = documentRule?.[1] ?? systemColorSchemeRule?.[1];
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
          !/^(?::where\()?:host\(\[data-pui-color-scheme=(['"])dark\1\]\)\)?(?=$|[>+~.#[:])/.test(
            normalized
          ))
      )
        return true;
    }
    return false;
  });
  if (hasUnscopedDarkToken) {
    throw invalidArtifact('dark');
  }
}

// CSS identifiers may encode otherwise ordinary characters with a one-to-six
// digit hexadecimal escape plus optional trailing whitespace. Decode only an
// already isolated @media prelude: decoding before structural scanning could
// incorrectly promote an escaped delimiter into CSS syntax.
function decodeShadowCssEscapes(value: string): string {
  let decoded = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character !== '\\') {
      decoded += character;
      continue;
    }

    const escaped = value[index + 1];
    if (escaped === undefined) break;
    if (escaped === '\n' || escaped === '\f') {
      index += 1;
      continue;
    }
    if (escaped === '\r') {
      index += value[index + 2] === '\n' ? 2 : 1;
      continue;
    }
    if (!/[0-9a-f]/i.test(escaped)) {
      decoded += escaped;
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < value.length && end <= index + 6 && /[0-9a-f]/i.test(value[end]!)) end += 1;
    const codePoint = Number.parseInt(value.slice(index + 1, end), 16);
    decoded +=
      codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? '\uFFFD'
        : String.fromCodePoint(codePoint);
    if (/\s/.test(value[end] ?? '')) {
      if (value[end] === '\r' && value[end + 1] === '\n') end += 1;
      index = end;
    } else {
      index = end - 1;
    }
  }
  return decoded;
}

// Split rule preludes and top-level selector-list branches without treating
// commas inside functional selectors or attribute values as branch boundaries.
// Full CSS parsing is unnecessary for this bounded ABI check, but the scanner
// must still respect strings, escapes and bracket/parenthesis nesting.
function splitShadowSelectorFragments(cssText: string): string[] {
  const fragments: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  let parentheses = 0;
  let brackets = 0;

  const push = (end: number) => {
    fragments.push(cssText.slice(start, end));
    start = end + 1;
  };

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index]!;
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parentheses += 1;
    else if (char === ')') parentheses = Math.max(0, parentheses - 1);
    else if (char === '[') brackets += 1;
    else if (char === ']') brackets = Math.max(0, brackets - 1);
    else if (char === '{' || char === '}' || (char === ',' && parentheses === 0 && brackets === 0))
      push(index);
  }
  fragments.push(cssText.slice(start));
  return fragments;
}

export function stripShadowCssComments(cssText: string): string {
  let result = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index]!;
    if (char === '\\') {
      result += char;
      if (index + 1 < cssText.length) result += cssText[++index];
      continue;
    }
    if (quote) {
      result += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }
    if (char !== '/' || cssText[index + 1] !== '*') {
      result += char;
      continue;
    }

    const commentEnd = cssText.indexOf('*/', index + 2);
    if (commentEnd === -1) {
      // Preserve the existing bounded behavior for malformed, unterminated
      // input; this helper only removes complete CSS comments.
      result += cssText.slice(index);
      break;
    }
    index = commentEnd + 1;
  }

  return result;
}

function invalidArtifact(reason: string): Error {
  return new Error(`invalid shadow-style:${reason}`);
}
