export function renderReport(manifest, results, error = null) {
  const lines = [
    '# Public calibration dry run',
    '',
    '**No model was evaluated. No Proto UI advantage, conformance, strict-blind isolation, or benchmark readiness conclusion is supported.**',
    '',
    `Run: ${manifest?.runId ?? 'initialization-failed'}`,
    `Base source: ${manifest?.source.sha ?? 'unavailable'}`,
    `Harness bytes: ${manifest?.harness.sourceDigest ?? 'unavailable'}`,
    `Completed cells: ${results.length}`,
    `Aborted: ${Boolean(error)}`,
    '',
    '## Per-cell evidence',
    '',
  ];
  for (const row of results)
    lines.push(
      `- ${row.caseId} / ${row.arm} / repeat ${row.repeat}: ${row.status}; ${row.checks.filter((c) => c.status === 'pass').length} passed checks, ${row.checks.filter((c) => c.status === 'fail').length} failed checks; ${row.metrics.wallTimeMs.toFixed(1)} ms`,
      ...Object.entries(row.dimensions).map(
        ([name, value]) =>
          `  - ${name}: ${value.status} (${value.passed} pass / ${value.failed} fail / ${value.other} other)`
      )
    );
  lines.push('', '## Repeatability (fixture checks, not model variance)', '');
  for (const caseId of new Set(results.map((r) => r.caseId)))
    for (const arm of new Set(results.map((r) => r.arm))) {
      const rows = results.filter((r) => r.caseId === caseId && r.arm === arm);
      if (!rows.length) continue;
      const signatures = new Set(
        rows.map((r) => JSON.stringify(r.checks.map((c) => [c.id, c.status])))
      );
      lines.push(
        `- ${caseId} / ${arm}: n=${rows.length}; ${rows.length < 2 ? 'repeatability unavailable (one repetition)' : `${signatures.size} distinct check-outcome vectors`}. Elapsed range ${Math.min(...rows.map((r) => r.metrics.wallTimeMs)).toFixed(1)}–${Math.max(...rows.map((r) => r.metrics.wallTimeMs)).toFixed(1)} ms; not model cost or uncertainty.`
      );
    }
  lines.push(
    '',
    '## Limitations',
    '',
    '- All cases and oracle expectations are public development fixtures; none is eligible for strict held-out use.',
    '- The blind/knowledge labels test packet projection only; copied fixture outputs do not measure knowledge treatment effects.',
    '- Handwritten HTML fixtures are not real Proto components, generated facades, compiler output, or native-vs-Proto performance references.',
    '- No composite score. Missing evidence, failures, exclusions and deviations remain in each result. Scope exclusions never become passes.',
    '- Accessibility snapshots are not screen-reader testing. Lifecycle/cleanup observations cover only fixture removal/repetition; Proto owner lifetime, leaks and cross-host conformance remain untested.',
    '- Manifest identities and token/compute/human-work measures are null with reasons when unavailable. Zero is never substituted.',
    '- The archive is write-once by this runner and hash-verifiable, not trusted immutable storage; copy it to independently controlled storage before formal evaluation.',
    '- Formal model execution is disabled. Freeze interaction-benchmark-v0 only after independent oracle review, negative controls, boundary audit, exact model/budget, and >=3 independent repetitions per cell are ready.'
  );
  if (error) lines.push('', `Initialization/execution failure: ${error.message ?? error}`);
  return `${lines.join('\n')}\n`;
}
