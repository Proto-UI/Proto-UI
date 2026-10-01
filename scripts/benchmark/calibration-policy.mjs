import fs from 'node:fs';
import path from 'node:path';
import { listFiles, safeFile } from './evidence.mjs';
import { measured, unavailable } from './schemas.mjs';

export const publicDatasetPath = 'benchmarks/interaction/dataset.json';
export const publicFixtures = Object.freeze({
  'dialog-open-close': 'dialog',
  'tabs-manual-activation': 'tabs',
  'select-keyboard': 'select',
});
export const negativeControlDeviation =
  'Artificial public negative control: disable fixture inline scripts; not a naturally occurring model regression';

export function fixtureArtifact(html, deviations) {
  return deviations.includes(negativeControlDeviation)
    ? html.replace(/<script\b/g, '<script type="application/x-disabled-calibration"')
    : html;
}

// This is the first successful identity, not a claim that later cells started.
// Every cell's actual browser/launch failure remains in evaluator-output.json.
export function retainBrowserIdentity(current, browser) {
  if (current.value !== null) return current;
  return browser?.version
    ? measured(browser)
    : unavailable('Browser launch/version unavailable; see preserved setup failures');
}

// The only runner-derived checks. Replayed by archive verification against raw
// evaluator output so omissions/fabricated results cannot hide behind rehashing.
export function deriveChecks(rawChecks, item, evidenceDir) {
  const checks = structuredClone(rawChecks);
  if (!checks.length)
    checks.push({
      id: 'no-executed-checks',
      dimension: 'host',
      status: 'blocked',
      reason: 'Evaluator returned no checks',
      evidence: [],
    });
  const files = listFiles(evidenceDir);
  const requirements = {
    screenshot: (f) => f.endsWith('.png'),
    trace: (f) => f.endsWith('.zip'),
    dom: (f) => /dom.*\.(json|html|txt)$/.test(f),
    accessibility: (f) => /accessibility.*\.(json|yaml|txt)$/.test(f),
  };
  for (const required of item.evidenceRequirements) {
    if (
      requirements[required] &&
      !files.some(
        (file) => requirements[required](file) && fs.statSync(path.join(evidenceDir, file)).size > 0
      )
    )
      checks.push({
        id: `evidence-missing-${required}`,
        dimension: 'host',
        status: 'blocked',
        reason: `Required ${required} evidence was not produced`,
        evidence: [],
      });
  }
  for (const check of checks)
    for (const file of check.evidence) {
      const resolved = safeFile(evidenceDir, file);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile())
        throw new Error(`Check references missing evidence: ${file}`);
    }
  return checks;
}
