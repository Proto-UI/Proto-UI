import type { DefHandle } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import type {
  SeparatorRootAsHookContract,
  SeparatorRootExposes,
  SeparatorRootProps,
} from './types';

export type {
  SeparatorOrientation,
  SeparatorRootProps,
  SeparatorRootExposes,
  SeparatorRootStateHandles,
  SeparatorRootAsHookContract,
} from './types';

function setupSeparatorRoot(def: DefHandle<SeparatorRootProps, SeparatorRootExposes>) {
  // P-BASE-SEPARATOR-ORIENTATION, P-BASE-SEPARATOR-DECORATIVE
  def.props.define({
    orientation: { type: 'enum', empty: 'fallback', options: ['horizontal', 'vertical'] },
    decorative: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({ orientation: 'horizontal', decorative: true });

  // P-BASE-SEPARATOR-ORIENTATION
  const orientation = def.state.enum('orientation', 'horizontal', {
    options: ['horizontal', 'vertical'],
  });
  const decorative = def.state.bool('decorative', true);
  const role = def.state.string('role', '');
  const hidden = def.state.bool('hidden', true);
  const a11yOrientation = def.state.string('a11yOrientation', '');
  def.expose.state('orientation', orientation);
  def.expose.state('decorative', decorative);
  // P-BASE-SEPARATOR-DECORATIVE, P-BASE-SEPARATOR-SEMANTIC
  def.a11y.role(role);
  def.a11y.state('orientation', a11yOrientation);
  def.a11y.tree({ hidden });

  // P-BASE-SEPARATOR-ORIENTATION, P-BASE-SEPARATOR-DECORATIVE, P-BASE-SEPARATOR-SEMANTIC
  const sync = (props: Readonly<SeparatorRootProps>) => {
    const nextOrientation = props.orientation ?? 'horizontal';
    const nextDecorative = props.decorative ?? true;
    orientation.set(nextOrientation, 'reason: separator orientation');
    decorative.set(nextDecorative, 'reason: separator decorative');
    role.set(nextDecorative ? '' : 'separator', 'reason: separator role');
    a11yOrientation.set(
      nextDecorative ? '' : nextOrientation,
      'reason: separator a11y orientation'
    );
    hidden.set(nextDecorative, 'reason: separator hidden');
  };
  def.lifecycle.onCreated((run) => sync(run.props.get()));
  def.props.watchAll((_run, next) => sync(next));
  // P-BASE-SEPARATOR-CONTENTLESS: a separator cannot hide authored descendants.
  return () => null;
}

// P-BASE-SEPARATOR-NO-INTERACTION: this protocol declares no focus, event, or command channel.
export const asSeparatorRoot = defineAsHook<
  SeparatorRootProps,
  SeparatorRootExposes,
  SeparatorRootAsHookContract
>({ name: 'as-separator-root', setup: setupSeparatorRoot });

const separatorRoot = definePrototype({ name: 'base-separator-root', setup: setupSeparatorRoot });
export default separatorRoot;
