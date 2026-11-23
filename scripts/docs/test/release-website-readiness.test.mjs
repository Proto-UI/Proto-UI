import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyRoute,
  cliDisposition,
  indexCodeMaps,
  inspectCodeMap,
  inspectUsageSource,
  readinessProblems,
} from '../release-website-readiness.mjs';
import { inspectReleaseDocument } from '../release-website-inventory.mjs';

const hosts = ['wc', 'react', 'vue', 'vue2'];
const source = (attributes = '') =>
  `<PrototypePreviewer demoId="demo-real" runtimes={['wc', 'react', 'vue', 'vue2']} ${attributes} />`;
const row = (mdx) => ({
  id: 'base:real:en',
  library: 'base',
  family: 'real',
  exports: ['./real'],
  document: inspectReleaseDocument(mdx, hosts),
});

test('enabling Code or naming hasCode cannot manufacture a matching source', () => {
  for (const props of ['', 'codePanel={true}', 'hasCode={true}']) {
    const mdx = source(props);
    const actual = classifyRoute(row(mdx), new Map(), inspectUsageSource(mdx));
    assert.equal(actual.category, 'enabled-without-source');
    assert.equal(actual.missingPreviewSourceHostCells, 4);
    assert.equal(actual.acceptance, 'not-established');
  }
  const mdx = source('codePanel={false}');
  const map = new Map([['demo-real', { file: 'realCode.ts', hosts }]]);
  const actual = classifyRoute(row(mdx), map, inspectUsageSource(mdx));
  assert.equal(actual.category, 'disabled-without-code');
  assert.equal(actual.missingPreviewSourceHostCells, 4, 'a hidden map is not displayed source');
});

test('partial runtime maps keep the missing host and never inherit WC source', () => {
  const mdx = source();
  const actual = classifyRoute(
    row(mdx),
    new Map([['demo-real', { file: 'realCode.ts', hosts: hosts.slice(0, 3) }]])
  );
  assert.equal(actual.category, 'preview-source-unverified');
  assert.equal(actual.missingPreviewSourceHostCells, 1);
  assert.deepEqual(actual.previews[0].sourceHosts, ['wc', 'react', 'vue']);
  assert.equal(actual.acceptance, 'not-established');
});

test('a real fenced snippet is retained but cannot turn into four-host Usage acceptance', () => {
  const mdx = `${source('codePanel={false}')}\n\n\`\`\`ts\nimport { thing } from '@proto.ui/example';\n\`\`\``;
  const actual = classifyRoute(row(mdx), new Map(), inspectUsageSource(mdx));
  assert.equal(actual.category, 'disabled-with-fenced-code');
  assert.equal(actual.missingPreviewSourceHostCells, 4);
  assert.equal(actual.acceptance, 'not-established');
  const complete = `${source('codePanel={false}')}\n\n<CodeExample examples={completeAppFiles} />`;
  const declared = classifyRoute(row(complete), new Map(), inspectUsageSource(complete));
  assert.equal(declared.category, 'code-example-unverified');
  assert.equal(declared.acceptance, 'not-established');
});

test('Code map discovery reads actual exports, not comments, template contents or executed keys', () => {
  const code = `
    // export const codeMap = { vue2: { 'comment-only': 'fake' } };
    const privateMap = { vue2: { 'private-only': 'fake' } };
    export const documentation = "codeMap = { vue2: { 'string-only': 'fake' } }";
    export const codeMap = { wc: { 'demo-real': formatCode('<button>Run</button>') } } as const;
  `;
  assert.deepEqual(inspectCodeMap(code, 'realCode.ts'), [
    { file: 'realCode.ts', host: 'wc', demoId: 'demo-real' },
  ]);
  for (const changed of [
    'export const codeMap = { ...getRuntimeMaps() };',
    "export const codeMap = { wc: { [computeDemoId()]: 'code' } };",
    'export const codeMap = makeMaps();',
  ])
    assert.throws(() => inspectCodeMap(changed), /Spread|Computed|Nonliteral/);
  assert.deepEqual(inspectCodeMap("const codeMap = { wc: { hidden: 'code' } };"), []);
});

test('two partial modules cannot be merged into a false complete map', () => {
  const one = inspectCodeMap("export const codeMap = { wc: { 'demo-real': 'code' } };", 'one.ts');
  const two = inspectCodeMap("export const codeMap = { vue2: { 'demo-real': 'code' } };", 'two.ts');
  assert.throws(
    () =>
      indexCodeMaps([
        { file: 'one.ts', entries: one },
        { file: 'two.ts', entries: two },
      ]),
    /Duplicate Code source/
  );
  assert.deepEqual(indexCodeMaps([{ file: 'one.ts', entries: one }]).get('demo-real'), {
    file: 'one.ts',
    hosts: ['wc'],
  });
});

test('public, workspace-only and absent CLI targets retain distinct delivery obligations', () => {
  const current = row(source());
  const entry = { id: 'base-real', importPath: '@proto.ui/prototypes-base/real' };
  assert.equal(cliDisposition(current, { 'base-real': entry }, {}).kind, 'public-target');
  assert.equal(
    cliDisposition(current, {}, { 'base-real': { ...entry, sourceOnly: true } }).kind,
    'workspace-source-only'
  );
  assert.equal(
    cliDisposition(current, { 'base-real': { ...entry, sourceOnly: true } }, {}).kind,
    'workspace-source-only'
  );
  assert.equal(
    cliDisposition(
      current,
      { 'base-real': { ...entry, importPath: '@proto.ui/prototypes-base/another' } },
      {}
    ).kind,
    'no-component-target'
  );
  assert.equal(cliDisposition(current, {}, {}).installedAcceptance, 'not-established');
});

test('source drift, lost route keys or invented closure invalidate the persisted ledger', () => {
  const actual = {
    observedCheckout: { revision: 'a'.repeat(40), dirty: false },
    source: { inputDigest: 'b'.repeat(64) },
    children: [{ id: 'usage', state: 'open', families: ['base:real'], routeCount: 2 }],
  };
  assert.deepEqual(readinessProblems(structuredClone(actual), actual), []);
  const changedHead = structuredClone(actual);
  changedHead.observedCheckout.revision = 'c'.repeat(40);
  assert.deepEqual(
    readinessProblems(changedHead, actual),
    [],
    'the retained observation is not relabelled when all source inputs remain identical'
  );
  for (const mutation of [
    (copy) => {
      copy.source.inputDigest = 'd'.repeat(64);
    },
    (copy) => {
      copy.children[0].families = [];
    },
    (copy) => {
      copy.children[0].routeCount = 0;
    },
    (copy) => {
      copy.children[0].state = 'complete';
    },
  ]) {
    const copy = structuredClone(actual);
    mutation(copy);
    assert.ok(readinessProblems(copy, actual).length);
  }
});
