import { describe, expect, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import textareaRoot, { shadcnTextareaRoot } from '../src/textarea';

AdaptToWebComponent(textareaRoot);

const SURFACE_TOKENS = [
  'flex',
  'min-h-16',
  'w-full',
  'rounded-md',
  'border',
  'border-input',
  'bg-transparent',
  'px-3',
  'py-2',
  'text-base',
  'shadow-xs',
  'transition-[color,box-shadow]',
  'duration-150',
  'ease-in-out',
  'outline-none',
];

/**
 * Web-host lowering of the condition-driven rules, including the colorScheme
 * rule. `dark:bg-input/30` must be present as a static token: the selector form
 * is what makes a theme switch repaint, whereas a rule left on the default plan
 * samples the scheme once and goes stale. These tokens are evidence that
 * inherited state and host metadata reach the style projection; they are not a
 * portable guarantee of this projection.
 */
const WEB_STATE_TOKENS = [
  'data-[focused]:border-ring',
  'data-[focused]:ring-ring/50',
  'data-[focused]:ring-3',
  'data-[disabled]:cursor-not-allowed',
  'data-[disabled]:opacity-50',
  'dark:bg-input/30',
];

const UNSCOPED_STATE_TOKENS = [
  'border-ring',
  'ring-3',
  'cursor-not-allowed',
  'opacity-50',
  'bg-input/30',
];

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

/** Base owns the physical editor, so the projected surface lands on it. */
function control(host: HTMLElement): HTMLElement {
  const element = host.querySelector<HTMLElement>('[part="control"]');
  if (!element) throw new Error('Base Textarea must materialize one host-owned control.');
  return element;
}

describe('prototypes/shadcn: textarea', () => {
  it('exposes the Root projection through exact package entries', () => {
    // T-SHADCN-TEXTAREA-0001-CASE-EXPORTS
    expect(shadcnTextareaRoot).toBe(textareaRoot);
    expect(textareaRoot.name).toBe('shadcn-textarea-root');
  });

  it('materializes exactly one host-owned editor with inherited value and accessibility', async () => {
    // T-SHADCN-TEXTAREA-0001-CASE-EDITOR-OWNERSHIP
    const el = document.createElement('shadcn-textarea-root');
    document.body.appendChild(el);
    await flush();

    // Base owns exactly one physical editor; the projection adds none of its own.
    expect(el.querySelectorAll('textarea, input, [contenteditable]')).toHaveLength(1);
    expect(el.querySelectorAll('[part="control"]')).toHaveLength(1);
    expect(control(el).tagName).toBe('TEXTAREA');

    const exposes = (el as HTMLElement & { getExposes(): Record<string, unknown> }).getExposes();
    for (const key of ['value', 'disabled', 'readOnly', 'focused', 'focusVisible', 'composing']) {
      expect(exposes).toHaveProperty(key);
    }
    // The slice adds no validation, form, or announcement surface.
    for (const key of ['invalid', 'submit', 'announce']) {
      expect(exposes).not.toHaveProperty(key);
    }

    setElementProps(el, { defaultValue: 'protocol note', disabled: true });
    await flush();
    expect((exposes.disabled as { get(): boolean }).get()).toBe(true);

    el.remove();
  });

  it('projects the current field surface', async () => {
    // T-SHADCN-TEXTAREA-0001-CASE-SURFACE
    const el = document.createElement('shadcn-textarea-root');
    document.body.appendChild(el);
    await flush();

    const target = control(el);
    for (const token of SURFACE_TOKENS) {
      expect(
        styleContains(target, token),
        `${token} :: ${target.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    el.remove();
  });

  it('stays contentless and declares no second editing surface', async () => {
    // T-SHADCN-TEXTAREA-0001-CASE-CONTENTLESS
    const el = document.createElement('shadcn-textarea-root');
    const authored = document.createElement('div');
    authored.textContent = 'authored child';
    el.appendChild(authored);
    document.body.appendChild(el);
    await flush();

    expect(el.contains(authored)).toBe(false);
    el.remove();
  });

  it('lowers focus, disabled, and colorScheme rules to conditional web presentation', async () => {
    // T-SHADCN-TEXTAREA-0001-CASE-WEB-STATE-EVIDENCE
    const el = document.createElement('shadcn-textarea-root');
    document.body.appendChild(el);
    await flush();

    const target = control(el);
    for (const token of WEB_STATE_TOKENS) {
      expect(
        styleContains(target, token),
        `${token} :: ${target.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    // The conditional tokens must not also appear unscoped, which would apply
    // focus and disabled presentation at rest.
    for (const token of UNSCOPED_STATE_TOKENS) {
      expect(styleContains(target, token)).toBe(false);
    }
    el.remove();
  });
});
