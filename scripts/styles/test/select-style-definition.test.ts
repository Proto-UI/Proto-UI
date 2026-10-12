import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

for (const [file, id, english] of [
  [
    'P-SHADCN-SELECT-TRIGGER.yaml',
    'P-SHADCN-SELECT-TRIGGER-CHEVRON',
    'The renderer must preserve slot content and append a fixed 16px chevron-down SVG with strokeWidth 2, muted foreground, no shrinking and no pointer participation.',
  ],
  [
    'P-SHADCN-SELECT-VALUE.yaml',
    'P-SHADCN-SELECT-VALUE-DISPLAY-RENDER',
    'The Value part must project line-clamp-1, flex, items-center and gap-2; the renderer must output non-empty displayValue text and otherwise return an empty view; Base context and fallback continue to determine displayValue.',
  ],
] as const) {
  test(`${id} retains its full bilingual YAML text without accidental flow keys`, () => {
    const parsed = parse(
      readFileSync(new URL(`../../../spec/prototypes/${file}`, import.meta.url), 'utf8')
    );
    const criterion = parsed.criteria.find((entry: { id: string }) => entry.id === id);
    assert.ok(criterion);
    assert.deepEqual(Object.keys(criterion.text).sort(), ['en', 'zh-CN']);
    assert.equal(criterion.text.en, english);
    assert.equal(typeof criterion.text['zh-CN'], 'string');
    assert.ok(criterion.text['zh-CN'].length > 30);
  });
}
