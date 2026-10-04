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
  const chain = Array.isArray(continuation) ? continuation : [continuation];
  if (!chain.length || chain[0]?.fromId !== interrupted.nextSkillId)
    throw Error('continuation must begin at the routed interruption leaf');
  for (const [index, step] of chain.entries()) {
    requireCompletedHandoff(step);
    validateSkillHandoff(step, registry);
    if (step.schemaVersion !== 2 || step.resume)
      throw Error('resume requires completed v2 continuation steps');
    for (const key of ['entrypoint', 'executionMode', 'executionModeSource'])
      if (step[key] !== interrupted[key]) throw Error('resume cannot change ' + key);
    for (const key of ['repositoryId', 'scopeId'])
      if (step.binding[key] !== interrupted.binding[key])
        throw Error('resume cannot change ' + key);
    if (index && chain[index - 1].nextSkillId !== step.fromId)
      throw Error('continuation chain skips a routed leaf');
  }
  const final = chain.at(-1);
  if (final.nextSkillId !== null && final.nextSkillId !== interrupted.interruption.resumeSkillId)
    throw Error('continuation has another pending routed leaf');
  if (!Array.isArray(currentArtifacts)) throw Error('current resume inputs are missing');
  const refreshed = currentArtifacts.filter((a) => a.type === 'review-input');
  if (
    refreshed.length !== 1 ||
    refreshed[0].digest !== 'sha256:' + final.binding.reviewInputDigest ||
    refreshed[0].revision !== final.binding.headSha
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
  const add = (artifact) => {
    const previous = materials.find(
      (a) => a.type === artifact.type && a.reference === artifact.reference
    );
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(artifact))
        throw Error('resume has conflicting provenance for ' + artifact.reference);
    } else materials.push(structuredClone(artifact));
  };
  const replaceTypes = new Set(
    currentArtifacts
      .map((a) => a.type)
      .filter((t) => !['candidate-change', 'evidence-report'].includes(t))
  );
  for (const artifact of [...interrupted.artifacts, ...chain.flatMap((step) => step.artifacts)]) {
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
    add(artifact);
  }
  const receiptDigest =
    'sha256:' + createHash('sha256').update(JSON.stringify(interrupted)).digest('hex');
  const oldInput = interrupted.artifacts.find((a) => a.type === 'review-input');
  add({ ...oldInput, type: 'prior-review-input' });
  add({ type: 'interruption-receipt', reference: interruptedReference, digest: receiptDigest });
  for (const artifact of currentArtifacts) add(artifact);
  const result = {
    schemaVersion: 2,
    kind: 'proto-ui.skill-handoff',
    entrypoint: interrupted.entrypoint,
    executionMode: interrupted.executionMode,
    executionModeSource: interrupted.executionModeSource,
    fromId: final.fromId,
    nextSkillId: interrupted.interruption.resumeSkillId,
    outcome: 'completed',
    binding: structuredClone(final.binding),
    artifacts: materials,
    humanGates: [
      ...new Set([...interrupted.humanGates, ...chain.flatMap((step) => step.humanGates)]),
    ],
    notes: [
      ...new Set([
        ...interrupted.notes,
        ...chain.flatMap((step) => step.notes),
        'Validated continuation route: ' + chain.map((step) => step.fromId).join(' -> '),
      ]),
    ],
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
        'Usage: pnpm agent:skill:resume -- <interruption.json> <completed-continuation-or-chain.json> <current-artifacts.json>'
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
