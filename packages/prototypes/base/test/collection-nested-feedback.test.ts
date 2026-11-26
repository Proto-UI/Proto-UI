import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn0 from '../../shadcn/src/carousel';
import * as shadcn1 from '../../shadcn/src/tree';
import * as shadcn2 from '../../shadcn/src/message-scroller';
import * as shadcn3 from '../../shadcn/src/data-table';
import * as shadcn4 from '../../shadcn/src/date-picker';
import * as brutalist0 from '../../brutalist/src/carousel';
import * as brutalist1 from '../../brutalist/src/tree';
import * as brutalist2 from '../../brutalist/src/message-scroller';
import * as brutalist3 from '../../brutalist/src/data-table';
import * as brutalist4 from '../../brutalist/src/date-picker';
import * as bootstrap0 from '../../bootstrap-2-3-2/src/carousel';
import * as bootstrap1 from '../../bootstrap-2-3-2/src/tree';
import * as bootstrap2 from '../../bootstrap-2-3-2/src/message-scroller';
import * as bootstrap3 from '../../bootstrap-2-3-2/src/data-table';
import * as bootstrap4 from '../../bootstrap-2-3-2/src/date-picker';
import * as liquid0 from '../../liquid-glass/src/carousel';
import * as liquid1 from '../../liquid-glass/src/tree';
import * as liquid2 from '../../liquid-glass/src/message-scroller';
import * as liquid3 from '../../liquid-glass/src/data-table';
import * as liquid4 from '../../liquid-glass/src/date-picker';
const families = {
  'shadcn': [shadcn0, shadcn1, shadcn2, shadcn3, shadcn4],
  'brutalist': [brutalist0, brutalist1, brutalist2, brutalist3, brutalist4],
  'bootstrap-2-3-2': [bootstrap0, bootstrap1, bootstrap2, bootstrap3, bootstrap4],
  'liquid-glass': [liquid0, liquid1, liquid2, liquid3, liquid4],
};
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const node = (family: string, name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement(`nested-${family}-${name}`) as any;
  setElementProps(el, props);
  return el;
};
const controls = [
  ['carousel', 'previous'],
  ['carousel', 'next'],
  ['tree', 'toggle'],
  ['message-scroller', 'jump'],
  ['data-table', 'previous'],
  ['data-table', 'next'],
  ['date-picker', 'trigger'],
  ['date-picker', 'day'],
] as const;
const pressToken = {
  shadcn: 'translate-y-px',
  brutalist: 'translate-x-1',
  'bootstrap-2-3-2': 'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]',
  'liquid-glass': 'shadow-xs',
};
// Registered feedback vocabularies differ per family and consumer: web-exposed
// states project as data-[state] variants, while profile-gated paint is dynamic.
// Declaring material keeps all feedback Rules live for these nested controls.
const hasDynamicLiquidFeedback = (family: string, component: string, part: string) =>
  family === 'liquid-glass' &&
  (component === 'carousel' ||
    component === 'data-table' ||
    component === 'message-scroller' ||
    (component === 'date-picker' && part === 'trigger'));
const disabledTokens = (family: string, component: string, part: string): string[] => {
  if (hasDynamicLiquidFeedback(family, component, part))
    return component === 'carousel' || component === 'date-picker'
      ? [
          'pointer-events-none',
          'cursor-default',
          'shadow-none',
          'bg-muted',
          'text-muted-foreground',
        ]
      : ['pointer-events-none', 'cursor-default', 'shadow-none'];
  if (family === 'liquid-glass')
    // Liquid disabled commands withdraw optional material without whole-control
    // opacity (README: no opacity suppression for disabled commands).
    return ['data-[disabled]:cursor-default', 'data-[disabled]:shadow-none'];
  if (family === 'bootstrap-2-3-2')
    return component === 'carousel'
      ? ['data-[disabled]:cursor-default']
      : ['data-[disabled]:opacity-65'];
  if (family === 'shadcn') return ['data-[disabled]:opacity-50'];
  return ['data-[disabled]:opacity-50'];
};
const focusVisibleToken = (family: string, component: string, part: string): string | null => {
  if (hasDynamicLiquidFeedback(family, component, part)) return null;
  if (family !== 'shadcn') return 'data-[focus-visible]:ring-2';
  if (component === 'carousel' || component === 'message-scroller' || part === 'day')
    // Profile-gated ring paints dynamically; asserted in the focused phase.
    return null;
  return 'data-[focus-visible]:forced-colors-focus-outline';
};
const pressedTokens = (family: string, component: string, part: string): string[] => {
  if (hasDynamicLiquidFeedback(family, component, part)) return [];
  if (family === 'liquid-glass' && (component === 'tree' || part === 'day')) {
    const selector =
      part === 'day'
        ? 'data-[pressed]:not-[data-disabled]:not-[data-selected]:'
        : 'data-[pressed]:not-[data-disabled]:';
    return [`${selector}bg-muted`, `${selector}shadow-none`];
  }
  if (family === 'shadcn')
    // Multi-profile press paint is dynamic; asserted in the pressed phase.
    return [];
  if (family === 'brutalist' && part === 'day')
    // Flat grid day cell aligned with brutalist-calendar-day; no raised press translation.
    return [];
  const token = `data-[pressed]:not-[data-disabled]:${pressToken[family as keyof typeof pressToken]}`;
  if (family === 'bootstrap-2-3-2') {
    if (component === 'message-scroller')
      // Jump consumes the shared Button recipe whose press paint is unguarded.
      return [`data-[pressed]:${pressToken['bootstrap-2-3-2']}`];
    if (part === 'day')
      return [
        `data-[pressed]:not-[data-disabled]:not-[data-selected]:${pressToken['bootstrap-2-3-2']}`,
      ];
  }
  return [token];
};
// Profiles without a static press variant keep pressed feedback dynamic; the
// New York profile and popup triggers intentionally register none.
const dynamicPressed: Record<string, Record<string, string[]>> = {
  'liquid-glass': { carousel: ['shadow-xs'], 'data-table': ['shadow-xs'] },
  shadcn: {
    tree: ['translate-y-px'],
    'data-table': ['translate-y-px'],
    'date-picker': [],
    carousel: [],
    'message-scroller': [],
  },
};
const shadcnDayPressed = ['translate-y-px'];
const liquidFocusTokens = [
  'outline-none',
  'forced-colors-focus-outline',
  'ring-2',
  'ring-ring',
  'ring-offset-2',
  'ring-offset-background',
];
for (const [family, modules] of Object.entries(families)) {
  for (const module of modules)
    for (const proto of new Set(Object.values(module)))
      if (proto && typeof proto === 'object' && 'setup' in proto)
        AdaptToWebComponent(proto, { registerAs: `nested-${proto.name}` });
  for (const [component, part] of controls)
    it(`${family}/${component}-${part} consumes real disabled, focus and pressed state without flattening`, async () => {
      const root = node(
        family,
        `${component}-root`,
        component === 'carousel'
          ? { defaultIndex: 1, disabled: true }
          : component === 'date-picker'
            ? { defaultMonth: '2026-10', defaultValue: '2026-10-01' }
            : {}
      );
      if (component === 'carousel') {
        const viewport = node(family, 'carousel-viewport');
        for (let index = 0; index < 3; index++)
          viewport.append(node(family, 'carousel-slide', { index }));
        root.append(viewport);
      }
      const ownProps =
        part === 'day' ? { date: '2026-10-12' } : part === 'toggle' ? { nodeKey: 'a' } : {};
      const control = node(family, `${component}-${part}`, { ...ownProps, disabled: true });
      root.append(control);
      roots.push(root);
      document.body.append(root);
      await flush();
      const exposed = control.getExposes();
      expect(exposed.disabled.get()).toBe(true);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      const tokens = () => (control.getAttribute('data-pui-style') ?? '').split(/\s+/);
      const dynamicLiquid = hasDynamicLiquidFeedback(family, component, part);
      const expectLiquidDisabled = () => {
        for (const token of disabledTokens(family, component, part))
          expect(tokens()).toContain(token);
        // Carousel keeps its authored base cursor token; cursor utilities
        // occupy independent semantic groups. Pagination registers it only enabled.
        if (component === 'data-table') expect(tokens()).not.toContain('cursor-pointer');
        expect(tokens()).not.toContain('shadow-xs');
        expect(tokens()).not.toContain('opacity-50');
      };
      const expectLiquidRest = () => {
        expect(tokens()).toContain('cursor-pointer');
        expect(tokens()).toContain('shadow-sm');
        for (const token of ['pointer-events-none', 'cursor-default', 'shadow-none', 'shadow-xs'])
          expect(tokens()).not.toContain(token);
        if (component === 'carousel' || component === 'date-picker') {
          expect(tokens()).not.toContain('bg-muted');
          expect(tokens()).not.toContain('text-muted-foreground');
        }
      };
      if (dynamicLiquid) {
        expectLiquidDisabled();
        expect(exposed.pressed.get()).toBe(false);
        expect(exposed.focusVisible.get()).toBe(false);
        expect(control.hasAttribute('data-pressed')).toBe(false);
        expect(control.hasAttribute('data-focus-visible')).toBe(false);
        for (const token of liquidFocusTokens) expect(tokens()).not.toContain(token);
      }
      for (const token of disabledTokens(family, component, part))
        expect(tokens()).toContain(token);
      if (family === 'liquid-glass') expect(tokens()).not.toContain('data-[disabled]:opacity-50');
      const staticFocus = focusVisibleToken(family, component, part);
      if (staticFocus) expect(tokens()).toContain(staticFocus);
      for (const token of pressedTokens(family, component, part)) expect(tokens()).toContain(token);
      control.dispatchEvent(new Event('pointerdown'));
      await flush();
      expect(exposed.pressed.get()).toBe(false);
      if (dynamicLiquid) expectLiquidDisabled();
      setElementProps(control, { ...ownProps, disabled: false });
      if (component === 'carousel') setElementProps(root, { disabled: false });
      await flush();
      expect(exposed.disabled.get()).toBe(false);
      if (dynamicLiquid) expectLiquidRest();
      exposed.focusSelf({ reason: 'keyboard' });
      await flush();
      expect(exposed.focusVisible.get()).toBe(true);
      expect(control.hasAttribute('data-focus-visible')).toBe(true);
      if (dynamicLiquid) for (const token of liquidFocusTokens) expect(tokens()).toContain(token);
      if (family === 'shadcn') {
        // Profile-driven focus paint applies dynamically while focusVisible.
        expect(tokens()).toContain('ring-3');
        expect(tokens()).toContain('ring-ring/50');
        expect(tokens()).toContain('border-ring');
      }
      if (family === 'liquid-glass' && (component === 'carousel' || component === 'data-table')) {
        expect(tokens()).toEqual(
          expect.arrayContaining(['ring-2', 'ring-ring', 'forced-colors-focus-outline'])
        );
      }
      control.dispatchEvent(new Event('pointerdown'));
      await flush();
      expect(exposed.pressed.get()).toBe(true);
      expect(control.hasAttribute('data-pressed')).toBe(true);
      const gained =
        part === 'day' && family === 'shadcn'
          ? shadcnDayPressed
          : (dynamicPressed[family]?.[component] ?? null);
      if (gained) for (const token of gained) expect(tokens()).toContain(token);
      if (family === 'brutalist' && part === 'day') {
        // Flat calendar cells retain pressed semantics without raised-button translation.
        expect(tokens().some((token: string) => token.includes('translate-'))).toBe(false);
      }
      if (dynamicLiquid) {
        expect(exposed.disabled.get()).toBe(false);
        expect(tokens()).toContain('shadow-xs');
        for (const token of ['pointer-events-none', 'cursor-default', 'shadow-none'])
          expect(tokens()).not.toContain(token);
      }
      control.dispatchEvent(new Event('pointercancel'));
      await flush();
      expect(exposed.pressed.get()).toBe(false);
      expect(control.hasAttribute('data-pressed')).toBe(false);
      if (dynamicLiquid) expectLiquidRest();
      control.dispatchEvent(new Event('pointerdown'));
      await flush();
      if (dynamicLiquid) {
        expect(exposed.pressed.get()).toBe(true);
        expect(control.hasAttribute('data-pressed')).toBe(true);
        expect(tokens()).toContain('shadow-xs');
      }
      setElementProps(control, { ...ownProps, disabled: true });
      await flush();
      expect(exposed.disabled.get()).toBe(true);
      expect(exposed.pressed.get()).toBe(false);
      expect(control.tabIndex).toBe(-1);
      if (dynamicLiquid) {
        expect(control.hasAttribute('data-pressed')).toBe(false);
        expectLiquidDisabled();
        setElementProps(control, { ...ownProps, disabled: false });
        await flush();
        expect(control.getExposes().disabled).toBe(exposed.disabled);
        expect(control.getExposes().pressed).toBe(exposed.pressed);
        expect(control.getExposes().focusVisible).toBe(exposed.focusVisible);
        expect(exposed.disabled.get()).toBe(false);
        expect(exposed.pressed.get()).toBe(false);
        expect(control.getAttribute('aria-disabled')).not.toBe('true');
        expectLiquidRest();
        exposed.focusSelf({ reason: 'keyboard' });
        await flush();
        expect(exposed.focusVisible.get()).toBe(true);
        expect(control.hasAttribute('data-focus-visible')).toBe(true);
        for (const token of liquidFocusTokens) expect(tokens()).toContain(token);
        control.dispatchEvent(new Event('pointerdown'));
        await flush();
        expect(exposed.disabled.get()).toBe(false);
        expect(exposed.pressed.get()).toBe(true);
        expect(control.hasAttribute('data-pressed')).toBe(true);
        expect(tokens()).toContain('shadow-xs');
        expect(tokens()).not.toContain('shadow-none');
        control.dispatchEvent(new Event('pointercancel'));
        await flush();
        expect(exposed.pressed.get()).toBe(false);
        expect(control.hasAttribute('data-pressed')).toBe(false);
        expectLiquidRest();
      }
      if (component === 'date-picker' && part === 'day') {
        setElementProps(control, { ...ownProps, disabled: false });
        await flush();
        expect(exposed.selected.get()).toBe(false);
        expect(control.hasAttribute('data-selected')).toBe(false);
        root.getExposes().openPopover();
        await flush();
        control.click();
        await flush();
        expect(root.getExposes().value.get()).toBe('2026-10-12');
        expect(root.getExposes().open.get()).toBe(false);
        expect(exposed.selected.get()).toBe(true);
        if (family === 'bootstrap-2-3-2') {
          // Selected paint is interaction-resolved: the variant carries the
          // shared primary text/border recipe while the fill applies live.
          expect(tokens().some((token: string) => token.startsWith('data-[selected]:'))).toBe(true);
          expect(tokens().some((token: string) => token.startsWith('bg-[#006dcc_'))).toBe(true);
        } else {
          // C-CALENDAR-SELECTION-0001-DAYS distinguishes range middles from
          // selected endpoints. Both exposed conditions lower to one selector;
          // the same recipe must match only the currently selected endpoint.
          const selectedPrefix =
            family === 'shadcn'
              ? 'data-[selected]:not-[data-range-middle]:not-[data-range-pending]:'
              : 'data-[selected]:not-[data-range-middle]:';
          const selectedFill = family === 'brutalist' ? 'bg-main' : 'bg-primary';
          const selectedText =
            family === 'brutalist' ? 'text-main-foreground' : 'text-primary-foreground';
          expect(tokens()).toContain(`${selectedPrefix}${selectedFill}`);
          expect(tokens()).toContain(`${selectedPrefix}${selectedText}`);
          expect(control.hasAttribute('data-selected')).toBe(true);
          expect(exposed.rangeMiddle.get()).toBe(false);
          expect(control.hasAttribute('data-range-middle')).toBe(false);
          root.getExposes().requestValue('2026-10-01');
          await flush();
          expect(root.getExposes().value.get()).toBe('2026-10-01');
          expect(control.getExposes().selected).toBe(exposed.selected);
          expect(exposed.selected.get()).toBe(false);
          expect(control.hasAttribute('data-selected')).toBe(false);
          expect(tokens()).toContain(`${selectedPrefix}${selectedFill}`);
        }
      }
    });
}

for (const family of Object.keys(families))
  it(`${family}/message-scroller-viewport consumes its real nested ScrollArea focus`, async () => {
    const root = node(family, 'message-scroller-root');
    const viewport = node(family, 'message-scroller-viewport');
    root.append(viewport);
    roots.push(root);
    document.body.append(root);
    await flush();
    if (family === 'shadcn')
      expect((viewport.getAttribute('data-pui-style') ?? '').split(/\s+/)).not.toContain('ring-2');
    else expect(viewport.getAttribute('data-pui-style')).toContain('data-[focus-visible]:ring-2');
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    viewport.focus();
    await flush();
    expect(viewport.getExposes().focused.get()).toBe(true);
    expect(viewport.getExposes().focusVisible.get()).toBe(true);
    expect(viewport.hasAttribute('data-focus-visible')).toBe(true);
    if (family === 'shadcn') {
      expect((viewport.getAttribute('data-pui-style') ?? '').split(/\s+/)).toEqual(
        expect.arrayContaining(['ring-2', 'ring-ring', 'ring-inset', 'forced-colors-focus-outline'])
      );
    }
  });
