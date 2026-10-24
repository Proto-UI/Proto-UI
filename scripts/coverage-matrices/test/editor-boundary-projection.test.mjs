import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const ledger = fs.readFileSync(
  new URL('internal/agent-harness/dogfood-coverage-matrix.md', root),
  'utf8'
);
const portfolio = JSON.parse(
  fs.readFileSync(
    new URL('internal/coverage-matrices/prototype-coverage-matrix.json', root),
    'utf8'
  )
);
const research = fs.readFileSync(
  new URL('internal/records/2026-09-05-text-document-surface-boundary.md', root),
  'utf8'
);
const ids = ['harness.future.editor-chrome', 'harness.future.editor-engine'];
const lines = ledger.split('\n');
const cells = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
const headers = cells(lines.find((line) => line.startsWith('| ID |')));
const rows = ids.map((id) =>
  Object.fromEntries(
    headers.map((header, index) => [
      header,
      cells(lines.find((line) => line.startsWith(`| ${id} |`)))[index],
    ])
  )
);

test('editor research projection remains distinct from semantic admission', () => {
  const row = rows[0];
  assert.equal(row.State, 'research');
  assert.match(row['Target owner'], /option[- ]C/i);
  for (const kind of ['Contract', 'Module', 'Host Capability', 'Test'])
    assert(row['Proto UI chain'].includes(kind));
  assert.match(
    row.Evidence,
    /2026-09-05-text-document-surface-boundary\.md#proposed-entity-and-evidence-graph/
  );
  const graph = research
    .split('## Proposed entity and evidence graph')[1]
    ?.split('### Bounded red-first plan')[0];
  assert(graph, 'the linked proposal graph exists in the authoritative research record');
  for (const id of [
    'C-TEXT-DOCUMENT-SURFACE-0001',
    'M-TEXT-DOCUMENT-SURFACE-0001',
    'HC-TEXT-DOCUMENT-SURFACE-0001',
    'T-TEXT-DOCUMENT-SURFACE-0001',
  ])
    assert(graph.includes(id), id);
  assert.match(research, /internal\/agent-harness\/dogfood-coverage-matrix\.md/);
  for (const fallback of ['Textarea', 'Code Block', 'static Diff'])
    assert(row['Escape or exemption'].includes(fallback));
});

test('editor chrome re-review covers every deferred research boundary', () => {
  for (const trigger of [
    'admission outcome',
    'selection position encoding',
    'syntax/diagnostics',
    'multi-document',
    'large-document',
    'non-Web',
  ])
    assert(rows[0]['Re-review or removal issue'].includes(trigger));
});

test('engine infrastructure exemption does not transfer App or generic UI ownership', () => {
  const row = rows[1];
  assert.equal(row.State, 'infrastructure-exempt');
  for (const area of [
    'model',
    'content edits',
    'undo',
    'selection',
    'rendering',
    'tokenization',
    'view-state',
  ])
    assert(row['Escape or exemption'].includes(area));
  assert.match(
    row['Escape or exemption'],
    /cannot own surrounding generic controls or App document\/revision truth/
  );
  for (const trigger of [
    'engine selection',
    'persistence/service binding',
    'raw-model leakage',
    'capability expansion',
  ])
    assert(row['Re-review or removal issue'].includes(trigger));
});

test('both editor consumer projections agree with every authoritative ledger field', () => {
  for (const row of rows) {
    const projected = portfolio.consumerRows.find((entry) => entry.ID === row.ID);
    assert(projected);
    for (const field of headers) assert.equal(projected[field], row[field], `${row.ID}.${field}`);
    const issues = [
      ...new Set(
        [
          ...Object.values(row)
            .join(' ')
            .matchAll(/#([1-9]\d*)\b/g),
        ].map((match) => Number(match[1]))
      ),
    ].sort((a, b) => a - b);
    assert.deepEqual(projected.issues, issues);
  }
});

test('editor proposals introduce no uncataloged entity references into the matrix', () => {
  for (const row of rows)
    assert.doesNotMatch(
      Object.values(row).join(' '),
      /\b(?:C|M|HC|T)-TEXT-DOCUMENT-SURFACE-0001\b/
    );
});
