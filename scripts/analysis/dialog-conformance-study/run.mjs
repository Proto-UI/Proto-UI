import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { checkInputs, readPlan, sha256, snapshotCell, studyDirectory } from './source-variant.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outArgument = process.argv[2];
if (process.argv.length !== 3 || !outArgument)
  throw new Error('Usage: node scripts/analysis/dialog-conformance-study/run.mjs <new-output-directory>');
const out = path.resolve(outArgument);
if (out === root.slice(0, -1) || out.startsWith(root))
  throw new Error('Keep study outputs outside the source worktree.');
const plan = readPlan(root);
checkInputs(root, plan);
fs.mkdirSync(out);
const launch = {
  schemaVersion: 1, studyId: plan.studyId, startedAt: new Date().toISOString(),
  planSha256: sha256(fs.readFileSync(path.join(root, studyDirectory, 'plan.json'))),
  actualRepositoryHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  subjectBaseline: plan.subjectHead, node: process.version,
  expectationReview: plan.expectationReview, visibility: plan.visibility,
  environment: plan.environment, cells: [],
  executionLimit: 'Caller must supervise this one serial process and all descendants; no internal global watchdog.',
};
const saveLaunch = () => fs.writeFileSync(path.join(out, 'launch.json'), JSON.stringify(launch, null, 2));
saveLaunch();
try {
  for (const variant of plan.variants) {
    const cell = path.join(out, variant.id);
    const snapshot = snapshotCell(root, cell, plan, variant);
    const command = ['pnpm@10.32.1', 'exec', 'vitest', 'run', '--config', `${studyDirectory}/vitest.config.mjs`];
    const log = fs.openSync(path.join(cell, 'runner.log'), 'wx');
    const startedAt = new Date().toISOString();
    let result;
    try {
      result = spawnSync('corepack', command, {
        cwd: root,
        env: {
          ...process.env,
          PROTO_UI_DIALOG_STUDY_CELL: cell,
          PROTO_UI_DIALOG_STUDY_VARIANT: variant.id,
          PROTO_UI_DIALOG_JSON_PATH: path.join(cell, 'vitest.json'),
          PROTO_UI_DIALOG_INTEGRITY_PATH: path.join(cell, 'integrity.json'),
        },
        stdio: ['ignore', log, log],
      });
    } finally {
      fs.closeSync(log);
    }
    const sourceDrift = Object.entries(snapshot.inputs)
      .filter(([relative, hash]) => sha256(fs.readFileSync(path.join(root, relative))) !== hash)
      .map(([relative]) => relative);
    const receipt = {
      variantId: variant.id, executable: 'corepack', args: command,
      startedAt, finishedAt: new Date().toISOString(),
      exitCode: result.status, signal: result.signal,
      spawnError: result.error ? String(result.error) : null,
      sourceDrift,
    };
    fs.writeFileSync(path.join(cell, 'execution.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
    launch.cells.push(receipt);
    saveLaunch();
    console.log(`${variant.id}: exit=${result.status} signal=${result.signal} sourceDrift=${sourceDrift.length}`);
    if (sourceDrift.length) throw new Error('Source changed during collection; preserve this run and review a new revision.');
  }
  launch.finishedAt = new Date().toISOString();
  saveLaunch();
  // Injected variants may legitimately fail assertions. This is the real process
  // outcome, not the study verdict; report.mjs classifies each cell separately.
  if (launch.cells.some((cell) => cell.exitCode !== 0)) process.exitCode = 1;
} catch (error) {
  launch.error = String(error?.stack ?? error);
  saveLaunch();
  throw error;
}
