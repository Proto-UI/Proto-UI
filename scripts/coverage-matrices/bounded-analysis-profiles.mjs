// Bounded source analysis only. These profiles never execute authored code,
// parse a contextual fragment, load a stylesheet or admit production evidence.
export const UNVERIFIED_CSS_MODULE_SPECIFIER = '<unverified CSS Modules dependency>';

export function decodeCssEscapes(value) {
  return value.replace(
    /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\r\f ])?|([\s\S]))/giu,
    (_match, hex, character) => {
      if (!hex) return /[\n\r\f]/u.test(character) ? '' : character;
      const code = Number.parseInt(hex, 16);
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
        ? '\uFFFD'
        : String.fromCodePoint(code);
    }
  );
}

function cssTokens(content) {
  const tokens = [];
  let complete = true;
  const escape = /^\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\r\f ])?|[^\n\r\f])/iu;
  const identifier = /^(?:[-_a-z\d\u0080-\uffff]|\\(?:[\da-f]{1,6}(?:\r\n|[\t\n\r\f ])?|[^\n\r\f]))+/iu;
  for (let offset = 0; offset < content.length;) {
    if (/[\t\n\r\f ]/u.test(content[offset])) { offset += 1; continue; }
    if (content.startsWith('/*', offset)) {
      const end = content.indexOf('*/', offset + 2);
      if (end === -1) { complete = false; break; }
      offset = end + 2;
      continue;
    }
    const start = offset;
    const quote = content[offset];
    if (quote === '"' || quote === "'") {
      offset += 1;
      let closed = false;
      while (offset < content.length) {
        if (content[offset] === quote) { closed = true; break; }
        if (/[\n\r\f]/u.test(content[offset])) break;
        if (content[offset] === '\\') {
          const continuation = content.slice(offset).match(/^\\(?:\r\n|[\n\r\f])/u)?.[0];
          const escaped = continuation ?? content.slice(offset).match(escape)?.[0];
          if (!escaped) break;
          offset += escaped.length;
        } else offset += 1;
      }
      if (!closed) { complete = false; break; }
      const value = content.slice(start + 1, offset).replace(/\\(?:\r\n|[\n\r\f])/gu, '');
      tokens.push({ kind: 'string', value: decodeCssEscapes(value) });
      offset += 1;
      continue;
    }
    const name = content.slice(offset).match(identifier)?.[0];
    if (name) {
      tokens.push({ kind: 'identifier', value: decodeCssEscapes(name) });
      offset += name.length;
    } else {
      tokens.push({ kind: 'symbol', value: content[offset] });
      offset += 1;
    }
  }
  return { tokens, complete };
}

// A dependency is intentionally narrower than Vite's complete CSS Modules
// language: keeping .module.css on both ends retains resolver context in the
// existing source walk. A plain .css dependency can itself be interpreted as a
// module by postcss-modules; it must not silently lose that context here.
function admittedCssModuleTarget(value) {
  return typeof value === 'string' && value.endsWith('.module.css') &&
    value === value.trim() && !/[\u0000-\u0020\u007f\\?#]/u.test(value) &&
    !/^(?:[a-z][a-z\d+.-]*:|\/)/iu.test(value) &&
    (value.startsWith('./') || value.startsWith('../') || value.startsWith('@proto.ui/'));
}

export function cssModuleDependencyProfile(content, sourcePath) {
  const standalone = /\.module\.css$/u.test(sourcePath);
  const moduleContext = /\.module\.(?:css|s[ac]ss|less)$/iu.test(sourcePath);
  if (!moduleContext) return [];
  if (!standalone || /\u0000/u.test(content)) return [UNVERIFIED_CSS_MODULE_SPECIFIER];
  const { tokens, complete } = cssTokens(content);
  const specifiers = [];
  let unverified = !complete;
  const frames = [];
  let statementStart = 0;
  const symbol = (token, value) => token?.kind === 'symbol' && token.value === value;
  const dependency = (token) => {
    if (token?.kind !== 'string' || !admittedCssModuleTarget(token.value)) unverified = true;
    else specifiers.push(token.value);
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (symbol(token, '@') && tokens[index + 1]?.value.toLowerCase() === 'value')
      unverified = true;
    if (token.kind === 'identifier' && /^(?:composes|compose-with)$/iu.test(token.value) &&
        index === statementStart && !symbol(tokens[index + 1], ':')) unverified = true;
    if (symbol(token, '{')) {
      const header = tokens.slice(statementStart, index);
      const icss = header[0]?.value === ':' && header[1]?.value.toLowerCase() === 'import';
      if (icss) {
        if (frames.length || header.length !== 5 || header[1].value !== 'import' ||
            header[2]?.value !== '(' || header[4]?.value !== ')') unverified = true;
        else dependency(header[3]);
      }
      frames.push(header);
      statementStart = index + 1;
    } else if (symbol(token, '}')) {
      if (!frames.length) unverified = true;
      else frames.pop();
      statementStart = index + 1;
    } else if (symbol(token, ';')) statementStart = index + 1;
    else if (token.kind === 'identifier' && /^(?:composes|compose-with)$/iu.test(token.value) &&
             tokens[index + 1]?.value === ':' && index === statementStart) {
      const selector = frames.at(-1);
      if (token.value !== 'composes' || selector?.length !== 2 || selector[0].value !== '.' ||
          selector[1].kind !== 'identifier') unverified = true;
      let end = index + 2;
      while (end < tokens.length && !symbol(tokens[end], ';') && !symbol(tokens[end], '}')) end += 1;
      const values = tokens.slice(index + 2, end);
      const from = values.findIndex((entry) => entry.kind === 'identifier' && entry.value === 'from');
      const names = from === -1 ? values : values.slice(0, from);
      if (!names.length || names.some((entry) => entry.kind !== 'identifier')) unverified = true;
      if (from !== -1) {
        if (values.length !== from + 2) unverified = true;
        else if (values[from + 1].kind !== 'identifier' || values[from + 1].value !== 'global')
          dependency(values[from + 1]);
      }
    }
    // Malformed ICSS selectors must not disappear merely because no block
    // opener was reached. Strings and comments have already been tokenized.
    if (symbol(token, ':') && tokens[index + 1]?.value.toLowerCase() === 'import') {
      if (index !== statementStart || frames.length) unverified = true;
      let end = index + 2;
      while (end < tokens.length && !['{', ';', '}'].some((value) => symbol(tokens[end], value))) end += 1;
      if (!symbol(tokens[end], '{')) unverified = true;
    }
  }
  if (frames.length) unverified = true;
  return [...new Set([...specifiers, ...(unverified ? [UNVERIFIED_CSS_MODULE_SPECIFIER] : [])])];
}

// Use the checker's complete lexical binding inventory instead of introducing
// a second binder. The only projected values are native Range provenance and
// definite business values. Type annotations never establish native identity.
export function createRangeAnalysisProfile({
  ts, unwrap, memberAccess, bindingsAt, assignmentsFor, isReflectApply,
}) {
  const merge = (...sets) => new Set(sets.flatMap((values) => [...values]));
  const one = (value) => new Set([value]);
  const project = (values, name) => new Set([...values].map((value) => {
    if (value === 'global') {
      if (['window', 'self', 'globalThis'].includes(name)) return 'global';
      if (name === 'document') return 'document';
      if (name === 'Range') return 'constructor';
    }
    if (value === 'range' && name === 'createContextualFragment') return 'fragment-method';
    return 'unknown';
  }));
  const valueAt = (expression, at, seen = new Set()) => {
    if (!expression || seen.size >= 64) return one('unknown');
    const candidate = unwrap(expression);
    if (ts.isIdentifier(candidate)) {
      const bindings = bindingsAt(candidate.text, at);
      if (!bindings.length) {
        if (['window', 'self', 'globalThis'].includes(candidate.text)) return one('global');
        if (candidate.text === 'document') return one('document');
        if (candidate.text === 'Range') return one('constructor');
        return one('unknown');
      }
      let values = new Set();
      for (const binding of bindings) {
        if (seen.has(binding) || binding.position >= at.getStart()) {
          values.add('unknown');
          continue;
        }
        const visited = new Set(seen).add(binding);
        let initial = binding.initializer ? valueAt(binding.initializer, binding.node, visited) :
          one('unknown');
        for (const step of binding.steps) {
          initial = step.rest || step.key === null ? one('unknown') : project(initial, step.key);
          if (step.fallback) initial = merge(initial, valueAt(step.fallback, binding.node, visited));
        }
        values = merge(values, initial);
        for (const assignment of assignmentsFor(candidate.text)) {
          if (assignment.end <= at.getStart() && bindingsAt(candidate.text, assignment).includes(binding))
            values = merge(values, valueAt(assignment.right, assignment, visited));
        }
        if (binding.rewrite) values.add('unknown');
      }
      return values;
    }
    if (ts.isObjectLiteralExpression(candidate) || ts.isArrayLiteralExpression(candidate) ||
        ts.isFunctionExpression(candidate) || ts.isArrowFunction(candidate) ||
        ts.isClassExpression(candidate) || ts.isStringLiteralLike(candidate) ||
        ts.isNumericLiteral(candidate)) return one('business');
    const member = memberAccess(candidate);
    if (member) return project(valueAt(member.receiver, at, seen), member.name);
    if (ts.isNewExpression(candidate)) {
      const constructors = valueAt(candidate.expression, at, seen);
      return new Set([...constructors].map((value) =>
        value === 'constructor' ? 'range' : 'unknown'));
    }
    if (ts.isCallExpression(candidate)) {
      const called = memberAccess(unwrap(candidate.expression));
      if (called?.name === 'createRange') {
        const receivers = valueAt(called.receiver, at, seen);
        return new Set([...receivers].map((value) =>
          value === 'document' ? 'range' : 'unknown'));
      }
      if (called?.name === 'bind' && valueAt(called.receiver, at, seen).has('fragment-method'))
        return one('bound-fragment-method');
      return one('unknown');
    }
    if (ts.isConditionalExpression(candidate))
      return merge(valueAt(candidate.whenTrue, at, seen), valueAt(candidate.whenFalse, at, seen));
    return one('unknown');
  };
  return (node) => {
    if (!ts.isCallExpression(node)) return null;
    const callee = unwrap(node.expression);
    const member = memberAccess(callee);
    if (member?.name === 'createContextualFragment') {
      const values = valueAt(member.receiver, node);
      if ([...values].every((value) => value === 'business')) return null;
      return values.size === 1 && values.has('range') ? 'native-range' : 'unsupported-range';
    }
    if (member && ['call', 'apply'].includes(member.name) &&
        valueAt(member.receiver, node).has('fragment-method')) return 'unsupported-range';
    if (isReflectApply(node) && node.arguments[0] &&
        valueAt(node.arguments[0], node).has('fragment-method')) return 'unsupported-range';
    if (member) return null;
    if (ts.isElementAccessExpression(callee))
      return valueAt(callee.expression, node).has('range') ? 'unsupported-range' : null;
    const values = valueAt(callee, node);
    if (values.has('fragment-method') || values.has('bound-fragment-method')) return 'unsupported-range';
    return null;
  };
}
