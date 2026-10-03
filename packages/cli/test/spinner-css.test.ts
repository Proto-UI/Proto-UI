import { describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';

describe('cli: proto-style-css spinner surface', () => {
  it('emits pui-spin keyframes with a 1000ms linear infinite rotation', () => {
    const css = renderProtoStyleTokenCss(['animate-spin']);
    expect(css).toContain('@keyframes pui-spin');
    expect(css).toContain('transform: rotate(360deg);');
    expect(css).toContain('animation-name: pui-spin;');
    expect(css).toContain('animation-duration: 1000ms;');
    expect(css).toContain('animation-timing-function: linear;');
    expect(css).toContain('animation-iteration-count: infinite;');
  });

  it('emits a reduced-motion variant that removes the animation', () => {
    const css = renderProtoStyleTokenCss(['motion-reduce:animate-none']);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none;');
    // The reduced-motion rule must not leak into the base layer surface.
    const baseBlock = css.split('@media (prefers-reduced-motion: reduce)')[0]!;
    expect(baseBlock).not.toContain('animation: none;');
  });

  it('targets the spinning surface itself in the generated reduced-motion block', () => {
    const css = renderProtoStyleTokenCss(['animate-spin']);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(`[data-pui-style~="animate-spin"]`);
    expect(css).toContain('animation: none;');
  });

  it('resolves the currentColor border token', () => {
    const css = renderProtoStyleTokenCss(['border-current']);
    expect(css).toContain('border-color: currentColor;');
  });

  it('projects one four-side color token to the existing currentColor and open-edge declarations', () => {
    const token = 'border-[transparent_currentColor_currentColor_currentColor]';
    const css = renderProtoStyleTokenCss([token]);
    const selector = `:where([data-pui-style~="${token}"])`;
    expect(css).toContain(selector);
    expect(css).toContain('border-color: currentColor;');
    expect(css).toContain('border-top-color: transparent;');
    expect(css).not.toContain('border-color: transparent currentColor');
  });

  it('projects a circular ring without changing its stroke, size, or motion', () => {
    const css = renderProtoStyleTokenCss([
      'rounded-full',
      'border-2',
      'border-[transparent_currentColor_currentColor_currentColor]',
      'h-4',
      'w-4',
      'animate-spin',
    ]);
    expect(css).toContain('border-radius: 9999px;');
    expect(css).toContain('border-width: 2px;');
    expect(css).toContain('border-top-color: transparent;');
    expect(css).toContain('animation-duration: 1000ms;');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps pui-enter emission independent of pui-spin', () => {
    const css = renderProtoStyleTokenCss(['animate-spin']);
    expect(css).not.toContain('@keyframes pui-enter');
  });
});
