import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeReviewInputDigest, computeReviewPacketDigest } from '../review-runtime.mjs';
import { publicationRoundTrip } from './fixtures/review-publication.mjs';
import { writeModelTraceFixture } from './fixtures/modeltrace.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
// Launcher declarations are independent fixture inputs, never copied from a handoff.
const HUMAN_ARGS = ['--mode', 'human-assisted', '--mode-source', 'current-user'];
const SCHEDULED_ARGS = ['--mode', 'autonomous', '--mode-source', 'schedule'];

function fixture(t, command) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-review-invocation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const publication = publicationRoundTrip();
  const merge = command === 'merge-pull-request';
  const input = merge ? publication.collected : publication.before;
  const packet = merge ? publication.mergePacket : publication.reviewed;
  const identity = writeModelTraceFixture(directory, input.repositoryId);
  const files = Object.fromEntries(
    ['input', 'packet', 'published', 'handoff', 'assessment', 'external', 'prior'].map((name) => [
      name,
      path.join(directory, `${name}.json`),
    ])
  );
  files.record = identity.recordPath;
  files.context = identity.contextPath;
  writeFileSync(files.input, JSON.stringify(input));
  writeFileSync(files.packet, JSON.stringify(packet));
  writeFileSync(files.published, JSON.stringify(publication.reviewed));
  const inputArtifact = {
    type: 'review-input',
    reference: files.input,
    digest: `sha256:${computeReviewInputDigest(input)}`,
  };
  const handoff = {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: merge ? 'pui-review' : 'pui-dev', // Invocation-only fixture.
    nextSkillId: merge ? 'pui-integrate' : 'pui-review',
    artifacts: merge
      ? [
          identity.artifact,
          inputArtifact,
          {
            type: 'review-packet',
            reference: files.packet,
            digest: `sha256:${computeReviewPacketDigest(packet)}`,
          },
          {
            type: 'published-review-packet',
            reference: files.published,
            digest: `sha256:${computeReviewPacketDigest(publication.reviewed)}`,
          },
          { type: 'mutation-authorization', reference: 'explicit-current-user' },
        ]
      : [
          identity.artifact,
          inputArtifact,
          { type: 'authority-map', reference: 'fixture://authority' },
          { type: 'candidate-change', reference: 'fixture://change' },
          { type: 'evidence-report', reference: 'fixture://evidence' },
        ],
    humanGates: [],
    notes: [],
  };
  const readsPath = path.join(directory, 'reads.jsonl');
  const callsPath = path.join(directory, 'calls.jsonl');
  const preloadPath = path.join(directory, 'observe-boundaries.mjs');
  writeFileSync(
    preloadPath,
    `
    import cp from 'node:child_process';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const artifactPaths = new Set(JSON.parse(process.env.PUI_INVOCATION_FILES));
    const read = fs.readFileSync;
    fs.readFileSync = (file, ...args) => {
      if (artifactPaths.has(String(file))) {
        fs.appendFileSync(process.env.PUI_INVOCATION_READS, JSON.stringify(String(file)) + '\\n');
      }
      return read(file, ...args);
    };
    cp.execFileSync = (command, args) => {
      fs.appendFileSync(process.env.PUI_INVOCATION_CALLS, JSON.stringify({ command, args }) + '\\n');
      throw new Error('mock live collection boundary reached');
    };
    syncBuiltinESMExports();
    `
  );
  return {
    handoff,
    files,
    invoke(invocationArgs, candidate = handoff, extraArgs = []) {
      writeFileSync(files.handoff, JSON.stringify(candidate));
      writeFileSync(readsPath, '');
      writeFileSync(callsPath, '');
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(preloadPath).href,
          path.join(root, 'scripts/agent-operations/review-packet.mjs'),
          command,
          ...invocationArgs,
          '--input',
          files.input,
          '--packet',
          files.packet,
          '--handoff',
          files.handoff,
          '--authorization',
          'explicit-current-user',
          '--record',
          files.record,
          '--context',
          files.context,
          ...(merge ? ['--published-review-packet', files.published] : []),
          ...extraArgs,
        ],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            PUI_INVOCATION_FILES: JSON.stringify(Object.values(files)),
            PUI_INVOCATION_READS: readsPath,
            PUI_INVOCATION_CALLS: callsPath,
          },
        }
      );
      assert.ifError(result.error);
      return {
        ...result,
        reads: readFileSync(readsPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),
        calls: readFileSync(callsPath, 'utf8'),
      };
    },
  };
}

for (const command of ['submit-review', 'merge-pull-request']) {
  test(`${command} requires independent invocation declarations before reading artifacts`, (t) => {
    const f = fixture(t, command);
    for (const [args, diagnostic] of [
      [[], /--mode is required/],
      [['--mode-source', 'current-user'], /--mode is required/],
      [['--mode', 'human-assisted'], /--mode-source is required/],
      [['--mode', 'interactive', '--mode-source', 'current-user'], /mode is invalid/],
      [['--mode', 'human-assisted', '--mode-source', 'repository-issue'], /cannot be established/],
      [['--mode', 'human-assisted', '--mode-source', 'schedule'], /cannot be established/],
      [['--mode', 'autonomous', '--mode-source', 'current-user'], /cannot be established/],
      [[...HUMAN_ARGS, '--mode', 'autonomous'], /Usage:/],
      [[...HUMAN_ARGS, '--mode-source', 'schedule'], /Usage:/],
    ]) {
      const result = f.invoke(args);
      assert.equal(result.status, 1);
      assert.match(result.stderr, diagnostic);
      assert.deepEqual(result.reads, []);
      assert.equal(result.calls, '');
    }
  });

  test(`${command} rejects mode and source conflicts before other artifact reads or external calls`, (t) => {
    const f = fixture(t, command);
    for (const [args, changes, field] of [
      [SCHEDULED_ARGS, {}, 'executionMode'],
      [
        HUMAN_ARGS,
        { executionMode: 'autonomous', executionModeSource: 'schedule' },
        'executionMode',
      ],
      [HUMAN_ARGS, { executionModeSource: 'active-human-loop' }, 'executionModeSource'],
      [HUMAN_ARGS, { executionModeSource: 'repository-issue' }, 'executionModeSource'],
    ]) {
      const result = f.invoke(args, { ...f.handoff, ...changes }, [
        '--assessment',
        f.files.assessment,
        '--external-evidence-file',
        f.files.external,
        ...(command === 'submit-review' ? ['--prior-packet', f.files.prior] : []),
      ]);
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        new RegExp(`handoff ${field} does not match the independent invocation declaration`)
      );
      assert.deepEqual(result.reads, [f.files.handoff]);
      assert.equal(result.calls, '');
    }
  });

  test(`${command} migrates explicit human launchers and preserves autonomous assessment gates`, (t) => {
    const f = fixture(t, command);
    for (const source of ['current-user', 'active-human-loop']) {
      const result = f.invoke(['--mode', 'human-assisted', '--mode-source', source], {
        ...f.handoff,
        executionModeSource: source,
      });
      assert.match(result.stderr, /mock live collection boundary reached/);
      assert.match(result.calls, /"command":"gh"/);
    }
    for (const source of ['maintainer-invocation', 'schedule', 'governed-queue']) {
      const result = f.invoke(['--mode', 'autonomous', '--mode-source', source], {
        ...f.handoff,
        executionMode: 'autonomous',
        executionModeSource: source,
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /assessment|autonomous ceiling/);
      assert.equal(result.calls, '');
    }
  });
}
