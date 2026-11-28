import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createProtoProgram } from '@proto.ui/compiler/frontend';
import { AUTHORING_DECLARATIONS, produceComponentIR } from '@proto.ui/compiler/producer';
import {
  GeneratedVerificationError,
  validateComponent,
  verifyGenerated,
} from '../src/targets/validate.ts';
import { authoredSource } from './fixtures/authoring-source.mjs';

const compiler = fileURLToPath(new URL('../', import.meta.url));

async function produce(t, source) {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-generated-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  await mkdir(path.join(root, 'node_modules/@proto.ui'), { recursive: true });
  await symlink(compiler, path.join(root, 'node_modules/@proto.ui/compiler'), 'dir');
  await writeFile(path.join(root, 'entry.ts'), source);
  const program = createProtoProgram({
    currentDirectory: root,
    rootNames: ['entry.ts'],
    compilerOptions: { paths: { '@proto.ui/core/authoring': [AUTHORING_DECLARATIONS] } },
  });
  const result = produceComponentIR(program, { fileName: 'entry.ts', publicName: 'Generated' });
  assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
  return result.component;
}

const summary = (verification) =>
  verification.findings.map(({ kind, severity }) => ({ kind, severity }));

test('authored examples verify without findings', () => {
  const examples = [
    ['readonly-badge.proto.ts.txt', 'AuthoringBadge', 'default'],
    ['controlled-toggle.proto.ts.txt', 'ControlledToggle', 'default'],
    ['context-owned-async-tabs.proto.ts.txt', 'AuthoringTabs', 'default'],
    ['context-owned-async-tabs.proto.ts.txt', 'AsyncTabPanel', 'AsyncTabPanel'],
  ];
  for (const [file, name, exportName] of examples) {
    const result = authoredSource(file, name, exportName);
    assert.equal(result.status, 'produced', JSON.stringify(result.diagnostics));
    assert.deepEqual(verifyGenerated(result.component).findings, [], file);
    assert.doesNotThrow(() => validateComponent(result.component, { verifyGenerated: true }));
  }
});

test('a control without a consequence on any path is rejected with its chain', async (t) => {
  const ir = await produce(
    t,
    `
    import { definePrototype, tw } from '@proto.ui/core/authoring';
    export default definePrototype({ name: 'orders-refresh', setup(def) {
      const refreshed = def.state.define<boolean>('refreshed', { initialize: () => false });
      const refresh = def.action('refresh', (run) => { run.set(refreshed, true); });
      def.event.on('press.commit', refresh);
      return (renderer) => renderer.el('button', { style: tw('refresh') }, ['Refresh']);
    } });`
  );
  const verification = verifyGenerated(ir);
  assert.deepEqual(summary(verification), [
    { kind: 'dead-control', severity: 'error' },
    { kind: 'dead-store', severity: 'warning' },
  ]);
  assert.match(
    verification.findings[0].witness.join('\n'),
    /button activates "refresh"[\s\S]*return without consequence/
  );
  assert.deepEqual(verification.findings[1].witness, ['refresh writes refreshed']);
  assert.throws(() => validateComponent(ir, { verifyGenerated: true }), GeneratedVerificationError);
  assert.doesNotThrow(() => validateComponent(ir));
});

test('a branch without a consequence is located unless a visible condition explains it', async (t) => {
  const ir = await produce(
    t,
    `
    import { definePrototype, tw } from '@proto.ui/core/authoring';
    function describe(count: number): string {
      if (count === 0) return 'Idle';
      return 'Counted';
    }
    export default definePrototype({ name: 'guarded-counter', setup(def) {
      const props = def.props.define({ locked: { type: 'boolean', default: false } });
      const armed = def.state.define<boolean>('armed', { initialize: () => true });
      const count = def.state.define<number>('count', { initialize: () => 0 });
      const label = def.derive('label', (read) => describe(read.get(count)));
      const press = def.action('press', (run) => {
        if (run.get(props.locked)) return;
        if (run.get(armed)) run.set(count, run.get(count) + 1);
      });
      def.event.on('press.commit', press);
      def.expose.state('locked', props.locked);
      return (renderer) => renderer.el('button', { style: tw('counter') }, [renderer.get(label)]);
    } });`
  );
  const verification = verifyGenerated(ir);
  assert.deepEqual(summary(verification), [{ kind: 'unobserved-branch', severity: 'warning' }]);
  const witness = verification.findings[0].witness.join('\n');
  assert.match(witness, /branch\[false\]/);
  assert.doesNotThrow(() => validateComponent(ir, { verifyGenerated: true }));
});

test('dead stores and creation-time snapshots are reported without rejecting', async (t) => {
  const ir = await produce(
    t,
    `
    import { definePrototype, tw } from '@proto.ui/core/authoring';
    export default definePrototype({ name: 'snapshot-total', setup(def) {
      const props = def.props.define({ total: { type: 'string', default: '0' } });
      const shown = def.state.define<string>('shown', { initialize: (read) => read.get(props.total) });
      const clicks = def.state.define<number>('clicks', { initialize: () => 0 });
      const note = def.state.define<string>('note', { initialize: () => '' });
      const press = def.action('press', (run) => {
        run.set(clicks, run.get(clicks) + 1);
        run.set(note, 'pressed');
      });
      def.event.on('press.commit', press);
      return (renderer) => renderer.el('button', { style: tw('total') }, [renderer.get(shown), renderer.get(note)]);
    } });`
  );
  const verification = verifyGenerated(ir);
  assert.deepEqual(summary(verification), [
    { kind: 'dead-store', severity: 'warning' },
    { kind: 'snapshot-read', severity: 'info' },
  ]);
  assert.deepEqual(verification.findings[0].witness, ['press writes clicks']);
  assert.equal(verification.rejected, false);
});
