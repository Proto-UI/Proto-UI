import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
} from '@proto.ui/prototypes-base/field';
import type {
  SelectRootExposes,
  SelectTriggerExposes,
  SelectContentExposes,
  SelectItemExposes,
} from '@proto.ui/prototypes-base/select';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
  selectGroup,
  selectLabel,
  selectSeparator,
  type ShadcnSelectRootProps,
} from '../src/select';
import fieldSelectTrigger from '../src/field/select-trigger.proto';
import { styleScope, type ShadcnStyleId } from '../src/style-scope';

for (const prototype of [
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
  selectGroup,
  selectLabel,
  selectSeparator,
  fieldSelectTrigger,
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  styleScope,
])
  AdaptToWebComponent(prototype);

type ExposedElement<E> = HTMLElement & { getExposes(): E };
const tokens = (element: Element) => (element.getAttribute('data-pui-style') ?? '').split(/\s+/);
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
};

function fixture(rootProps: ShadcnSelectRootProps = { defaultValue: 'alpha' }, field = false) {
  const scope = document.createElement(styleScope.name);
  const root = document.createElement(selectRoot.name) as ExposedElement<SelectRootExposes>;
  const trigger = document.createElement(
    field ? fieldSelectTrigger.name : selectTrigger.name
  ) as ExposedElement<SelectTriggerExposes>;
  const value = document.createElement(selectValue.name);
  const content = document.createElement(
    selectContent.name
  ) as ExposedElement<SelectContentExposes>;
  const surface = document.createElement(selectSurface.name);
  const viewport = document.createElement(selectViewport.name);
  const group = document.createElement(selectGroup.name);
  const label = document.createElement(selectLabel.name);
  const separator = document.createElement(selectSeparator.name);
  label.textContent = 'Letters';
  const items = ['alpha', 'beta'].map((entry) => {
    const item = document.createElement(selectItem.name) as ExposedElement<SelectItemExposes>;
    const text = document.createElement(selectItemText.name);
    text.textContent = entry === 'alpha' ? 'Alpha' : 'Beta';
    setElementProps(item, { value: entry, textValue: text.textContent });
    item.append(text);
    return item;
  });
  setElementProps(root, rootProps);
  group.append(label, items[0]!, separator, items[1]!);
  viewport.append(group);
  surface.append(viewport);
  content.append(surface);
  trigger.append(value);
  root.append(trigger, content);
  scope.append(root);
  return {
    scope,
    root,
    trigger,
    value,
    content,
    surface,
    viewport,
    group,
    label,
    separator,
    items,
  };
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  vi.useRealTimers();
});

// Independent source-recipe expectations exercised on real Adapter instances,
// not a copy of an exported supported-profile list or a native paint claim.
const profileCases: readonly {
  profile: ShadcnStyleId;
  height: string;
  triggerRadius: string;
  surfaceRadius: string;
  itemRadius: string;
  labelPadding: string;
  groupPadding: string | null;
  iconPx: string;
}[] = [
  {
    profile: 'vega',
    height: 'h-9',
    triggerRadius: 'rounded-md',
    surfaceRadius: 'rounded-md',
    itemRadius: 'rounded-sm',
    labelPadding: 'py-1.5',
    groupPadding: 'p-1',
    iconPx: '16',
  },
  {
    profile: 'nova',
    height: 'h-8',
    triggerRadius: 'rounded-lg',
    surfaceRadius: 'rounded-lg',
    itemRadius: 'rounded-md',
    labelPadding: 'py-1',
    groupPadding: 'p-1',
    iconPx: '16',
  },
  {
    profile: 'maia',
    height: 'h-9',
    triggerRadius: 'rounded-[var(--pui-radius-4xl)]',
    surfaceRadius: 'rounded-[var(--pui-radius-2xl)]',
    itemRadius: 'rounded-xl',
    labelPadding: 'py-2.5',
    groupPadding: 'p-1',
    iconPx: '16',
  },
  {
    profile: 'lyra',
    height: 'h-8',
    triggerRadius: 'rounded-none',
    surfaceRadius: 'rounded-none',
    itemRadius: 'rounded-none',
    labelPadding: 'py-2',
    groupPadding: null,
    iconPx: '16',
  },
  {
    profile: 'mira',
    height: 'h-7',
    triggerRadius: 'rounded-md',
    surfaceRadius: 'rounded-lg',
    itemRadius: 'rounded-md',
    labelPadding: 'py-1.5',
    groupPadding: 'p-1',
    iconPx: '14',
  },
  {
    profile: 'luma',
    height: 'h-9',
    triggerRadius: 'rounded-[var(--pui-radius-3xl)]',
    surfaceRadius: 'rounded-[var(--pui-radius-3xl)]',
    itemRadius: 'rounded-[var(--pui-radius-2xl)]',
    labelPadding: 'py-2.5',
    groupPadding: 'p-1.5',
    iconPx: '16',
  },
  {
    profile: 'sera',
    height: 'h-10',
    triggerRadius: 'rounded-none',
    surfaceRadius: 'rounded-none',
    itemRadius: 'rounded-none',
    labelPadding: 'py-2',
    groupPadding: 'p-1.5',
    iconPx: '14',
  },
  {
    profile: 'rhea',
    height: 'h-8',
    triggerRadius: 'rounded-[var(--pui-radius-2xl)]',
    surfaceRadius: 'rounded-[var(--pui-radius-2xl)]',
    itemRadius: 'rounded-[var(--pui-radius-xl)]',
    labelPadding: 'py-1',
    groupPadding: 'p-1',
    iconPx: '16',
  },
  {
    profile: 'new-york-v4',
    height: 'h-9',
    triggerRadius: 'rounded-md',
    surfaceRadius: 'rounded-md',
    itemRadius: 'rounded-sm',
    labelPadding: 'py-1.5',
    groupPadding: null,
    iconPx: '16',
  },
];

it('replaces all nine recipes on the same open Select, portal, scrollport, caller parts and focused option', async () => {
  vi.useFakeTimers();
  const m = fixture();
  setElementProps(m.scope, { styleProfile: 'vega' });
  document.body.append(m.scope);
  await settle();
  m.trigger.click();
  await vi.advanceTimersByTimeAsync(200);
  await settle();
  m.items[0]!.getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  m.viewport.scrollTop = 37;
  const valueOwner = m.root.getExposes().value;
  const openOwner = m.root.getExposes().open;
  const portalParent = m.content.parentNode;
  const decoration = m.surface.querySelector('[data-pui-owned-decoration]')!;
  expect(decoration).not.toBeNull();
  expect(decoration.getAttribute('aria-hidden')).toBe('true');
  expect(decoration.childNodes).toHaveLength(0);
  let changes = 0;
  m.root.addEventListener('valueChange', () => changes++);
  m.root.addEventListener('openChange', () => changes++);

  for (const recipe of profileCases) {
    setElementProps(m.scope, { styleProfile: recipe.profile });
    await settle();
    expect(m.root.getExposes().value).toBe(valueOwner);
    expect(m.root.getExposes().open).toBe(openOwner);
    expect(valueOwner.get()).toBe('alpha');
    expect(openOwner.get()).toBe(true);
    expect(m.root.getExposes().textValue.get()).toBe('Alpha');
    expect(document.activeElement).toBe(m.items[0]);
    expect(m.content.parentNode).toBe(portalParent);
    expect(m.surface.querySelector('[data-pui-owned-decoration]')).toBe(decoration);
    expect(m.content.querySelector(selectViewport.name)).toBe(m.viewport);
    expect(m.viewport.querySelector(selectItem.name)).toBe(m.items[0]);
    expect(m.trigger.querySelector(selectValue.name)).toBe(m.value);
    expect(m.viewport.scrollTop).toBe(37);
    expect(m.items[0]!.getExposes().selected.get()).toBe(true);
    expect(m.items[1]!.getExposes().selected.get()).toBe(false);
    expect(tokens(m.trigger)).toContain(recipe.height);
    expect(tokens(m.trigger)).toContain(recipe.triggerRadius);
    expect(tokens(m.surface)).toContain(recipe.surfaceRadius);
    expect(tokens(m.items[0]!)).toContain(recipe.itemRadius);
    expect(tokens(m.label)).toContain(recipe.labelPadding);
    if (recipe.groupPadding) expect(tokens(m.group)).toContain(recipe.groupPadding);
    else expect(tokens(m.group).some((token) => token.startsWith('p-'))).toBe(false);
    expect(m.trigger.querySelector('svg')?.getAttribute('width')).toBe(recipe.iconPx);
    expect(m.group.getAttribute('role')).toBe('group');
    expect(m.group.getAttribute('aria-labelledby')).toBe(m.label.id);
    expect(m.separator.getAttribute('aria-hidden')).toBe('true');
    if (recipe.profile === 'new-york-v4') {
      expect(tokens(m.surface)).toContain('bg-popover');
      expect(tokens(m.surface)).not.toContain('bg-popover/70');
      expect(tokens(decoration).some((token) => token.startsWith('backdrop-filter-'))).toBe(false);
      expect(tokens(m.separator)).toContain('bg-border');
      expect(tokens(m.items[0]!)).not.toContain('bg-foreground/10');
    } else {
      expect(tokens(m.surface)).toContain('bg-popover/70');
      expect(tokens(m.surface)).toContain('animate-none');
      expect(tokens(decoration)).toContain('backdrop-filter-[blur(40px)_saturate(1.5)]');
      expect(tokens(m.separator)).toContain('bg-foreground/5');
      expect(tokens(m.items[0]!)).toContain('bg-foreground/10');
      expect(tokens(m.surface)).toContain(recipe.profile === 'mira' ? 'min-w-32' : 'min-w-36');
    }
  }
  expect(changes).toBe(0);
  m.items[1]!.click();
  await settle();
  expect(valueOwner.get()).toBe('beta');
  expect(openOwner.get()).toBe(false);
  expect(changes).toBe(2);
});

it('withdraws root and leaf overrides on prop removal without replacing the fixed leaf or focus owner', async () => {
  vi.useFakeTimers();
  const m = fixture({ defaultValue: 'alpha', styleProfile: 'nova' });
  setElementProps(m.scope, { styleProfile: 'vega' });
  document.body.append(m.scope);
  await settle();
  m.trigger.click();
  await vi.advanceTimersByTimeAsync(200);
  m.trigger.getExposes().focusSelf();
  const decoration = m.surface.querySelector('[data-pui-owned-decoration]');
  const valueOwner = m.root.getExposes().value;
  setElementProps(m.scope, { styleProfile: 'luma' });
  await settle();
  expect(tokens(m.trigger)).toContain('rounded-lg');
  setElementProps(m.root, { defaultValue: 'alpha' });
  await settle();
  expect(tokens(m.trigger)).toContain('rounded-[var(--pui-radius-3xl)]');
  setElementProps(m.trigger, { styleProfile: 'mira', size: 'sm' });
  setElementProps(m.surface, { styleProfile: 'new-york' });
  await settle();
  expect(tokens(m.trigger)).toContain('h-6');
  expect(m.trigger.querySelector('svg')?.getAttribute('width')).toBe('14');
  expect(tokens(m.surface)).toContain('bg-popover');
  expect(tokens(m.surface)).not.toContain('bg-popover/70');
  setElementProps(m.trigger, { size: 'sm' });
  setElementProps(m.surface, {});
  await settle();
  expect(tokens(m.trigger)).toContain('h-8');
  expect(tokens(m.trigger)).not.toContain('h-6');
  expect(m.trigger.querySelector('svg')?.getAttribute('width')).toBe('16');
  expect(tokens(m.surface)).toContain('bg-popover/70');
  expect(m.surface.querySelector('[data-pui-owned-decoration]')).toBe(decoration);
  setElementProps(m.trigger, {});
  await settle();
  expect(tokens(m.trigger)).toContain('h-9');
  setElementProps(m.scope, {});
  await settle();
  expect(tokens(m.trigger)).toContain('gap-2');
  expect(tokens(m.trigger)).not.toContain('gap-1.5');
  expect(tokens(m.viewport)).toContain('p-1');
  expect(tokens(m.viewport)).not.toContain('p-0');
  expect(tokens(m.surface)).toContain('bg-popover');
  expect(m.surface.querySelector('[data-pui-owned-decoration]')).toBe(decoration);
  expect(m.root.getExposes().value).toBe(valueOwner);
  expect(valueOwner.get()).toBe('alpha');
  expect(m.root.getExposes().open.get()).toBe(true);
  expect(document.activeElement).toBe(m.trigger);
});

it('maps Nova small radius and Sera invalid/focus borders without retaining another profile ring', async () => {
  vi.useFakeTimers();
  const m = fixture({ value: 'alpha' }, true);
  const field = document.createElement(fieldRoot.name);
  const label = document.createElement(fieldLabel.name);
  const description = document.createElement(fieldDescription.name);
  const error = document.createElement(fieldError.name);
  label.textContent = 'Choice';
  description.textContent = 'Choose one';
  field.append(label, description, m.scope, error);
  document.body.append(field);
  await settle();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  m.trigger.getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  const valueOwner = m.root.getExposes().value;
  const ringWidths: Record<ShadcnStyleId, string | null> = {
    vega: 'ring-3',
    nova: 'ring-3',
    maia: 'ring-3',
    lyra: 'ring-1',
    mira: 'ring-2',
    luma: 'ring-3',
    sera: null,
    rhea: 'ring-3',
    'new-york-v4': 'ring-3',
  };
  for (const { profile } of profileCases) {
    setElementProps(m.scope, { styleProfile: profile });
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      setElementProps(field, { invalid: true, errors: ['Invalid choice'] });
      await settle();
      expect(m.trigger.getAttribute('aria-invalid')).toBe('true');
      expect(m.trigger.getAttribute('aria-labelledby')).toBe(label.id);
      expect(m.trigger.getAttribute('aria-describedby')).toBe(description.id);
      expect(m.trigger.getAttribute('aria-errormessage')).toBe(error.id);
      expect(m.trigger.getExposes().focusVisible.get()).toBe(true);
      expect(tokens(m.trigger)).not.toContain('ring-ring/30');
      expect(tokens(m.trigger)).not.toContain('ring-ring/50');
      if (profile === 'sera') {
        expect(tokens(m.trigger)).toContain(
          theme === 'dark' ? 'border-b-destructive/50' : 'border-b-destructive'
        );
        expect(tokens(m.trigger)).not.toContain('border-b-ring');
        for (const ring of ['ring-1', 'ring-2', 'ring-3'])
          expect(tokens(m.trigger)).not.toContain(ring);
      } else {
        expect(tokens(m.trigger)).toContain(
          theme === 'dark' ? 'ring-destructive/40' : 'ring-destructive/20'
        );
        expect(tokens(m.trigger)).toContain(ringWidths[profile]);
      }
      setElementProps(field, { invalid: false });
      await settle();
      expect(m.trigger.getAttribute('aria-invalid')).toBe('false');
      expect(m.trigger.hasAttribute('aria-errormessage')).toBe(false);
      expect(tokens(m.trigger)).not.toContain('ring-destructive/20');
      expect(tokens(m.trigger)).not.toContain('ring-destructive/40');
      if (profile === 'sera') expect(tokens(m.trigger)).toContain('border-b-ring');
      else
        expect(tokens(m.trigger)).toContain(
          ['mira', 'luma', 'rhea'].includes(profile) ? 'ring-ring/30' : 'ring-ring/50'
        );
      expect(document.activeElement).toBe(m.trigger);
      expect(m.root.getExposes().value).toBe(valueOwner);
      expect(valueOwner.get()).toBe('alpha');
    }
  }
  setElementProps(m.trigger, { styleProfile: 'nova', size: 'sm' });
  await settle();
  expect(tokens(m.trigger)).toContain('rounded-[min(var(--pui-radius-md),10px)]');
  expect(tokens(m.trigger)).not.toContain('rounded-lg');
  setElementProps(m.trigger, { styleProfile: 'nova' });
  await settle();
  expect(tokens(m.trigger)).toContain('rounded-lg');
  expect(tokens(m.trigger)).not.toContain('rounded-[min(var(--pui-radius-md),10px)]');

  setElementProps(m.trigger, { styleProfile: 'mira', readOnly: true });
  await settle();
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(false);
  setElementProps(m.scope, { styleProfile: 'sera' });
  setElementProps(m.trigger, { readOnly: true });
  await settle();
  expect(m.trigger.getAttribute('aria-readonly')).toBe('true');
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(false);
  setElementProps(m.trigger, {});
  setElementProps(field, { disabled: true });
  await settle();
  expect(m.trigger.getAttribute('aria-disabled')).toBe('true');
  expect(tokens(m.trigger)).toContain('opacity-50');
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(false);
  setElementProps(field, {});
  await settle();
  let requests = 0;
  m.root.addEventListener('valueChange', () => requests++);
  expect(
    m.root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
  ).toBe(true);
  expect(requests).toBe(1);
  expect(valueOwner.get()).toBe('alpha');
});

it('keeps a plain Trigger outside optional Field binding through style changes', async () => {
  vi.useFakeTimers();
  const m = fixture();
  const field = document.createElement(fieldRoot.name);
  setElementProps(field, { invalid: true });
  field.append(m.scope);
  document.body.append(field);
  await settle();
  for (const profile of ['maia', 'sera', 'new-york-v4'] as const) {
    setElementProps(m.scope, { styleProfile: profile });
    await settle();
    expect(m.trigger.hasAttribute('aria-invalid')).toBe(false);
    expect(m.trigger.hasAttribute('aria-labelledby')).toBe(false);
    expect(m.root.getExposes().value.get()).toBe('alpha');
  }
});

it.each(['vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera'] as const)(
  'rejects incomplete translucent %s composition rather than painting it as Rhea or New York',
  async (styleProfile) => {
    vi.useFakeTimers();
    const root = document.createElement(selectRoot.name) as ExposedElement<SelectRootExposes>;
    const trigger = document.createElement(selectTrigger.name);
    const content = document.createElement(selectContent.name);
    const item = document.createElement(selectItem.name);
    setElementProps(item, { value: 'alpha', textValue: 'Alpha' });
    content.append(item);
    root.append(trigger, content);
    document.body.append(root);
    await settle();
    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(() => setElementProps(root, { styleProfile })).toThrow(/requires the complete Select/);
  }
);
