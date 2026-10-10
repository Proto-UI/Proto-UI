import {
  createAnatomyFamily,
  createContextKey,
  defineAsHook,
  definePrototype,
  tw,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import {
  asAccessible,
  asCollection,
  asCollectionItem,
  asFocusable,
  asAxisInput,
} from '@proto.ui/hooks';
import { asButton } from '../button';
import { callOwner } from '../collection-controls/shared';
export interface CarouselRootProps {
  index?: number;
  defaultIndex?: number;
  loop?: boolean;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  direction?: 'ltr' | 'rtl';
  a11yLabel?: string;
}
export interface CarouselSlideProps {
  index?: number;
}
export const CAROUSEL_FAMILY = createAnatomyFamily('base-carousel', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    viewport: { cardinality: { min: 1, max: 1 } },
    slide: { cardinality: { min: 0, max: '*' } },
    previous: { cardinality: { min: 0, max: 1 } },
    next: { cardinality: { min: 0, max: 1 } },
  },
});
type Context = {
  index: number;
  count: number;
  loop: boolean;
  disabled: boolean;
  orientation: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
};
export const CAROUSEL_CONTEXT = createContextKey<Context>('base-carousel');
function setupRoot(def: DefHandle<CarouselRootProps, any>) {
  def.anatomy.claim(CAROUSEL_FAMILY, { role: 'root' });
  asCollection().configure({ family: CAROUSEL_FAMILY, itemRole: 'slide' });
  def.props.define({
    index: { type: 'number' },
    defaultIndex: { type: 'number' },
    loop: { type: 'boolean' },
    disabled: { type: 'boolean' },
    orientation: { type: 'enum', options: ['horizontal', 'vertical'] },
    direction: { type: 'enum', options: ['ltr', 'rtl'] },
    a11yLabel: { type: 'string' },
  });
  def.props.setDefaults({
    defaultIndex: 0,
    loop: false,
    disabled: false,
    orientation: 'horizontal',
    direction: 'ltr',
    a11yLabel: 'Carousel',
  });
  def.context.provide(CAROUSEL_CONTEXT, {
    index: 0,
    count: 0,
    loop: false,
    disabled: false,
    orientation: 'horizontal',
    direction: 'ltr',
  });
  def.context.subscribe(CAROUSEL_CONTEXT);
  const index = def.state.numberDiscrete('index', 0),
    count = def.state.numberDiscrete('count', 0),
    label = def.state.string('a11yLabel', 'Carousel');
  const a = asAccessible();
  a.role('region');
  a.name(label);
  def.expose.state('index', index);
  def.expose.state('slideCount', count);
  def.expose.event('indexChange', { payload: 'json' });
  let owner: RunHandle<CarouselRootProps> | null = null;
  const publish = (run: RunHandle<CarouselRootProps>) => {
    const p = run.props.get();
    const previousCount = count.get();
    count.set(run.anatomy.partsOf(CAROUSEL_FAMILY, 'slide').length, 'carousel slide count');
    if (!run.props.isProvided('index') && count.get() < previousCount)
      index.set(
        Math.max(0, Math.min(Math.max(0, count.get() - 1), index.get())),
        'carousel reconcile'
      );
    run.context.update(CAROUSEL_CONTEXT, {
      index: index.get(),
      count: count.get(),
      loop: !!p.loop,
      disabled: !!p.disabled,
      orientation: p.orientation ?? 'horizontal',
      direction: p.direction ?? 'ltr',
    });
  };
  def.expose.method('requestIndex', (next: number) => {
    if (!owner || owner.props.get().disabled || !count.get() || !Number.isFinite(next))
      return false;
    next = Math.trunc(next);
    next = owner.props.get().loop
      ? ((next % count.get()) + count.get()) % count.get()
      : Math.max(0, Math.min(count.get() - 1, next));
    if (next === index.get()) return false;
    if (!owner.props.isProvided('index')) index.set(next, 'carousel request');
    publish(owner);
    owner.expose.emit('indexChange', { index: next });
    return true;
  });
  const sync = (run: RunHandle<CarouselRootProps>, created = false) => {
    owner = run;
    const p = run.props.get();
    if (created || run.props.isProvided('index'))
      index.set(
        Math.max(0, Math.trunc((run.props.isProvided('index') ? p.index : p.defaultIndex) ?? 0)),
        'carousel owner index'
      );
    label.set(p.a11yLabel ?? 'Carousel', 'carousel name');
    publish(run);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => sync(run));
  def.props.watchAll((run) => sync(run));
  def.anatomy.subscribeParts(CAROUSEL_FAMILY, 'slide', (run) => {
    if (owner) publish(run);
  });
  def.lifecycle.onUnmounted(() => {
    owner = null;
  });
}
export const asCarouselRoot = defineAsHook({ name: 'as-carousel-root', setup: setupRoot });
export const carouselRoot = definePrototype({ name: 'base-carousel-root', setup: setupRoot });
function setupViewport(def: DefHandle<Record<string, never>, any>) {
  def.anatomy.claim(CAROUSEL_FAMILY, { role: 'viewport' });
  const focus = asFocusable();
  focus.configure({ disabled: false });
  def.expose.state('focusVisible', focus.focusVisible);
  const input = asAxisInput();
  input.configure({ anatomy: CAROUSEL_FAMILY, inputRole: 'viewport', geometryRole: 'viewport' });
  input.on((run, sample) => {
    if (sample.phase !== 'end' || Math.abs(sample.totalDelta) < 0.15) return;
    const c = run.context.read(CAROUSEL_CONTEXT);
    callOwner(run, CAROUSEL_FAMILY, 'requestIndex', c.index + (sample.totalDelta < 0 ? 1 : -1));
  });
  const sync = (run: RunHandle<any>) => {
    const c = run.context.read(CAROUSEL_CONTEXT);
    focus.setDisabled(c.disabled);
    input.sync({
      axis: c.orientation,
      direction: c.direction,
      disabled: c.disabled,
      readOnly: false,
    });
  };
  def.context.subscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onMounted(sync);
  def.event.on('key.down', (run, e) => {
    if (!focus.focused.get() || e.altKey || e.ctrlKey || e.metaKey) return;
    const c = run.context.read(CAROUSEL_CONTEXT);
    let next: number | undefined;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = c.count - 1;
    if (c.orientation === 'horizontal') {
      if (e.key === 'ArrowRight') next = c.index + (c.direction === 'rtl' ? -1 : 1);
      if (e.key === 'ArrowLeft') next = c.index + (c.direction === 'rtl' ? 1 : -1);
    } else {
      if (e.key === 'ArrowDown') next = c.index + 1;
      if (e.key === 'ArrowUp') next = c.index - 1;
    }
    if (next === undefined) return;
    e.control.requestDefaultActionPrevention({
      reason: 'carousel.navigation',
      source: 'base-carousel-viewport',
    });
    callOwner(run, CAROUSEL_FAMILY, 'requestIndex', next);
  });
}
export const asCarouselViewport = defineAsHook({
  name: 'as-carousel-viewport',
  setup: setupViewport,
});
export const carouselViewport = definePrototype({
  name: 'base-carousel-viewport',
  setup: setupViewport,
});
function setupSlide(def: DefHandle<CarouselSlideProps, any>) {
  def.props.define({ index: { type: 'number' } });
  def.props.setDefaults({ index: 0 });
  asCollectionItem().configure({
    family: CAROUSEL_FAMILY,
    role: 'slide',
    getMeta: (run) => ({ value: String(run.props.get().index ?? 0) }),
  });
  const current = def.state.bool('current', false),
    hidden = def.state.bool('hidden', true),
    label = def.state.string('label', '');
  const a = asAccessible();
  a.role('group');
  a.name(label);
  a.state('hidden', hidden);
  def.expose.state('current', current);
  def.expose.state('hidden', hidden);
  const sync = (run: RunHandle<CarouselSlideProps>) => {
    const c = run.context.read(CAROUSEL_CONTEXT),
      i = run.props.get().index ?? 0;
    current.set(i === c.index, 'carousel active slide');
    hidden.set(!current.get(), 'carousel inactive slide');
    label.set(`${i + 1} / ${c.count}`, 'carousel position');
  };
  def.context.subscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}
export const asCarouselSlide = defineAsHook({ name: 'as-carousel-slide', setup: setupSlide });
export const carouselSlide = definePrototype({ name: 'base-carousel-slide', setup: setupSlide });
function navigation(delta: number) {
  return (def: DefHandle<any, any>) => {
    const button = asButton();
    const focus = asFocusable();
    def.anatomy.claim(CAROUSEL_FAMILY, { role: delta < 0 ? 'previous' : 'next' });
    const sync = (run: RunHandle<any>) => {
      const c = run.context.read(CAROUSEL_CONTEXT);
      const disabled =
        c.disabled || !c.count || (!c.loop && (delta < 0 ? c.index <= 0 : c.index >= c.count - 1));
      button.stateHandles?.disabled.set(disabled, 'carousel control boundary');
      focus.setDisabled(disabled);
    };
    def.context.subscribe(CAROUSEL_CONTEXT, sync);
    def.lifecycle.onMounted(sync);
    def.event.on('press.commit', (run) => {
      const c = run.context.read(CAROUSEL_CONTEXT);
      callOwner(run, CAROUSEL_FAMILY, 'requestIndex', c.index + delta);
    });
  };
}
export const asCarouselPrevious = defineAsHook({
  name: 'as-carousel-previous',
  setup: navigation(-1),
});
export const carouselPrevious = definePrototype({
  name: 'base-carousel-previous',
  setup: navigation(-1),
});
export const asCarouselNext = defineAsHook({ name: 'as-carousel-next', setup: navigation(1) });
export const carouselNext = definePrototype({ name: 'base-carousel-next', setup: navigation(1) });
