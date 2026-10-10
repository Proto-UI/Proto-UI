import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { createDrawerPartId, DRAWER_CONTEXT, DRAWER_FAMILY } from './shared';
import type {
  DrawerDescriptionAsHookContract,
  DrawerDescriptionExposes,
  DrawerDescriptionProps,
} from './types';

function setupDrawerDescription(
  def: DefHandle<DrawerDescriptionProps, DrawerDescriptionExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(DRAWER_FAMILY, { role: 'description' });
  const id = def.state.string('drawerDescriptionId', '');
  accessible.id(id);
  def.context.subscribe(DRAWER_CONTEXT, (_run, next) => {
    id.set(createDrawerPartId(next.rootId, 'description'), 'reason: drawer description id sync');
  });
  def.lifecycle.onCreated((run) => {
    id.set(
      createDrawerPartId(run.context.read(DRAWER_CONTEXT).rootId, 'description'),
      'reason: drawer description created id sync'
    );
  });
}

export const asDrawerDescription = defineAsHook<
  DrawerDescriptionProps,
  DrawerDescriptionExposes,
  DrawerDescriptionAsHookContract
>({
  name: 'as-drawer-description',
  setup: setupDrawerDescription,
});

const drawerDescription = definePrototype({
  name: 'base-drawer-description',
  setup: setupDrawerDescription,
});

export default drawerDescription;
