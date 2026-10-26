import { createPresenceController } from './presence/controller';
import { OwnedDecorationRegistryModel } from './style/owned-decoration-registry';
import { OWNED_DECORATION_CAP, type OwnedDecorationBinding } from './style/owned-decoration-cap';
import type { OwnedDecorationTarget, DecorationStyleFrame } from '@proto.ui/core';
import { PRESENCE_PRESENTATION_SINK_CAP, PRESENCE_RUN_IN_CALLBACK_CAP } from './presence/sink';
import type { StatePort } from '@proto.ui/module-state';
import { snapshotResidentMotion, type ResidentMotionDeclaration } from '@proto.ui/core';
import { RESIDENT_MOTION_SINK_CAP, type ResidentMotionSink } from './motion/sink';
import type { InstancePhase, MountPhase, ProtoPhase, StyleHandle } from '@proto.ui/core';
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
  snapshotFinalStyle,
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
        private decoration = new OwnedDecorationRegistryModel();
        private decorationRules = new Map<OwnedDecorationTarget, object>();
        private decorationBound = false;
        private decorationTerminal = false;
        private decorationLease: object | null = null;
        hasDecorationTargets(): boolean {
          return this.decorationRules.size > 0;
        }
        captureDecorationLease(): object {
          if (!this.decorationLease || this.decorationTerminal)
            throw new Error('[feedback] decoration view is not active');
          return this.decorationLease;
        }
        declareDecoration(): OwnedDecorationTarget {
          this.ensureSetup('def.feedback.style.declareDecoration');
          if (!this.caps.has(OWNED_DECORATION_CAP))
            throw new Error('[feedback] owned-decoration unsupported by this adapter');
          const target = this.decoration.declareTarget() as OwnedDecorationTarget;
          this.decorationRules.set(target, this.decoration.declareContribution(target, 'rule'));
          return target;
        }
        useDecoration(target: OwnedDecorationTarget, handles: StyleHandle[]): () => void {
          this.ensureSetup('def.feedback.style.to.use');
          const owner = this.decoration.declareContribution(target, 'setup');
          this.decoration.replace(owner, ...handles);
          return () => {
            this.ensureSetup('def.feedback.style.to.use:dispose');
            this.decoration.withdraw(owner);
          };
        }
        validateDecorationTemplate(targets: readonly OwnedDecorationTarget[]): void {
          if (!targets.length && !this.decorationRules.size) return;
          this.ensureNotDisposed('decoration.template');
          if (!this.caps.has(OWNED_DECORATION_CAP))
            throw new Error('[feedback] owned-decoration unsupported by this adapter');
          if (this.decorationTerminal)
            throw new Error('[feedback] decoration structural rebind unsupported');
          const seen = new Set<OwnedDecorationTarget>();
          for (const target of targets) {
            this.decoration.snapshot(target);
            if (seen.has(target)) throw new Error('[feedback] duplicate decoration binding');
            seen.add(target);
          }
          if (seen.size !== this.decorationRules.size)
            throw new Error('[feedback] missing decoration binding');
        }
        bindDecorations(bindings: readonly OwnedDecorationBinding[], lease: object): void {
          if (!bindings.length && !this.decorationRules.size) return;
          const checkLease = () => {
            if (this.decorationBound)
              throw new Error('[feedback] decoration structural rebind unsupported');
            if (!lease || lease !== this.decorationLease || this.decorationTerminal)
              throw new Error('[feedback] stale decoration view lease');
          };
          checkLease();
          // Read hostile accessors only once, before any binding is published.
          const copied = bindings.map((binding) => ({
            target: binding.target,
            sink: binding.sink,
          }));
          for (const binding of copied)
            if (typeof binding.sink !== 'function')
              throw new Error('[feedback] invalid decoration sink');
          checkLease();
          this.validateDecorationTemplate(copied.map((binding) => binding.target));
          checkLease();
          this.decorationBound = true;
          this.decoration.bindAll(copied);
        }
        snapshotDecorationFrame(
          frames: readonly DecorationStyleFrame[]
        ): Map<OwnedDecorationTarget, StyleHandle[]> {
          const next = new Map<OwnedDecorationTarget, StyleHandle[]>();
          for (const frame of frames) {
            const target = frame.target;
            this.decoration.snapshot(target);
            if (next.has(target)) throw new Error('[feedback] duplicate decoration frame');
            const handles = frame.handles.map((h) => ({ kind: h.kind, tokens: [...h.tokens] }));
            const validator = new FeedbackStyleRecorder();
            validator.use(...handles);
            next.set(target, handles);
          }
          return next;
        }
        replaceDecorationFrame(next: Map<OwnedDecorationTarget, StyleHandle[]>): void {
          if (this.decorationTerminal) {
            if (next.size) throw new Error('[feedback] decoration lifetime ended');
            return;
          }
          for (const [target, owner] of this.decorationRules)
            this.decoration.replace(owner, ...(next.get(target) ?? []));
        }

        private presence = createPresenceController({
          setup: (op) => this.ensureSetup(op),
          runtime: (op) => {
            this.ensureRuntime(op);
            this.sys?.ensureCallback(op);
          },
          invalidate: () => {
            this.markDirty();
            if (this.sys?.execPhase() === 'callback' && this.sys.deferAfterCallback)
              this.sys.deferAfterCallback(() => {
                if (!this.disposed) this.flushIfPossible();
              });
            else this.flushIfPossible();
          },
          callbackContext: () => this.sys?.getCallbackCtx(),
          dispatch: (callback) => {
            if (this.sys?.execPhase() === 'callback') callback();
            else if (this.caps.has(PRESENCE_RUN_IN_CALLBACK_CAP))
              this.caps.get(PRESENCE_RUN_IN_CALLBACK_CAP)(callback);
            else throw new Error('[feedback.presence] Callback scope capability unavailable');
          },
          watch: (source, callback) => {
            const state = deps.tryPort<StatePort>('state');
            if (!state) throw new Error('[feedback.presence] State registry unavailable');
            return state.watch(
              source as import('@proto.ui/core').OwnedStateHandle<string>,
              (_run, event) => {
                if (event.type === 'next') callback();
              }
            );
          },
          sink: () =>
            this.caps.has(PRESENCE_PRESENTATION_SINK_CAP)
              ? this.caps.get(PRESENCE_PRESENTATION_SINK_CAP)
              : null,
          fallback: (style) => {
            if (this.caps.has(EFFECTS_CAP)) {
              const effects = this.caps.get(EFFECTS_CAP);
              effects.queueStyle(style);
              effects.requestFlush();
            }
          },
        });
        presenceFacade() {
          return this.presence.facade;
        }
        declarePresence(value: import('@proto.ui/core').PresencePresentationDeclaration) {
          if (this.motionDeclarations.size)
            throw new Error('[feedback.presence] Resident/presence channel ownership overlap');
          return this.presence.declare(value);
        }
        private motionDeclarations = new Set<ResidentMotionDeclaration>();
        private motionSink: ResidentMotionSink | null = null;
        private motionView = 0;
        declareMotion(declaration: ResidentMotionDeclaration): () => void {
          this.ensureSetup('def.feedback.style.transition');
          if (this.presence.declared)
            throw new Error('[feedback.presence] Resident/presence channel ownership overlap');
          const copy = snapshotResidentMotion(declaration);
          if (
            [...this.motionDeclarations].some((existing) =>
              existing.properties.some((p) => copy.properties.includes(p))
            )
          )
            throw new Error('[feedback.motion] Overlapping channel declarations');
          this.motionDeclarations.add(copy);
          this.markDirty();
          return () => {
            this.ensureSetup('def.feedback.style.transition:dispose');
            this.motionDeclarations.delete(copy);
            this.markDirty();
          };
        }
        private releaseMotionSink(): void {
          const sink = this.motionSink;
          this.motionSink = null;
          sink?.release(this.motionView);
        }
        private recorder = new FeedbackStyleRecorder();
        private dirty = false;
        private disposed = false;
        private viewEpoch = 0;
        private visualRevision = 0;
        private visualSink: FinalStyleSink | VisualFeedbackSink | null = null;
        private visualSinkKind: 'visual' | 'final' | null = null;
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

        motionDiagnostics(): readonly string[] {
          return Object.freeze(
            this.motionDeclarations.size && !this.caps.has(RESIDENT_MOTION_SINK_CAP)
              ? ['resident-motion-host-unavailable']
              : [...(this.motionSink?.diagnostics?.() ?? [])]
          );
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
          candidates: readonly MaterialCandidate[],
          decorations: readonly DecorationStyleFrame[] = []
        ): FeedbackRuntimeStyleDisposer | null {
          this.ensureRuntime('rule.feedback.visual.replace');
          const decorationFrame = this.snapshotDecorationFrame(decorations);
          if (candidates.length && !this.sharedSlot)
            throw new Error('Material Rule requires a declared slot');
          // Validate complete replacements before retiring the previous owner.
          const copied = candidates.map(snapshotMaterialCandidate);
          const unUse = handles.length ? this.recorder.useRuntime(...handles) : null;
          const key = {};
          previous?.({ flush: false });
          if (copied.length) this.materialContributions.set(key, copied);
          this.replaceDecorationFrame(decorationFrame);
          this.markDirty();
          try {
            this.flushIfPossible();
          } catch (error) {
            queueMicrotask(() => {
              throw error;
            });
          }
          if (!unUse && !copied.length && !decorationFrame.size) return null;
          let removed = false;
          return (options = {}) => {
            if (this.disposed || removed) return;
            removed = true;
            unUse?.();
            if (options.flush !== false) this.replaceDecorationFrame(new Map());
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

          const unUse = this.recorder.useRuntime(...handles);
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
          const next = handles.length > 0 ? this.recorder.useRuntime(...handles) : null;
          this.markDirty();
          try {
            this.flushIfPossible();
          } catch (error) {
            if (this.mountPhase === 'mounting') {
              // The disposer cannot reach Rule while activation throws. Release
              // that contribution before the host rolls back this view epoch.
              next?.();
              this.markDirty();
              throw error;
            }
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
          if (this.sharedSlot || this.motionDeclarations.size) return true;
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

        override onInstancePhase(phase: InstancePhase): void {
          super.onInstancePhase(phase);
          if (phase === 'disposing' || phase === 'disposed') {
            this.decorationTerminal = true;
            this.decorationLease = null;
            this.decorationBound = false;
            this.decoration.dispose();
          }
        }

        override onMountPhase(phase: MountPhase, epoch: number): void {
          if (epoch < this.viewEpoch) return;
          super.onMountPhase(phase, epoch);
          if (phase === 'unmounting' || phase === 'detached') this.decorationLease = null;
          else if (phase === 'mounting' && (epoch > this.viewEpoch || !this.decorationLease))
            this.decorationLease = Object.freeze({});
          // Temporary view detachment is not terminal instance disposal. Keep
          // logical targets/intent, but revoke every old physical sink first.
          if (
            this.decorationBound &&
            epoch >= this.viewEpoch &&
            (phase === 'unmounting' || phase === 'detached' || epoch > this.viewEpoch)
          ) {
            this.decorationBound = false;
            this.decoration.suspendBindings();
          }
          const oldEpoch = this.viewEpoch;
          this.viewEpoch = epoch;
          if (phase === 'unmounting' || phase === 'detached' || epoch !== oldEpoch) {
            this.markDirty();
            try {
              this.releaseVisualSink();
            } finally {
              try {
                this.releaseMotionSink();
              } finally {
                this.presence.release();
              }
            }
          }
          if (phase === 'mounting') {
            this.ensureMaterialBinding();
            this.material?.connect();
            // A fresh view epoch owns a fresh EffectsPort. Replay the retained
            // instance style before the host commit so the first materialized
            // frame already carries its baseline tokens.
            this.afterRenderCommit();
          }
        }

        protected override onCapsEpoch(_epoch: number): void {
          if (this.disposed) return;
          this.ensureMaterialBinding();
          if (
            this.motionSink &&
            (!this.caps.has(RESIDENT_MOTION_SINK_CAP) ||
              this.motionSink !== this.caps.get(RESIDENT_MOTION_SINK_CAP))
          )
            this.releaseMotionSink();
          const next = this.caps.has(VISUAL_FEEDBACK_SINK_CAP)
            ? this.caps.get(VISUAL_FEEDBACK_SINK_CAP)
            : this.caps.has(FINAL_STYLE_SINK_CAP)
              ? this.caps.get(FINAL_STYLE_SINK_CAP)
              : null;
          const nextKind = this.caps.has(VISUAL_FEEDBACK_SINK_CAP)
            ? 'visual'
            : this.caps.has(FINAL_STYLE_SINK_CAP)
              ? 'final'
              : null;
          this.markDirty();
          if (this.visualSink && (this.visualSink !== next || this.visualSinkKind !== nextKind))
            this.releaseVisualSink();
          // Capability replacement must replay the current logical result even
          // when the previous host had already consumed it.
          this.flushIfPossible();
        }

        private hasOutput(): boolean {
          return (
            this.caps.has(PRESENCE_PRESENTATION_SINK_CAP) ||
            this.caps.has(RESIDENT_MOTION_SINK_CAP) ||
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
          this.visualSinkKind = null;
          if (sink) sink.release(view);
        }

        private markDirty(): void {
          this.dirty = true;
          this.pendingProjection = null;
        }

        private projectFinalStyle(handle: StyleHandle): void {
          const revision = ++this.visualRevision;
          const style = snapshotFinalStyle(handle);
          const pending = { ...style, tokens: [...style.tokens] };
          try {
            if (this.presence.declared) {
              if (this.sharedSlot || this.material)
                throw new Error('[feedback.presence] Combined material projection unavailable');
              this.presence.commit(pending, this.viewEpoch, revision);
            } else if (this.motionDeclarations.size && this.caps.has(RESIDENT_MOTION_SINK_CAP)) {
              // Optical material needs an atomic combined consumer; never let two
              // independently scheduled writers contend for paint ownership.
              if (this.sharedSlot || this.material)
                throw new Error('[feedback.motion] Combined material projection unavailable');
              const sink = this.caps.get(RESIDENT_MOTION_SINK_CAP);
              this.motionSink = sink;
              this.motionView = this.viewEpoch;
              sink.commit(
                Object.freeze({
                  view: this.viewEpoch,
                  revision,
                  style: pending,
                  declarations: Object.freeze([...this.motionDeclarations]),
                })
              );
            } else if (this.caps.has(VISUAL_FEEDBACK_SINK_CAP)) {
              const sink = this.caps.get(VISUAL_FEEDBACK_SINK_CAP);
              this.visualSink = sink;
              this.visualSinkKind = 'visual';
              this.visualSinkView = this.viewEpoch;
              sink.commit(
                Object.freeze({
                  view: this.viewEpoch,
                  revision,
                  style,
                  material: this.exportMaterialFrame(),
                })
              );
            } else if (this.caps.has(FINAL_STYLE_SINK_CAP)) {
              const sink = this.caps.get(FINAL_STYLE_SINK_CAP);
              this.visualSink = sink;
              this.visualSinkKind = 'final';
              this.visualSinkView = this.viewEpoch;
              sink.commit(
                finalStyleFrame(handle, this.viewEpoch, revision, this.material?.snapshot() ?? null)
              );
            } else {
              const effects = this.caps.get(EFFECTS_CAP);
              effects.queueStyle(handle);
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

          const merged = this.pendingProjection ?? this.recorder.exportRootEffect();

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
          const merged = this.recorder.exportRootEffect(handle);
          this.projectFinalStyle(merged);
        }

        afterRenderCommit(): void {
          if (!this.canProject()) return;
          // A structural commit may replace the current materialized root.
          // Runtime ProtoPhase intentionally remains `setup` until the first
          // commit completes. Mounting is nevertheless after prototype setup,
          // so replay must not use flushIfPossible's setup-phase guard.
          if (!this.hasOutput()) return;
          this.projectFinalStyle(this.recorder.exportRootEffect());
        }

        /** optional: runtime/adapter can call this after flush tick */
        onEffectsFlushed(): void {
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
          }
        }

        dispose(): void {
          if (this.disposed) return;
          this.disposed = true;
          this.decorationTerminal = true;
          this.decorationLease = null;
          this.decoration.dispose();
          try {
            try {
              try {
                this.presence.dispose();
              } finally {
                this.releaseVisualSink();
              }
            } finally {
              this.releaseMotionSink();
            }
          } finally {
            try {
              this.material?.dispose();
            } finally {
              this.recorder = new FeedbackStyleRecorder();
              this.sharedSlot = null;
              this.materialContributions.clear();
              this.dirty = false;
              this.pendingProjection = null;
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
        presence: impl.presenceFacade(),
        material: {
          declare: (slot) => impl.declareMaterial(slot),
          use: (candidate) => impl.useMaterial(candidate),
        },
        style: {
          declareDecoration: () => impl.declareDecoration(),
          to: (target) => ({ use: (...handles) => impl.useDecoration(target, handles) }),
          hasDecorationTargets: () => impl.hasDecorationTargets(),
          captureDecorationLease: () => impl.captureDecorationLease(),
          validateDecorationTemplate: (targets) => impl.validateDecorationTemplate(targets),
          transition: (declaration) => impl.declareMotion(declaration),
          presence: (declaration) => impl.declarePresence(declaration),
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
          supportsOwnedDecoration: true,
          captureDecorationLease: () => impl.captureDecorationLease(),
          bindDecorations: (bindings, lease) => impl.bindDecorations(bindings, lease),
          replaceVisualRuntime: (previous, handles, candidates, decorations) =>
            impl.replaceVisualRuntime(previous, handles, candidates, decorations),
          exportMaterialFrame: () => impl.exportMaterialFrame(),
          materialDiagnostics: () => impl.materialDiagnostics(),
          motionDiagnostics: () => impl.motionDiagnostics(),
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
          onInstancePhase: (p: InstancePhase) => impl.onInstancePhase(p),
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
