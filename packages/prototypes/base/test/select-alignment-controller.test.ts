import {
  definePrototype,
  type OverlayTargetAlignmentBinding,
  type RunHandle,
} from '@proto.ui/core';
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
// Preserve withdrawals as well as registrations: replacing a target set must
// retire the old host lease before submitting the successor.
const registrations: (OverlayTargetAlignmentBinding | null)[] = [];
let applied = 0;
const owner = definePrototype<SelectContentProps>({
  name: 'select-alignment-request-test-owner',
  setup(def) {
    let currentRun!: RunHandle<SelectContentProps>;
    def.props.define({
      position: { type: 'enum', options: ['item-aligned', 'popper'], empty: 'fallback' },
    });
    def.props.setDefaults({ position: 'item-aligned' });
    def.anatomy.claim(SELECT_FAMILY, { role: 'content' });
    const controller = createSelectAlignmentController({
      overlay: {
        registerTargetAlignment(binding) {
          registrations.push(binding);
          if (binding) bindings.push(binding);
        },
      },
      changed() {},
      applied(_run, _row, _current, admission) {
        // The old-product control has no private acknowledgement argument.
        if (admission && !admission.accept()) return;
        applied++;
        return true;
      },
    });
    def.context.subscribe(SELECT_CONTEXT, (run) => controller.reconcile(run));
    def.props.watch(['position'], (run) => controller.reconcile(run));
    // Match real Content wiring, rather than manually invoking a replacement.
    for (const role of ['surface', 'viewport', 'item', 'item-text', 'trigger', 'value']) {
      def.anatomy.subscribeParts(SELECT_FAMILY, role, (run) => controller.structureChanged(run));
    }
    def.lifecycle.onCreated((run) => {
      currentRun = run;
    });
    def.lifecycle.onMounted((run) => controller.mounted(run));
    def.lifecycle.onUpdated((run) => controller.updated(run));
    def.lifecycle.onUnmounted(() => controller.unmounted());
    def.lifecycle.onBeforeDispose(() => controller.dispose());
    def.expose.method('setPresent', (present: boolean) => currentRun.lifecycle.setPresent(present));
    def.expose.method('snapshot', () => ({
      phase: controller.phase,
      diagnostic: controller.diagnostic,
      value: currentRun.context.read(SELECT_CONTEXT).value,
    }));
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
  registrations.length = 0;
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
  expect(bindings.at(-1)?.sizeMatch?.reference).toBe(bindings.at(-1)?.blockReference);
  expect(bindings.at(-1)?.sizeMatch?.targets).toEqual([bindings.at(-1)?.blockTarget]);
  setElementProps(item, { value: 'beta', textValue: 'Renamed Beta' });
  await flush();
  expect(bindings.length).toBeGreaterThan(1);
  content.getExposes().deliverFirst();
  expect(applied).toBe(0);
  content.getExposes().deliverLast();
  expect(applied).toBe(1);
});

it('replaces alignment readiness after view retirement while logical selection stays open', async () => {
  const root = document.createElement('base-select-root');
  const trigger = document.createElement('base-select-trigger');
  trigger.append(document.createElement('base-select-value'));
  const content = document.createElement(owner.name) as HTMLElement & {
    getExposes(): { setPresent(present: boolean): void };
  };
  const surface = document.createElement('base-select-surface');
  const viewport = document.createElement('base-select-viewport');
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
  const retired = bindings.at(-1)!;
  expect(retired).toBeDefined();
  retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);

  content.getExposes().setPresent(false);
  await flush();
  retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
  content.getExposes().setPresent(true);
  await flush();
  const current = bindings.at(-1)!;
  expect(current).not.toBe(retired);
  retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
  current.onAlignment({ status: 'applied' });
  expect(applied).toBe(2);
});


type TestContent = HTMLElement & {
  getExposes(): {
    snapshot(): { phase: string; diagnostic: string; value: string };
  };
};
function makeRow(value: string, disabled = false) {
  const row = document.createElement('base-select-item');
  const text = document.createElement('base-select-item-text');
  text.textContent = value;
  row.append(text);
  setElementProps(row, { value, textValue: value, disabled });
  return row;
}
async function mountRows(value: string | undefined = 'beta') {
  const root = document.createElement('base-select-root');
  const trigger = document.createElement('base-select-trigger');
  trigger.append(document.createElement('base-select-value'));
  const content = document.createElement(owner.name) as TestContent;
  const surface = document.createElement('base-select-surface');
  const viewport = document.createElement('base-select-viewport');
  const rows = [makeRow('alpha', true), makeRow('beta'), makeRow('gamma')];
  viewport.append(...rows);
  surface.append(viewport);
  content.append(surface);
  root.append(trigger, content);
  setElementProps(root, { open: true, ...(value === undefined ? {} : { value }) });
  document.body.append(root);
  await flush();
  expect(bindings.length).toBeGreaterThan(0);
  return { root, content, viewport, rows };
}
function rowValue(row: OverlayTargetAlignmentBinding['blockTarget']) {
  return (row.getExpose('getCollectionItem') as () => { value: string })().value;
}
function targetValues(binding: OverlayTargetAlignmentBinding) {
  return binding.sizeMatch!.targets.map(rowValue);
}
function expectWithdrawnBefore(binding: OverlayTargetAlignmentBinding) {
  const index = registrations.indexOf(binding);
  expect(index).toBeGreaterThan(0);
  expect(registrations[index - 1]).toBeNull();
}

it('sizes every registered sibling, including disabled rows, without changing the selected alignment target', async () => {
  const { root } = await mountRows();
  const first = bindings.at(-1)!;
  expect(targetValues(first)).toEqual(['alpha', 'beta', 'gamma']);
  expect(rowValue(first.blockTarget)).toBe('beta');
  expect(first.sizeMatch!.reference).toBe(first.blockReference);
  expect(first.sizeMatch!.targets[1]).toBe(first.blockTarget);
  setElementProps(root, { value: 'gamma' });
  await flush();
  const current = bindings.at(-1)!;
  expect(current).not.toBe(first);
  expect(targetValues(current)).toEqual(['alpha', 'beta', 'gamma']);
  expect(current.sizeMatch!.targets[2]).toBe(current.blockTarget);
  expect(rowValue(current.blockTarget)).toBe('gamma');
  expectWithdrawnBefore(current);
  first.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  current.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
});

it('keeps initially unset selection unset while sizing disabled and enabled siblings alike', async () => {
  // An empty committed value is the existing Root unset representation.
  const { content } = await mountRows('');
  const binding = bindings.at(-1)!;
  expect(targetValues(binding)).toEqual(['alpha', 'beta', 'gamma']);
  expect(rowValue(binding.blockTarget)).toBe('beta');
  expect(content.getExposes().snapshot().value).toBe('');
  binding.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
  expect(content.getExposes().snapshot().value).toBe('');
});

it('refreshes all-row targets after sibling registration, scalar updates and removal', async () => {
  const { viewport, rows } = await mountRows();
  const original = bindings.at(-1)!;
  const added = makeRow('delta');
  viewport.append(added);
  await flush();
  const registered = bindings.at(-1)!;
  expect(targetValues(registered)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  expectWithdrawnBefore(registered);
  setElementProps(rows[2], { textValue: 'Gamma renamed', disabled: true });
  await flush();
  const updated = bindings.at(-1)!;
  expect(updated).not.toBe(registered);
  expect(targetValues(updated)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  expect(rowValue(updated.blockTarget)).toBe('beta');
  expectWithdrawnBefore(updated);
  added.remove();
  await flush();
  const removed = bindings.at(-1)!;
  expect(targetValues(removed)).toEqual(['alpha', 'beta', 'gamma']);
  expectWithdrawnBefore(removed);
  for (const retired of [original, registered, updated]) retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  removed.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
});

it('withdraws the whole row lease on close and does not reuse the old delivery on reopen', async () => {
  const { root } = await mountRows();
  const retired = bindings.at(-1)!;
  setElementProps(root, { open: false });
  await flush();
  expect(registrations.at(-1)).toBeNull();
  retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  setElementProps(root, { open: true });
  await flush();
  const current = bindings.at(-1)!;
  expect(current).not.toBe(retired);
  expect(targetValues(current)).toEqual(['alpha', 'beta', 'gamma']);
  retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  current.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
});

it('retains named size conflict instead of accepting stale success or automatically choosing popper', async () => {
  const { content } = await mountRows();
  const failed = bindings.at(-1)!;
  failed.onAlignment({ status: 'unavailable', reason: 'size-conflict' });
  expect(registrations.at(-1)).toBeNull();
  expect(content.getExposes().snapshot()).toMatchObject({
    phase: 'geometry-unavailable', diagnostic: 'select.geometry.size-conflict', value: 'beta',
  });
  failed.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  const count = bindings.length;
  await flush();
  expect(bindings).toHaveLength(count);
  expect(content.getExposes().snapshot().phase).toBe('geometry-unavailable');
  // Explicit author mode change is allowed, but introduces no size binding.
  setElementProps(content, { position: 'popper' });
  await flush();
  expect(bindings).toHaveLength(count);
  expect(registrations.at(-1)).toBeNull();
  expect(content.getExposes().snapshot().phase).toBe('valid');
});

it('replaces a same-value sibling identity and withdraws the size set when its owner is disposed', async () => {
  const { root, rows } = await mountRows();
  const retired = bindings.at(-1)!;
  rows[2].replaceWith(makeRow('gamma'));
  await flush();
  const current = bindings.at(-1)!;
  expect(current).not.toBe(retired);
  expect(targetValues(current)).toEqual(['alpha', 'beta', 'gamma']);
  expectWithdrawnBefore(current);
  retired.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  root.remove();
  await flush();
  expect(registrations.at(-1)).toBeNull();
  current.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
});
