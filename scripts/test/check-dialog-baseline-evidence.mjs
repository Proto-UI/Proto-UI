import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const BASELINE = '15d864de54210c2eebc4f4b2fec6235324989989';
export function verifyExpectedBaseline(report, observations, exitCode) {
  assert.equal(exitCode, 1, 'The historical product must retain its failing assertions');
  assert.equal(report.numTotalTests, 8);
  assert.equal(report.numFailedTests, 8);
  assert.equal(report.numPassedTests, 0);
  assert.equal(observations.sourceSha, BASELINE);
  assert.match(observations.probeSha, /^[a-f0-9]{40}$/);
  const assertions = report.testResults.flatMap((file) => file.assertionResults);
  assert.equal(assertions.length, 8);
  for (const result of assertions) {
    assert.equal(result.status, 'failed');
    assert.match(result.failureMessages.join('\n'), /expected 0 to be greater than or equal to 15/);
  }
  for (const family of ['shadcn', 'brutalist'])
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      const id = `${family}-${runtime}-390-settled`;
      const rows = observations.observations.filter((row) => row.id === id);
      assert.equal(rows.length, 1, `Missing unique actual reference: ${id}`);
      const row = rows[0];
      assert.equal(row.sourceSha, BASELINE);
      assert.equal(
        row.route,
        family === 'shadcn'
          ? '/en/ui-libraries/shadcn/dialog/'
          : '/en/ui-libraries/brutalist/components/dialog/'
      );
      assert.deepEqual(row.viewport, { width: 390, height: 900 });
      assert.equal(row.data.rect.x, 0);
      assert.equal(row.data.rect.width, 390);
      assert.equal(row.data.font, 16);
      assert.equal(row.data.rendering.dpr, 1);
      assert.equal(row.data.rendering.scheme, 'light');
      assert.equal(row.data.rendering.fonts, 'loaded');
      assert.equal(row.data.transition, 'entered');
      assert.equal(row.platformFonts.status, 'measured');
      assert.equal(row.image.file, `${id}.png`);
      assert.match(row.image.sha256, /^[a-f0-9]{64}$/);
    }
  return {
    classification: 'expected historical zero-inset failures',
    failedProductJourneys: 8,
    passedProductJourneys: 0,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [reportPath, observationsPath, exit] = process.argv.slice(2);
  const result = verifyExpectedBaseline(
    JSON.parse(fs.readFileSync(reportPath, 'utf8')),
    JSON.parse(fs.readFileSync(observationsPath, 'utf8')),
    Number(exit)
  );
  const observations = JSON.parse(fs.readFileSync(observationsPath, 'utf8'));
  for (const row of observations.observations.filter((row) => row.id.endsWith('-390-settled'))) {
    const bytes = fs.readFileSync(path.join(path.dirname(observationsPath), row.image.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.image.sha256);
    assert.equal(bytes.readUInt32BE(16), 390);
    assert.equal(bytes.readUInt32BE(20), 900);
  }
  console.log(JSON.stringify(result));
}
