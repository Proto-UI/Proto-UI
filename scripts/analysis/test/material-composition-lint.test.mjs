import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditComposition, summarizePrototype } from '../material-composition-lint.mjs';
import { createStaticReader } from '../lib/static-public-source.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const slot = `d.feedback.material.declare({version:2, shape:{kind:'rounded-rect',geometry:'style'},source:{kind:'in-app-backdrop'},fallback:{fill:'style',foreground:'style'}}); d.feedback.material.use({intent:'liquid-glass'});`;
const proto = (name, body) =>
  `import {definePrototype,tw} from '@proto.ui/core'; export default definePrototype({name:'${name}',setup(d){${body}}});`;
function fixture(fn, files = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), 'material-lint-'));
  const defaults = {
    'parent.ts': proto('parent', `d.feedback.style.use(tw('bg-background'));`),
    'child.ts': proto('child', slot + `d.feedback.style.use(tw('bg-background text-foreground'));`),
    'demo.ts': `export default {root:{kind:'proto',prototypeId:'parent',ref:'outer',children:[{kind:'proto',prototypeId:'child',ref:'inner'}]}};`,
  };
  for (const [name, content] of Object.entries({ ...defaults, ...files }))
    writeFileSync(resolve(directory, name), content);
  try {
    return fn(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
const run = (root) =>
  auditComposition({
    root,
    entry: 'demo.ts',
    prototypeFiles: [resolve(root, 'parent.ts'), resolve(root, 'child.ts')],
  });
const risks = (r, code = 'static-painted-ancestor') => r.diagnostics.filter((d) => d.code === code);

test('real declaration risk has actual source position and no optical-pass', () =>
  fixture((dir) => {
    const result = run(dir);
    assert.equal(risks(result).length, 1);
    assert.equal(risks(result)[0].evidence[0].path, 'parent.ts');
    assert.match(risks(result)[0].compositionPath, /outer.*inner/);
    assert.equal(result.status, 'needs-runtime');
    assert.equal(result.mode, 'report-only');
    assert.equal(result.inputs['parent.ts'].length, 64);
  }));

test('transparent ancestor is a negative control; own fallback fill is not ancestor paint', () =>
  fixture((dir) => assert.equal(risks(run(dir)).length, 0), {
    'parent.ts': proto('parent', `d.feedback.style.use(tw('bg-transparent'));`),
  }));

test('aliases, const string concatenation, same-file composable and handle alias retain risk', () =>
  fixture(
    (dir) => {
      assert.equal(risks(run(dir)).length, 1);
    },
    {
      'parent.ts': `import {definePrototype as define,tw as tokens} from '@proto.ui/core'; const paint='bg-'+'background'; function apply(x){ const s=x.feedback.style; s.use(tokens(paint)); } export default define({name:'parent',setup(d){apply(d);}});`,
    }
  ));

test('relative imported composable is followed without executing source', () =>
  fixture((dir) => assert.equal(risks(run(dir)).length, 1), {
    'paint.ts': `import {tw as tokens} from '@proto.ui/core'; export function apply(d){d.feedback.style.use(tokens('bg-background'));}`,
    'parent.ts': `import {definePrototype} from '@proto.ui/core'; import {apply as skin} from './paint'; export default definePrototype({name:'parent',setup(d){skin(d);}});`,
  }));

test('unused helper and a different object with feedback do not invent paint', () =>
  fixture((dir) => assert.equal(risks(run(dir)).length, 0), {
    'parent.ts': proto(
      'parent',
      `function unused(d){d.feedback.style.use(tw('bg-background'));} const fake={feedback:{style:{use(){}}}}; fake.feedback.style.use(tw('bg-background'));`
    ),
  }));

test('conditional and Rule paint remain runtime-only', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(risks(result).length, 0);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-inherited-contributions'));
    },
    {
      'parent.ts': proto(
        'parent',
        `if (d.props.get().paint) d.feedback.style.use(tw('bg-background')); d.rule({when:w=>w.state('x').eq(true),intent:i=>i.feedback.style.use(tw('bg-secondary'))});`
      ),
    }
  ));

test('dynamic slot source cannot be assumed to be a canvas backdrop', () =>
  fixture((dir) => assert.equal(risks(run(dir)).length, 0), {
    'child.ts': proto(
      'child',
      `d.feedback.material.declare(d.props.get().slot); d.feedback.material.use({intent:'liquid-glass'});`
    ),
  }));

test('transform is a conditional-profile risk, not a guaranteed runtime reason', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(risks(result, 'static-nonneutral-transform').length, 1);
      assert.match(risks(result, 'static-nonneutral-transform')[0].reason, /runtime evidence/);
    },
    { 'child.ts': proto('child', slot + `d.feedback.style.use(tw('-translate-x-1/2'));`) }
  ));

test('unknown background utility and dynamic consumer style are explicitly unresolved', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(risks(result).length, 0);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-style'));
    },
    { 'parent.ts': proto('parent', `d.feedback.style.use(tw('bg-[var(--paint)]'));`) }
  ));

test('unresolved children do not claim completed composition coverage', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-children'));
    },
    { 'demo.ts': `export default {root:{kind:'box',children:externalChildren}};` }
  ));

test('unsupported calls and mutation before return are not executed or certified', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(result.surfaces, 0);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-entry'));
    },
    {
      'demo.ts': `function make(){const ignored=globalThis.DO_NOT_EXECUTE();return {root:{kind:'box'}};}export default make();`,
    }
  ));

test('recursive static factories fail boundedly instead of hanging', () =>
  fixture(
    (dir) => {
      const reader = createStaticReader(dir, { maxSteps: 100 });
      assert.throws(() => reader.exported('demo.ts'), /step limit/);
    },
    { 'demo.ts': `function make(){return make();} export default make();` }
  ));

test('material-only composable is detected through alias without name dispatch', () =>
  fixture(
    (dir) => {
      const reader = createStaticReader(dir);
      const s = summarizePrototype(reader, 'child.ts');
      assert.equal(s.slots.length, 1);
    },
    {
      'child.ts': `import {definePrototype as define} from '@proto.ui/core'; function skin(d){${slot}} const apply=skin;export default define({name:'not-a-known-component',setup(d){apply(d);}});`,
    }
  ));

test('real repaired Accordion template and reverted-paint control are bound to source hashes', () => {
  const files = ['root', 'item', 'heading', 'trigger', 'content'].map((name) =>
    resolve(root, `packages/prototypes/liquid-glass/src/accordion/${name}.proto.ts`)
  );
  files.push(resolve(root, 'packages/prototypes/liquid-glass/src/button/button.proto.ts'));
  const args = {
    root,
    entry: 'apps/www/src/content/docs/demo-liquid-glass-accordion.demo.ts',
    prototypeFiles: files,
  };
  const before = auditComposition({
    ...args,
    read: (path, encoding) => {
      const source = readFileSync(path, encoding);
      if (path.endsWith('/liquid-glass/src/accordion/item.proto.ts'))
        return source.replace('bg-transparent', 'bg-background');
      if (path.endsWith('/liquid-glass/src/accordion/content.proto.ts'))
        return source.replace('bg-background rounded-2xl ', '');
      return source;
    },
  });
  assert.ok(risks(before).some((d) => d.evidence[0].path.endsWith('/item.proto.ts')));
  const after = auditComposition(args);
  assert.equal(risks(after).filter((d) => d.evidence[0].path.endsWith('/item.proto.ts')).length, 0);
  assert.ok(
    risks(after).some(
      (d) =>
        d.evidence[0].path.endsWith('/content.proto.ts') && d.compositionPath.includes('nested')
    )
  );
  assert.equal(risks(after).filter((d) => !d.compositionPath.includes('nested')).length, 0);
  const item = 'packages/prototypes/liquid-glass/src/accordion/item.proto.ts';
  assert.notEqual(before.inputs[item], after.inputs[item]);
  assert.equal(after.status, 'needs-runtime');
});

test('nested lexical shadowing does not leak out of its block', () =>
  fixture((dir) => assert.equal(risks(run(dir)).length, 1), {
    'parent.ts': proto(
      'parent',
      `const color='bg-background'; {const color='bg-transparent';} d.feedback.style.use(tw(color));`
    ),
  }));

test('short-circuit and ternary paint are runtime-only, including false branches', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(risks(result).length, 0);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-inherited-contributions'));
    },
    {
      'parent.ts': proto(
        'parent',
        `false && d.feedback.style.use(tw('bg-background')); condition ? d.feedback.style.use(tw('bg-secondary')) : undefined;`
      ),
    }
  ));

test('forward const read is unknown rather than silently evaluating a TDZ', () =>
  fixture(
    (dir) => {
      const reader = createStaticReader(dir);
      const summary = summarizePrototype(reader, 'parent.ts');
      assert.equal(summary.styles.length, 0);
      assert.ok(summary.unknowns.length);
    },
    {
      'parent.ts': proto(
        'parent',
        `const fill=later; const later='bg-background'; d.feedback.style.use(tw(fill));`
      ),
    }
  ));

test('return stops unreachable setup paint', () =>
  fixture((dir) => assert.equal(risks(run(dir)).length, 0), {
    'parent.ts': proto('parent', `return ()=>null; d.feedback.style.use(tw('bg-background'));`),
  }));

test('object mutation and handle rebinding invalidate subsequent static facts', () => {
  for (const body of [
    `const cfg={paint:'bg-background'}; cfg.paint='bg-transparent'; d.feedback.style.use(tw(cfg.paint));`,
    `d={}; d.feedback.style.use(tw('bg-background'));`,
  ])
    fixture(
      (dir) => {
        const result = run(dir);
        assert.equal(risks(result).length, 0);
        assert.ok(
          result.diagnostics.some((d) => d.code === 'needs-runtime-inherited-contributions')
        );
      },
      { 'parent.ts': proto('parent', body) }
    );
});

test('module mutation prevents composition certification', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(result.surfaces, 0);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-entry'));
    },
    {
      'demo.ts': `const demo={root:{kind:'box'}}; demo.root={kind:'proto',prototypeId:'child'}; export default demo;`,
    }
  ));

test('neutral-looking and arbitrary transforms are unresolved, not non-neutral warnings', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(risks(result, 'static-nonneutral-transform').length, 0);
      assert.equal(
        result.diagnostics.filter((d) => d.code === 'needs-runtime-transform').length,
        6
      );
    },
    {
      'child.ts': proto(
        'child',
        slot +
          `d.feedback.style.use(tw('translate-x-0 rotate-0 scale-100 scale-x-100 skew-x-0 transform-[var(--matrix)]'));`
      ),
    }
  ));

test('public factory origin retains span and callsite chain', () =>
  fixture(
    (dir) => {
      const result = run(dir),
        diagnostic = risks(result)[0];
      assert.ok(diagnostic.location.endLine);
      assert.ok(diagnostic.location.callSites.length >= 1);
    },
    {
      'demo.ts': `function make(){return {root:{kind:'proto',prototypeId:'parent',children:[{kind:'proto',prototypeId:'child'}]}}}export default make();`,
    }
  ));

test('block TDZ shadows outer bindings before local initialization', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.equal(risks(result).length, 0);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-inherited-contributions'));
    },
    {
      'parent.ts': proto(
        'parent',
        `const paint='bg-background'; {d.feedback.style.use(tw(paint)); const paint='bg-transparent';}`
      ),
    }
  ));

test('all non-declarative module statements and unused effectful initializers are unresolved', () => {
  for (const effect of [
    `const unused=(demo.root={kind:'proto',prototypeId:'child'});`,
    `do {demo.root={kind:'proto',prototypeId:'child'};} while(false);`,
    `for (const key in {}) {demo.root={kind:'proto',prototypeId:'child'};}`,
    `{demo.root={kind:'proto',prototypeId:'child'};}`,
    `switch(true){case true:demo.root={kind:'proto',prototypeId:'child'};}`,
    `const unused={value:unmodeledCall(demo)};`,
  ])
    fixture(
      (dir) => {
        const result = run(dir);
        assert.equal(result.surfaces, 0);
        assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-entry'));
      },
      { 'demo.ts': `const demo={root:{kind:'box'}};${effect}export default demo;` }
    );
});

test('async and generator factories are not read as synchronous DemoSpec values', () => {
  for (const make of [
    `async function make(){return {root:{kind:'box'}}}`,
    `function* make(){return {root:{kind:'box'}}}`,
    `const make=async()=>({root:{kind:'box'}});`,
  ])
    fixture(
      (dir) => {
        const result = run(dir);
        assert.equal(result.surfaces, 0);
        assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-entry'));
      },
      { 'demo.ts': `${make}export default make();` }
    );
});

test('async setup is unsupported, not certified empty authoring', () =>
  fixture(
    (dir) => {
      const result = run(dir);
      assert.ok(result.diagnostics.some((d) => d.code === 'needs-runtime-prototype'));
    },
    {
      'parent.ts': `import {definePrototype,tw} from '@proto.ui/core';export default definePrototype({name:'parent',async setup(d){d.feedback.style.use(tw('bg-background'));}});`,
    }
  ));
