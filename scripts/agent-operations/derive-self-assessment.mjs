import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveSelfAssessmentResult,
  loadCapabilityPolicy,
  loadCapabilityRubric,
} from './capability-security.mjs';
import { parseNamedArgs, readAssessmentInputs } from './assessment-io.mjs';

const defaultRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const args = parseNamedArgs(
  process.argv.slice(2),
  new Set(['--bundle', '--challenge', '--response', '--evaluation', '--repo-root'])
);
const root = resolve(args.get('--repo-root') ?? defaultRoot);
const { challenge, response, evaluation } = readAssessmentInputs(args, [
  'challenge',
  'response',
  'evaluation',
]);
const policy = loadCapabilityPolicy(
  resolve(root, 'internal/agent-operations/capability-policy.yaml')
);
const rubric = loadCapabilityRubric(
  resolve(root, 'internal/agent-operations/capability-rubric.yaml')
);
const result = deriveSelfAssessmentResult({ challenge, response, evaluation, rubric, policy });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
