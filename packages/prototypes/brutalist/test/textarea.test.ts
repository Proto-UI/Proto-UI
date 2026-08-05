import { describe, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { BrutalistTextareaRoot } from '../src/textarea';

type TextareaElement = WebComponentAdapterElement<typeof BrutalistTextareaRoot>;

AdaptToWebComponent(BrutalistTextareaRoot);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function physicalTextarea(element: TextareaElement): HTMLTextAreaElement {
  const target = element.querySelector('textarea');
  if (!(target instanceof HTMLTextAreaElement)) {
    throw new Error('Brutalist Textarea physical host is missing');
  }
  return target;
}

describe('prototypes/brutalist: textarea', () => {
  it('inherits Base Textarea behavior on one styled native multiline target', async () => {
    const element = document.createElement('brutalist-textarea-root') as TextareaElement;
    setElementProps(element, {
      defaultValue: 'Draft',
      placeholder: 'Message',
      rows: 5,
      ariaLabel: 'Message',
      disabled: true,
    });
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    expect(target.value).toBe('Draft');
    expect(target.defaultValue).toBe('Draft');
    expect(target.placeholder).toBe('Message');
    expect(Number(target.rows)).toBe(5);
    expect(target.disabled).toBe(true);
    expect(target.getAttribute('role')).toBe('textbox');
    expect(target.getAttribute('aria-label')).toBe('Message');
    expect(styleContains(target, 'block')).toBe(true);
    expect(styleContains(target, 'min-h-28')).toBe(true);
    expect(styleContains(target, 'w-full')).toBe(true);
    expect(styleContains(target, 'rounded-none')).toBe(true);
    expect(styleContains(target, 'resize-y')).toBe(true);
    expect(styleContains(target, 'border-2')).toBe(true);
    expect(styleContains(target, 'border-foreground')).toBe(true);
    expect(styleContains(target, 'bg-lavender')).toBe(true);
    expect(styleContains(target, 'text-lavender-foreground')).toBe(true);
    expect(styleContains(target, 'p-3')).toBe(true);
    expect(styleContains(target, 'font-mono')).toBe(true);
    expect(styleContains(target, 'text-sm')).toBe(true);
    expect(styleContains(target, 'leading-6')).toBe(true);
    expect(styleContains(target, 'shadow-[3px_3px_0_0_var(--pui-foreground)]')).toBe(true);
    expect(styleContains(target, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(styleContains(target, 'data-[focus-visible]:ring-ring')).toBe(true);
    expect(styleContains(target, 'data-[disabled]:cursor-not-allowed')).toBe(true);
    expect(styleContains(target, 'data-[disabled]:opacity-50')).toBe(true);
    expect(target.children).toHaveLength(0);
    element.remove();
  });

  it('keeps uncontrolled edits and emits the Base valueChange protocol', async () => {
    const element = document.createElement('brutalist-textarea-root') as TextareaElement;
    const values: string[] = [];
    element.addEventListener('valueChange', (event: Event) => {
      values.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    target.value = 'one\ntwo';
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak' }));

    expect(values).toEqual(['one\ntwo']);
    expect(element.getExposes().value.get()).toBe('one\ntwo');
    element.remove();
  });

  it('projects state selector context onto the styled textarea surface', async () => {
    const element = document.createElement('brutalist-textarea-root') as TextareaElement;
    setElementProps(element, {
      disabled: true,
      readOnly: true,
    });
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    expect(element.hasAttribute('data-disabled')).toBe(true);
    expect(element.hasAttribute('data-read-only')).toBe(true);
    expect(target.hasAttribute('data-disabled')).toBe(true);
    expect(target.hasAttribute('data-read-only')).toBe(true);
    expect(target.hasAttribute('data-pui-root')).toBe(false);
    expect(styleContains(target, 'data-[disabled]:opacity-50')).toBe(true);

    setElementProps(element, {
      disabled: false,
      readOnly: false,
    });
    element.update();
    await flush();

    expect(element.hasAttribute('data-disabled')).toBe(false);
    expect(element.hasAttribute('data-read-only')).toBe(false);
    expect(target.hasAttribute('data-disabled')).toBe(false);
    expect(target.hasAttribute('data-read-only')).toBe(false);

    element.remove();
  });
});
