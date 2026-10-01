import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { listFiles, safeFile } from './evidence.mjs';
import { measured, unavailable } from './schemas.mjs';

export const calibrationHarnessVersion = 'p0-calibration-v2';
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

export function assertPublicCalibration(dataset, cases) {
  if (
    dataset.status !== 'draft' ||
    cases.some((item) => item.split !== 'development' || item.origin !== 'public-calibration')
  )
    throw new Error(
      'This runner only accepts draft public development calibration. Strict/model/evaluation/held-out runs are BLOCKED: no verified external isolation executor is implemented.'
    );
  if (new Set(cases.map((item) => item.id)).size !== cases.length)
    throw new Error('Duplicate case IDs');
  for (const item of cases) {
    if (!Object.hasOwn(publicFixtures, item.id))
      throw new Error(`Unsupported calibration case without fixture mapping: ${item.id}`);
    if (
      item.datasetId !== dataset.id ||
      item.source.sha !== dataset.source.sha ||
      item.source.repository !== dataset.source.repository
    )
      throw new Error('Case source differs from public dataset');
  }
}

export const auxiliarySourceModules = [
  'scripts/benchmark/calibration-policy.mjs',
  'scripts/benchmark/report.mjs',
];
export function calibrationSourcePaths(dataset, cases, auxiliaries = auxiliarySourceModules) {
  assertPublicCalibration(dataset, cases);
  return [
    ...new Set([
      'package.json',
      'pnpm-lock.yaml',
      '.github/workflows/interaction-benchmark-calibration.yml',
      'benchmarks/interaction/README.md',
      publicDatasetPath,
      dataset.scoringPath,
      ...dataset.cases,
      ...cases.flatMap((item) =>
        [...item.visibility.ordinary, ...item.visibility.knowledge].map((material) => material.path)
      ),
      ...cases.map((item) => `benchmarks/interaction/fixtures/${publicFixtures[item.id]}.html`),
      'scripts/benchmark/benchmark.mjs',
      'scripts/benchmark/browser-calibration.mjs',
      'scripts/benchmark/browser-calibration.test.mjs',
      'scripts/benchmark/evidence.mjs',
      'scripts/benchmark/schemas.mjs',
      'scripts/benchmark/test/benchmark.test.mjs',
      'scripts/benchmark/verify-run.mjs',
      ...auxiliaries,
    ]),
  ].sort();
}

// Parse literal ESM imports rather than matching comments or example strings.
// The existing workspace TypeScript dependency is pinned by the retained lockfile.
export function verifySourceImports(sourceRoot, files) {
  const paths = new Set(files);
  for (const file of files.filter(
    (name) => name.startsWith('scripts/benchmark/') && name.endsWith('.mjs')
  )) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(safeFile(sourceRoot, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );
    const visit = (node) => {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : null;
      if (
        specifier &&
        (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier)) &&
        specifier.text.startsWith('.')
      ) {
        const target = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), specifier.text)
        );
        if (!paths.has(target))
          throw new Error(`Source snapshot omits a relative harness import: ${target}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
