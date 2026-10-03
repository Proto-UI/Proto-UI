import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { Window } from 'happy-dom';
import { createHomepageShowcase } from '../../apps/www/src/components/Homepage/homepage-showcase.ts';
import { createProjectionComposition } from '../../apps/www/src/components/PrototypePreviewer/projection-composition.ts';

// Run with Node 24: node --import tsx --test scripts/test/projection-scope-evidence.test.mjs
// This is a helper/recipe contract fixture, not a browser or Adapter parity run.
// Render authored nodes as plain elements, then use the REAL composition setup
// to stamp renderer marker classes. Execute the actual browser assertion bodies
// without registering or launching the browser harness.
const root = fileURLToPath(new URL('../../', import.meta.url));
const browserPath = path.join(
  root,
  'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts'
);
const source = fs.readFileSync(process.env.PROJECTION_SCOPE_BROWSER_SOURCE ?? browserPath, 'utf8');
const ast = ts.createSourceFile(
  browserPath,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const declarations = ast.statements
  .filter((statement) => ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement))
  .map((statement) => statement.getText(ast))
  .join('\n');
const helpers = ['workspaceTask', 'assertTaskPartInventory', 'assertSurfacesShareCoordinate'];
const missing = helpers.filter(
  (name) =>
    !ast.statements.some(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name
    )
);

function expect(value, label) {
  const normal = (input) => JSON.parse(JSON.stringify(input));
  return {
    toBe: (expected) => assert.equal(value, expected, label),
    toEqual: (expected) => assert.deepEqual(normal(value), normal(expected), label),
    toBeTruthy: () => assert.ok(value, label),
    toBeGreaterThan: (expected) => assert.ok(value > expected, label),
  };
}
const api = missing.length
  ? null
  : vm.runInNewContext(
      `${ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}\n({ ${helpers.join(', ')}, EXPECTED_TASK_PROTOTYPES, GALLERY_PART_COUNTS, TASK_ID });`,
      { expect }
    );

class FixtureLocator {
  constructor(elements) {
    this.elements = [...new Set(elements)];
  }
  page() {
    return new FixtureLocator([this.elements[0].ownerDocument]);
  }
  locator(selector) {
    return new FixtureLocator(
      this.elements.flatMap((element) => [...element.querySelectorAll(selector)])
    );
  }
  or(other) {
    return new FixtureLocator([...this.elements, ...other.elements]);
  }
  async count() {
    return this.elements.length;
  }
  async getAttribute(name) {
    assert.equal(this.elements.length, 1);
    return this.elements[0].getAttribute(name);
  }
  async evaluateAll(callback, arg) {
    return callback(this.elements, arg);
  }
  async evaluate(callback, arg) {
    assert.equal(this.elements.length, 1);
    return callback(this.elements[0], arg);
  }
}

function fixture(family = 'shadcn', runtimeId = 'wc') {
  assert.ok(
    api,
    `browser evidence still assumes removed component picker; missing real-task helpers: ${missing.join(', ')}`
  );
  const window = new Window();
  const previousObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = window.MutationObserver;
  const document = window.document;
  const task = createHomepageShowcase(family, runtimeId, 'zh-cn', () => true);
  const composition = createProjectionComposition({
    ownerId: 'fixture-workspace-settings',
    runtimeId,
    projectionFamilyId: family,
    generation: 7,
    componentId: 'button',
    childDemo: task.demo,
    contentRecipe: task.recipe,
    controlIds: [],
    controls: {
      runtime: {
        label: 'Runtime',
        options: [{ value: runtimeId, label: runtimeId }],
        onValueChange() {},
      },
      family: { label: 'Style', options: [{ value: family, label: family }], onValueChange() {} },
      component: { label: 'Unused', options: [], onValueChange() {} },
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const refs = {};
  const prototypeNodes = [];
  function render(node, parent) {
    if (typeof node === 'string' || node.kind === 'text') {
      parent.append(typeof node === 'string' ? node : node.text);
      return;
    }
    const textarea = node.kind === 'proto' && node.prototypeId.endsWith('-textarea-root');
    const element = document.createElement(textarea && runtimeId !== 'wc' ? 'textarea' : 'div');
    element.className = node.className ?? '';
    for (const [name, value] of Object.entries(node.attrs ?? {})) element.setAttribute(name, value);
    if (node.ref) {
      element.setAttribute('data-demo-ref', node.ref);
      refs[node.ref] = element;
    }
    if (textarea && runtimeId === 'wc') {
      // Model the real WC adapter's logical host and physical text-control target.
      const control = document.createElement('textarea');
      control.className = element.className;
      element.className = '';
      element.append(control);
      prototypeNodes.push({ element: control, prototypeId: node.prototypeId });
    } else if (node.kind === 'proto')
      prototypeNodes.push({ element, prototypeId: node.prototypeId });
    parent.append(element);
    for (const child of node.children ?? []) render(child, element);
  }
  render(composition.demo.root, host);
  const content = host.querySelector('[data-projection-content]');
  const selectRoot = content.querySelector('[data-demo-ref="settings-view"]');
  const portal = prototypeNodes.find(
    ({ element, prototypeId }) =>
      selectRoot.contains(element) && prototypeId === api.EXPECTED_TASK_PROTOTYPES[family].content
  )?.element;
  assert.ok(portal, 'real authored task declares its own Select content');
  document.body.append(portal);
  const cleanup = composition.demo.setup({
    host,
    refs,
    api: { call() {}, setProps() {}, getExposes() {} },
  });
  composition.setLocked(false);
  const scope = host.querySelector('[data-projection-scope]');
  return {
    scope: new FixtureLocator([scope]),
    content: new FixtureLocator([content]),
    portal: new FixtureLocator([portal]),
    element: content,
    portalElement: portal,
    task,
    coordinate: { runtimeId, projectionFamilyId: family, generation: '7', state: 'ready' },
    close() {
      cleanup?.();
      globalThis.MutationObserver = previousObserver;
      window.happyDOM.abort();
    },
  };
}

async function verify(value) {
  await api.workspaceTask(value.scope, value.coordinate);
  await api.assertTaskPartInventory(value.scope, value.content, value.portal, value.coordinate);
}

test('browser acceptance targets the approved task without restoring the removed picker', () => {
  assert.deepEqual(
    missing,
    [],
    'old picker-based acceptance must be migrated to real-task helpers'
  );
  assert.equal(api.TASK_ID, 'website-component-gallery');
  assert.doesNotMatch(
    source,
    /chooseComponent|COMPONENT_IDS|control: 'runtime' \| 'family' \| 'component'/
  );
  assert.match(source, /\['runtime', 'family'\] as const/);
  assert.match(source, /await assertOpenTaskProjection\(page, scope, current\)/);
  assert.match(source, /for \(const runtimeId of RUNTIMES\)/);
  assert.match(source, /for \(const projectionFamilyId of PROJECTION_FAMILIES\)/);
  assert.match(source, /page\.on\('pageerror'/);
  assert.equal((source.match(/const errors = observePageErrors\(page\)/g) ?? []).length, 5);
  assert.equal(
    (
      source.match(/expect\(errors, 'no uncaught page errors, including transaction cleanup'\)/g) ??
      []
    ).length,
    5
  );
  for (const requirement of [
    'Website token boundary',
    'portal theme closure',
    'expectSemanticFocus',
    'family switch immediate old portal',
    'Runtime switch immediate old portal',
    'sample.inert',
    'sample.ariaHidden',
    'sample.visibility',
    'sample.pointerEvents',
    'family switch old portal frame',
    'Runtime switch old portal frame',
    'replaced family generation surfaces',
    'replaced Runtime generation surfaces',
    'expected.content',
    'expected.item',
    "restingBounds.y + (projectionFamilyId === 'brutalist' ? 0 : 1)",
  ])
    assert.ok(source.includes(requirement), `retains ${requirement}`);
});

for (const family of ['shadcn', 'brutalist']) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
    test(`${runtime}/${family}: real recipe, refs, and annotation satisfy actual browser helpers`, async () => {
      const value = fixture(family, runtime);
      try {
        assert.deepEqual(
          [...value.task.recipe.prototypeIds].sort(),
          [
            ...Object.keys(api.GALLERY_PART_COUNTS).map((suffix) => `${family}-${suffix}`),
            'site-preview-surface',
          ].sort()
        );
        assert.equal(value.task.recipe.prototypeIds.length, 35);
        await verify(value);
      } finally {
        value.close();
      }
    });
  }
  for (const part of [
    'select',
    'trigger',
    'value',
    'content',
    'item',
    'switch',
    'thumb',
    'textarea',
    'button',
  ]) {
    test(`${family}: missing ${part} cannot pass as an intact task`, async () => {
      const value = fixture(family);
      try {
        const prototypeId = api.EXPECTED_TASK_PROTOTYPES[family][part];
        const target = [
          ...value.element.querySelectorAll('.pui-projection-prototype'),
          value.portalElement,
          ...value.portalElement.querySelectorAll('.pui-projection-prototype'),
        ].find((element) => element.getAttribute('data-projection-prototype') === prototypeId);
        assert.ok(target);
        if (target === value.portalElement) target.removeAttribute('data-projection-prototype');
        else target.remove();
        await assert.rejects(() => verify(value));
      } finally {
        value.close();
      }
    });
  }
}

for (const attribute of [
  'data-projection-runtime',
  'data-projection-family',
  'data-projection-generation',
  'data-projection-owner',
  'data-projection-prototype',
]) {
  test(`a stale or unstamped portal item ${attribute} is rejected`, async () => {
    const value = fixture();
    try {
      value.portalElement
        .querySelector('.pui-projection-prototype')
        .setAttribute(attribute, 'wrong');
      await assert.rejects(() => verify(value));
    } finally {
      value.close();
    }
  });
}

test('fallback Button identity on the content wrapper is rejected', async () => {
  const value = fixture();
  try {
    value.element.setAttribute('data-projection-id', 'button');
    await assert.rejects(() => verify(value), /active task identity/);
  } finally {
    value.close();
  }
});

test('the wrapper cannot stand in for real interactive task parts', async () => {
  const value = fixture();
  try {
    value.element.querySelector('[data-demo-ref="settings-save"]').remove();
    value.element.setAttribute(
      'data-projection-prototype',
      api.EXPECTED_TASK_PROTOTYPES.shadcn.button
    );
    await assert.rejects(() => verify(value), /actual task part settings-save/);
  } finally {
    value.close();
  }
});

test('Select content that never leaves the task DOM is not portal evidence', async () => {
  const value = fixture();
  try {
    value.element.append(value.portalElement);
    await assert.rejects(() => verify(value), /actually escapes/);
  } finally {
    value.close();
  }
});

for (const mutation of [
  'wrapper-marker',
  'wrong-physical-tag',
  'stale-physical-generation',
  'detached-physical-control',
]) {
  test(`physical textarea rejects ${mutation}`, async () => {
    const value = fixture();
    try {
      const host = value.element.querySelector('[data-demo-ref="settings-note"]');
      const control = host.querySelector('textarea');
      assert.ok(control);
      if (mutation === 'wrapper-marker') {
        host.className = control.className;
        for (const name of control.getAttributeNames())
          host.setAttribute(name, control.getAttribute(name));
        control.remove();
      }
      if (mutation === 'wrong-physical-tag') {
        const fake = control.ownerDocument.createElement('div');
        for (const name of control.getAttributeNames())
          fake.setAttribute(name, control.getAttribute(name));
        control.replaceWith(fake);
      }
      if (mutation === 'stale-physical-generation')
        control.setAttribute('data-projection-generation', '6');
      if (mutation === 'detached-physical-control') control.remove();
      await assert.rejects(() => verify(value));
    } finally {
      value.close();
    }
  });
}
