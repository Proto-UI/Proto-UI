import type { AnatomyFamily } from './anatomy';
import type { PropsBaseType } from '@proto.ui/types';
import type { RunHandle } from './handles';

declare const controlLabelBrand: unique symbol;
export type ControlLabelRef = Readonly<{ [controlLabelBrand]: true }>;
const references = new WeakSet<object>();

/** Explicit pair identity, never a host ID, lookup key or serializable value. */
export function createControlLabelRef(): ControlLabelRef {
  const ref = Object.freeze({
    toJSON(): never {
      throw new TypeError(
        '[ControlLabel] opaque references cannot be serialized; use an explicit renderer association key'
      );
    },
  });
  references.add(ref);
  return ref as unknown as ControlLabelRef;
}

export function isControlLabelRef(value: unknown): value is ControlLabelRef {
  return typeof value === 'object' && value !== null && references.has(value);
}

export type ControlLabelOptions = Readonly<{ naming: boolean; activation: boolean }>;
export type ControlLabelActivationSource = 'pointer' | 'accessibility';
export type ControlLabelRequest = Readonly<{
  source: ControlLabelActivationSource;
  isCurrent(): boolean;
}>;
export type ControlLabelHandle = {
  sync(options: ControlLabelOptions): void;
};
/** Setup-only semantic anatomy tuple, never JSON Props or a caller-supplied host identity. */
export type ControlLabelAnatomyPair = Readonly<{
  family: AnatomyFamily;
  labelRole: string;
  targetRole: string;
}>;
export type ControlLabelFacade = {
  label(pair?: ControlLabelAnatomyPair): ControlLabelHandle;
  target<P extends PropsBaseType>(
    activate: (run: RunHandle<P>, request: ControlLabelRequest) => void,
    pair?: ControlLabelAnatomyPair
  ): ControlLabelHandle;
};

/** Dedicated instance-association input; never part of portable JSON Props. */
export type InstanceAssociations = Readonly<{ controlLabel?: ControlLabelRef | null }>;
export function validateInstanceAssociations(input: unknown): InstanceAssociations {
  // Even omitted input needs an own empty value in its normalized snapshot;
  // an empty ordinary object could otherwise expose an inherited association.
  if (input === undefined) return Object.freeze({ controlLabel: null });
  if (
    !input ||
    typeof input !== 'object' ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Object.getOwnPropertySymbols(input).length
  ) {
    throw new TypeError('[InstanceAssociations] expected the explicit typed association input');
  }
  for (const key of Object.getOwnPropertyNames(input)) {
    if (key !== 'controlLabel')
      throw new TypeError(`[InstanceAssociations] unsupported association: ${key}`);
  }
  const ref = Object.prototype.hasOwnProperty.call(input, 'controlLabel')
    ? (input as InstanceAssociations).controlLabel
    : null;
  if (ref != null && !isControlLabelRef(ref))
    throw new TypeError(
      '[InstanceAssociations] controlLabel requires a public opaque reference; attribute/static JSON values have no lowering'
    );
  return Object.freeze({ controlLabel: ref ?? null });
}
