import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { buildButtonSsrFixture } from './button-ssr-fixture';

// Only the known generated Button closure is exportable. No directory traversal,
// filesystem copying or upload-artifact include-hidden-files expansion is involved.
const exportsByPath: Readonly<Record<string, { path: string; kind: string }>> = Object.freeze({
  'Component.ts': { path: 'Component.ts', kind: 'source' },
  'Component.client.ts': { path: 'Component.client.ts', kind: 'source' },
  'Component.css': { path: 'Component.css', kind: 'style' },
  'Component.environment.css': { path: 'Component.environment.css', kind: 'style' },
  'provenance.json': { path: 'provenance.json', kind: 'manifest' },
  '.proto-ui/context/scope-v1.ts': { path: 'helpers/context/scope-v1.ts', kind: 'source' },
  '.proto-ui/style/native-v1.ts': { path: 'helpers/style/native-v1.ts', kind: 'source' },
  '.proto-ui/interaction/native-v1.ts': {
    path: 'helpers/interaction/native-v1.ts',
    kind: 'source',
  },
  '.proto-ui/interaction/adapter-modules-v1.ts': {
    path: 'helpers/interaction/adapter-modules-v1.ts',
    kind: 'source',
  },
  '.proto-ui/web-component/ssr-v1.ts': { path: 'helpers/web-component/ssr-v1.ts', kind: 'source' },
});

export async function writeButtonSsrEvidenceArtifacts(
  compiled: Pick<
    Awaited<ReturnType<typeof buildButtonSsrFixture>>,
    'generatedFiles' | 'provenance'
  >,
  directory: string
) {
  if (compiled.provenance.profile !== 'web-component-ssr-v1')
    throw new Error('Evidence requires the generated WC SSR profile');
  const seen = new Set<string>();
  const expected = new Map(
    compiled.provenance.generatedFiles.map((file) => [file.path, file.sha256])
  );
  if (
    !compiled.generatedFiles.length ||
    expected.size !== compiled.provenance.generatedFiles.length ||
    expected.size !== compiled.generatedFiles.length
  )
    throw new Error('Generated evidence inventory differs');
  const entries = compiled.generatedFiles.map((file) => {
    const target = Object.hasOwn(exportsByPath, file.path) ? exportsByPath[file.path] : undefined;
    if (!target || target.kind !== file.kind || seen.has(file.path))
      throw new Error('Unadmitted generated evidence path/kind: ' + file.path);
    seen.add(file.path);
    const sha256 = createHash('sha256').update(file.contents).digest('hex');
    if (expected.get(file.path) !== sha256)
      throw new Error('Generated evidence bytes differ from provenance: ' + file.path);
    return { path: file.path, exportPath: target.path, sha256 };
  });
  for (const required of [
    'Component.ts',
    'Component.client.ts',
    'Component.css',
    'Component.environment.css',
    'provenance.json',
  ])
    if (!seen.has(required)) throw new Error('Generated evidence omits: ' + required);
  // Validate the whole input before creating any export file.
  for (let index = 0; index < entries.length; ++index) {
    const target = path.join(directory, entries[index].exportPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, compiled.generatedFiles[index].contents);
  }
  return entries;
}
