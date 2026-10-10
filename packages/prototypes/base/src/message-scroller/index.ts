import {
  createAnatomyFamily,
  createContextKey,
  defineAsHook,
  definePrototype,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import { asScrollSurface, asAccessible } from '@proto.ui/hooks';
import { asScrollAreaRoot, asScrollAreaViewport } from '../scroll-area';
import { asButton } from '../button';
export interface MessageScrollerRootProps {
  newContentCount?: number;
}
export const MESSAGE_SCROLLER_FAMILY = createAnatomyFamily('base-message-scroller', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    viewport: { cardinality: { min: 1, max: 1 } },
    jump: { cardinality: { min: 0, max: 1 } },
  },
});
export const MESSAGE_SCROLLER_CONTEXT = createContextKey<{
  atEnd: boolean;
  following: string;
  newContentCount: number;
}>('base-message-scroller');
function setupRoot(def: DefHandle<MessageScrollerRootProps, any>) {
  asScrollAreaRoot();
  def.anatomy.claim(MESSAGE_SCROLLER_FAMILY, { role: 'root' });
  def.props.define({ newContentCount: { type: 'number' } });
  def.props.setDefaults({ newContentCount: 0 });
  def.context.provide(MESSAGE_SCROLLER_CONTEXT, {
    atEnd: true,
    following: 'pending',
    newContentCount: 0,
  });
  def.context.subscribe(MESSAGE_SCROLLER_CONTEXT);
  const sync = (run: RunHandle<MessageScrollerRootProps>) => {
    const c = run.context.read(MESSAGE_SCROLLER_CONTEXT);
    run.context.update(MESSAGE_SCROLLER_CONTEXT, {
      ...c,
      newContentCount: Math.max(0, Math.trunc(run.props.get().newContentCount ?? 0)),
    });
  };
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
}
export const asMessageScrollerRoot = defineAsHook({
  name: 'as-message-scroller-root',
  setup: setupRoot,
});
export const messageScrollerRoot = definePrototype({
  name: 'base-message-scroller-root',
  setup: setupRoot,
});
function setupViewport(def: DefHandle<Record<string, never>, any>) {
  asScrollAreaViewport();
  def.anatomy.claim(MESSAGE_SCROLLER_FAMILY, { role: 'viewport' });
  def.context.trySubscribe(MESSAGE_SCROLLER_CONTEXT);
  const scroll = asScrollSurface();
  scroll.configure({ axes: 'vertical', endFollow: { mode: 'while-at-end', axis: 'vertical' } });
  def.expose.state('atEnd', scroll.vertical.atEnd);
  def.expose.state('following', scroll.endFollow.state);
  def.expose.state('requestStatus', scroll.endFollow.requestStatus);
  def.expose.method('jumpToEnd', () => scroll.request({ kind: 'to-end', axis: 'vertical' }));
  const publish = (run: RunHandle<any>) => {
    const c = run.context.tryRead(MESSAGE_SCROLLER_CONTEXT);
    if (!c) return;
    const next = {
      ...c,
      atEnd: scroll.vertical.atEnd.get(),
      following: scroll.endFollow.state.get(),
    };
    if (next.atEnd !== c.atEnd || next.following !== c.following)
      run.context.update(MESSAGE_SCROLLER_CONTEXT, next);
  };
  scroll.vertical.atEnd.watch((run, e) => {
    if (e.type === 'next') publish(run);
  });
  scroll.endFollow.state.watch((run, e) => {
    if (e.type === 'next') publish(run);
  });
  def.lifecycle.onMounted(publish);
  asAccessible().role('region');
}
export const asMessageScrollerViewport = defineAsHook({
  name: 'as-message-scroller-viewport',
  setup: setupViewport,
});
export const messageScrollerViewport = definePrototype({
  name: 'base-message-scroller-viewport',
  setup: setupViewport,
});
function setupJump(def: DefHandle<Record<string, never>, any>) {
  asButton();
  def.anatomy.claim(MESSAGE_SCROLLER_FAMILY, { role: 'jump' });
  const atEnd = def.state.bool('atEnd', true),
    count = def.state.numberDiscrete('newContentCount', 0);
  def.expose.state('atEnd', atEnd);
  def.expose.state('newContentCount', count);
  const sync = (run: RunHandle<any>) => {
    const c = run.context.read(MESSAGE_SCROLLER_CONTEXT);
    atEnd.set(c.atEnd, 'message scroller end fact');
    count.set(c.newContentCount, 'application new-content count');
  };
  def.context.subscribe(MESSAGE_SCROLLER_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.event.on('press.commit', (run) => {
    const fn = run.anatomy.partsOf(MESSAGE_SCROLLER_FAMILY, 'viewport')[0]?.getExpose('jumpToEnd');
    if (typeof fn === 'function') fn();
  });
}
export const asMessageScrollerJump = defineAsHook({
  name: 'as-message-scroller-jump',
  setup: setupJump,
});
export const messageScrollerJump = definePrototype({
  name: 'base-message-scroller-jump',
  setup: setupJump,
});
