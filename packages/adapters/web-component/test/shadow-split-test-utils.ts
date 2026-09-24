import { SHADOW_SPLIT_ROOT_STYLE_ATTR } from '../src/shadow-split-effects';

// Simulate a self-consistent older generated companion so version-specific
// recipe checks remain independently exercised after base integrity validation.
export function rewriteSplitBaseDeclarations(
  cssText: string,
  edit: (declarations: string) => string
): string {
  const selector = `:host([${SHADOW_SPLIT_ROOT_STYLE_ATTR}])`;
  const start = cssText.indexOf(`${selector} {`);
  const open = cssText.indexOf('{', start);
  const close = cssText.indexOf('}', open);
  if (start < 0 || open < 0 || close < 0) throw new Error('generated base recipe not found');
  const declarations = edit(
    cssText
      .slice(open + 1, close)
      .replace(/\s*--pui-split-compiled-receipt:\s*[a-z0-9]+;\s*$/, '\n')
  );
  const input = `${selector.replace(/\s/g, '')}{${declarations.replace(/\s/g, '')}}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  }
  const body = `${declarations.trimEnd()}\n  --pui-split-compiled-receipt: ${(hash >>> 0).toString(
    36
  )};\n`;
  return `${cssText.slice(0, open + 1)}${body}${cssText.slice(close)}`;
}
