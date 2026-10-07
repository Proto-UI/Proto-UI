import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIRECTORY = 'report-journal';
const FORMAT = 'create-only-contrast-journal-v1';
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const numbered = (index) => String(index).padStart(6, '0');

async function createJSON(output, path, value) {
  const contents = json(value);
  await writeFile(join(output, path), contents, { flag: 'wx' });
  return { path, digest: digest(contents) };
}

async function replaceCurrent(output, value) {
  // Only this run's convenience view is replaceable. A process interrupted
  // during this write leaves the last view and every committed journal entry.
  const temporary = join(output, `.report-${randomUUID()}.tmp`);
  await writeFile(temporary, json(value), { flag: 'wx' });
  await rename(temporary, join(output, 'report.json'));
}

function patch(record, previous, appendFields = []) {
  const next = new Map(previous);
  const set = {};
  const append = {};
  const unset = [...previous.keys()].filter((key) => !(key in record));
  for (const key of unset) next.delete(key);
  for (const [key, value] of Object.entries(record)) {
    if (appendFields.includes(key)) {
      const count = previous.get(key) ?? 0;
      if (value.length < count) throw new Error(`Journal field ${key} must remain append-only.`);
      if (value.length > count || !previous.has(key)) append[key] = value.slice(count);
      next.set(key, value.length);
    } else {
      // Planned targets are fixed when the matrix is created. Never repeatedly
      // serialize that potentially large list for each achieved frame.
      if (key === 'plannedStates' && previous.get(key) === value) continue;
      const serialized = key === 'plannedStates' ? value : JSON.stringify(value);
      if (serialized !== previous.get(key) || !previous.has(key)) set[key] = value;
      next.set(key, serialized);
    }
  }
  return { next, delta: { set, append, unset } };
}

function applyPatch(record, delta) {
  Object.assign(record, delta.set);
  for (const key of delta.unset) delete record[key];
  for (const [key, values] of Object.entries(delta.append)) {
    (record[key] ??= []).push(...values);
  }
}

function frameEntry(index, name, frame, frameFile) {
  const { family, runtime, theme, requestedState, status, image, factsFile, error } = frame;
  return Object.fromEntries(
    Object.entries({
      index,
      name,
      family,
      runtime,
      theme,
      requestedState,
      status,
      image,
      factsFile,
      error,
      expectedArtifacts: {
        image: `${name}.png`,
        facts: `${name}.facts.json`,
        mismatch: `${name}.mismatch.json`,
      },
      frameFile,
    }).filter(([, value]) => value !== undefined)
  );
}

/**
 * Single-writer journal for one newly owned audit output directory.
 * Each frame has one create-only start and result; measured facts stay in their
 * existing facts file. Checkpoints contain only changed metadata/cases and new
 * errors, never previous frames or caseCoverage. Retained bytes are O(evidence
 * plus deltas), rather than O(frames squared). Only final materialization walks
 * the complete frame list. The current manifest is an atomic convenience view.
 *
 * Cases keep their identity and plannedStates for the run. achievedTargets,
 * case errors and failedCases are append-only; pass the changed case at frame,
 * failure and case checkpoints. Startup, fatal failure and finalization also
 * record the complete case matrix. This preserves errors without scanning all
 * cases or serializing earlier array entries at every frame.
 */
export async function createContrastReportJournal(output) {
  await mkdir(join(output, DIRECTORY));
  const frames = [];
  const attempts = new Map();
  const caseIndices = new Map();
  const caseSnapshots = [];
  let metadataSnapshot = new Map();
  let failedCaseCount = 0;
  let sequence = 0;
  let matchedFrames = 0;
  let finalized = false;
  const assertOpen = () => {
    if (finalized) throw new Error('Contrast report journal is finalized.');
  };
  return {
    frames,
    get matchedFrames() {
      return matchedFrames;
    },
    async beginFrame(name, frame) {
      assertOpen();
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid frame artifact name.');
      if (attempts.has(name)) throw new Error(`Frame already started: ${name}`);
      const index = frames.length;
      const frameFile = await createJSON(
        output,
        `${DIRECTORY}/frame-${numbered(index)}-start.json`,
        { format: FORMAT, index, name, frame }
      );
      attempts.set(name, { index, finished: false });
      frames.push(frameEntry(index, name, frame, frameFile));
    },
    async finishFrame(name, frame) {
      assertOpen();
      const attempt = attempts.get(name);
      if (!attempt) throw new Error(`Frame was not started: ${name}`);
      if (attempt.finished) throw new Error(`Frame already finished: ${name}`);
      const stored = { ...frame };
      // If writing the facts file failed, preserve the in-memory facts in this
      // result instead. Never erase the only remaining measured payload.
      if (stored.factsFile) delete stored.facts;
      const frameFile = await createJSON(
        output,
        `${DIRECTORY}/frame-${numbered(attempt.index)}-result.json`,
        { format: FORMAT, index: attempt.index, name, frame: stored }
      );
      frames[attempt.index] = frameEntry(attempt.index, name, stored, frameFile);
      attempt.finished = true;
      if (stored.status === 'matched') matchedFrames++;
    },
    async persist(reason, report, changedCase) {
      assertOpen();
      const { cases, frames: _frames, failedCases, summary, ...metadata } = report;
      if (sequence === 0) {
        cases.forEach((item, index) => caseIndices.set(item, index));
      }
      const selectedCases =
        sequence === 0 || reason === 'final' || report.fatalError
          ? cases
          : changedCase
            ? [changedCase]
            : [];
      const metadataChange = patch(metadata, metadataSnapshot);
      const changes = selectedCases.map((item) => {
        const index = caseIndices.get(item);
        if (index === undefined) throw new Error('Case identity changed during report capture.');
        return {
          index,
          ...patch(item, caseSnapshots[index] ?? new Map(), ['achievedTargets', 'errors']),
        };
      });
      if (failedCases.length < failedCaseCount)
        throw new Error('Journal failedCases must remain append-only.');
      const { caseCoverage: _coverage, ...compactSummary } = summary ?? {};
      const checkpoint = await createJSON(
        output,
        `${DIRECTORY}/checkpoint-${numbered(sequence)}.json`,
        {
          format: FORMAT,
          sequence,
          reason,
          metadata: metadataChange.delta,
          cases: changes.map(({ index, delta }) => ({ index, delta })),
          failedCases: failedCases.slice(failedCaseCount),
          summary: compactSummary,
        }
      );
      // Commit caches only after the immutable checkpoint exists. A later
      // convenience-view failure cannot discard the committed evidence.
      metadataSnapshot = metadataChange.next;
      for (const { index, next } of changes) caseSnapshots[index] = next;
      failedCaseCount = failedCases.length;
      sequence++;
      const storage = {
        format: FORMAT,
        directory: DIRECTORY,
        checkpoint,
        frameRecords: 'frame-NNNNNN-start.json and frame-NNNNNN-result.json',
        recovery: 'Replay checkpoint deltas and frame records; incomplete attempts are unresolved.',
      };
      if (reason === 'final') {
        const final = { ...report, frames, storage };
        await createJSON(output, 'report-final.json', final);
        finalized = true;
        await replaceCurrent(output, final);
      } else {
        await replaceCurrent(output, {
          schemaVersion: report.schemaVersion,
          runID: report.runID,
          baseline: report.baseline,
          disposition: report.disposition,
          storage,
          summary: compactSummary,
        });
      }
    },
  };
}

/** Read-only recovery, including entries newer than the last current manifest. */
export async function readContrastReportJournal(output) {
  const report = { cases: [], frames: [], failedCases: [] };
  const recoveryErrors = [];
  const files = (await readdir(join(output, DIRECTORY))).sort();
  let nextCheckpoint = 0;
  for (const filename of files.filter((file) => /^checkpoint-\d+\.json$/.test(file))) {
    const path = `${DIRECTORY}/${filename}`;
    try {
      const event = JSON.parse(await readFile(join(output, path), 'utf8'));
      if (event.format !== FORMAT || event.sequence !== nextCheckpoint)
        throw new Error('Unknown format or missing earlier checkpoint; later deltas not applied.');
      applyPatch(report, event.metadata);
      for (const { index, delta } of event.cases) applyPatch((report.cases[index] ??= {}), delta);
      report.failedCases.push(...event.failedCases);
      report.summary = event.summary;
      nextCheckpoint++;
    } catch (error) {
      recoveryErrors.push({ path, error: String(error) });
    }
  }
  // For each index, the complete result supersedes the start only if readable.
  // A truncated result leaves its start and expected raw-artifact paths visible.
  for (const suffix of ['start', 'result']) {
    for (const filename of files.filter((file) =>
      new RegExp(`^frame-\\d+-${suffix}\\.json$`).test(file)
    )) {
      const path = `${DIRECTORY}/${filename}`;
      try {
        const contents = await readFile(join(output, path), 'utf8');
        const event = JSON.parse(contents);
        if (event.format !== FORMAT) throw new Error('Unknown frame journal format.');
        report.frames[event.index] = frameEntry(event.index, event.name, event.frame, {
          path,
          digest: digest(contents),
        });
      } catch (error) {
        recoveryErrors.push({ path, error: String(error) });
      }
    }
  }
  if (recoveryErrors.length)
    report.disposition = 'incomplete journal recovery; all affected evidence remains unresolved';
  return { ...report, recoveryErrors };
}
