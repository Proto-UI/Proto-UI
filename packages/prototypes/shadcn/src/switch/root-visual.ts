import { tw, type DefHandle, type RunHandle, type State } from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
import type { SwitchRootStateHandles } from '@proto.ui/prototypes-base/switch';
import {
  setupShadcnStyleSelection,
  SHADCN_STYLE_IDS,
  SHADCN_STYLE_SCOPE,
  type ShadcnStyleId,
} from '../style-scope';
import { SWITCH_VISUAL, normalizeSwitchSize } from './visual';
import { createSwitchHitLease } from './hit-lease';
import type { ShadcnSwitchRootProps } from './types';

export const SWITCH_PROJECTED_STYLES = SHADCN_STYLE_IDS;

/**
 * Per-profile surface carrier tokens from the pinned upstream recipes:
 * apps/v4/registry/styles/style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css
 * `.cn-switch` (radius/border/shadow carriers), plus the retained new-york-v4
 * component baseline.
 */
const PROFILE_SURFACE: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'rounded-full border border-transparent shadow-xs',
  vega: 'rounded-full border border-transparent shadow-xs',
  nova: 'rounded-full border border-transparent',
  maia: 'rounded-full border border-transparent',
  lyra: 'rounded-full border border-transparent',
  mira: 'rounded-full border border-transparent',
  luma: 'rounded-full border-2',
  sera: 'rounded-none border',
  rhea: 'rounded-[var(--pui-radius-2xl)] border-2 border-transparent',
};

/** data-[size=default|sm] geometry per recipe. New York keeps rem units. */
const PROFILE_SIZE: Readonly<Record<`${ShadcnStyleId}-${'default' | 'sm'}`, string>> = {
  'new-york-v4-default': 'w-8 h-[1.15rem]',
  'new-york-v4-sm': 'w-6 h-3.5',
  'vega-default': 'w-[32px] h-[18.4px]',
  'vega-sm': 'w-[24px] h-[14px]',
  'nova-default': 'w-[32px] h-[18.4px]',
  'nova-sm': 'w-[24px] h-[14px]',
  'maia-default': 'w-[32px] h-[18.4px]',
  'maia-sm': 'w-[24px] h-[14px]',
  'lyra-default': 'w-[32px] h-[18.4px]',
  'lyra-sm': 'w-[24px] h-[14px]',
  'mira-default': 'w-[28px] h-[16.6px]',
  'mira-sm': 'w-[24px] h-[14px]',
  'luma-default': 'w-11 h-5',
  'luma-sm': 'w-7 h-4',
  'sera-default': 'w-8.25 h-4.5',
  'sera-sm': 'w-6.25 h-3.5',
  'rhea-default': 'w-8 h-5',
  'rhea-sm': 'w-6 h-4',
};

/** Unchecked track tint (light); `data-unchecked:bg-*` per recipe. */
const PROFILE_UNCHECKED_BG: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'bg-input',
  vega: 'bg-input',
  nova: 'bg-input',
  maia: 'bg-input',
  lyra: 'bg-input',
  mira: 'bg-input',
  luma: 'bg-input/90',
  sera: 'bg-input',
  rhea: 'bg-input/90',
};

/** `dark:data-unchecked:bg-*`; remaining profiles retain their ordinary track tint. */
const PROFILE_UNCHECKED_DARK_BG: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'bg-input/80',
  vega: 'bg-input/80',
  nova: 'bg-input/80',
  maia: 'bg-input/80',
  lyra: 'bg-input/80',
  mira: 'bg-input/80',
  luma: 'bg-input/90',
  sera: 'bg-input',
  rhea: 'bg-input/90',
};

/** `focus-visible:border-ring focus-visible:ring-ring/*` + ring width per recipe. */
const PROFILE_FOCUS: Readonly<Record<ShadcnStyleId, string>> = {
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-[3px] ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
};

/** `aria-invalid:ring-*` widths match each profile's focus ring width. */
const PROFILE_INVALID_RING = {
  vega: 'ring-3',
  nova: 'ring-3',
  maia: 'ring-[3px]',
  lyra: 'ring-1',
  mira: 'ring-2',
  luma: 'ring-3',
  sera: 'ring-2',
  rhea: 'ring-3',
} as const;

/** Profiles whose unchecked track paints a recipe border color. */
const PROFILE_UNCHECKED_BORDER: Partial<Readonly<Record<ShadcnStyleId, string>>> = {
  luma: 'border-transparent',
  sera: 'border-input/50',
};

/** Profiles whose checked track paints `data-checked:border-primary`. */
const PROFILE_CHECKED_BORDER: Partial<Readonly<Record<ShadcnStyleId, true>>> = {
  luma: true,
  sera: true,
  rhea: true,
};

/** Paint and hit projection only; checked, activation and Field validity retain their Base owners. */
export function setupSwitchRootVisual(
  def: DefHandle<ShadcnSwitchRootProps>,
  state: SwitchRootStateHandles,
  invalid?: State<boolean>
) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4', {
    supportedStyles: SWITCH_PROJECTED_STYLES,
  });
  const hit = asHitParticipation();
  def.props.define({ size: { type: 'enum', options: ['default', 'sm'], empty: 'fallback' } });
  def.props.setDefaults({ size: 'default' });
  const size = def.state.enum('switchVisualSize', 'default', { options: ['default', 'sm'] });
  def.expose.method('getVisualSize', () => size.get());
  def.expose.method('getVisualStyle', () => style.get());
  def.context.provide(SWITCH_VISUAL, { size: 'default', style: 'new-york-v4' });
  let mounted = false;
  // The bounded hit lease stays a Rhea-only acquisition: it compensates the
  // compact h-5/w-8 (sm h-4/w-6) track and remains the only measured
  // owner-relative self-region extension for this family. Other profiles keep
  // their border-box hit region; widening the lease is a separate acceptance.
  const hitLease = createSwitchHitLease(
    () => mounted && style.get() === 'rhea',
    () =>
      hit.registerSelfRegion({
        role: 'switch-hit',
        staticHitInset: {
          top: { value: 0.5, unit: 'rem' },
          right: { value: 0.75, unit: 'rem' },
          bottom: { value: 0.5, unit: 'rem' },
          left: { value: 0.75, unit: 'rem' },
        },
      })
  );
  const sync = (run: RunHandle<ShadcnSwitchRootProps>) => {
    const nextSize = normalizeSwitchSize(run.props.get().size);
    size.set(nextSize, 'reason: Switch Root visual size');
    run.context.update(SWITCH_VISUAL, { size: nextSize, style: style.get() });
    hitLease.sync();
  };
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    sync(run);
  });
  def.lifecycle.onUnmounted(() => {
    mounted = false;
    hitLease.release();
  });
  def.lifecycle.onBeforeDispose(() => {
    mounted = false;
    hitLease.release();
  });
  def.props.watch(['size'], sync);
  // Observe the public selector inputs after the shared resolver, never watch
  // owned style state or duplicate the explicit/ancestor precedence algorithm.
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
  def.props.watchRaw(['styleProfile'], sync);
  def.lifecycle.onUpdated(sync);
  def.feedback.style.use(
    tw(
      'peer relative inline-flex shrink-0 items-center p-0 outline-none select-none transition-all duration-150 ease-in-out'
    )
  );
  for (const profile of SWITCH_PROJECTED_STYLES) {
    def.rule({
      when: (w) => w.state(style).eq(profile),
      intent: (i) => i.feedback.style.use(tw(PROFILE_SURFACE[profile])),
    });
    for (const named of ['default', 'sm'] as const) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(size).eq(named)),
        intent: (i) => i.feedback.style.use(tw(PROFILE_SIZE[`${profile}-${named}`])),
      });
    }
    // Unchecked track tint; guards mirror the upstream data-unchecked variant so
    // the checked fill always wins the same semantic group.
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.checked).eq(false),
          w.not(w.meta('colorScheme').eq('dark'))
        ),
      intent: (i) => i.feedback.style.use(tw(PROFILE_UNCHECKED_BG[profile])),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.meta('colorScheme').eq('dark'),
          w.state(state.checked).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(PROFILE_UNCHECKED_DARK_BG[profile])),
    });
    const uncheckedBorder = PROFILE_UNCHECKED_BORDER[profile];
    if (uncheckedBorder) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.checked).eq(false),
            ...(invalid ? [w.state(invalid).eq(false)] : [])
          ),
        intent: (i) => i.feedback.style.use(tw(uncheckedBorder)),
      });
    }
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.checked).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });
    if (PROFILE_CHECKED_BORDER[profile]) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(state.checked).eq(true),
            w.state(state.focusVisible).eq(false),
            ...(invalid ? [w.state(invalid).eq(false)] : [])
          ),
        intent: (i) => i.feedback.style.use(tw('border-primary')),
      });
    }
    // Disabled affordance is the shared component-level treatment carried by
    // the retained baseline; the modern recipes state no disabled tokens.
    def.rule({
      when: (w) => w.all(w.state(style).eq(profile), w.state(state.disabled).eq(true)),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq(profile),
          w.state(state.focusVisible).eq(true),
          ...(invalid && profile !== 'new-york-v4' ? [w.state(invalid).eq(false)] : [])
        ),
      intent: (i) => i.feedback.style.use(tw(PROFILE_FOCUS[profile])),
    });
    if (invalid && profile !== 'new-york-v4') {
      const ring = PROFILE_INVALID_RING[profile];
      // aria-invalid:border-destructive + ring tokens; upstream also keeps the
      // checked border transparent under invalid, so invalid paint wins.
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(invalid).eq(true)),
        intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/20'), tw(ring)),
      });
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.state(invalid).eq(true),
            w.meta('colorScheme').eq('dark')
          ),
        intent: (i) => i.feedback.style.use(tw('border-destructive/50 ring-destructive/40')),
      });
    }
  }
  // The retained New York baseline alone suppresses pointer events while
  // disabled; other profiles keep the recipe surface without it.
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.disabled).eq(true)),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none')),
  });
  // Retained gaps: upstream group-has-[:focus-visible]/field-label ring/border
  // clears inside a wrapping FieldLabel composition have no Proto host-ancestor
  // selector; the wrapped-label ring contract remains an acceptance gap.
  // New York intentionally keeps no invalid paint, matching the established
  // fieldSwitch parity boundary.
}
