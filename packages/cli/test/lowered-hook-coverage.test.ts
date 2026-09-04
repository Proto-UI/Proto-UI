import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createExposeStateWebNameMap } from '../../modules/expose-state-web/src/utils';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import {
  collectProtoStyleTokens,
  collectSourceFiles,
  loweredHookStates,
} from '../src/services/prototype-style-tokens';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PROTOTYPE_PACKAGES = path.join(REPO_ROOT, 'packages/prototypes');

/**
 * The same file set the extractor reads, taken from the extractor itself. A
 * private glob here would be free to be narrower than production, which is the
 * blind spot this gate exists to remove.
 */
async function prototypeSourceFiles(): Promise<string[]> {
  const packages = await readdir(PROTOTYPE_PACKAGES, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of packages) {
    if (!entry.isDirectory()) continue;
    const src = path.join(PROTOTYPE_PACKAGES, entry.name, 'src');
    try {
      files.push(...((await collectSourceFiles(src)) as string[]));
    } catch (error) {
      // A package without a src directory contributes nothing. Any other
      // traversal failure would silently drop a whole package from the gate.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return files;
}

/**
 * A `rule` call's callee is named `rule`, so a file whose text lacks that word
 * cannot contain one however the call is punctuated — `def.rule?.({})` and
 * `def.rule /* note *\/ ({})` both keep it. Matching the word rather than the
 * call shape keeps the scanned set identical to production while not building a
 * TypeScript AST for every type and index module under `src`.
 */
const RULE_CALL = /\brule\b/;

/** A real intent: the variant is a prefix on tokens, so a stub yields nothing. */
const rule = (condition: string) =>
  `def.rule({ when: (w) => ${condition}, intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

/**
 * What the normalized attribute has to satisfy: `data-<attribute>` is writable
 * and `[data-<attribute>]` selects it. A leading digit satisfies both, so an
 * identifier rule here would add a naming restriction no contract states.
 */
const SELECTABLE_ATTRIBUTE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('lowered hook coverage', () => {
  it('follows every binding shape a prototype uses to reach a state handle', () => {
    const shapes = {
      destructured: `const { checked } = asCheckboxRoot().stateHandles;\n${rule('w.state(checked).eq(true)')}`,
      viaBag: `const s = asSelectTrigger().stateHandles;\nconst { placeholder } = s;\n${rule('w.state(placeholder).eq(true)')}`,
      viaHookResult: `const h = asTextareaRoot();\nconst s = h.stateHandles;\n${rule('w.state(s.focusVisible).eq(true)')}`,
      chained: `const checked = asCheckboxRoot().stateHandles.checked;\n${rule('w.state(checked).eq(true)')}`,
    };

    expect(scanRuleStateReads(shapes.destructured).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);
    expect(scanRuleStateReads(shapes.viaBag).usages).toEqual([
      { hook: 'asSelectTrigger', state: 'placeholder' },
    ]);
    expect(scanRuleStateReads(shapes.viaHookResult).usages).toEqual([
      { hook: 'asTextareaRoot', state: 'focusVisible' },
    ]);
    expect(scanRuleStateReads(shapes.chained).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);
  });

  it('reports a lowerable read it cannot trace instead of dropping it', () => {
    // A shape the scanner does not model. Before this was first-class, the leaf
    // vanished from the results and the gate stayed green while both the
    // extractor and the scan were blind to the same rule.
    const source = `const handles = pickHandles();\n${rule('w.state(handles.checked).eq(true)')}`;
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'handles.checked', reason: 'subject' }]);
  });

  it('reads a rule whose when key is quoted', () => {
    // The extractor resolves this key through `getPropertyName`, so a quoted
    // rule still lowers. A scanner that skipped it would leave the rule out of
    // both results and keep the gate green on a missing hook entry.
    const quoted = `const { checked } = asCheckboxRoot().stateHandles;\ndef.rule({ 'when': (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

    expect(scanRuleStateReads(quoted).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);
    expect(scanRuleStateReads(quoted).unresolved).toEqual([]);
  });

  it('lowers a state reached through a non-null assertion end to end', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          // `stateHandles` is optional on the hook result, so this is how an
          // author reaches it without a guard.
          '    const state = asCheckboxRoot().stateHandles!;',
          '    def.rule({',
          '      when: (w) => w.state(state.checked).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      expect(await collectProtoStyleTokens(dir)).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lowers a non-null asserted state argument end to end', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          '    const { checked } = asCheckboxRoot().stateHandles;',
          '    def.rule({',
          // The scanner unwraps this; the resolver had to learn to as well.
          '      when: (w) => w.state(checked!).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      expect(await collectProtoStyleTokens(dir)).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports a comparison the extractor does not lower', () => {
    // `resolveStateEqVariant` lowers the two boolean keywords and a string
    // literal. A number or a bound identifier produces no variant, so counting
    // these as covered would hide exactly the rules that emit nothing.
    const identifierOnly = `const { checked } = asCheckboxRoot().stateHandles;\n${rule('w.state(checked).eq(ENABLED)')}`;

    const enumString = `const { orientation } = asSeparatorRoot().stateHandles;\n${rule("w.state(orientation).eq('vertical')")}`;

    expect(scanRuleStateReads(identifierOnly).usages).toEqual([]);
    expect(scanRuleStateReads(identifierOnly).unresolved).toEqual([
      { expression: 'w.state(checked).eq(ENABLED)', reason: 'comparison' },
    ]);

    // A numeric literal does lower, for `number.discrete` bindings.
    const numeric = `const { step } = asSelectItem().stateHandles;\n${rule('w.state(step).eq(1)')}`;
    expect(scanRuleStateReads(numeric).unresolved).toEqual([]);
    // The string form the extractor does lower stays covered.
    expect(scanRuleStateReads(enumString).usages).toEqual([
      { hook: 'asSeparatorRoot', state: 'orientation' },
    ]);
    expect(scanRuleStateReads(enumString).unresolved).toEqual([]);
  });

  it('keeps each scope its own hook identity when a name is shadowed', () => {
    // The outer rule must stay asCheckboxRoot even though an inner block binds
    // the same identifier to a different hook.
    const nested = [
      'const state = asCheckboxRoot().stateHandles;',
      '{',
      '  const state = asSelectTrigger().stateHandles;',
      `  ${rule('w.state(state.placeholder).eq(true)')}`,
      '}',
      rule('w.state(state.checked).eq(true)'),
    ].join('\n');

    expect(scanRuleStateReads(nested).usages).toEqual([
      { hook: 'asSelectTrigger', state: 'placeholder' },
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);

    // Sibling scopes must not leak into one another either.
    const siblings = [
      'function a() {',
      '  const state = asCheckboxRoot().stateHandles;',
      `  ${rule('w.state(state.checked).eq(true)')}`,
      '}',
      'function b() {',
      '  const state = asToggle().stateHandles;',
      `  ${rule('w.state(state.active).eq(true)')}`,
      '}',
    ].join('\n');

    expect(scanRuleStateReads(siblings).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
      { hook: 'asToggle', state: 'active' },
    ]);
  });

  it('reports an exposed prototype-owned state instead of skipping it', () => {
    // Exposing the state is what gives it a host attribute, so the Web runtime
    // lowers rules on it. Skipping the read would leave the gate green while
    // the extractor had no selector to emit.
    const source = [
      "const hidden = def.state.bool('hidden', true);",
      "def.expose.state('hidden', hidden);",
      "def.rule({ when: (w) => w.state(hidden).eq(true), intent: (i) => i.feedback.style.use(tw('hidden')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'hidden', exposedAs: 'hidden', attribute: 'hidden' },
    ]);
  });

  it('keeps sibling scopes from sharing an exposure', () => {
    // A file-wide map would attribute the first exposure to the second handle.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function first(def) {',
      "  const flag = def.state.bool('firstFlag', false);",
      '  const publicFlag = flag;',
      "  def.expose.state('a', publicFlag);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
      'function second(def) {',
      "  const other = def.state.bool('secondFlag', false);",
      '  const publicFlag = other;',
      "  def.expose.state('b', publicFlag);",
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'a', attribute: 'first-flag' },
    ]);
  });

  it('resolves each alias hop where that hop was created', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'var current = first;',
      'const publicFlag = current;',
      'var current = second;',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('follows an alias reassigned before the exposure', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let publicFlag = first;',
      'publicFlag = second;',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('sees an alias reassigned inside a nested block', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let publicFlag = first;',
      '{',
      '  publicFlag = second;',
      '}',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it("does not let one prototype's exposure reach a sibling's same-named state", () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function exposedSetup(def) {',
      "  const flag = def.state.bool('firstFlag', false);",
      "  def.expose.state('visible', flag);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
      'function internalSetup(def) {',
      "  const flag = def.state.bool('secondFlag', false);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    // Only the exposed one; the sibling's rule stays on the runtime plan.
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('accepts a constant-backed declared name the extractor resolves', () => {
    // Production resolves this constant, so reporting it unresolved would fail
    // the gate on code the extractor handles correctly.
    const source = [
      "const name = 'hidden';",
      'const flag = def.state.bool(name, false);',
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('hidden')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'hidden' },
    ]);
  });

  it('maps an official semantic before normalizing the name', () => {
    const source = [
      "const flag = def.state.bool('@accessibility/checked', false);",
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');

    expect(scanRuleStateReads(source).exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'checked' },
    ]);
  });

  it('follows a handle written into the container before the exposure', () => {
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'controls.ready = second;',
      "def.expose.state('visible', controls.ready);",
      "def.rule({ when: (w) => w.state(second).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('leaves a member write after the exposure out of it', () => {
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      "def.expose.state('visible', controls.ready);",
      'controls.ready = second;',
      "def.rule({ when: (w) => w.state(first).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('normalizes a state named after an inherited object key', () => {
    // The official-name table is a plain object literal, so `constructor` must
    // not resolve to the function it inherits.
    const source = [
      "const flag = def.state.bool('constructor', false);",
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');

    expect(scanRuleStateReads(source).exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'constructor' },
    ]);
  });

  it('keeps a plain alias of an exposed local resolvable', () => {
    // Production resolves the alias, so a token binding here would report a
    // blind spot the extractor does not have.
    const source = [
      "const hidden = def.state.bool('hidden', true);",
      "def.expose.state('hidden', hidden);",
      'const alias = hidden;',
      "def.rule({ when: (w) => w.state(alias).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'alias', exposedAs: 'hidden', attribute: 'hidden' },
    ]);
  });

  it('replaces the member table when a whole container is assigned', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let controls = { ready: first };',
      'controls = { ready: second };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('gives both branches of a conditional member write an attribute', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'controls.ready = enabled ? first : second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('reads a member at the position it was written', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'const controls = { ready: current };',
      'current = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('keeps the earlier handle when a write may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'if (enabled) current = second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('hoists a nested var redeclaration the rule reads', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function setup(def) {',
      "  const first = def.state.bool('firstFlag', false);",
      "  const second = def.state.bool('secondFlag', false);",
      '  var current = first;',
      '  {',
      '    var current = second;',
      '  }',
      "  def.expose.state('visible', current);",
      `  def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('accepts an element-access state declaration the extractor reads', () => {
    // Production resolves `def.state['bool'](…)`, so reporting it unresolved
    // would fail the gate on code the extractor handles correctly.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state['bool']('internalFlag', false);",
      "def.expose.state('visible', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('admits every attribute the Web projection can actually write', () => {
    // The repository tree carries no digit-leading state, so the gate's own
    // predicate is asserted here rather than only through the shipped scan.
    for (const attribute of ['1st', 'hidden', 'focus-visible', 'a1', '2-of-3']) {
      expect(SELECTABLE_ATTRIBUTE.test(attribute), attribute).toBe(true);
      expect(createExposeStateWebNameMap(attribute).dataAttr, attribute).toBe(`data-${attribute}`);
    }
    for (const attribute of ['', '-leading', 'trailing-', 'double--hyphen', 'Upper', 'has space']) {
      expect(SELECTABLE_ATTRIBUTE.test(attribute), attribute).toBe(false);
    }
  });

  it('accepts an attribute that starts with a digit', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('1st', false);",
      "def.expose.state('1st', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([{ state: 'flag', exposedAs: '1st', attribute: '1st' }]);
  });

  it('reports every state a skippable alias may reach', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'if (enabled) current = second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
      { state: 'current', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('reads a state handle held in a plain container', () => {
    // Production resolves the member, so reporting it unresolved would fail the
    // gate on code the extractor lowers correctly.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('internalFlag', false);",
      'const controls = { ready: flag };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('reads a destructured handle the rule uses by its alias', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, container] of [
      ['object literal', 'const { ready: publicFlag } = { ready: flag };'],
      ['array literal', 'const [publicFlag] = [flag];'],
      [
        'container variable',
        'const controls = { ready: flag };\nconst { ready: publicFlag } = controls;',
      ],
    ] as const) {
      const source = [
        "const flag = def.state.bool('internalFlag', false);",
        container,
        "def.expose.state('visible', publicFlag);",
        `def.rule({ when: (w) => w.state(publicFlag).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals, label).toEqual([
        { state: 'publicFlag', exposedAs: 'visible', attribute: 'internal-flag' },
      ]);
    }
  });

  it('reports both branches of a conditional alias', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const current = enabled ? first : second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'first-flag' },
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('resolves an alias target where the alias was written', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function setup(def) {',
      "  const flag = def.state.bool('outerFlag', false);",
      '  const current = flag;',
      '  {',
      "    const flag = def.state.bool('innerFlag', false);",
      '    void flag;',
      "    def.expose.state('visible', current);",
      '  }',
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'outer-flag' },
    ]);
  });

  it('reads a container member the rule uses after a write', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, write, read] of [
      ['property access', 'controls.ready = second;', 'controls.ready'],
      ['element access', "controls['ready'] = second;", "controls['ready']"],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'const controls = { ready: first };',
        write,
        `def.expose.state('visible', ${read});`,
        `def.rule({ when: (w) => w.state(${read}).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals, label).toEqual([
        { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
      ]);
    }
  });

  it('keeps the earlier member when the write may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'if (enabled) controls.ready = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('follows a member written through an alias of the container', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'const alias = controls;',
      'alias.ready = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('keeps both members when the alias write may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'const alias = controls;',
      'if (enabled) alias.ready = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('keeps the earlier handle when the write is inside a callback', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let flag = first;',
      "def.on('refresh', () => { flag = second; });",
      "def.expose.state('visible', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('treats an immediately invoked write as ordered', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let flag = first;',
      '(() => { flag = second; })();',
      "def.expose.state('visible', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('accepts an intent reading a container that also holds a handle', () => {
    // The extractor emits `bg-red` and `data-[internal-flag]:bg-red` for this,
    // so reporting the intent unresolved reds the gate on working code.
    const source = [
      "const flag = def.state.bool('internalFlag', false);",
      "def.expose.state('visible', flag);",
      "const controls = { ready: flag, className: 'bg-red' };",
      'def.rule({',
      '  when: (w) => w.state(controls.ready).eq(true),',
      "  intent: (i) => i.feedback.style.use(tw(controls['className'])),",
      '});',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('keeps the earlier handle across an async or generator IIFE', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, iife] of [
      ['async', '(async () => { await 0; current = second; })();'],
      ['generator', '(function* () { current = second; })();'],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'let current = first;',
        iife,
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
      ]);
    }
  });

  it('keeps the earlier handle when an IIFE may not reach the write', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, iife] of [
      ['early return', '(() => { return; current = second; })();'],
      ['early throw', "(() => { throw new Error('x'); current = second; })();"],
      ['conditional return', '(() => { if (enabled) return; current = second; })();'],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'let current = first;',
        iife,
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
      ]);
    }
  });

  it('keeps the earlier member across a callback, two objects, or an unreadable key', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, lines, read] of [
      [
        'callback write',
        [
          'const controls = { ready: first };',
          "def.on('refresh', () => { controls.ready = second; });",
        ],
        'controls.ready',
      ],
      [
        'either of two objects',
        [
          'const controlsA = { ready: first };',
          'const controlsB = { ready: first };',
          'const alias = enabled ? controlsA : controlsB;',
          'alias.ready = second;',
        ],
        'controlsA.ready',
      ],
      [
        'unreadable key',
        ['const controls = { ready: first };', "const key = 'ready';", 'controls[key] = second;'],
        'controls.ready',
      ],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        ...lines,
        `def.expose.state('visible', ${read});`,
        `def.rule({ when: (w) => w.state(${read}).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
      ]);
    }
  });

  it('measures a member write against the container, not the alias', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, block, expected] of [
      [
        'alias inside a callback',
        "def.on('refresh', () => { const alias = controls; alias.ready = second; });",
        ['first-flag', 'second-flag'],
      ],
      [
        'alias in a plain block',
        '{ const alias = controls; alias.ready = second; }',
        ['second-flag'],
      ],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'const controls = { ready: first };',
        block,
        "def.expose.state('visible', controls.ready);",
        `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        ...expected,
      ]);
    }
  });

  it('keeps the replaced container when the replacement may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let controls = { ready: first };',
      'if (enabled) controls = { ready: second };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('reads both containers a conditional replacement may install', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'let controls = { ready: first };',
      'controls = enabled ? { ready: second } : { ready: third };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'second-flag',
      'third-flag',
    ]);
  });

  it('reaches every leaf of a nested conditional replacement', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'let controls = a ? (b ? { ready: first } : { ready: second }) : { ready: third };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
      'third-flag',
    ]);
  });

  it('keeps the literal branch of a mixed conditional replacement', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'const otherControls = { ready: third };',
      'let controls = { ready: first };',
      'controls = enabled ? { ready: second } : otherControls;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'second-flag',
      'third-flag',
    ]);
  });

  it('records every candidate when a member write meets a skippable replacement', () => {
    // Whichever order they are written in, the gate has to record the same set
    // the extractor emits, or it certifies an incomplete one.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, lines, expected] of [
      [
        'write after replace',
        [
          'let controls = { ready: first };',
          'if (enabled) controls = { ready: second };',
          'if (other) controls.ready = third;',
        ],
        ['first-flag', 'second-flag', 'third-flag'],
      ],
      [
        'write before replace',
        [
          'let controls = { ready: first };',
          'controls.ready = third;',
          'if (enabled) controls = { ready: second };',
        ],
        ['second-flag', 'third-flag'],
      ],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        "const third = def.state.bool('thirdFlag', false);",
        ...lines,
        "def.expose.state('visible', controls.ready);",
        `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        ...expected,
      ]);
    }
  });

  it('refuses to certify a container with an unresolvable branch', () => {
    // `enabled ? { … } : makeControls()` can leave the member on a handle this
    // never sees. Certifying the branch it does see would vouch for a set the
    // runtime can step outside of, so the shape has to go unresolved instead.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'const makeControls = () => ({ ready: third });',
      'let controls = { ready: second };',
      'controls = enabled ? { ready: second } : makeControls();',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['subject']);
  });

  it('reports every leaf of a nested local-state conditional', () => {
    // The gate is the oracle for the extractor, so a blind spot here would let
    // a future extractor regression on this shape through unnoticed.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, initializer] of [
      ['nested on the left', 'a ? (b ? first : second) : third'],
      ['nested on the right', 'a ? first : (b ? second : third)'],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        "const third = def.state.bool('thirdFlag', false);",
        `const current = ${initializer};`,
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
        'third-flag',
      ]);
    }

    // The ordinary two-branch merge is unchanged.
    const flat = scanRuleStateReads(
      [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'const current = a ? first : second;',
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n')
    );
    expect(flat.unresolved).toEqual([]);
    expect(flat.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('reports an exposed state whose declared name it cannot read', () => {
    // The extractor emits nothing for this, so certifying the expose key would
    // be the fail-closed mismatch this gate exists to prevent.
    const source = [
      'const flag = def.state.bool(makeStateName(), false);',
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.exposedLocals).toEqual([]);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['subject']);
  });

  it('treats a prototype-owned state as neither a hook pair nor a blind spot', () => {
    // Base prototypes declare their own states and key rules on them. Those need
    // no resolver entry, so they must not be reported as a hook pair, and they
    // must not trip the fail-closed check either.
    const source = `const hidden = def.state.bool('hidden', true);\n${rule('w.state(hidden).eq(true)')}`;
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([]);
  });

  it('reports a rule whose intent hands over a pre-bound token handle', () => {
    // `collectTwTokens` reads a `tw(...)` call. A handle bound elsewhere leaves
    // the closure nothing to prefix, so the rendered variant has no CSS even
    // though the condition itself lowers.
    const source = [
      "const muted = tw('text-muted-foreground');",
      'const { checked } = asCheckboxRoot().stateHandles;',
      'def.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(muted) });',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('reports a rule handed a binding instead of an object literal', () => {
    // The runtime lowers this; the extractor reads object literals only. Before
    // it was reported, the invocation was skipped and left no trace either way.
    const source = [
      "const spec = { when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) };",
      'def.rule(spec);',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['spec']);
  });

  it('reports rule shapes neither analyzer reads', () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const body = '(w) => w.state(checked).eq(true)';
    const use = "(i) => i.feedback.style.use(tw('bg-primary'))";

    // Valid specs the runtime calls normally. Both the extractor and this
    // scanner read plain property assignments, so silence would be fail-open.
    const shorthand = `${handles}\nconst when = ${body};\nconst intent = ${use};\ndef.rule({ when, intent });`;
    const method = `${handles}\ndef.rule({ when: ${body}, intent(i) { return i.feedback.style.use(tw('bg-primary')); } });`;

    for (const source of [shorthand, method]) {
      expect(scanRuleStateReads(source).usages).toEqual([]);
      expect(scanRuleStateReads(source).unresolved.map((miss) => miss.reason)).toEqual(['spec']);
    }

    // An aliased builder member: the runtime records the dependency, the
    // extractor's selector analysis reads a property access and emits nothing.
    const aliased = `${handles}\ndef.rule({ when: ({ state }) => state(checked).eq(true), intent: ${use} });`;
    expect(scanRuleStateReads(aliased).usages).toEqual([]);
    expect(scanRuleStateReads(aliased).unresolved.map((miss) => miss.reason)).toEqual([
      'condition',
    ]);

    // A `tw(...)` the extractor cannot resolve yields no token for the variant
    // to prefix, so the rendered selector would have no CSS.
    const opaque = `${handles}\ndef.rule({ when: ${body}, intent: (i) => i.feedback.style.use(tw(getRuleTokens())) });`;
    expect(scanRuleStateReads(opaque).usages).toEqual([]);
    expect(scanRuleStateReads(opaque).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('requires every intent token handle to be one the extractor can resolve', async () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const usage = { hook: 'asCheckboxRoot', state: 'checked' };

    // Resolvable: a local constant.
    const local = `const TOKENS = 'bg-primary';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS)) });`;
    expect(scanRuleStateReads(local).usages).toEqual([usage]);
    expect(scanRuleStateReads(local).unresolved).toEqual([]);

    // A relative import is judged by the module's own initializer, the way the
    // extractor loads it — not by the fact that the specifier was relative.
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      const widget = path.join(dir, 'widget.proto.ts');
      const body = (name: string) =>
        `import { ${name} } from './style';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(${name})) });`;
      await writeFile(
        path.join(dir, 'style.ts'),
        [
          "export const LITERAL_TOKENS = 'bg-primary';",
          'export const COMPUTED_TOKENS = getTokens();',
        ].join('\n')
      );

      const literal = scanRuleStateReads(body('LITERAL_TOKENS'), widget);
      expect(literal.usages).toEqual([usage]);
      expect(literal.unresolved).toEqual([]);

      // The extractor loads this module and resolves the call to nothing, so
      // accepting it because the import was relative would be fail-open.
      const computed = scanRuleStateReads(body('COMPUTED_TOKENS'), widget);
      expect(computed.usages).toEqual([]);
      expect(computed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // `applyImportBindings` skips non-relative specifiers entirely.
    const packaged = `import { TOKENS } from '@proto.ui/tokens';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS)) });`;
    expect(scanRuleStateReads(packaged).usages).toEqual([]);
    expect(scanRuleStateReads(packaged).unresolved.map((miss) => miss.reason)).toEqual(['intent']);

    // `tw` is variadic and the extractor reads every argument, so one
    // resolvable argument cannot vouch for the rest of the same call.
    const variadic = `${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw('bg-ok', getRuleTokens())) });`;
    expect(scanRuleStateReads(variadic).usages).toEqual([]);
    expect(scanRuleStateReads(variadic).unresolved.map((miss) => miss.reason)).toEqual(['intent']);

    // A mixed intent: the extractable handle must not vouch for the opaque one,
    // because the runtime prefixes both and only one gets CSS.
    const mixed = `${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw('bg-ok'), tw(getRuleTokens())) });`;
    expect(scanRuleStateReads(mixed).usages).toEqual([]);
    expect(scanRuleStateReads(mixed).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('ignores an unrelated call in a block-bodied condition', () => {
    // The runtime dependency set holds the builder operations invoked, so an
    // unrelated call does not make the rule dynamic — and must not let the
    // state read escape the gate unchecked.
    const source = [
      'const { checked } = asCheckboxRoot().stateHandles;',
      'def.rule({',
      '  when: (w) => { metrics.record(); return w.state(checked).eq(true); },',
      "  intent: (i) => i.feedback.style.use(tw('bg-primary')),",
      '});',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.usages).toEqual([{ hook: 'asCheckboxRoot', state: 'checked' }]);
  });

  it('follows a handle bound by a loop initializer', () => {
    // Production registers a loop initializer in the loop's own scope, so
    // reporting this would be a blind spot the extractor does not have.
    const source = [
      'for (const state = asCheckboxRoot().stateHandles; once; )',
      "  def.rule({ when: (w) => w.state(state.checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.usages).toEqual([{ hook: 'asCheckboxRoot', state: 'checked' }]);
  });

  it('binds a loop initializer inside the loop, not over the outer name', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('outerFlag', false);",
      "for (let flag = def.state.bool('innerFlag', false); once; ) {",
      "  def.expose.state('visible', flag);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'inner-flag' },
    ]);
  });

  it('follows a reassigned alias the rule itself reads', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'current = second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('follows a handle aliased through a binding pattern', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('internalFlag', false);",
      'const { ready: publicFlag } = { ready: flag };',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('reports a condition only one branch of which reaches the runtime', () => {
    // The runtime lowers the selected branch; a source walk sees both and the
    // extractor combines them into a selector nothing matches.
    const source = [
      'const { checked, indeterminate } = asCheckboxRoot().stateHandles;',
      "def.rule({ when: (w) => (choose ? w.state(checked).eq(true) : w.state(indeterminate).eq(true)), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['condition']);
  });

  it('keeps a name declared in two disjoint scopes resolvable in each', () => {
    // A file-wide map called this ambiguous and blocked both rules. The
    // extractor gives each scope its own binding.
    const source = [
      'function a() {',
      "  const TOKENS = 'bg-a';",
      '  const { checked } = asCheckboxRoot().stateHandles;',
      '  def.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw(TOKENS)) });',
      '}',
      'function b() {',
      "  const TOKENS = 'bg-b';",
      '  const { indeterminate } = asCheckboxRoot().stateHandles;',
      '  def.rule({ when: (w) => w.state(indeterminate).eq(true), intent: (i) => i.feedback.style.use(tw(TOKENS)) });',
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
      { hook: 'asCheckboxRoot', state: 'indeterminate' },
    ]);
  });

  it('follows a token through a chain of relative modules and stops at a bound separator', async () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const usage = { hook: 'asCheckboxRoot', state: 'checked' };
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));

    try {
      const widget = path.join(dir, 'widget.proto.ts');
      // `loadModuleBindings` applies a module's own relative imports before
      // resolving its exports, so this chain is extractable in production.
      await writeFile(path.join(dir, 'base.ts'), "export const BASE = 'bg-primary';");
      await writeFile(
        path.join(dir, 'style.ts'),
        ["import { BASE } from './base';", 'export const TOKENS = BASE;'].join('\n')
      );

      const chained = `import { TOKENS } from './style';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS)) });`;
      const scan = scanRuleStateReads(chained, widget);
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages).toEqual([usage]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // `resolveJoinCall` reads a literal separator and otherwise falls back to
    // `,`, while the runtime joins on the real value — so the two disagree.
    const literalSeparator = `${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(['bg-a', 'text-b'].join(' '))) });`;
    expect(scanRuleStateReads(literalSeparator).usages).toEqual([usage]);

    const boundSeparator = `const SEP = ' ';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(['bg-a', 'text-b'].join(SEP))) });`;
    expect(scanRuleStateReads(boundSeparator).usages).toEqual([]);
    expect(scanRuleStateReads(boundSeparator).unresolved.map((miss) => miss.reason)).toEqual([
      'intent',
    ]);
  });

  it('reports a rule reached through element access', () => {
    // The production walk matches a property access, so this reaches the same
    // runtime API and emits no variant.
    const source = [
      'const { checked } = asCheckboxRoot().stateHandles;',
      "def['rule']({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['spec']);
  });

  it('lets a parameter shadow an outer state handle', () => {
    // Falling through to the outer binding would approve `data-[checked]` for a
    // rule the runtime compiles against something else entirely.
    const source = [
      'const { checked } = asCheckboxRoot().stateHandles;',
      'const { open } = asSelectContent().stateHandles;',
      'function add(checked = open) {',
      "  def.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['subject']);
  });

  it('reads a token map only the way the extractor can', () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const map = "const TOKENS = { active: 'bg-primary' };";
    const usage = { hook: 'asCheckboxRoot', state: 'checked' };

    // `resolveExpression` reads a token object through element access; dot
    // access resolves through `semanticMap`, which holds state handles.
    const element = `${map}\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS['active'])) });`;
    expect(scanRuleStateReads(element).usages).toEqual([usage]);

    const dotted = `${map}\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS.active)) });`;
    expect(scanRuleStateReads(dotted).usages).toEqual([]);
    expect(scanRuleStateReads(dotted).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('does not let an unrelated tw call vouch for a pre-bound handle', () => {
    // The variant prefixes what `feedback.style.use` receives. A `tw(...)`
    // elsewhere in the intent has nothing to do with it.
    const source = [
      "const muted = tw('text-muted-foreground');",
      'const { checked } = asCheckboxRoot().stateHandles;',
      'def.rule({',
      '  when: (w) => w.state(checked).eq(true),',
      "  intent: (i) => { i.feedback.style.use(muted); tw('bg-dummy'); },",
      '});',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('reports a condition whose operator picks one operand', () => {
    // `&&` returns the second expression, so the runtime lowers `data-[b]` while
    // a source walk sees both and the extractor combines them.
    const handles = 'const { checked, indeterminate } = asCheckboxRoot().stateHandles;';
    const use = "(i) => i.feedback.style.use(tw('bg-primary'))";
    for (const operator of ['&&', '||', '??']) {
      const source = `${handles}\ndef.rule({ when: (w) => w.state(checked).eq(true) ${operator} w.state(indeterminate).eq(true), intent: ${use} });`;
      const scan = scanRuleStateReads(source);
      expect(scan.usages, operator).toEqual([]);
      expect(
        scan.unresolved.map((miss) => miss.reason),
        operator
      ).toEqual(['condition']);
    }
  });

  it('reports a condition a helper call contributes to', () => {
    // The runtime executes `other(w)` and lowers whatever it returns; a source
    // walk sees only what is written here, and so does the extractor.
    const handles = 'const { checked, indeterminate } = asCheckboxRoot().stateHandles;';
    const use = "(i) => i.feedback.style.use(tw('bg-primary'))";
    const helper = `const other = (w) => w.state(indeterminate).eq(true);`;

    const nested = `${helper}\n${handles}\ndef.rule({ when: (w) => w.all(w.state(checked).eq(true), other(w)), intent: ${use} });`;
    expect(scanRuleStateReads(nested).usages).toEqual([]);
    expect(scanRuleStateReads(nested).unresolved.map((miss) => miss.reason)).toEqual(['condition']);

    const whole = `${helper}\n${handles}\ndef.rule({ when: (w) => other(w), intent: ${use} });`;
    expect(scanRuleStateReads(whole).usages).toEqual([]);
    expect(scanRuleStateReads(whole).unresolved.map((miss) => miss.reason)).toEqual(['condition']);
  });

  it('requires each template substitution to carry one value', () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const use = (arg: string) => `(i) => i.feedback.style.use(tw(${arg}))`;

    // `resolveExpression` needs a single value per substitution.
    const single = `const shade = 'primary';\n${handles}\ndef.rule({ when: ${when}, intent: ${use('`bg-${shade}`')} });`;
    expect(scanRuleStateReads(single).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);

    // A conditional resolves to several strings, so the extractor drops the
    // template while the runtime receives one concrete token.
    const branched = `const shade = flag ? 'primary' : 'secondary';\n${handles}\ndef.rule({ when: ${when}, intent: ${use('`bg-${shade}`')} });`;
    expect(scanRuleStateReads(branched).usages).toEqual([]);
    expect(scanRuleStateReads(branched).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('skips rules the runtime keeps on the runtime plan', () => {
    const withProp = `const s = asSelectContent().stateHandles;\n${rule("w.all(w.state(s.open).eq(true), w.prop('side').eq('top'))")}`;
    // `isStateMetaDeps` refuses every dependency kind but state and meta, so a
    // context dependency keeps the rule on the runtime plan exactly like a prop.
    const withContext = `const s = asSelectContent().stateHandles;\n${rule("w.all(w.state(s.open).eq(true), w.ctx(SIDE).eq('top'))")}`;
    // `extractConditions` lowers `colorScheme === 'dark'` and no other meta
    // pair, so this one stays on the runtime plan and needs no mapping.
    const otherMeta = `const s = asSelectContent().stateHandles;\n${rule("w.all(w.state(s.open).eq(true), w.meta('colorScheme').eq('light'))")}`;
    // The runtime abandons lowering at the first op that is not a style use.
    const mixedIntent = `const s = asSelectContent().stateHandles;\nconst local = def.state.bool('local', false);\ndef.rule({ when: (w) => w.state(s.open).eq(true), intent: (i) => { i.feedback.style.use(tw('bg-primary')); i.state(local).be(true); } });`;
    const allNegative = `const s = asSelectContent().stateHandles;\n${rule('w.state(s.open).eq(false)')}`;
    const anyCondition = `const s = asSelectItem().stateHandles;\n${rule('w.any(w.state(s.active).eq(true), w.state(s.hovered).eq(true))')}`;

    for (const source of [
      withProp,
      withContext,
      otherMeta,
      mixedIntent,
      allNegative,
      anyCondition,
    ]) {
      const scan = scanRuleStateReads(source);
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([]);
    }
  });

  it('scans every source extension the extractor accepts', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      // Not `.proto.ts`, and not `.ts` at all. The old glob saw neither.
      await writeFile(
        path.join(dir, 'widget.proto.mts'),
        "const { checked } = asCheckboxRoot().stateHandles;\ndef.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });\n"
      );
      await writeFile(path.join(dir, 'notes.md'), 'not a source file');

      const files = await collectSourceFiles(dir);
      expect(files.map((file: string) => path.basename(file))).toEqual(['widget.proto.mts']);
      expect(scanRuleStateReads(await readFile(files[0], 'utf8'), files[0]).usages).toEqual([
        { hook: 'asCheckboxRoot', state: 'checked' },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lowers a state bound as a terminal handle leaf end to end', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          '    const checked = asCheckboxRoot().stateHandles.checked;',
          '    def.rule({',
          '      when: (w) => w.state(checked).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      // The gate calls this shape covered; the extractor has to agree.
      expect(await collectProtoStyleTokens(dir)).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves every hook state a shipped rule condition reads', async () => {
    const found: Array<{ file: string; hook: string; state: string }> = [];
    const blind: string[] = [];
    const exposed: Array<{ file: string; state: string; exposedAs: string; attribute: string }> =
      [];

    let scanned = 0;
    for (const absolute of await prototypeSourceFiles()) {
      const file = path.relative(REPO_ROOT, absolute);
      const text = await readFile(absolute, 'utf8');
      if (!RULE_CALL.test(text)) continue;
      scanned += 1;
      const scan = scanRuleStateReads(text, file);
      for (const usage of scan.usages) found.push({ file, ...usage });
      for (const miss of scan.unresolved) blind.push(`${file}: ${miss.reason} ${miss.expression}`);
      for (const local of scan.exposedLocals) exposed.push({ file, ...local });
    }

    expect(scanned, 'files carrying a rule call').toBeGreaterThan(40);

    // Every exposed prototype-owned state a rule reads has to name an attribute
    // the extractor can emit, or the runtime lowers a variant with no CSS.
    // `C-EXPOSE-0004-A` admits any non-empty key, and both analyzers normalize
    // it, so the normalized attribute is what has to be usable — not the key.
    expect(
      exposed.filter(({ attribute }) => !SELECTABLE_ATTRIBUTE.test(attribute)),
      'exposed states whose attribute cannot be written as a data selector'
    ).toEqual([]);
    expect(exposed.length, 'exposed prototype-owned states read by a rule').toBeGreaterThan(0);

    expect(found.length).toBeGreaterThan(30);
    // The two-step shape must be reached in the shipped tree, not just fixtures.
    expect(found).toContainEqual({
      file: 'packages/prototypes/brutalist/src/textarea/root.proto.ts',
      hook: 'asTextareaRoot',
      state: 'focusVisible',
    });

    // Fail closed: a shape the scanner cannot trace is a gate failure.
    expect(blind, 'lowerable rule states the scanner could not trace').toEqual([]);

    const missing = found.filter(({ hook, state }) => {
      const states = loweredHookStates(hook);
      return !states || !states.has(state);
    });

    expect(
      missing.map(({ file, hook, state }) => `${file}: ${hook}().${state}`),
      'rule conditions whose hook state the extractor cannot lower'
    ).toEqual([]);

    // A string comparison only lowers against a `data-[x]` variant. Every table
    // entry is one today; if that stops being true, the scanner's string form
    // would start counting rules the extractor drops.
    const unshaped = found.filter(({ hook, state }) => {
      const variant = loweredHookStates(hook)?.get(state) as string | undefined;
      return !variant || !/^data-\[[a-zA-Z0-9-]+\]$/.test(variant);
    });

    expect(
      unshaped.map(({ hook, state }) => `${hook}().${state}`),
      'hook states whose variant a string comparison could not lower'
    ).toEqual([]);
  }, 60_000);
});
