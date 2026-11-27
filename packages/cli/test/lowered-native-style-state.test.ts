import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const selection = `
  const KEY = { id: 'private-style-probe' };
  export function select(def) {
    const selected = def.state.enum('choice', 'one', { options: ['one', 'two'] });
    const sync = run => selected.set(run.props.getRaw().choice ?? 'one');
    def.props.watchRaw(['choice'], sync);
    return selected;
  }
`;
const nativeRegistrations = `
  const KEY = { id: 'private-style-probe' };
  export function register(def) {
    const owner = def;
    owner.context.provide(KEY, { style: null });
    owner.context.trySubscribeAncestor(KEY, run => run.context.tryReadAncestor(KEY));
    owner.lifecycle.onBeforeDispose(run => run.props.getRaw());
  }
`;
const source = (prefix = '', when = "w => w.state(style).eq('two')", suffix = '') => `
  import { definePrototype, tw } from '@proto.ui/core';
  import { select } from './selection';
  import { register } from './registration';
  const KEY = { id: 'private-style-probe' };
  export default definePrototype({ name: 'native-style-proof', setup(def) {
    ${prefix}
    const style = select(def);
    def.rule({ when: ${when}, intent: i => i.feedback.style.use(tw('bg-primary')) });
    ${suffix}
  } });
`;
// A prop predicate can make its own Rule runtime-only. Keep an independent
// projectable read in the same owner so the complete State-use proof must
// account for every reference, including a rejected sibling callback.
const stateReadCanary = `def.rule({ when: w => w.state(style).eq('one'),
  intent: i => i.feedback.style.use(tw('text-primary')) });`;

describe('private returned State keeps exact native Def and WhenBuilder provenance', () => {
  let directory = '';
  beforeEach(async () => {
    directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-native-style-state-')));
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const fixture = async (entry = source(), changes: Record<string, string> = {}) => {
    const texts = {
      'selection.ts': selection,
      'registration.ts': nativeRegistrations,
      'entry.proto.ts': entry,
      ...changes,
    };
    const files = await Promise.all(
      Object.entries(texts).map(async ([name, text]) => {
        const file = path.join(directory, name);
        await writeFile(file, text);
        return file;
      })
    );
    const inventory = scanRuleStateReadInventory(files);
    const tokens = await collectProtoStyleTokensFromFiles(files);
    const parsed = ts.createSourceFile(
      path.join(directory, 'entry.proto.ts'),
      entry,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const summary = createHookSourceSummaryContext();
    summary.registerSource(parsed);
    let declaredName: string | null = null;
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && summary.isAuthoredSetup(node, parsed)) {
        const parameter = node.parameters[0]!;
        const definitions = new Set<ts.Node>(
          summary.isNativeSetupDefinition(parameter) ? [parameter] : []
        );
        const captured = (child: ts.Node): void => {
          if (
            ts.isVariableDeclaration(child) &&
            ts.isIdentifier(child.name) &&
            child.name.text === 'style' &&
            child.initializer &&
            ts.isCallExpression(child.initializer)
          ) {
            declaredName =
              summary.resolveReturnedLocalState(child.initializer, parsed, definitions)
                ?.declaredName ?? null;
          }
          ts.forEachChild(child, captured);
        };
        if (node.body) captured(node.body);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    return { inventory, tokens, declaredName };
  };

  it.each([
    ['private direct State', ''],
    ['native context provide', 'def.context.provide(KEY, { style: null });'],
    [
      'native ancestor subscription',
      'def.context.trySubscribeAncestor(KEY, run => run.context.tryReadAncestor(KEY));',
    ],
    [
      'native before-dispose registration',
      'def.lifecycle.onBeforeDispose(run => run.props.getRaw());',
    ],
    ['imported registration helper and exact Def alias', 'register(def);'],
  ])('preserves the real State beside %s', async (_label, prefix) => {
    const result = await fixture(source(prefix));
    expect(result.inventory.evaluated).toHaveLength(1);
    expect(result.inventory.evaluated[0]).toMatchObject({
      unresolved: [],
      usages: [],
      exposedLocals: [],
    });
    expect(result.declaredName).toBe('choice');
    expect(result.tokens).toContain('bg-primary');
    expect(result.tokens.some((token) => token.includes('data-[choice'))).toBe(false);
  });

  it.each([
    ['ancestor subscription', 'def.context.trySubscribeAncestor(KEY, sync);'],
    ['before-dispose registration', 'def.lifecycle.onBeforeDispose(sync);'],
  ])('retains a private State written by its actual %s callback', async (_label, registration) => {
    const result = await fixture(source(), {
      'selection.ts': selection.replace("def.props.watchRaw(['choice'], sync);", registration),
    });
    expect(result.inventory.evaluated).toHaveLength(1);
    expect(result.inventory.evaluated[0]!.unresolved).toEqual([]);
    expect(result.declaredName).toBe('choice');
    expect(result.tokens).toContain('bg-primary');
  });

  it('keeps a native prop predicate beside the private State without inventing an exposure', async () => {
    const result = await fixture(
      source(
        'register(def);',
        "w => w.all(w.state(style).eq('two'), w.prop('active').eq(true))",
        stateReadCanary
      )
    );
    expect(result.inventory.evaluated).toHaveLength(2);
    expect(
      result.inventory.evaluated.every(
        (row) =>
          row.unresolved.length === 0 && row.usages.length === 0 && row.exposedLocals.length === 0
      )
    ).toBe(true);
    expect(result.declaredName).toBe('choice');
    expect(result.tokens).toContain('bg-primary');
    expect(result.tokens).toContain('text-primary');
    expect(result.tokens.some((token) => token.includes('data-[choice'))).toBe(false);
  });

  it.each([
    ['foreign Def', source().replace('select(def)', 'select(foreign)')],
    ['unknown Def operation', source('def.context.unknown(KEY);')],
    ['nonexistent lifecycle operation', source('def.lifecycle.onDisposed(() => {});')],
    ['Def facade write', source('def.context.provide = foreign;')],
    [
      'Def facade alias write',
      source('const alias = def; alias.context.trySubscribeAncestor = foreign;'),
    ],
    ['Def binding write', source('def = foreign;')],
    ['Def argument escape', source('opaque(def);')],
    ['Def escape through provider value', source('def.context.provide(KEY, { owner: def });')],
    [
      'Def captured by ancestor callback',
      source('def.context.trySubscribeAncestor(KEY, () => def.state.bool("late", true));'),
    ],
    [
      'Def captured by disposal callback',
      source('def.lifecycle.onBeforeDispose(() => def.state.bool("late", true));'),
    ],
    ['dynamic facade member', source('def.context[unknown](KEY);')],
    ['facade method alias', source('const provide = def.context.provide; provide(KEY, {});')],
    ['optional native operation', source('def.context.provide?.(KEY, {});')],
    ['Def spread into a native operation', source('def.context.provide(...unknown);')],
    ['State argument escape', source('register(def);', undefined, 'opaque(style);')],
    ['State container escape', source('register(def);', undefined, 'const stored = { style };')],
  ])('does not certify %s from a familiar member name', async (_label, entry) => {
    const result = await fixture(entry);
    expect(result.inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
    expect(result.declaredName).toBeNull();
  });

  it.each([
    ['unknown builder operation', "w => w.all(w.state(style).eq('two'), w.unknown())"],
    [
      'builder member write',
      "w => { w.prop = foreign; return w.all(w.state(style).eq('two'), w.prop('active').eq(true)); }",
    ],
    [
      'builder escape',
      "w => { opaque(w); return w.all(w.state(style).eq('two'), w.prop('active').eq(true)); }",
    ],
    [
      'builder method alias',
      "w => { const prop = w.prop; return w.all(w.state(style).eq('two'), prop('active').eq(true)); }",
    ],
    [
      'dynamic builder member',
      "w => w.all(w.state(style).eq('two'), w[unknown]('active').eq(true))",
    ],
    [
      'spread builder arguments',
      "w => w.all(w.state(style).eq('two'), w.prop(...unknown).eq(true))",
    ],
    ['async builder', "async w => w.all(w.state(style).eq('two'), w.prop('active').eq(true))"],
    [
      'default callback side effect',
      "(w, extra = opaque(w)) => w.all(w.state(style).eq('two'), w.prop('active').eq(true))",
    ],
    ['foreign builder', "w => other.state(style).eq('two')"],
  ])('keeps %s unresolved beside a prop predicate', async (_label, when) => {
    const result = await fixture(source('register(def);', when, stateReadCanary));
    expect(result.inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
    expect(result.declaredName).toBeNull();
  });

  it('keeps the exposed return pending while the production collector lacks its declared attribute identity', async () => {
    const result = await fixture(
      source('register(def);', undefined, "def.expose.state('publicStyle', style);")
    );
    expect(result.inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
    expect(result.inventory.evaluated[0]!.exposedLocals).toEqual([]);
    expect(result.declaredName).toBeNull();
    expect(result.tokens.some((token) => token.endsWith('bg-primary'))).toBe(true);
    expect(result.tokens).not.toContain('data-[choice=two]:bg-primary');
  });

  it('requires the actual replay call before proving a discarded paint return', async () => {
    const result = await fixture(
      `
      import { definePrototype } from '@proto.ui/core';
      import { paint } from './visual';
      export default definePrototype({ name: 'ignored-paint-result', setup(def) { paint(def); } });
    `,
      {
        'visual.ts': `
      import { tw } from '@proto.ui/core';
      import { select } from './selection';
      export function paint(def) {
        const style = select(def);
        def.rule({ when: w => w.state(style).eq('two'), intent: i => i.feedback.style.use(tw('bg-primary')) });
        return style;
      }
    `,
      }
    );
    expect(result.inventory.evaluated).toHaveLength(1);
    expect(result.inventory.evaluated[0]!.unresolved).toEqual([]);
    expect(result.inventory.evaluated[0]!.usages).toEqual([]);
    expect(result.inventory.evaluated[0]!.exposedLocals).toEqual([]);
    expect(result.tokens).toContain('bg-primary');
    expect(result.tokens).not.toContain('data-[choice=two]:bg-primary');
    const text = await readFile(path.join(directory, 'visual.ts'), 'utf8');
    const parsed = ts.createSourceFile(
      path.join(directory, 'visual.ts'),
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const helper = parsed.statements.find(ts.isFunctionDeclaration)!;
    const captured = helper.body!.statements.find(ts.isVariableStatement)!.declarationList
      .declarations[0]!;
    const summary = createHookSourceSummaryContext();
    summary.registerSource(parsed);
    expect(
      summary.resolveReturnedLocalState(
        captured.initializer as ts.CallExpression,
        parsed,
        new Set([helper.parameters[0]!])
      )
    ).toBeNull();
  });

  it('closes the real Accordion root and the exact private State read by its returned renderer', () => {
    const files = ['root', 'trigger'].map((part) =>
      path.join(ROOT, `packages/prototypes/shadcn/src/accordion/${part}.proto.ts`)
    );
    const inventory = scanRuleStateReadInventory(files);
    for (const file of files) {
      const rows = inventory.evaluated.filter((row) => row.entryFile === file);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => !row.declarationOnly)).toBe(true);
      const style = rows
        .flatMap((row) => row.unresolved)
        .filter((item) => item.expression === 'style');
      expect(style).toEqual([]);
    }
  });

  it.each([
    ['direct renderer', 'return r => r.text(style.get());'],
    ['literal member', "return r => r.text(style['get']());"],
    ['private const alias', 'const alias = style; return r => r.text(alias.get());'],
    ['anonymous synchronous function', 'return function (r) { return r.text(style.get()); };'],
    ['parenthesized renderer', 'return ((r) => r.text((style).get()));'],
  ])('preserves private State identity through the %s scalar read', async (_label, suffix) => {
    const result = await fixture(source('', undefined, suffix));
    expect(result.inventory.evaluated).toHaveLength(1);
    expect(result.inventory.evaluated[0]).toMatchObject({
      unresolved: [],
      usages: [],
      exposedLocals: [],
    });
    expect(result.declaredName).toBe('choice');
    expect(result.tokens).toContain('bg-primary');
    expect(result.tokens.some((token) => token.includes('data-[choice'))).toBe(false);
  });

  it.each([
    ['unknown callback', 'opaque(() => style.get());'],
    ['nested render callback', 'return r => r.slot(() => style.get());'],
    ['State passed by the renderer', 'return r => r.text(opaque(style));'],
    ['State returned by the renderer', 'return r => style;'],
    ['State stored by the renderer', 'return r => ({ style });'],
    ['get member write', 'style.get = foreign; return r => r.text(style.get());'],
    [
      'alias member write',
      'const alias = style; alias.get = foreign; return r => r.text(style.get());',
    ],
    ['get method alias', 'const read = style.get; return r => r.text(read());'],
    ['dynamic get member', 'return r => r.text(style[unknown]());'],
    ['optional get call', 'return r => r.text(style.get?.());'],
    ['get argument', 'return r => r.text(style.get(unknown));'],
    ['borrowed get receiver', 'return r => r.text(style.get.call(foreign));'],
    ['async renderer', 'return async r => r.text(style.get());'],
    ['generator renderer', 'return function* (r) { yield style.get(); };'],
    ['named renderer', 'return function render(r) { return r.text(style.get()); };'],
    ['extra renderer parameter', 'return (r, extra) => r.text(style.get());'],
    ['default renderer parameter', 'return (r = foreign) => r.text(style.get());'],
    ['rest renderer parameter', 'return (...r) => style.get();'],
    ['renderer alias', 'const render = r => r.text(style.get()); return render;'],
    ['non-render setup read', 'const value = style.get();'],
  ])('does not extend the private read proof to %s', async (_label, suffix) => {
    const result = await fixture(source('', undefined, suffix));
    expect(result.inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
    expect(result.declaredName).toBeNull();
    expect(result.tokens).not.toContain('data-[choice=two]:bg-primary');
  });

  const paint = `
    import { tw } from '@proto.ui/core';
    import { select } from './selection';
    export function paint(def) {
      const style = select(def);
      def.rule({ when: w => w.state(style).eq('two'), intent: i => i.feedback.style.use(tw('bg-primary')) });
      return style;
    }
  `;
  const paintedSource = (body: string, imports = "import { paint } from './visual';") => `
    import { definePrototype } from '@proto.ui/core';
    ${imports}
    export default definePrototype({ name: 'painted-state-use', setup(def) { ${body} } });
  `;

  it.each([
    ['direct call', 'paint(def);', "import { paint } from './visual';"],
    [
      'stable local alias',
      'const install = paint; install(def);',
      "import { paint } from './visual';",
    ],
    ['import alias', 'install(def);', "import { paint as install } from './visual';"],
    ['re-export alias', 'install(def);', "import { install } from './public';"],
  ])('binds discarded State return proof to the actual %s', async (_label, body, imports) => {
    const result = await fixture(paintedSource(body, imports), {
      'visual.ts': paint,
      'public.ts': "export { paint as install } from './visual';",
    });
    expect(result.inventory.evaluated).toHaveLength(1);
    expect(result.inventory.evaluated[0]).toMatchObject({
      unresolved: [],
      usages: [],
      exposedLocals: [],
    });
    expect(result.tokens).toContain('bg-primary');
    expect(result.tokens).not.toContain('data-[choice=two]:bg-primary');
  });

  it.each([
    ['assigned result', 'const captured = paint(def);'],
    ['returned result', 'return paint(def);'],
    ['chained get result', 'paint(def).get();'],
    ['opaque result consumer', 'opaque(paint(def));'],
    ['exposed result', "const captured = paint(def); def.expose.state('publicStyle', captured);"],
    ['void expression', 'void paint(def);'],
    ['comma expression', 'paint(def), opaque();'],
  ])('retains the unsupported %s as unresolved', async (_label, body) => {
    const result = await fixture(paintedSource(body), { 'visual.ts': paint });
    expect(result.inventory.evaluated).toHaveLength(1);
    expect(result.inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
    expect(result.tokens).not.toContain('data-[choice=two]:bg-primary');
  });

  it.each([false, true])(
    'does not borrow a discarded activation proof across another caller (escape first: %s)',
    async (escapeFirst) => {
      const discarded = 'paint(def);';
      const escaped = "const captured = paint(def); def.expose.state('publicStyle', captured);";
      const result = await fixture(
        paintedSource(escapeFirst ? escaped + discarded : discarded + escaped),
        { 'visual.ts': paint }
      );
      expect(result.inventory.evaluated).toHaveLength(2);
      const expected = escapeFirst ? [true, false] : [false, true];
      expect(
        result.inventory.evaluated.map((row) =>
          row.unresolved.some((item) => item.expression === 'style' && item.reason === 'subject')
        )
      ).toEqual(expected);
      expect(result.tokens).not.toContain('data-[choice=two]:bg-primary');
    }
  );

  it('does not infer a nested wrapper return is discarded without that caller evidence', async () => {
    const result = await fixture(
      paintedSource('install(def);', "import { install } from './wrapper';"),
      {
        'visual.ts': paint,
        'wrapper.ts':
          "import { paint } from './visual'; export function install(def) { return paint(def); }",
      }
    );
    expect(result.inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
  });

  it('does not infer an awaited wrapper return is discarded', async () => {
    const result = await fixture(
      paintedSource('install(def);', "import { install } from './wrapper';"),
      {
        'visual.ts': paint,
        'wrapper.ts':
          "import { paint } from './visual'; export async function install(def) { return await paint(def); }",
      }
    );
    expect(result.inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
  });

  it('rejects a discarded call to a different function as return-use evidence', async () => {
    const entry = paintedSource('other(def);', "import { other } from './other';");
    await fixture(entry, { 'visual.ts': paint, 'other.ts': 'export function other(def) {}' });
    const file = path.join(directory, 'visual.ts');
    const parsed = ts.createSourceFile(file, paint, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const entrySource = ts.createSourceFile(
      path.join(directory, 'entry.proto.ts'),
      entry,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const helper = parsed.statements.find(ts.isFunctionDeclaration)!;
    const captured = helper.body!.statements.find(ts.isVariableStatement)!.declarationList
      .declarations[0]!;
    let wrongCall: ts.CallExpression | undefined;
    const find = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'other'
      )
        wrongCall = node;
      ts.forEachChild(node, find);
    };
    find(entrySource);
    expect(wrongCall).toBeDefined();
    const summary = createHookSourceSummaryContext();
    summary.registerSource(parsed);
    summary.registerSource(entrySource);
    expect(
      summary.resolveReturnedLocalState(
        captured.initializer as ts.CallExpression,
        parsed,
        new Set([helper.parameters[0]!]),
        wrongCall
      )
    ).toBeNull();
  });

  it.each([
    [
      'Input',
      ['input/root.proto.ts', 'field/control.proto.ts'],
      'input/visual.ts',
      'setupInputVisual',
    ],
    [
      'Calendar Day',
      ['calendar/calendar.proto.ts'],
      'calendar/visual.ts',
      'setupCalendarDayVisual',
    ],
    [
      'Calendar Navigation',
      ['calendar/calendar.proto.ts'],
      'calendar/visual.ts',
      'setupCalendarNavVisual',
    ],
  ] as const)(
    'retains the real %s Rule sites while their actual callers discard the return',
    async (_label, fileNames, relative, name) => {
      const files = fileNames.map((name) =>
        path.join(ROOT, 'packages/prototypes/shadcn/src', name)
      );
      const inventory = scanRuleStateReadInventory(files);
      const file = path.join(ROOT, 'packages/prototypes/shadcn/src', relative);
      const text = await readFile(file, 'utf8');
      const parsed = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      const helper = parsed.statements.find(
        (statement): statement is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(statement) && statement.name?.text === name
      )!;
      const expected = new Set<number>();
      const walk = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'rule'
        )
          expected.add(node.getStart());
        ts.forEachChild(node, walk);
      };
      walk(helper.body!);
      expect(expected.size).toBeGreaterThan(0);
      const rows = inventory.evaluated.filter(
        (row) => row.rule.file === file && expected.has(row.rule.start)
      );
      expect(new Set(rows.map((row) => row.rule.start))).toEqual(expected);
      expect(rows.every((row) => !row.declarationOnly)).toBe(true);
      expect(
        rows
          .flatMap((row) => row.unresolved)
          .filter((item) => item.reason === 'subject' && item.expression === 'style')
      ).toEqual([]);
    }
  );

  it('does not permit a second State escape inside an otherwise discarded helper', async () => {
    const result = await fixture(paintedSource('paint(def);'), {
      'visual.ts': paint.replace('return style;', 'opaque(style); return style;'),
    });
    expect(result.inventory.evaluated[0]!.unresolved).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
  });

  it('keeps an opaque caller of a shared helper in the inventory', async () => {
    const result = await fixture(paintedSource('paint(def); opaque(paint);'), {
      'visual.ts': paint,
    });
    expect(result.inventory.evaluated.some((row) => row.unresolved.length > 0)).toBe(true);
    expect(result.inventory.evaluated.flatMap((row) => row.unresolved)).toContainEqual({
      expression: 'style',
      reason: 'subject',
    });
  });
});
