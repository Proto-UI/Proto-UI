import type { MountPhase, ProtoPhase, StyleHandle } from '@proto.ui/core';
import {
  illegalPhase,
  snapshotMaterialCandidate,
  snapshotMaterialSlot,
  type MaterialCandidate,
  type MaterialSlot,
  type MaterialIntentFrame,
} from '@proto.ui/core';
import { FeedbackStyleRecorder } from '@proto.ui/core';

import { createModule, defineModule, ModuleBase } from '@proto.ui/module-base';
import type { ModuleFactoryArgs } from '@proto.ui/module-base';

import type {
  FeedbackFacade,
  FeedbackModule,
  FeedbackPort,
  FeedbackRuntimeStyleDisposer,
} from './types';
import { EFFECTS_CAP } from './caps';
import { VISUAL_FEEDBACK_SINK_CAP, type VisualFeedbackSink } from './material/shared-sink';
import { OWNED_MATERIAL_ID } from './material/declaration-id';
import {
  MATERIAL_BINDING_FACTORY_CAP,
  type MaterialBinding,
  type MaterialBindingFactory,
} from './material/runtime-cap';
import {
  FINAL_STYLE_SINK_CAP,
  finalStyleFrame,
  type FinalStyleSink,
} from './material/final-style-sink';

export function createFeedbackModule(ctx: ModuleFactoryArgs): FeedbackModule {
  const { init, caps, deps } = ctx;

  return createModule<'feedback', 'instance', FeedbackFacade, FeedbackPort>({
    name: 'feedback',
    scope: 'instance',
    init,
    caps,
    deps,
    build: ({ init, caps }) => {
      class Impl extends ModuleBase {
        private recorder = new FeedbackStyleRecorder();
        private dirty = false;
        private flushRequested = false;
        private disposed = false;
        private viewEpoch = 0;
        private visualRevision = 0;
        private visualSink: FinalStyleSink | VisualFeedbackSink | null = null;
        private visualSinkView = 0;
        private pendingProjection: StyleHandle | null = null;
        private material: MaterialBinding | null = null;
        private materialFactory: MaterialBindingFactory | null = null;
        private sharedSlot: MaterialSlot | null = null;
        private materialContributions = new Map<object, readonly MaterialCandidate[]>();

        declareMaterial(slot: MaterialSlot): () => void {
          this.ensureSetup('def.feedback.material.declare');
          if (this.sharedSlot || init.declarations.some((item) => item.id === OWNED_MATERIAL_ID))
            throw new Error('One material slot per instance; private and shared slots cannot mix');
          const owned = snapshotMaterialSlot(slot);
          this.sharedSlot = owned;
          this.markDirty();
          return () => {
            this.ensureSetup('def.feedback.material.declare:dispose');
            if (this.sharedSlot !== owned) return;
            this.sharedSlot = null;
            this.materialContributions.clear();
            this.markDirty();
          };
        }

        useMaterial(candidate: MaterialCandidate): () => void {
          this.ensureSetup('def.feedback.material.use');
          if (!this.sharedSlot) throw new Error('Declare the material slot before contributing');
          const key = {};
          this.materialContributions.set(key, [snapshotMaterialCandidate(candidate)]);
          this.markDirty();
          return () => {
            this.ensureSetup('def.feedback.material.use:dispose');
            if (this.materialContributions.delete(key)) this.markDirty();
          };
        }

        exportMaterialFrame(): MaterialIntentFrame {
          return Object.freeze({
            slot: this.sharedSlot,
            candidates: Object.freeze(
              this.sharedSlot ? [...this.materialContributions.values()].flat() : []
            ),
          });
        }

        materialDiagnostics(): readonly string[] {
          return Object.freeze(
            this.sharedSlot && !this.caps.has(VISUAL_FEEDBACK_SINK_CAP)
              ? ['material-host-unavailable']
              : []
          );
        }

        replaceVisualRuntime(
          previous: FeedbackRuntimeStyleDisposer | null,
          handles: readonly StyleHandle[],
          candidates: readonly MaterialCandidate[]
        ): FeedbackRuntimeStyleDisposer | null {
          this.ensureRuntime('rule.feedback.visual.replace');
          if (candidates.length && !this.sharedSlot)
            throw new Error('Material Rule requires a declared slot');
          // Validate complete replacements before retiring the previous owner.
          const copied = candidates.map(snapshotMaterialCandidate);
          const unUse = handles.length ? this.recorder.use(...handles) : null;
          const key = {};
          previous?.({ flush: false });
          if (copied.length) this.materialContributions.set(key, copied);
          this.markDirty();
          try {
            this.flushIfPossible();
          } catch (error) {
            queueMicrotask(() => {
              throw error;
            });
          }
          if (!unUse && !copied.length) return null;
          let removed = false;
          return (options = {}) => {
            if (this.disposed || removed) return;
            removed = true;
            unUse?.();
            this.materialContributions.delete(key);
            this.markDirty();
            if (options.flush !== false) this.flushIfPossible();
          };
        }

        /** setup-only */
        useStyle(handles: StyleHandle[]): () => void {
          this.ensureSetup('def.feedback.style.use');

          const unUse = this.recorder.use(...handles);
          this.markDirty();

          return () => {
            this.ensureSetup('def.feedback.style.unUse');
            unUse();
            this.markDirty();
          };
        }

        /** internal runtime base style contribution, used by rule execution */
        useStyleRuntime(handles: StyleHandle[]): FeedbackRuntimeStyleDisposer {
          const op = 'rule.feedback.style.use';
          this.ensureNotDisposed(op);
          if (this.protoPhase === 'setup') {
            throw illegalPhase(op, this.protoPhase, {
              prototypeName: init.prototypeName,
              hint: `Use 'def' only during setup.`,
            });
          }

          const unUse = this.recorder.use(...handles);
          this.markDirty();
          this.flushIfPossible();

          return this.createRuntimeStyleDisposer(unUse);
        }

        replaceStyleRuntime(
          previous: FeedbackRuntimeStyleDisposer | null,
          handles: StyleHandle[]
        ): FeedbackRuntimeStyleDisposer | null {
          const op = 'rule.feedback.style.replace';
          this.ensureNotDisposed(op);
          if (this.protoPhase === 'setup') {
            throw illegalPhase(op, this.protoPhase, {
              prototypeName: init.prototypeName,
              hint: `Use 'def' only during setup.`,
            });
          }

          previous?.({ flush: false });
          const next = handles.length > 0 ? this.recorder.use(...handles) : null;
          this.markDirty();
          try {
            this.flushIfPossible();
          } catch (error) {
            // Rule's semantic replacement is complete even if the host fails.
            // Return its disposer so subsequent evaluations can remove it, and
            // let later semantic observers run. Projection remains retryable.
            queueMicrotask(() => {
              throw error;
            });
          }
          return next ? this.createRuntimeStyleDisposer(next) : null;
        }

        /** runtime-only public patch API */
        patchStyle(handles: StyleHandle[]): void {
          const op = 'run.feedback.style.patch';
          this.ensureRuntime(op);
          this.recorder.patch(...handles);
          this.markDirty();
          this.flushIfPossible();
        }

        /** runtime-only public suppress API */
        suppressStyle(handles: StyleHandle[]): void {
          const op = 'run.feedback.style.suppress';
          this.ensureRuntime(op);
          this.recorder.suppress(...handles);
          this.markDirty();
          this.flushIfPossible();
        }

        /** runtime-only public clear API */
        clearStylePatch(): void {
          const op = 'run.feedback.style.clearPatch';
          this.ensureRuntime(op);
          this.recorder.clearPatch();
          this.markDirty();
          this.flushIfPossible();
        }

        /** internal: record tokens without v0 validation (setup or runtime) */
        useStyleUnsafe(handles: StyleHandle[]): () => void {
          this.ensureNotDisposed('feedback.style.useUnsafe');
          const unUse = this.recorder.useUnsafe(...handles);
          this.markDirty();
          this.flushIfPossible();

          return () => {
            if (this.disposed) return;
            unUse();
            this.markDirty();
            this.flushIfPossible();
          };
        }

        /** pure snapshot */
        shouldRetainStyleRule(tokens: readonly string[]): boolean {
          // Until the optimizer supplies complete final geometry/paint
          // provenance, shared material keeps every style Rule in the
          // evaluator. A token-prefix guess is not complete provenance.
          if (this.sharedSlot) return true;
          return (
            this.material !== null &&
            tokens.some((token) => /^(bg-|backdrop-|shadow|rounded|text-)/.test(token))
          );
        }

        exportMerged(): StyleHandle {
          const { tokens } = this.recorder.export();
          return { kind: 'tw', tokens };
        }

        override onProtoPhase(phase: ProtoPhase): void {
          super.onProtoPhase(phase);
          if (phase === 'mounted') this.flushIfPossible();
        }

        override onMountPhase(phase: MountPhase, epoch: number): void {
          super.onMountPhase(phase, epoch);
          const oldEpoch = this.viewEpoch;
          this.viewEpoch = epoch;
          if (phase === 'unmounting' || phase === 'detached' || epoch !== oldEpoch) {
            this.markDirty();
            this.releaseVisualSink();
          }
          if (phase === 'mounting') {
            this.ensureMaterialBinding();
            this.material?.connect();
            // A fresh view epoch owns a fresh EffectsPort. Replay the retained
            // instance style before the host commit so the first materialized
            // frame already carries its baseline tokens.
            this.replayStyleForViewEpoch();
          }
        }

        protected override onCapsEpoch(_epoch: number): void {
          if (this.disposed) return;
          this.ensureMaterialBinding();
          const next = this.caps.has(VISUAL_FEEDBACK_SINK_CAP)
            ? this.caps.get(VISUAL_FEEDBACK_SINK_CAP)
            : this.caps.has(FINAL_STYLE_SINK_CAP)
              ? this.caps.get(FINAL_STYLE_SINK_CAP)
              : null;
          this.markDirty();
          if (this.visualSink && this.visualSink !== next) this.releaseVisualSink();
          // Capability replacement must replay the current logical result even
          // when the previous host had already consumed it.
          this.flushIfPossible();
        }

        private hasOutput(): boolean {
          return (
            this.caps.has(VISUAL_FEEDBACK_SINK_CAP) ||
            this.caps.has(FINAL_STYLE_SINK_CAP) ||
            this.caps.has(EFFECTS_CAP)
          );
        }

        private ensureMaterialBinding(): void {
          if (!this.caps.has(MATERIAL_BINDING_FACTORY_CAP)) return;
          const factory = this.caps.get(MATERIAL_BINDING_FACTORY_CAP);
          if (this.materialFactory) {
            if (this.materialFactory !== factory)
              throw new Error('Material semantics cannot change within an instance');
            return;
          }
          const material = factory(init.declarations, deps, () => {
            this.markDirty();
            this.flushIfPossible();
          });
          this.material = material;
          this.materialFactory = factory;
          if (this.canProject()) this.material?.connect();
        }

        private releaseVisualSink(): void {
          const sink = this.visualSink;
          const view = this.visualSinkView;
          this.visualSink = null;
          if (sink) sink.release(view);
        }

        private markDirty(): void {
          this.dirty = true;
          this.pendingProjection = null;
        }

        private projectFinalStyle(handle: StyleHandle): void {
          const revision = ++this.visualRevision;
          const pending = { kind: 'tw' as const, tokens: [...handle.tokens] };
          try {
            if (this.caps.has(VISUAL_FEEDBACK_SINK_CAP)) {
              const sink = this.caps.get(VISUAL_FEEDBACK_SINK_CAP);
              this.visualSink = sink;
              this.visualSinkView = this.viewEpoch;
              sink.commit(
                Object.freeze({
                  view: this.viewEpoch,
                  revision,
                  style: Object.freeze({
                    kind: 'tw' as const,
                    tokens: Object.freeze([...handle.tokens]),
                  }),
                  material: this.exportMaterialFrame(),
                })
              );
            } else if (this.caps.has(FINAL_STYLE_SINK_CAP)) {
              const sink = this.caps.get(FINAL_STYLE_SINK_CAP);
              this.visualSink = sink;
              this.visualSinkView = this.viewEpoch;
              sink.commit(
                finalStyleFrame(handle, this.viewEpoch, revision, this.material?.snapshot() ?? null)
              );
            } else {
              const effects = this.caps.get(EFFECTS_CAP);
              effects.queueStyle(handle);
              this.flushRequested = true;
              effects.requestFlush();
            }
            if (revision === this.visualRevision) this.pendingProjection = null;
          } catch (error) {
            // A newer reentrant publication supersedes this attempt. Otherwise
            // retain its exact post-patch input, including temporary Rule input.
            if (!this.disposed && revision === this.visualRevision) {
              this.dirty = true;
              this.pendingProjection = pending;
            }
            throw error;
          }
        }

        flushIfPossible(): void {
          if (this.protoPhase === 'setup') return;
          if (!this.canProject()) return;
          if (!this.dirty) return;

          if (!this.hasOutput()) {
            // onCapsEpoch retries the retained logical state.
            return;
          }

          const merged = this.pendingProjection ?? this.exportMerged();

          // mark clean before calling host
          this.dirty = false;

          this.projectFinalStyle(merged);
        }

        /** runtime: apply merged style directly (rule / adapter) */
        applyMergedStyle(handle: StyleHandle): void {
          if (this.protoPhase === 'setup' || !this.canProject()) return;
          if (!this.hasOutput()) {
            const epoch = this.viewEpoch;
            this.defer(() => {
              if (!this.disposed && epoch === this.viewEpoch) this.applyMergedStyle(handle);
            });
            return;
          }
          const merged = this.recorder.exportWithAdditional(handle);
          this.projectFinalStyle({ kind: 'tw', tokens: merged.tokens });
        }

        afterRenderCommit(): void {
          if (!this.canProject()) return;
          // A structural commit may replace the current materialized root.
          if (!this.hasOutput()) return;
          const merged = this.exportMerged();
          this.projectFinalStyle(merged);
        }

        private replayStyleForViewEpoch(): void {
          if (!this.canProject()) return;
          // Runtime ProtoPhase intentionally remains `setup` until the first
          // commit completes. Mounting is nevertheless after prototype setup,
          // so replay must not use flushIfPossible's setup-phase guard.
          if (!this.hasOutput()) return;
          this.projectFinalStyle(this.exportMerged());
        }

        /** optional: runtime/adapter can call this after flush tick */
        onEffectsFlushed(): void {
          this.flushRequested = false;
          if (!this.canProject()) return;
          if (
            this.dirty &&
            (this.caps.has(VISUAL_FEEDBACK_SINK_CAP) || this.caps.has(FINAL_STYLE_SINK_CAP))
          ) {
            this.flushIfPossible();
            return;
          }
          if (this.dirty && this.caps.has(EFFECTS_CAP)) {
            this.caps.get(EFFECTS_CAP).requestFlush();
            this.flushRequested = true;
          }
        }

        dispose(): void {
          if (this.disposed) return;
          this.disposed = true;
          try {
            this.releaseVisualSink();
          } finally {
            try {
              this.material?.dispose();
            } finally {
              this.recorder = new FeedbackStyleRecorder();
              this.sharedSlot = null;
              this.materialContributions.clear();
              this.dirty = false;
              this.pendingProjection = null;
              this.flushRequested = false;
              // Discard deferred view work while its entry guards are terminal.
              this.flushPending();
            }
          }
        }

        private canProject(): boolean {
          return (
            !this.disposed && (this.mountPhase === 'mounting' || this.mountPhase === 'mounted')
          );
        }

        private ensureNotDisposed(op: string): void {
          if (this.disposed) throw new Error(`[feedback] disposed. op=${op}`);
          this.sys?.ensureNotDisposed(op);
        }

        private ensureSetup(op: string): void {
          this.ensureNotDisposed(op);
          this.sys?.ensureSetup(op);
          if (!this.sys && this.protoPhase !== 'setup') {
            throw illegalPhase(op, this.protoPhase, {
              prototypeName: init.prototypeName,
              hint: `Use 'run' inside runtime callbacks, not 'def'.`,
            });
          }
        }

        private ensureRuntime(op: string): void {
          this.ensureNotDisposed(op);
          this.sys?.ensureRuntime(op);
          if (!this.sys && this.protoPhase === 'setup') {
            throw illegalPhase(op, this.protoPhase, {
              prototypeName: init.prototypeName,
              hint: `Use 'run' only after setup.`,
            });
          }
        }

        private createRuntimeStyleDisposer(unUse: () => void): FeedbackRuntimeStyleDisposer {
          return (options = {}) => {
            if (this.disposed) return;
            unUse();
            this.markDirty();
            if (options.flush !== false) this.flushIfPossible();
          };
        }
      }

      const impl = new Impl(caps);

      const facade: FeedbackFacade = {
        material: {
          declare: (slot) => impl.declareMaterial(slot),
          use: (candidate) => impl.useMaterial(candidate),
        },
        style: {
          use: (...handles) => impl.useStyle(handles),
          patch: (...handles) => impl.patchStyle(handles),
          suppress: (...handles) => impl.suppressStyle(handles),
          clearPatch: () => impl.clearStylePatch(),
          exportMerged: () => impl.exportMerged(),
        },
      };

      return {
        facade,
        port: {
          replaceVisualRuntime: (previous, handles, candidates) =>
            impl.replaceVisualRuntime(previous, handles, candidates),
          exportMaterialFrame: () => impl.exportMaterialFrame(),
          materialDiagnostics: () => impl.materialDiagnostics(),
          shouldRetainStyleRule: (tokens) => impl.shouldRetainStyleRule(tokens),
          applyMergedStyle: (h) => impl.applyMergedStyle(h),
          useStyleRuntime: (...handles) => impl.useStyleRuntime(handles),
          replaceStyleRuntime: (previous, ...handles) =>
            impl.replaceStyleRuntime(previous, handles),
          patchStyle: (...handles) => impl.patchStyle(handles),
          suppressStyle: (...handles) => impl.suppressStyle(handles),
          clearStylePatch: () => impl.clearStylePatch(),
          useStyleUnsafe: (...handles) => impl.useStyleUnsafe(handles),
        } satisfies FeedbackPort,
        hooks: {
          dispose: () => impl.dispose(),
          onMountPhase: (p: MountPhase, epoch: number) => impl.onMountPhase(p, epoch),
          onProtoPhase: (p: ProtoPhase) => impl.onProtoPhase(p),
          afterRenderCommit: () => impl.afterRenderCommit(),

          // 非 ModuleHooks 标准字段：先用 any 过渡
          // 后续你若要把它纳入统一的 module driver，就把它变成 port 或标准 hook
          flushIfPossible: () => impl.flushIfPossible(),
          onEffectsFlushed: () => impl.onEffectsFlushed(),
        } as any,
      };
    },
  });
}

export const FeedbackModuleDef = defineModule({
  name: 'feedback',
  resourceOwnership: 'mixed',
  deps: [],
  optionalDeps: ['expose', 'state'],
  create: createFeedbackModule,
});
