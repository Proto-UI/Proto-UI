import { describe, expect, it } from 'vitest';

import { renderPrefixedThemeCss, renderProtoStyleTokenCss } from '../src/services/proto-style-css';

describe('proto style css renderer', () => {
  it('gives Proto UI styled elements a scoped border-box baseline without a global reset', () => {
    const css = renderProtoStyleTokenCss(['h-6', 'w-11', 'border']);

    expect(css).toContain(
      `[data-pui-style],\n[data-pui-style]::before,\n[data-pui-style]::after {`
    );
    expect(css).toContain('box-sizing: border-box;');
    expect(css).not.toMatch(/(^|\n)\*\s*,/);
    expect(css).not.toMatch(/(^|\n)::before\s*,/);
    expect(css).not.toMatch(/(^|\n)::after\s*\{/);
  });

  it('renders space-between layout utilities used by compound controls', () => {
    const css = renderProtoStyleTokenCss(['flex', 'justify-between']);

    expect(css).toContain('display: flex;');
    expect(css).toContain('justify-content: space-between;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the vertical resize utility used by Brutalist Textarea', () => {
    const css = renderProtoStyleTokenCss(['resize-y']);

    expect(css).toContain('resize: vertical;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders intrinsic sizing and surface utilities used by Shadcn Tabs v4', () => {
    const css = renderProtoStyleTokenCss([
      'w-fit',
      'h-fit',
      'flex-1',
      'shadow-sm',
      'outline-1',
      'outline-ring',
    ]);

    expect(css).toContain('width: fit-content;');
    expect(css).toContain('height: fit-content;');
    expect(css).toContain('flex: 1 1 0%;');
    expect(css).toContain('--pui-shadow: 0 1px 3px 0');
    expect(css).toContain('outline-style: solid;');
    expect(css).toContain('outline-width: 1px;');
    expect(css).toContain('outline-color: var(--pui-ring);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders solid black surfaces and treats brutalist group markers as no-ops', () => {
    const css = renderProtoStyleTokenCss([
      'bg-black',
      'group/brutalist-button',
      'group/brutalist-toggle',
    ]);

    expect(css).toContain('[data-pui-style~="bg-black"]');
    expect(css).toContain('background-color: #000;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders the composed inset and outer hard shadows used by active Brutalist Toggle', () => {
    const css = renderProtoStyleTokenCss([
      'shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]',
      'shadow-[inset_0_0_0_2px_#000]',
    ]);

    expect(css).toContain('--pui-shadow: inset 0 0 0 2px #000, 3px 3px 0 0 #000;');
    expect(css).toContain('--pui-shadow: inset 0 0 0 2px #000;');
    expect(css).toContain(
      'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);'
    );
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders directional separator borders in the theme foreground', () => {
    const css = renderProtoStyleTokenCss(['border-b-2', 'border-t-2', 'border-foreground']);

    expect(css).toContain('border-bottom-width: 2px;');
    expect(css).toContain('border-top-width: 2px;');
    expect(css).toContain('border-color: var(--pui-foreground);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders internal negative data selector variants', () => {
    const css = renderProtoStyleTokenCss(['data-[hovered]:not-[data-active]:bg-muted']);

    expect(css).toContain(
      ':where([data-pui-style~="data-[hovered]:not-[data-active]:bg-muted"])[data-hovered]:not([data-active])'
    );
    expect(css).toContain('background-color: var(--pui-muted);');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('lets dark tokens follow the system preference when the host has no explicit theme', () => {
    const css = renderProtoStyleTokenCss(['dark:bg-input/30']);

    expect(css).toContain(':where(.dark)');
    expect(css).toContain(":where([data-theme='dark'])");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(
      ":where(:root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light']))"
    );
  });

  it('adds a system dark fallback to generated theme variables', () => {
    const css = renderPrefixedThemeCss(`:root {
  --background: white;
}

:root.dark,
:root[data-theme='dark'] {
  --background: black;
}`);

    expect(css).toContain('--pui-background: white;');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(
      ":root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light']) {"
    );
    expect(css).toContain('--pui-background: black;');
  });

  it('renders composable enter and exit animation utilities', () => {
    const css = renderProtoStyleTokenCss([
      'animate-in',
      'fade-in-0',
      'zoom-in-95',
      'animate-out',
      'fade-out-0',
      'zoom-out-95',
      'transition-none',
      'duration-200',
    ]);

    expect(css).toContain('@keyframes pui-enter');
    expect(css).toContain('@keyframes pui-exit');
    expect(css).toContain('animation-name: pui-enter;');
    expect(css).toContain('animation-name: pui-exit;');
    expect(css).toContain('--pui-enter-opacity: 0;');
    expect(css).toContain('--pui-exit-opacity: 0;');
    expect(css).toContain('--pui-enter-scale: 0.95;');
    expect(css).toContain('--pui-exit-scale: 0.95;');
    expect(css).toContain(
      'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-enter-scale, 1));'
    );
    expect(css).toContain(
      'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-exit-scale, 1));'
    );
    expect(css).not.toContain('scale: var(--pui-enter-scale');
    expect(css).toContain('--pui-animation-duration: 200ms;');
    expect(css).toContain('transition-property: none;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders state-driven spacing translations used by the Switch thumb', () => {
    const css = renderProtoStyleTokenCss([
      'translate-x-0',
      'data-[checked]:translate-x-[calc(100%_-_2px)]',
      'ring-offset-0',
    ]);

    expect(css).toContain('--pui-translate-x: 0px;');
    expect(css).toContain(
      ':where([data-pui-style~="data-[checked]:translate-x-[calc(100%_-_2px)]"])[data-checked]'
    );
    expect(css).toContain('--pui-translate-x: calc(100% - 2px);');
    expect(css).toContain('--pui-ring-offset-width: 0px;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });

  it('renders Hover Card positioning, popover, shadow, and directional motion utilities', () => {
    const css = renderProtoStyleTokenCss([
      'bg-popover',
      'text-popover-foreground',
      'w-64',
      'shadow-md',
      'bottom-full',
      'right-full',
      'mb-1',
      'translate-y-0',
      'slide-in-from-left-2',
      'slide-in-from-top-2',
    ]);

    expect(css).toContain('background-color: var(--pui-popover);');
    expect(css).toContain('color: var(--pui-popover-foreground);');
    expect(css).toContain('width: 16rem;');
    expect(css).toContain('bottom: 100%;');
    expect(css).toContain('right: 100%;');
    expect(css).toContain('margin-bottom: 0.25rem;');
    expect(css).toContain('--pui-shadow: 0 4px 6px -1px');
    expect(css).toContain('--pui-translate-x: -0.5rem;');
    expect(css).toContain('--pui-translate-y: -0.5rem;');
    expect(css).not.toContain('Unsupported Proto UI style tokens');
  });
});
