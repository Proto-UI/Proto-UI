import { afterEach, describe, expect, it } from 'vitest';
import type { RuntimeHost } from '@proto.ui/runtime';
import { executeWithHost } from '@proto.ui/runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { styleContains } from '../../test-utils/style';
import { BRUTALIST_STYLE_TOKENS } from '../../../cli/src/generated/brutalist-style-tokens';
import { BRUTALIST_THEME_CSS } from '../../../cli/src/generated/brutalist-theme';
import { BrutalistBadgeRoot } from '../src/badge';
import { BrutalistSkeletonRoot } from '../src/skeleton';
import { BrutalistCardRoot } from '../src/card';
import { BrutalistTextareaRoot } from '../src/textarea';
import { BrutalistScrollAreaRoot } from '../src/scroll-area';
import toggle from '../src/toggle';
import { switchRoot, switchThumb } from '../src/switch';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../src/tabs';

const HARD_SHADOW_4PX = 'shadow-[4px_4px_0_0_#000]';
const ACTIVE_INSET_FRAME = 'shadow-[inset_0_0_0_2px_#000]';

const BrutalistBadgeElement = AdaptToWebComponent(BrutalistBadgeRoot);
const BrutalistSkeletonElement = AdaptToWebComponent(BrutalistSkeletonRoot);
const BrutalistCardElement = AdaptToWebComponent(BrutalistCardRoot);
AdaptToWebComponent(BrutalistTextareaRoot);
AdaptToWebComponent(BrutalistScrollAreaRoot);
AdaptToWebComponent(switchRoot);
AdaptToWebComponent(switchThumb);
AdaptToWebComponent(tabsRoot);
AdaptToWebComponent(tabsList);
AdaptToWebComponent(tabsTrigger);
AdaptToWebComponent(tabsContent);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

function shadowTokens(element: HTMLElement): string[] {
  return (element.getAttribute('data-pui-style') ?? '')
    .split(/\s+/)
    .filter((token) => token.startsWith('shadow'));
}

function motionTokens(element: HTMLElement): string[] {
  return (element.getAttribute('data-pui-style') ?? '')
    .split(/\s+/)
    .filter((token) => token.includes('translate') || token.startsWith('transition'));
}

function mountThemed(scheme: 'light' | 'dark', element: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-brutalist-grammar-theme', scheme);
  const variables = scheme === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS;
  for (const [name, value] of Object.entries(variables)) {
    wrapper.style.setProperty(name, value);
  }
  wrapper.appendChild(element);
  document.body.appendChild(wrapper);
  return wrapper;
}

function themeVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--pui-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars[`--pui-${name}`] = value.trim();
  }
  return vars;
}

const LIGHT_THEME_VARS = themeVars(BRUTALIST_THEME_CSS.match(/:root \{([\s\S]*?)\}/)?.[1] ?? '');
const DARK_THEME_VARS = themeVars(
  BRUTALIST_THEME_CSS.match(/:root\.dark,[\s\S]*?\{([\s\S]*?)\}/)?.[1] ?? ''
);

// D-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001: category membership is projected from the
// owning P entities; these cases assert the typed grammar rather than a universal rule.
describe('prototypes/brutalist: typed depth and motion grammar', () => {
  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-PASSIVE-LABEL
  it.each(['light', 'dark'] as const)(
    'keeps the passive-label Badge shadow-free with no interaction motion in %s',
    async (scheme) => {
      const element = new BrutalistBadgeElement();
      mountThemed(scheme, element);
      await flush();

      expect(shadowTokens(element)).toEqual([]);
      expect(motionTokens(element)).toEqual([]);
      expect(styleContains(element, 'border-2')).toBe(true);
      expect(styleContains(element, 'border-black')).toBe(true);
      expect(styleContains(element, 'rounded-base')).toBe(true);
    }
  );

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-LOADING-PLACEHOLDER
  it.each(['light', 'dark'] as const)(
    'keeps the loading-placeholder Skeleton shadow-free and static in %s',
    async (scheme) => {
      const element = new BrutalistSkeletonElement();
      mountThemed(scheme, element);
      await flush();

      expect(shadowTokens(element)).toEqual([]);
      expect(motionTokens(element)).toEqual([]);
      expect(styleContains(element, 'animate-pulse')).toBe(false);
      expect(styleContains(element, 'bg-secondary-background')).toBe(true);
      expect(styleContains(element, 'border-black')).toBe(true);
    }
  );

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-RAISED-PANEL
  it.each(['light', 'dark'] as const)(
    'keeps the raised-panel Card at its 4px 4px black rest shadow without motion in %s',
    async (scheme) => {
      const element = new BrutalistCardElement();
      mountThemed(scheme, element);
      await flush();

      expect(styleContains(element, HARD_SHADOW_4PX)).toBe(true);
      expect(motionTokens(element)).toEqual([]);
      expect(styleContains(element, 'shadow-none')).toBe(false);
      expect(styleContains(element, 'rounded-base')).toBe(true);
      expect(styleContains(element, 'border-black')).toBe(true);
    }
  );

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-EDITABLE-SURFACE
  it.each(['light', 'dark'] as const)(
    'keeps the editable Textarea shadow-free without hover lift or press sink in %s',
    async (scheme) => {
      const element = document.createElement(BrutalistTextareaRoot.name) as HTMLElement;
      setElementProps(element, { defaultValue: 'Draft' });
      mountThemed(scheme, element);
      await flush();

      const target = element.querySelector('textarea');
      expect(target).not.toBeNull();
      const shadow = (target!.getAttribute('data-pui-style') ?? '')
        .split(/\s+/)
        .filter((token) => token.startsWith('shadow'));
      expect(shadow).toEqual([]);
      const motion = (target!.getAttribute('data-pui-style') ?? '')
        .split(/\s+/)
        .filter((token) => token.includes('translate'));
      expect(motion).toEqual([]);
      expect(styleContains(target!, 'border-border')).toBe(true);
      expect(styleContains(target!, 'bg-secondary-background')).toBe(true);
    }
  );

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-SCROLL-CHROME
  it.each(['light', 'dark'] as const)(
    'keeps the scroll-chrome Scroll Area Root shadow-free with no interaction motion in %s',
    async (scheme) => {
      const element = document.createElement(BrutalistScrollAreaRoot.name) as HTMLElement;
      mountThemed(scheme, element);
      await flush();

      expect(shadowTokens(element)).toEqual([]);
      expect(motionTokens(element)).toEqual([]);
      expect(styleContains(element, 'overflow-hidden')).toBe(true);
      expect(styleContains(element, 'rounded-base')).toBe(true);
      expect(styleContains(element, 'border-foreground')).toBe(true);
    }
  );

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-FLAT-SELECTION
  it('keeps the flat-selection Toggle free of translation and outer shadow through hover, press, and active', () => {
    const { context, controller, invokeUnmounted } = executeFlatToggle();
    try {
      let tokens = controller.getRuleStyleTokens();
      expect(tokens.filter((token) => token.startsWith('shadow-['))).toEqual([]);

      context.rootTarget.dispatchEvent(new CustomEvent('pointer.enter'));
      tokens = controller.getRuleStyleTokens();
      expect(context.getExposes().hovered.get()).toBe(true);
      expect(tokens).toContain('border-black');
      expect(tokens).not.toContain(HARD_SHADOW_4PX);
      expect(tokens.some((token) => token.includes('translate'))).toBe(false);

      context.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
      tokens = controller.getRuleStyleTokens();
      expect(context.getExposes().pressed.get()).toBe(true);
      expect(tokens).toContain('border-black');
      expect(tokens).not.toContain(HARD_SHADOW_4PX);
      expect(tokens).not.toContain('shadow-none');
      expect(tokens.some((token) => token.includes('translate'))).toBe(false);

      context.rootTarget.dispatchEvent(new CustomEvent('pointer.up'));
      context.rootTarget.dispatchEvent(new CustomEvent('press.commit'));
      tokens = controller.getRuleStyleTokens();
      expect(context.getExposes().active.get()).toBe(true);
      expect(tokens).toContain(ACTIVE_INSET_FRAME);
      expect(tokens).not.toContain(HARD_SHADOW_4PX);

      context.rootTarget.dispatchEvent(new CustomEvent('pointer.down'));
      tokens = controller.getRuleStyleTokens();
      expect(context.getExposes().pressed.get()).toBe(true);
      expect(tokens).toContain(ACTIVE_INSET_FRAME);
      expect(tokens).not.toContain(HARD_SHADOW_4PX);
      expect(tokens).not.toContain('shadow-none');
    } finally {
      invokeUnmounted();
    }
  });

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-FLAT-TAB
  it('keeps the flat-selection Tabs Trigger flat when selected and gates hover to unselected released triggers', async () => {
    const root = document.createElement(tabsRoot.name);
    const list = document.createElement(tabsList.name);
    const selectedTrigger = document.createElement(tabsTrigger.name);
    const unselectedTrigger = document.createElement(tabsTrigger.name);
    const contentA = document.createElement(tabsContent.name);
    const contentB = document.createElement(tabsContent.name);
    setElementProps(root, { defaultValue: 'a' });
    setElementProps(list, { a11yLabel: 'Grammar' });
    setElementProps(selectedTrigger, { value: 'a' });
    setElementProps(unselectedTrigger, { value: 'b' });
    setElementProps(contentA, { value: 'a', keepMounted: true });
    setElementProps(contentB, { value: 'b', keepMounted: true });
    list.append(selectedTrigger, unselectedTrigger);
    root.append(list, contentA, contentB);
    document.body.appendChild(root);
    await flush();

    expect(selectedTrigger.hasAttribute('data-selected')).toBe(true);
    expect(styleContains(selectedTrigger, 'bg-main')).toBe(true);
    expect(styleContains(selectedTrigger, 'border-black')).toBe(true);
    expect(shadowTokens(selectedTrigger as HTMLElement)).toEqual([]);
    expect(motionTokens(selectedTrigger as HTMLElement)).toEqual([]);

    selectedTrigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(styleContains(selectedTrigger, 'bg-main')).toBe(true);
    expect(shadowTokens(selectedTrigger as HTMLElement)).toEqual([]);

    selectedTrigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(shadowTokens(selectedTrigger as HTMLElement)).toEqual([]);
    expect(motionTokens(selectedTrigger as HTMLElement)).toEqual([]);
    selectedTrigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();

    unselectedTrigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(unselectedTrigger.hasAttribute('data-hovered')).toBe(true);
    expect(styleContains(unselectedTrigger, 'bg-secondary-background')).toBe(true);
    expect(styleContains(unselectedTrigger, 'border-black')).toBe(true);
    expect(shadowTokens(unselectedTrigger as HTMLElement)).toEqual([]);
    expect(motionTokens(unselectedTrigger as HTMLElement)).toEqual([]);
  });

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-BINARY-CAPSULE
  it('keeps the binary-capsule Switch hover-free and press shadow-free while only the Thumb travels', async () => {
    const root = document.createElement(switchRoot.name);
    const thumb = document.createElement(switchThumb.name);
    root.appendChild(thumb);
    document.body.appendChild(root);
    await flush();

    const restShadow = shadowTokens(root);
    const restMotion = motionTokens(root).filter((token) => token.includes('translate'));
    expect(restShadow).toEqual([]);
    expect(restMotion).toEqual([]);
    expect(styleContains(root, 'transition-colors')).toBe(true);
    expect(styleContains(thumb, 'translate-x-0')).toBe(true);

    root.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(shadowTokens(root)).toEqual(restShadow);
    expect(motionTokens(root).filter((token) => token.includes('translate'))).toEqual([]);

    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(root.hasAttribute('data-pressed')).toBe(true);
    expect(shadowTokens(root)).toEqual([]);
    expect(motionTokens(root).filter((token) => token.includes('translate'))).toEqual([]);
    root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();

    root.click();
    await flush();
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(styleContains(thumb, 'translate-x-5')).toBe(true);
    expect(shadowTokens(thumb)).toEqual([]);
    expect(styleContains(root, 'data-[checked]:bg-main')).toBe(true);
  });

  // T-BRUTALIST-DEPTH-MOTION-GRAMMAR-0001-CASE-TOKEN-CLOSURE
  it('keeps the generated CLI Brutalist token closure complete for the governed shadow vocabulary', () => {
    for (const token of [HARD_SHADOW_4PX, ACTIVE_INSET_FRAME]) {
      expect(BRUTALIST_STYLE_TOKENS).toContain(token);
    }
    expect(BRUTALIST_STYLE_TOKENS).toContain('shadow-none');
  });
});

function executeFlatToggle() {
  const rootTarget = new EventTarget();
  const globalTarget = new EventTarget();
  let exposes: {
    active: { get(): boolean };
    hovered: { get(): boolean };
    pressed: { get(): boolean };
  } | null = null;
  const host: RuntimeHost<Record<string, unknown>> = {
    prototypeName: 'brutalist-toggle-grammar',
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => rootTarget],
        [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
      ]);
      wiring.attach('rule-meta', [[RULE_META_GET_CAP, () => null]]);
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, unknown>) => {
            exposes = next as typeof exposes;
          },
        ],
      ]);
    },
  };
  const runtime = executeWithHost(toggle as never, host as never);
  return {
    context: {
      rootTarget,
      globalTarget,
      getExposes() {
        if (!exposes) throw new Error('Toggle exposes were not projected.');
        return exposes;
      },
    },
    ...runtime,
  };
}
