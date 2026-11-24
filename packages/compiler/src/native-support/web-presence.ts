import ts from 'typescript';
import { canonicalWebHostSources } from './web-host-sources.generated';
import {
  mapSupportImports,
  parseSupportTemplate,
  printSupport,
  selectSupportDeclarations,
} from './template-ast';
import { webHostPrimitiveArtifacts, webHostSourceInputs } from './web-host-primitives';

const files = {
  declaration: 'packages/core/src/presence-presentation.ts',
  motionDeclaration: 'packages/core/src/resident-motion.ts',
  effects: 'packages/core/src/effects/types.ts',
  style: 'packages/core/src/spec/feedback/style.ts',
  controller: 'packages/modules/feedback/src/presence/controller.ts',
  projector: 'packages/modules/feedback/src/presence/projector.ts',
  sink: 'packages/modules/feedback/src/presence/sink.ts',
  sampler: 'packages/modules/feedback/src/motion/sampler.ts',
  web: 'packages/adapters/base/src/motion/web-presence-presentation.ts',
  styleOwnership: 'packages/adapters/base/src/motion/web-motion-style-ownership.ts',
  steps: 'packages/adapters/base/src/host/synchronous-steps.ts',
  visibility: 'packages/adapters/base/src/host/view-visibility.ts',
  preference: 'packages/adapters/base/src/platform/web-preference-source.ts',
} as const;
const sources = new Map<string, { file: string; sha256: string; contents: string }>(
  canonicalWebHostSources.map((source) => [source.file, source])
);
function source(file: string) {
  const value = sources.get(file);
  if (!value) throw new Error(`Missing canonical presence source ${file}.`);
  return value;
}
export function webPresenceSourceInputs() {
  const inputs = [
    ...Object.values(files).map((file) => {
      const { sha256 } = source(file);
      return { file, sha256 };
    }),
    ...webHostSourceInputs(['translation']),
  ];
  return [...new Map(inputs.map((input) => [input.file, input])).values()].sort((a, b) =>
    a.file.localeCompare(b.file)
  );
}
const paths = new Map([
  ['@proto.ui/core', './declarations-v1'],
  ['./sink', './sink-v1'],
  ['../motion/sampler', './sampler-v1'],
  ['@proto.ui/module-feedback', './projector-v1'],
  ['@proto.ui/module-positioning', '../host-web/translation-composition-v1'],
  ['../platform/web-preference-source', './preferences-v1'],
  ['./web-motion-style-ownership', './motion-style-ownership-v1'],
  ['../host/synchronous-steps', './synchronous-steps-v1'],
  ['../host/view-visibility', './view-visibility-v1'],
]);
function retarget(contents: string) {
  const parsed = parseSupportTemplate(mapSupportImports(contents, paths));
  const transformed = ts.transform(parsed, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isImportTypeNode(node) &&
          ts.isLiteralTypeNode(node.argument) &&
          ts.isStringLiteral(node.argument.literal) &&
          node.argument.literal.text === '@proto.ui/core'
        )
          return ts.factory.updateImportTypeNode(
            node,
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral('./declarations-v1')),
            node.attributes,
            node.qualifier,
            node.typeArguments,
            node.isTypeOf
          );
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
  return { path: `.proto-ui/presence/${name}-v1.ts`, kind: 'source' as const, contents };
}
function selected(file: string, names: readonly string[]) {
  return selectSupportDeclarations(source(file).contents, names, true);
}
function canonical(name: string, file: string) {
  const input = source(file);
  return artifact(
    name,
    `// Canonical neutral presentation: ${file}\n// sha256: ${input.sha256}\n` +
      retarget(input.contents)
  );
}

/** Closed trusted host source assets. No prototype source or runtime module is bundled. */
export function webPresenceArtifacts() {
  const declarations = [
    '// Neutral declarations; lexical owner/State identity is checked by the canonical controller.\n',
    'export type State<T> = Readonly<{ get(): T }>;\n',
    'export interface PresenceOwnerDeclaration<Props = unknown> { readonly ref: PresentationOwnerRef; readonly writer: PresentationOwnerWriter; onCompletionRequest(callback: (run: any, request: CompletionRequest) => void): void; }\n',
    selected(files.declaration, [
      'PresencePhase',
      'AffineLength',
      'Translation',
      'FiniteSelection',
      'PresenceEndpoint',
      'PresentationChannel',
      'PresentationOutcome',
      'ownerRefBrand',
      'ownerWriterBrand',
      'viewBindingBrand',
      'PresentationOwnerRef',
      'PresentationOwnerWriter',
      'PresentationViewBinding',
      'AttemptToken',
      'PresentationOwnerFrame',
      'PresentationReceipt',
      'PresencePresentationDeclaration',
      'PresentationCompletionConfig',
      'CompletionRequest',
      'fail',
      'object',
      'field',
      'shape',
      'finite',
      'nonnegative',
      'integer',
      'dense',
      'affine',
      'translation',
      'selectedTranslation',
      'endpoint',
      'snapshotPresencePresentation',
      'snapshotPresentationCompletionConfig',
      'snapshotPresentationOwnerFrame',
    ]),
    selected(files.style, ['StyleHandle']),
    selected(files.effects, ['EffectsPort']),
    source(files.motionDeclaration).contents,
  ].join('\n');
  const sink =
    `import type { PresenceEndpoint, PresentationOwnerFrame, PresentationViewBinding, PresentationOutcome, StyleHandle } from './declarations-v1';\n` +
    retarget(
      selected(files.sink, [
        'ResolvedPresenceEndpoint',
        'PresencePresentationFrame',
        'PresencePresentationSink',
      ])
    );
  const projector = canonical('projector', files.projector);
  projector.contents +=
    "\nexport type { PresencePresentationSink, PresencePresentationFrame } from './sink-v1';\n";
  return [
    ...webHostPrimitiveArtifacts(['translation']),
    artifact('declarations', declarations),
    artifact('sink', sink),
    canonical('controller', files.controller),
    projector,
    canonical('sampler', files.sampler),
    canonical('web', files.web),
    canonical('motion-style-ownership', files.styleOwnership),
    canonical('synchronous-steps', files.steps),
    canonical('view-visibility', files.visibility),
    canonical('preferences', files.preference),
  ];
}

export const nativePresencePresentationArtifact = {
  path: '.proto-ui/async/presence-presentation-v1.ts',
  kind: 'source' as const,
  contents: `import { createPresenceController } from '../presence/controller-v1';
import { createWebPresencePresentationSink } from '../presence/web-v1';
import type { PresencePresentationDeclaration, PresentationOwnerFrame, PresentationOwnerWriter, PresentationReceipt, PresentationOutcome, State } from '../presence/declarations-v1';
import type { NativePresenceOwner, NativePresentationFrame, NativePresentationReceipt, NativePresentationOutcome } from './presence-owner-v1';

/** Bridge only: the canonical controller/projector remains the presentation policy. */
export function createNativePresencePresentation<Run>(options: {
  setup(): void; runtime(): void; alive(): boolean;
  invoke(callback: (run: Run) => void): void;
  root(): HTMLElement | null;
  tokens(): readonly string[];
  project(tokens: readonly string[]): void;
  watch(source: object, callback: () => void): () => void;
}) {
  let mounted = false, disposed = false, epoch = 0, revision = 0;
  let sink: ReturnType<typeof createWebPresencePresentationSink> | null = null;
  let target: HTMLElement | null = null;
  let callbackRun: Run | undefined;
  const controller = createPresenceController({
    setup() { options.setup(); if (disposed || !options.alive()) throw new Error('[Presence] owner is disposed'); },
    runtime() { options.runtime(); if (disposed || !options.alive()) throw new Error('[Presence] owner is disposed'); },
    invalidate: refresh,
    dispatch(callback) { options.invoke(run => { const previous = callbackRun; callbackRun = run; try { callback(); } finally { callbackRun = previous; } }); },
    callbackContext: () => callbackRun,
    watch: (state, callback) => options.watch(state, callback),
    sink() {
      const root = options.root();
      if (!mounted || !root || disposed || !options.alive()) return null;
      if (target !== root) { sink?.release(epoch); sink = null; target = root; }
      if (!sink) {
        let pending: readonly string[] = [];
        sink = createWebPresencePresentationSink(root, {
          queueStyle(style) { pending = style.tokens; },
          requestFlush() { if (mounted && target === root && options.alive()) options.project(pending); },
        });
      }
      return sink;
    },
    fallback: style => options.project(style.tokens),
  });
  function refresh() {
    if (!mounted || disposed || !options.alive() || !options.root()) return;
    controller.commit({ kind: 'tw', tokens: [...options.tokens()] }, epoch, ++revision);
  }
  function detach() {
    mounted = false;
    try { controller.release(); } finally { sink = null; target = null; }
  }
  return {
    owner(): NativePresenceOwner<Run> { return controller.facade.owner() as unknown as NativePresenceOwner<Run>; },
    registerSource(source: object) { controller.facade.registerSource(source); },
    declare(value: unknown) { return controller.declare(value as PresencePresentationDeclaration); },
    publish(writer: object, frame: NativePresentationFrame) { controller.facade.publish(writer as PresentationOwnerWriter, frame as PresentationOwnerFrame); },
    isCurrent(writer: object, receipt: NativePresentationReceipt) { return controller.facade.isCurrent(writer as PresentationOwnerWriter, receipt as PresentationReceipt); },
    settle(writer: object, outcome: NativePresentationOutcome) { controller.facade.settle(writer as PresentationOwnerWriter, outcome as PresentationOutcome); },
    mount(nextEpoch: number) { if (disposed) return; if (mounted && nextEpoch !== epoch) detach(); epoch = nextEpoch; mounted = true; refresh(); },
    refresh, detach,
    dispose() { if (disposed) return; disposed = true; mounted = false; try { controller.dispose(); } finally { sink = null; target = null; } },
  };
}
`,
};
