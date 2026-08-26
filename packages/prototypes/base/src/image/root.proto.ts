import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { declareImageView } from '@proto.ui/module-image-view';
import type { ImageRootExposes, ImageRootProps } from './types';

function setupImageRoot(def: DefHandle<ImageRootProps, ImageRootExposes>): void {
  def.anatomy.claim('IMAGE' as any, { role: 'root' });
  const source = def.state.string('source', '');
  const loadingStatus = def.state.string('loadingStatus', 'idle');
  const fit = def.state.string('fit', 'contain');

  def.expose.state('source', source);
  def.expose.state('loadingStatus', loadingStatus);
  def.expose.state('fit', fit);
}

export const asImageRoot = defineAsHook<ImageRootProps, ImageRootExposes, {}>({
  name: 'as-image-root',
  modules: [
    declareImageView({
      source: '',
      alternativeText: '',
      fit: 'contain',
    }),
  ],
  setup: setupImageRoot,
});

const imageRoot = definePrototype({
  name: 'base-image-root',
  modules: asImageRoot.modules,
  setup: setupImageRoot,
});

export default imageRoot;
