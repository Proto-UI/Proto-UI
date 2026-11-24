import { readFileSync } from 'node:fs';
import { compileFile } from '../../../src/compile.ts';

for (const { entry, profile } of JSON.parse(readFileSync(0, 'utf8'))) {
  const result = await compileFile(entry, { root: process.cwd(), profile });
  // Keep each completed result available even if a later input stalls.
  console.log(JSON.stringify({ entry, profile, result: result.ok ? { ok: true } : result }));
}
