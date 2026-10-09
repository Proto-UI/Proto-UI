/** Explicit consumer-owned CSS input for the internal SSR experiment, not a theme default. */
export interface SsrStyleEnvironment {
  id: string;
  cssText: string;
}

type Token = { kind: 'word' | 'string' | 'symbol'; value: string; call?: boolean };
type Reference = { name: string; fallback?: Reference[] };
type Declaration = { name: string; value: Token[]; references: Reference[] };

/** A deliberately bounded lexer: canonical renderer/theme identifiers are ASCII and unescaped. */
function tokens(css: string): Token[] {
  const result: Token[] = [];
  for (let index = 0; index < css.length; ) {
    const char = css[index];
    if (/\s/.test(char)) {
      ++index;
      continue;
    }
    if (css.startsWith('/*', index)) {
      const end = css.indexOf('*/', index + 2);
      if (end < 0) throw new Error('unclosed CSS comment');
      index = end + 2;
      continue;
    }
    if (char === '\\') throw new Error('CSS escapes are outside the canonical stylesheet subset');
    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      ++index;
      while (index < css.length && css[index] !== quote) {
        if (css[index] === '\\' || /[\r\n\f]/.test(css[index]))
          throw new Error('escaped or multiline CSS strings are unsupported');
        value += css[index++];
      }
      if (css[index++] !== quote) throw new Error('unclosed CSS string');
      result.push({ kind: 'string', value });
      continue;
    }
    if (/[a-zA-Z0-9_-]/.test(char)) {
      let value = char;
      ++index;
      while (index < css.length && /[a-zA-Z0-9_-]/.test(css[index])) value += css[index++];
      result.push({ kind: 'word', value, call: css[index] === '(' });
      continue;
    }
    if (!'{}()[]:;,.#@%+*/=!<>|~^$'.includes(char)) throw new Error('unsupported CSS token');
    result.push({ kind: 'symbol', value: char });
    ++index;
  }
  return result;
}

function closing(input: Token[], start: number): number {
  let depth = 0;
  for (let index = start; index < input.length; ++index) {
    if (input[index].kind === 'string') continue;
    if (input[index].value === '(') ++depth;
    if (input[index].value === ')' && --depth === 0) return index;
  }
  throw new Error('unclosed CSS function');
}

function references(input: Token[]): Reference[] {
  const result: Reference[] = [];
  for (let index = 0; index < input.length; ++index) {
    if (
      input[index].kind !== 'word' ||
      !input[index].call ||
      input[index].value.toLowerCase() !== 'var' ||
      input[index + 1]?.value !== '('
    )
      continue;
    const end = closing(input, index + 1);
    let comma = -1,
      depth = 0;
    for (let cursor = index + 2; cursor < end; ++cursor) {
      if (input[cursor].kind === 'string') continue;
      if (input[cursor].value === '(') ++depth;
      else if (input[cursor].value === ')') --depth;
      else if (input[cursor].value === ',' && depth === 0) {
        comma = cursor;
        break;
      }
    }
    const name = input.slice(index + 2, comma < 0 ? end : comma);
    if (name.length !== 1 || name[0].kind !== 'word' || !/^--[a-zA-Z0-9_-]+$/.test(name[0].value))
      throw new Error('unsupported or invalid var() custom property name');
    result.push({
      name: name[0].value,
      ...(comma < 0 ? {} : { fallback: references(input.slice(comma + 1, end)) }),
    });
    index = end;
  }
  return result;
}

function declarations(input: Token[]): Declaration[] {
  const result: Declaration[] = [];
  let start = 0,
    depth = 0;
  for (let index = 0; index <= input.length; ++index) {
    const token = input[index];
    if (token?.kind === 'string') continue;
    if (token?.value === '(' || token?.value === '[') ++depth;
    if (token?.value === ')' || token?.value === ']') {
      if (--depth < 0) throw new Error('unbalanced CSS delimiter');
    }
    if (depth !== 0) continue;
    if (token?.value === '{') {
      start = index + 1;
      continue;
    }
    if (token && token.value !== ';' && token.value !== '}') continue;
    const chunk = input.slice(start, index);
    if (chunk[0]?.kind === 'word' && chunk[1]?.value === ':') {
      const value = chunk.slice(2);
      if (
        value.at(-2)?.value === '!' &&
        value.at(-1)?.kind === 'word' &&
        value.at(-1)!.value.toLowerCase() === 'important'
      )
        value.splice(-2);
      result.push({ name: chunk[0].value, value, references: references(value) });
    }
    start = index + 1;
  }
  if (depth !== 0) throw new Error('unbalanced CSS delimiter');
  return result;
}

/** Closed, variable-only canonical theme subset; this is intentionally not a general CSS sanitizer. */
export function ssrStyleEnvironmentError(css: string): string | null {
  if (/<\/style/i.test(css)) return 'HTML style terminators are unsupported';
  try {
    const input = tokens(css);
    const functions = new Set([
      'var',
      'calc',
      'min',
      'max',
      'clamp',
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'not',
    ]);
    let braces = 0;
    for (let index = 0; index < input.length; ++index) {
      const token = input[index];
      if (token.kind === 'string') continue;
      if (token.value === '{') ++braces;
      if (token.value === '}' && --braces < 0) return 'unbalanced CSS block';
      if (
        token.value === '@' &&
        (input[index + 1]?.kind !== 'word' ||
          !['layer', 'media'].includes(input[index + 1].value.toLowerCase()))
      )
        return 'unsupported CSS at-rule; only layer and media are admitted';
      if (
        token.kind === 'word' &&
        token.call &&
        input[index - 1]?.value !== '@' &&
        input[index + 1]?.value === '(' &&
        !functions.has(token.value.toLowerCase())
      )
        return 'unsupported CSS function: ' + token.value;
    }
    if (braces !== 0) return 'unbalanced CSS block';
    if (declarations(input).some((declaration) => !declaration.name.startsWith('--')))
      return 'consumer stylesheet environments may declare only custom properties';
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

type Resolution = { required: Set<string>; missing: Set<string>; cyclic: Set<string> };
const empty = (): Resolution => ({ required: new Set(), missing: new Set(), cyclic: new Set() });
function merge(target: Resolution, source: Resolution) {
  for (const key of ['required', 'missing', 'cyclic'] as const)
    for (const value of source[key]) target[key].add(value);
  return target;
}
const valid = (result: Resolution) => !result.missing.size && !result.cyclic.size;

/**
 * Bounded declaration dependency analysis, not a selector/cascade or property-value validator.
 * var() fallback/cycle semantics: https://www.w3.org/TR/css-variables-1/#cycles and #using-variables
 * Duplicate conditional declarations are conservatively checked; consumer overrides are not inferred.
 */
export function ssrStyleDependencies(componentCss: string, environmentCss = '') {
  try {
    const component = declarations(tokens(componentCss)),
      environment = declarations(tokens(environmentCss));
    const localNames = new Set(
      component.filter((item) => item.name.startsWith('--')).map((item) => item.name)
    );
    const definitions = new Map<string, Declaration[]>();
    for (const declaration of [...environment, ...component])
      if (declaration.name.startsWith('--')) {
        // Host-owned renderer declarations supersede inherited environment declarations.
        if (environment.includes(declaration) && localNames.has(declaration.name)) continue;
        const values = definitions.get(declaration.name) ?? [];
        values.push(declaration);
        definitions.set(declaration.name, values);
      }
    // These limits bound additional candidate analysis, not CSS parsing. Budget
    // is shared by all consumed SCCs and reserved before candidate enumeration.
    let candidateBudget = 256;
    let traversalBudget = 100_000;
    let graphWork = definitions.size;
    const countReferences = (refs: Reference[]) => {
      for (const reference of refs) {
        graphWork++;
        if (reference.fallback) countReferences(reference.fallback);
      }
    };
    for (const values of definitions.values())
      for (const value of values) {
        graphWork++;
        countReferences(value.references);
      }
    function resolver(definitions: Map<string, Declaration[]>) {
      const graph = new Map<string, Set<string>>();
      function allRefs(refs: Reference[], result = new Set<string>()) {
        for (const reference of refs) {
          result.add(reference.name);
          if (reference.fallback) allRefs(reference.fallback, result);
        }
        return result;
      }
      for (const [name, values] of definitions)
        graph.set(name, allRefs(values.flatMap((value) => value.references)));
      // CSS cycle edges include references inside fallbacks, even when a primary could resolve.
      const cyclicMembers = new Map<string, string[]>(),
        indices = new Map<string, number>(),
        low = new Map<string, number>();
      const stack: string[] = [],
        onStack = new Set<string>();
      let sequence = 0;
      function cycle(name: string) {
        indices.set(name, sequence);
        low.set(name, sequence++);
        stack.push(name);
        onStack.add(name);
        for (const dependency of graph.get(name) ?? [])
          if (definitions.has(dependency)) {
            if (!indices.has(dependency)) {
              cycle(dependency);
              low.set(name, Math.min(low.get(name)!, low.get(dependency)!));
            } else if (onStack.has(dependency))
              low.set(name, Math.min(low.get(name)!, indices.get(dependency)!));
          }
        if (low.get(name) !== indices.get(name)) return;
        const component: string[] = [];
        let entry: string;
        do {
          entry = stack.pop()!;
          onStack.delete(entry);
          component.push(entry);
        } while (entry !== name);
        if (component.length > 1 || graph.get(name)?.has(name))
          for (const member of component) cyclicMembers.set(member, component);
      }
      for (const name of definitions.keys()) if (!indices.has(name)) cycle(name);
      const cache = new Map<string, Resolution>();
      const candidateResolvers = new Map<string[], Array<(name: string) => Resolution>>();
      function resolveName(name: string): Resolution {
        const previous = cache.get(name);
        if (previous) return previous;
        const result = empty();
        if (!localNames.has(name)) result.required.add(name);
        const members = cyclicMembers.get(name);
        if (members?.some((member) => definitions.get(member)!.length > 1)) {
          // The union graph may combine declarations that never form one actual
          // cycle. Conservatively inspect every bounded local candidate choice;
          // this does not select or prove reachability of a selector/cascade branch.
          let candidates = candidateResolvers.get(members);
          if (!candidates) {
            let combinations = 1;
            for (const member of members) {
              const count = definitions.get(member)!.length;
              if (combinations > Math.floor(candidateBudget / count))
                throw new Error('Unsupported SSR custom-property cycle: candidate budget exceeded');
              combinations *= count;
            }
            const work = combinations * graphWork;
            if (work > traversalBudget)
              throw new Error('Unsupported SSR custom-property cycle: traversal budget exceeded');
            candidateBudget -= combinations;
            traversalBudget -= work;
            candidates = [];
            const chosen = new Map(definitions);
            const visit = (index: number) => {
              if (index === members.length) {
                candidates!.push(resolver(new Map(chosen)).resolveName);
                return;
              }
              const member = members[index];
              for (const value of definitions.get(member)!) {
                chosen.set(member, [value]);
                visit(index + 1);
              }
            };
            visit(0);
            candidateResolvers.set(members, candidates);
          }
          for (const candidate of candidates) merge(result, candidate(name));
        } else if (members) result.cyclic.add(name);
        else {
          const values = definitions.get(name);
          if (!values) result.missing.add(name);
          else
            for (const value of values) {
              const keyword =
                value.value.length === 1 && value.value[0].kind === 'word'
                  ? value.value[0].value.toLowerCase()
                  : null;
              if (keyword && ['inherit', 'unset', 'revert', 'revert-layer'].includes(keyword))
                throw new Error(
                  `Custom property ${name} uses context-dependent CSS-wide keyword ${keyword}`
                );
              if (keyword === 'initial') result.missing.add(name);
              else merge(result, resolveReferences(value.references));
            }
        }
        cache.set(name, result);
        return result;
      }
      function resolveReferences(refs: Reference[]): Resolution {
        const result = empty();
        for (const reference of refs) {
          const primary = resolveName(reference.name);
          merge(
            result,
            valid(primary) || reference.fallback === undefined
              ? primary
              : resolveReferences(reference.fallback)
          );
        }
        return result;
      }
      return { resolveName, resolveReferences };
    }
    // Resolve ordinary declarations; custom properties are traversed only when consumed.
    const result = resolver(definitions).resolveReferences(
      component.filter((value) => !value.name.startsWith('--')).flatMap((value) => value.references)
    );
    return {
      required: [...result.required].sort(),
      missing: [...result.missing].sort(),
      cyclic: [...result.cyclic].sort(),
      invalid: [] as string[],
    };
  } catch (error) {
    return {
      required: [],
      missing: [],
      cyclic: [],
      invalid: [error instanceof Error ? error.message : String(error)],
    };
  }
}
