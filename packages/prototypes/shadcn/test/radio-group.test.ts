import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import type * as BaseRadioGroup from '@proto.ui/prototypes-base/radio-group';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { styleContains } from '../../test-utils/style';
import * as ShadcnPackage from '../src';
import * as radioGroupFamily from '../src/radio-group';

const { ShadcnRadioGroupRoot, ShadcnRadioGroupItem, ShadcnRadioGroupIndicator } = radioGroupFamily;

const RadioGroupRootElement = AdaptToWebComponent(ShadcnRadioGroupRoot);
const RadioGroupItemElement = AdaptToWebComponent(ShadcnRadioGroupItem);
const RadioGroupIndicatorElement = AdaptToWebComponent(ShadcnRadioGroupIndicator);

type RootElement = InstanceType<typeof RadioGroupRootElement>;
type ItemElement = InstanceType<typeof RadioGroupItemElement>;

function itemElement(value: string, disabled = false): ItemElement {
  const item = new RadioGroupItemElement();
  setElementProps(item, { value, disabled });
  item.append(document.createTextNode(value));
  return item;
}

function group(props: radioGroupFamily.ShadcnRadioGroupRootProps = {}) {
  const root = new RadioGroupRootElement();
  const first = itemElement('a');
  const second = itemElement('b');
  const disabled = itemElement('c', true);
  const firstIndicator = new RadioGroupIndicatorElement();
  const secondIndicator = new RadioGroupIndicatorElement();
  first.append(firstIndicator);
  second.append(secondIndicator);
  root.append(first, second, disabled);
  setElementProps(root, { a11yLabel: 'Delivery method', ...props });
  return { root, first, second, disabled, firstIndicator, secondIndicator };
}

async function flushReconciliation(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function dispatchKey(target: ItemElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  return event;
}

function dispatchPointer(target: ItemElement, type: string): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    })
  );
}

function recordChanges(root: RootElement): string[] {
  const changes: string[] = [];
  root.addEventListener('valueChange', (event) => {
    changes.push((event as CustomEvent<{ value: string }>).detail.value);
  });
  return changes;
}

afterEach(async () => {
  document.body.replaceChildren();
  await flushReconciliation();
});

describe('prototypes/shadcn: radio group', () => {
  it('exports exactly three parts and retains every Base public type', () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-PUBLIC-SURFACE
    const expected = {
      ShadcnRadioGroupRoot,
      ShadcnRadioGroupItem,
      ShadcnRadioGroupIndicator,
      shadcnRadioGroupRoot: ShadcnRadioGroupRoot,
      shadcnRadioGroupItem: ShadcnRadioGroupItem,
      shadcnRadioGroupIndicator: ShadcnRadioGroupIndicator,
    };
    expect(Object.fromEntries(Object.entries(radioGroupFamily))).toEqual(expected);
    expect(
      Object.fromEntries(
        Object.entries(ShadcnPackage).filter(([name]) => name.toLowerCase().includes('radiogroup'))
      )
    ).toEqual(expected);
    expect([
      ShadcnRadioGroupRoot.name,
      ShadcnRadioGroupItem.name,
      ShadcnRadioGroupIndicator.name,
    ]).toEqual([
      'shadcn-radio-group-root',
      'shadcn-radio-group-item',
      'shadcn-radio-group-indicator',
    ]);
    expectTypeOf<
      [
        radioGroupFamily.ShadcnRadioGroupRootProps,
        radioGroupFamily.ShadcnRadioGroupRootExposes,
        radioGroupFamily.ShadcnRadioGroupRootStateHandles,
        radioGroupFamily.ShadcnRadioGroupRootAsHookContract,
        radioGroupFamily.ShadcnRadioGroupItemProps,
        radioGroupFamily.ShadcnRadioGroupItemExposes,
        radioGroupFamily.ShadcnRadioGroupItemStateHandles,
        radioGroupFamily.ShadcnRadioGroupItemAsHookContract,
        radioGroupFamily.ShadcnRadioGroupIndicatorProps,
        radioGroupFamily.ShadcnRadioGroupIndicatorExposes,
        radioGroupFamily.ShadcnRadioGroupIndicatorStateHandles,
        radioGroupFamily.ShadcnRadioGroupIndicatorAsHookContract,
      ]
    >().toEqualTypeOf<
      [
        BaseRadioGroup.RadioGroupRootProps,
        BaseRadioGroup.RadioGroupRootExposes,
        BaseRadioGroup.RadioGroupRootStateHandles,
        BaseRadioGroup.RadioGroupRootAsHookContract,
        BaseRadioGroup.RadioGroupItemProps,
        BaseRadioGroup.RadioGroupItemExposes,
        BaseRadioGroup.RadioGroupItemStateHandles,
        BaseRadioGroup.RadioGroupItemAsHookContract,
        BaseRadioGroup.RadioGroupIndicatorProps,
        BaseRadioGroup.RadioGroupIndicatorExposes,
        BaseRadioGroup.RadioGroupIndicatorStateHandles,
        BaseRadioGroup.RadioGroupIndicatorAsHookContract,
      ]
    >();
  });

  it('inherits each Base part once and publishes only its governed runtime surface', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-PUBLIC-SURFACE
    const { root, first, firstIndicator } = group();
    document.body.append(root);
    await flushReconciliation();

    const parts = [
      [ShadcnRadioGroupRoot, 'as-radio-group-root'],
      [ShadcnRadioGroupItem, 'as-radio-group-item'],
      [ShadcnRadioGroupIndicator, 'as-radio-group-indicator'],
    ] as const;
    const tokens = [new EventTarget(), new EventTarget(), new EventTarget()];
    const parents = new Map<unknown, unknown>([
      [tokens[1], tokens[0]],
      [tokens[2], tokens[1]],
    ]);
    const prototypes = new Map<unknown, unknown>(
      parts.map(([prototype], index) => [tokens[index], prototype])
    );
    const sessions: Array<{ dispose(): Promise<void> }> = [];
    try {
      for (const [index, [prototype, hookName]] of parts.entries()) {
        // The WC Adapter executes a cloned Prototype. Direct Runtime setup
        // records inheritance on these exact public parts in one logical tree.
        sessions.push(
          createRuntimeSession(prototype as any, {
            prototypeName: `${prototype.name}-hook-trace`,
            getRawProps: () => ({ value: 'a' }),
            commit(_children, signal) {
              signal?.done();
            },
            schedule(task) {
              task();
            },
            onRuntimeReady(wiring) {
              wiring.attach('anatomy', [
                [ANATOMY_INSTANCE_TOKEN_CAP, tokens[index]],
                [ANATOMY_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
                [ANATOMY_GET_PROTO_CAP, (token: object) => prototypes.get(token) ?? null],
                [ANATOMY_ROOT_TARGET_CAP, (token: unknown) => token],
              ]);
              wiring.attach('context', [
                [CONTEXT_INSTANCE_TOKEN_CAP, tokens[index]],
                [CONTEXT_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
              ]);
              wiring.attach('as-trigger', [
                [AS_TRIGGER_INSTANCE_CAP, tokens[index]],
                [AS_TRIGGER_PARENT_CAP, (token: unknown) => parents.get(token) ?? null],
                [AS_TRIGGER_GET_PROTO_CAP, (token: object) => prototypes.get(token) ?? null],
              ]);
            },
          })
        );
        const hooks = (prototype as { __asHooks?: Array<{ name: string; mode: string }> })
          .__asHooks;
        expect(hooks?.filter((hook) => hook.name.startsWith('as-radio-group'))).toEqual([
          expect.objectContaining({ name: hookName, mode: 'once' }),
        ]);
      }
    } finally {
      for (const session of sessions.reverse()) await session.dispose();
    }
    expect(Object.keys(root.getExposes()).sort()).toEqual([
      'count',
      'disabled',
      'focusFirst',
      'focusLast',
      'focusNext',
      'focusPrev',
      'focusSelected',
      'getCollectionCount',
      'getCollectionItems',
      'requestValue',
      'value',
    ]);
    expect(Object.keys(first.getExposes()).sort()).toEqual([
      'checked',
      'collectionFirst',
      'collectionIndex',
      'collectionLast',
      'collectionTotal',
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'hovered',
      'pressed',
    ]);
    expect(Object.keys(firstIndicator.getExposes()).sort()).toEqual([
      'checked',
      'disabled',
      'isChecked',
    ]);

    setElementProps(root, {
      orientation: 'horizontal',
      loop: false,
      required: true,
      invalid: true,
      name: 'delivery',
    } as any);
    setElementProps(first, {
      asChild: true,
      checked: true,
      defaultChecked: true,
      variant: 'destructive',
      size: 'lg',
    } as any);
    setElementProps(firstIndicator, { checked: true, disabled: true, forceMount: true } as any);
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('');
    expect(first.getExposes().checked.get()).toBe(false);
    expect(firstIndicator.getExposes().checked.get()).toBe(false);
    expect(firstIndicator.getExposes().disabled.get()).toBe(false);
    expect(root.querySelector('input, button, [role="button"]')).toBeNull();
    expect(root.querySelector('[aria-required], [aria-invalid], [aria-orientation]')).toBeNull();
    expect(root.getAttribute('aria-required')).toBeNull();
    expect(root.getAttribute('aria-invalid')).toBeNull();
    expect(root.getAttribute('aria-orientation')).toBeNull();
    expect(root.getAttribute('role')).toBe('radiogroup');
    expect(first.getAttribute('role')).toBe('radio');
  });

  it('projects default surfaces and conditional rules without claiming computed paint', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-SURFACES
    const { root, first, second, disabled, firstIndicator } = group();
    document.body.append(root);
    await flushReconciliation();

    for (const token of ['grid', 'gap-3']) expect(styleContains(root, token), token).toBe(true);
    for (const token of [
      'inline-flex',
      'items-center',
      'justify-center',
      'aspect-square',
      'size-4',
      'shrink-0',
      'rounded-full',
      'border',
      'border-input',
      'bg-transparent',
      'text-primary',
      'shadow-xs',
      'transition-[color,box-shadow]',
      'outline-none',
      'dark:bg-input/30',
      'data-[focus-visible]:border-ring',
      'data-[focus-visible]:ring-3',
      'data-[focus-visible]:ring-ring/50',
      'data-[disabled]:cursor-not-allowed',
      'data-[disabled]:opacity-50',
    ])
      expect(styleContains(first, token), token).toBe(true);
    for (const token of [
      'border-ring',
      'ring-3',
      'ring-ring/50',
      'cursor-not-allowed',
      'opacity-50',
    ]) {
      expect(styleContains(first, token), `unscoped ${token}`).toBe(false);
    }
    for (const token of [
      'flex',
      'size-2',
      'items-center',
      'justify-center',
      'opacity-0',
      'data-[checked]:opacity-100',
    ]) {
      expect(styleContains(firstIndicator, token), token).toBe(true);
    }
    expect(firstIndicator.querySelectorAll('svg')).toHaveLength(1);
    expect(firstIndicator.querySelectorAll('svg circle')).toHaveLength(1);
    expect(firstIndicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(firstIndicator.hasAttribute('data-checked')).toBe(false);
    expect(root.getAttribute('aria-label')).toBe('Delivery method');
    expect(first.getAttribute('aria-checked')).toBe('false');
    expect([first.tabIndex, second.tabIndex, disabled.tabIndex]).toEqual([0, -1, -1]);
    expect(disabled.querySelector('svg')).toBeNull();
  });

  it('commits uncontrolled selection once and preserves checked across disabled transitions', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-SELECTION
    const { root, first, second, disabled, firstIndicator, secondIndicator } = group({
      defaultValue: 'a',
    });
    const changes = recordChanges(root);
    const selections: string[] = [];
    second.addEventListener('select', (event) =>
      selections.push((event as CustomEvent<{ value: string }>).detail.value)
    );
    document.body.append(root);
    await flushReconciliation();

    dispatchPointer(second, 'pointerdown');
    expect(root.getExposes().value.get()).toBe('a');
    dispatchPointer(second, 'pointerup');
    second.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(changes).toEqual(['b']);
    expect(selections).toEqual(['b']);
    expect(firstIndicator.hasAttribute('data-checked')).toBe(false);
    expect(secondIndicator.hasAttribute('data-checked')).toBe(true);
    for (const value of ['b', '', 'missing', 'c'])
      expect(root.getExposes().requestValue(value)).toBe(false);
    expect(changes).toEqual(['b']);

    setElementProps(second, { value: 'b', disabled: true });
    await flushReconciliation();
    expect(second.getExposes().checked.get()).toBe(true);
    expect(second.getExposes().disabled.get()).toBe(true);
    expect(secondIndicator.getExposes().disabled.get()).toBe(true);
    expect(second.hasAttribute('data-disabled')).toBe(true);
    expect(second.getAttribute('aria-disabled')).toBe('true');
    expect([first.tabIndex, second.tabIndex, disabled.tabIndex]).toEqual([0, -1, -1]);

    setElementProps(root, { disabled: true });
    await flushReconciliation();
    for (const item of [first, second, disabled]) {
      expect(item.getExposes().disabled.get()).toBe(true);
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.tabIndex).toBe(-1);
    }
    dispatchPointer(first, 'pointerdown');
    dispatchPointer(first, 'pointerup');
    first.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    first.getExposes().focusSelf();
    await flushReconciliation();
    expect(document.activeElement).not.toBe(first);
    expect(root.getExposes().value.get()).toBe('b');
    expect(changes).toEqual(['b']);

    setElementProps(root, { disabled: false });
    await flushReconciliation();
    expect(first.getExposes().disabled.get()).toBe(false);
    expect(second.getExposes().disabled.get()).toBe(true);
    expect(disabled.getExposes().disabled.get()).toBe(true);
    expect(firstIndicator.getExposes().disabled.get()).toBe(false);
    expect(secondIndicator.getExposes().disabled.get()).toBe(true);
    expect(root.getExposes().value.get()).toBe('b');
  });

  it('keeps controlled requests separate from accepted owner values and reuses the glyph', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-SELECTION
    const { root, first, second, firstIndicator, secondIndicator } = group({ value: 'a' });
    const changes = recordChanges(root);
    document.body.append(root);
    await flushReconciliation();
    const glyph = secondIndicator.querySelector('svg');

    dispatchPointer(second, 'pointerdown');
    dispatchPointer(second, 'pointerup');
    second.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await flushReconciliation();
    expect(changes).toEqual(['b']);
    expect(root.getExposes().value.get()).toBe('a');
    expect(first.getAttribute('aria-checked')).toBe('true');
    expect(second.getAttribute('aria-checked')).toBe('false');
    expect(firstIndicator.hasAttribute('data-checked')).toBe(true);
    expect(secondIndicator.hasAttribute('data-checked')).toBe(false);

    for (const value of ['b', 'missing', 'a', 'b']) {
      setElementProps(root, { value });
      await flushReconciliation();
      expect(root.getExposes().value.get()).toBe(value);
      expect(first.getExposes().checked.get()).toBe(value === 'a');
      expect(second.getExposes().checked.get()).toBe(value === 'b');
      expect(firstIndicator.getExposes().isChecked()).toBe(value === 'a');
      expect(secondIndicator.hasAttribute('data-checked')).toBe(value === 'b');
      expect(secondIndicator.querySelectorAll('svg')).toHaveLength(1);
      expect(secondIndicator.querySelector('svg')).toBe(glyph);
    }
    expect(changes).toEqual(['b']);
  });

  it('isolates nested Roots and derives optional repeated Indicators from their nearest Item', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-DOMAINS
    const outer = group({ defaultValue: 'a' });
    const inner = group({ defaultValue: 'b' });
    const repeated = new RadioGroupIndicatorElement();
    inner.second.append(repeated);
    const wrapper = document.createElement('div');
    wrapper.append(inner.root);
    outer.root.append(wrapper);
    document.body.append(outer.root);
    await flushReconciliation();

    expect(outer.root.getExposes().getCollectionCount()).toBe(3);
    expect(inner.root.getExposes().getCollectionCount()).toBe(3);
    expect(outer.first.getExposes().checked.get()).toBe(true);
    expect(inner.first.getExposes().checked.get()).toBe(false);
    expect(inner.second.getExposes().checked.get()).toBe(true);
    for (const indicator of [inner.firstIndicator, inner.secondIndicator, repeated]) {
      expect(Object.keys(indicator.getExposes()).sort()).toEqual([
        'checked',
        'disabled',
        'isChecked',
      ]);
      for (const attribute of [
        'role',
        'tabindex',
        'aria-checked',
        'aria-disabled',
        'aria-live',
        'data-pui-a11y-actions',
      ]) {
        expect(indicator.getAttribute(attribute), attribute).toBeNull();
      }
      expect(indicator.querySelector('input, [role="radio"]')).toBeNull();
      expect(indicator.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(inner.secondIndicator.getExposes().isChecked()).toBe(true);
    expect(repeated.getExposes().isChecked()).toBe(true);
    expect(inner.disabled.querySelector('svg')).toBeNull();

    inner.root.getExposes().requestValue('a');
    await flushReconciliation();
    expect(inner.secondIndicator.getExposes().isChecked()).toBe(false);
    expect(repeated.getExposes().isChecked()).toBe(false);
    expect(inner.firstIndicator.getExposes().isChecked()).toBe(true);
    expect(outer.root.getExposes().value.get()).toBe('a');

    outer.root.getExposes().requestValue('b');
    await flushReconciliation();
    expect(inner.root.getExposes().value.get()).toBe('a');
    expect(outer.firstIndicator.getExposes().isChecked()).toBe(false);
    expect(outer.secondIndicator.getExposes().isChecked()).toBe(true);
  });

  it('keeps collection order and selection while authored Items are reordered or removed', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-DOMAINS
    const { root, first, second, disabled, secondIndicator } = group({ defaultValue: 'b' });
    const changes = recordChanges(root);
    document.body.append(root);
    await flushReconciliation();
    root.prepend(disabled);
    await flushReconciliation();
    expect(
      root
        .getExposes()
        .getCollectionItems()
        .map((item) => item.value)
    ).toEqual(['c', 'a', 'b']);
    second.remove();
    await flushReconciliation();
    expect(root.getExposes().getCollectionCount()).toBe(2);
    expect(root.getExposes().value.get()).toBe('b');
    expect(first.getExposes().checked.get()).toBe(false);
    root.append(second);
    await flushReconciliation();
    expect(second.getExposes().checked.get()).toBe(true);
    expect(secondIndicator.getExposes().isChecked()).toBe(true);
    expect(changes).toEqual([]);
  });

  it('retains roving navigation and guarded input with focus feedback on the Item alone', async () => {
    // T-SHADCN-RADIO-GROUP-0001-CASE-ROVING
    const { root, first, second, disabled, firstIndicator, secondIndicator } = group({
      defaultValue: 'a',
    });
    document.body.append(root);
    await flushReconciliation();

    second.getExposes().focusSelf({ reason: 'keyboard' });
    await flushReconciliation();
    expect(document.activeElement).toBe(second);
    expect(root.getExposes().value.get()).toBe('a');
    expect([first.tabIndex, second.tabIndex, disabled.tabIndex]).toEqual([-1, 0, -1]);
    expect(second.getExposes().focusVisible.get()).toBe(true);
    expect(second.hasAttribute('data-focus-visible')).toBe(true);
    expect(secondIndicator.hasAttribute('data-focus-visible')).toBe(false);
    expect(dispatchKey(second, 'Enter').defaultPrevented).toBe(false);
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('a');
    expect(dispatchKey(second, ' ').defaultPrevented).toBe(true);
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');

    for (const [key, target, value] of [
      ['ArrowRight', first, 'a'],
      ['ArrowDown', second, 'b'],
      ['ArrowLeft', first, 'a'],
      ['ArrowUp', second, 'b'],
      ['Home', first, 'a'],
      ['End', second, 'b'],
    ] as const) {
      expect(dispatchKey(document.activeElement as ItemElement, key).defaultPrevented).toBe(true);
      await flushReconciliation();
      expect(document.activeElement).toBe(target);
      expect(root.getExposes().value.get()).toBe(value);
      expect(disabled.tabIndex).toBe(-1);
    }
    dispatchPointer(first, 'pointerdown');
    dispatchPointer(first, 'pointercancel');
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(first.getExposes().pressed.get()).toBe(false);
    expect(firstIndicator.hasAttribute('data-focus-visible')).toBe(false);
  });
});
