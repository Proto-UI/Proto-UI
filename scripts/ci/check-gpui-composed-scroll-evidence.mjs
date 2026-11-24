import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const composedScrollCases = Object.freeze([
  'composed_chrome_uses_native_geometry_without_jump_or_authored_render',
  'drag_remeasures_track_resize_and_cancels_at_target_replacement',
  'unavailable_axes_and_no_overflow_hide_paint_and_detach_releases_input',
  'cached_duplicate_views_revoke_control_without_false_unmount_or_aba_revival',
]);

const hash = (contents) => createHash('sha256').update(contents).digest('hex');

export function assertComposedScrollReports({
  log,
  graph,
  producer,
  consumer,
  authoredConsumer,
  stepOutcome,
}) {
  assert.equal(stepOutcome, 'success', 'the complete native Cargo step must succeed');
  const results = [
    ...log.matchAll(
      /^test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out[.;]/gm
    ),
  ];
  assert.equal(results.length, 1, 'one actual complete native target must execute');
  assert.deepEqual(results[0].slice(1), ['ok', '4', '0', '0', '0', '0']);
  const started = [...log.matchAll(/^test (\S+) \.\.\./gm)].map((match) => match[1]);
  assert.deepEqual(
    started.sort(),
    [...composedScrollCases].sort(),
    'all four independent native journeys must execute once'
  );
  assert.equal(graph.ok, true, 'the full locked Cargo graph must pass');
  for (const option of ['--locked', '--all-features']) assert.ok(graph.command.includes(option));
  assert.ok(
    !graph.command.some(
      (option) => option === '--no-deps' || option.startsWith('--filter-platform')
    )
  );
  assert.equal(
    hash(consumer),
    hash(authoredConsumer),
    'the generated consumer must match the authored oracle'
  );
  assert.equal(
    producer.composedScrollConsumerSha256,
    hash(consumer),
    'the producer must bind the actual native consumer'
  );
  assert.equal(producer.modules.filter((module) => module.name === 'composed_scroll').length, 1);
  return {
    nativePassed: 4,
    nativeFailed: 0,
    nativeIgnored: 0,
    nativeFiltered: 0,
    cases: composedScrollCases,
  };
}

export function verifyComposedScrollEvidence(directory, { source, stepOutcome, authoredConsumer }) {
  const root = path.resolve(directory);
  const files = {
    log: 'composed-scroll-consumer.log',
    graph: 'cargo-graph.json',
    producer: 'generated/source-receipt.json',
    consumer: 'generated/transition/tests/composed_scroll.rs',
  };
  const raw = Object.fromEntries(
    Object.entries(files).map(([key, name]) => [key, readFileSync(path.join(root, name))])
  );
  const actualSource = readFileSync(path.join(root, 'source-sha.txt'), 'utf8').trim();
  assert.match(actualSource, /^[0-9a-f]{40}$/);
  assert.equal(
    actualSource,
    source,
    'native evidence must belong to the requested source revision'
  );
  return {
    schemaVersion: 1,
    kind: 'actual-native-composed-scroll',
    source: actualSource,
    status: 'passed',
    scope:
      'Four source-generated GPUI composed Scroll geometry, input and current physical lease journeys; not whole-profile acceptance',
    ...assertComposedScrollReports({
      log: raw.log.toString('utf8'),
      graph: JSON.parse(raw.graph),
      producer: JSON.parse(raw.producer),
      consumer: raw.consumer,
      authoredConsumer,
      stepOutcome,
    }),
    files: Object.fromEntries(
      Object.entries(raw).map(([key, contents]) => [
        key,
        { path: files[key], sha256: hash(contents) },
      ])
    ),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'usage: check-gpui-composed-scroll-evidence <directory>');
  const root = path.resolve(process.argv[2]);
  mkdirSync(root, { recursive: true });
  let receipt;
  try {
    receipt = verifyComposedScrollEvidence(root, {
      source: process.env.GITHUB_SHA,
      stepOutcome: process.env.PROTO_UI_COMPOSED_STEP_OUTCOME,
      authoredConsumer: readFileSync(
        new URL(
          '../../packages/compiler/test/fixtures/gpui-ordinary-values/composed-scroll-consumer.rs',
          import.meta.url
        )
      ),
    });
  } catch (error) {
    receipt = {
      schemaVersion: 1,
      kind: 'actual-native-composed-scroll',
      status: 'failed',
      source: process.env.GITHUB_SHA ?? null,
      stepOutcome: process.env.PROTO_UI_COMPOSED_STEP_OUTCOME ?? null,
      error: error.message,
      nativePassed: null,
      expectedCases: composedScrollCases,
    };
    process.exitCode = 1;
  }
  writeFileSync(
    path.join(root, 'composed-scroll-acceptance.json'),
    JSON.stringify(receipt, null, 2) + '\n',
    { flag: 'wx' }
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    const detail =
      receipt.status === 'passed'
        ? '4 passed; 0 failed; 0 ignored; 0 filtered. Authored consumer and full locked graph verified.'
        : 'Native acceptance was not obtained: ' + receipt.error.replaceAll('\n', ' ');
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### GPUI composed Scroll\n\nSource: \`${receipt.source ?? 'unavailable'}\`\n\n${detail}\n\n`
    );
  }
  console.log(JSON.stringify(receipt));
}
