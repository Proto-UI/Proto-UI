import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import button from '../src/button';
import toggle, { type ShadcnToggleProps } from '../src/toggle';
import surface, { shadcnActionAppearance } from '../src/surface';
import text from '../src/text';
import { styleScope } from '../src/style-scope';

if (!customElements.get(button.name)) AdaptToWebComponent(button);
if (!customElements.get(toggle.name)) AdaptToWebComponent(toggle);
if (!customElements.get(surface.name)) AdaptToWebComponent(surface);
if (!customElements.get(text.name)) AdaptToWebComponent(text);
if (!customElements.get(styleScope.name)) AdaptToWebComponent(styleScope);
const owned: HTMLElement[] = [];
let originalClass = '';
beforeEach(() => {
  originalClass = document.documentElement.className;
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('light');
});
const flush = async () => {
  for (let index = 0; index < 25; index++) await Promise.resolve();
};
const tokens = (element: HTMLElement) =>
  (element.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
const element = <P extends PropsBaseType, E>(
  prototype: Prototype<P, E>,
  props: Partial<P> = {}
) => {
  // Each constructor above is registered from this exact Prototype.
  const node = document.createElement(prototype.name) as WebComponentAdapterElement<
    Prototype<P, E>
  >;
  setElementProps(node, props);
  return node;
};
const mount = (node: HTMLElement) => {
  owned.push(node);
  document.body.append(node);
};
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  document.documentElement.className = originalClass;
  await flush();
});

// Independent consumer oracle from retained 3d98900 style-*.css Button size,
// radius and typography rules; legacy remains the independently adopted
// 02cad611 recipe. This is behavioral paint/state coverage, not native pixels.
const profiles = [
  {
    id: 'vega',
    heights: [9, 8, 10, 9],
    padding: [2.5, 2.5, 2.5],
    radius: 'rounded-md',
    text: 'text-sm',
  },
  {
    id: 'nova',
    heights: [8, 7, 9, 8],
    padding: [2.5, 2.5, 2.5],
    radius: 'rounded-lg',
    text: 'text-sm',
  },
  {
    id: 'maia',
    heights: [9, 8, 10, 9],
    padding: [3, 3, 4],
    radius: 'rounded-[var(--pui-radius-4xl)]',
    text: 'text-sm',
  },
  {
    id: 'lyra',
    heights: [8, 7, 9, 8],
    padding: [2.5, 2.5, 2.5],
    radius: 'rounded-none',
    text: 'text-xs',
  },
  {
    id: 'mira',
    heights: [7, 6, 8, 7],
    padding: [2, 2, 2.5],
    radius: 'rounded-md',
    text: 'text-xs',
  },
  {
    id: 'luma',
    heights: [9, 8, 10, 9],
    padding: [3, 3, 4],
    radius: 'rounded-[var(--pui-radius-4xl)]',
    text: 'text-sm',
  },
  {
    id: 'sera',
    heights: [10, 9, 11, 10],
    padding: [6, 4, 8],
    radius: 'rounded-none',
    text: 'text-xs',
  },
  {
    id: 'rhea',
    heights: [8, 7, 9, 8],
    padding: [3, 3, 4],
    radius: 'rounded-[var(--pui-radius-2xl)]',
    text: 'text-sm',
  },
  {
    id: 'new-york-v4',
    heights: [9, 8, 10, 9],
    padding: [4, 3, 6],
    radius: 'rounded-md',
    text: 'text-sm',
  },
] as const;

describe('source-bound command profile transitions', () => {
  it('changes all nine inherited Button recipes without replacing handles, focus or content nodes', async () => {
    const scope = element(styleScope, { styleProfile: 'nova' });
    const command = element(button);
    const label = document.createElement('span');
    label.textContent = 'Keep this command';
    command.append(label);
    scope.append(command);
    mount(scope);
    await flush();
    const before = command.getExposes();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    command.focus();
    await flush();
    let focusChanges = 0;
    const off = before.focused.subscribe(() => {
      focusChanges++;
    });
    try {
      for (const profile of profiles) {
        setElementProps(scope, { styleProfile: profile.id });
        await flush();
        const actual = tokens(command);
        expect(actual.filter((value) => /^h-/.test(value))).toEqual([`h-${profile.heights[0]}`]);
        expect(actual.filter((value) => /^px-/.test(value))).toEqual([`px-${profile.padding[0]}`]);
        expect(actual.filter((value) => value.startsWith('rounded'))).toEqual([profile.radius]);
        expect(actual).toContain(profile.text);
        expect(actual.includes('uppercase')).toBe(profile.id === 'sera');
        expect(actual.includes('font-semibold')).toBe(profile.id === 'sera');
        expect(actual.includes('bg-clip-padding')).toBe(profile.id !== 'new-york-v4');
        for (const key of ['disabled', 'hovered', 'focused', 'focusVisible', 'pressed'] as const) {
          expect(command.getExposes()[key]).toBe(before[key]);
        }
        expect(command.getExposes().focused.get()).toBe(true);
        expect(document.activeElement).toBe(command);
        expect(command.firstChild).toBe(label);
        expect(command.getAttribute('role')).toBe('button');
      }
      expect(focusChanges).toBe(0);
      command.dispatchEvent(new PointerEvent('pointerdown'));
      await flush();
      expect(before.pressed.get()).toBe(true);
      setElementProps(scope, { styleProfile: 'new-york-v4' });
      await flush();
      expect(before.pressed.get()).toBe(true);
      expect(tokens(command)).not.toContain('translate-y-px');
      setElementProps(scope, { styleProfile: 'rhea' });
      await flush();
      expect(before.pressed.get()).toBe(true);
      expect(tokens(command)).toContain('translate-y-px');
      command.dispatchEvent(new PointerEvent('pointerup'));
      await flush();
      expect(before.pressed.get()).toBe(false);
    } finally {
      before.focused.unsubscribe(off);
    }
  });

  it('keeps the actual focused Toggle, active handle and label through all scoped recipe changes', async () => {
    const scope = element(styleScope, { styleProfile: 'new-york-v4' });
    const choice = element(toggle, { defaultActive: true });
    const label = document.createTextNode('Keep this choice');
    choice.append(label);
    scope.append(choice);
    mount(scope);
    await flush();
    const active = choice.getExposes().active;
    const focused = choice.getExposes().focused;
    choice.focus();
    await flush();
    let changes = 0;
    const off = active.subscribe(() => {
      changes++;
    });
    try {
      for (const profile of profiles) {
        setElementProps(scope, { styleProfile: profile.id });
        await flush();
        expect(tokens(choice)).toContain(profile.id === 'new-york-v4' ? 'bg-accent' : 'bg-muted');
        expect(tokens(choice).includes('bg-accent')).toBe(profile.id === 'new-york-v4');
        expect(tokens(choice)).toContain(
          profile.id === 'luma' ? 'rounded-[var(--pui-radius-3xl)]' : profile.radius
        );
        expect(choice.getExposes().active).toBe(active);
        expect(choice.getExposes().focused).toBe(focused);
        expect(active.get()).toBe(true);
        expect(focused.get()).toBe(true);
        expect(document.activeElement).toBe(choice);
        expect(choice.firstChild).toBe(label);
      }
      expect(changes).toBe(0);
    } finally {
      active.unsubscribe(off);
    }
  });

  it('resolves explicit before nearest scope and restores heterogeneous compatibility defaults after omission', async () => {
    const outer = element(styleScope);
    const inner = element(styleScope);
    const command = element(button);
    const choice = element(toggle, { defaultActive: true });
    command.textContent = 'Action';
    choice.textContent = 'Persistent choice';
    inner.append(command, choice);
    outer.append(inner);
    mount(outer);
    await flush();
    const active = choice.getExposes().active;
    expect(tokens(command)).toContain('h-8');
    expect(tokens(choice)).toContain('h-9');
    expect(tokens(choice)).toContain('bg-accent');
    setElementProps(inner, { styleProfile: 'mira' });
    await flush();
    expect(tokens(command)).toContain('h-7');
    expect(tokens(choice)).toContain('h-7');
    setElementProps(command, { styleProfile: 'luma' });
    setElementProps(choice, { styleProfile: 'new-york', defaultActive: true });
    setElementProps(outer, { styleProfile: 'sera' });
    await flush();
    expect(tokens(command)).toContain('rounded-[var(--pui-radius-4xl)]');
    expect(tokens(choice)).toContain('bg-accent');
    setElementProps(command, {});
    setElementProps(choice, { defaultActive: true, styleProfile: 'inherit' });
    await flush();
    expect(tokens(command)).toContain('h-7');
    expect(tokens(choice)).toContain('bg-muted');
    expect(tokens(choice)).not.toContain('bg-accent');
    setElementProps(inner, { styleProfile: 'inherit' });
    await flush();
    expect(tokens(command)).toContain('h-10');
    expect(tokens(choice)).toContain('h-10');
    setElementProps(outer, {});
    await flush();
    expect(tokens(command)).toContain('h-8');
    expect(tokens(command)).not.toContain('uppercase');
    expect(tokens(choice)).toContain('h-9');
    expect(tokens(choice)).toContain('bg-accent');
    expect(choice.getExposes().active).toBe(active);
    expect(active.get()).toBe(true);
  });

  it('withdraws every previous size/wrap contribution while compact remains a fixed Proto extension', async () => {
    const command = element(button);
    const label = document.createTextNode('A multiline command label');
    command.append(label);
    mount(command);
    await flush();
    const disabled = command.getExposes().disabled;
    for (const profile of profiles) {
      for (const [index, size] of ['default', 'sm', 'lg', 'icon', 'icon-compact'].entries()) {
        for (const wrap of [false, true]) {
          setElementProps(command, { styleProfile: profile.id, size, wrap });
          await flush();
          const actual = tokens(command);
          const icon = size === 'icon' || size === 'icon-compact';
          const height = size === 'icon-compact' ? 7 : profile.heights[index as 0 | 1 | 2 | 3];
          expect(actual.filter((value) => /^(?:h-|size-|min-h-)/.test(value))).toEqual(
            icon ? [`size-${height}`] : wrap ? [`min-h-${height}`, 'h-auto'] : [`h-${height}`]
          );
          expect(actual.includes('whitespace-normal')).toBe(wrap && !icon);
          expect(actual.includes('whitespace-nowrap')).toBe(!wrap || icon);
          if (size === 'icon-compact') {
            expect(actual.filter((value) => value.startsWith('rounded'))).toEqual(['rounded-md']);
            expect(actual.filter((value) => value.startsWith('gap-'))).toEqual(['gap-2']);
          }
          if (!icon) expect(actual).toContain(`px-${profile.padding[index as 0 | 1 | 2]}`);
          if (profile.id === 'vega' && size === 'sm')
            expect(actual).toContain('rounded-[min(var(--radius-md),10px)]');
          if (profile.id === 'nova' && size === 'sm') expect(actual).toContain('text-[0.8rem]');
          expect(command.getExposes().disabled).toBe(disabled);
          expect(command.firstChild).toBe(label);
        }
      }
    }
    setElementProps(command, {});
    await flush();
    expect(tokens(command)).toContain('h-8');
    expect(tokens(command)).not.toContain('h-auto');
  });

  it('uses source-specific live outline, focus and ghost paint rather than a universal modern fallback', async () => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    const command = element(button, { styleProfile: 'vega', variant: 'outline' });
    mount(command);
    await vi.waitFor(() => expect(tokens(command)).toContain('bg-input/30'));
    expect(tokens(command)).toContain('shadow-xs');
    expect(tokens(command)).toContain('border-input');
    command.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(tokens(command)).toContain('bg-input/50');
    setElementProps(command, { styleProfile: 'rhea', variant: 'outline' });
    await flush();
    expect(tokens(command)).toContain('bg-input/30');
    expect(tokens(command)).not.toContain('bg-input/50');
    expect(tokens(command)).not.toContain('shadow-xs');
    expect(tokens(command)).not.toContain('border-input');
    setElementProps(command, { styleProfile: 'maia', variant: 'outline' });
    await flush();
    expect(tokens(command)).toContain('bg-input/50');
    setElementProps(command, { styleProfile: 'new-york', variant: 'ghost' });
    await flush();
    expect(tokens(command)).toContain('bg-accent/50');
    expect(tokens(command)).not.toContain('bg-muted/50');
    setElementProps(command, { styleProfile: 'lyra', variant: 'ghost' });
    await flush();
    expect(tokens(command)).toContain('bg-muted/50');
    expect(tokens(command)).not.toContain('bg-accent/50');
    command.dispatchEvent(new PointerEvent('pointerleave'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    command.focus();
    await flush();
    expect(tokens(command)).toContain('ring-1');
    setElementProps(command, { styleProfile: 'mira', variant: 'ghost' });
    await flush();
    expect(tokens(command)).toContain('ring-2');
    expect(tokens(command)).not.toContain('ring-1');
    setElementProps(command, { styleProfile: 'sera', variant: 'link' });
    await flush();
    expect(tokens(command)).toContain('underline');
    setElementProps(command, { styleProfile: 'rhea', variant: 'link', disabled: true });
    await flush();
    expect(tokens(command)).not.toContain('underline');
    expect(command.getExposes().disabled.get()).toBe(true);
    expect(command.getExposes().hovered.get()).toBe(false);
  });

  it('keeps controlled Toggle refusal and disabled suppression through every profile transition', async () => {
    let raw: ShadcnToggleProps = { active: true, variant: 'outline', size: 'sm' };
    const root = new EventTarget();
    const global = new EventTarget();
    const emitted: Array<{ key: string; payload: unknown }> = [];
    const exposure: { current?: ProtoAdapterExposes<typeof toggle> } = {};
    const host: RuntimeHost<ShadcnToggleProps> = {
      prototypeName: toggle.name,
      getRawProps: () => raw,
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, root],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => root],
          [EVENT_GLOBAL_TARGET_CAP, () => global],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, root],
          [AS_TRIGGER_PARENT_CAP, () => null],
          [AS_TRIGGER_GET_PROTO_CAP, () => null],
        ]);
        wiring.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (key: string, payload: unknown) => emitted.push({ key, payload }),
          ],
        ]);
        wiring.attach('expose-state', [
          [
            EXPOSE_STATE_SET_EXPOSES_CAP,
            (next: Record<string, unknown>) => {
              // The actual expose-state module projects this exact Toggle contract.
              const projected = next as ProtoAdapterExposes<typeof toggle>;
              exposure.current = projected;
            },
          ],
        ]);
      },
    };
    const session = createRuntimeSession(toggle, host);
    await session.mount();
    const exposed = exposure.current;
    if (!exposed) throw new Error('Mounted Toggle did not project its actual exposed state.');
    const active = exposed.active;
    let changes = 0;
    const off = active.subscribe(() => {
      changes++;
    });
    try {
      const heights = [8, 7, 8, 7, 6, 8, 9, 7, 8];
      for (const [index, profile] of profiles.entries()) {
        raw = { ...raw, styleProfile: profile.id };
        session.controller.applyRawProps(raw);
        const actual = session.controller.getRuleStyleTokens();
        expect(actual.filter((value) => /^h-/.test(value))).toEqual([`h-${heights[index]}`]);
        expect(actual).toContain(profile.id === 'new-york-v4' ? 'bg-accent' : 'bg-muted');
        expect(actual.includes('text-accent-foreground')).toBe(profile.id === 'new-york-v4');
        if (profile.id === 'mira') {
          expect(actual).toContain('text-[0.625rem]');
          expect(actual).toContain('rounded-[min(var(--radius-md),8px)]');
        }
        if (profile.id === 'nova') expect(actual).toContain('rounded-[min(var(--radius-md),12px)]');
        expect(exposure.current?.active).toBe(active);
        expect(active.get()).toBe(true);
        expect(emitted).toEqual([]);
      }
      expect(changes).toBe(0);
      root.dispatchEvent(new CustomEvent('press.commit'));
      expect(active.get()).toBe(true);
      expect(emitted).toEqual([{ key: 'activeChange', payload: { active: false } }]);
      raw = { active: false, styleProfile: 'sera', disabled: true };
      session.controller.applyRawProps(raw);
      root.dispatchEvent(new CustomEvent('press.commit'));
      expect(active.get()).toBe(false);
      expect(emitted).toHaveLength(1);
      expect(session.controller.getRuleStyleTokens()).toContain('opacity-50');
    } finally {
      active.unsubscribe(off);
      await session.dispose();
    }
  });

  it('changes passive action paint without acquiring native navigation, focus or activation ownership', async () => {
    const owner = document.createElement('a');
    owner.href = '#command-profile-destination';
    const body = element(surface);
    const label = element(text);
    const content = document.createTextNode('Native destination');
    label.append(content);
    body.append(label);
    owner.append(body);
    mount(owner);
    await flush();
    owner.focus();
    const href = owner.getAttribute('href');
    for (const profile of profiles) {
      const recipe = shadcnActionAppearance({
        styleProfile: profile.id,
        emphasis: 'minimal',
        hovered: true,
        focusVisible: true,
        pressed: true,
      });
      setElementProps(body, recipe.surface);
      setElementProps(label, recipe.text);
      Object.assign(owner.style, recipe.layout);
      await flush();
      expect(tokens(body)).toContain(profile.radius);
      expect(tokens(body)).toContain(profile.id === 'new-york-v4' ? 'bg-accent' : 'bg-muted');
      expect(tokens(body).includes('translate-y-px')).toBe(profile.id !== 'new-york-v4');
      expect(tokens(label)).toContain(profile.text);
      expect(tokens(label).includes('uppercase')).toBe(profile.id === 'sera');
      expect(tokens(label).includes('tracking-widest')).toBe(profile.id === 'sera');
      expect(recipe.layout.minHeight).toBe(`${profile.heights[0] / 4}rem`);
      expect(body.getAttribute('role')).toBeNull();
      expect(body.getAttribute('tabindex')).toBeNull();
      expect(label.getAttribute('role')).toBeNull();
      expect(label.firstChild).toBe(content);
      expect(owner.firstChild).toBe(body);
      expect(body.firstChild).toBe(label);
      expect(document.activeElement).toBe(owner);
      expect(owner.getAttribute('href')).toBe(href);
      expect('focusSelf' in body.getExposes()).toBe(false);
    }
    setElementProps(body, {});
    setElementProps(label, { size: 'sm', leading: 'tighter' });
    await flush();
    expect(tokens(body)).toContain('rounded-xl');
    expect(tokens(body)).not.toContain('bg-muted');
    expect(tokens(body)).not.toContain('translate-y-px');
    expect(tokens(label)).toContain('leading-[1.1]');
    expect(tokens(label)).not.toContain('leading-5');
    expect(tokens(label)).not.toContain('tracking-widest');
    body.dispatchEvent(new PointerEvent('pointerenter'));
    body.dispatchEvent(new PointerEvent('pointerdown'));
    await flush();
    expect(tokens(body)).not.toContain('translate-y-px');
    expect(tokens(body)).not.toContain('bg-muted');
    expect(document.activeElement).toBe(owner);
  });
});
