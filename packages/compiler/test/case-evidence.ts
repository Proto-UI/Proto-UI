import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buttonCases } from '../src/conformance/button-cases';
import type { CaseResult } from '../src/conformance/result';
import type { IdentityNormalization, SemanticCheckpoint } from '../src/conformance/trace';

/** Raw observations and normalization declarations allow collection to rerun every oracle. */
export async function writeCaseEvidence(
  directory: string,
  result: CaseResult,
  reference: readonly SemanticCheckpoint[],
  candidate: readonly SemanticCheckpoint[],
  identities: { reference?: IdentityNormalization; candidate?: IdentityNormalization } | undefined,
  browser: string | null,
  harnessError?: string
): Promise<void> {
  const definition = buttonCases().find((entry) => entry.id === result.id);
  if (!definition) throw new Error(`Cannot record unregistered case ${result.id}`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${result.id}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source: definition.source,
        profile: definition.profile,
        styleFamily: definition.styleFamily,
        runId: process.env.COMPILER_EVIDENCE_RUN_ID ?? null,
        revision: process.env.GITHUB_SHA ?? null,
        environment: browser === null ? 'simulated-host' : 'real-browser',
        browser,
        node: process.version,
        result,
        reference,
        candidate,
        identities,
        harnessError,
      },
      null,
      2
    ) + '\n'
  );
}
