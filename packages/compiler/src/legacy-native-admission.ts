import path from 'node:path';
import ts from 'typescript';
import type { OutputArtifact } from './artifact-output';
import { isLocalSourceSpecifier, localSourceCandidates } from './source-resolution';

// The frozen v1 component uses these standard utility types in its JSDoc owner
// declaration. They let us resolve the original imported API without reading a
// package, loading ambient project types, or evaluating an artifact.
const ambient = `
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Record<K extends keyof any, T> = { [P in K]: T };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Exclude<T, U> = T extends U ? never : T;
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
`;
const nativeDeclarations = new Set([
  '/.proto-ui/interaction/native-v1.ts',
  '/.proto-ui/interaction/adapter-modules-v1.ts',
]);

function removedMember(node: ts.Node): ts.Node | undefined {
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'asTransition')
    return node.expression;
  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === 'asTransition'
  )
    return node.expression;
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const name = node.propertyName ?? node.name;
    if ((ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text === 'asTransition')
      return node.parent;
  }
  return undefined;
}

/** Recognized v1 artifacts may retain APIs absent from the current host ABI.
 * Check the actual imported declaration, not a method's spelling or debug name.
 * This is migration admission for original generated artifacts, not arbitrary
 * JavaScript validation. All files have already passed the provenance snapshot.
 */
export function assertNoRemovedLegacyNativeProtocol(artifacts: readonly OutputArtifact[]): void {
  const sources = new Map<string, ts.SourceFile>();
  const candidates: { node: ts.Node; receiver: ts.Node; file: ts.SourceFile }[] = [];
  for (const artifact of artifacts) {
    if (artifact.kind !== 'source' || !/\.(?:ts|js)$/.test(artifact.path)) continue;
    const file = ts.createSourceFile(
      '/' + artifact.path,
      artifact.contents,
      ts.ScriptTarget.Latest,
      true
    );
    sources.set(file.fileName, file);
    if (artifact.path.startsWith('.proto-ui/')) continue;
    const visit = (node: ts.Node) => {
      const receiver = removedMember(node);
      if (receiver) candidates.push({ node, receiver, file });
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  if (!candidates.length) return;
  const ambientFile = ts.createSourceFile(
    '/native-migration-ambient.d.ts',
    ambient,
    ts.ScriptTarget.Latest,
    true
  );
  sources.set(ambientFile.fileName, ambientFile);
  const options: ts.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    noLib: true,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (filename) => sources.get(filename);
  host.fileExists = (filename) => sources.has(filename);
  host.readFile = (filename) => sources.get(filename)?.text;
  host.getCurrentDirectory = () => '/';
  host.resolveModuleNames = (specifiers, containing) =>
    specifiers.map((specifier) => {
      if (!isLocalSourceSpecifier(specifier)) return undefined;
      const base = path.posix.resolve(path.posix.dirname(containing), specifier);
      const filename = localSourceCandidates(base).find((candidate) => sources.has(candidate));
      if (!filename) return undefined;
      return {
        resolvedFileName: filename,
        extension: filename.endsWith('.ts') ? ts.Extension.Ts : ts.Extension.Js,
      };
    });
  const checker = ts.createProgram([...sources.keys()], options, host).getTypeChecker();
  for (const { node, receiver, file } of candidates) {
    const member = checker.getTypeAtLocation(receiver).getProperty('asTransition');
    if (
      !member?.declarations?.some((declaration) =>
        nativeDeclarations.has(declaration.getSourceFile().fileName)
      )
    )
      continue;
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
    throw new Error(
      `Legacy asTransition host protocol requires recompiling its authored source; it cannot be linked to native support v2 (${file.fileName.slice(1)}:${line + 1}:${character + 1}).`
    );
  }
}
