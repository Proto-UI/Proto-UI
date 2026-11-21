// Run every governed general check, retaining a red check without suppressing
// later evidence. This changes scheduling only; every original command blocks.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corepackInvocation } from './runtime-test-plan.mjs';
import { runtimeRoot, writeJson } from './runtime-ci.mjs';
import { runtimeSourceSnapshot } from './runtime-observation.mjs';
import { generalCheckPlan, selectGeneralChecks } from './general-check-plan.mjs';
export { generalCheckPlan } from './general-check-plan.mjs';

export async function executeGeneralChecks(steps, execute, checkpoint = () => {}) {
  if (!steps.length) throw new Error('General checks cannot be empty');
  const results = [];
  for (const step of steps) {
    checkpoint({ current: step.id, results });
    try {
      const result = await execute(step);
      results.push({ ...step, ...result, passed: result.exitCode === 0 && !result.signal });
    } catch (error) {
      results.push({
        ...step,
        passed: false,
        exitCode: null,
        signal: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    checkpoint({ current: null, results });
  }
  return {
    passed: results.length === steps.length && results.every((result) => result.passed),
    results,
  };
}

async function runGeneralCi(directory) {
  const sourceBefore = runtimeSourceSnapshot(runtimeRoot);
  const manifest = JSON.parse(readFileSync(path.join(runtimeRoot, 'package.json'), 'utf8'));
  const specBase = process.env.SPEC_AUTHORING_BASE;
  const group = process.env.PROTO_UI_GENERAL_GROUP;
  const completePlan = generalCheckPlan(manifest, specBase);
  const steps = selectGeneralChecks(completePlan, group);
  writeJson(path.join(directory, 'general-plan.json'), {
    sourceBefore,
    specBase,
    group,
    completePlan,
    steps,
  });
  const invocation = corepackInvocation();
  const result = await executeGeneralChecks(
    steps,
    (step) =>
      new Promise((resolve, reject) => {
        const startedAt = new Date().toISOString();
        const logFile = `${step.id.replaceAll(':', '-')}.log`;
        const log = createWriteStream(path.join(directory, logFile));
        console.log(`[general-ci] starting ${step.id}`);
        const child = spawn(step.executable ?? invocation.executable, step.args, {
          cwd: runtimeRoot,
          env: process.env,
          shell: step.executable ? false : invocation.shell,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.on('data', (chunk) => {
          process.stdout.write(chunk);
          log.write(chunk);
        });
        child.stderr.on('data', (chunk) => {
          process.stderr.write(chunk);
          log.write(chunk);
        });
        child.once('error', (error) => {
          log.end();
          reject(error);
        });
        child.once('close', (exitCode, signal) =>
          log.end(() =>
            resolve({
              exitCode,
              signal,
              startedAt,
              finishedAt: new Date().toISOString(),
              logFile,
            })
          )
        );
      }),
    (progress) =>
      writeJson(path.join(directory, 'general-progress.json'), {
        sourceBefore,
        specBase,
        group,
        planned: steps.map((step) => step.id),
        ...progress,
      })
  );
  const sourceAfter = runtimeSourceSnapshot(runtimeRoot);
  const sourceStable = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
  const report = {
    schemaVersion: 1,
    group,
    specBase,
    sourceBefore,
    sourceAfter,
    sourceStable,
    ...result,
    passed: result.passed && sourceStable,
  };
  writeJson(path.join(directory, 'general-checks.json'), report);
  if (group === 'checks') writeJson(path.join(directory, 'result-general-checks.json'), report);
  else {
    const runtimeResult = path.join(directory, 'result-general.json');
    if (existsSync(runtimeResult))
      writeJson(runtimeResult, {
        ...JSON.parse(readFileSync(runtimeResult, 'utf8')),
        generalChecks: report,
      });
  }
  for (const step of result.results)
    console.log(
      `[general-ci] ${step.passed ? 'PASS' : 'FAIL'} ${step.id} (exit=${step.exitCode}; signal=${step.signal})`
    );
  if (!sourceStable) console.error('[general-ci] source changed during the checks');
  process.exitCode = result.passed && sourceStable ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  if (!directory || process.env.PROTO_UI_RUNTIME_PHASE !== 'general')
    throw new Error('General CI requires its evidence directory and general runtime phase');
  await runGeneralCi(directory);
}
