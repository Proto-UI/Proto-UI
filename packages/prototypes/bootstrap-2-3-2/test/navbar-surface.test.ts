import { describe, expect, it } from 'vitest';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import surface from '../src/surface';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';

function mount(rawProps: Record<string, unknown>) {
  const host: RuntimeHost<any> = {
    prototypeName: surface.name,
    getRawProps: () => rawProps,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
  };
  return executeWithHost(surface, host);
}

describe('Bootstrap blue navbar passive Surface context', () => {
  it('keeps white ink and exclusive navbar feedback, then removes that context', async () => {
    const { controller, invokeUnmounted } = mount({
      variant: 'transparent',
      colorContext: 'navbar',
    });
    try {
      for (const [facts, fill] of [
        [{}, 'bg-transparent'],
        [{ hovered: true }, 'bg-black/10'],
        [{ current: true }, 'bg-black/20'],
        [{ pressed: true }, 'bg-black/20'],
        [{ hovered: true, pressed: true, current: true }, 'bg-black/20'],
        [{ focusVisible: true }, 'bg-transparent'],
        [{}, 'bg-transparent'],
      ] as const) {
        controller.applyRawProps({ variant: 'transparent', colorContext: 'navbar', ...facts });
        const tokens = controller.getRuleStyleTokens();
        expect(tokens).toContain('text-white');
        expect(tokens.filter((token) => token.startsWith('bg-'))).toEqual([fill]);
        expect(tokens).not.toContain('text-foreground');
        expect(tokens).not.toContain('bg-muted');
        expect(tokens).not.toContain('translate-y-px');
        if ('pressed' in facts || 'current' in facts) {
          expect(tokens).toContain(
            'shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
          );
        } else expect(tokens).toContain('shadow-none');
        if ('focusVisible' in facts) {
          expect(tokens).toContain('ring-white');
          expect(tokens).not.toContain('ring-primary-foreground');
          expect(tokens).not.toContain('ring-ring');
          expect(tokens).toContain('forced-colors-focus-outline');
        }
      }
      controller.applyRawProps({ variant: 'transparent', hovered: true, pressed: true });
      expect(controller.getRuleStyleTokens()).toContain('text-foreground');
      expect(controller.getRuleStyleTokens()).not.toContain('text-white');
      expect(controller.getRuleStyleTokens()).toContain('translate-y-px');
      expect(controller.getRuleStyleTokens()).not.toContain('bg-black/20');
    } finally {
      await invokeUnmounted();
    }
  });
  it('does not recolor ordinary panels or the Button profile', async () => {
    const { controller, invokeUnmounted } = mount({});
    try {
      for (const props of [
        { variant: 'outline' },
        { variant: 'secondary' },
        { variant: 'transparent', actionProfile: 'button' },
      ]) {
        controller.applyRawProps(props);
        const before = [...controller.getRuleStyleTokens()].sort();
        controller.applyRawProps({ ...props, colorContext: 'navbar' });
        expect([...controller.getRuleStyleTokens()].sort()).toEqual(before);
      }
    } finally {
      await invokeUnmounted();
    }
  });
});

// Exercise the actual renderer, not just presence of a rule token. This catches
// an unsupported ring utility that silently leaves no usable focus declaration.
describe('navbar focus paint lowering', () => {
  it('emits the real focused Surface tokens on document, Shadow and split targets', async () => {
    const { controller, invokeUnmounted } = mount({
      variant: 'transparent',
      colorContext: 'navbar',
      focusVisible: true,
    });
    try {
      const tokens = [...controller.getRuleStyleTokens()];
      for (const render of [
        renderProtoStyleTokenCss,
        renderProtoShadowStyleTokenCss,
        (input: string[]) => renderProtoShadowSplitStyleArtifact(input).cssText,
      ]) {
        const css = render(tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('[data-pui-style~="ring-white"]');
        expect(css).toContain('--pui-ring-color: #ffffff;');
        // A family Navbar may live inside another page palette (as Docs does).
        // Its white ring cannot depend on the surrounding primary foreground.
        expect(css).not.toContain('--pui-ring-color: var(--pui-primary-foreground);');
        expect(css).toContain('--pui-ring-width: 2px;');
        expect(css).toContain('--pui-ring-offset-width: 0px;');
        expect(css).toContain('box-shadow: var(--pui-ring-offset-shadow');
      }
    } finally {
      await invokeUnmounted();
    }
  });
});
