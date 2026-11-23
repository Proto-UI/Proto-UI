import { describe, expect, it } from 'vitest';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import button from '../src/button';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';

const colorCases = [
  ['default', '#fff', '#e6e6e6', '#f5f5f5'],
  ['primary', '#08c', '#04c', '#006dcc'],
  ['warning', '#fbb450', '#f89406', '#faa732'],
  ['danger', '#ee5f5b', '#bd362f', '#da4f49'],
  ['success', '#62c462', '#51a351', '#5bb75b'],
  ['info', '#5bc0de', '#2f96b4', '#49afcd'],
  ['inverse', '#444', '#222', '#363636'],
] as const;

function mount(rawProps: Record<string, unknown> = {}) {
  const root = new EventTarget();
  const global = new EventTarget();
  const host: RuntimeHost<any> = {
    prototypeName: button.name,
    getRawProps: () => rawProps,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => global],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
    },
  };
  const { controller, invokeUnmounted } = executeWithHost(button, host);
  return { controller, root, global, invokeUnmounted };
}

describe('bootstrap-2-3-2 Button draft projection', () => {
  it('restores default appearance after prop removal', async () => {
    const { controller, invokeUnmounted } = mount({ variant: 'primary' });
    expect(controller.getRuleStyleTokens()).toContain(
      'bg-[#006dcc_linear-gradient(#08c,#04c)_0_0_repeat-x]'
    );
    controller.applyRawProps({});
    expect(controller.getRuleStyleTokens()).toContain(
      'bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x]'
    );
    await invokeUnmounted();
  });
  it('derives press, focus and disabled feedback from Base state', async () => {
    const { controller, root, global, invokeUnmounted } = mount();
    root.dispatchEvent(new CustomEvent('pointer.enter'));
    root.dispatchEvent(new CustomEvent('pointer.down'));
    expect(controller.getRuleStyleTokens().some((token) => token.startsWith('shadow-'))).toBe(true);
    root.dispatchEvent(new CustomEvent('pointer.up'));
    root.dispatchEvent(new CustomEvent('pointer.leave'));
    global.dispatchEvent(new CustomEvent('key.down'));
    root.dispatchEvent(new CustomEvent('host:focus'));
    expect(controller.getRuleStyleTokens()).toContain('ring-2');
    controller.applyRawProps({ disabled: true });
    expect(controller.getRuleStyleTokens()).toContain('opacity-65');
    expect(controller.getRuleStyleTokens()).toContain('pointer-events-none');
    controller.applyRawProps({});
    expect(controller.getRuleStyleTokens()).not.toContain('opacity-65');
    await invokeUnmounted();
  });
  it.each(colorCases)(
    'switches exclusive sizes and removes provided size for %s',
    async (variant, start, end, base) => {
      const sizes = {
        default: ['px-[12px]', 'py-[4px]', 'text-[14px]', 'rounded-[4px]'],
        large: ['px-[19px]', 'py-[11px]', 'text-[17.5px]', 'rounded-[6px]'],
        small: ['px-[10px]', 'py-[2px]', 'text-[11.9px]', 'rounded-[3px]'],
        mini: ['px-[6px]', 'py-[0px]', 'text-[10.5px]', 'rounded-[3px]'],
      };
      const { controller, invokeUnmounted } = mount({ variant });
      const assertSize = (size: keyof typeof sizes) => {
        const tokens = controller.getRuleStyleTokens();
        for (const token of sizes[size]) expect(tokens).toContain(token);
        for (const token of new Set(Object.values(sizes).flat())) {
          if (!sizes[size].includes(token)) expect(tokens).not.toContain(token);
        }
      };
      assertSize('default');
      for (const size of ['large', 'mini', 'small', 'default', 'large'] as const) {
        controller.applyRawProps({ variant, size, disabled: true });
        assertSize(size);
        expect(controller.getRuleStyleTokens()).toContain('opacity-65');
        controller.applyRawProps({ variant, size, disabled: false });
        assertSize(size);
        expect(controller.getRuleStyleTokens()).not.toContain('opacity-65');
      }
      // Full raw snapshots really remove size; the demo patch API cannot do this.
      controller.applyRawProps({ variant });
      assertSize('default');
      expect(controller.getRuleStyleTokens()).toContain(
        `bg-[${base}_linear-gradient(${start},${end})_0_0_repeat-x]`
      );
      await invokeUnmounted();
    }
  );
  it.each(colorCases)(
    'projects %s source paint through inherited interaction states',
    async (variant, start, end, base) => {
      const rest = `bg-[${base}_linear-gradient(${start},${end})_0_0_repeat-x]`;
      const interactive = `bg-[${end}_linear-gradient(${start},${end})_0_-15px_repeat-x]`;
      const flat = `bg-[${end}_none_0_0_repeat-x]`;
      const { controller, root, global, invokeUnmounted } = mount({ variant });
      expect(controller.getRuleStyleTokens()).toContain(rest);
      expect(controller.getRuleStyleTokens()).toContain(
        variant === 'default'
          ? 'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)]'
          : 'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)]'
      );
      expect(controller.getRuleStyleTokens()).toContain(
        variant === 'default'
          ? 'border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
          : 'border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
      );
      global.dispatchEvent(new CustomEvent('key.down'));
      root.dispatchEvent(new CustomEvent('host:focus'));
      expect(controller.getRuleStyleTokens()).toContain(interactive);
      expect(controller.getRuleStyleTokens()).not.toContain(rest);
      expect(controller.getRuleStyleTokens()).toContain('ring-2');
      root.dispatchEvent(new CustomEvent('host:blur'));
      root.dispatchEvent(new CustomEvent('pointer.enter'));
      expect(controller.getRuleStyleTokens()).toContain(interactive);
      root.dispatchEvent(new CustomEvent('pointer.down'));
      expect(controller.getRuleStyleTokens()).toContain(`bg-[${end}_none_0_-15px_repeat-x]`);
      expect(controller.getRuleStyleTokens()).not.toContain(interactive);
      expect(controller.getRuleStyleTokens()).toContain(
        'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
      );
      controller.applyRawProps({ variant, disabled: true });
      expect(controller.getRuleStyleTokens()).toContain(flat);
      expect(controller.getRuleStyleTokens()).toContain('shadow-none');
      expect(controller.getRuleStyleTokens()).not.toContain(
        'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
      );
      controller.applyRawProps({ variant });
      root.dispatchEvent(new CustomEvent('pointer.up'));
      root.dispatchEvent(new CustomEvent('pointer.leave'));
      root.dispatchEvent(new CustomEvent('host:blur'));
      expect(controller.getRuleStyleTokens()).toContain(rest);
      // An exposed press without hover/focus must keep the unshifted endpoint.
      root.dispatchEvent(new CustomEvent('pointer.down'));
      expect(controller.getRuleStyleTokens()).toContain(flat);
      root.dispatchEvent(new CustomEvent('pointer.up'));
      expect(controller.getRuleStyleTokens()).toContain(rest);
      controller.applyRawProps({});
      expect(controller.getRuleStyleTokens()).toContain(
        'bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x]'
      );
      await invokeUnmounted();
    }
  );
  it('switches every variant on the same sized instance without stale paint', async () => {
    const { controller, invokeUnmounted } = mount({ size: 'mini' });
    for (const [variant, start, end, base] of colorCases) {
      controller.applyRawProps({ variant, size: 'mini' });
      const tokens = controller.getRuleStyleTokens();
      expect(tokens.filter((token) => token.startsWith('bg-'))).toEqual([
        `bg-[${base}_linear-gradient(${start},${end})_0_0_repeat-x]`,
      ]);
      expect(tokens).toContain('text-[10.5px]');
      expect(tokens).toContain('rounded-[3px]');
    }
    controller.applyRawProps({});
    const tokens = controller.getRuleStyleTokens();
    expect(tokens.filter((token) => token.startsWith('bg-'))).toEqual([
      'bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x]',
    ]);
    expect(tokens).toContain('text-[14px]');
    await invokeUnmounted();
  });
  it.each(colorCases)(
    'limits %s motion to enabled ordinary hover/focus entry and revokes it on the same owner',
    async (variant) => {
      const { controller, root, global, invokeUnmounted } = mount({ variant });
      const motion = ['transition-[background-position]', 'duration-100', 'ease-linear'];
      const assertMotion = (active: boolean) => {
        const tokens = controller.getRuleStyleTokens();
        for (const token of motion) expect(tokens.includes(token)).toBe(active);
        expect(tokens).not.toContain('transition-all');
        expect(tokens).not.toContain('transition-colors');
      };
      try {
        assertMotion(false);
        root.dispatchEvent(new CustomEvent('pointer.enter'));
        assertMotion(true);
        root.dispatchEvent(new CustomEvent('pointer.down'));
        assertMotion(true); // Flattening the image is not another animated property.
        root.dispatchEvent(new CustomEvent('pointer.up'));
        root.dispatchEvent(new CustomEvent('pointer.leave'));
        assertMotion(false); // No resident reverse animation after leaving.
        global.dispatchEvent(new CustomEvent('key.down'));
        root.dispatchEvent(new CustomEvent('host:focus'));
        assertMotion(true);
        root.dispatchEvent(new CustomEvent('pointer.enter'));
        root.dispatchEvent(new CustomEvent('pointer.leave'));
        assertMotion(true); // Focus keeps the entry state while pointer leaves.
        root.dispatchEvent(new CustomEvent('host:blur'));
        assertMotion(false);
        root.dispatchEvent(new CustomEvent('pointer.enter'));
        assertMotion(true);
        controller.applyRawProps({ variant, disabled: true });
        assertMotion(false);
        expect(controller.getRuleStyleTokens()).toContain('shadow-none');
        controller.applyRawProps({ variant });
        root.dispatchEvent(new CustomEvent('pointer.leave'));
        root.dispatchEvent(new CustomEvent('pointer.enter'));
        assertMotion(true);
        controller.applyRawProps({ variant, colorContext: 'navbar' });
        assertMotion(false);
        root.dispatchEvent(new CustomEvent('pointer.leave'));
        root.dispatchEvent(new CustomEvent('pointer.enter'));
        assertMotion(false);
        // Full raw snapshot actually removes the context prop while hovered.
        controller.applyRawProps({ variant });
        assertMotion(true);
        root.dispatchEvent(new CustomEvent('pointer.leave'));
        assertMotion(false);
      } finally {
        await invokeUnmounted();
      }
    }
  );
  it.each(['default', 'primary', 'inverse'] as const)(
    'restores %s paint after opting the same Base owner into the navbar',
    async (variant) => {
      const { controller, root, global, invokeUnmounted } = mount({ variant, size: 'small' });
      try {
        const ordinary = [...controller.getRuleStyleTokens()].sort();
        const assertNavbarFill = (fill: string) => {
          const tokens = controller.getRuleStyleTokens();
          expect(tokens.filter((token) => token.startsWith('bg-'))).toEqual([fill]);
          expect(tokens).toContain('border-transparent');
          expect(tokens).toContain('text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)]');
          expect(tokens).not.toContain('ring-ring');
          expect(tokens).toContain('text-[11.9px]');
        };
        controller.applyRawProps({ variant, size: 'small', colorContext: 'navbar' });
        assertNavbarFill('bg-transparent');
        expect(controller.getRuleStyleTokens()).toContain('shadow-none');
        root.dispatchEvent(new CustomEvent('pointer.enter'));
        assertNavbarFill('bg-black/10');
        root.dispatchEvent(new CustomEvent('pointer.down'));
        assertNavbarFill('bg-black/20');
        expect(controller.getRuleStyleTokens()).toContain(
          'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
        );
        controller.applyRawProps({
          variant,
          size: 'small',
          colorContext: 'navbar',
          disabled: true,
        });
        assertNavbarFill('bg-transparent');
        expect(controller.getRuleStyleTokens()).toContain('shadow-none');
        expect(controller.getRuleStyleTokens()).toContain('pointer-events-none');
        controller.applyRawProps({ variant, size: 'small', colorContext: 'navbar' });
        root.dispatchEvent(new CustomEvent('pointer.up'));
        root.dispatchEvent(new CustomEvent('pointer.leave'));
        global.dispatchEvent(new CustomEvent('key.down'));
        root.dispatchEvent(new CustomEvent('host:focus'));
        assertNavbarFill('bg-black/10');
        expect(controller.getRuleStyleTokens()).toContain('ring-white');
        expect(controller.getRuleStyleTokens()).not.toContain('ring-primary-foreground');
        expect(controller.getRuleStyleTokens()).toContain('ring-offset-0');
        expect(controller.getRuleStyleTokens()).toContain('forced-colors-focus-outline');
        for (const render of [
          renderProtoStyleTokenCss,
          renderProtoShadowStyleTokenCss,
          (tokens: string[]) => renderProtoShadowSplitStyleArtifact(tokens).cssText,
        ]) {
          const css = render([...controller.getRuleStyleTokens()]);
          expect(css).not.toContain('Unsupported Proto UI style tokens');
          expect(css).toContain('--pui-ring-color: #ffffff;');
          expect(css).not.toContain('--pui-ring-color: var(--pui-primary-foreground);');
          expect(css).toContain('--pui-ring-width: 2px;');
          expect(css).toContain('--pui-ring-offset-width: 0px;');
          expect(css).toContain('box-shadow: var(--pui-ring-offset-shadow');
        }
        root.dispatchEvent(new CustomEvent('host:blur'));
        assertNavbarFill('bg-transparent');
        expect(controller.getRuleStyleTokens()).not.toContain('ring-white');
        // Actual raw-prop removal, not an explicit default patch, restores the
        // entire ordinary variant/size output without retaining navbar paint.
        controller.applyRawProps({ variant, size: 'small' });
        expect([...controller.getRuleStyleTokens()].sort()).toEqual(ordinary);
        global.dispatchEvent(new CustomEvent('key.down'));
        root.dispatchEvent(new CustomEvent('host:focus'));
        expect(controller.getRuleStyleTokens()).toContain('ring-ring');
        expect(controller.getRuleStyleTokens()).not.toContain('ring-white');
      } finally {
        await invokeUnmounted();
      }
    }
  );
});
