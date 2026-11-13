import { describe, expect, it } from 'vitest';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import surface from '../src/surface';
import { THEME } from '../src/theme';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';

function mount(rawProps: Record<string, unknown>) {
  const host: RuntimeHost<any> = {
    prototypeName: surface.name,
    getRawProps: () => rawProps,
    commit(_children, signal) { signal?.done(); },
    schedule(task) { task(); },
  };
  return executeWithHost(surface, host);
}

describe('Bootstrap blue navbar passive Surface context', () => {
  it('keeps white ink across supplied facts and restores default on removal', async () => {
    const { controller, invokeUnmounted } = mount({ variant: 'transparent', colorContext: 'navbar' });
    try {
      for (const facts of [{}, { hovered: true }, { current: true }, { pressed: true }, { focusVisible: true }]) {
        controller.applyRawProps({ variant: 'transparent', colorContext: 'navbar', ...facts });
        const tokens = controller.getRuleStyleTokens();
        expect(tokens).toContain('text-white');
        expect(tokens).toContain('bg-transparent');
        expect(tokens).not.toContain('text-foreground');
        expect(tokens).not.toContain('bg-muted');
        if ('focusVisible' in facts) {
          expect(tokens).toContain('ring-primary-foreground');
          expect(tokens).not.toContain('ring-white');
          expect(tokens).not.toContain('ring-ring');
          expect(tokens).toContain('forced-colors-focus-outline');
        }
      }
      controller.applyRawProps({ variant: 'transparent' });
      expect(controller.getRuleStyleTokens()).toContain('text-foreground');
      expect(controller.getRuleStyleTokens()).not.toContain('text-white');
    } finally { await invokeUnmounted(); }
  });
  it('does not recolor ordinary panels or the Button profile', async () => {
    const { controller, invokeUnmounted } = mount({});
    try {
      for (const props of [{ variant: 'outline' }, { variant: 'secondary' }, { variant: 'transparent', actionProfile: 'button' }]) {
        controller.applyRawProps(props);
        const before = [...controller.getRuleStyleTokens()].sort();
        controller.applyRawProps({ ...props, colorContext: 'navbar' });
        expect([...controller.getRuleStyleTokens()].sort()).toEqual(before);
      }
    } finally { await invokeUnmounted(); }
  });
});

// Exercise the actual renderer, not just presence of a rule token. This catches
// an unsupported ring utility that silently leaves no usable focus declaration.
describe('navbar focus paint lowering', () => {
  it('emits the real focused Surface tokens on document, Shadow and split targets', async () => {
    const { controller, invokeUnmounted } = mount({
      variant: 'transparent', colorContext: 'navbar', focusVisible: true,
    });
    try {
      for (const palette of Object.values(THEME)) {
        expect(palette['primary-foreground']).toBe('#ffffff');
        expect(palette['primary-foreground']).toBe(palette['navbar-foreground']);
      }
      const tokens = [...controller.getRuleStyleTokens()];
      for (const render of [
        renderProtoStyleTokenCss,
        renderProtoShadowStyleTokenCss,
        (input: string[]) => renderProtoShadowSplitStyleArtifact(input).cssText,
      ]) {
        const css = render(tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('[data-pui-style~="ring-primary-foreground"]');
        expect(css).toContain('--pui-ring-color: var(--pui-primary-foreground);');
        expect(css).toContain('--pui-ring-width: 2px;');
        expect(css).toContain('--pui-ring-offset-width: 0px;');
        expect(css).toContain('box-shadow: var(--pui-ring-offset-shadow');
      }
    } finally { await invokeUnmounted(); }
  });
});
