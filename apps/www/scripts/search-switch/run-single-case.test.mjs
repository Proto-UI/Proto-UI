import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CASE,
  PATTERN,
  SUITE,
  testArguments,
  testEnvironment,
  browserArguments,
} from './run-single-case.mjs';
const original = [
  'pnpm@10.32.1',
  'exec',
  'vitest',
  'run',
  '--no-file-parallelism',
  '--maxWorkers=1',
  '--minWorkers=1',
  SUITE,
];
test('Preserves original invocation and adds only exact test selection/reporting', () => {
  const result = testArguments(original, '/tmp/comparison/vitest.json');
  assert.deepEqual(result.slice(0, original.length), original);
  assert.deepEqual(original, [
    'pnpm@10.32.1',
    'exec',
    'vitest',
    'run',
    '--no-file-parallelism',
    '--maxWorkers=1',
    '--minWorkers=1',
    SUITE,
  ]);
  assert.deepEqual(result.slice(original.length), [
    '--testNamePattern',
    PATTERN,
    '--reporter=default',
    '--reporter=json',
    '--outputFile',
    '/tmp/comparison/vitest.json',
  ]);
  assert(
    new RegExp(PATTERN).test(`Required production Search recovery with generated Pagefind ${CASE}`)
  );
  assert(
    new RegExp(PATTERN).test(
      `${SUITE} Required production Search recovery with generated Pagefind ${CASE}`
    )
  );
  assert(
    !new RegExp(PATTERN).test(
      `Required production Search recovery with generated Pagefind ${CASE.replace('shadcn', 'brutalist')}`
    )
  );
});
test('Fails closed on altered runner invocation', () => {
  assert.throws(() => testArguments([...original, '--testTimeout=5000'], '/tmp/out.json'));
});
test('Does not forward unrelated credential or option environment', () => {
  const env = testEnvironment(
    {
      PATH: '/bin',
      HOME: '/tmp/home',
      CI: 'true',
      GITHUB_TOKEN: 'sentinel',
      NODE_OPTIONS: 'sentinel',
      AWS_SECRET_ACCESS_KEY: 'sentinel',
      CHROME_PATH: '/usr/bin/google-chrome',
    },
    '/tmp/output',
    'sha'
  );
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.CI, 'true');
  assert.equal(env.CANDIDATE_SHA, 'sha');
  assert.equal(env.RUNNER_TEMP, '/tmp/output');
});

test('Keeps original Chrome arguments and routes non-loopback traffic to local denial', () => {
  const original = ['--headless=new', '--remote-debugging-address=127.0.0.1', 'about:blank'];
  const changed = browserArguments(original, 44555);
  assert.deepEqual(changed.slice(0, original.length), original);
  assert(changed.includes('--proxy-server=http://127.0.0.1:44555'));
  assert(changed.includes('--proxy-bypass-list=127.0.0.1;localhost;[::1]'));
  assert(changed.includes('--disable-quic'));
  assert.throws(() => browserArguments(original, 0));
});
