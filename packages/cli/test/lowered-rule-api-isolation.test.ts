import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import {
  scanRuleStateReadInventory,
  scanRuleStateReads,
  scanRuleStateReadsWithSites,
} from '../src/services/lowered-hook-coverage';

it.each([
  { siteFirst: true, remoteFirst: true },
  { siteFirst: true, remoteFirst: false },
  { siteFirst: false, remoteFirst: true },
  { siteFirst: false, remoteFirst: false },
])(
  'keeps local site visits and cross-file observations separate (siteFirst=$siteFirst, remoteFirst=$remoteFirst)',
  async ({ siteFirst, remoteFirst }) => {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'rule-api-isolation-')));
    try {
      // Copy the two actual State handles before either call. This observes
      // replay identity without requiring mutable producer-result transport.
      const localCall = 'paintLocal(def, ready);';
      const remoteCall = 'paintRemote(def, muted);';
      const unknownCall = 'paintLocal(def, external());';
      const calls = remoteFirst
        ? [remoteCall, localCall, unknownCall]
        : [localCall, remoteCall, unknownCall];
      const sources = {
        'facts.ts': [
          "import { defineAsHook } from '@proto.ui/core';",
          'export const asFlags = defineAsHook({',
          "  name: 'isolated-flags',",
          "  setup(def) { def.state.bool('ready', false); def.state.bool('muted', false); },",
          '  projectHandle(result) { return { ready: result.stateHandles.ready, muted: result.stateHandles.muted }; },',
          '});',
        ].join('\n'),
        'remote.ts': [
          "import { tw } from '@proto.ui/core';",
          'export function paintRemote(def, state) {',
          "  def.rule({ when: w => w.state(state).eq(true), intent: i => i.feedback.style.use(tw('opacity-50')) });",
          '}',
        ].join('\n'),
        'consumer.proto.ts': [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asFlags } from './facts';",
          "import { paintRemote } from './remote';",
          'declare const external: (...values: unknown[]) => unknown;',
          'function paintLocal(def, state) {',
          "  def.rule({ when: w => w.state(state).eq(true), intent: i => i.feedback.style.use(tw('block')) });",
          '}',
          "export default definePrototype({ name: 'isolated-owner', setup(def) {",
          'const flags = asFlags();',
          'const ready = flags.ready;',
          'const muted = flags.muted;',
          ...calls,
          '} });',
        ].join('\n'),
      };
      await writeFile(path.join(directory, 'tsconfig.json'), '{}');
      for (const [name, text] of Object.entries(sources))
        await writeFile(path.join(directory, name), text);
      const files = Object.keys(sources).map((name) => path.join(directory, name));
      const caller = path.join(directory, 'consumer.proto.ts');
      const remote = path.join(directory, 'remote.ts');
      const text = sources['consumer.proto.ts'];
      const summary = createHookSourceSummaryContext();
      const scanSites = () => scanRuleStateReadsWithSites(text, caller, summary);
      const scanFiles = () => scanRuleStateReadInventory(files, summary);
      const [sites, inventory] = siteFirst
        ? ([scanSites(), scanFiles()] as const)
        : (() => {
            const inventory = scanFiles();
            return [scanSites(), inventory] as const;
          })();

      expect(sites.scan).toEqual(scanRuleStateReads(text, caller));
      expect(sites.raw.usages).toEqual([]);
      expect(sites.raw.unresolved).toEqual([{ expression: 'state', reason: 'subject' }]);
      expect(sites.sites).toHaveLength(1);
      const site = sites.sites[0];
      expect(site.call.getSourceFile()).toBe(sites.source);
      expect(site.rawVisits).toHaveLength(1);
      expect(site.rawVisits[0].invocations).toEqual([]);
      expect(site.visits).toHaveLength(2);
      expect(site.visits.map((visit) => visit.usages.map((usage) => usage.state))).toEqual([
        ['ready'],
        [],
      ]);
      expect(site.visits.map((visit) => visit.unresolved)).toEqual([
        [],
        [{ expression: 'state', reason: 'subject' }],
      ]);
      expect(site.visits.map((visit) => visit.invocations[0].call.getText())).toEqual([
        localCall.slice(0, -1),
        unknownCall.slice(0, -1),
      ]);
      for (const visit of site.visits) {
        expect(visit.invocations).toHaveLength(1);
        expect(visit.invocations[0].call.getSourceFile()).toBe(sites.source);
        expect(visit.invocations[0].helper.getSourceFile()).toBe(sites.source);
      }

      expect(inventory.files).toEqual(files);
      const reached = inventory.evaluated.filter(
        (row) => row.entryFile === caller && !row.declarationOnly
      );
      expect(reached).toHaveLength(3);
      expect(reached.map((row) => row.rule.file)).toEqual(
        remoteFirst ? [remote, caller, caller] : [caller, remote, caller]
      );
      expect(reached.map((row) => row.usages.map((usage) => usage.state))).toEqual(
        remoteFirst ? [['muted'], ['ready'], []] : [['ready'], ['muted'], []]
      );
      expect(reached.map((row) => row.callPath)).toEqual(
        calls.map((call) => [{ file: caller, start: text.indexOf(call) }])
      );
      expect(reached.map((row) => row.unresolved)).toEqual([
        [],
        [],
        [{ expression: 'state', reason: 'subject' }],
      ]);
      expect(
        inventory.observations.filter((row) => row.declarationOnly).map((row) => row.rule.file)
      ).toEqual([remote, caller]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
);
