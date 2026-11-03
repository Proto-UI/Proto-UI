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
      applied(_run, _row, _current, admission) {
        // The old-product control has no private acknowledgement argument.
        if (admission && !admission.accept()) return;
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

import { getElementProps } from '@proto.ui/adapter-web-component';

// setElementProps replaces raw props. Only this test helper models an author
// updating one field while deliberately retaining every other authored input.
function updatePolicyFixtureProps(element: HTMLElement, change: Record<string, unknown>) {
  const previous = { ...getElementProps(element) };
  const complete = { ...previous, ...change };
  setElementProps(element, complete);
  expect(getElementProps(element)).toEqual(complete);
  for (const key of ['open', 'value', 'textValue', 'disabled', 'itemSizing']) {
    if (Object.hasOwn(previous, key) && !Object.hasOwn(change, key)) {
      expect(getElementProps(element)?.[key]).toBe(previous[key]);
    }
  }
}

// Public WC inputs and the real semantic controller; captured safe-part requests
// are not browser layout, actual Overlay admission, or native input evidence.
const policyOwner = definePrototype<SelectContentProps>({
  name: 'select-size-policy-test-owner',
  setup(def) {
    let run!: RunHandle<SelectContentProps>;
    const requests: Array<OverlayTargetAlignmentBinding | null> = [];
    let deliveries = 0;
    def.props.define({
      position: { type: 'enum', options: ['item-aligned', 'popper'], empty: 'fallback' },
    });
    def.props.setDefaults({ position: 'item-aligned' });
    def.anatomy.claim(SELECT_FAMILY, { role: 'content' });
    const controller = createSelectAlignmentController({
      overlay: { registerTargetAlignment: (request) => requests.push(request) },
      changed() {},
      applied(_run, _row, _current, admission) {
        // The old-product control has no private acknowledgement argument.
        if (admission && !admission.accept()) return;
        deliveries++;
        return true;
      },
    });
    def.lifecycle.onCreated((next) => {
      run = next;
    });
    def.context.subscribe(SELECT_CONTEXT, (next) => controller.reconcile(next));
    def.props.watch(['position'], (next) => controller.reconcile(next));
    for (const role of ['surface', 'viewport', 'item', 'item-text', 'trigger', 'value']) {
      def.anatomy.subscribeParts(SELECT_FAMILY, role, (next) => controller.structureChanged(next));
    }
    def.lifecycle.onMounted((next) => controller.mounted(next));
    def.lifecycle.onUpdated((next) => controller.updated(next));
    def.lifecycle.onUnmounted(() => controller.unmounted());
    def.lifecycle.onBeforeDispose(() => controller.dispose());
    def.expose.method('setPresent', (present: boolean) => run.lifecycle.setPresent(present));
    def.expose.method('snapshot', () => ({
      phase: controller.phase,
      diagnostic: controller.diagnostic,
      context: run.context.read(SELECT_CONTEXT),
      requests: [...requests],
      deliveries,
    }));
    return (r) => [r.r.slot()];
  },
});
AdaptToWebComponent(policyOwner);

type PolicySnapshot = {
  phase: string;
  diagnostic: string;
  context: import('../src/select').SelectContextValue;
  requests: Array<OverlayTargetAlignmentBinding | null>;
  deliveries: number;
};
async function policyFixture(
  options: {
    root?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
    position?: 'item-aligned' | 'popper';
    legacy?: boolean;
  } = {}
) {
  const root = document.createElement('base-select-root') as any;
  const trigger = document.createElement('base-select-trigger');
  const value = document.createElement('base-select-value');
  trigger.append(value);
  const content = document.createElement(policyOwner.name) as HTMLElement & {
    getExposes(): { snapshot(): PolicySnapshot; setPresent(present: boolean): void };
  };
  updatePolicyFixtureProps(content, { position: options.position ?? 'item-aligned' });
  const surface = document.createElement('base-select-surface');
  const viewport = document.createElement('base-select-viewport');
  const items = (
    options.items ?? [
      { value: 'alpha', textValue: 'Alpha' },
      { value: 'beta', textValue: 'Beta' },
      { value: 'gamma', textValue: 'Gamma', disabled: true },
    ]
  ).map((props) => {
    const item = document.createElement('base-select-item') as any;
    updatePolicyFixtureProps(item, props);
    if (options.legacy) item.textContent = String(props.textValue);
    else {
      const text = document.createElement('base-select-item-text');
      text.textContent = String(props.textValue);
      item.append(text);
    }
    (options.legacy ? content : viewport).append(item);
    return item;
  });
  if (!options.legacy) {
    surface.append(viewport);
    content.append(surface);
  }
  updatePolicyFixtureProps(root, { open: true, value: 'beta', ...options.root });
  root.append(trigger, content);
  const events: string[] = [];
  for (const name of ['openChange', 'valueChange'])
    root.addEventListener(name, () => events.push(name));
  for (const item of items) item.addEventListener('select', () => events.push('select'));
  document.body.append(root);
  await flush();
  const snapshot = () => content.getExposes().snapshot();
  const binding = () => {
    const request = snapshot().requests.at(-1);
    expect(request).toBeTruthy();
    return request!;
  };
  return { root, trigger, value, content, surface, viewport, items, events, snapshot, binding };
}
const requestedValues = (binding: OverlayTargetAlignmentBinding) =>
  binding.sizeMatch?.targets.map(
    (part) => (part.getExpose('getCollectionItem') as () => { value: string })().value
  );

it('keeps public omitted sizing intrinsic and publishes normalized inheriting metadata', async () => {
  const f = await policyFixture();
  expect(f.snapshot().context.itemSizing).toBe('intrinsic');
  expect(f.items.map((item) => item.getExposes().getCollectionItem().itemSizing)).toEqual([
    'inherit',
    'inherit',
    'inherit',
  ]);
  expect(f.binding().sizeMatch).toBeUndefined();
  expect(f.binding().inlineReference.role).toBe('value');
  expect(f.binding().inlineTarget.role).toBe('item-text');
  expect(f.events).toEqual([]);
});

it('matches inherited enabled and disabled rows to the exact Trigger and selected row identities', async () => {
  const f = await policyFixture({
    root: { itemSizing: 'match-trigger' },
    items: [
      { value: 'alpha', textValue: 'Alpha', itemSizing: 'intrinsic' },
      { value: 'beta', textValue: 'Beta' },
      { value: 'gamma', textValue: 'Gamma', disabled: true },
    ],
  });
  const b = f.binding();
  expect(requestedValues(b)).toEqual(['beta', 'gamma']);
  expect(b.sizeMatch!.reference).toBe(b.blockReference);
  expect(b.inlineReference).toBe(b.blockReference);
  expect(b.inlineTarget).toBe(b.blockTarget);
  expect(b.sizeMatch!.targets[0]).toBe(b.blockTarget);
  expect(f.items[2].getExposes().disabled.get()).toBe(true);
  expect(f.root.getExposes().value.get()).toBe('beta');
  expect(f.events).toEqual([]);
});

it('keeps intrinsic selected text alignment while other rows still inherit matching', async () => {
  const f = await policyFixture({
    root: { itemSizing: 'match-trigger' },
    items: [
      { value: 'alpha', textValue: 'Alpha' },
      { value: 'beta', textValue: 'Beta', itemSizing: 'intrinsic' },
      { value: 'gamma', textValue: 'Gamma', disabled: true },
    ],
  });
  const b = f.binding();
  expect(requestedValues(b)).toEqual(['alpha', 'gamma']);
  expect(b.inlineReference.role).toBe('value');
  expect(b.inlineTarget.role).toBe('item-text');
  expect(b.sizeMatch!.targets).not.toContain(b.blockTarget);
});

it('omits an empty size association when every row opts out', async () => {
  const f = await policyFixture({
    root: { itemSizing: 'match-trigger' },
    items: [{ value: 'beta', textValue: 'Beta', itemSizing: 'intrinsic' }],
  });
  expect(f.binding().sizeMatch).toBeUndefined();
  expect(f.binding().inlineTarget.role).toBe('item-text');
});

it('retires pending requests on a Root policy change without selection or open events', async () => {
  const f = await policyFixture();
  const old = f.binding();
  old.onAlignment({ status: 'pending-target', reason: 'missing-target' });
  updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
  await flush();
  const current = f.binding();
  expect(current).not.toBe(old);
  expect(requestedValues(current)).toEqual(['alpha', 'beta', 'gamma']);
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(0);
  expect(f.snapshot().phase).toBe('full-pending');
  current.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(1);
  expect(f.root.getExposes().value.get()).toBe('beta');
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.events).toEqual([]);
});

it('bumps scalar revision for a same-value Item policy change and rejects all old statuses', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  const old = f.binding();
  const revision = f.snapshot().context.collectionRevision!;
  updatePolicyFixtureProps(f.items[1], { itemSizing: 'intrinsic' });
  await flush();
  expect(f.snapshot().context.collectionRevision).toBe(revision + 1);
  const current = f.binding();
  expect(current).not.toBe(old);
  expect(requestedValues(current)).toEqual(['alpha', 'gamma']);
  old.onAlignment({ status: 'unavailable', reason: 'invalid-association' });
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().phase).toBe('full-pending');
  expect(f.snapshot().deliveries).toBe(0);
  current.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(1);
  expect(f.events).toEqual([]);
});

it('deduplicates equivalent Root and Item policies without replacing current readiness', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  const b = f.binding();
  b.onAlignment({ status: 'applied' });
  const before = f.snapshot();
  updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
  updatePolicyFixtureProps(f.items[1], { itemSizing: 'inherit' });
  await flush();
  expect(f.snapshot().context.collectionRevision).toBe(before.context.collectionRevision);
  expect(f.snapshot().requests.length).toBe(before.requests.length);
  expect(f.binding()).toBe(b);
  expect(f.snapshot().deliveries).toBe(1);
});

it('normalizes unknown strings after a valid policy instead of retaining that policy', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  updatePolicyFixtureProps(f.root, { itemSizing: 'not-a-policy' });
  updatePolicyFixtureProps(f.items[1], { itemSizing: 'intrinsic' });
  await flush();
  expect(f.snapshot().context.itemSizing).toBe('intrinsic');
  expect(f.binding().sizeMatch).toBeUndefined();
  const revision = f.snapshot().context.collectionRevision!;
  updatePolicyFixtureProps(f.items[1], { itemSizing: 'not-an-item-policy' });
  await flush();
  expect(f.items[1].getExposes().getCollectionItem().itemSizing).toBe('inherit');
  expect(f.snapshot().context.collectionRevision).toBe(revision + 1);
});

it('keeps old callbacks retired across close, policy change while closed and reopen', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  const old = f.binding();
  updatePolicyFixtureProps(f.root, { open: false });
  await flush();
  expect(f.snapshot().requests.at(-1)).toBeNull();
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  await flush();
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(0);
  updatePolicyFixtureProps(f.root, { open: true });
  await flush();
  const current = f.binding();
  expect(current).not.toBe(old);
  expect(current.sizeMatch).toBeUndefined();
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(0);
  current.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(1);
});

it('does not deliver a matched size request after view withdrawal and remount', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  const old = f.binding();
  f.content.getExposes().setPresent(false);
  await flush();
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(0);
  f.content.getExposes().setPresent(true);
  await flush();
  const current = f.binding();
  expect(current).not.toBe(old);
  expect(requestedValues(current)).toEqual(['alpha', 'beta', 'gamma']);
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(0);
  current.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(1);
});

it.each([false, true])(
  'rejects explicit Popper matching before full-parts admission (legacy=%s)',
  async (legacy) => {
    const f = await policyFixture({
      root: { itemSizing: 'match-trigger' },
      position: 'popper',
      legacy,
    });
    expect(f.snapshot().phase).toBe('geometry-unavailable');
    expect(f.snapshot().diagnostic).toBe('select.geometry.unsupported-size-mode');
    expect(f.snapshot().requests.every((request) => request === null)).toBe(true);
    expect(f.snapshot().context.open).toBe(true);
    expect(f.snapshot().context.value).toBe('beta');
    updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
    await flush();
    expect(f.snapshot().phase).toBe('popper');
    expect(f.snapshot().diagnostic).toBe('');
    expect(f.events).toEqual([]);
  }
);

it('allows intrinsic repair of only the size-specific missing-parts legacy boundary', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' }, legacy: true });
  expect(f.snapshot().diagnostic).toBe('select.structure.missing-size-parts');
  expect(f.snapshot().phase).toBe('structure-invalid');
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  await flush();
  expect(f.snapshot().phase).toBe('legacy');
  expect(f.events).toEqual([]);
});

it('does not use a sizing-policy repair to unlock an independent structural failure', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  f.items[1].replaceChildren();
  await flush();
  expect(f.snapshot().diagnostic).toBe('select.structure.missing-or-ambiguous-item-text');
  const before = f.snapshot().requests.length;
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  await flush();
  expect(f.snapshot().phase).toBe('structure-invalid');
  expect(f.snapshot().requests.length).toBe(before);
  expect(f.snapshot().diagnostic).toBe('select.structure.missing-or-ambiguous-item-text');
});

it('permits a real Root policy repair after geometry failure without replaying old readiness', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' } });
  const old = f.binding();
  old.onAlignment({ status: 'unavailable', reason: 'size-conflict' });
  expect(f.snapshot().phase).toBe('geometry-unavailable');
  const before = f.snapshot().requests.length;
  updatePolicyFixtureProps(f.root, { readOnly: true });
  await flush();
  expect(f.snapshot().requests.length).toBe(before);
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  await flush();
  const current = f.binding();
  expect(current.sizeMatch).toBeUndefined();
  old.onAlignment({ status: 'applied' });
  expect(f.snapshot().deliveries).toBe(0);
  expect(f.snapshot().context.readOnly).toBe(true);
});

it('preserves focused ownership through sizing metadata and a repeated open request', async () => {
  const f = await policyFixture({
    root: { value: 'alpha', itemSizing: 'match-trigger', readOnly: true },
  });
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await flush();
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, true, false]);
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  updatePolicyFixtureProps(f.items[1], { itemSizing: 'intrinsic' });
  await flush();
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.events).toEqual([]);
  f.root
    .getExposes()
    .requestOpen({ open: true, reason: 'size-policy-repeat', focusReason: 'programmatic' });
  await flush();
  // Source-adapter synthetic pointer input only, not the native-browser journey.
  f.items[1].dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      composed: true,
      pointerType: 'mouse',
      buttons: 0,
    })
  );
  await flush();
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, true, false]);
  expect(f.items.map((item) => item.getExposes().selected.get())).toEqual([true, false, false]);
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(f.events).toEqual(['openChange']);
});

it('repairs only an unsupported size mode by switching back to item alignment', async () => {
  const f = await policyFixture({ root: { itemSizing: 'match-trigger' }, position: 'popper' });
  expect(f.snapshot().diagnostic).toBe('select.geometry.unsupported-size-mode');
  updatePolicyFixtureProps(f.content, { position: 'item-aligned' });
  await flush();
  expect(f.snapshot().phase).toBe('full-pending');
  const repaired = f.binding();
  expect(requestedValues(repaired)).toEqual(['alpha', 'beta', 'gamma']);
  repaired.onAlignment({ status: 'unavailable', reason: 'size-conflict' });
  expect(f.snapshot().diagnostic).toBe('select.geometry.size-conflict');
  const before = f.snapshot().requests.length;
  updatePolicyFixtureProps(f.content, { position: 'item-aligned' });
  await flush();
  expect(f.snapshot().requests.length).toBe(before);
  expect(f.snapshot().phase).toBe('geometry-unavailable');
  expect(f.events).toEqual([]);
});
