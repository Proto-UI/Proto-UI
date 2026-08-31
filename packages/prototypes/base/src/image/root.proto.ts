import {
  defineAsHook,
  definePrototype,
  type DefHandle,
  type ImageViewFit,
  type ImageViewStatus,
} from '@proto.ui/core';
import { asImageView } from '@proto.ui/hooks';
import { declareImageView } from '@proto.ui/module-image-view';
import type { ImageRootExposes, ImageRootProps } from './types';

function setupImageRoot(def: DefHandle<ImageRootProps, ImageRootExposes>) {
  def.props.define({
    source: { type: 'string', empty: 'fallback' },
    a11yMode: {
      type: 'enum',
      empty: 'fallback',
      options: ['informative', 'decorative'],
    },
    alternativeText: { type: 'string', empty: 'fallback' },
    fit: {
      type: 'enum',
      empty: 'fallback',
      options: ['contain', 'cover', 'fill'],
    },
  });
  def.props.setDefaults({
    a11yMode: 'informative',
    alternativeText: '',
    fit: 'contain',
  });

  const image = asImageView<ImageRootProps>();
  const source = def.state.string('source', '');
  const loadingStatus = def.state.enum<['idle', 'loading', 'loaded', 'error']>(
    'loadingStatus',
    'idle',
    { options: ['idle', 'loading', 'loaded', 'error'] }
  );
  const fit = def.state.enum<['contain', 'cover', 'fill']>('fit', 'contain', {
    options: ['contain', 'cover', 'fill'],
  });

  def.expose.state('source', source);
  def.expose.state('loadingStatus', loadingStatus);
  def.expose.state('fit', fit);
  def.expose.event('loadingStatusChange', { payload: 'json' });

  const projectSnapshot = () => {
    const snapshot = image.snapshot();
    source.set(snapshot?.source ?? '', 'reason: image-view source snapshot');
    loadingStatus.set(
      (snapshot?.loadingStatus ?? 'idle') as ImageViewStatus,
      'reason: image-view loading status snapshot'
    );
    fit.set((snapshot?.fit ?? 'contain') as ImageViewFit, 'reason: image-view fit snapshot');
  };

  const sync = (props: Readonly<ImageRootProps>) => {
    image.sync({
      source: props.source ?? '',
      a11yMode: props.a11yMode ?? 'informative',
      alternativeText: props.alternativeText ?? '',
      fit: props.fit ?? 'contain',
    });
    projectSnapshot();
  };

  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watch(['source', 'a11yMode', 'alternativeText', 'fit'], (_run, next) => sync(next));

  image.on('loadingStatusChange', (run, event) => {
    projectSnapshot();
    run.expose.emit('loadingStatusChange', event);
  });

  return () => null;
}

export const asImageRoot = defineAsHook<ImageRootProps, ImageRootExposes, {}>({
  name: 'as-image-root',
  modules: [
    declareImageView({
      source: '',
      alternativeText: '',
      a11yMode: 'informative',
      fit: 'contain',
    }),
  ],
  setup: setupImageRoot,
});

export const imageRoot = definePrototype({
  name: 'base-image-root',
  modules: asImageRoot.modules,
  setup: setupImageRoot,
});

export default imageRoot;
