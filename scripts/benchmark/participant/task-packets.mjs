import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { participantRequest } from './no-tools.mjs';

const digest = (text) => createHash('sha256').update(text).digest('hex');
const prompts = Object.freeze({
  discovery: `Analyze the supplied standalone profile-sections example as an ordinary consumer of a web UI. Identify expected interaction properties, potential defects or underspecified behavior, and concrete validation criteria and test proposals. Distinguish observed behavior from recommended behavior and uncertainty. Do not simply assert that the supplied code is correct. You cannot use tools or access other files. Return one JSON object with a "properties" array. Each item must contain a unique "id", "claim", "basis" ("observed", "recommended", or "uncertain"), "testProposal", and "limitations". Each field other than "id" and "basis" is a string. No Markdown fence or additional prose.`,
  implementation: `Create a standalone HTML document for a horizontal reference-sections tab interface using ordinary HTML, CSS and JavaScript. No framework, external resources or tools. Return only the complete HTML starting with <!doctype html>, no Markdown fence.
The tab list's accessible name is "Reference sections". Its tabs, in order, are "Overview", "Unavailable", "Details", and "History"; "Unavailable" cannot be activated. Initially Overview is selected. Use manual activation: arrow navigation changes focus, not selection; Enter or Space activates a focused available tab. Left/Right wrap among available tabs; Home/End reach the first/last available tab. Pointer activation and repeated activation must remain coherent with keyboard interaction. Expose the appropriate accessible tab/panel states and associations. Only selected content is visible; inactive content may be retained hidden or recreated. Add a "Remove reference fixture" button outside the tab interface which removes it, followed by an "After fixture" button that remains usable. Do not add other tab interfaces.`,
});
const specimen = new URL(
  '../../../benchmarks/interaction/tasks/tabs-discovery.html',
  import.meta.url
);
const knowledgeSources = [
  ['tabs-root-draft', '../../../spec/prototypes/P-BASE-TABS.yaml'],
  ['tabs-list-draft', '../../../spec/prototypes/P-BASE-TABS-LIST.yaml'],
  ['tabs-trigger-draft', '../../../spec/prototypes/P-BASE-TABS-TRIGGER.yaml'],
  ['tabs-content-draft', '../../../spec/prototypes/P-BASE-TABS-CONTENT.yaml'],
];
function material(name, text) {
  return { name, text, sha256: digest(text) };
}

/** Candidate preparation only: not a frozen manifest or model invocation.
 * Approved knowledge comes from an explicit allowlist of draft specifications,
 * never tests, implementation, control code or evaluator/check lists. All source
 * bytes/digests must be retained and reviewed before formal run admission.
 */
export async function taskPackets(task) {
  assert.ok(Object.hasOwn(prompts, task), 'Unknown task');
  const ordinary =
    task === 'discovery'
      ? [material('ordinary-profile-example', await readFile(specimen, 'utf8'))]
      : [];
  const knowledge = await Promise.all(
    knowledgeSources.map(async ([name, source]) => {
      const text = await readFile(new URL(source, import.meta.url), 'utf8');
      return material(
        name,
        `Reference lifecycle: draft, not a stable guarantee. Reference file: ${source.split('/').at(-1)}\n${text}`
      );
    })
  );
  const blind = { prompt: prompts[task], materials: ordinary };
  const assisted = { prompt: prompts[task], materials: [...ordinary, ...knowledge] };
  // Reuse the actual wire validator, rather than a separate weaker packet schema.
  for (const packet of [blind, assisted])
    participantRequest({ packet, model: 'not-invoked', maxOutputTokens: 1 });
  return {
    task: `public-development-tabs-${task}-v1-candidate`,
    admission: 'not-admitted',
    split: 'development',
    conditions: { blind, 'knowledge-assisted': assisted },
    limitations: [
      'One manually authored public specimen; not representative/held-out',
      'Knowledge-assisted discovery is calibration, not the primary #748 blind discovery outcome',
      'Information volume not matched; no controlled attribution to Proto-specific value',
      'No compiler, mature-library path, usable skill or clean-project implementation comparison',
      'Independent review, frozen source/task bytes and live model/budget remain required',
    ],
  };
}

export const CROSSWALK_CATEGORIES = Object.freeze([
  'both',
  'agent-only',
  'proto-only',
  'equivalent-different-expression',
  'genuinely-missing-proto',
  'ambiguous-disputed',
]);
export function discoveryProperties(text) {
  const result = JSON.parse(text);
  assert.deepEqual(Object.keys(result), ['properties']);
  assert.ok(Array.isArray(result.properties) && result.properties.length <= 200);
  const ids = new Set();
  for (const item of result.properties) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['basis', 'claim', 'id', 'limitations', 'testProposal'].sort()
    );
    assert.match(item.id, /^[a-zA-Z0-9-]{1,64}$/);
    assert.ok(!ids.has(item.id), 'Duplicate property ID');
    ids.add(item.id);
    assert.ok(['observed', 'recommended', 'uncertain'].includes(item.basis));
    for (const field of ['claim', 'testProposal', 'limitations'])
      assert.ok(
        typeof item[field] === 'string' && item[field].length > 0 && item[field].length <= 20000,
        `Invalid ${field}`
      );
  }
  return result;
}

/** Citation integrity only. NEVER chooses a semantic category or scores lexical
 * overlap. Rows must be manually authored; even validated rows remain unreviewed.
 * UTF-16 offsets bind exact quotations to stored UTF-8 source digests.
 */
export function validateCrosswalk({ documents, rows }) {
  const sources = new Map();
  for (const doc of documents) {
    assert.ok(typeof doc.id === 'string' && doc.id.length > 0 && !sources.has(doc.id));
    assert.ok(['participant', 'proto', 'platform', 'task'].includes(doc.origin));
    assert.equal(digest(doc.text), doc.sha256, 'Document digest mismatch');
    sources.set(doc.id, doc);
  }
  const ids = new Set();
  for (const row of rows) {
    assert.ok(typeof row.id === 'string' && row.id.length > 0 && !ids.has(row.id));
    ids.add(row.id);
    assert.ok(CROSSWALK_CATEGORIES.includes(row.category));
    assert.ok(
      typeof row.rationale === 'string' && row.rationale.trim().length >= 20,
      'Semantic rationale required'
    );
    assert.ok(
      typeof row.adjudicator === 'string' && row.adjudicator.trim().length > 0,
      'Authorship required, not independent approval'
    );
    assert.ok(Array.isArray(row.citations) && row.citations.length > 0, 'Exact citations required');
    const origins = new Set();
    for (const c of row.citations) {
      const doc = sources.get(c.document);
      assert.ok(doc, 'Unknown citation document');
      assert.ok(
        Number.isSafeInteger(c.start) &&
          Number.isSafeInteger(c.end) &&
          c.start >= 0 &&
          c.end > c.start &&
          c.end <= doc.text.length
      );
      assert.equal(c.quote, doc.text.slice(c.start, c.end), 'Citation bytes/offsets mismatch');
      origins.add(doc.origin);
    }
    if (['both', 'equivalent-different-expression'].includes(row.category))
      assert.ok(origins.has('participant') && origins.has('proto'), 'Both-side evidence required');
    if (['agent-only', 'genuinely-missing-proto'].includes(row.category))
      assert.ok(origins.has('participant'), 'Participant evidence required');
    if (row.category === 'genuinely-missing-proto')
      assert.ok(
        typeof row.protoSearchScope === 'string' && row.protoSearchScope.trim().length >= 20,
        'Pinned negative search scope required'
      );
    if (row.category === 'proto-only') assert.ok(origins.has('proto'), 'Proto evidence required');
  }
  return {
    status: 'citation-valid-unreviewed',
    admission: 'not-admitted',
    rows: rows.length,
    semanticEquivalence: 'not-automated',
  };
}
