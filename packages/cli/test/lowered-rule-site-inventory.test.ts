import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  scanRuleStateReads,
  scanRuleStateReadsWithSites,
  type RuleStateScan,
} from '../src/services/lowered-hook-coverage';

const facts = [
  "import { defineAsHook } from '@proto.ui/core';",
  "export const asFacts = defineAsHook({ name: 'site-facts',",
  "  setup(def) { def.state.bool('ready', false); },",
  '  projectHandle(result) { return { ready: result.stateHandles.ready }; },',
  '});',
].join('\n');
const imports = [
  "import { definePrototype, tw } from '@proto.ui/core';",
  "import { asFacts } from './facts';",
  'declare const external: (...values: unknown[]) => unknown;',
].join('\n');
const helper = [
  'function paint(def, held) {',
  "  def.rule({ when: w => w.state(held).eq(true), intent: i => i.feedback.style.use(tw('opacity-50')) });",
  '}',
].join('\n');
const source = (body: string, declaration = helper) =>
  [
    imports,
    declaration,
    "export default definePrototype({ name: 'site-owner', setup(def) {",
    body,
    '} });',
  ].join('\n');
const plain = (scan: RuleStateScan) => ({
  ...scan,
  usages: scan.usages.map((usage) => ({
    hook: usage.hook,
    state: usage.state,
    provenance: usage.provenance,
  })),
});

async function observe(text: string) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'rule-site-inventory-')));
  try {
    await writeFile(path.join(directory, 'tsconfig.json'), '{}');
    await writeFile(path.join(directory, 'facts.ts'), facts);
    const file = path.join(directory, 'consumer.proto.ts');
    await writeFile(file, text);
    const inventory = scanRuleStateReadsWithSites(text, file);
    // Inspection never changes the existing public production result.
    expect(plain(inventory.scan)).toEqual(plain(scanRuleStateReads(text, file)));
    for (const site of inventory.sites) {
      expect(site.call.getSourceFile()).toBe(inventory.source);
      expect(site.call.getText(inventory.source)).toBe(
        text.slice(site.call.getStart(inventory.source), site.call.end)
      );
    }
    return inventory;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('same-AST Rule site inventory', () => {
  it('retains the raw declaration while observing its real closed call separately', async () => {
    const inventory = await observe(source('paint(def, asFacts().ready);'));
    expect(inventory.sites).toHaveLength(1);
    const site = inventory.sites[0];
    expect(inventory.raw.unresolved.map((gap) => gap.reason)).toEqual(['subject']);
    expect(inventory.raw.usages).toEqual([]);
    expect(site.rawVisits).toHaveLength(1);
    expect(site.rawVisits[0].invocations).toEqual([]);
    expect(site.visits).toHaveLength(1);
    expect(site.visits[0].unresolved).toEqual([]);
    expect(site.visits[0].usages[0].provenance?.declaredName).toBe('ready');
    expect(site.visits[0].invocations).toHaveLength(1);
    expect(site.visits[0].invocations[0].helper.body?.statements[0].getSourceFile()).toBe(
      inventory.source
    );
    expect(site.visits[0].invocations[0].call.getText()).toBe('paint(def, asFacts().ready)');
  });

  it('does not let a known call erase another unknown context at the same Rule node', async () => {
    const inventory = await observe(
      source(['paint(def, asFacts().ready);', 'paint(def, external());'].join('\n'))
    );
    expect(inventory.sites).toHaveLength(1);
    const visits = inventory.sites[0].visits;
    expect(visits).toHaveLength(2);
    expect(visits[0].usages).toHaveLength(1);
    expect(visits[0].unresolved).toEqual([]);
    expect(visits[1].usages).toEqual([]);
    expect(visits[1].unresolved.map((gap) => gap.reason)).toEqual(['subject']);
    expect(visits[0].invocations[0].call).not.toBe(visits[1].invocations[0].call);
    expect(visits[0].invocations[0].ordinal).not.toBe(visits[1].invocations[0].ordinal);
    expect(inventory.scan.unresolved.map((gap) => gap.reason)).toEqual(['subject']);
    expect(inventory.raw.unresolved.map((gap) => gap.reason)).toEqual(['subject']);
  });

  it('keeps an uncalled helper declaration without fabricating an invocation', async () => {
    const inventory = await observe([imports, helper].join('\n'));
    expect(inventory.sites).toHaveLength(1);
    expect(inventory.sites[0].visits).toHaveLength(1);
    expect(inventory.sites[0].visits[0].invocations).toEqual([]);
    expect(inventory.scan.unresolved.map((gap) => gap.reason)).toEqual(['subject']);
  });

  it('does not label a lexical call in an uncalled factory as an instantiated entry', async () => {
    const inventory = await observe(
      [
        imports,
        helper,
        'function construct() {',
        "  return definePrototype({ name: 'not-instantiated', setup(def) { paint(def, asFacts().ready); } });",
        '}',
      ].join('\n')
    );
    expect(inventory.sites).toHaveLength(1);
    expect(inventory.sites[0].rawVisits[0].unresolved.map((gap) => gap.reason)).toEqual([
      'subject',
    ]);
    const call = inventory.sites[0].visits[0].invocations[0].call;
    expect(
      ts.findAncestor(
        call,
        (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'construct'
      )
    ).toBeTruthy();
    // This API records lexical observations only; entry reconciliation is a
    // separate obligation, never an inferred success flag on this inventory.
    expect(Object.hasOwn(inventory, 'entries')).toBe(false);
    expect(Object.hasOwn(inventory.sites[0], 'covered')).toBe(false);
  });

  it('retains repeated finite-loop visits at one original source site', async () => {
    const inventory = await observe(
      source(
        [
          "for (const token of ['opacity-50', 'bg-primary']) {",
          '  def.rule({ when: w => w.state(unknownState).eq(true), intent: i => i.feedback.style.use(tw(token)) });',
          '}',
        ].join('\n'),
        'declare const unknownState: unknown;'
      )
    );
    expect(inventory.sites).toHaveLength(1);
    expect(inventory.sites[0].rawVisits).toHaveLength(2);
    expect(inventory.sites[0].visits).toHaveLength(2);
    expect(inventory.sites[0].visits.map((visit) => visit.ordinal)).toEqual([1, 2]);
    expect(inventory.scan.unresolved.map((gap) => gap.reason)).toEqual(['subject', 'subject']);
  });

  it('retains the original site of a proven empty loop without inventing a visit', async () => {
    const inventory = await observe(
      source(
        [
          'for (const token of []) {',
          '  def.rule({ when: w => w.state(unknownState).eq(true), intent: i => i.feedback.style.use(tw(token)) });',
          '}',
        ].join('\n'),
        'declare const unknownState: unknown;'
      )
    );
    expect(inventory.sites).toHaveLength(1);
    expect(inventory.sites[0].rawVisits).toEqual([]);
    expect(inventory.sites[0].visits).toEqual([]);
  });

  it('records a runtime-plan any condition as a zero-outcome visit, not a covered verdict', async () => {
    const inventory = await observe(
      source(
        "def.rule({ when: w => w.any(w.state(unknownState).eq(true)), intent: i => i.feedback.style.use(tw('opacity-50')) });",
        'declare const unknownState: unknown;'
      )
    );
    expect(inventory.sites).toHaveLength(1);
    expect(inventory.sites[0].visits).toHaveLength(1);
    expect(inventory.sites[0].visits[0].usages).toEqual([]);
    expect(inventory.sites[0].visits[0].unresolved).toEqual([]);
    expect(inventory.sites[0].visits[0].exposedLocals).toEqual([]);
    expect(Object.hasOwn(inventory.sites[0], 'covered')).toBe(false);
  });

  it('keeps an unanalysed zero-argument Rule syntax site and the original bracket gap', async () => {
    const inventory = await observe(
      source(
        [
          'def.rule();',
          "def['rule']({ when: w => w.state(unknownState).eq(true), intent: i => i.feedback.style.use(tw('opacity-50')) });",
        ].join('\n'),
        'declare const unknownState: unknown;'
      )
    );
    expect(inventory.sites).toHaveLength(2);
    expect(inventory.sites[0].rawVisits).toEqual([]);
    expect(inventory.sites[0].visits).toEqual([]);
    expect(inventory.sites[1].visits[0].unresolved.map((gap) => gap.reason)).toEqual(['spec']);
    expect(inventory.scan.unresolved.map((gap) => gap.reason)).toEqual(['spec']);
  });

  it('retains Rule calls visited inside computed type members without changing production traversal', async () => {
    const inventory = await observe(
      [
        "declare const owner: { rule(spec: unknown): 'key' };",
        'type Computed = { [owner.rule({})]: unknown };',
      ].join('\n')
    );
    expect(inventory.sites).toHaveLength(1);
    const site = inventory.sites[0];
    expect(ts.findAncestor(site.call, ts.isTypeNode)).toBeTruthy();
    expect(site.rawVisits).toHaveLength(1);
    expect(site.visits).toHaveLength(1);
    expect(site.rawVisits[0].usages).toEqual([]);
    expect(site.rawVisits[0].unresolved).toEqual([]);
    expect(site.visits[0].usages).toEqual([]);
    expect(site.visits[0].unresolved).toEqual([]);
  });
});
