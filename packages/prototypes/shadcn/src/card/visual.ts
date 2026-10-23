import { createContextKey, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import {
  SHADCN_STYLE_SCOPE,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
} from '../style-scope';
import type { ShadcnCardRootProps, ShadcnCardPartProps } from './types';

export const CARD_PROJECTED_STYLES = ['new-york-v4', 'rhea'] as const;
const CARD_DENSITY = createContextKey<{ size: 'default' | 'sm' }>('shadcn-card-density');
/** Root deliberately creates a family style boundary for all content, not a second resolver. */
export function setupCardRootVisual(def: DefHandle<ShadcnCardRootProps>) {
  setupShadcnStyleScope(def);
  def.props.define({ size: { type: 'enum', options: ['default', 'sm'], empty: 'fallback' } });
  def.props.setDefaults({ size: 'default' });
  def.context.provide(CARD_DENSITY, { size: 'default' });
  def.context.subscribe(CARD_DENSITY);
  const style = def.state.enum('cardResolvedStyle', 'new-york-v4', {
    options: CARD_PROJECTED_STYLES,
  });
  const size = def.state.enum('cardResolvedSize', 'default', { options: ['default', 'sm'] });
  const sync = (run: RunHandle<ShadcnCardRootProps>) => {
    const next = run.context.tryRead(SHADCN_STYLE_SCOPE)?.style ?? 'new-york-v4';
    if (!CARD_PROJECTED_STYLES.includes(next as (typeof CARD_PROJECTED_STYLES)[number]))
      throw new Error(`[shadcn-card] Unsupported style: ${next}`);
    const density = run.props.get().size ?? 'default';
    if (next === 'new-york-v4' && density !== 'default')
      throw new Error('[shadcn-card] New York supports only default size');
    style.set(
      next as (typeof CARD_PROJECTED_STYLES)[number],
      'reason: observe resolved family Card scope'
    );
    size.set(density, 'reason: Card density');
    if (run.context.read(CARD_DENSITY).size !== density)
      run.context.update(CARD_DENSITY, { size: density });
  };
  def.context.trySubscribe(SHADCN_STYLE_SCOPE, sync);
  def.props.watch(['size'], sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return { style, size };
}
/** Passive parts inherit density only; ordinary native child semantics are untouched. */
export function setupCardPartVisual(def: DefHandle<ShadcnCardPartProps>) {
  const style = setupShadcnStyleSelection(def, 'new-york-v4', {
    supportedStyles: CARD_PROJECTED_STYLES,
  });
  const size = def.state.enum('cardPartDensity', 'default', { options: ['default', 'sm'] });
  const sync = (run: RunHandle<ShadcnCardPartProps>) =>
    size.set(run.context.tryRead(CARD_DENSITY)?.size ?? 'default', 'reason: observe Card density');
  def.context.trySubscribe(CARD_DENSITY, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);
  return { style, size };
}
export function cardHorizontalPadding(
  def: DefHandle<ShadcnCardPartProps>,
  visual: ReturnType<typeof setupCardPartVisual>
) {
  const { style, size } = visual;
  def.rule({
    when: (w) => w.state(style).eq('new-york-v4'),
    intent: (i) => i.feedback.style.use(tw('px-6')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(size).eq('default')),
    intent: (i) => i.feedback.style.use(tw('px-5')),
  });
  def.rule({
    when: (w) => w.all(w.state(style).eq('rhea'), w.state(size).eq('sm')),
    intent: (i) => i.feedback.style.use(tw('px-4')),
  });
}
