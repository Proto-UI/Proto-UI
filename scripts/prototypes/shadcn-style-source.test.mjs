import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceStoragePath, STYLES, extractStyle, splitUtilities, normalizeFixture, normalizeRuleFixture, verifySources } from './shadcn-style-source.mjs';

const directory = fileURLToPath(new URL('../../internal/fixtures/shadcn-style-source/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
test('retains the complete pinned upstream MIT license notice', () => {
  assert.equal(readFileSync(`${directory}/NOTICE.shadcn-MIT.txt`, 'utf8'), readFileSync(`${directory}/upstream/LICENSE.md`, 'utf8'));
});
test('all pinned styles retain ordered nested rules and source line attribution', () => {
  const styles = verifySources(`${directory}/upstream`, manifest);
  assert.deepEqual(styles.map(s => s.style), STYLES);
  assert.ok(styles.every(s => s.rules.length > 400));
  assert.ok(styles.every(s => s.rules.every(r => r.line > 1 && r.selectors[0] === `.style-${s.style}`)));
});
test('normalizes only explicitly supported inspection fixtures; unknown rejects', () => {
  assert.equal(normalizeFixture(['bg-primary'])[0].inspectionKey, 'background');
  for (const token of ['bg-unknown', '__proto__', 'constructor', 'hover:bg-primary/90']) assert.throws(() => normalizeFixture([token]), /unmapped utility/);
});
test('normalization rejects unknown or dynamic selectors rather than passing source selectors through', () => {
  for (const selector of ['.cn-other', '&:hover', '.cn-button-variant-default:hover', '[data-dynamic]']) assert.throws(() => normalizeRuleFixture('nova', {selectors:['.style-nova',selector],apply:[['bg-primary']]}), /unmapped or dynamic selector/);
  assert.throws(() => normalizeRuleFixture('new-york-v4', {selectors:['.style-new-york-v4','.cn-button-variant-default'],apply:[['bg-primary']]}), /unmapped or dynamic selector/);
});
test('unknown CSS syntax and malformed structure reject', () => {
  for (const source of ['.style-nova { .cn-x { color:red; } }', '.style-nova { @media x { .cn-x {} } }', '.style-nova { .cn-x { @apply x; }', '.style-nova {} trailing', '.style-nova { /* nope', '.style-nova { .cn-x { @apply x[); } }']) assert.throws(() => extractStyle(source, 'nova'), /SHADCN_SOURCE_UNSUPPORTED/);
  assert.throws(() => extractStyle('.style-unknown {}', 'unknown'), /unknown style/);
});
test('nested blocks, quoted delimiters, duplicate tokens, and omitted final semicolon remain ordered', () => {
  const rules = extractStyle(`.style-nova { .cn-x { @apply x x; &:hover { @apply [content:';}'] } @apply y; } }`, 'nova');
  assert.deepEqual(rules[0].apply, [['x','x'],['y']]);
  assert.deepEqual(rules[1].apply, [["[content:';}']"]]);
  assert.deepEqual(rules[0].applyLocations.map(x => x.sequence), [0, 2]);
  assert.deepEqual(rules[1].applyLocations.map(x => x.sequence), [1]);
  assert.ok(rules[0].applyLocations[0].offset < rules[1].applyLocations[0].offset);
  assert.ok(rules[1].applyLocations[0].offset < rules[0].applyLocations[1].offset);
});
test('utility text preserves quoted whitespace and nested arbitrary values', () => {
  assert.deepEqual(splitUtilities("x [content:'a b'] bg-[color-mix(in_oklch,var(--x),red)]"), ['x', "[content:'a b']", 'bg-[color-mix(in_oklch,var(--x),red)]']);
  for (const text of ['', 'x[', "x'", 'x)', 'x y' + '\\']) assert.throws(() => splitUtilities(text), /SHADCN_SOURCE_UNSUPPORTED/);
  assert.deepEqual(splitUtilities('x foo\\ bar'), ['x', 'foo\\ bar']);
});
test('requires New York retention and exact style/base/source membership', () => {
  for (const mutate of [m => m.legacy.preserve = false, m => m.styles.pop(), m => m.bases.push('other'), m => m.sources.pop(), m => m.revision = 'main', m => m.componentInventory.pop(), m => m.componentInventory[0].status = 'projected']) {
    const m = structuredClone(manifest); mutate(m);
    assert.throws(() => verifySources(`${directory}/upstream`, m), /SHADCN_SOURCE_UNSUPPORTED/);
  }
});
test('fails on changed source bytes rather than reusing stale normalized output', () => {
  const temp = mkdtempSync(join(tmpdir(), 'shadcn-source-test-'));
  try {
    cpSync(`${directory}/upstream`, temp, { recursive: true });
    writeFileSync(join(temp, manifest.sources[0].path), 'changed');
    assert.throws(() => verifySources(temp, manifest), /source hash drift/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('upstream TypeScript is inert text, with explicit unchanged source identities', () => {
  const root = `${directory}/upstream`;
  assert.ok(readdirSync(root, { recursive: true }).every(path => !/\.tsx?$/.test(path)));
  for (const source of manifest.sources) assert.equal(source.storagePath, sourceStoragePath(source.path));
  const changed = structuredClone(manifest);
  changed.sources[1].storagePath = changed.sources[1].path;
  assert.throws(() => verifySources(root, changed), /source storage path mismatch/);
});
