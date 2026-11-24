import { createContextKey, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import type { BrutalistCardPartProps, BrutalistCardRootProps } from './types';

const BRUTALIST_CARD_DENSITY = createContextKey<{ size: 'default' | 'sm' }>(
  'brutalist-card-density'
);

export function setupBrutalistCardRootVisual(def: DefHandle<BrutalistCardRootProps>) {
  def.props.define({ size: { type: 'enum', options: ['default', 'sm'], empty: 'fallback' } });
  def.props.setDefaults({ size: 'default' });
  def.context.provide(BRUTALIST_CARD_DENSITY, { size: 'default' });
  def.context.subscribe(BRUTALIST_CARD_DENSITY);

  const size = def.state.enum('brutalistCardResolvedSize', 'default', {
    options: ['default', 'sm'],
  });

  const sync = (run: RunHandle<BrutalistCardRootProps>) => {
    const density = run.props.get().size ?? 'default';
    size.set(density, 'reason: Brutalist Card density');
    if (run.context.read(BRUTALIST_CARD_DENSITY).size !== density) {
      run.context.update(BRUTALIST_CARD_DENSITY, { size: density });
    }
  };

  def.props.watch(['size'], sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);

  return { size };
}

export function setupBrutalistCardPartVisual(def: DefHandle<BrutalistCardPartProps>) {
  const size = def.state.enum('brutalistCardPartDensity', 'default', {
    options: ['default', 'sm'],
  });

  const sync = (run: RunHandle<BrutalistCardPartProps>) => {
    size.set(
      run.context.tryRead(BRUTALIST_CARD_DENSITY)?.size ?? 'default',
      'reason: observe Brutalist Card density'
    );
  };

  def.context.trySubscribe(BRUTALIST_CARD_DENSITY, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted(sync);
  def.lifecycle.onUpdated(sync);

  return { size };
}

export function brutalistCardHorizontalPadding(
  def: DefHandle<BrutalistCardPartProps>,
  visual: ReturnType<typeof setupBrutalistCardPartVisual>
) {
  const { size } = visual;
  def.rule({
    when: (w) => w.state(size).eq('default'),
    intent: (i) => i.feedback.style.use(tw('px-6')),
  });
  def.rule({
    when: (w) => w.state(size).eq('sm'),
    intent: (i) => i.feedback.style.use(tw('px-4')),
  });
}
