import {
  createAnatomyFamily,
  createContextKey,
  type AnatomyPartView,
  type RunHandle,
} from '@proto.ui/core';
import type { RadioGroupItemProps, RadioGroupRootProps } from './types';


export type RadioGroupContextValue = {
  value: string;
  controlled: boolean;
  disabled: boolean;
  selectedItemId: string;
  currentItemId: string;
};

export type RadioGroupItemContextValue = {
  checked: boolean;
  disabled: boolean;
};

export type RadioGroupItemSnapshot = Readonly<{
  instanceId: string;
  value: string;
  disabled: boolean;
}>;

type RadioGroupValueRequest = (value: string) => boolean;

type RadioGroupCoordinator = Readonly<{
  setCurrent(itemId: string): void;
}>;

const RADIO_GROUP_COORDINATORS = new WeakMap<object, RadioGroupCoordinator>();

function readRadioGroupRoot(
  run: RunHandle<RadioGroupRootProps | RadioGroupItemProps>
): AnatomyPartView | null {
  return run.anatomy.partsOf(RADIO_GROUP_FAMILY, 'root')[0] ?? null;
}

function readRadioGroupValueRequest(
  run: RunHandle<RadioGroupRootProps | RadioGroupItemProps>
): RadioGroupValueRequest | null {
  const request = readRadioGroupRoot(run)?.getExpose('requestValue');
  return typeof request === 'function' ? (request as RadioGroupValueRequest) : null;
}

function readRadioGroupCoordinator(
  run: RunHandle<RadioGroupRootProps | RadioGroupItemProps>
): RadioGroupCoordinator | null {
  const valueState = readRadioGroupRoot(run)?.getExpose('value');
  return valueState && typeof valueState === 'object'
    ? (RADIO_GROUP_COORDINATORS.get(valueState) ?? null)
    : null;
}

export function registerRadioGroupCoordinator(
  valueState: object,
  coordinator: RadioGroupCoordinator
): () => void {
  RADIO_GROUP_COORDINATORS.set(valueState, coordinator);
  return () => {
    if (RADIO_GROUP_COORDINATORS.get(valueState) === coordinator) {
      RADIO_GROUP_COORDINATORS.delete(valueState);
    }
  };
}


let nextRadioGroupItemId = 0;

export function createRadioGroupItemId(): string {
  nextRadioGroupItemId += 1;
  return `pui-radio-group-item-${nextRadioGroupItemId}`;
}

export function readRadioGroupItemSnapshot(part: AnatomyPartView): RadioGroupItemSnapshot | null {
  const exposed = part.getExpose('__collectionItem');
  const raw = typeof exposed === 'function' ? exposed() : exposed;
  if (!raw || typeof raw !== 'object') return null;
  const snapshot = raw as Record<string, unknown>;
  if (typeof snapshot.instanceId !== 'string' || typeof snapshot.value !== 'string') return null;
  const disabledExpose = part.getExpose('disabled');
  const liveDisabled =
    disabledExpose &&
    typeof disabledExpose === 'object' &&
    typeof (disabledExpose as { get?: unknown }).get === 'function'
      ? (disabledExpose as { get(): unknown }).get()
      : snapshot.disabled;
  return {
    instanceId: snapshot.instanceId,
    value: snapshot.value,
    disabled: liveDisabled === true,
  };
}

export function getRadioGroupItems(
  run: RunHandle<RadioGroupRootProps | RadioGroupItemProps>
): readonly RadioGroupItemSnapshot[] {
  return run.anatomy.order
    .partsOf(RADIO_GROUP_FAMILY, 'item')
    .map(readRadioGroupItemSnapshot)
    .filter((snapshot): snapshot is RadioGroupItemSnapshot => snapshot !== null);
}


export function requestRadioGroupValue(
  run: RunHandle<RadioGroupItemProps>,
  value: string
): boolean {
  try {
    return readRadioGroupValueRequest(run)?.(value) ?? false;
  } catch (error) {
    if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return false;
    throw error;
  }
}

export function setRadioGroupCurrentItem(
  run: RunHandle<RadioGroupItemProps>,
  itemId: string
): void {
  readRadioGroupCoordinator(run)?.setCurrent(itemId);
  requestRadioGroupValue(run, run.context.read(RADIO_GROUP_CONTEXT).value);
}

export function notifyRadioGroupItemsChanged(run: RunHandle<RadioGroupItemProps>): void {
  requestRadioGroupValue(run, run.context.read(RADIO_GROUP_CONTEXT).value);
}

export const RADIO_GROUP_FAMILY = createAnatomyFamily('base-radio-group', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    item: { cardinality: { min: 1, max: 100 } },
    indicator: { cardinality: { min: 0, max: '*' } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'item' },
    { kind: 'contains', parent: 'item', child: 'indicator' },
  ],
});

export const RADIO_GROUP_CONTEXT =
  createContextKey<RadioGroupContextValue>('base-radio-group');
export const RADIO_GROUP_ITEM_CONTEXT =
  createContextKey<RadioGroupItemContextValue>('base-radio-group-item');
