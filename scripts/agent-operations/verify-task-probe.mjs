import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  collectRepositorySnapshot,
  collectCommittedAssessmentBaseline,
  deriveRepositoryId,
  digestJson,
  loadCommittedCapabilityPolicy,
  loadTrustedIssuerRegistry,
  readJson,
  verifyCapabilityAttestation,
  verifyTaskProbe,
} from './capability-security.mjs';
import { loadSkillRegistry } from './skill-registry.mjs';

const rootDefault = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const allowed = new Set([
  '--repo-root',
  '--probe',
  '--attestation',
  '--challenge',
  '--response',
  '--subject-key-fingerprint',
  '--registry',
  '--task-id',
  '--task-updated-at',
  '--task-class',
  '--leaf-id',
  '--scope-file',
  '--permission-snapshot-digest',
  '--human-authorization-digest',
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
  '--probe',
  '--attestation',
  '--challenge',
  '--response',
  '--subject-key-fingerprint',
  '--task-id',
  '--task-updated-at',
  '--task-class',
  '--leaf-id',
  '--scope-file',
  '--permission-snapshot-digest',
  '--human-authorization-digest',
]) {
  if (!args.has(required)) throw new Error(`${required} is required`);
}

const root = resolve(args.get('--repo-root') ?? rootDefault);
const registryPath = resolve(
  args.get('--registry') ??
    resolve(root, 'internal/agent-operations/trusted-capability-issuers.json')
);
const registry = loadTrustedIssuerRegistry(registryPath);
const repositoryId = deriveRepositoryId(root);
const gitCommonDirOutput = execFileSync('git', ['rev-parse', '--git-common-dir'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const gitCommonDir = resolve(root, gitCommonDirOutput);
const snapshot = collectRepositorySnapshot(root, {
  assessmentMode: 'self-assessment',
  repositoryId,
});
const challenge = readJson(resolve(args.get('--challenge')));
const policy = loadCommittedCapabilityPolicy(root, challenge.scope.baseSha);
const committedBaseline = collectCommittedAssessmentBaseline(root, challenge.scope.baseSha, {
  repositoryId,
});
const { byId: skillsById } = loadSkillRegistry({ root });
const leaf = skillsById.get(args.get('--leaf-id'));
if (!leaf) throw new Error(`Unknown leaf skill: ${args.get('--leaf-id')}`);
const scope = readJson(resolve(args.get('--scope-file')));
const verifiedAttestation = verifyCapabilityAttestation({
  attestation: readJson(resolve(args.get('--attestation'))),
  challenge,
  response: readJson(resolve(args.get('--response'))),
  registry,
  policy,
  expectedSubject: args.get('--subject-key-fingerprint'),
  expectedRepositoryId: repositoryId,
  expectedSnapshot: committedBaseline,
});
const result = verifyTaskProbe({
  probe: readJson(resolve(args.get('--probe'))),
  verifiedAttestation,
  registry,
  policy,
  expected: {
    taskId: args.get('--task-id'),
    taskUpdatedAt: args.get('--task-updated-at'),
    leafId: args.get('--leaf-id'),
    taskClass: args.get('--task-class'),
    mutation: leaf.mutation,
    scopeDigest: digestJson(scope),
    repositoryId,
    baseSha: verifiedAttestation.scopeBaseSha,
    headSha: snapshot.baseSha,
    treeSha: snapshot.treeSha,
    worktreeDigest: snapshot.worktreeDigest,
    diffDigest: snapshot.diffDigest,
    entityGraphDigest: snapshot.catalogDigest,
    permissionSnapshotDigest: args.get('--permission-snapshot-digest'),
    humanAuthorizationDigest: args.get('--human-authorization-digest'),
  },
  leaf,
  verifiedRuntimeSubject: null,
  consumeDirectory: resolve(gitCommonDir, 'pui-agent-operations/probe-consumption'),
});

process.stdout.write(`${JSON.stringify({ valid: true, ...result }, null, 2)}\n`);
