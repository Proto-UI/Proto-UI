import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { inputRoot } from '@proto.ui/prototypes-base/input';
import shadcnInputRoot, { shadcnInputRoot as namedShadcnInputRoot } from '../src/input';
import type { ShadcnInputRootProps } from '../src/input';

type HasAsChild<Props> = 'asChild' extends keyof Props ? true : false;
type HasNativeType<Props> = 'type' extends keyof Props ? true : false;

AdaptToWebComponent(shadcnInputRoot);

const SURFACE_TOKENS = [
  'h-8',
  'w-full',
  'min-w-0',
  'rounded-lg',
  'border',
  'border-input',
  'bg-transparent',
  'px-2.5',
  'py-1',
  // At this host's >=768px viewport, the pinned Nova md:text-sm Rule replaces
  // the mobile text-base utility in the same semantic font-size group.
  'text-sm',
  'transition-colors',
  'outline-none',
  'selection:bg-primary',
  'selection:text-primary-foreground',
];

const WEB_STATE_TOKENS = [
  'data-[disabled]:pointer-events-none',
  'data-[disabled]:cursor-not-allowed',
  'data-[disabled]:opacity-50',
];

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function control(host: HTMLElement): HTMLInputElement {
  const element = host.querySelector<HTMLInputElement>('[part="control"]');
  if (!element) throw new Error('Base Input must materialize one host-owned control.');
  return element;
}

describe('prototypes/shadcn: input', () => {
  it('exposes the Root projection through the exact package entries', () => {
    // T-SHADCN-INPUT-0001-CASE-EXPORTS
    expect(namedShadcnInputRoot).toBe(shadcnInputRoot);
    expect(shadcnInputRoot.name).toBe('shadcn-input-root');
    expect(shadcnInputRoot.modules).toEqual(inputRoot.modules);
    expectTypeOf<HasAsChild<ShadcnInputRootProps>>().toEqualTypeOf<false>();
    expectTypeOf<HasNativeType<ShadcnInputRootProps>>().toEqualTypeOf<false>();
  });

  it('keeps the Base-owned single-line editor and text-control protocol', async () => {
    // T-SHADCN-INPUT-0001-CASE-EDITOR-OWNERSHIP
    const el = document.createElement('shadcn-input-root');
    const authored = document.createElement('div');
    authored.textContent = 'not another input surface';
    el.appendChild(authored);
    const valueChanges: Array<{ value: string; composing: boolean }> = [];
    el.addEventListener('valueChange', (event) => {
      valueChanges.push((event as CustomEvent<{ value: string; composing: boolean }>).detail);
    });
    setElementProps(el, { defaultValue: 'hello', placeholder: 'Your name', ariaLabel: 'Name' });
    document.body.appendChild(el);
    await flush();

    expect(el.contains(authored)).toBe(false);
    expect(el.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(1);
    expect(el.querySelectorAll('[part="control"]')).toHaveLength(1);
    const target = control(el);
    expect(target.type).toBe('text');
    expect(target.value).toBe('hello');
    expect(target.placeholder).toBe('Your name');
    expect(target.getAttribute('role')).toBe('textbox');
    expect(target.getAttribute('aria-label')).toBe('Name');

    const exposes = (el as HTMLElement & { getExposes(): Record<string, unknown> }).getExposes();
    for (const key of [
      'value',
      'disabled',
      'readOnly',
      'focused',
      'focusVisible',
      'composing',
      'focusSelf',
      'blurSelf',
    ]) {
      expect(exposes).toHaveProperty(key);
    }
    for (const key of ['invalid', 'submit', 'search', 'selectionStart', 'announce']) {
      expect(exposes).not.toHaveProperty(key);
    }

    setElementProps(el, { disabled: true, readOnly: true });
    await flush();
    expect(target.disabled).toBe(true);
    expect(target.readOnly).toBe(true);
    target.disabled = false;
    target.readOnly = false;
    target.value = 'next';
    target.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: 'x', inputType: 'insertText' })
    );
    expect(valueChanges).toEqual([
      { value: 'next', composing: false, data: 'x', inputType: 'insertText' },
    ]);
    el.remove();
  });

  it('projects the bounded single-line Shadcn field surface', async () => {
    // T-SHADCN-INPUT-0001-CASE-VISUAL-SURFACE
    const el = document.createElement('shadcn-input-root');
    document.body.appendChild(el);
    await flush();

    const target = control(el);
    for (const token of SURFACE_TOKENS) {
      expect(
        styleContains(target, token),
        `${token} :: ${target.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    for (const legacy of [
      'h-9',
      'rounded-md',
      'px-3',
      'shadow-xs',
      'transition-[color,box-shadow]',
    ]) {
      expect(styleContains(target, legacy), legacy).toBe(false);
    }
    el.remove();
  });

  it('lowers disabled affordance and applies profile-qualified focus paint at runtime', async () => {
    // T-SHADCN-INPUT-0001-CASE-STATE-PRESENTATION
    const el = document.createElement('shadcn-input-root');
    document.body.appendChild(el);
    await flush();

    const target = control(el);
    for (const token of WEB_STATE_TOKENS) {
      expect(
        styleContains(target, token),
        `${token} :: ${target.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    // The private profile selector keeps focus/theme palette Rules at runtime;
    // only the profile-independent disabled affordance lowers to Web tokens.
    const focusTokens = ['border-ring', 'ring-ring/50', 'ring-3'];
    for (const token of focusTokens) {
      expect(styleContains(target, token), `at rest ${token}`).toBe(false);
      expect(styleContains(target, `data-[focus-visible]:${token}`), token).toBe(false);
    }
    const matches = target.matches.bind(target);
    const matchesSpy = vi.spyOn(target, 'matches').mockImplementation(
      (selector) => selector === ':focus-visible' || matches(selector)
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    target.focus();
    await flush();
    for (const token of focusTokens) expect(styleContains(target, token), token).toBe(true);
    target.blur();
    await flush();
    for (const token of focusTokens) {
      expect(styleContains(target, token), `withdrawn ${token}`).toBe(false);
    }
    matchesSpy.mockRestore();
    el.remove();
  });

  it('emits base-nova geometry and the combined dark-disabled palette through the real CSS path', async () => {
    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'light';
    const el = document.createElement('shadcn-input-root');
    document.body.appendChild(el);
    await flush();
    const target = control(el);
    const tokens = (target.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('height: 2rem;');
    expect(css).toContain('padding-inline: 0.625rem;');
    // Style-gated palette rules apply bare tokens only while their full
    // condition holds. Check the live winning fill and its real CSS, including
    // dark+disabled precedence, rather than expecting static prefixed tokens.
    const expectPalette = (token: string, declaration: string) => {
      const liveTokens = (target.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
      expect(liveTokens).toContain(token);
      for (const other of ['bg-transparent', 'bg-input/30', 'bg-input/50', 'bg-input/80']) {
        if (other !== token) expect(liveTokens).not.toContain(other);
      }
      const liveCss = renderProtoStyleTokenCss(liveTokens);
      expect(liveCss).not.toContain('Unsupported Proto UI style tokens');
      expect(liveCss).toContain(declaration);
    };
    try {
      expectPalette('bg-transparent', 'background-color: transparent;');
      setElementProps(el, { disabled: true });
      await flush();
      expectPalette('bg-input/50', 'background-color: color-mix(in oklab, var(--pui-input) 50%, transparent);');
      document.documentElement.dataset.theme = 'dark';
      await vi.waitFor(() => expect(styleContains(target, 'bg-input/80')).toBe(true));
      expectPalette('bg-input/80', 'background-color: color-mix(in oklab, var(--pui-input) 80%, transparent);');
      setElementProps(el, { disabled: false });
      await flush();
      expectPalette('bg-input/30', 'background-color: color-mix(in oklab, var(--pui-input) 30%, transparent);');
      document.documentElement.dataset.theme = 'light';
      await vi.waitFor(() => expect(styleContains(target, 'bg-transparent')).toBe(true));
      expectPalette('bg-transparent', 'background-color: transparent;');

      // The same physical editor retains disabled ownership through repeated
      // prop updates; CSS output above is not a browser-computed color claim.
      for (const disabled of [true, false, true, false]) {
        setElementProps(el, { disabled });
        await flush();
        expect(control(el)).toBe(target);
        expect(target.disabled).toBe(disabled);
        expect(target.hasAttribute('data-disabled')).toBe(disabled);
        expect(el.querySelectorAll('[part="control"]')).toHaveLength(1);
      }
    } finally {
      el.remove();
      if (previousTheme === undefined) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = previousTheme;
    }
  });

  it('keeps the projection contentless and does not add unsupported public props', async () => {
    // T-SHADCN-INPUT-0001-CASE-CONTENTLESS
    const el = document.createElement('shadcn-input-root');
    const child = document.createElement('span');
    child.textContent = 'authored child';
    el.appendChild(child);
    document.body.appendChild(el);
    await flush();

    expect(el.contains(child)).toBe(false);
    expect(el.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(1);
    el.remove();
  });
});
