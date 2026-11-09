import { describe, expect, it } from 'vitest';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import surface, { bootstrap232ActionAppearance } from '../src/surface';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonDefaultLayout,
} from '../src/button/paint';

function mount(props: Record<string, unknown>) {
  const host: RuntimeHost<any> = {
    prototypeName: surface.name,
    getRawProps: () => props,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
  };
  return executeWithHost(surface, host);
}

describe('Bootstrap ordinary Button appearance on passive Surface', () => {
  it.each([
    ['primary', 'primary'],
    ['secondary', 'default'],
  ] as const)(
    'shares %s Button paint without a second semantic owner',
    async (emphasis, variant) => {
      const recipe = bootstrap232ActionAppearance({ emphasis });
      const { controller, invokeUnmounted } = mount({ ...recipe.surface });
      const states = [
        [{}, bootstrapButtonRestFill[variant]],
        [{ hovered: true }, bootstrapButtonInteractiveFill[variant]],
        [{ focusVisible: true }, bootstrapButtonInteractiveFill[variant]],
        [{ pressed: true }, bootstrapButtonFlatFill[variant]],
        [{ hovered: true, pressed: true }, bootstrapButtonPressedFill[variant]],
        [{}, bootstrapButtonRestFill[variant]],
      ] as const;
      for (const [facts, expected] of states) {
        controller.applyRawProps(bootstrap232ActionAppearance({ emphasis, ...facts }).surface);
        const tokens = controller.getRuleStyleTokens();
        expect(tokens.filter((token) => token.startsWith('bg-'))).toEqual([expected]);
        expect(tokens).toContain('rounded-[4px]');
        expect(tokens).toContain('px-[12px]');
        expect(tokens).toContain('py-[4px]');
        expect(tokens).not.toContain('translate-y-px');
        expect(tokens).not.toContain('rounded-none');
      }
      expect(recipe.layout).toBe(bootstrapButtonDefaultLayout);
      expect(recipe.text).toMatchObject({
        size: 'base',
        tone: 'inherit',
        weight: 'normal',
        leading: 'size',
      });
      controller.applyRawProps({ variant: 'outline', elevation: 'raised' });
      const restored = controller.getRuleStyleTokens();
      expect(restored).toContain('bg-background');
      expect(restored).not.toContain('px-[12px]');
      expect(restored).toContain('shadow-[0_1px_3px_rgb(0_0_0/5.5%)]');
      await invokeUnmounted();
    }
  );

  it('supports a profile alone using the default Button, without stale neutral paint', async () => {
    const { controller, invokeUnmounted } = mount({ actionProfile: 'button' });
    expect(controller.getRuleStyleTokens().filter((token) => token.startsWith('bg-'))).toEqual([
      bootstrapButtonRestFill.default,
    ]);
    await invokeUnmounted();
  });

  it('preserves native anchor focus and destination without Button role or nested interaction', async () => {
    const tag = 'bootstrap-action-passive-proof';
    if (!customElements.get(tag))
      customElements.define(
        tag,
        AdaptToWebComponent(surface, { register: false, registerAs: tag })
      );
    const link = document.createElement('a');
    link.href = '/start-here/';
    const host = document.createElement(tag);
    host.textContent = 'Get started';
    setElementProps(host, bootstrap232ActionAppearance().surface);
    link.append(host);
    document.body.append(link);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(link.getAttribute('href')).toBe('/start-here/');
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(link.querySelectorAll('button, [role="button"], a')).toHaveLength(0);
    link.remove();
  });
});
