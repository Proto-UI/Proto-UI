/** Collect only executed case evidence; cached PASS labels never substitute for fresh oracle evaluation. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import {
  buttonCases,
  evaluateButtonCase,
} from '../../packages/compiler/src/conformance/button-cases.ts';
import { assessCase } from '../../packages/compiler/src/conformance/result.ts';

const directory = process.argv[2] ?? process.env.COMPILER_EVIDENCE_DIR;
if (!directory)
  throw new Error(
    'Usage: node --import tsx scripts/compiler/collect-conformance.mjs <evidence-directory>'
  );
const root = path.resolve(directory);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const requiredCases = [
  'button.pointer-props',
  'button.state-events',
  'button.keyboard-focus',
  'button.native-mixing',
  'button.terminal-cleanup',
  'button.retained-owner',
];
const definitions = buttonCases();
const knownCases = new Map(definitions.map((definition) => [definition.id, definition]));
const collectionErrors = [];
const runs = new Map();
mkdirSync(root, { recursive: true });

function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vite-cache') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.isFile() && /^button\..*\.json$/.test(entry.name)) {
      try {
        const evidence = JSON.parse(readFileSync(file, 'utf8'));
        const id = evidence.result?.id;
        if (evidence.schemaVersion !== 1 || !knownCases.has(id) || entry.name !== `${id}.json`)
          throw new Error('unknown/malformed case identity');
        if (runs.has(id)) throw new Error(`duplicate case ${id}`);
        if (
          evidence.source !== knownCases.get(id).source ||
          evidence.profile !== knownCases.get(id).profile ||
          evidence.styleFamily !== knownCases.get(id).styleFamily
        )
          throw new Error('source/profile/style-family mismatch');
        if (
          evidence.runId !== (process.env.COMPILER_EVIDENCE_RUN_ID ?? null) ||
          evidence.revision !== (process.env.GITHUB_SHA ?? null)
        )
          throw new Error('case evidence belongs to a different run/revision');
        if (
          id !== 'button.state-events' &&
          (typeof evidence.browser !== 'string' || !evidence.browser)
        )
          throw new Error('browser case lacks browser provenance');
        const environment = id === 'button.state-events' ? 'simulated-host' : 'real-browser';
        if (
          evidence.environment !== environment ||
          (environment === 'simulated-host' && evidence.browser !== null)
        )
          throw new Error('case environment does not match its driver');
        for (const trace of [evidence.reference, evidence.candidate]) {
          if (!Array.isArray(trace)) throw new Error('missing observed trace');
          for (const point of trace) {
            if (
              !Array.isArray(point.inputSources) ||
              !point.inputSources.length ||
              point.inputSources.some(
                (source) =>
                  !['host-api', 'synthetic-dispatch', 'browser-automation'].includes(source) ||
                  (environment === 'simulated-host' && source === 'browser-automation')
              )
            )
              throw new Error(`invalid input provenance at ${point.step}`);
          }
        }
        if (
          evidence.harnessError !== undefined &&
          (typeof evidence.harnessError !== 'string' || !evidence.harnessError.trim())
        )
          throw new Error('malformed harness failure');
        const result = evidence.harnessError
          ? assessCase({
              id,
              requiredCriteria: knownCases.get(id).requiredCriteria,
              harnessError: evidence.harnessError,
            })
          : evaluateButtonCase(id, evidence.reference, evidence.candidate, evidence.identities);
        if (!isDeepStrictEqual(result, evidence.result))
          throw new Error('saved result disagrees with re-evaluated raw observations');
        runs.set(id, {
          file: path.relative(root, file),
          browser: evidence.browser,
          node: evidence.node,
          environment,
          inputs: evidence.reference.map((point) => ({
            step: point.step,
            sources: point.inputSources,
          })),
          result,
        });
      } catch (error) {
        collectionErrors.push(`${path.relative(root, file)}: ${error.message}`);
      }
    }
  }
}
collect(root);
for (const id of requiredCases) {
  if (!knownCases.has(id)) collectionErrors.push(`required case is not registered: ${id}`);
  if (!runs.has(id)) collectionErrors.push(`required case was not collected: ${id}`);
  else if (runs.get(id).result.status !== 'PASS')
    collectionErrors.push(`required case ${id}: ${runs.get(id).result.status}`);
}

// Catalog identity/lifecycle is authoritative; an invented or renamed criterion fails collection.
const authorityPaths = [
  'spec/prototypes/P-BASE-BUTTON.yaml',
  'spec/contracts/C-EXPOSE-STATE-0001.yaml',
  'spec/contracts/C-LIFECYCLE-0002.yaml',
  'spec/contracts/C-LIFECYCLE-0008.yaml',
];
const criteria = new Map();
for (const source of authorityPaths) {
  const entity = parse(readFileSync(path.join(repository, source), 'utf8'));
  for (const criterion of entity.criteria) {
    criteria.set(criterion.id, {
      id: criterion.id,
      authority: { entity: entity.id, status: entity.status, source },
      statement: criterion.text.en,
      observations: [],
    });
  }
}
const cases = definitions.map((definition) => {
  const run = runs.get(definition.id);
  for (const criterion of definition.requiredCriteria) {
    const row = criteria.get(criterion);
    if (!row) {
      collectionErrors.push(`unknown catalog criterion ${criterion} in ${definition.id}`);
      continue;
    }
    const criterionSteps = definition.steps
      .filter((step) => step.criteria.includes(criterion))
      .map((step) => step.id);
    row.observations.push({
      case: definition.id,
      checkpoints: criterionSteps,
      environment: run?.environment ?? null,
      inputs: run?.inputs.filter((point) => criterionSteps.includes(point.step)) ?? [],
      status: run?.result.status ?? 'UNTESTED',
      file: run?.file ?? null,
      browser: run?.browser ?? null,
      referenceOracle:
        run?.result.oracleCoverage?.reference.find((entry) => entry.criterion === criterion)
          ?.outcome ?? null,
      candidateOracle:
        run?.result.oracleCoverage?.candidate.find((entry) => entry.criterion === criterion)
          ?.outcome ?? null,
    });
  }
  return {
    id: definition.id,
    feature: definition.feature,
    profile: definition.profile,
    source: definition.source,
    styleFamily: definition.styleFamily,
    environment: run?.environment ?? null,
    inputs: run?.inputs ?? [],
    requiredInThisCheckpoint: requiredCases.includes(definition.id),
    result: run?.result ?? {
      id: definition.id,
      status: 'UNTESTED',
      requiredCriteria: definition.requiredCriteria,
      failures: [],
      reasons: [
        'No executed report collected for this case; registry expectations alone are not evidence',
      ],
    },
    file: run?.file ?? null,
  };
});
const matrix = {
  schemaVersion: 1,
  runId: process.env.COMPILER_EVIDENCE_RUN_ID ?? null,
  revision: process.env.GITHUB_SHA ?? null,
  collectionStatus: collectionErrors.length ? 'BLOCKED' : 'PASS',
  collectionErrors,
  scope:
    'Bounded Base Button direct-entry and retained-owner asButton composition on React 19. PASS is per case expectation, never a declaration that the whole criterion or protocol is complete.',
  inputScope:
    'Only browser-automation checkpoints are native-input evidence. Simulated-host dispatch, host API calls and detached-target synthetic dispatch are explicitly separate.',
  boundaries: [
    {
      id: 'layout-paint-hit',
      status: 'UNTESTED',
      reason:
        'Coordinator-owned independent probe; exact head/evidence not integrated into this collection.',
    },
    {
      id: 'retained-owner-generalization',
      status: 'UNTESTED',
      reason:
        'Retained-owner PASS is limited to the single-owner property-driven fixture. Native child-state survival, arbitrary bindings and nested owners are not established by it.',
    },
    {
      id: 'host-lifecycle-control-from-prototype',
      status: 'UNSUPPORTED',
      reason:
        'Only boolean callback-time run.lifecycle.setPresent is admitted. Direct mount/unmount/dispose and host bridge access remain outside the operation set.',
    },
    {
      id: 'nested-trigger-routing',
      status: 'UNTESTED',
      reason: 'No nested trigger journey is collected by this bounded direct-entry profile.',
    },
    {
      id: 'authored-entry-generalization',
      status: 'UNTESTED',
      reason:
        'One asButton composition now runs through retained view epochs; other authored compositions and complete entry equivalence remain untested.',
    },
    {
      id: 'overlay-retained-subtree-projection',
      status: 'UNTESTED',
      reason:
        'This case exercises direct ViewIntent removal under active C-LIFECYCLE-0008, not the draft C-HOST-VIEW-ATTACHMENT-0001 overlay retained-host/children projection.',
    },
    {
      id: 'rapid-intent-reversal',
      status: 'UNTESTED',
      reason:
        'Sequential detach/rebind is exercised; superseded asynchronous completions and rapid intent reversals need separate cases.',
    },
    {
      id: 'react-18',
      status: 'UNTESTED',
      reason: 'Current consumer/browser evidence uses React 19 only.',
    },
    {
      id: 'styled-prototype-families',
      status: 'UNTESTED',
      reason: 'No shadcn/brutalist generated parity claim is made by the base-unstyled fixture.',
    },
    {
      id: 'runtime-free-output',
      status: 'UNSUPPORTED',
      reason:
        'react-runtime-v1 explicitly retains the Proto-UI Runtime and React Adapter host bridge.',
    },
  ],
  cases,
  criteria: [...criteria.values()],
};
const output = path.join(root, 'criterion-case-run-matrix.json');
writeFileSync(output, JSON.stringify(matrix, null, 2) + '\n');
console.log(`COMPILER_CASE_COLLECTION_${matrix.collectionStatus}: ${output}`);
for (const entry of cases) console.log(`${entry.id}: ${entry.result.status}`);
for (const error of collectionErrors) console.error(error);
if (collectionErrors.length) process.exitCode = 1;
