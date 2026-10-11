import { readRootStyleEntries, createRootStyleEffect } from '@proto.ui/core/internal';
import {
  snapshotResidentMotion,
  type ResidentMotionProperty,
  type StyleHandle,
} from '@proto.ui/core';
import type { ResidentMotionFrame, ResidentMotionSink } from './sink';
import { createResidentMotionSampler } from './sampler';
import {
  extractResidentMotionTarget,
  resolveMotionTranslate,
  type MotionTranslate,
  type MotionColor,
} from './targets';
import { colorToMotionVector, motionVectorToColor, type MotionRgba } from './color';
export type MotionEnvironment = Readonly<{
  preference: 'reduce' | 'no-preference' | 'unknown';
  visible: boolean;
  supportedProperties: readonly ResidentMotionProperty[];
  rootFontPx: number | null;
  width: number | null;
  height: number | null;
  palette: Readonly<Record<string, MotionRgba>>;
  paletteRevision: number;
}>;
export type MotionPresentation = Readonly<{
  translate?: readonly number[];
  backgroundColor?: MotionRgba;
}>;
export type ResidentMotionHost = {
  now(): number;
  environment(): MotionEnvironment;
  subscribe(invalidate: () => void): () => void;
  requestFrame(callback: () => void): unknown;
  cancelFrame(ticket: unknown): void;
  /** Check isCurrent after every reentrant host call before writing physical output. */
  project(style: StyleHandle, presentation: MotionPresentation, isCurrent: () => boolean): void;
  diagnostics?(reasons: readonly string[]): void;
};
/** One cross-platform driver: hosts supply only environment, scheduling and paint. */
export function createResidentMotionProjector(host: ResidentMotionHost): ResidentMotionSink {
  let last: ResidentMotionFrame | null = null,
    view: number | null = null,
    revision = -1,
    retired = false;
  let ticket: unknown = null,
    generation = 0,
    off: (() => void) | null = null;
  let diagnostics: readonly string[] = Object.freeze([]);
  let subscribing = false;
  let wasVisible = false,
    wasAllowed = false;
  const samplers = new Map<
    ResidentMotionProperty,
    ReturnType<typeof createResidentMotionSampler>
  >();
  const declarationKeys = new Map<ResidentMotionProperty, string>();
  function cancel() {
    generation++;
    if (ticket !== null) host.cancelFrame(ticket);
    ticket = null;
  }
  function reset() {
    cancel();
    for (const s of samplers.values()) s.dispose();
    samplers.clear();
    declarationKeys.clear();
    wasVisible = false;
    wasAllowed = false;
  }
  function render() {
    if (retired || !last) return;
    cancel();
    const currentGeneration = generation,
      frame = last;
    const env = host.environment(),
      now = host.now(),
      allowed =
        env.visible &&
        !frame.style.tokens.some((t) => t === 'hidden' || t === 'invisible') &&
        env.preference === 'no-preference';
    const animate = allowed && wasAllowed && wasVisible;
    wasVisible = env.visible;
    wasAllowed = allowed;
    const presentation: { translate?: readonly number[]; backgroundColor?: MotionRgba } = {};
    const omitted = new Set<string>(),
      reasons: string[] = [];
    let active = false;
    for (const declaration of frame.declarations)
      for (const property of declaration.properties) {
        const key = JSON.stringify([declaration.durationMs, declaration.easing]);
        let sampler = samplers.get(property);
        if (declarationKeys.get(property) !== key) {
          sampler?.dispose();
          sampler = createResidentMotionSampler(declaration);
          samplers.set(property, sampler);
          declarationKeys.set(property, key);
        }
        const target = env.supportedProperties.includes(property)
          ? extractResidentMotionTarget(frame.style.tokens, property)
          : { supported: false as const, reason: 'host-property-unavailable' };
        let value: readonly number[] | null = null;
        if (!target.supported) reasons.push(`${property}:${target.reason}`);
        else if (property === 'translate')
          value = resolveMotionTranslate(target.value as MotionTranslate, env);
        else {
          const color = target.value as MotionColor;
          const palette = env.palette[color.role];
          if (palette)
            try {
              value = colorToMotionVector([
                palette[0],
                palette[1],
                palette[2],
                palette[3] * color.alpha,
              ]);
            } catch {
              reasons.push(`${property}:invalid-palette`);
            }
        }
        if (!value) {
          sampler!.dispose();
          samplers.delete(property);
          declarationKeys.delete(property);
          reasons.push(`${property}:unresolved-target-settled`);
          continue;
        }
        const sample = sampler!.target(value, now, animate)!;
        if (property === 'translate') {
          presentation.translate = sample;
          if (target.supported) for (const token of target.ownedTokens) omitted.add(token);
        } else presentation.backgroundColor = motionVectorToColor(sample);
        active ||= sampler!.active;
      }
    diagnostics = Object.freeze(reasons);
    host.diagnostics?.(diagnostics);
    if (retired || last !== frame || generation !== currentGeneration) return;
    host.project(
      createRootStyleEffect(
        readRootStyleEntries(frame.style, 'setup').filter((entry) => !omitted.has(entry.token))
      ),
      Object.freeze(presentation),
      () => !retired && last === frame && generation === currentGeneration
    );
    if (active && allowed && !retired && last === frame && generation === currentGeneration) {
      ticket = host.requestFrame(() => {
        ticket = null;
        if (!retired && generation === currentGeneration) render();
      });
    }
  }
  return {
    diagnostics: () => diagnostics,
    commit(frame) {
      if (retired) return;
      if (
        !Number.isSafeInteger(frame.view) ||
        frame.view < 0 ||
        !Number.isSafeInteger(frame.revision) ||
        frame.revision < 0
      )
        throw new Error('[feedback.motion] Invalid epoch/revision');
      if (view !== null && frame.view < view) return;
      if (view === frame.view && frame.revision <= revision) return;
      if (view !== frame.view) {
        reset();
        view = frame.view;
        revision = -1;
      }
      revision = frame.revision;
      last = Object.freeze({
        ...frame,
        style: createRootStyleEffect(readRootStyleEntries(frame.style, 'setup')),
        declarations: frame.declarations.map(snapshotResidentMotion),
      });
      if (!off && !subscribing) {
        subscribing = true;
        try {
          const unsubscribe = host.subscribe(render);
          if (retired) {
            unsubscribe();
            return;
          }
          off = unsubscribe;
        } finally {
          subscribing = false;
        }
      }
      render();
    },
    release(epoch) {
      if (view !== epoch) return;
      retired = true;
      last = null;
      reset();
      off?.();
      off = null;
    },
  };
}
