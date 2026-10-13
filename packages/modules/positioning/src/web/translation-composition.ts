import type { Translation } from '@proto.ui/core';
type Written = { value: string; priority: string };
type Role = 'layout' | 'presentation';
type Entry = {
  baseline: Written;
  written: Written | null;
  lost: boolean;
  values: Map<Role, Translation>;
  owners: Map<Role, object>;
};
const entries = new WeakMap<HTMLElement, Entry>();
const read = (target: HTMLElement): Written => ({
  value: target.style.getPropertyValue('translate'),
  priority: target.style.getPropertyPriority('translate'),
});
const equal = (a: Written, b: Written) => a.value === b.value && a.priority === b.priority;
const zero = { px: 0, rootText: 0, ownBox: 0 };
const zeroVector: Translation = [zero, zero];
const format = (percent: number, px: number, rem: number) => {
  if (!rem && !px) return percent ? `${percent}%` : '0px';
  if (!rem && !percent) return `${px}px`;
  if (!px && !percent) return `${rem}rem`;
  return `calc(${percent}% + ${px}px + ${rem}rem)`;
};
/** One host property writer, two typed contributions; never reconstruct intent from CSS. */
export function acquireWebTranslation(target: HTMLElement, role: Role) {
  let entry = entries.get(target);
  if (!entry) {
    const baseline = read(target);
    // Existing uncoordinated translation is not an admitted semantic contribution.
    const computed =
      target.ownerDocument.defaultView?.getComputedStyle(target).getPropertyValue('translate') ??
      '';
    const neutral = (value: string) =>
      !value || value === 'none' || value === '0px' || value === '0px 0px' || value === '0% 0%';
    entry = {
      baseline,
      written: null,
      lost: !neutral(baseline.value) || !neutral(computed),
      values: new Map(),
      owners: new Map(),
    };
    entries.set(target, entry);
  }
  const owner = Object.freeze({});
  let active = true;
  if (entry.owners.has(role)) throw new Error('[translation] Channel already owned');
  entry.owners.set(role, owner);
  const current = () => {
    if (!active || entry!.owners.get(role) !== owner || entry!.lost) return false;
    if (!equal(read(target), entry!.written ?? entry!.baseline)) {
      entry!.lost = true;
      return false;
    }
    return true;
  };
  const project = () => {
    if (!current()) return false;
    const layout = entry!.values.get('layout') ?? zeroVector,
      presentation = entry!.values.get('presentation') ?? zeroVector;
    const axis = (i: number) => {
      const px = layout[i].px + presentation[i].px;
      const rem = layout[i].rootText + presentation[i].rootText;
      const percent = (layout[i].ownBox + presentation[i].ownBox) * 100;
      return format(percent, px, rem);
    };
    target.style.setProperty('translate', `${axis(0)} ${axis(1)}`, entry!.baseline.priority);
    entry!.written = read(target);
    return true;
  };
  return {
    canWrite: current,
    set(value: Translation) {
      if (!current()) return false;
      if (value.some((axis) => ![axis.px, axis.rootText, axis.ownBox].every(Number.isFinite)))
        return false;
      entry!.values.set(
        role,
        Object.freeze(value.map((axis) => Object.freeze({ ...axis }))) as unknown as Translation
      );
      return project();
    },
    release() {
      if (!active) return;
      const owns = current();
      entry!.values.delete(role);
      entry!.owners.delete(role);
      active = false;
      if (owns) {
        if (!entry!.owners.size) {
          if (entry!.baseline.value)
            target.style.setProperty('translate', entry!.baseline.value, entry!.baseline.priority);
          else target.style.removeProperty('translate');
          entry!.written = null;
        } else {
          const values = [...entry!.values.values()];
          const axis = (i: number) =>
            format(
              values.reduce((sum, v) => sum + v[i].ownBox, 0) * 100,
              values.reduce((sum, v) => sum + v[i].px, 0),
              values.reduce((sum, v) => sum + v[i].rootText, 0)
            );
          target.style.setProperty('translate', `${axis(0)} ${axis(1)}`, entry!.baseline.priority);
          entry!.written = read(target);
        }
      }
      if (!entry!.owners.size) entries.delete(target);
    },
  };
}
