import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSpecReleases, getSpecSnapshot } from '@proto.ui/spec-engine';
import type { SpecLifecyclePlan } from '@proto.ui/spec-schema';
import { loadSpecLifecyclePlan, loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';

const appDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoRoot = path.resolve(appDir, '../..');
const specDir = path.join(repoRoot, 'spec');
const outDir = path.join(appDir, 'public');
const outFile = path.join(outDir, 'spec-workspace.json');

const workspace = await loadSpecWorkspaceFromDirectory(specDir);
const catalogValid = workspace.issues.length === 0;
const releases = getSpecReleases(workspace);
const versions = releases.map((release) => release.version);
const latestVersion = versions.at(-1) ?? '0.1.0';
const latestSnapshot = getSpecSnapshot(workspace, latestVersion);
const lifecyclePlans: Record<string, SpecLifecyclePlan | null | undefined> = {};
for (const version of versions) {
  try {
    lifecyclePlans[version] = await loadSpecLifecyclePlan(repoRoot, version);
  } catch (error) {
    lifecyclePlans[version] = null;
    workspace.issues.push({
      filePath: `internal/releases/${version}/lifecycle-dispositions.json`,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  `${JSON.stringify(
    {
      generatedAt: latestSnapshot.generatedAt,
      releases,
      versions,
      latestVersion,
      entities: workspace.entities,
      catalogValid,
      lifecyclePlans,
      issues: workspace.issues,
    },
    null,
    2
  )}\n`
);

if (workspace.issues.length > 0) {
  console.warn(`[spec] generated with ${workspace.issues.length} validation issue(s)`);
} else {
  console.log(
    `[spec] generated ${path.relative(repoRoot, outFile)} from ${workspace.entities.length} entities`
  );
}
