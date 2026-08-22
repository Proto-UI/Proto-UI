import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectCommittedAssessmentBaseline,
  deriveRepositoryId,
  loadCommittedCapabilityPolicy,
  loadTrustedIssuerRegistry,
  readJson,
  verifyCapabilityAttestation,
} from './capability-security.mjs';

const rootDefault = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const allowed = new Set([
  '--repo-root',
  '--attestation',
  '--challenge',
  '--response',
  '--subject-key-fingerprint',
  '--registry',
]);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!allowed.has(name) || value === undefined)
    throw new Error(`Unknown or incomplete argument: ${name}`);
  args.set(name, value);
}
for (const required of [
  '--attestation',
  '--challenge',
  '--response',
  '--subject-key-fingerprint',
]) {
  if (!args.has(required)) throw new Error(`${required} is required`);
}

const root = resolve(args.get('--repo-root') ?? rootDefault);
const registryPath = resolve(
  args.get('--registry') ??
    resolve(root, 'internal/agent-operations/trusted-capability-issuers.json')
);
const challenge = readJson(resolve(args.get('--challenge')));
const repositoryId = deriveRepositoryId(root);
const committedBaseline = collectCommittedAssessmentBaseline(root, challenge.scope.baseSha, {
  repositoryId,
});
const policy = loadCommittedCapabilityPolicy(root, challenge.scope.baseSha);
const result = verifyCapabilityAttestation({
  attestation: readJson(resolve(args.get('--attestation'))),
  challenge,
  response: readJson(resolve(args.get('--response'))),
  registry: loadTrustedIssuerRegistry(registryPath),
  policy,
  expectedSubject: args.get('--subject-key-fingerprint'),
  expectedRepositoryId: repositoryId,
  expectedSnapshot: committedBaseline,
});

process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      band: result.band,
      assessmentId: result.assessmentId,
      subject: result.subject,
      issuerKeyId: result.issuerKeyId,
      eligibleTaskClasses: [...result.eligibleTaskClasses].sort(),
    },
    null,
    2
  )}\n`
);
