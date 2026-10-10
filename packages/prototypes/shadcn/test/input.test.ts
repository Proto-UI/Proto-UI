import { describe, expect, expectTypeOf, it } from 'vitest';
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
  'text-base',
  'transition-colors',
  'outline-none',
  'selection:bg-primary',
  'selection:text-primary-foreground',
];

const WEB_STATE_TOKENS = [
  'data-[focus-visible]:border-ring',
  'data-[focus-visible]:ring-ring/50',
  'data-[focus-visible]:ring-3',
  'data-[disabled]:pointer-events-none',
  'data-[disabled]:cursor-not-allowed',
  'data-[disabled]:opacity-50',
  'data-[disabled]:bg-input/50',
  'dark:data-[disabled]:bg-input/80',
  'dark:bg-input/30',
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

  it('lowers focus, disabled, and dark rules as conditional Web presentation', async () => {
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
    el.remove();
  });

  it('emits base-nova geometry and the combined dark-disabled palette through the real CSS path', async () => {
    const el = document.createElement('shadcn-input-root');
    document.body.appendChild(el);
    await flush();
    const target = control(el);
    const tokens = (target.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    const css = renderProtoStyleTokenCss(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('height: 2rem;');
    expect(css).toContain('padding-inline: 0.625rem;');
    expect(css).toContain('data-[disabled]:bg-input/50');
    expect(css).toContain('dark:data-[disabled]:bg-input/80');
    expect(css).toContain('dark:bg-input/30');
    expect(css).toContain('var(--pui-input) 80%, transparent');
    expect(css.indexOf('dark:data-[disabled]:bg-input/80')).toBeGreaterThan(
      css.indexOf('dark:bg-input/30')
    );

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
    el.remove();
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
