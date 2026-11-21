import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedSourcePath } from '../src/emitter-map';
import { compileProject } from '../src/project';
import { writeProjectCompilation } from '../src/project-output';

const repository = fileURLToPath(new URL('../../../', import.meta.url));

/** The unchanged Shadcn Collapsible parts, compiled as one project graph. */
export const COLLAPSIBLE_PARTS = {
  root: 'packages/prototypes/shadcn/src/collapsible/root.proto.ts',
  trigger: 'packages/prototypes/shadcn/src/collapsible/trigger.proto.ts',
  content: 'packages/prototypes/shadcn/src/collapsible/content.proto.ts',
} as const;

export type CollapsiblePart = keyof typeof COLLAPSIBLE_PARTS;

/** One generated component identifier; every project entry keeps its own module. */
export const COLLAPSIBLE_COMPONENT_NAME = 'CollapsiblePart';

/** This fixture consumes native compiler output, including its shared module graph. */
export const COLLAPSIBLE_PROFILE = 'react-dom-source-v1';

export const COLLAPSIBLE_SOURCE_REVISION = 'd9e9fa6110ecb7d77ba04c32ad4a3c90d7781237';

const originalSources: Record<string, string> = {
  'packages/prototypes/shadcn/src/collapsible/root.proto.ts': 'd869e465dd6a596024d2503ca329a343c0add968a8831b7f0fb79dd713f83ae6',
  'packages/prototypes/shadcn/src/collapsible/trigger.proto.ts': '20383b3cfd4a23c24694e879f38165af8bfab8f8dd5624d862498d03aa0bfec8',
  'packages/prototypes/shadcn/src/collapsible/content.proto.ts': 'ff6b2bec65e860a91727edd63245f18c574c533f2a16690e1f46874318c835e4',
  'packages/prototypes/shadcn/src/collapsible/types.ts': '8072d4a73f01a1b93ed6b2adc7dd405a1e09ad3094c0c4ed2770e32087136b91',
  'packages/prototypes/base/src/collapsible/root.proto.ts': '25228470f66a41f7aa3e3886d36c8c85a85084f9cc25c60f9ff7c20e52b937f9',
  'packages/prototypes/base/src/collapsible/trigger.proto.ts': '58b796dbcf0367cfd23129c8a33c6b0f122a4ef9d20bf2cc92f1f3f1e8fa3af9',
  'packages/prototypes/base/src/collapsible/content.proto.ts': 'a24c33ab7e7314976503185aa906ed307f275a8d9fcd5b3a5f9220e0a56bbc98',
  'packages/prototypes/base/src/collapsible/shared.ts': '4df04acf2748eb9b9a3ac5c10eb20e79874f4b7d0782f216931b180027870c91',
  'packages/prototypes/base/src/collapsible/types.ts': 'f7d5ec235f3ba4960e0040096f03b402b54a35aaa83bd1f2bab98cc80cebb5b7',
  'packages/prototypes/base/src/tools/use-open-state.ts': 'ceb420a55e8493faaa02d38f8391125a1ebff4158ac5811ff2605d8ce9ab606c',
};

export interface CollapsibleEntryEvidence {
  entry: string;
  profile: string;
  generatedFile: string;
  generatedSha256: string;
  dependencies: readonly { name: string; version: string; role: string }[];
  supportingFiles: readonly { path: string; kind: string; sha256: string }[];
  sourceFiles: readonly { file: string; sha256: string }[];
  provenance: unknown;
}

export interface CollapsibleManifest {
  sourceRevision: string;
  originalSources: Record<string, string>;
  publishedArtifacts: { file: string; sha256: string }[];
  profile: string;
  componentName: string;
  projectIdentity: string;
  entries: Record<CollapsiblePart, string>;
  compilation: CollapsibleEntryEvidence[];
}

export interface CollapsibleProject {
  directory: string;
  manifestPath: string;
  manifest: CollapsibleManifest;
  remove(): Promise<void>;
}

const digest = (contents: string | Uint8Array): string =>
  createHash('sha256').update(contents).digest('hex');

/**
 * Compile the three unchanged Shadcn Collapsible parts as one project so the
 * generated Context key, anatomy family and transport modules stay shared by
 * reference across the entries, exactly as the project writer publishes them.
 */
export async function compileCollapsibleProject(): Promise<CollapsibleProject> {
  for (const [file, expected] of Object.entries(originalSources)) {
    if (digest(await readFile(path.join(repository, file))) !== expected)
      throw new Error(`Original Collapsible source differs from ${COLLAPSIBLE_SOURCE_REVISION}: ${file}`);
  }
  const entries = Object.values(COLLAPSIBLE_PARTS);
  const compilation = await compileProject({
    root: repository,
    entries,
    profile: COLLAPSIBLE_PROFILE,
    exportName: 'default',
    componentName: COLLAPSIBLE_COMPONENT_NAME,
  });
  if (!compilation.ok) {
    if (process.env.COMPILER_EVIDENCE_DIR) {
      const evidence = path.resolve(process.env.COMPILER_EVIDENCE_DIR, 'collapsible');
      await mkdir(evidence, { recursive: true });
      await writeFile(path.join(evidence, 'collapsible-compilation-rejection.json'), `${JSON.stringify({
        outcome: 'compilation-rejected',
        sourceRevision: COLLAPSIBLE_SOURCE_REVISION,
        originalSources,
        profile: COLLAPSIBLE_PROFILE,
        diagnostics: compilation.diagnostics,
      }, null, 2)}\n`);
    }
    throw new Error(
      `Collapsible project compilation failed: ${JSON.stringify(compilation.diagnostics, null, 2)}`
    );
  }
  const profile = compilation.value.entries[0].compilation.output.profile;
  const extension = path.posix.extname(generatedSourcePath(profile));
  const sourcePaths: Record<string, string> = {
    [COLLAPSIBLE_PARTS.root]: `CollapsibleRoot${extension}`,
    [COLLAPSIBLE_PARTS.trigger]: `CollapsibleTrigger${extension}`,
    [COLLAPSIBLE_PARTS.content]: `CollapsibleContent${extension}`,
  };
  const parent = path.join(repository, 'packages/compiler/test/generated-modules');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'collapsible-'));
  const output = path.join(directory, 'output');
  const written = await writeProjectCompilation(compilation.value, output, { sourcePaths });
  if (!written.ok)
    throw new Error(
      `Collapsible project write failed: ${JSON.stringify(written.diagnostics, null, 2)}`
    );
  const manifest: CollapsibleManifest = {
    sourceRevision: COLLAPSIBLE_SOURCE_REVISION,
    originalSources,
    publishedArtifacts: await Promise.all(written.value.files.map(async (file) => ({
      file: path.relative(output, file),
      sha256: digest(await readFile(file)),
    }))),
    profile,
    componentName: COLLAPSIBLE_COMPONENT_NAME,
    projectIdentity: compilation.value.identity,
    entries: {
      root: path.join(output, sourcePaths[COLLAPSIBLE_PARTS.root]),
      trigger: path.join(output, sourcePaths[COLLAPSIBLE_PARTS.trigger]),
      content: path.join(output, sourcePaths[COLLAPSIBLE_PARTS.content]),
    },
    compilation: compilation.value.entries.map((entry) => ({
      entry: entry.entry,
      profile: entry.compilation.output.profile,
      generatedFile: path.join(output, sourcePaths[entry.entry]),
      generatedSha256: digest(entry.compilation.output.code),
      dependencies: entry.compilation.output.dependencies,
      supportingFiles: (entry.compilation.output.supportingFiles ?? []).map((file) => ({
        path: file.path,
        kind: file.kind,
        sha256: digest(file.contents),
      })),
      sourceFiles: entry.compilation.ir.sourceFiles.map((file) => ({
        file: file.file,
        sha256: file.sha256,
      })),
      provenance: entry.compilation.output.provenance,
    })),
  };
  const manifestPath = path.join(directory, 'collapsible-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    directory,
    manifestPath,
    manifest,
    async remove() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}
