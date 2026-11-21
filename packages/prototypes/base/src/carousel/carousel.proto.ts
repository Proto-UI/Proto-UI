import type {
  CarouselRootExposes,
  CarouselViewportProps,
  CarouselViewportExposes,
  CarouselSlideExposes,
  CarouselPreviousProps,
  CarouselPreviousExposes,
  CarouselRootAsHookContract,
  CarouselViewportAsHookContract,
  CarouselSlideAsHookContract,
  CarouselNavigationAsHookContract,
} from './types';
export type * from './types';
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
  asScrollSurface,
} from '@proto.ui/hooks';
import { asButton } from '../button';
import { callOwner } from '../collection-controls/shared';
import {
  carouselSlidesPerView,
  carouselVisibleSlides,
  carouselMaxIndex,
  carouselIndex,
  carouselSnapIndex,
  carouselPosition,
} from './model';
export * from './model';
export interface CarouselRootProps {
  index?: number;
  defaultIndex?: number;
  loop?: boolean;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  direction?: 'ltr' | 'rtl';
  a11yLabel?: string;
  /** Maximum equal items in the viewport, before the minimum size is applied. */
  slidesPerView?: number;
  /** Minimum item extent in logical host pixels, capped by the viewport. */
  minSlideSize?: number;
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
  slidesPerView: number;
  minSlideSize: number;
  visibleSlides: number;
  maxIndex: number;
  viewportRatio: number;
  position: number;
  dragging: boolean;
};
export const CAROUSEL_CONTEXT = createContextKey<Context>('base-carousel');
const updateContext = (run: RunHandle<any>, patch: Partial<Context>) => {
  const current = run.context.read(CAROUSEL_CONTEXT);
  if (
    Object.entries(patch).some(([key, value]) => !Object.is(current[key as keyof Context], value))
  )
    run.context.update(CAROUSEL_CONTEXT, { ...current, ...patch });
};
function setupRoot(def: DefHandle<CarouselRootProps, CarouselRootExposes>) {
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
    slidesPerView: { type: 'number' },
    minSlideSize: { type: 'number' },
  });
  def.props.setDefaults({
    defaultIndex: 0,
    loop: false,
    disabled: false,
    orientation: 'horizontal',
    direction: 'ltr',
    a11yLabel: 'Carousel',
    slidesPerView: 1,
    minSlideSize: 0,
  });
  def.context.provide(CAROUSEL_CONTEXT, {
    index: 0,
    count: 0,
    loop: false,
    disabled: false,
    orientation: 'horizontal',
    direction: 'ltr',
    slidesPerView: 1,
    minSlideSize: 0,
    visibleSlides: 1,
    maxIndex: 0,
    viewportRatio: 0,
    position: 0,
    dragging: false,
  });
  def.context.subscribe(CAROUSEL_CONTEXT, (run, next, previous) => {
    if (owner && next && next.viewportRatio !== previous?.viewportRatio) publish(run);
  });
  const index = def.state.numberDiscrete('index', 0),
    count = def.state.numberDiscrete('count', 0),
    label = def.state.string('a11yLabel', 'Carousel'),
    visibleSlides = def.state.numberRange('visibleSlides', 1, { min: 0, max: 1000000 }),
    maxIndex = def.state.numberDiscrete('maxIndex', 0);
  const a = asAccessible();
  a.role('region');
  a.name(label);
  def.expose.state('index', index);
  def.expose.state('slideCount', count);
  def.expose.state('visibleSlides', visibleSlides);
  def.expose.state('maxIndex', maxIndex);
  def.expose.event('indexChange', { payload: 'json' });
  let owner: RunHandle<CarouselRootProps> | null = null;
  let viewEpoch = 0;
  const publish = (run: RunHandle<CarouselRootProps>) => {
    const epoch = viewEpoch;
    const p = run.props.get();
    const previousCount = count.get(),
      previousMax = maxIndex.get();
    count.set(run.anatomy.partsOf(CAROUSEL_FAMILY, 'slide').length, 'carousel slide count');
    if (owner !== run || viewEpoch !== epoch) return;
    const c = run.context.read(CAROUSEL_CONTEXT);
    const requested = carouselSlidesPerView(p.slidesPerView);
    const minSize = Number.isFinite(p.minSlideSize) ? Math.max(0, p.minSlideSize!) : 0;
    const ratio =
      c.count === count.get() && c.slidesPerView === requested && c.minSlideSize === minSize
        ? c.viewportRatio
        : 0;
    const visible = carouselVisibleSlides(count.get(), requested, ratio);
    visibleSlides.set(visible, 'carousel visible capacity');
    maxIndex.set(carouselMaxIndex(count.get(), visible), 'carousel last reachable index');
    // Parts register one at a time. Do not consume a valid default index while
    // that initial collection is still growing; only narrowing the domain or
    // an explicit owner index requires reconciliation here.
    if (
      (count.get() && run.props.isProvided('index')) ||
      count.get() < previousCount ||
      maxIndex.get() < previousMax
    )
      index.set(
        carouselIndex(
          run.props.isProvided('index') ? (p.index ?? 0) : index.get(),
          maxIndex.get(),
          false
        ),
        'carousel reconcile'
      );
    if (owner !== run || viewEpoch !== epoch) return;
    updateContext(run, {
      index: index.get(),
      count: count.get(),
      loop: !!p.loop,
      disabled: !!p.disabled,
      orientation: p.orientation ?? 'horizontal',
      direction: p.direction ?? 'ltr',
      slidesPerView: requested,
      minSlideSize: minSize,
      visibleSlides: visible,
      maxIndex: maxIndex.get(),
      viewportRatio: ratio,
    });
  };
  def.expose.method('requestIndex', (next: number) => {
    if (!owner || owner.props.get().disabled || !count.get() || !Number.isFinite(next))
      return false;
    next = carouselIndex(next, maxIndex.get(), !!owner.props.get().loop);
    if (next === index.get()) return false;
    const current = owner,
      epoch = viewEpoch;
    if (!owner.props.isProvided('index')) index.set(next, 'carousel request');
    if (owner !== current || viewEpoch !== epoch) return true;
    publish(owner);
    if (owner !== current || viewEpoch !== epoch) return true;
    owner.expose.emit('indexChange', { index: next });
    return true;
  });
  const sync = (run: RunHandle<CarouselRootProps>, created = false) => {
    owner = run;
    const p = run.props.get();
    if (created || run.props.isProvided('index'))
      index.set(
        Number.isFinite(run.props.isProvided('index') ? p.index : p.defaultIndex)
          ? Math.max(0, Math.trunc((run.props.isProvided('index') ? p.index : p.defaultIndex)!))
          : 0,
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
    viewEpoch++;
    owner = null;
  });
  def.lifecycle.onBeforeDispose(() => {
    owner = null;
  });
}
export const asCarouselRoot = defineAsHook<
  CarouselRootProps,
  CarouselRootExposes,
  CarouselRootAsHookContract
>({ name: 'as-carousel-root', setup: setupRoot });
export const carouselRoot = definePrototype({ name: 'base-carousel-root', setup: setupRoot });
function setupViewport(def: DefHandle<CarouselViewportProps, CarouselViewportExposes>) {
  def.anatomy.claim(CAROUSEL_FAMILY, { role: 'viewport' });
  const focus = asFocusable();
  focus.configure({ disabled: false });
  const scroll = asScrollSurface<CarouselViewportProps>();
  scroll.configure({ axes: 'horizontal', projection: 'system' });
  const dragging = def.state.bool('dragging', false),
    orientation = def.state.string('orientation', 'horizontal'),
    direction = def.state.string('direction', 'ltr'),
    position = def.state.numberRange('scrollPosition', 0, { min: 0, max: 1 });
  def.expose.state('focusVisible', focus.focusVisible);
  def.expose.state('dragging', dragging);
  def.expose.state('scrollPosition', position);
  def.expose.state('scrolling', scroll.scrolling);
  def.feedback.style.use(tw('flex min-w-0 min-h-0 overscroll-contain'));
  def.rule({
    when: (w) => w.state(orientation).eq('vertical'),
    intent: (i) => i.feedback.style.use(tw('flex-col')),
  });
  def.rule({
    when: (w) => w.state(direction).eq('rtl'),
    intent: (i) => i.feedback.style.use(tw('direction-rtl')),
  });
  def.rule({
    when: (w) => w.state(direction).eq('ltr'),
    intent: (i) => i.feedback.style.use(tw('direction-ltr')),
  });
  def.rule({
    when: (w) => w.state(dragging).eq(true),
    intent: (i) => i.feedback.style.use(tw('select-none cursor-grabbing')),
  });
  const input = asAxisInput<CarouselViewportProps>();
  input.configure({ anatomy: CAROUSEL_FAMILY, inputRole: 'viewport', geometryRole: 'viewport' });
  let mounted = false;
  let applying = false;
  let startOffset = 0;
  let startVisible = 1;
  let nativePending = false;
  let committed: unknown[] = [];
  const publishViewport = (run: RunHandle<CarouselViewportProps>, patch: Partial<Context>) => {
    const current = run.context.tryRead(CAROUSEL_CONTEXT);
    if (
      current &&
      Object.entries(patch).some(([key, value]) => !Object.is(current[key as keyof Context], value))
    )
      run.context.tryUpdate(CAROUSEL_CONTEXT, { ...current, ...patch });
  };
  const align = (run: RunHandle<CarouselViewportProps>) => {
    if (!mounted || dragging.get() || applying) return;
    const c = run.context.tryRead(CAROUSEL_CONTEXT);
    if (!c) return;
    applying = true;
    try {
      scroll.request({
        kind: 'to',
        axis: c.orientation,
        position: carouselPosition(c.index, c.count, c.visibleSlides),
      });
    } finally {
      applying = false;
    }
  };
  const facts = (run: RunHandle<CarouselViewportProps>) => {
    if (!mounted) return;
    const c = run.context.tryRead(CAROUSEL_CONTEXT);
    if (!c) return;
    const observed = scroll.getSnapshot()[c.orientation];
    position.set(observed.position, 'carousel actual scroll position');
    publishViewport(run, {
      viewportRatio:
        observed.visibleRatio > 0 && observed.visibleRatio < 1 ? observed.visibleRatio : 0,
      position: observed.position,
      dragging: dragging.get(),
    });
  };
  const finish = (run: RunHandle<CarouselViewportProps>, proposed: number | null) => {
    dragging.set(false, 'carousel contact ended');
    publishViewport(run, { dragging: false });
    nativePending = false;
    if (proposed !== null) callOwner(run, CAROUSEL_FAMILY, 'requestIndex', proposed);
    // The owner may synchronously accept, reject, disable or retire this view.
    // Only its current committed index decides the final physical position.
    align(run);
  };
  input.on((run, sample) => {
    if (!mounted) return;
    if (sample.phase === 'cancel') {
      finish(run, null);
      return;
    }
    const c = run.context.tryRead(CAROUSEL_CONTEXT);
    if (!c || c.disabled || !c.count) return;
    if (sample.phase === 'start') {
      startVisible = c.visibleSlides;
      startOffset =
        carouselPosition(c.index, c.count, startVisible) * Math.max(0, c.count - startVisible);
      dragging.set(true, 'carousel contact started');
      publishViewport(run, { dragging: true });
      nativePending = false;
    }
    if (!dragging.get()) return;
    const travel = Math.max(0, c.count - startVisible);
    const offset = startOffset - sample.totalDelta * startVisible;
    scroll.request({
      kind: 'control-drag',
      axis: c.orientation,
      position: travel > 0 ? Math.max(0, Math.min(1, offset / travel)) : 0,
    });
    if (sample.phase === 'end') {
      const proposal =
        c.loop && (offset < -0.5 || offset > travel + 0.5)
          ? offset < 0
            ? -1
            : c.maxIndex + 1
          : carouselSnapIndex(Math.max(0, Math.min(travel, offset)), travel);
      finish(run, proposal);
    }
  });
  const sync = (run: RunHandle<CarouselViewportProps>) => {
    const c = run.context.tryRead(CAROUSEL_CONTEXT);
    if (!c) {
      dragging.set(false, 'carousel owner detached');
      nativePending = false;
      return;
    }
    orientation.set(c.orientation, 'carousel viewport axis');
    direction.set(c.direction, 'carousel viewport direction');
    focus.setDisabled(c.disabled);
    input.sync({
      axis: c.orientation,
      direction: c.direction,
      disabled: c.disabled,
      readOnly: false,
      activation: 'directional',
      contactBasis: 'cancel-on-extent-change',
    });
    scroll.sync({ axes: c.orientation });
    const next = [
      c.index,
      c.count,
      c.visibleSlides,
      c.orientation,
      c.direction,
      c.slidesPerView,
      c.minSlideSize,
      c.disabled,
    ];
    const changed = next.some((value, i) => !Object.is(value, committed[i]));
    committed = next;
    if (changed) {
      if (dragging.get()) {
        dragging.set(false, 'carousel owner changed');
        publishViewport(run, { dragging: false });
      }
      align(run);
    }
  };
  def.context.trySubscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    sync(run);
    facts(run);
    align(run);
  });
  for (const axis of [scroll.horizontal, scroll.vertical]) {
    axis.position.watch((run, event) => {
      if (event.type === 'next') facts(run);
    });
    axis.visibleRatio.watch((run, event) => {
      if (event.type !== 'next') return;
      facts(run);
      if (mounted && !dragging.get()) align(run);
    });
  }
  scroll.scrolling.watch((run, event) => {
    if (event.type !== 'next' || !mounted || dragging.get() || applying) return;
    const c = run.context.tryRead(CAROUSEL_CONTEXT);
    if (!c) return;
    if (c.disabled) {
      align(run);
      return;
    }
    if (scroll.scrolling.get()) {
      nativePending = true;
      return;
    }
    if (!nativePending) return;
    nativePending = false;
    const travel = Math.max(0, c.count - c.visibleSlides);
    finish(run, carouselSnapIndex(scroll.getSnapshot()[c.orientation].position * travel, travel));
  });
  const retire = () => {
    mounted = false;
    nativePending = false;
    dragging.set(false, 'carousel retired');
  };
  def.lifecycle.onUnmounted(retire);
  def.lifecycle.onBeforeDispose(retire);
  def.event.on('key.down', (run, e) => {
    if (!mounted || !focus.focused.get() || e.altKey || e.ctrlKey || e.metaKey) return;
    const c = run.context.tryRead(CAROUSEL_CONTEXT);
    if (!c || c.disabled) return;
    let next: number | undefined;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = c.maxIndex;
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
    finish(run, next);
  });
}
export const asCarouselViewport = defineAsHook<
  CarouselViewportProps,
  CarouselViewportExposes,
  CarouselViewportAsHookContract
>({
  name: 'as-carousel-viewport',
  setup: setupViewport,
});
export const carouselViewport = definePrototype({
  name: 'base-carousel-viewport',
  setup: setupViewport,
});
function setupSlide(def: DefHandle<CarouselSlideProps, CarouselSlideExposes>) {
  def.props.define({ index: { type: 'number' } });
  asCollectionItem().configure({
    family: CAROUSEL_FAMILY,
    role: 'slide',
    getMeta: (run) => ({ value: String(run.props.get().index ?? 0) }),
  });
  const current = def.state.bool('current', false),
    hidden = def.state.bool('hidden', true),
    label = def.state.string('label', ''),
    basis = def.state.numberRange('basis', 100, { min: 0, max: 100 }),
    minSize = def.state.numberRange('minSize', 0, { min: 0, max: 1000000 });
  const a = asAccessible();
  a.role('group');
  a.name(label);
  a.tree({ hidden });
  def.expose.state('current', current);
  def.expose.state('hidden', hidden);
  def.expose.state('basis', basis);
  def.expose.state('minSize', minSize);
  const sync = (run: RunHandle<CarouselSlideProps>) => {
    const c = run.context.read(CAROUSEL_CONTEXT),
      i = run.props.get().index ?? run.anatomy.order.indexOfSelf(CAROUSEL_FAMILY, 'slide');
    current.set(i === c.index, 'carousel active slide');
    const travel = Math.max(0, c.count - c.visibleSlides);
    const start = c.viewportRatio > 0 ? c.position * travel : Math.min(c.index, travel);
    hidden.set(
      i + 1 <= start + 1e-7 || i >= start + c.visibleSlides - 1e-7,
      'carousel outside viewport'
    );
    basis.set(100 / c.slidesPerView, 'carousel equal item basis');
    minSize.set(c.minSlideSize, 'carousel minimum item extent');
    label.set(`${i + 1} / ${c.count}`, 'carousel position');
  };
  def.context.subscribe(CAROUSEL_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  def.feedback.style.use(
    tw(
      'block box-border min-w-0 min-h-0 shrink-0 grow-0 basis-[min(100%,max(calc(var(--pui-basis)*1%),calc(var(--pui-min-size)*1px)))]'
    )
  );
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('invisible')),
  });
}
export const asCarouselSlide = defineAsHook<
  CarouselSlideProps,
  CarouselSlideExposes,
  CarouselSlideAsHookContract
>({ name: 'as-carousel-slide', setup: setupSlide });
export const carouselSlide = definePrototype({ name: 'base-carousel-slide', setup: setupSlide });
function navigation(delta: number) {
  return (def: DefHandle<CarouselPreviousProps, CarouselPreviousExposes>) => {
    const button = asButton();
    const focus = asFocusable();
    def.anatomy.claim(CAROUSEL_FAMILY, { role: delta < 0 ? 'previous' : 'next' });
    const isDisabled = (run: RunHandle<CarouselPreviousProps>) => {
      const c = run.context.read(CAROUSEL_CONTEXT);
      return (
        !!run.props.get().disabled ||
        c.disabled ||
        !c.count ||
        (!c.loop && (delta < 0 ? c.index <= 0 : c.index >= c.maxIndex))
      );
    };
    const sync = (run: RunHandle<CarouselPreviousProps>) => {
      const disabled = isDisabled(run);
      const states = button.stateHandles!;
      states.disabled.set(disabled, 'carousel control availability');
      focus.setDisabled(disabled);
      if (disabled) {
        states.hovered.set(false, 'carousel control disabled');
        states.pressed.set(false, 'carousel control disabled');
      }
    };
    def.context.subscribe(CAROUSEL_CONTEXT, sync);
    def.lifecycle.onMounted(sync);
    def.props.watchAll(sync);
    def.event.on('press.commit', (run) => {
      if (isDisabled(run)) return;
      const c = run.context.read(CAROUSEL_CONTEXT);
      callOwner(run, CAROUSEL_FAMILY, 'requestIndex', c.index + delta);
    });
  };
}
export const asCarouselPrevious = defineAsHook<
  CarouselPreviousProps,
  CarouselPreviousExposes,
  CarouselNavigationAsHookContract
>({
  name: 'as-carousel-previous',
  setup: navigation(-1),
});
export const carouselPrevious = definePrototype({
  name: 'base-carousel-previous',
  setup: navigation(-1),
});
export const asCarouselNext = defineAsHook<
  CarouselPreviousProps,
  CarouselPreviousExposes,
  CarouselNavigationAsHookContract
>({ name: 'as-carousel-next', setup: navigation(1) });
export const carouselNext = definePrototype({ name: 'base-carousel-next', setup: navigation(1) });
