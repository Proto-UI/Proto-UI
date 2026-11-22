import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { digest, readPages } from './history-audit.mjs';

const [input, output, cutoff = '2026-11-22T10:22:30Z'] = process.argv.slice(2);
if (!input || !output || !Number.isFinite(Date.parse(cutoff))) {
  throw new Error(
    'Usage: build-history-snapshot.mjs RAW_DIRECTORY OUTPUT.json.gz [MEMBERSHIP_CUTOFF]'
  );
}
const files = await readdir(input);
async function pages(prefix) {
  return Promise.all(
    files
      .filter((file) => new RegExp(`^${prefix}-\\d+\\.json$`).test(file))
      .sort()
      .map(async (file) => {
        const rows = JSON.parse(await readFile(join(input, file), 'utf8'));
        return { page: Number(file.match(/-(\d+)\.json$/)[1]), rows, sha256: digest(rows) };
      })
  );
}
const issuePages = await pages('issues');
const commentPages = await pages('comments');
const numbers = new Set(
  readPages(issuePages, 'issues')
    .filter((row) => Date.parse(row.created_at) <= Date.parse(cutoff))
    .map((row) => row.number)
);
readPages(commentPages, 'comments');
const originalSources = [];
const originalSourceFiles = [];
function sourceRow(file, pointer, number, key, original, metadata = {}) {
  if (!numbers.has(number))
    throw new Error(`${file}#${pointer} references missing object ${number}`);
  originalSources.push({
    key: `${file}#${pointer}`,
    originalKey: key,
    number,
    sourceFile: file,
    pointer,
    original,
    originalSha256: digest(original),
    ...metadata,
  });
}
for (const file of [
  'internal/governance/release-0.3-source-ledger.json',
  'internal/records/2026-10-14-finf-followup-source-debt.json',
]) {
  const bytes = await readFile(file, 'utf8');
  originalSourceFiles.push({ path: file, sha256: digest(bytes) });
  const data = JSON.parse(bytes);
  if (data.issueSnapshot) {
    for (const [i, issue] of data.issueSnapshot.issues.entries()) {
      for (const [j, criterion] of issue.criteria.entries()) {
        sourceRow(
          file,
          `/issueSnapshot/issues/${i}/criteria/${j}`,
          issue.number,
          criterion.key,
          criterion.original,
          {
            sourceUrl: criterion.source,
            historicalChecked: criterion.historicalChecked,
            sourceBodySha256: issue.sourceBodySha256,
          }
        );
      }
    }
    for (const name of ['finfSource', 'deliverySource']) {
      for (const [index, criterion] of (data[name]?.checkboxes ?? []).entries()) {
        const source = criterion.source ?? data[name].url;
        const number = Number(source.match(/\/(?:issues|pull)\/(\d+)/)?.[1]);
        sourceRow(file, `/${name}/checkboxes/${index}`, number, criterion.key, criterion.original, {
          sourceUrl: source,
          historicalChecked: criterion.historicalChecked,
        });
      }
    }
  } else {
    for (const [name, rows] of [
      ['originalDebtSnapshot/records', data.originalDebtSnapshot.records],
      ['firstRefreshRecords', data.firstRefreshRecords],
      ['finalPostmergeRecords', data.finalPostmergeRecords],
    ]) {
      for (const [index, row] of rows.entries()) {
        const number =
          row.pr ??
          row.number ??
          Number((row.sourceUrl ?? row.url ?? '').match(/\/(?:issues|pull)\/(\d+)/)?.[1]);
        const original =
          row.completeOriginalBody ??
          row.body ??
          JSON.stringify(row.completeOriginalDriftSource ?? row);
        sourceRow(
          file,
          `/${name}/${index}`,
          number,
          row.key ?? row.recordKey ?? row.versionKey,
          original,
          {
            sourceUrl: row.sourceUrl ?? row.url ?? null,
            historicalDisposition: row.disposition ?? row.classification,
            sourceHead: row.sourceHead ?? null,
          }
        );
      }
    }
  }
}
const pullRequests = await Promise.all(
  files
    .filter((file) => /^pr-\d+\.json$/.test(file))
    .sort()
    .map(async (file) => JSON.parse(await readFile(join(input, file), 'utf8')))
);
const inlinePages = files.some((file) => /^inline-\d+\.json$/.test(file))
  ? await pages('inline')
  : [];
const issueTimeline = await Promise.all(
  files
    .filter((file) => /^timeline-\d+\.json$/.test(file))
    .sort()
    .map(async (file) => JSON.parse(await readFile(join(input, file), 'utf8')))
);
const snapshot = {
  schemaVersion: 1,
  repository: 'Proto-UI/Proto-UI',
  membershipCutoff: cutoff,
  capture: {
    method:
      'GitHub REST state=all created ascending, 100 rows per page, explicit empty terminal pages; repository-wide issue comments similarly enumerated. PR GraphQL connections individually paginated to their actual totalCount.',
    atomic: false,
    bodyVersions:
      'Current fetched text, not original-at-creation reconstruction. Original repository source archives are linked separately and kept byte-identical.',
    deletedOrInaccessibleObjects:
      'Not recoverable from accessible API population; number gaps are recorded rather than asserted never to have existed.',
    privateBotSourcesIncluded: false,
  },
  issuePages,
  commentPages,
  pullRequests,
  inlinePages,
  issueTimeline,
  originalSourceFiles,
  originalSources,
  originalSourcesSha256: digest(originalSources),
};
// Both native indexes bind the complete capture and every individual source
// file hash. They are kept in one archive, not duplicated in this snapshot.
const directory = '2026-11-22-sprint-7-history-sources';
snapshot.nativeSourceArchive = {
  directory,
  indexes: await Promise.all(
    ['index.json', 'timeline.index.json'].map(async (path) => ({
      path,
      sha256: digest(await readFile(join(dirname(output), directory, path), 'utf8')),
    }))
  ),
};
delete snapshot.pullRequests;
delete snapshot.inlinePages;
delete snapshot.issueTimeline;
await writeFile(output, gzipSync(JSON.stringify(snapshot), { level: 9 }));
console.log(
  JSON.stringify({
    objects: numbers.size,
    pullRequestSnapshots: pullRequests.length,
    originalSourceVersions: originalSources.length,
    compressedFile: output,
  })
);
