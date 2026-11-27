import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { lookupDataType } from '@proto.ui/compiler/targets/ir';
import { emitReact } from '@proto.ui/compiler/targets/react';

const source = { file: 'packages/compiler/test/composite-ir.node-test.mjs', start: 0, end: 0 };
const binding = (id, type) => ({ id, name: id, type, source });
const field = (name, type) => ({ name, type, source });
const local = (id) => ({ kind: 'local', id });
const text = (value) => ({ kind: 'text', value });
const call = (fn, ...args) => ({ kind: 'call', fn, args });
const member = (value, name) => ({ kind: 'member', value, field: name });
const returns = (value) => ({ kind: 'return', value, source });
const block = (id, params, end) => ({ id, params, instructions: [], end });

function pure(id, type, params, dependencies, blocks) {
  return {
    binding: binding(id, type),
    phase: 'pure',
    params,
    dependencies,
    entry: blocks[0].id,
    blocks,
  };
}

function compositeFixture() {
  const types = [
    { kind: 'presence', value: 'bool', source },
    { kind: 'record', fields: [field('enabled', 'bool'), field('label', 'text')], source },
    { kind: 'record', fields: [field('choice', 'data:1')], source },
  ];
  const input = { kind: 'prop', id: 'selection' };
  const hasInput = { kind: 'has-value', value: input };
  // The helper constructs label before enabled. Their types and values follow
  // their field names even though the declaration lists enabled first.
  const inner = {
    kind: 'record',
    type: 'data:1',
    fields: [
      { name: 'label', value: local('caption') },
      { name: 'enabled', value: local('flag') },
    ],
  };
  const outer = { kind: 'record', type: 'data:2', fields: [{ name: 'choice', value: inner }] };
  const match = {
    kind: 'presence',
    value: input,
    source,
    present: { block: 'provided', args: [text('provided')] },
    omitted: { block: 'absent', args: [text('omitted')] },
  };
  const provided = block(
    'provided',
    [binding('payload', 'bool'), binding('providedLabel', 'text')],
    returns(call('wrap', local('providedLabel'), local('payload')))
  );
  const absent = block(
    'absent',
    [binding('absentLabel', 'text')],
    returns(call('wrap', local('absentLabel'), { kind: 'bool', value: false }))
  );
  const wrap = pure(
    'wrap',
    'data:2',
    [binding('caption', 'text'), binding('flag', 'bool')],
    [],
    [block('build', [], returns(outer))]
  );
  const program = {
    version: 5,
    id: 'selection-summary',
    externs: [],
    created: [],
    tasks: [],
    keys: [],
    consumes: [],
    provides: [],
    components: [],
    name: 'SelectionSummary',
    source,
    types,
    props: [binding('selection', 'data:0')],
    fields: [],
    signals: [],
    actions: [],
    projections: [
      { name: 'detail', fn: 'summarize' },
      { name: 'supplied', fn: 'isSupplied' },
    ],
    behaviors: [
      wrap,
      pure('summarize', 'data:2', [], ['selection'], [block('read', [], match), provided, absent]),
      pure('isSupplied', 'bool', [], ['selection'], [block('read', [], returns(hasInput))]),
      pure(
        'renderLabel',
        'text',
        [],
        ['selection'],
        [block('read', [], returns(member(member(call('summarize'), 'choice'), 'label')))]
      ),
    ],
    view: {
      kind: 'element',
      tag: 'span',
      children: [{ kind: 'text', value: 'renderLabel', source }],
      source,
    },
  };
  return { program, input, inner, outer, wrap, hasInput, match, provided };
}

test('a generated component delivers the two typed edges and named nested record fields', async (t) => {
  const { program } = compositeFixture();
  const nested = program.types[2].fields[0].type;
  assert.deepEqual(lookupDataType(program.types, nested, 2), program.types[1]);

  const directory = await mkdtemp(path.join(tmpdir(), 'proto-composite-ir-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const modules = path.join(directory, 'node_modules');
  await mkdir(path.join(modules, '@proto.ui'), { recursive: true });
  const require = createRequire(import.meta.url);
  await symlink(
    fileURLToPath(new URL('../', import.meta.url)),
    path.join(modules, '@proto.ui', 'compiler'),
    'dir'
  );
  await symlink(
    path.dirname(require.resolve('react/package.json')),
    path.join(modules, 'react'),
    'dir'
  );
  const file = path.join(directory, 'SelectionSummary.mts');
  await writeFile(file, emitReact(program));
  const { SelectionSummary } = await import(pathToFileURL(file).href);

  for (const [props, label, enabled, supplied] of [
    [{}, 'omitted', false, false],
    [{ selection: false }, 'provided', false, true],
    [{ selection: true }, 'provided', true, true],
  ]) {
    let projection;
    const appearance = (observed) => {
      projection = observed;
      return {};
    };
    const html = renderToStaticMarkup(createElement(SelectionSummary, { ...props, appearance }));
    assert.equal(html, `<span>${label}</span>`);
    assert.deepEqual(projection, { detail: { choice: { label, enabled } }, supplied });
  }
});

const invalid = [
  [
    'a forward type reference even in an unused declaration',
    ({ program }) => {
      program.types.push(
        { kind: 'record', fields: [field('later', 'data:4')], source },
        { kind: 'record', fields: [field('flag', 'bool')], source }
      );
    },
  ],
  [
    'a self-reference at the current type index',
    ({ program }) => {
      program.types.push({ kind: 'presence', value: 'data:3', source });
    },
  ],
  [
    'the earlier presence type where the nested record type is required',
    ({ input, outer, wrap }) => {
      outer.fields[0].value = input;
      wrap.dependencies.push(input.id);
    },
  ],
  [
    'a missing required record field',
    ({ inner }) => {
      inner.fields.pop();
    },
  ],
  [
    'a duplicate field with the correct total number of fields',
    ({ inner }) => {
      inner.fields = [
        { name: 'label', value: text('first') },
        { name: 'label', value: text('duplicate') },
      ];
    },
  ],
  [
    'has-value applied to a boolean',
    ({ hasInput }) => {
      hasInput.value = { kind: 'has-value', value: hasInput.value };
    },
  ],
  [
    'a present edge with the wrong implicit payload type',
    ({ provided }) => {
      provided.params[0].type = 'text';
      // Keep the block body well-typed on its own. Only the incoming payload is wrong.
      provided.end.value.args[1] = { kind: 'bool', value: true };
    },
  ],
  [
    'a present edge with a mistyped argument after the implicit payload',
    ({ match }) => {
      match.present.args[0] = { kind: 'bool', value: false };
    },
  ],
  [
    'an omitted edge that incorrectly supplies a payload',
    ({ match }) => {
      match.omitted.args.unshift({ kind: 'bool', value: true });
    },
  ],
];

for (const [description, change] of invalid) {
  test(`a package consumer receives an invalid-IR diagnostic for ${description}`, () => {
    const fixture = compositeFixture();
    // Keep these diagnostics independent of the reordered constructor in the
    // positive case. Establish admission before introducing the one bad input.
    fixture.inner.fields.reverse();
    assert.doesNotThrow(() => emitReact(fixture.program));
    change(fixture);
    assert.throws(
      () => emitReact(fixture.program),
      (error) => {
        assert.equal(error.category, 'invalid-ir');
        assert.equal(error.source?.file, source.file);
        return true;
      }
    );
  });
}
