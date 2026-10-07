// @vitest-environment node
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CompilerRejection } from '../src/diagnostics';
import type { DataType } from '../src/data-types';
import type { CompileResult } from '../src/ir';
import { SourceGraph } from '../src/parser-module';
import {
  extractRuleDeclaration, extractRuleStyleHandle,
  type RuleDeclarationContext, type RuleDeclarationIR,
} from '../src/rule-declarations';
import { evaluateRulePlan, lowerRulePlan, type RulePlan } from '../src/rule-plan';
import { evaluateStylePlan, type StyleContribution, type StyleTokenHandle } from '../src/style-plan';

const styles: Record<string, StyleTokenHandle> = {
  base: { kind: 'tw', tokens: ['bg-blue', 'text-white'] },
  pressedStyle: { kind: 'tw', tokens: ['bg-red', 'text-black'] },
  hidden: { kind: 'tw', tokens: ['hidden'] },
};
const props = new Map<string, DataType>([
  ['enabled', 'boolean'], ['blocked', 'boolean'],
  ['tone', { kind: 'union', members: [{ kind: 'literal', value: 'solid' }, { kind: 'literal', value: 'outline' }] }],
  ['count', 'number'], ['nullable', { kind: 'union', members: ['string', 'null'] }],
  ['constructor', 'boolean'],
]);

function rule(source: string, id = 1, order = id - 1, overrides: Partial<RuleDeclarationContext> = {}): RuleDeclarationIR {
  const file = ts.createSourceFile('rule.proto.ts', `const RULE = ${source};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = file.statements[0] as ts.VariableStatement;
  const object = statement.declarationList.declarations[0].initializer as ts.ObjectLiteralExpression;
  return extractRuleDeclaration(object, {
    id, order, props,
    resolveState(expression) {
      if (!ts.isIdentifier(expression) || !['checked', 'pressed'].includes(expression.text)) return undefined;
      return { id: `state:${expression.text}`, type: 'boolean' };
    },
    resolveStyle(expression) {
      return ts.isIdentifier(expression) && Object.hasOwn(styles, expression.text) ? styles[expression.text] : undefined;
    },
    ...overrides,
  });
}

function successful<T>(result: CompileResult<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function plan(...declarations: RuleDeclarationIR[]): RulePlan {
  return successful(lowerRulePlan(declarations));
}

function rejected(source: string, overrides: Partial<RuleDeclarationContext> = {}) {
  try { rule(source, 1, 0, overrides); }
  catch (error) {
    if (error instanceof CompilerRejection) return error.diagnostic;
    throw error;
  }
  throw new Error('Expected a checked static Rule rejection.');
}

function expression(source: string): ts.Expression {
  const file = ts.createSourceFile('consumer.ts', source, ts.ScriptTarget.Latest, true);
  return (file.statements[0] as ts.ExpressionStatement).expression;
}

describe('portable Rule declarations and consumer evaluation', () => {
  it('evaluates core all/any/not semantics from concrete prop and state snapshots', () => {
    const compiled = plan(rule(`{
      when: w => w.all(w.prop('enabled').eq(true), w.any(w.state(checked).eq(true), w.not(w.prop('blocked').eq(true)))),
      intent: i => i.feedback.style.use(hidden)
    }`));
    const inactive = evaluateRulePlan(compiled, { props: { enabled: false, blocked: false }, states: { 'state:checked': true } });
    expect(inactive.style.tokens).toEqual([]);
    const active = evaluateRulePlan(compiled, { props: { enabled: true, blocked: true }, states: { 'state:checked': true } }, inactive);
    expect(active.style.tokens).toEqual(['hidden']);
    expect(active.activatedRuleIds).toEqual([1]);
    const stillActive = evaluateRulePlan(compiled, { props: { enabled: true, blocked: false }, states: { 'state:checked': false } }, active);
    expect(stillActive.style.tokens).toEqual(['hidden']);
    expect(stillActive.activatedRuleIds).toEqual([]);
    const withdrawn = evaluateRulePlan(compiled, { props: { enabled: true, blocked: true }, states: { 'state:checked': false } }, stillActive);
    expect(withdrawn.style.tokens).toEqual([]);
    expect(withdrawn.withdrawnRuleIds).toEqual([1]);
    expect(withdrawn.removedTokens).toEqual(['hidden']);
  });

  it('restores earlier semantic winners when a later active declaration withdraws', () => {
    const earlier = rule('{ when:w=>w.t(), intent:i=>i.feedback.style.use(base) }', 10, 0);
    const later = rule('{ when:w=>w.state(pressed).eq(true), intent:i=>i.feedback.style.use(pressedStyle) }', 20, 1);
    const compiled = plan(later, earlier);
    const pressed = evaluateRulePlan(compiled, { props: {}, states: { 'state:pressed': true } });
    expect(pressed.style.tokens).toEqual(['bg-red', 'text-black']);
    const released = evaluateRulePlan(compiled, { props: {}, states: { 'state:pressed': false } }, pressed);
    expect(released.style.tokens).toEqual(['bg-blue', 'text-white']);
    expect(released.withdrawnRuleIds).toEqual([20]);
    expect(released.removedTokens).toEqual(['bg-red', 'text-black']);
    expect(released.addedTokens).toEqual(['bg-blue', 'text-white']);
  });

  it('combines rule contributions with the shared style consumer and restores its base layer', () => {
    const compiled = plan(rule('{when:w=>w.state(pressed).eq(true),intent:i=>i.feedback.style.use(pressedStyle)}'));
    const base: StyleContribution = {
      id: 'base', scope: 'host', layer: 'base',
      intents: [{ kind: 'feedback.style.use', handles: [styles.base] }],
    };
    const mapping = {
      target: 'example-host',
      tokens: {
        'bg-blue': [{ kind: 'property' as const, name: 'backgroundColor', value: 'blue' }],
        'bg-red': [{ kind: 'property' as const, name: 'backgroundColor', value: 'red' }],
        'text-white': [{ kind: 'property' as const, name: 'color', value: 'white' }],
        'text-black': [{ kind: 'property' as const, name: 'color', value: 'black' }],
      },
    };
    const active = evaluateRulePlan(compiled, { props: {}, states: { 'state:pressed': true } });
    const activeProjection = successful(evaluateStylePlan({ contributions: [base, ...active.stylePlan.contributions] }, mapping));
    expect(activeProjection.entries.map(({ name, value }) => [name, value])).toEqual([
      ['backgroundColor', 'red'], ['color', 'black'],
    ]);
    const withdrawn = evaluateRulePlan(compiled, { props: {}, states: { 'state:pressed': false } }, active);
    const restored = successful(evaluateStylePlan({ contributions: [base, ...withdrawn.stylePlan.contributions] }, mapping));
    expect(restored.entries.map(({ name, value }) => [name, value])).toEqual([
      ['backgroundColor', 'blue'], ['color', 'white'],
    ]);
    // An inactive rule still undergoes target admission, rather than hiding unsupported values.
    const rejectedProjection = evaluateStylePlan(withdrawn.stylePlan, { target: 'unmapped', tokens: {} });
    expect(rejectedProjection.ok).toBe(false);
  });

  it('supports immutable callback aliases and typed primitive comparisons without source execution', () => {
    const compiled = plan(rule(`{
      when(w) {
        const tone = w.prop('tone');
        const solid = tone.eq('solid');
        const enabled = w.prop('enabled').eq(true);
        return w.all(solid, enabled, w.prop('count').eq(-2), w.prop('nullable').eq(null));
      },
      intent(i) { const selected = base; i.feedback.style.use(selected); i.feedback.style.use(hidden); }
    }`));
    const restoredPlan = JSON.parse(JSON.stringify(compiled)) as RulePlan;
    expect(evaluateRulePlan(restoredPlan, {
      props: { tone: 'solid', enabled: true, count: -2, nullable: null }, states: {},
    }).style.tokens).toEqual(['bg-blue', 'text-white', 'hidden']);
    expect(evaluateRulePlan(restoredPlan, {
      props: { tone: 'outline', enabled: true, count: -2, nullable: null }, states: {},
    }).style.tokens).toEqual([]);
  });

  it('preserves the empty all/any identities of existing WhenBuilder semantics', () => {
    const compiled = plan(
      rule('{when:w=>w.all(),intent:i=>i.feedback.style.use(base)}', 1, 0),
      rule('{when:w=>w.any(),intent:i=>i.feedback.style.use(hidden)}', 2, 1),
    );
    expect(evaluateRulePlan(compiled, { props: {}, states: {} }).style.tokens).toEqual(['bg-blue', 'text-white']);
  });

  it('does not treat inherited snapshot fields as declared prop values', () => {
    const compiled = plan(rule("{when:w=>w.prop('constructor').eq(true),intent:i=>i.feedback.style.use(hidden)}"));
    const inherited = Object.create({ constructor: true }) as Record<string, boolean>;
    expect(evaluateRulePlan(compiled, { props: inherited, states: {} }).style.tokens).toEqual([]);
    Object.defineProperty(inherited, 'constructor', { value: true, enumerable: true });
    expect(evaluateRulePlan(compiled, { props: inherited, states: {} }).style.tokens).toEqual(['hidden']);
  });

  it('reports incompatible comparison literals at the original expression span', () => {
    const source = `{when:w=>w.prop('enabled').eq('true'),intent:i=>i.feedback.style.use(hidden)}`;
    const diagnostic = rejected(source);
    const authored = `const RULE = ${source};`;
    expect(diagnostic.code).toBe('PUI1024');
    expect(authored.slice(diagnostic.span.start, diagnostic.span.end)).toBe("'true'");
    expect(diagnostic.span.file).toBe('rule.proto.ts');
  });

  it('rejects executable conditions and even unused dynamic callback aliases without invoking them', () => {
    const source = `{when:w=>w.state((()=>{throw new Error('executed')})()).eq(true),intent:i=>i.feedback.style.use(hidden)}`;
    expect(rejected(source)).toMatchObject({ code: 'PUI1024', category: 'unsupported-input' });
    expect(rejected(`{when:w=>{const unused=host.read();return w.t();},intent:i=>i.feedback.style.use(hidden)}`))
      .toMatchObject({ code: 'PUI1024' });
  });

  it('rejects context/meta conditions and irreversible state-write intents rather than dropping them', () => {
    expect(rejected("{when:w=>w.ctx(KEY).eq(true),intent:i=>i.feedback.style.use(hidden)}")).toMatchObject({ code: 'PUI1024' });
    expect(rejected("{when:w=>w.meta('hover').eq(true),intent:i=>i.feedback.style.use(hidden)}")).toMatchObject({ code: 'PUI1024' });
    expect(rejected('{when:w=>w.t(),intent:i=>i.state(checked).be(true)}')).toMatchObject({ code: 'PUI1024' });
  });

  it('rejects malformed RuleSpec fields, callback control flow and dynamic style arguments', () => {
    expect(rejected('{when:w=>w.t(),when:w=>w.f(),intent:i=>i.feedback.style.use(hidden)}')).toMatchObject({ code: 'PUI1024' });
    expect(rejected('{when:w=>{if(host.active)return w.t();return w.f();},intent:i=>i.feedback.style.use(hidden)}'))
      .toMatchObject({ code: 'PUI1024' });
    expect(rejected('{when:w=>w.t(),intent:i=>i.feedback.style.use(...handles)}')).toMatchObject({ code: 'PUI1024' });
    expect(rejected('{when:w=>w.t(),intent:i=>i.feedback.style.use(host.style)}')).toMatchObject({ code: 'PUI1024' });
  });

  it('rejects authored style accessors without reading them', () => {
    let reads = 0;
    const handle = { kind: 'tw', get tokens() { reads += 1; return ['hidden']; } } as StyleTokenHandle;
    expect(rejected('{when:w=>w.t(),intent:i=>i.feedback.style.use(hidden)}', { resolveStyle: () => handle }))
      .toMatchObject({ code: 'PUI1024' });
    expect(reads).toBe(0);
  });

  it('rejects serialized plan callback leakage and missing dependency identities', () => {
    let executed = false;
    const valid = rule('{when:w=>w.state(checked).eq(true),intent:i=>i.feedback.style.use(hidden)}');
    const leaked = { ...valid, when: () => { executed = true; return true; } };
    expect(lowerRulePlan([leaked as unknown as RuleDeclarationIR]).ok).toBe(false);
    expect(executed).toBe(false);
    const result = lowerRulePlan([{ ...valid, deps: [] }]);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2024', category: 'invalid-ir' }] });
  });

  it('rejects duplicate declaration identities and unsupported intent kinds at lowering', () => {
    const valid = rule('{when:w=>w.t(),intent:i=>i.feedback.style.use(hidden)}');
    expect(lowerRulePlan([valid, { ...valid, order: 1 }]).ok).toBe(false);
    const malformed = {
      ...valid,
      intent: { kind: 'ops', ops: [{ ...valid.intent.ops[0], kind: 'state.set' }] },
    } as unknown as RuleDeclarationIR;
    expect(lowerRulePlan([malformed])).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2024' }] });
  });
});

describe('trusted static Rule style authoring', () => {
  it('resolves aliased core tw and imported/re-exported declared handles through one source graph', () => {
    const graph = new SourceGraph("import { STYLE as local } from './bridge';", {
      fileName: 'consumer.ts',
      files: {
        'style.ts': "import {tw as tokens} from '@proto.ui/core'; export const STYLE=tokens('bg-blue', 'text-white');",
        'bridge.ts': "export {STYLE} from './style';",
      },
    });
    const handle = extractRuleStyleHandle(graph.load('consumer.ts'), expression('local'));
    const compiled = plan(rule('{when:w=>w.t(),intent:i=>i.feedback.style.use(imported)}', 1, 0, {
      resolveStyle: (node) => ts.isIdentifier(node) && node.text === 'imported' ? handle : undefined,
    }));
    expect(evaluateRulePlan(compiled, { props: {}, states: {} }).style.tokens).toEqual(['bg-blue', 'text-white']);
  });

  it('rejects a counterfeit tw factory without executing authored code', () => {
    const graph = new SourceGraph("function tw() { throw new Error('executed'); }", { fileName: 'consumer.ts' });
    expect(() => extractRuleStyleHandle(graph.load('consumer.ts'), expression("tw('bg-blue')")))
      .toThrow(CompilerRejection);
  });

  it('rejects host selector variants in otherwise trusted tw authoring', () => {
    const graph = new SourceGraph("import {tw} from '@proto.ui/core';", { fileName: 'consumer.ts' });
    expect(() => extractRuleStyleHandle(graph.load('consumer.ts'), expression("tw('hover:bg-blue')")))
      .toThrow(CompilerRejection);
  });
});
