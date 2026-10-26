import { definePrototype, tw } from '@proto.ui/core';
import { asSelectContent, SELECT_CONTEXT } from '@proto.ui/prototypes-base/select';
import { SELECT_VISUAL } from './visual';
import { setupSelectStyle } from './style';
import { SHADCN_STYLE_SCOPE } from '../style-scope';
import type { ShadcnSelectContentExposes, ShadcnSelectContentProps } from './types';

const selectContent = definePrototype<ShadcnSelectContentProps, ShadcnSelectContentExposes>({
  name: 'shadcn-select-content',
  setup(def) {
    const select = asSelectContent();
    const style = setupSelectStyle(def);
    // Override Base neutral policy only after its defaults are registered.
    def.props.setDefaults({
      position: 'item-aligned',
      align: 'center',
      sideOffset: 0,
    });
    // P-SHADCN-SELECT-CONTENT-TRANSITION
    select.asTransition.configure({
      enterDuration: 150,
      leaveDuration: 0,
      interrupt: 'reverse',
    });
    const { open, alignmentFull } = select.stateHandles;
    const { transitionState } = select.asTransition;

    def.context.provide(SELECT_VISUAL, {
      phase: 'closed',
      side: 'bottom',
      position: 'item-aligned',
    });
    const syncVisual = (run: import('@proto.ui/core').RunHandle<ShadcnSelectContentProps>) => {
      const props = run.props.get();
      run.context.update(SELECT_VISUAL, {
        phase: transitionState.get(),
        side: props.position === 'popper' ? (props.side ?? 'bottom') : '',
        position: props.position ?? 'item-aligned',
      });
    };
    transitionState.watch((run, event) => {
      if (event.type === 'next') syncVisual(run);
    });
    def.props.watch(['side', 'position'], syncVisual);
    def.lifecycle.onCreated(syncVisual);
    let disposed = false;
    def.lifecycle.onBeforeDispose(() => {
      disposed = true;
    });
    def.context.subscribe(SELECT_CONTEXT, (run, next) => {
      if (next.open || disposed) return;
      // Read the latest Root fact after a synchronous beforeLeave callback.
      if (!run.context.read(SELECT_CONTEXT).open && transitionState.get() === 'leaving')
        select.asTransition.controls.complete();
    });

    def.rule({
      when: (w) => w.state(alignmentFull).eq(true),
      intent: (i) => i.feedback.style.use(tw('flex flex-col')),
    });
    def.rule({
      when: (w) => w.all(w.state(alignmentFull).eq(true), w.prop('position').eq('popper')),
      intent: (i) => i.feedback.style.use(tw('max-h-[var(--proto-ui-available-height)]')),
    });
    // The legacy zero-new-parts composition retains its old paint temporarily.
    // P-SHADCN-SELECT-CONTENT-CURRENT-VISUAL-SURFACE
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(alignmentFull).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'relative z-50 w-[var(--proto-ui-anchor-width)] min-w-[var(--proto-ui-anchor-width)] max-h-[var(--proto-ui-available-height)] overflow-x-hidden overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none transition-none duration-150'
          )
        ),
    });
    // P-SHADCN-SELECT-CONTENT-OPEN-AND-SIDE-STYLES
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(alignmentFull).eq(false),
          w.any(w.state(transitionState).eq('entering'), w.state(transitionState).eq('entered'))
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(alignmentFull).eq(false),
          w.state(open).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(alignmentFull).eq(false),
          w.state(open).eq(true),
          w.prop('position').eq('popper'),
          w.prop('side').eq('bottom')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-top-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(alignmentFull).eq(false),
          w.state(open).eq(true),
          w.prop('position').eq('popper'),
          w.prop('side').eq('top')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-bottom-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(alignmentFull).eq(false),
          w.state(open).eq(true),
          w.prop('position').eq('popper'),
          w.prop('side').eq('left')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-right-2')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(alignmentFull).eq(false),
          w.state(open).eq(true),
          w.prop('position').eq('popper'),
          w.prop('side').eq('right')
        ),
      intent: (i) => i.feedback.style.use(tw('slide-in-from-left-2')),
    });
    // Rhea's translucent paint belongs to the existing public Surface owner.
    // Content performs alignment updates and cannot own a fixed decoration lease.
    let compositionCommitted = false;
    const validateComposition = () => {
      if (!compositionCommitted) return;
      if (open.get() && style.get() === 'rhea' && !alignmentFull.get()) {
        throw new Error(
          '[shadcn-select] Rhea requires the complete Select Surface/Viewport/ItemText composition.'
        );
      }
    };
    def.lifecycle.onUpdated(() => {
      compositionCommitted = true;
      validateComposition();
    });
    def.lifecycle.onUnmounted(() => {
      compositionCommitted = false;
    });
    def.context.trySubscribe(SHADCN_STYLE_SCOPE, validateComposition);
    def.props.watchRaw(['styleProfile'], validateComposition);
  },
});

export default selectContent;
