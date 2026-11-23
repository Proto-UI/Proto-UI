import { digest } from './history-audit.mjs';

// A recorded reading covers its original body and discussion only. Matching an
// object number or a review-method label cannot carry it to changed sources.
export function bindManualReadings(rows, objects, discussions) {
  if (!Array.isArray(rows)) throw new Error('manual decisions must be an array');
  const byNumber = new Map(objects.map((object) => [object.number, object]));
  const bound = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error('invalid manual decision record');
    if (!row.reviewMethod?.startsWith('Read the complete')) continue;
    const object = byNumber.get(row.number);
    if (!object) throw new Error(`manual reading ${row.number}: source object is absent`);
    if (bound.has(row.number)) throw new Error(`manual reading ${row.number}: duplicate record`);
    if (row.bodySha256 !== digest(object.body ?? ''))
      throw new Error(`manual reading ${row.number}: original body hash does not match`);
    const discussion = discussions.get(row.number);
    if (!discussion || row.discussionSha256 !== digest(discussion))
      throw new Error(`manual reading ${row.number}: original discussion hash does not match`);
    bound.set(row.number, row);
  }
  return bound;
}

// The snapshot stores the indexed archive instead of duplicating native RAW
// captures. Require the exact complete capture set before that substitution.
export function assertNativeCaptureIdentity(rawCaptures, archiveCaptures) {
  if (!(rawCaptures instanceof Map) || !(archiveCaptures instanceof Map))
    throw new Error('native capture inputs must be Maps');
  if (rawCaptures.size !== archiveCaptures.size)
    throw new Error('native archive capture set differs from RAW input');
  const sources = [];
  for (const name of [...rawCaptures.keys()].sort()) {
    if (!/^(?:pr|inline|timeline)-\d+\.json$/.test(name))
      throw new Error(`unexpected native capture name: ${name}`);
    if (!archiveCaptures.has(name))
      throw new Error(`native archive is missing RAW capture: ${name}`);
    const sha256 = digest(rawCaptures.get(name));
    if (sha256 !== digest(archiveCaptures.get(name)))
      throw new Error(`native archive capture differs from RAW input: ${name}`);
    sources.push({ name, sha256 });
  }
  return { captures: sources.length, sourceSetSha256: digest(sources) };
}
