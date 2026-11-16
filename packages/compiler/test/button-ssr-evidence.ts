import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { buildButtonSsrFixture } from './button-ssr-fixture';
import { nativeSupportPlanFromFeatures } from '../src/native-support/plan';

// This fixture's semantic roots are fixed; only their canonical support identity
// is computed. A foreign hashed support file is never admitted by a wildcard.
export const buttonSsrSupportPlan = nativeSupportPlanFromFeatures([
  'trigger',
  'focus',
  'control-label',
]);
export const buttonSsrKernelPath = `.proto-ui/web-component/ssr-${buttonSsrSupportPlan.id}-v2.ts`;

// Only the known generated Button closure is exportable. No directory traversal,
// filesystem copying or upload-artifact include-hidden-files expansion is involved.
const exportsByPath: Readonly<Record<string, { path: string; kind: string }>> = Object.freeze({
  'Component.ts': { path: 'Component.ts', kind: 'source' },
  'Component.client.ts': { path: 'Component.client.ts', kind: 'source' },
  'Component.css': { path: 'Component.css', kind: 'style' },
  'Component.environment.css': { path: 'Component.environment.css', kind: 'style' },
  'provenance.json': { path: 'provenance.json', kind: 'manifest' },
  '.proto-ui/owner/authored-hooks-v1.ts': {
    path: 'helpers/owner/authored-hooks-v1.ts',
    kind: 'source',
  },
  '.proto-ui/context/scope-v1.ts': { path: 'helpers/context/scope-v1.ts', kind: 'source' },
  '.proto-ui/style/native-v1.ts': { path: 'helpers/style/native-v1.ts', kind: 'source' },
  [buttonSsrSupportPlan.interactionPath]: {
    path: buttonSsrSupportPlan.interactionPath.replace('.proto-ui/', 'helpers/'),
    kind: 'source',
  },
  [buttonSsrSupportPlan.modulesPath]: {
    path: buttonSsrSupportPlan.modulesPath.replace('.proto-ui/', 'helpers/'),
    kind: 'source',
  },
  '.proto-ui/interaction/ownership-v2.ts': {
    path: 'helpers/interaction/ownership-v2.ts',
    kind: 'source',
  },
  '.proto-ui/interaction/control-label-v1.ts': {
    path: 'helpers/interaction/control-label-v1.ts',
    kind: 'source',
  },
  '.proto-ui/interaction/control-label-types-v1.ts': {
    path: 'helpers/interaction/control-label-types-v1.ts',
    kind: 'source',
  },
  '.proto-ui/interaction/focus-ownership-v2.ts': {
    path: 'helpers/interaction/focus-ownership-v2.ts',
    kind: 'source',
  },
  [buttonSsrKernelPath]: {
    path: buttonSsrKernelPath.replace('.proto-ui/', 'helpers/'),
    kind: 'source',
  },
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
  for (const required of Object.keys(exportsByPath))
    if (!seen.has(required)) throw new Error('Generated evidence omits: ' + required);
  // Validate the whole input before creating any export file.
  for (let index = 0; index < entries.length; ++index) {
    const target = path.join(directory, entries[index].exportPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, compiled.generatedFiles[index].contents);
  }
  return entries;
}
