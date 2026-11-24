import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { compileProject } from '../src/project';
import { writeProjectCompilation } from '../src/project-output';
import { generatedSourcePath } from '../src/emitter-map';
import type { GeneratedModule } from '../src/ir';

export const tabsContentEntry = 'packages/prototypes/shadcn/src/tabs/content.proto.ts';
export const tabsProviderEntry = 'packages/compiler/test/fixtures/local-tabs-provider.proto.ts';

export async function buildLocalTabsArtifact(profile: GeneratedModule['profile']) {
  const result = await compileProject({
    root: process.cwd(),
    entries: [tabsProviderEntry, tabsContentEntry],
    profile,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const base = path.join(process.cwd(), 'packages/compiler/test/generated-modules');
  await mkdir(base, { recursive: true });
  const temporary = await mkdtemp(path.join(base, 'local-tabs-'));
  const output = path.join(temporary, 'output');
  const extension = path.extname(generatedSourcePath(profile));
  const paths = {
    [tabsProviderEntry]: `Provider${extension}`,
    [tabsContentEntry]: `Content${extension}`,
  };
  const written = await writeProjectCompilation(result.value, output, { sourcePaths: paths });
  if (!written.ok) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error(JSON.stringify(written.diagnostics));
  }
  return {
    generation: result.value,
    output,
    paths,
    dispose: () => rm(temporary, { recursive: true, force: true }),
  };
}
