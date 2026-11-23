import { defineAsHook, definePrototype, type Prototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/select';
import * as shadcn from '../../../shadcn/src/select';
import * as brutalist from '../../../brutalist/src/select';

export const selectLegacyFamilies = { base, shadcn, brutalist };
let sequence = 0;
type Part = HTMLElement & { getExposes(): Record<string, any> };

export function mountSelectLegacySlotProbe(
  family: keyof typeof selectLegacyFamilies,
  itemPrototype: Prototype<any, any> = selectLegacyFamilies[family].selectItem
) {
  const parts = selectLegacyFamilies[family];
  const surfacePrototype = 'selectSurface' in parts ? parts.selectSurface : undefined;
  const viewportPrototype = 'selectViewport' in parts ? parts.selectViewport : undefined;
  for (const prototype of [
    parts.selectRoot,
    parts.selectTrigger,
    parts.selectContent,
    surfacePrototype,
    viewportPrototype,
  ])
    if (prototype) AdaptToWebComponent(prototype);
  const tag = `select-legacy-slot-${family}-${++sequence}`;
  // Legacy consumers borrow their slot in their own setup scope. The complete
  // authored Item runs in a nested hook frame, preserving the same shared
  // legacy accessibility storage without manufacturing a duplicate local name.
  const useItem = defineAsHook({ name: `${tag}-item`, setup: itemPrototype.setup });
  AdaptToWebComponent(
    definePrototype({
      name: tag,
      setup(def) {
        const render = useItem().render;
        const legacy = def.state.fromAccessibility('selected');
        let writes = 0;
        def.expose.method('writeLegacySelected', (value: boolean) => {
          ++writes;
          legacy.set(value, 'reason: #1156 conflicting retained legacy slot');
          return legacy.get();
        });
        def.expose.method('readLegacySelected', () => legacy.get());
        def.expose.method('legacyWriteCount', () => writes);
        return render;
      },
    })
  );
  const node = (name: string, props: Record<string, unknown> = {}) => {
    const part = document.createElement(name) as Part;
    setElementProps(part, props);
    return part;
  };
  const root = node(parts.selectRoot.name, { value: 'alpha' });
  const trigger = node(parts.selectTrigger.name);
  trigger.textContent = 'Choose';
  const content = node(parts.selectContent.name);
  const surface = surfacePrototype ? node(surfacePrototype.name) : content;
  const viewport = viewportPrototype ? node(viewportPrototype.name) : surface;
  const items = ['alpha', 'beta'].map((value) => {
    const item = node(tag, { value, textValue: value });
    item.textContent = value;
    viewport.append(item);
    return item;
  });
  if (surface !== viewport) surface.append(viewport);
  if (content !== surface) content.append(surface);
  root.append(trigger, content);
  document.body.append(root);
  const requests: unknown[] = [];
  root.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
  return {
    root,
    items,
    write(values: [boolean, boolean]) {
      return items.map((item, index) => item.getExposes().writeLegacySelected(values[index]));
    },
    commit(value: string) {
      setElementProps(root, { value });
    },
    refuse() {
      root.getExposes().requestValue({ value: 'beta', textValue: 'beta', reason: 'programmatic' });
    },
    read() {
      return {
        value: root.getExposes().value.get(),
        legacy: items.map((item) => item.getExposes().readLegacySelected()),
        writes: items.map((item) => item.getExposes().legacyWriteCount()),
        selected: items.map((item) => item.getExposes().selected.get()),
        aria: items.map((item) => item.getAttribute('aria-selected')),
        connected: items.every((item) => item.isConnected),
        requests: [...requests],
      };
    },
    dispose() {
      root.remove();
    },
  };
}

export type SelectLegacySlotSnapshot = ReturnType<
  ReturnType<typeof mountSelectLegacySlotProbe>['read']
>;

export function followsCommittedRoot(snapshot: SelectLegacySlotSnapshot): boolean {
  const selected = ['alpha', 'beta'].map((value) => value === snapshot.value);
  return selected.every(
    (value, index) => snapshot.selected[index] === value && snapshot.aria[index] === String(value)
  );
}
