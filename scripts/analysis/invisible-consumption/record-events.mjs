// Operator observation clock only. Incoming event claims still require their raw
// task/command/capture evidence; receipt time does not prove that an action happened.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { json, safeFile, writeNew } from '../../benchmark/evidence.mjs';
import { loadProtocol } from './study.mjs';

const [, , requestedRoot] = process.argv;
if (!requestedRoot || !path.isAbsolute(requestedRoot) || process.argv.length !== 3) throw new Error('Usage: node record-events.mjs <fresh-absolute-session-directory>');
const parent = fs.realpathSync(path.dirname(requestedRoot));
const root = path.join(parent, path.basename(requestedRoot));
const repo = fs.realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
const relative = path.relative(repo, root);
assert.ok(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Keep participant evidence outside the repository');
fs.mkdirSync(root);
const frozen = loadProtocol();
const raw = fs.openSync(safeFile(root, 'received.jsonl'), 'wx');
const events = [];
let release = null, finished = false;
process.stdout.write('RECORDER_READY: send release only when the fixed task is actually delivered\n');
try {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    const receivedAt = new Date().toISOString();
    const receivedMs = performance.now();
    fs.writeSync(raw, JSON.stringify({ receivedAt, processMonotonicMs: receivedMs, line }) + '\n');
    const event = JSON.parse(line);
    assert.ok(!Object.hasOwn(event, 'atMs'), 'Recorder, not sender, supplies receipt offsets');
    if (release === null) {
      assert.equal(event.kind, 'release', 'First observation must be actual task release');
      assert.equal(event.protocolSha256, frozen.sha256);
      assert.equal(event.taskSha256, frozen.protocol.task.sha256);
      assert.ok(typeof event.participantAlias === 'string' && event.participantAlias.trim());
      release = { ...event, startedAt: receivedAt, processMonotonicMs: receivedMs };
      writeNew(root, 'release.json', json(release));
      process.stdout.write('TASK_RELEASE_RECORDED\n');
      continue;
    }
    const atMs = receivedMs - release.processMonotonicMs;
    if (event.kind === 'finish') {
      writeNew(root, 'clock.json', json({ clock: 'monotonic-ms-from-task-release', startedAt: release.startedAt, endedMs: atMs, outcome: 'finished', attribution: 'Offsets are event-receipt times. Report observer delay and task-release delivery brackets as confounders.' }));
      finished = true;
      input.close();
      break;
    }
    assert.ok(typeof event.kind === 'string' && typeof event.stage === 'string' && typeof event.detail === 'string' && Array.isArray(event.evidence), 'Record a structured event with its actual evidence references');
    events.push({ ...event, atMs });
    process.stdout.write(json({ recorded: events.length, kind: event.kind, stage: event.stage, atMs }));
  }
} finally {
  fs.closeSync(raw);
  writeNew(root, 'events.json', json(events));
  if (!finished) {
    writeNew(root, 'clock.json', json({ clock: 'monotonic-ms-from-task-release', startedAt: release?.startedAt ?? null, endedMs: release === null ? null : performance.now() - release.processMonotonicMs, outcome: 'interrupted', attribution: 'Retain this recorder interruption; it is not participant completion or abandonment.' }));
  }
}
