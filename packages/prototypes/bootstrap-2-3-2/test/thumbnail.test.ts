import { describe, expect, it } from 'vitest';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import type { Prototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import surface from '../src/surface';
import text from '../src/text';

function mount(prototype: Prototype<any, any>, rawProps: Record<string, unknown> = {}) {
  const host: RuntimeHost<any> = {
    prototypeName: prototype.name,
    getRawProps: () => rawProps,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
  };
  return executeWithHost(prototype, host);
}

describe('Bootstrap 2.3.2 passive Thumbnail and native action paint', () => {
  it('selects Thumbnail paint explicitly without changing neutral Surface defaults', async () => {
    const runtime = mount(surface, { variant: 'outline', elevation: 'raised' });
    const css = renderProtoStyleTokenCss(runtime.controller.getRuleStyleTokens());
    for (const declaration of [
      'border-color: #ddd',
      '0 1px 3px rgb(0 0 0 / 0.055)',
      'border-radius: 4px',
    ])
      expect(css).toContain(declaration);
    runtime.controller.applyRawProps({});
    expect(runtime.controller.getRuleStyleTokens()).toContain('border-border');
    expect(runtime.controller.getRuleStyleTokens()).not.toContain('border-[#ddd]');
    expect(runtime.controller.getRuleStyleTokens()).not.toContain(
      'shadow-[0_1px_3px_rgb(0_0_0/5.5%)]'
    );
    await runtime.invokeUnmounted();
  });

  it('preserves original slotted native semantics without an interactive root', async () => {
    const tag = 'wc-bootstrap-thumbnail-independent';
    if (!customElements.get(tag))
      customElements.define(
        tag,
        AdaptToWebComponent(surface, { register: false, registerAs: tag })
      );
    const host = document.createElement(tag);
    setElementProps(host, { variant: 'outline', elevation: 'raised' });
    const heading = document.createElement('h2');
    heading.textContent = 'Bootstrap 2.3.2';
    const link = document.createElement('a');
    link.href = '/bootstrap/';
    link.textContent = 'Explore';
    host.append(heading, link);
    document.body.append(host);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector('h2')).toBe(heading);
    expect(host.querySelector('a')).toBe(link);
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(host.querySelectorAll('a a,button,[role="button"]')).toHaveLength(0);
    host.remove();
  });

  it('shares classic primary paint while native observed press stays passive and stationary', async () => {
    const mounted = mount(surface, { variant: 'solid', elevation: 'raised' });
    const initial = mounted.controller.getRuleStyleTokens();
    expect(initial).toContain('bg-[linear-gradient(#08c,#04c)]');
    expect(initial).toContain('border');
    expect(initial).toContain(
      'shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
    );
    mounted.controller.applyRawProps({ variant: 'solid', elevation: 'raised', pressed: true });
    const pressed = mounted.controller.getRuleStyleTokens();
    expect(pressed).toContain('bg-[#04c]');
    expect(pressed).toContain('shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]');
    expect(pressed).not.toContain('translate-y-px');
    expect(pressed).not.toContain('shadow-none');
    mounted.controller.applyRawProps({});
    expect(mounted.controller.getRuleStyleTokens()).toContain('bg-background');
    expect(mounted.controller.getRuleStyleTokens()).not.toContain(
      'bg-[linear-gradient(#08c,#04c)]'
    );
    await mounted.invokeUnmounted();
  });

  it('keeps the 14/20 body and 24.5/40 thumbnail heading scale within family Text', async () => {
    for (const [props, expected] of [
      [
        { size: 'sm', leading: 'normal' },
        ['font-size: 0.875rem', 'line-height: 1.4285714285714286'],
      ],
      [{ size: '2xl', leading: 'relaxed' }, ['font-size: 1.53125rem', 'line-height: 2.5rem']],
    ] as const) {
      const runtime = mount(text, props);
      const css = renderProtoStyleTokenCss(runtime.controller.getRuleStyleTokens());
      for (const declaration of expected) expect(css).toContain(declaration);
      await runtime.invokeUnmounted();
    }
  });
});
