import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import YAML from 'yaml';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const helper = 'apps/www/scripts/prepare-homepage-composition-fonts.sh';
const bounded = 'timeout --signal=TERM --kill-after=5s 220s bash ' + helper;
const realTimeout = execFileSync('bash', ['-c', 'command -v timeout'], { encoding: 'utf8' }).trim();
const lanes = [
  [
    'compiler-browser-acceptance.yml',
    'browser-acceptance',
    35,
    'PUI_EVIDENCE_DIR',
    'Install and record Chinese fonts for the bilingual captures',
  ],
  [
    'brutalist-contrast-evidence.yml',
    'family-audit-evidence',
    45,
    'CONTRAST_EVIDENCE_DIR',
    'Install and verify CJK fonts for bilingual captures',
  ],
  [
    'sprint3-followup-evidence.yml',
    'direct-consumers',
    120,
    'SPRINT3_FOLLOWUP_EVIDENCE_DIR',
    'Identify sandboxed Chrome and install actual video and CJK dependencies',
  ],
  [
    'sprint3-consumer-evidence.yml',
    'native-consumers',
    65,
    'SPRINT3_EVIDENCE_DIR',
    'Identify Chromium and prepare public CJK font fallback',
  ],
  [
    'sprint3-consumer-evidence.yml',
    'release-rehearsal',
    190,
    'REHEARSAL_EVIDENCE_DIR',
    'Identify the sandboxed browser and public CJK fonts',
  ],
].map(([file, jobId, deadline, evidence, name]) => {
  const workflow = YAML.parse(
    readFileSync(path.join(repository, '.github/workflows', file), 'utf8')
  );
  const job = workflow.jobs[jobId];
  const setup = job.steps.find((step) => step.name === name);
  assert.ok(setup, file + ' font setup');
  return { file, jobId, job, setup, deadline, evidence };
});

test('all five failed font lanes use the existing verified package owner within a fixed deadline', () => {
  for (const { file, job, setup, deadline } of lanes) {
    assert.ok(setup.run.includes(bounded), file + ' must use the bounded existing font owner');
    assert.equal(setup['timeout-minutes'], 5);
    assert.equal(setup.if, undefined);
    assert.equal(setup['continue-on-error'], undefined);
    assert.equal(job['timeout-minutes'], deadline, 'font setup must not extend native job budgets');
    assert.doesNotMatch(setup.run, /apt-get|\|\| true/);
    assert.match(setup.run, /FONT_EVIDENCE_DIR=/);
    assert.match(setup.run, /dpkg-query/);
    if (file !== 'sprint3-consumer-evidence.yml') assert.match(setup.run, /fc-match/);
    execFileSync('bash', ['-n', '-c', setup.run]);
  }
});

// Run the actual workflow shell. Only its external font owner/browser tools are
// fixture executables; they cannot install packages or access the network.
// For the timeout case GNU timeout really terminates a sleeping child. Its
// fixture-only duration is shortened; the workflow's 220-second argv is checked.
function executeSetup(t, lane, mode) {
  assert.ok(lane.setup.run.includes(bounded), 'the positive fixture needs the real owner call');
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3-font-workflow-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  const runner = path.join(directory, 'runner');
  const evidence = path.join(
    runner,
    lane.evidence === 'CONTRAST_EVIDENCE_DIR' ? 'contrast-evidence' : 'evidence'
  );
  mkdirSync(bin);
  mkdirSync(evidence, { recursive: true });
  mkdirSync(path.join(directory, path.dirname(helper)), { recursive: true });
  mkdirSync(path.join(directory, 'apps/www/node_modules/playwright-core'), { recursive: true });
  writeFileSync(path.join(directory, 'apps/www/node_modules/playwright-core/cli.js'), '');
  writeFileSync(
    path.join(directory, helper),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      ': "${FONT_EVIDENCE_DIR:?}"',
      'mkdir -p "$FONT_EVIDENCE_DIR"',
      'printf "%s\\n" "$FONT_EVIDENCE_DIR" > "$FONT_TEST_DIRECTORY/helper-called"',
      'printf "fixture owner started\\n" > "$FONT_EVIDENCE_DIR/font-preparation.log"',
      'case "$FONT_TEST_MODE" in',
      '  failed) exit 31 ;;',
      '  timeout) sleep 10; exit 99 ;;',
      '  passed) exit 0 ;;',
      '  *) exit 97 ;;',
      'esac',
      '',
    ].join('\n')
  );
  writeFileSync(
    path.join(bin, 'timeout'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '[[ "$1" == --signal=TERM && "$2" == --kill-after=5s && "$3" == 220s ]]',
      '[[ "$4" == bash && "$5" == apps/www/scripts/prepare-homepage-composition-fonts.sh ]]',
      'if [[ "$FONT_TEST_MODE" == timeout ]]; then',
      '  shift 3',
      '  exec "$FONT_TEST_REAL_TIMEOUT" --signal=TERM --kill-after=1s 0.1s "$@"',
      'fi',
      'exec "$FONT_TEST_REAL_TIMEOUT" "$@"',
      '',
    ].join('\n'),
    { mode: 0o755 }
  );
  const dispatch = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'case "${0##*/}" in',
    '  google-chrome|corepack|node) printf "fixture version\\n" ;;',
    '  git) printf "%040d\\n" 1 ;;',
    '  dpkg-query) printf "dpkg-query\\n" >> "$FONT_TEST_DIRECTORY/after-owner"; printf "fixture packages\\n" ;;',
    '  fc-match)',
    '    printf "fc-match\\n" >> "$FONT_TEST_DIRECTORY/after-owner"',
    '    case "$*" in',
    '      *lang=ja*) printf "Noto Sans CJK JP\\n" ;;',
    '      *lang=ko*) printf "Noto Sans CJK KR\\n" ;;',
    '      *) printf "Noto Sans CJK SC\\n" ;;',
    '    esac ;;',
    '  sudo|apt-get) printf "Unexpected package-manager bypass\\n" >&2; exit 98 ;;',
    '  *) exit 96 ;;',
    'esac',
    '',
  ].join('\n');
  for (const command of [
    'google-chrome',
    'corepack',
    'node',
    'git',
    'dpkg-query',
    'fc-match',
    'sudo',
    'apt-get',
  ])
    writeFileSync(path.join(bin, command), dispatch, { mode: 0o755 });
  const result = spawnSync('bash', ['-euo', 'pipefail', '-c', lane.setup.run], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: bin + path.delimiter + process.env.PATH,
      RUNNER_TEMP: runner,
      GITHUB_ENV: path.join(directory, 'github-env'),
      PUI_EVIDENCE_DIR: evidence,
      SPRINT3_FOLLOWUP_EVIDENCE_DIR: evidence,
      SPRINT3_EVIDENCE_DIR: evidence,
      REHEARSAL_EVIDENCE_DIR: evidence,
      TMPDIR: runner,
      FONT_TEST_DIRECTORY: directory,
      FONT_TEST_REAL_TIMEOUT: realTimeout,
      FONT_TEST_MODE: mode,
    },
    encoding: 'utf8',
    timeout: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(
    result.signal,
    null,
    'the workflow must record its owned timeout, not hit the test deadline'
  );
  assert.equal(
    result.status,
    { passed: 0, failed: 31, timeout: 124 }[mode],
    result.stdout + result.stderr
  );
  assert.equal(
    readFileSync(path.join(directory, 'helper-called'), 'utf8').trim(),
    path.join(evidence, 'font-preparation')
  );
  assert.ok(
    existsSync(path.join(evidence, 'font-preparation/font-preparation.log')),
    'retain owner diagnostics on every result'
  );
  assert.equal(
    existsSync(path.join(directory, 'after-owner')),
    mode === 'passed',
    'failed preparation must not reach font proof or capture setup'
  );
}

for (const lane of lanes)
  for (const mode of ['passed', 'failed', 'timeout'])
    test(
      lane.file + ' / ' + lane.jobId + ' setup preserves ' + mode + ' font owner outcome',
      (t) => {
        executeSetup(t, lane, mode);
      }
    );

test('the reused font owner still rejects bad package identity and missing actual glyph coverage', () => {
  // Reuse its existing controls; this is not package authenticity or native paint evidence.
  const output = execFileSync(
    'bash',
    [
      path.join(repository, 'apps/www/scripts/prepare-homepage-composition-fonts.test.sh'),
      path.join(repository, helper),
    ],
    { encoding: 'utf8', timeout: 20_000 }
  );
  assert.deepEqual(
    [...output.matchAll(/^PASS: ([\w-]+) \(exit /gm)].map((match) => match[1]),
    ['success', 'bad-sha', 'bad-version', 'wrong-family', 'missing-glyphs']
  );
});
