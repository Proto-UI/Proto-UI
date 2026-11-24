import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { assertComposedScrollReports } from '../check-gpui-composed-scroll-evidence.mjs';

const names = [
  'composed_chrome_uses_native_geometry_without_jump_or_authored_render',
  'drag_remeasures_track_resize_and_cancels_at_target_replacement',
  'unavailable_axes_and_no_overflow_hide_paint_and_detach_releases_input',
  'cached_duplicate_views_revoke_control_without_false_unmount_or_aba_revival',
];
function reports() {
  const consumer = Buffer.from('the exact authored native oracle');
  return {
    stepOutcome: 'success',
    log:
      names.map((name) => `test ${name} ... ok`).join('\n') +
      '\ntest result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.2s\n',
    graph: { ok: true, command: ['metadata', '--locked', '--all-features'] },
    producer: {
      composedScrollConsumerSha256: createHash('sha256').update(consumer).digest('hex'),
      modules: [{ name: 'composed_scroll' }],
    },
    consumer,
    authoredConsumer: consumer,
  };
}

test('requires all four complete native cases, the real step outcome and source-bound consumer', () => {
  assert.equal(assertComposedScrollReports(reports()).nativePassed, 4);
  const mutations = [
    (r) => {
      r.stepOutcome = 'skipped';
    },
    (r) => {
      r.stepOutcome = 'failure';
    },
    (r) => {
      r.log = 'test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out;\n';
    },
    (r) => {
      r.log = r.log.replace('4 passed; 0 failed; 0 ignored', '3 passed; 0 failed; 1 ignored');
    },
    (r) => {
      r.log = r.log.replace(names[3], names[0]);
    },
    (r) => {
      r.log += r.log;
    },
    (r) => {
      r.graph.ok = false;
    },
    (r) => {
      r.graph.command.push('--filter-platform', 'x86_64-unknown-linux-gnu');
    },
    (r) => {
      r.graph.command.push('--no-deps');
    },
    (r) => {
      r.graph.command = r.graph.command.filter((flag) => flag !== '--locked');
    },
    (r) => {
      r.consumer = Buffer.from('edited generated Rust oracle');
    },
    (r) => {
      r.producer.composedScrollConsumerSha256 = '0'.repeat(64);
    },
    (r) => {
      r.producer.modules = [];
    },
  ];
  for (const mutate of mutations) {
    const changed = reports();
    mutate(changed);
    assert.throws(() => assertComposedScrollReports(changed));
  }
});
