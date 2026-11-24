import ts from 'typescript';
import { canonicalWebHostSources } from './web-host-sources.generated';
import {
  mapSupportImports,
  parseSupportTemplate,
  printSupport,
  selectSupportDeclarations,
} from './template-ast';

const files = {
  positioning: 'packages/core/src/positioning.ts',
  overlay: 'packages/core/src/overlay.ts',
  anatomy: 'packages/core/src/anatomy.ts',
  anatomyPort: 'packages/modules/anatomy/src/types.ts',
  boundaryPort: 'packages/modules/boundary/src/types.ts',
  caps: 'packages/modules/positioning/src/caps.ts',
  binding: 'packages/modules/overlay/src/target-alignment-binding.ts',
  geometry: 'packages/modules/positioning/src/geometry/target-alignment.ts',
  host: 'packages/modules/positioning/src/web/target-alignment-host.ts',
  sizing: 'packages/modules/positioning/src/web/border-box-size-lease.ts',
  style: 'packages/modules/positioning/src/web/owned-style-lease.ts',
} as const;
const sources = new Map<string, { file: string; sha256: string; contents: string }>(
  canonicalWebHostSources.map((source) => [source.file, source])
);
function source(file: string) {
  const value = sources.get(file);
  if (!value) throw new Error(`Missing canonical alignment source ${file}.`);
  return value;
}
export function webTargetAlignmentSourceInputs() {
  return Object.values(files)
    .sort()
    .map((file) => ({ file, sha256: source(file).sha256 }));
}
const paths = new Map([
  ['@proto.ui/core', './declarations-v1'],
  ['@proto.ui/module-anatomy', './declarations-v1'],
  ['@proto.ui/module-boundary', './declarations-v1'],
  ['../caps', './declarations-v1'],
  ['./owned-style-lease', './owned-style-lease-v1'],
  ['./border-box-size-lease', './border-box-size-lease-v1'],
  ['../geometry/target-alignment', './geometry-v1'],
]);
function selected(file: string, names: readonly string[]) {
  const parsed = parseSupportTemplate(
    selectSupportDeclarations(source(file).contents, names, true)
  );
  const transformed = ts.transform(parsed, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isImportTypeNode(node) &&
          ts.isLiteralTypeNode(node.argument) &&
          ts.isStringLiteral(node.argument.literal) &&
          ['@proto.ui/core', './anatomy', './positioning'].includes(node.argument.literal.text) &&
          node.qualifier &&
          ts.isIdentifier(node.qualifier)
        )
          return ts.factory.createTypeReferenceNode(node.qualifier, node.typeArguments);
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);
  try {
    return printSupport(transformed.transformed[0]);
  } finally {
    transformed.dispose();
  }
}
/** Project only the private port methods used by the unchanged canonical binding. */
function port(file: string, name: string, members: readonly string[]) {
  const parsed = parseSupportTemplate(source(file).contents);
  const declaration = parsed.statements.find(
    (node): node is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(node) && node.name.text === name
  );
  const shape =
    declaration &&
    ts.isIntersectionTypeNode(declaration.type) &&
    declaration.type.types.find(ts.isTypeLiteralNode);
  if (!shape) throw new Error(`Missing canonical port shape ${name}.`);
  const wanted = new Set(members);
  const fields = shape.members.filter(
    (member) => member.name && ts.isIdentifier(member.name) && wanted.delete(member.name.text)
  );
  if (wanted.size) throw new Error(`Missing canonical ${name} members: ${[...wanted].join(', ')}.`);
  return printSupport(parsed, [
    ts.factory.createInterfaceDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      name,
      undefined,
      undefined,
      fields
    ),
  ]);
}
function artifact(name: string, contents: string) {
  return { path: `.proto-ui/target-alignment/${name}-v1.ts`, kind: 'source' as const, contents };
}
function canonical(name: string, file: string) {
  const input = source(file);
  return artifact(
    name,
    `// Canonical neutral alignment: ${file}\n// sha256: ${input.sha256}\n` +
      mapSupportImports(input.contents, paths)
  );
}

export function webTargetAlignmentArtifacts() {
  const declarations = [
    '// Native identity bridge; no author-visible physical target or semantic selection policy.\n',
    "import type { NativeAnatomyFamily as AnatomyFamily } from '../interaction/ownership-v2';\nexport type { AnatomyFamily };\nexport type Unsubscribe = () => void;\n",
    selected(files.anatomy, ['AnatomyPartView']),
    selected(files.positioning, [
      'AnchoredPositionSide',
      'AnchoredPositionAlign',
      'AnchoredPositionStrategy',
      'AnchoredCollisionBoundary',
      'AnchoredPositionConfig',
      'AnchoredPositionSnapshot',
      'TargetAlignmentConstraints',
      'TargetAlignmentStatus',
      'TargetAlignmentConnection',
      'AnchoredPositionConnection',
    ]),
    selected(files.overlay, ['OverlayTargetAlignmentBinding']),
    selected(files.caps, ['AnchoredPositionHostLease']),
    selected(files.anatomyPort, ['AnatomyOrderCallbackCtx', 'AnatomyOrderChangeCb']),
    port(files.anatomyPort, 'AnatomyPort', [
      'subscribeTargets',
      'isCurrentPart',
      'resolvePartInstance',
      'descendantsOf',
      'resolveSelfRole',
      'resolveAncestorInstance',
      'resolveSelfInstance',
      'resolvePartTarget',
    ]),
    port(files.boundaryPort, 'BoundaryPort', ['replaceImplicitRoot']),
  ].join('\n');
  return [
    artifact('declarations', declarations),
    canonical('overlay-binding', files.binding),
    canonical('geometry', files.geometry),
    canonical('host', files.host),
    canonical('border-box-size-lease', files.sizing),
    canonical('owned-style-lease', files.style),
  ];
}
