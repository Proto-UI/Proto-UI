import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createDrawerPartId, DRAWER_CONTEXT, DRAWER_FAMILY } from './shared';
import type { DrawerTitleAsHookContract, DrawerTitleExposes, DrawerTitleProps } from './types';

function setupDrawerTitle(def: DefHandle<DrawerTitleProps, DrawerTitleExposes>): void {
  const accessible = asAccessible();

  def.anatomy.claim(DRAWER_FAMILY, { role: 'title' });
  const id = def.state.string('drawerTitleId', '');
  accessible.id(id);
  accessible.nameFromContent();
  def.context.subscribe(DRAWER_CONTEXT, (_run, next) => {
    id.set(createDrawerPartId(next.rootId, 'title'), 'reason: drawer title id sync');
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createDrawerPartId(run.context.read(DRAWER_CONTEXT).rootId, 'title'),
      'reason: drawer title created id sync'
    );
  });
}

export const asDrawerTitle = defineAsHook<
  DrawerTitleProps,
  DrawerTitleExposes,
  DrawerTitleAsHookContract
>({
  name: 'as-drawer-title',
  setup: setupDrawerTitle,
});

const drawerTitle = definePrototype({
  name: 'base-drawer-title',
  setup: setupDrawerTitle,
});

export default drawerTitle;
