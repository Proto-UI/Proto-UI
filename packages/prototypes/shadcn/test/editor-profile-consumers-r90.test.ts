import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import input from '../src/input';
import textarea from '../src/textarea';
import {
  fieldRoot,
  fieldControl,
  fieldTextarea,
  fieldLabel,
  fieldDescription,
  fieldError,
} from '../src/field';
import { styleScope } from '../src/style-scope';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

AdaptToWebComponent(input);
AdaptToWebComponent(textarea);
AdaptToWebComponent(fieldRoot);
AdaptToWebComponent(fieldControl);
AdaptToWebComponent(fieldTextarea);
AdaptToWebComponent(fieldLabel);
AdaptToWebComponent(fieldDescription);
AdaptToWebComponent(fieldError);
AdaptToWebComponent(styleScope);
type EditorConsumer = { value: { get(): string }; composing: { get(): boolean } };
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const element = <Exposes = never>(name: string, props: Record<string, unknown> = {}) => {
  // These custom elements are registered above with the real Adapter.
  const node = document.createElement(name) as HTMLElement & { getExposes(): Exposes };
  setElementProps(node, props);
  return node;
};
const tokens = (node: Element) => (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  await flush();
});

// Independent source cases, exercised through real editor owners rather than a copied export list.
const sourceCases = [
  {
    profile: 'vega',
    inputSize: 'h-9',
    inputRadius: 'rounded-md',
    textareaRadius: 'rounded-md',
    padding: 'px-2.5',
  },
  {
    profile: 'nova',
    inputSize: 'h-8',
    inputRadius: 'rounded-lg',
    textareaRadius: 'rounded-lg',
    padding: 'px-2.5',
  },
  {
    profile: 'maia',
    inputSize: 'h-9',
    inputRadius: 'rounded-[var(--pui-radius-4xl)]',
    textareaRadius: 'rounded-xl',
    padding: 'px-3',
  },
  {
    profile: 'lyra',
    inputSize: 'h-8',
    inputRadius: 'rounded-none',
    textareaRadius: 'rounded-none',
    padding: 'px-2.5',
  },
  {
    profile: 'mira',
    inputSize: 'h-7',
    inputRadius: 'rounded-md',
    textareaRadius: 'rounded-md',
    padding: 'px-2',
  },
  {
    profile: 'luma',
    inputSize: 'h-9',
    inputRadius: 'rounded-[var(--pui-radius-3xl)]',
    textareaRadius: 'rounded-[var(--pui-radius-2xl)]',
    padding: 'px-3',
  },
  {
    profile: 'sera',
    inputSize: 'h-10',
    inputRadius: 'rounded-none',
    textareaRadius: 'rounded-none',
    padding: 'px-0',
  },
  {
    profile: 'rhea',
    inputSize: 'h-8',
    inputRadius: 'rounded-[var(--pui-radius-2xl)]',
    textareaRadius: 'rounded-[var(--pui-radius-2xl)]',
    padding: 'px-2.5',
  },
  {
    profile: 'new-york-v4',
    inputSize: 'h-9',
    inputRadius: 'rounded-md',
    textareaRadius: 'rounded-md',
    padding: 'px-3',
  },
];

describe('source-bound editor profile consumers', () => {
  it.each(sourceCases)(
    '$profile paints both real Base editors without changing their owner',
    async (source) => {
      const scope = element(styleScope.name, { styleProfile: source.profile });
      const single = element<EditorConsumer>(input.name, {
        defaultValue: 'single',
        ariaLabel: 'Name',
      });
      const multi = element<EditorConsumer>(textarea.name, { defaultValue: 'multi', rows: 4 });
      scope.append(single, multi);
      document.body.append(scope);
      await flush();
      const one = single.querySelector('input')!;
      const many = multi.querySelector('textarea')!;
      expect(scope.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(2);
      expect(one.value).toBe('single');
      expect(many.value).toBe('multi');
      expect(tokens(one)).toEqual(
        expect.arrayContaining([source.inputSize, source.inputRadius, source.padding])
      );
      expect(tokens(many)).toEqual(
        expect.arrayContaining(['min-h-16', source.textareaRadius, source.padding])
      );
      expect(single.getExposes()).not.toHaveProperty('invalid');
      expect(multi.getExposes()).not.toHaveProperty('invalid');
      setElementProps(scope, { styleProfile: 'lyra' });
      await flush();
      expect(single.querySelector('input')).toBe(one);
      expect(multi.querySelector('textarea')).toBe(many);
      expect(tokens(one)).toContain('rounded-none');
      expect(tokens(many)).toContain('rounded-none');
      if (source.inputRadius !== 'rounded-none')
        expect(tokens(one)).not.toContain(source.inputRadius);
      if (source.textareaRadius !== 'rounded-none')
        expect(tokens(many)).not.toContain(source.textareaRadius);
    }
  );

  it.each([input, textarea])(
    'keeps $name composition, selection and controlled refusal across raw style removal',
    async (proto) => {
      const scope = element(styleScope.name, { styleProfile: 'mira' });
      const inner = element(styleScope.name);
      const host = element<EditorConsumer>(proto.name, { value: 'owner', styleProfile: 'maia' });
      inner.append(host);
      scope.append(inner);
      document.body.append(scope);
      await flush();
      const editor = host.querySelector('input, textarea') as
        | HTMLInputElement
        | HTMLTextAreaElement;
      const value = host.getExposes().value;
      const composing = host.getExposes().composing;
      const requests: Array<{ value: string; composing: boolean }> = [];
      host.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
      editor.focus();
      editor.setSelectionRange(1, 4);
      editor.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true, composed: true })
      );
      await flush();
      expect(composing.get()).toBe(true);
      // setElementProps replaces raw props: absence must reveal the scope, not retain stale Maia.
      setElementProps(host, { value: 'owner' });
      await flush();
      expect(tokens(editor)).toContain('px-2');
      expect(tokens(editor)).not.toContain('px-3');
      expect(host.querySelector('input, textarea')).toBe(editor);
      expect(host.getExposes().value).toBe(value);
      expect(host.getExposes().composing).toBe(composing);
      expect(composing.get()).toBe(true);
      expect(editor.selectionStart).toBe(1);
      expect(editor.selectionEnd).toBe(4);
      expect(document.activeElement).toBe(editor);
      editor.value = 'proposed';
      editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: 'd', isComposing: true })
      );
      await flush();
      expect(requests.at(-1)?.value).toBe('proposed');
      expect(value.get()).toBe('owner');
      expect(editor.value).toBe('proposed');
      editor.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, composed: true })
      );
      await flush();
      expect(editor.value).toBe('owner');
      setElementProps(host, { value: 'accepted', styleProfile: 'new-york' });
      await flush();
      expect(editor.value).toBe('accepted');
      expect(tokens(editor)).toContain('px-3');
      expect(composing.get()).toBe(false);
      setElementProps(host, { value: 'accepted', styleProfile: 'inherit' });
      await flush();
      expect(tokens(editor)).toContain('px-2');
    }
  );

  it.each([fieldControl, fieldTextarea])(
    'preserves $name Field policy, validation and relationships through Sera withdrawal',
    async (proto) => {
      document.documentElement.dataset.theme = 'dark';
      const scope = element(styleScope.name, { styleProfile: 'sera' });
      const field = element(fieldRoot.name, {
        invalid: true,
        errors: ['Explain the invalid value'],
        readOnly: true,
      });
      const label = element(fieldLabel.name);
      const description = element(fieldDescription.name);
      const error = element(fieldError.name);
      const control = element<EditorConsumer>(proto.name, { defaultValue: 'unchanged' });
      label.textContent = 'Message';
      description.textContent = 'Use a meaningful value';
      field.append(label, description, control, error);
      scope.append(field);
      document.body.append(scope);
      await flush();
      const editor = control.querySelector('input, textarea') as
        | HTMLInputElement
        | HTMLTextAreaElement;
      const value = control.getExposes().value;
      expect(editor.value).toBe('unchanged');
      expect(editor.readOnly).toBe(true);
      expect(editor.getAttribute('aria-invalid')).toBe('true');
      expect(editor.getAttribute('aria-labelledby')).toBe(label.id);
      expect(editor.getAttribute('aria-describedby')).toContain(description.id);
      expect(error.textContent).toContain('Explain the invalid value');
      // Pinned Sera .cn-input/.cn-textarea dark invalid borders are 50%,
      // not the opaque light border. Observe declarations on this real editor.
      expect(renderProtoStyleTokenCss(tokens(editor))).toContain(
        'border-bottom-color: color-mix(in oklab, var(--pui-destructive) 50%, transparent);'
      );
      setElementProps(scope, { styleProfile: 'maia' });
      setElementProps(field, { invalid: false, disabled: true });
      await flush();
      expect(control.querySelector('input, textarea')).toBe(editor);
      expect(control.getExposes().value).toBe(value);
      expect(editor.disabled).toBe(true);
      expect(editor.readOnly).toBe(false);
      expect(editor.getAttribute('aria-invalid')).not.toBe('true');
      expect(tokens(editor)).not.toContain('border-b-input');
      expect(tokens(editor)).not.toContain('transition-[color,border-color]');
      expect(editor.value).toBe('unchanged');
      setElementProps(field, {});
      await flush();
      expect(editor.disabled).toBe(false);
      expect(editor.value).toBe('unchanged');
    }
  );

  it('keeps optional Field Textarea independent when there is no Field ancestor', async () => {
    const host = element<EditorConsumer & { invalid: { get(): boolean } }>(fieldTextarea.name, {
      defaultValue: 'outside',
      ariaLabel: 'Standalone semantic composition',
      styleProfile: 'luma',
    });
    document.body.append(host);
    await flush();
    const editor = host.querySelector('textarea')!;
    expect(editor.value).toBe('outside');
    expect(host.getExposes().invalid.get()).toBe(false);
    expect(editor.getAttribute('aria-label')).toBe('Standalone semantic composition');
    expect(host.querySelectorAll('textarea, input, [contenteditable]')).toHaveLength(1);
  });
});
