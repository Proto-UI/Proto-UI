import { tw, type DefHandle, type RunHandle, type State } from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
import type { SwitchRootStateHandles } from '@proto.ui/prototypes-base/switch';
import { setupShadcnStyleSelection, SHADCN_STYLE_SCOPE } from '../style-scope';
import { SWITCH_VISUAL, normalizeSwitchSize } from './visual';
import { createSwitchHitLease } from './hit-lease';
import type { ShadcnSwitchRootProps } from './types';

export const SWITCH_PROJECTED_STYLES = ['new-york-v4', 'rhea'] as const;
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
  // Match the physical origin to the existing direction policy only for
  // the explicit drag enhancement; ordinary upstream toggle paint is unchanged.
  // Explicit direction also prevents inherited document direction reversing it twice.
  def.rule({
    when: (w) => w.all(w.state(state.draggable).eq(true), w.state(state.direction).eq('ltr')),
    intent: (i) => i.feedback.style.use(tw('direction-ltr')),
  });
  def.rule({
    when: (w) => w.all(w.state(state.draggable).eq(true), w.state(state.direction).eq('rtl')),
    intent: (i) => i.feedback.style.use(tw('direction-rtl')),
  });
  def.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) => i.feedback.style.use(tw('rounded-full border border-transparent shadow-xs')),
  });
  def.rule({
    when: (w) => w.state(style).eq('rhea'),
    intent: (i) =>
      i.feedback.style.use(tw('rounded-[var(--pui-radius-2xl)] border-2 border-transparent')),
  });
  def.rule({
    when: (w) => w.state(size).eq('default'),
    intent: (i) => i.feedback.style.use(tw('w-8')),
  });
  def.rule({ when: (w) => w.state(size).eq('sm'), intent: (i) => i.feedback.style.use(tw('w-6')) });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(size).eq('default')),
    intent: (i) => i.feedback.style.use(tw('h-[1.15rem]')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(size).eq('sm')),
    intent: (i) => i.feedback.style.use(tw('h-3.5')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(size).eq('default')),
    intent: (i) => i.feedback.style.use(tw('h-5')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(size).eq('sm')),
    intent: (i) => i.feedback.style.use(tw('h-4')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.state(state.checked).eq(false),
        w.not(w.meta('colorScheme').eq('dark'))
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(state.checked).eq(false)),
    intent: (i) => i.feedback.style.use(tw('bg-input/90')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.any(w.state(style).eq('new-york-v4'), w.state(style).eq('rhea')),
        w.state(state.checked).eq(true)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-primary')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('new-york-v4'),
        w.meta('colorScheme').eq('dark'),
        w.state(state.checked).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-input/80')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.any(w.state(style).eq('new-york-v4'), w.state(style).eq('rhea')),
        w.state(state.disabled).eq(true)
      ),
    intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.disabled).eq(true)),
    intent: (i) => i.feedback.style.use(tw('pointer-events-none')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(state.focusVisible).eq(true)),
    intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/50')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('rhea'),
        w.state(state.checked).eq(true),
        w.state(state.focusVisible).eq(false),
        ...(invalid ? [w.state(invalid).eq(false)] : [])
      ),
    intent: (i) => i.feedback.style.use(tw('border-primary')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(style).eq('rhea'),
        w.state(state.focusVisible).eq(true),
        ...(invalid ? [w.state(invalid).eq(false)] : [])
      ),
    intent: (i) => i.feedback.style.use(tw('border-ring ring-3 ring-ring/30')),
  });
  if (invalid) {
    def.rule({
      when: (w) => w.all(w.state(style).eq('rhea'), w.state(invalid).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/20 ring-3')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('rhea'),
          w.state(invalid).eq(true),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('border-destructive/50 ring-destructive/40')),
    });
  }
  // Pending: exact wrapping FieldLabel focus-visible treatment, never Field-wide focus.
}
