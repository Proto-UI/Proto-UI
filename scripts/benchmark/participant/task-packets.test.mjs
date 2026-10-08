import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  CROSSWALK_CATEGORIES,
  discoveryProperties,
  taskPackets,
  validateCrosswalk,
} from './task-packets.mjs';
import { participantRequest } from './no-tools.mjs';
const sha = (t) => createHash('sha256').update(t).digest('hex');
for (const task of ['discovery', 'implementation'])
  test(`${task}: approved packet boundary and identical task across conditions`, async () => {
    const p = await taskPackets(task);
    const blind = p.conditions.blind;
    const assisted = p.conditions['knowledge-assisted'];
    assert.equal(p.admission, 'not-admitted');
    assert.equal(blind.prompt, assisted.prompt);
    assert.equal(blind.materials.length, task === 'discovery' ? 1 : 0);
    assert.deepEqual(assisted.materials.slice(0, blind.materials.length), blind.materials);
    assert.equal(assisted.materials.length, blind.materials.length + 4);
    const wire = participantRequest({ packet: blind, model: 'synthetic', maxOutputTokens: 100 });
    assert.ok(
      !/P-BASE|proto-ui|criteria:|tabs-oracle|tabs-controls|spec\/|\.test\./i.test(
        JSON.stringify(wire)
      )
    );
    for (const material of assisted.materials.slice(blind.materials.length)) {
      assert.match(material.text, /draft, not a stable guarantee/);
      assert.equal(material.sha256, sha(material.text));
    }
  });
test('discovery output validates proposals, not equivalence/approval', () => {
  const property = {
    id: 'p1',
    claim: 'One selected view',
    basis: 'observed',
    testProposal: 'Inspect selection after click',
    limitations: 'No controlled-state coverage',
  };
  assert.equal(
    discoveryProperties(JSON.stringify({ properties: [property] })).properties.length,
    1
  );
  assert.throws(
    () => discoveryProperties(JSON.stringify({ properties: [property, property] })),
    /Duplicate/
  );
  assert.throws(() =>
    discoveryProperties(JSON.stringify({ properties: [{ ...property, basis: 'certain' }] }))
  );
  assert.throws(() => discoveryProperties('```json\n{}\n```'));
  assert.throws(() => discoveryProperties(JSON.stringify({ properties: [property], score: 1 })));
});
const documents = [
  { id: 'a', origin: 'participant', text: 'Only the chosen section is presented.' },
  { id: 'p', origin: 'proto', text: 'Exactly one active panel in a single-selection group.' },
].map((doc) => ({ ...doc, sha256: sha(doc.text) }));
const citations = documents.map((d) => ({
  document: d.id,
  start: 0,
  end: d.text.length,
  quote: d.text,
}));
const row = {
  id: 'r1',
  category: 'equivalent-different-expression',
  rationale:
    'Synthetic manually labelled comparison; semantic equivalence is not inferred by the validator.',
  adjudicator: 'synthetic test author',
  citations,
};
test('crosswalk permits six explicit categories with exact evidence, no automatic judging', () => {
  for (const category of CROSSWALK_CATEGORIES) {
    const result = validateCrosswalk({
      documents,
      rows: [
        {
          ...row,
          category,
          protoSearchScope: 'Synthetic pinned prototype namespace, no product conclusion',
        },
      ],
    });
    assert.equal(result.admission, 'not-admitted');
    assert.equal(result.semanticEquivalence, 'not-automated');
  }
});
test('crosswalk rejects broken citations, absent rationales and unsupported category claims', () => {
  assert.throws(() => validateCrosswalk({ documents, rows: [{ ...row, category: 'auto-match' }] }));
  assert.throws(
    () => validateCrosswalk({ documents, rows: [{ ...row, citations: [citations[0]] }] }),
    /Both-side/
  );
  assert.throws(
    () =>
      validateCrosswalk({
        documents,
        rows: [{ ...row, citations: [{ ...citations[0], quote: 'different' }] }],
      }),
    /mismatch/
  );
  assert.throws(
    () =>
      validateCrosswalk({
        documents: documents.map((d) => ({ ...d, sha256: '0'.repeat(64) })),
        rows: [row],
      }),
    /digest/
  );
  assert.throws(
    () => validateCrosswalk({ documents, rows: [{ ...row, rationale: 'same word' }] }),
    /rationale/
  );
  assert.throws(
    () => validateCrosswalk({ documents, rows: [{ ...row, category: 'genuinely-missing-proto' }] }),
    /search scope/
  );
  assert.throws(() => validateCrosswalk({ documents, rows: [row, row] }));
});
