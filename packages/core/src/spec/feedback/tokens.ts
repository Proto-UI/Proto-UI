// packages/core/src/spec/feedback/tokens.ts

// Arbitrary values may legitimately contain punctuation (calc, var, quoted
// content, colors). Only unescaped structure outside those values is a selector.
function selectionPayloadHasSelectorSyntax(token: string): boolean {
  let bracketDepth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (bracketDepth > 0) {
      if (quote) {
        if (character === quote) quote = undefined;
      } else if (character === "'" || character === '"') {
        quote = character;
      } else if (character === '[') {
        bracketDepth += 1;
      } else if (character === ']') {
        bracketDepth -= 1;
      }
      continue;
    }
    if (character === '[') {
      // Utility arbitrary values use `-[...]`; a bare attribute selector does not.
      if (index === 0 || token[index - 1] !== '-') return true;
      bracketDepth = 1;
      continue;
    }
    if (character === ']') return true;
    if (/[&>+~,*|#]/.test(character)) return true;
    if (
      character === '.' &&
      !(/[0-9]/.test(token[index - 1] ?? '') && /[0-9]/.test(token[index + 1] ?? ''))
    ) {
      return true;
    }
  }
  return bracketDepth !== 0 || quote !== undefined || escaped;
}

/**
 * Validate a Tailwind-flavored token for feedback v0.
 *
 * Forbidden:
 * - ':' (variants / pseudo / selector), except one allowlisted `selection:` prefix
 *
 * Allowed:
 * - arbitrary values in brackets: `w-[2px]`, `h-[var(--x)]`
 * - decimals / slash tokens / css functions / css variables
 *   as long as token stays a single whitespace-free token and does not
 *   introduce `:` variant syntax.
 */
export function assertTwTokenV0(token: string, ctx?: string): void {
  const where = ctx ? ` (${ctx})` : '';

  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(`[feedback] invalid tw token${where}: empty`);
  }

  // Token must be single token (no whitespace)
  if (/\s/.test(token)) {
    throw new Error(`[feedback] invalid tw token${where}: contains whitespace: "${token}"`);
  }

  // Keep host-selector / variant syntax out of prototype authoring.
  if (token.startsWith('.') || token.startsWith('#')) {
    throw new Error(
      `[feedback] invalid tw token${where}: selector-like token is forbidden in "${token}"`
    );
  }

  if (token.includes(':')) {
    const selectionPrefix = 'selection:';
    if (token.startsWith(selectionPrefix) && !token.slice(selectionPrefix.length).includes(':')) {
      if (/^select-(auto|text|none)$/.test(token.slice(selectionPrefix.length))) {
        throw new Error(
          `[feedback] invalid tw token${where}: content-selection affordances require the subject, not its selection highlight: "${token}"`
        );
      }
      if (selectionPayloadHasSelectorSyntax(token.slice(selectionPrefix.length))) {
        throw new Error(
          `[feedback] invalid tw token${where}: selector-like selection payload is forbidden in "${token}"`
        );
      }
      assertTwTokenV0(token.slice(selectionPrefix.length), ctx);
      return;
    }
    throw new Error(`[feedback] invalid tw token${where}: forbidden character ":" in "${token}"`);
  }

  // Allow bracket arbitrary values with the same "no variant syntax / no
  // whitespace" rule applied to the bracket payload.
  const left = token.indexOf('[');
  const right = token.lastIndexOf(']');

  if (left !== -1 || right !== -1) {
    if (!(left !== -1 && right !== -1 && right > left)) {
      throw new Error(`[feedback] invalid tw token${where}: malformed bracket in "${token}"`);
    }

    const inside = token.slice(left + 1, right);

    if (!inside.length) {
      throw new Error(`[feedback] invalid tw token${where}: empty bracket value in "${token}"`);
    }

    if (/[\s]/.test(inside)) {
      throw new Error(
        `[feedback] invalid tw token${where}: bracket value contains whitespace in "${token}"`
      );
    }

    if (inside.includes(':')) {
      throw new Error(
        `[feedback] invalid tw token${where}: bracket value contains ":" in "${token}"`
      );
    }
  }
}
