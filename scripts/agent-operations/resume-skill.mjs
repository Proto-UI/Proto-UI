import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  loadSkillRegistry,
  requireCompletedHandoff,
  validateSkillHandoff,
} from './skill-registry.mjs';
export function resumeSkillHandoff(
  { interrupted, interruptedReference, continuation, currentArtifacts },
  registry = loadSkillRegistry()
) {
  validateSkillHandoff(interrupted, registry);
  if (interrupted.outcome !== 'interrupted') throw Error('resume requires an interrupted source');
  requireCompletedHandoff(continuation);
  validateSkillHandoff(continuation, registry);
  for (const key of ['entrypoint', 'executionMode', 'executionModeSource'])
    if (continuation[key] !== interrupted[key]) throw Error('resume cannot change ' + key);
  if (continuation.schemaVersion !== 2 || continuation.resume)
    throw Error('resume requires a completed v2 continuation');
  for (const key of ['repositoryId', 'scopeId'])
    if (continuation.binding[key] !== interrupted.binding[key])
      throw Error('resume cannot change ' + key);
  if (!Array.isArray(currentArtifacts)) throw Error('current resume inputs are missing');
  const refreshed = currentArtifacts.filter((a) => a.type === 'review-input');
  if (
    refreshed.length !== 1 ||
    refreshed[0].digest !== 'sha256:' + continuation.binding.reviewInputDigest ||
    refreshed[0].revision !== continuation.binding.headSha
  )
    throw Error('resume requires digest- and revision-bound current review input');
  if (
    currentArtifacts.some((a) =>
      [
        'review-packet',
        'published-review-packet',
        'mutation-authorization',
        'standing-user-authorization',
        'interruption-receipt',
        'prior-review-input',
      ].includes(a.type)
    )
  )
    throw Error('resume refresh cannot introduce approval or authorization');
  const materials = [];
  const replaceTypes = new Set(
    currentArtifacts
      .map((a) => a.type)
      .filter((t) => !['candidate-change', 'evidence-report'].includes(t))
  );
  for (const artifact of [...interrupted.artifacts, ...continuation.artifacts]) {
    if (
      [
        'review-packet',
        'published-review-packet',
        'interruption-receipt',
        'prior-review-input',
      ].includes(artifact.type) ||
      replaceTypes.has(artifact.type)
    )
      continue;
    const previous = materials.find(
      (a) => a.type === artifact.type && a.reference === artifact.reference
    );
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(artifact))
        throw Error('resume has conflicting provenance for ' + artifact.reference);
    } else materials.push(structuredClone(artifact));
  }
  const receiptDigest =
    'sha256:' + createHash('sha256').update(JSON.stringify(interrupted)).digest('hex');
  const oldInput = interrupted.artifacts.find((a) => a.type === 'review-input');
  if (oldInput) materials.push({ ...oldInput, type: 'prior-review-input' });
  materials.push({
    type: 'interruption-receipt',
    reference: interruptedReference,
    digest: receiptDigest,
  });
  const result = {
    schemaVersion: 2,
    kind: 'proto-ui.skill-handoff',
    entrypoint: interrupted.entrypoint,
    executionMode: interrupted.executionMode,
    executionModeSource: interrupted.executionModeSource,
    fromId: continuation.fromId,
    nextSkillId: interrupted.interruption.resumeSkillId,
    outcome: 'completed',
    binding: structuredClone(continuation.binding),
    artifacts: [...materials, ...structuredClone(currentArtifacts)],
    humanGates: [...new Set([...interrupted.humanGates, ...continuation.humanGates])],
    notes: [...new Set([...interrupted.notes, ...continuation.notes])],
    resume: {
      interruptedHandoffReference: interruptedReference,
      interruptedHandoffDigest: receiptDigest,
      sourceSkillId: interrupted.fromId,
      previousHeadSha: interrupted.binding.headSha,
      previousReviewInputDigest: interrupted.binding.reviewInputDigest,
      pendingScope: [...interrupted.interruption.pendingScope],
      pendingFindingIds: [...interrupted.interruption.pendingFindingIds],
    },
  };
  validateSkillHandoff(result, registry);
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let paths = process.argv.slice(2);
    if (paths[0] === '--') paths = paths.slice(1);
    const [i, c, a] = paths;
    if (!i || !c || !a)
      throw Error(
        'Usage: pnpm agent:skill:resume -- <interruption.json> <completed-continuation.json> <current-artifacts.json>'
      );
    const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
    process.stdout.write(
      JSON.stringify(
        resumeSkillHandoff({
          interrupted: read(i),
          interruptedReference: i,
          continuation: read(c),
          currentArtifacts: read(a),
        }),
        null,
        2
      ) + '\n'
    );
  } catch (error) {
    process.stderr.write('[agent:skill:resume] ' + error.message + '\n');
    process.exitCode = 1;
  }
}
