import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCapabilityRubric } from './capability-security.mjs';
import { parseNamedArgs } from './assessment-io.mjs';

const defaultRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const args = parseNamedArgs(process.argv.slice(2), new Set(['--repo-root']));
const root = resolve(args.get('--repo-root') ?? defaultRoot);
const rubric = loadCapabilityRubric(
  resolve(root, 'internal/agent-operations/capability-rubric.yaml')
);
const evaluation = {
  dimensions: Object.fromEntries(
    Object.entries(rubric.dimensions).map(([key, dimension]) => [
      key,
      { score: null, rationale: '', evidenceQuestionIds: [...dimension.questionIds] },
    ])
  ),
  criticalFailures: [],
};
process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
