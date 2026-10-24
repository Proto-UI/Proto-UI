import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export const STYLES = ['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];
export const BASES = ['base', 'aria', 'radix'];
export const REVISION = '3d98900e9b73c45f035f8109e9d41ba6a51685e7';
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const fail = (message) => { throw new Error(`SHADCN_SOURCE_UNSUPPORTED: ${message}`); };

export function splitUtilities(text) {
  const tokens = [];
  let start = 0, quote = null, escaped = false;
  const brackets = [];
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === undefined && (escaped || quote || brackets.length)) fail('unterminated utility');
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '[' || c === '(') brackets.push(c);
    if (c === ']' || c === ')') {
      if (brackets.pop() !== (c === ']' ? '[' : '(')) fail('unbalanced utility');
    }
    if (!brackets.length && (c === undefined || /\s/.test(c))) {
      if (i > start) tokens.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || brackets.length || escaped || !tokens.length) fail('malformed utility list');
  return tokens;
}

// A deliberately bounded text parser, NOT a CSS compiler or Tailwind evaluator.
// Preserve nesting, order and utility spelling. Reject syntax outside this source format.
export function extractStyle(source, style) {
  if (!STYLES.includes(style)) fail(`unknown style ${style}`);
  let i = 0;
  let applySequence = 0;
  const rules = [];
  const skip = () => {
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      if (source.startsWith('/*', i)) {
        const end = source.indexOf('*/', i + 2);
        if (end < 0) fail('unterminated comment');
        i = end + 2; continue;
      }
      break;
    }
  };
  const read = () => {
    const start = i;
    let quote = null, escaped = false;
    const brackets = [];
    while (i < source.length) {
      const c = source[i];
      if (escaped) { escaped = false; i++; continue; }
      if (c === '\\') { escaped = true; i++; continue; }
      if (quote) { if (c === quote) quote = null; i++; continue; }
      if (c === '"' || c === "'") { quote = c; i++; continue; }
      if (c === '[' || c === '(') brackets.push(c);
      if (c === ']' || c === ')') {
        if (brackets.pop() !== (c === ']' ? '[' : '(')) fail('unbalanced token');
      }
      if (!brackets.length && '{};'.includes(c)) return { text: source.slice(start, i).trim(), delimiter: source[i++] };
      i++;
    }
    fail('unterminated statement');
  };
  const block = (parents, currentRule = null) => {
    while (true) {
      skip();
      if (i >= source.length) fail('unclosed block');
      if (source[i] === '}') { i++; return; }
      const offset = i, statement = read();
      if (statement.delimiter === '{') {
        if (!statement.text || statement.text.startsWith('@')) fail(`unsupported selector ${statement.text}`);
        const selectors = [...parents, statement.text];
        const rule = { selectors, line: source.slice(0, offset).split('\n').length, offset, apply: [], applyLocations: [] };
        rules.push(rule);
        block(selectors, rule);
      } else if ([';', '}'].includes(statement.delimiter) && statement.text.startsWith('@apply ')) {
        if (!currentRule) fail('apply outside current rule');
        currentRule.apply.push(splitUtilities(statement.text.slice(7).trim()));
        currentRule.applyLocations.push({ sequence: applySequence++, offset, line: source.slice(0, offset).split('\n').length });
        if (statement.delimiter === '}') return;
      } else fail(`unsupported statement ${statement.text}`);
    }
  };
  skip();
  const root = read();
  if (root.text !== `.style-${style}` || root.delimiter !== '{') fail('unexpected style root');
  block([root.text]); skip();
  if (i !== source.length) fail('trailing content');
  return rules;
}

// Inspection fixtures only. This does not implement Proto appearance or promise
// support for other utilities. Unknown mappings fail closed, never pass through.
const FIXTURE_UTILITIES = Object.freeze({
  'bg-primary': ['background', 'primary'],
  'text-primary-foreground': ['foreground', 'primary-foreground'],
  'hover:bg-primary/80': ['hover.background', 'primary/80'],
});
export function normalizeFixture(tokens) {
  return tokens.map((token) => {
    if (!Object.hasOwn(FIXTURE_UTILITIES, token)) fail(`unmapped utility ${token}`);
    const [inspectionKey, sourceValue] = FIXTURE_UTILITIES[token];
    return { inspectionKey, sourceValue, sourceToken: token };
  });
}

export function normalizeRuleFixture(style, rule) {
  if (!['nova', 'rhea'].includes(style) || !rule || JSON.stringify(rule.selectors) !== JSON.stringify([`.style-${style}`, '.cn-button-variant-default'])) fail('unmapped or dynamic selector');
  if (rule.apply.length !== 1) fail('unsupported fixture apply shape');
  return normalizeFixture(rule.apply[0]);
}

export function sourceStoragePath(path) {
  return /\.tsx?$/.test(path) ? `${path}.txt` : path;
}

export function verifySources(root, manifest) {
  if (manifest.revision !== REVISION) fail('revision mismatch');
  if (manifest.sourceTree !== '81a576ce4689c4a9f47314d29db1e104aabe2129') fail('source tree mismatch');
  if (JSON.stringify(manifest.styles) !== JSON.stringify(STYLES)) fail('style inventory drift');
  if (JSON.stringify(manifest.bases) !== JSON.stringify(BASES)) fail('base inventory drift');
  if (manifest.legacy?.id !== 'new-york-v4' || manifest.legacy?.preserve !== true) fail('New York must be retained');
  if (!Array.isArray(manifest.componentInventory) || manifest.componentInventory.some(entry => entry.status !== 'not-projected')) fail('inspection must not claim projection parity');
  // Bound to the complete non-truncated Git tree at REVISION, not a sampled list.
  if (digest(JSON.stringify(manifest.componentInventory)) !== 'a8030371d365b12e4ddef0eeee172d59ec0766b9e97731ff2b2d8b466b023179') fail('component source inventory drift');
  const expected = ['LICENSE.md', 'apps/v4/registry/styles.tsx', 'apps/v4/registry/bases.ts', 'apps/v4/registry/_legacy-styles.ts', ...STYLES.map(s => `apps/v4/registry/styles/style-${s}.css`)];
  if (manifest.sources.length !== expected.length || new Set(manifest.sources.map(s => s.path)).size !== expected.length || expected.some(p => !manifest.sources.some(s => s.path === p))) fail('source inventory mismatch');
  for (const entry of manifest.sources) {
    if (entry.storagePath !== sourceStoragePath(entry.path)) fail('source storage path mismatch');
    const path = resolve(root, entry.storagePath);
    if (relative(root, path).startsWith('..')) fail('path escape');
    const bytes = readFileSync(path);
    if (digest(bytes) !== entry.sha256 || gitBlob(bytes) !== entry.gitBlob) fail(`source hash drift: ${entry.path}`);
  }
  for (const [path, expectedNames] of [['styles.tsx', STYLES], ['bases.ts', BASES]]) {
    const text = readFileSync(resolve(root, 'apps/v4/registry', sourceStoragePath(path)), 'utf8');
    const names = [...text.matchAll(/^    name: "([a-z-]+)",$/gm)].map(m => m[1]);
    if (JSON.stringify(names) !== JSON.stringify(expectedNames)) fail(`catalog drift: ${path}`);
  }
  if (!readFileSync(resolve(root, 'apps/v4/registry/_legacy-styles.ts.txt'), 'utf8').includes('name: "new-york-v4"')) fail('legacy source missing New York');
  return STYLES.map(style => ({ style, rules: extractStyle(readFileSync(resolve(root, `apps/v4/registry/styles/style-${style}.css`), 'utf8'), style) }));
}
