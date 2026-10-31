import type { DataType } from './data-types';
import type { ValueType } from './ir';

/** Private IR distinctions, not runtime wrappers or a new public capability. */
export function isEventValue(type: ValueType): type is 'event' | 'event-control' | 'event-or-control' {
  return type === 'event' || type === 'event-control' || type === 'event-or-control';
}
export function eventValueJoin(types: readonly ValueType[]): ValueType | undefined {
  if (!types.length || !types.every(isEventValue)) return undefined;
  return types.every((type) => type === types[0]) ? types[0] : 'event-or-control';
}
const optional = (...members: DataType[]): DataType => ({kind:'union', members:[...members, 'void']});
/** Data members are admitted only on a proven portable payload, never its control or join. */
export function eventPayloadMemberType(owner: ValueType, key: string): ValueType | undefined {
  if (owner !== 'event') return undefined;
  if (key === 'control') return 'event-control';
  if (key === 'type') return 'string';
  if (key === 'key') return optional('string');
  if (['shiftKey','ctrlKey','altKey','metaKey','repeat'].includes(key)) return optional('boolean');
  if (key === 'pointerType') return optional(...['mouse','touch','pen','unknown'].map((value): DataType => ({kind:'literal',value})));
  if (key === 'pointerButtons') return optional(...['none','active','unknown'].map((value): DataType => ({kind:'literal',value})));
  return undefined;
}
