import { canonicalWebHostSources } from './web-host-sources.generated';
import { mapSupportImports } from './template-ast';

const file = 'packages/adapters/base/src/platform/web-owned-decoration-stage.ts';
function source() {
  const value = canonicalWebHostSources.find((source) => source.file === file);
  if (!value) throw new Error('Canonical owned-decoration stage asset is missing.');
  return value;
}
export function webDecorationSourceInputs() {
  return [{ file, sha256: source().sha256 }];
}
export function webDecorationArtifacts() {
  const input = source();
  return [
    {
      path: '.proto-ui/style/owned-decoration-types-v1.ts',
      kind: 'source' as const,
      contents: `export type OwnedDecorationTarget = Readonly<object>;
export type OwnedDecorationBinding = { target: OwnedDecorationTarget; sink(value: Readonly<{ kind: 'tw'; tokens: readonly string[] }>): void };
`,
    },
    {
      path: '.proto-ui/style/owned-decoration-stage-v1.ts',
      kind: 'source' as const,
      contents:
        `// Canonical physical stage: ${file}\n// sha256: ${input.sha256}\n` +
        mapSupportImports(
          input.contents,
          new Map([
            ['@proto.ui/core', './owned-decoration-types-v1'],
            ['@proto.ui/module-feedback', './owned-decoration-types-v1'],
          ])
        ),
    },
  ];
}
