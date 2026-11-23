import ts from 'typescript';
import { canonicalWebHostSources } from './web-host-sources.generated';
import {
  mapSupportImports,
  parseSupportTemplate,
  printSupport,
  selectSupportDeclarations,
} from './template-ast';

export type WebHostPrimitive = 'axis-input' | 'available-space' | 'translation';
export type WebHostSourceInput = { file: string; sha256: string };
const sources = new Map(canonicalWebHostSources.map((source) => [source.file, source]));
const axis = 'packages/adapters/base/src/gestures/';
const positioning = 'packages/modules/positioning/src/';
const core = 'packages/core/src/';
const input = (file: string) => {
  const source = sources.get(file as (typeof canonicalWebHostSources)[number]['file']);
  if (!source) throw new Error(`Undeclared canonical native host input ${file}.`);
  return source;
};
const commonTypes = [
  core + 'presence-presentation.ts',
  core + 'axis-input.ts',
  core + 'move.ts',
  core + 'positioning.ts',
  positioning + 'caps.ts',
];
const axisInputs = [
  core + 'axis-input.ts',
  core + 'move.ts',
  axis + 'web-axis-input-host.ts',
  axis + 'web-move-gesture-host.ts',
  axis + 'web-move-click-arbitration.ts',
  'packages/adapters/base/src/events/pointer-sample.ts',
];
const availableInputs = [
  core + 'positioning.ts',
  positioning + 'caps.ts',
  positioning + 'available-layout.ts',
  positioning + 'web/available-layout-host.ts',
  positioning + 'web/available-space-host.ts',
  positioning + 'web/root-space-observer.ts',
];
const translationInput = positioning + 'web/translation-composition.ts';

export function webHostSourceInputs(features: Iterable<WebHostPrimitive>): WebHostSourceInput[] {
  const selected = new Set(features),
    files = new Set<string>();
  if (!selected.size) return [];
  for (const file of commonTypes) files.add(file);
  if (selected.has('axis-input')) for (const file of axisInputs) files.add(file);
  if (selected.has('available-space')) for (const file of availableInputs) files.add(file);
  if (selected.has('available-space') || selected.has('translation')) {
    files.add(translationInput);
  }
  return [...files].sort().map((file) => {
    const { sha256 } = input(file);
    return { file, sha256 };
  });
}

const paths = new Map([
  ['@proto.ui/core', './types-v1'],
  ['../caps', './types-v1'],
  ['../available-layout', './available-layout-model-v1'],
  ['./web-move-gesture-host', './move-gesture-v1'],
  ['./web-move-click-arbitration', './move-click-arbitration-v1'],
  ['../events/pointer-sample', './pointer-sample-v1'],
  ['./translation-composition', './translation-composition-v1'],
  ['./available-layout-host', './available-layout-v1'],
  ['./root-space-observer', './root-space-observer-v1'],
]);
function selectedTypes(file: string, names: readonly string[]): string {
  const raw = selectSupportDeclarations(input(file).contents, names, true);
  const source = parseSupportTemplate(raw);
  const transformed = ts.transform(source, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isImportTypeNode(node) &&
          ts.isLiteralTypeNode(node.argument) &&
          ts.isStringLiteral(node.argument.literal) &&
          node.argument.literal.text === '@proto.ui/core' &&
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
function artifact(name: string, contents: string) {
  return { path: `.proto-ui/host-web/${name}-v1.ts`, kind: 'source' as const, contents };
}
function sourceArtifact(name: string, file: string) {
  const source = input(file);
  return artifact(
    name,
    `// Canonical neutral host: ${file}\n// sha256: ${source.sha256}\n` +
      mapSupportImports(source.contents, paths)
  );
}

/** Only trusted host files enter here. Component source still uses the checked IR pipeline. */
export function webHostPrimitiveArtifacts(features: Iterable<WebHostPrimitive>) {
  const selected = new Set(features);
  if (!selected.size) return [];
  const files: ReturnType<typeof artifact>[] = [];
  let types = '// Neutral host contracts selected from the canonical Core declarations.\n';
  // Host layout only observes a handle. It never receives semantic State write authority.
  types += 'export type State<V> = Readonly<{ get(): V }>;\n';
  types += selectedTypes(core + 'move.ts', [
    'MoveGesturePoint',
    'MoveGestureAxis',
    'MoveGestureInput',
    'MoveGestureActivation',
    'MoveGestureSample',
    'MoveGestureCancelReason',
    'MoveGestureHostBinding',
    'MoveGestureHostLease',
    'MoveGestureHost',
  ]);
  types += selectedTypes(core + 'axis-input.ts', [
    'AxisInputSample',
    'AxisInputCancelReason',
    'AxisInputConfig',
    'AxisInputHostBinding',
    'AxisInputHostLease',
    'AxisInputHost',
  ]);
  types += selectedTypes(core + 'positioning.ts', [
    'AvailableSpaceRect',
    'AvailableSpaceFrame',
    'AvailableSpaceConnection',
    'AvailableLayoutEdge',
    'AvailableLayoutExtent',
    'AvailableLayoutUnit',
    'AvailableLayoutLength',
    'AvailableLayoutSnapshot',
    'AvailableLayoutFrame',
    'AvailableLayoutValue',
    'AvailableLayoutLengthBinding',
    'AvailableLayoutBinding',
  ]);
  types += selectedTypes(positioning + 'caps.ts', [
    'AvailableSpaceHostConnection',
    'AvailableSpaceHostLease',
    'AvailableSpaceHost',
  ]);
  types += selectedTypes(core + 'presence-presentation.ts', ['AffineLength', 'Translation']);
  if (selected.has('axis-input')) {
    files.push(
      sourceArtifact('pointer-sample', 'packages/adapters/base/src/events/pointer-sample.ts'),
      sourceArtifact('move-click-arbitration', axis + 'web-move-click-arbitration.ts'),
      sourceArtifact('move-gesture', axis + 'web-move-gesture-host.ts'),
      sourceArtifact('axis-input', axis + 'web-axis-input-host.ts')
    );
  }
  if (selected.has('available-space')) {
    files.push(
      sourceArtifact('available-layout-model', positioning + 'available-layout.ts'),
      sourceArtifact('root-space-observer', positioning + 'web/root-space-observer.ts'),
      sourceArtifact('available-layout', positioning + 'web/available-layout-host.ts'),
      sourceArtifact('available-space', positioning + 'web/available-space-host.ts')
    );
  }
  if (selected.has('available-space') || selected.has('translation')) {
    files.push(sourceArtifact('translation-composition', translationInput));
  }
  files.unshift(artifact('types', types));
  return files;
}

const viewVisibilityInput = 'packages/adapters/base/src/host/view-visibility.ts';
/** Shared paint/AX/tab suppression for a retained physical view. */
export function webViewVisibilitySourceInputs(): WebHostSourceInput[] {
  const { file, sha256 } = input(viewVisibilityInput);
  return [{ file, sha256 }];
}
export function webViewVisibilityArtifact() {
  return sourceArtifact('view-visibility', viewVisibilityInput);
}
