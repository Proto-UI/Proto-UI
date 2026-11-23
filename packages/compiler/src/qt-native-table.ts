import ts from 'typescript';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';

// The compiler's own pure implementation is trusted source, not author input.
// Preserve one table algorithm across emitted DOM and Qt host modules.
let cached: string | undefined;
export function qtTableProjectionSource(): string {
  if (cached !== undefined) return cached;
  const tree = ts.createSourceFile(
    'adapter-modules-v1.ts',
    nativeAdapterModulesArtifact.contents,
    ts.ScriptTarget.Latest,
    true
  );
  const projection = tree.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'projectNativeTable'
  );
  if (!projection) throw new Error('Missing canonical native table projection');
  return (cached = ts.transpileModule('export ' + projection.getText(tree), {
    fileName: 'QtTableProjection.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.ESNext },
  }).outputText);
}
