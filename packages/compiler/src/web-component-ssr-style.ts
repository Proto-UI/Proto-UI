/** Explicit consumer-owned CSS input for the internal SSR experiment, not a theme default. */
export interface SsrStyleEnvironment {
  id: string;
  cssText: string;
}

/**
 * Syntactic dependency closure for the canonical token renderer's CSS custom properties.
 * This does not infer cascade/selector support for arbitrary CSS; native evidence owns that.
 */
export function ssrStyleDependencies(componentCss: string, environmentCss = '') {
  const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = (css: string) => {
    const result = new Map<string, string[]>();
    for (const match of withoutComments(css).matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+)[;}]/g)) {
      const values = result.get(match[1]) ?? [];
      values.push(match[2]);
      result.set(match[1], values);
    }
    return result;
  };
  const references = (css: string) =>
    [...withoutComments(css).matchAll(/\bvar\(\s*(--[a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  const component = declarations(componentCss),
    environment = declarations(environmentCss);
  const required = new Set<string>(),
    missing = new Set<string>(),
    active = new Set<string>(),
    cyclic = new Set<string>();
  function visit(name: string): void {
    if (component.has(name)) return;
    if (active.has(name)) {
      cyclic.add(name);
      return;
    }
    if (required.has(name)) return;
    required.add(name);
    const values = environment.get(name);
    if (!values) {
      missing.add(name);
      return;
    }
    active.add(name);
    for (const value of values) for (const dependency of references(value)) visit(dependency);
    active.delete(name);
  }
  for (const name of references(componentCss)) visit(name);
  return {
    required: [...required].sort(),
    missing: [...missing].sort(),
    cyclic: [...cyclic].sort(),
  };
}
