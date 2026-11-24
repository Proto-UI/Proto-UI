import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prepares empty, equal target projects. Never copies the completed example or
// evaluator into a participant packet. This is a public development experiment.
const [, , target, lockSource] = process.argv;
assert.ok(target && lockSource && path.isAbsolute(target));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = path.join(repo, 'benchmarks/interaction/knowledge-consumer');
const task = await readFile(path.join(baseline, 'task.txt'));
const knowledge = await readFile(path.join(baseline, 'knowledge.md'));
const pkg = JSON.parse(await readFile(path.join(baseline, 'example/package.json')));
delete pkg.scripts['check:consumer'];
const lock = await readFile(lockSource);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(sha256(task), '4aee6df56c7ee6a2e998e867ecbf1b507e9f4f8989c986415415fed8fe9fa155');
// Future packets use the corrected ROLE-PANEL source anchor. Historical runs
// must use their archived packets and original knowledge bytes, not this entry.
assert.equal(sha256(knowledge), '8c22907544c0ee34d6523fbc1a45f772fd538f01ef4e6f7b0505fdb7e072814f');
const common = `You are delivering the task in TASK.txt. Work only inside this packet. Do not inspect parent/sibling repositories, other participants, completed reference implementations, or evaluator files. This is an instruction boundary in a shared filesystem, not a secure blind test.

All arms may use ordinary public React, Vite, WAI-ARIA Tabs Pattern and Radix documentation. Record each retrieved URL and consulted local declaration file. Public documentation can be searched; do not search Proto internal material. Dependencies and the supplied lock are fixed for this run. You may leave installed Radix unused if your arm permits a custom implementation.

Keep implementation in project/index.html, project/src/main.jsx and project/src/style.css. Run a clean npm ci --ignore-scripts --no-audit --no-fund and a production npm run build, retaining real stdout, stderr and exit codes. The operator will independently exercise the production output in Chromium. Ordinary local browser attempts are permitted but platform failures must remain recorded.

Initial delivery budget: ten minutes and forty tool calls from task release. Do not invent results when stopped. Return the whole project, unresolved requirements, actual route/dependency choices, commands/errors/changes, supplied/read material, and available model/usage facts. Provider snapshot, seed, token billing or cost unavailable to you must be null with a reason, never zero. Keep an events.jsonl record with actual UTC event times. Record your first command time and delivery time. On request, you may receive up to three independent outcome-feedback repair rounds, five minutes and twenty tool calls each. Stop on the first complete observation, explicit refusal/abandonment, exhausted budget or irrecoverable environment failure; every attempt is retained.

Do not modify the task, dependency pins, lock, or evaluator. Do not open future operator feedback files before delivery. You can explain ambiguity and record an oracle dispute; successful completion does not require preferring any approach. Do not commit, push, or communicate with external people.
`;
const arms = {
  library:
    'Use the mature public @radix-ui/react-tabs 1.1.13 library to deliver the task. You are an AI implementer integrating a mature library; this arm does not claim to be a human expert comparison.',
  unassisted:
    'Deliver the task using ordinary framework/ecosystem knowledge. You may choose the pinned public library or a custom implementation. No Proto interaction knowledge is supplied.',
  knowledge:
    'Deliver the same task with the additional supplied KNOWLEDGE.md. You may choose the pinned public library or a custom implementation. The knowledge is draft, source-mapped guidance, not a completed implementation.',
};
await mkdir(target);
const packets = [];
const orders = [
  ['library', 'unassisted', 'knowledge'],
  ['unassisted', 'knowledge', 'library'],
  ['knowledge', 'library', 'unassisted'],
];
for (let repeat = 1; repeat <= 3; repeat++)
  for (const arm of orders[repeat - 1]) {
    const id = `${arm}-${repeat}`;
    const root = path.join(target, id);
    const files = {
      'TASK.txt': task,
      'PARTICIPANT.md': common,
      'ARM.txt': arms[arm] + '\n',
      'project/package.json': JSON.stringify(pkg, null, 2) + '\n',
      'project/package-lock.json': lock,
      'project/index.html':
        '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reference sections</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n',
      'project/src/main.jsx': '// Implement the supplied task here.\n',
      'project/src/style.css': '/* Consumer styles. */\n',
    };
    if (arm === 'knowledge') files['KNOWLEDGE.md'] = knowledge;
    const inventory = [];
    for (const [name, value] of Object.entries(files)) {
      const bytes = Buffer.from(value);
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await writeFile(path.join(root, name), bytes, { flag: 'wx' });
      inventory.push({ path: name, sha256: sha256(bytes), bytes: bytes.length });
    }
    packets.push({
      id,
      arm,
      repeat,
      root,
      inventory,
      inventorySha256: sha256(JSON.stringify(inventory)),
    });
  }
const manifest = {
  kind: 'public-development-study-participant-packets',
  preparedAt: new Date().toISOString(),
  taskSha256: sha256(task),
  knowledgeSha256: sha256(knowledge),
  lockSha256: sha256(lock),
  orders,
  packets,
};
await writeFile(path.join(target, 'packets.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    packets: packets.length,
    root: target,
    taskSha256: manifest.taskSha256,
    lockSha256: manifest.lockSha256,
  })
);
