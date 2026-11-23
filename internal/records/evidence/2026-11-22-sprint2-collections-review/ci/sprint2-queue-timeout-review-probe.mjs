import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const queueSource =
  process.env.PUI_REVIEW_SPRINT2_QUEUE ??
  '/workspace/scratch/44c416809288/evidence/reviewed-original-run-sprint2-consumers.mjs';
const { runProcess } = await import(pathToFileURL(queueSource).href);
const work = await mkdtemp(path.join(tmpdir(), 'sprint2-queue-review-'));
const pidFile = path.join(work, 'grandchild.pid');
const heartbeatFile = path.join(work, 'grandchild-heartbeat');
const grandchildSource = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>fs.writeFileSync(${JSON.stringify(heartbeatFile)},String(Date.now())),100);`;
const source = `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',${JSON.stringify(grandchildSource)}],{stdio:'ignore'});process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`;
let child;
try {
  const result = await runProcess(process.execPath, ['-e', source], {
    cwd: work,
    env: process.env,
    log: path.join(work, 'run.log'),
    timeoutMs: 1200,
  });
  child = Number(await readFile(pidFile, 'utf8'));
  const alive = () => {
    try {
      process.kill(child, 0);
      return true;
    } catch {
      return false;
    }
  };
  const aliveWhenQueueResumed = alive();
  const heartbeatAtReturn = await readFile(heartbeatFile, 'utf8');
  await new Promise((resolve) => setTimeout(resolve, 5500));
  const heartbeatAfterGrace = await readFile(heartbeatFile, 'utf8');
  const report = {
    queueSource,
    result,
    grandchild: child,
    aliveWhenQueueResumed,
    aliveAfterHardKillGrace: alive(),
    heartbeatAtReturn,
    heartbeatAfterGrace,
    workingAfterQueueResumed: heartbeatAfterGrace !== heartbeatAtReturn,
    expected: 'A timed-out process group is retired before independent later heavy work begins.',
  };
  await writeFile(
    process.env.PUI_REVIEW_SPRINT2_OUTPUT ??
      '/workspace/scratch/44c416809288/evidence/sprint2-queue-timeout-review-red.json',
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (child) {
    try {
      process.kill(child, 'SIGKILL');
    } catch {}
  }
}
