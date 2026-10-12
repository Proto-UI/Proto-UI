import { definePrototype, type OverlayTargetAlignmentBinding } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { afterEach, expect, it } from 'vitest';
import {
  SELECT_CONTEXT,
  SELECT_FAMILY,
  selectRoot,
  selectTrigger,
  selectValue,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
} from '../src/select';
import { createSelectAlignmentController } from '../src/select/alignment-controller';
import type { SelectContentProps } from '../src/select/types';

const bindings: OverlayTargetAlignmentBinding[] = [];
let applied = 0;
const owner = definePrototype<SelectContentProps>({
  name: 'select-alignment-request-test-owner',
  setup(def) {
    def.props.define({
      position: { type: 'enum', options: ['item-aligned', 'popper'], empty: 'fallback' },
    });
    def.props.setDefaults({ position: 'item-aligned' });
    def.anatomy.claim(SELECT_FAMILY, { role: 'content' });
    const controller = createSelectAlignmentController({
      overlay: {
        registerTargetAlignment(binding) {
          if (binding) bindings.push(binding);
        },
      },
      changed() {},
      applied() {
        applied++;
        return true;
      },
    });
    def.context.subscribe(SELECT_CONTEXT, (run) => controller.reconcile(run));
    def.lifecycle.onMounted((run) => controller.mounted(run));
    def.lifecycle.onUpdated((run) => controller.updated(run));
    def.lifecycle.onBeforeDispose(() => controller.dispose());
    def.expose.method('deliverFirst', () => bindings[0]?.onAlignment({ status: 'applied' }));
    def.expose.method('deliverLast', () => bindings.at(-1)?.onAlignment({ status: 'applied' }));
    return (r) => [r.r.slot()];
  },
});
for (const part of [
  selectRoot,
  selectTrigger,
  selectValue,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
  owner,
])
  AdaptToWebComponent(part);
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  bindings.length = 0;
  applied = 0;
});

it('rejects an old applied callback after scalar collection revision changes but selected value stays the same', async () => {
  const root = document.createElement('base-select-root');
  const trigger = document.createElement('base-select-trigger');
  trigger.append(document.createElement('base-select-value'));
  const content = document.createElement(owner.name) as HTMLElement & {
    getExposes(): { deliverFirst(): void; deliverLast(): void };
  };
  const surface = document.createElement('base-select-surface'),
    viewport = document.createElement('base-select-viewport');
  const item = document.createElement('base-select-item');
  const text = document.createElement('base-select-item-text');
  text.textContent = 'Beta';
  item.append(text);
  setElementProps(item, { value: 'beta', textValue: 'Beta' });
  viewport.append(item);
  surface.append(viewport);
  content.append(surface);
  root.append(trigger, content);
  setElementProps(root, { open: true, value: 'beta' });
  document.body.append(root);
  await flush();
  expect(bindings.length).toBeGreaterThan(0);
  setElementProps(item, { value: 'beta', textValue: 'Renamed Beta' });
  await flush();
  expect(bindings.length).toBeGreaterThan(1);
  content.getExposes().deliverFirst();
  expect(applied).toBe(0);
  content.getExposes().deliverLast();
  expect(applied).toBe(1);
});
