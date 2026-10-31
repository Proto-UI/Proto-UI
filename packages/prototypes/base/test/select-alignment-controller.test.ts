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
    def.lifecycle.onCreated((run) => {
      currentRun = run;
    });
    def.lifecycle.onMounted((run) => controller.mounted(run));
    def.lifecycle.onUpdated((run) => controller.updated(run));
    def.lifecycle.onUnmounted(() => controller.unmounted());
    def.lifecycle.onBeforeDispose(() => controller.dispose());
    def.expose.method('setPresent', (present: boolean) => currentRun.lifecycle.setPresent(present));
    def.expose.method('alignmentDiagnostic', () => controller.diagnostic);
    def.expose.method('alignmentPhase', () => controller.phase);
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

async function sizingFixture(
  itemSizing: 'intrinsic' | 'match-trigger' = 'match-trigger',
  position: 'item-aligned' | 'popper' = 'item-aligned'
) {
  const root = document.createElement(selectRoot.name),
    trigger = document.createElement(selectTrigger.name);
  trigger.append(document.createElement(selectValue.name));
  const content = document.createElement(owner.name) as HTMLElement & {
    getExposes(): { alignmentDiagnostic(): string; alignmentPhase(): string };
  };
  setElementProps(content, { position });
  const surface = document.createElement(selectSurface.name),
    viewport = document.createElement(selectViewport.name);
  const rows = ['alpha', 'beta', 'gamma'].map((value) => {
    const row = document.createElement(selectItem.name),
      text = document.createElement(selectItemText.name);
    text.textContent = value;
    row.append(text);
    setElementProps(row, { value, textValue: value, disabled: value === 'gamma' });
    return row;
  });
  viewport.append(...rows);
  surface.append(viewport);
  content.append(surface);
  root.append(trigger, content);
  setElementProps(root, { open: true, value: 'beta', itemSizing });
  document.body.append(root);
  await flush();
  return { root, trigger, content, rows };
}
it('inherits the Root size policy for all rows including disabled without changing selection', async () => {
  await sizingFixture();
  const binding = bindings.at(-1)!;
  expect(binding.sizeMatch?.targets).toHaveLength(3);
  expect(binding.inlineReference).toBe(binding.blockReference);
  expect(binding.inlineTarget).toBe(binding.blockTarget);
  expect(binding.sizeMatch?.reference).toBe(binding.blockReference);
});
it('reconciles explicit intrinsic rows and Root policy changes without stale size bindings', async () => {
  const f = await sizingFixture();
  const previous = bindings.at(-1)!;
  setElementProps(f.rows[1], { value: 'beta', textValue: 'beta', itemSizing: 'intrinsic' });
  await flush();
  const next = bindings.at(-1)!;
  expect(next).not.toBe(previous);
  expect(next.sizeMatch?.targets).toHaveLength(2);
  expect(next.inlineTarget).not.toBe(next.blockTarget);
  previous.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  setElementProps(f.root, { open: true, value: 'beta', itemSizing: 'intrinsic' });
  await flush();
  expect(bindings.at(-1)?.sizeMatch).toBeUndefined();
});
it('reports explicit popper+match as unsupported rather than silently claiming size success', async () => {
  const f = await sizingFixture('match-trigger', 'popper');
  expect(bindings).toHaveLength(0);
  expect(f.content.getExposes().alignmentDiagnostic()).toBe('select.sizing.popper-not-supported');
  expect(f.content.getExposes().alignmentPhase()).toBe('geometry-unavailable');
});
it('retains the original intrinsic popper path', async () => {
  const f = await sizingFixture('intrinsic', 'popper');
  expect(bindings).toHaveLength(0);
  expect(f.content.getExposes().alignmentPhase()).toBe('popper');
  expect(f.content.getExposes().alignmentDiagnostic()).toBe('');
});

it('recovers a size conflict when the owner explicitly returns to intrinsic sizing', async () => {
  const f = await sizingFixture();
  const rejected = bindings.at(-1)!;
  rejected.onAlignment({ status: 'unavailable', reason: 'size-conflict' });
  expect(f.content.getExposes().alignmentPhase()).toBe('geometry-unavailable');
  setElementProps(f.root, { open: true, value: 'beta', itemSizing: 'intrinsic' });
  await flush();
  const next = bindings.at(-1)!;
  expect(next).not.toBe(rejected);
  expect(next.sizeMatch).toBeUndefined();
  rejected.onAlignment({ status: 'applied' });
  expect(applied).toBe(0);
  next.onAlignment({ status: 'applied' });
  expect(applied).toBe(1);
});
