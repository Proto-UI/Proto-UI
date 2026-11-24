// Regenerate the test-only source snapshot from the study's exact Git revision.
// The original manifest and research inputs are never rewritten by this command.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDiscovery } from './discovery-schema.mjs';
import { sha256 } from './evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = 'benchmarks/interaction/discovery/study.json';
const manifestBytes = fs.readFileSync(path.join(root, manifestPath));
const study = validateDiscovery('manifest', JSON.parse(manifestBytes.toString('utf8')));
const files = {};
for (const source of study.sourceFiles) {
  const bytes = execFileSync('git', ['show', `${study.sourceRevision}:${source.path}`], {
    cwd: root,
    maxBuffer: 1024 * 1024,
  });
  if (sha256(bytes) !== source.sha256) throw new Error(`Frozen source mismatch: ${source.path}`);
  const content = bytes.toString('utf8');
  if (!Buffer.from(content, 'utf8').equals(bytes))
    throw new Error(`Frozen source is not lossless UTF-8: ${source.path}`);
  files[source.path] = content;
}
const output = path.join(root, 'scripts/benchmark/test/fixtures/discovery-sources.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      sourceRevision: study.sourceRevision,
      manifestSha256: sha256(manifestBytes),
      files,
    },
    null,
    2
  ) + '\n'
);
