import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const root = process.cwd();
const reviewDirectory = path.join(root, 'internal/autonomous-maintenance/phase-0/reviews');
const requiredSections = [
  'Review decision',
  'Behavioral delta',
  'State transitions',
  'Change and impact map',
  'Authority analysis',
  'Implementation argument',
  'Evidence matrix',
  'Residual risks and limits',
  'Independent review',
  'Reviewer checklist',
];
const allowedStages = new Set(['proposal', 'post-implementation', 'post-implementation-pilot']);
const allowedReviewStatuses = new Set([
  'draft',
  'ready-for-human-review',
  'ready-for-independent-review',
  'revision-required',
  'completed',
  'rejected',
]);
const allowedIndependentStatuses = new Set([
  'pending',
  'adequate',
  'incomplete',
  'misleading',
  'blocked',
]);
const allowedChangeRoles = new Set([
  'pre-existing-authority',
  'pre-existing-direction',
  'proposed-draft-strengthening',
]);

function fail(errors, file, message) {
  errors.push(`${path.relative(root, file)}: ${message}`);
}

function readYamlBlock(file, content, errors) {
  const match = content.match(/<!-- prettier-ignore -->\s*```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!match) {
    fail(errors, file, 'missing prettier-ignored YAML metadata block');
    return null;
  }

  try {
    return YAML.parse(match[1]);
  } catch (error) {
    fail(errors, file, `invalid YAML metadata: ${error.message}`);
    return null;
  }
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function resolveRepositoryPath(file, value, errors, label, options = {}) {
  const { mustExist = true } = options;
  if (typeof value !== 'string' || value.length === 0) {
    fail(errors, file, `${label} must be a non-empty repository-relative path`);
    return null;
  }
  if (path.isAbsolute(value) || value.split('/').includes('..')) {
    fail(errors, file, `${label} must stay within the repository: ${value}`);
    return null;
  }

  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    fail(errors, file, `${label} escapes the repository: ${value}`);
    return null;
  }
  if (mustExist && !fs.existsSync(resolved)) {
    fail(errors, file, `${label} does not exist: ${value}`);
    return null;
  }
  return resolved;
}

function gitLines(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function changedPathsSince(commit, file, errors) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    fail(errors, file, `baselineCommit is not a local commit: ${commit}`);
    return new Set();
  }

  return new Set([
    ...gitLines(['diff', '--name-only', commit, '--']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
}

function validateAuthority(file, entries, stage, errors) {
  if (!nonEmptyArray(entries)) {
    fail(errors, file, 'authority must contain at least one entity');
    return;
  }

  for (const [index, entry] of entries.entries()) {
    const label = `authority[${index}]`;
    if (!entry || typeof entry !== 'object') {
      fail(errors, file, `${label} must be an object`);
      continue;
    }
    const entityFile = resolveRepositoryPath(file, entry.path, errors, `${label}.path`);
    if (!entityFile) continue;

    if (!allowedChangeRoles.has(entry.changeRole)) {
      fail(errors, file, `${label}.changeRole is invalid: ${entry.changeRole}`);
    }

    let entity;
    try {
      entity = YAML.parse(fs.readFileSync(entityFile, 'utf8'));
    } catch (error) {
      fail(errors, file, `${label}.path is not valid YAML: ${error.message}`);
      continue;
    }

    if (entity?.id !== entry.id) {
      fail(errors, file, `${label}.id ${entry.id} does not match ${entry.path} (${entity?.id})`);
    }
    if (entity?.status !== entry.lifecycle) {
      fail(
        errors,
        file,
        `${label}.lifecycle ${entry.lifecycle} does not match ${entry.path} (${entity?.status})`
      );
    }
    const anchors = Array.isArray(entry.anchors) ? entry.anchors : [];
    const proposedAnchors = Array.isArray(entry.proposedAnchors) ? entry.proposedAnchors : [];
    if (anchors.length === 0 && proposedAnchors.length === 0) {
      fail(errors, file, `${label} requires anchors or proposedAnchors`);
      continue;
    }
    const criteria = new Set((entity?.criteria ?? []).map((criterion) => criterion.id));
    for (const anchor of anchors) {
      if (!criteria.has(anchor)) {
        fail(errors, file, `${label}.anchor does not exist in ${entry.path}: ${anchor}`);
      }
    }
    for (const anchor of proposedAnchors) {
      if (stage !== 'proposal' && !criteria.has(anchor)) {
        fail(
          errors,
          file,
          `${label}.proposedAnchor was not implemented in ${entry.path}: ${anchor}`
        );
      }
    }
  }
}

function validateInventory(file, inventory, changedPaths, stage, errors) {
  let pathCount = 0;
  for (const category of ['spec', 'implementation', 'tests']) {
    const entries = inventory?.[category];
    if (!Array.isArray(entries)) {
      fail(errors, file, `changeInventory.${category} must be an array`);
      continue;
    }
    pathCount += entries.length;
    for (const entry of entries) {
      const resolved = resolveRepositoryPath(file, entry, errors, `changeInventory.${category}`, {
        mustExist: stage !== 'proposal',
      });
      if (stage === 'proposal' && resolved && !fs.existsSync(resolved)) {
        const parent = path.dirname(resolved);
        if (!fs.existsSync(parent)) {
          fail(errors, file, `planned ${category} path has no existing parent directory: ${entry}`);
        }
      }
      if (stage !== 'proposal' && !changedPaths.has(entry)) {
        fail(
          errors,
          file,
          `changeInventory.${category} path is unchanged from the declared baseline: ${entry}`
        );
      }
    }
  }
  if (pathCount === 0) {
    fail(errors, file, 'changeInventory must declare at least one planned or actual path');
  }
}

function validateReview(file) {
  const errors = [];
  const content = fs.readFileSync(file, 'utf8');
  const metadata = readYamlBlock(file, content, errors);
  if (!metadata) return errors;

  const expectedId = path.basename(file, '.md');
  if (metadata.findingId !== expectedId) {
    fail(errors, file, `findingId must match filename (${expectedId})`);
  }
  if (!/^AM-P0-\d{3}-F\d+$/.test(metadata.findingId ?? '')) {
    fail(errors, file, `invalid findingId: ${metadata.findingId}`);
  }
  if (!allowedStages.has(metadata.stage)) {
    fail(errors, file, `invalid stage: ${metadata.stage}`);
  }
  if (!allowedReviewStatuses.has(metadata.reviewStatus)) {
    fail(errors, file, `invalid reviewStatus: ${metadata.reviewStatus}`);
  }
  if (!/^[0-9a-f]{40}$/.test(metadata.baselineCommit ?? '')) {
    fail(errors, file, 'baselineCommit must be a full 40-character lowercase SHA');
  }
  if (!Array.isArray(metadata.decisionRequested)) {
    fail(errors, file, 'decisionRequested must be an array');
  }
  if (!['pending', 'accepted', 'rejected'].includes(metadata.humanDecisions?.semantic?.status)) {
    fail(
      errors,
      file,
      `invalid humanDecisions.semantic.status: ${metadata.humanDecisions?.semantic?.status}`
    );
  }
  if (!['pending', 'accepted', 'rejected'].includes(metadata.humanDecisions?.integration?.status)) {
    fail(
      errors,
      file,
      `invalid humanDecisions.integration.status: ${metadata.humanDecisions?.integration?.status}`
    );
  }
  if (
    metadata.humanDecisions?.integration?.status === 'pending' &&
    !nonEmptyArray(metadata.decisionRequested)
  ) {
    fail(errors, file, 'pending integration requires a non-empty decisionRequested array');
  }
  if (
    ['accepted', 'rejected'].includes(metadata.humanDecisions?.integration?.status) &&
    !metadata.humanDecisions?.integration?.decision
  ) {
    fail(errors, file, 'resolved integration requires a recorded decision');
  }
  if (metadata.humanDecisions?.integration?.status === 'accepted') {
    const evidence = metadata.humanDecisions.integration.evidence;
    if (!nonEmptyArray(evidence)) {
      fail(errors, file, 'accepted integration requires evidence');
    } else {
      for (const [index, item] of evidence.entries()) {
        if (!/^[0-9a-f]{40}$/.test(item ?? '')) {
          fail(
            errors,
            file,
            `humanDecisions.integration.evidence[${index}] must be a full commit SHA`
          );
          continue;
        }
        try {
          execFileSync('git', ['cat-file', '-e', `${item}^{commit}`], {
            cwd: root,
            stdio: 'ignore',
          });
        } catch {
          fail(errors, file, `humanDecisions.integration.evidence[${index}] is not a local commit`);
        }
      }
    }
  }
  if (
    ['accepted', 'rejected'].includes(metadata.humanDecisions?.integration?.status) &&
    /- \[ \].*integration decision/im.test(content)
  ) {
    fail(errors, file, 'resolved integration retains an unchecked integration decision item');
  }

  const findingFile = resolveRepositoryPath(file, metadata.findingPath, errors, 'findingPath');
  if (findingFile) {
    const finding = fs.readFileSync(findingFile, 'utf8');
    if (!finding.includes(`# ${metadata.findingId}:`)) {
      fail(errors, file, 'findingPath does not contain the declared finding heading');
    }
    if (!finding.includes(`baselineCommit: ${metadata.baselineCommit}`)) {
      fail(errors, file, 'finding baseline does not match the review packet baseline');
    }
  }

  const changedPaths = /^[0-9a-f]{40}$/.test(metadata.baselineCommit ?? '')
    ? changedPathsSince(metadata.baselineCommit, file, errors)
    : new Set();
  validateAuthority(file, metadata.authority, metadata.stage, errors);
  validateInventory(file, metadata.changeInventory, changedPaths, metadata.stage, errors);

  for (const category of ['direct', 'indirect', 'excluded', 'unknown']) {
    if (!nonEmptyArray(metadata.affectedSurfaces?.[category])) {
      fail(errors, file, `affectedSurfaces.${category} must not be empty`);
    }
  }
  if (!nonEmptyArray(metadata.evidenceClaims)) {
    fail(errors, file, 'evidenceClaims must not be empty');
  } else {
    for (const [index, claim] of metadata.evidenceClaims.entries()) {
      if (
        !claim?.id ||
        !claim?.claim ||
        !nonEmptyArray(claim?.proof) ||
        !nonEmptyArray(claim?.limits)
      ) {
        fail(
          errors,
          file,
          `evidenceClaims[${index}] requires id, claim, non-empty proof, and non-empty limits`
        );
      }
    }
  }
  if (!nonEmptyArray(metadata.residualRisks)) {
    fail(errors, file, 'residualRisks must not be empty');
  } else {
    for (const [index, risk] of metadata.residualRisks.entries()) {
      if (
        !risk?.id ||
        !risk?.title ||
        !risk?.followUp ||
        typeof risk?.blocksCompletion !== 'boolean'
      ) {
        fail(
          errors,
          file,
          `residualRisks[${index}] requires id, title, followUp, and boolean blocksCompletion`
        );
      }
    }
  }
  if (metadata.independentReview?.required !== true) {
    fail(errors, file, 'independentReview.required must be true');
  }
  if (!allowedIndependentStatuses.has(metadata.independentReview?.status)) {
    fail(errors, file, `invalid independentReview.status: ${metadata.independentReview?.status}`);
  }
  if (Array.isArray(metadata.independentReview?.history)) {
    for (const [index, review] of metadata.independentReview.history.entries()) {
      if (
        !Number.isInteger(review?.round) ||
        !allowedIndependentStatuses.has(review?.classification) ||
        typeof review?.confidence !== 'number' ||
        review.confidence < 0 ||
        review.confidence > 1 ||
        !review?.recommendedAction ||
        !review?.summary
      ) {
        fail(
          errors,
          file,
          `independentReview.history[${index}] requires round, classification, confidence, recommendedAction, and summary`
        );
      }
    }
  }

  if (metadata.reviewStatus === 'completed') {
    if (metadata.humanDecisions?.semantic?.status !== 'accepted') {
      fail(errors, file, 'completed remediation requires accepted semantic decision');
    }
    if (metadata.independentReview?.status !== 'adequate') {
      fail(errors, file, 'completed remediation requires adequate independent review');
    }
    if (metadata.automatedCompletion?.status !== 'complete') {
      fail(errors, file, 'completed remediation requires automatedCompletion.status complete');
    }
    if (
      metadata.automatedCompletion?.rule !== 'adequate-independent-review-and-required-validation'
    ) {
      fail(errors, file, 'completed remediation has an invalid automated completion rule');
    }
    if (metadata.automatedCompletion?.validationStatus !== 'passed') {
      fail(errors, file, 'completed remediation requires passed required validation');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.automatedCompletion?.completedOn ?? '')) {
      fail(errors, file, 'completed remediation requires automatedCompletion.completedOn');
    }
    if (metadata.residualRisks.some((risk) => risk.blocksCompletion)) {
      fail(errors, file, 'completed remediation cannot retain a blocking residual risk');
    }
  }

  for (const section of requiredSections) {
    if (!content.includes(`## ${section}`)) {
      fail(errors, file, `missing required section: ${section}`);
    }
  }

  return errors;
}

if (!fs.existsSync(reviewDirectory)) {
  console.error('[autonomous-review] review directory does not exist');
  process.exitCode = 1;
} else {
  const files = fs
    .readdirSync(reviewDirectory)
    .filter((entry) => entry.endsWith('.md'))
    .sort()
    .map((entry) => path.join(reviewDirectory, entry));

  if (files.length === 0) {
    console.error('[autonomous-review] no review packets found');
    process.exitCode = 1;
  } else {
    const errors = files.flatMap(validateReview);
    if (errors.length > 0) {
      console.error(`[autonomous-review] ${errors.length} issue(s)`);
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `[autonomous-review] OK (${files.length} packet${files.length === 1 ? '' : 's'})`
      );
    }
  }
}
