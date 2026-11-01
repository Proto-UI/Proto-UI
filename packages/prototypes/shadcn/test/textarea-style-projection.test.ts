import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import textarea from '../src/textarea';
import { fieldTextarea, fieldRoot, fieldLabel, fieldDescription, fieldError } from '../src/field';
import { styleScope, type ShadcnStyleChoice } from '../src/style-scope';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { createRuntimeSession } from '@proto.ui/runtime';
for (const p of [
  textarea,
  fieldTextarea,
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  styleScope,
])
  AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};
const el = (name: string, props: Record<string, unknown> = {}) => {
  const n = document.createElement(name) as any;
  setElementProps(n, props);
  return n;
};
const tokens = (control: HTMLElement) =>
  control.querySelector('textarea')!.getAttribute('data-pui-style') ?? '';
afterEach(async () => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
  await flush();
});
describe('production shared Textarea paint', () => {
  it('uses nearest scope, explicit precedence and alias while keeping editor/state identity', async () => {
    const outer = el(styleScope.name, { styleProfile: 'rhea' }),
      inner = el(styleScope.name),
      control = el(textarea.name, { defaultValue: 'value', rows: 5 });
    inner.append(control);
    outer.append(inner);
    document.body.append(outer);
    await flush();
    const editor = control.querySelector('textarea') as HTMLTextAreaElement;
    const value = control.getExposes().value;
    const composing = control.getExposes().composing;
    expect(editor.value).toBe('value');
    editor.focus();
    editor.setSelectionRange(1, 4);
    editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await flush();
    expect(composing.get()).toBe(true);
    expect(tokens(control)).toContain('rounded-[var(--pui-radius-2xl)]');
    setElementProps(inner, { styleProfile: 'new-york' });
    await flush();
    expect(tokens(control)).toContain('rounded-md');
    expect(control.querySelector('textarea')).toBe(editor);
    expect(control.getExposes().value).toBe(value);
    expect(composing.get()).toBe(true);
    expect(editor.selectionStart).toBe(1);
    expect(editor.selectionEnd).toBe(4);
    expect(document.activeElement).toBe(editor);
    setElementProps(control, { styleProfile: 'rhea', rows: 5, defaultValue: 'value' });
    setElementProps(outer, { styleProfile: 'new-york' });
    await flush();
    expect(tokens(control)).toContain('rounded-[var(--pui-radius-2xl)]');
    setElementProps(control, { styleProfile: 'inherit', rows: 5, defaultValue: 'value' });
    await flush();
    expect(tokens(control)).toContain('rounded-md');
    expect(editor.value).toBe('value');
    expect(Number(editor.rows)).toBe(5);
  });
  it.each(
    ['light', 'dark'].flatMap((theme) =>
      ['rhea', 'new-york'].flatMap((style) =>
        ['normal', 'readonly', 'disabled'].map((mode) => ({ theme, style, mode }))
      )
    )
  )(
    'keeps Field invalid/focus color priority in $theme / $style / $mode',
    async ({ theme, style, mode }) => {
      document.documentElement.dataset.theme = theme;
      const scope = el(styleScope.name, { styleProfile: style }),
        field = el(fieldRoot.name, { invalid: false }),
        control = el(fieldTextarea.name, {
          defaultValue: 'keep',
          disabled: mode === 'disabled',
          readOnly: mode === 'readonly',
        }),
        label = el(fieldLabel.name),
        description = el(fieldDescription.name),
        error = el(fieldError.name);
      label.textContent = 'Message';
      description.textContent = 'Hint';
      field.append(label, description, control, error);
      scope.append(field);
      document.body.append(scope);
      await flush();
      const editor = control.querySelector('textarea') as HTMLTextAreaElement;
      const value = control.getExposes().value;
      const matches = editor.matches.bind(editor);
      vi.spyOn(editor, 'matches').mockImplementation(
        (selector) => selector === ':focus-visible' || matches(selector)
      );
      expect(editor.disabled).toBe(mode === 'disabled');
      expect(editor.readOnly).toBe(mode === 'readonly');
      expect(editor.getAttribute('aria-labelledby')).toBe(label.id);
      expect(editor.getAttribute('aria-describedby')).toContain(description.id);
      if (mode !== 'disabled') editor.focus();
      editor.setSelectionRange(1, 3);
      await flush();
      const focused = mode !== 'disabled';
      expect(control.getExposes().focusVisible.get()).toBe(focused);
      setElementProps(field, { invalid: true, errors: ['Invalid message'] });
      await flush();
      expect(editor.getAttribute('aria-invalid')).toBe('true');
      expect(tokens(control).split(/\s+/)).not.toContain(
        style === 'rhea' ? 'ring-ring/30' : 'ring-ring/50'
      );
      expect(tokens(control)).toContain(
        theme === 'dark' ? 'ring-destructive/40' : 'ring-destructive/20'
      );
      expect(tokens(control)).toContain(
        theme === 'dark' && style === 'rhea' ? 'border-destructive/50' : 'border-destructive'
      );
      expect(tokens(control).split(/\s+/).includes('ring-3')).toBe(style === 'rhea' || focused);
      expect(control.getExposes().value).toBe(value);
      expect(editor.value).toBe('keep');
      expect(editor.selectionStart).toBe(1);
      setElementProps(field, { invalid: false, errors: [] });
      await flush();
      expect(tokens(control)).not.toContain('ring-destructive');
      if (focused)
        expect(tokens(control)).toContain(style === 'rhea' ? 'ring-ring/30' : 'ring-ring/50');
      editor.blur();
      await flush();
      setElementProps(field, { invalid: true, errors: ['Invalid message'] });
      await flush();
      expect(control.getExposes().focusVisible.get()).toBe(false);
      expect(tokens(control)).not.toContain('ring-ring/');
      expect(tokens(control).split(/\s+/).includes('ring-3')).toBe(style === 'rhea');
      expect(editor.getAttribute('aria-describedby')).toContain(description.id);
    }
  );
  it('uses inherited focusVisible fact for Rhea focus ring without a second focus state', async () => {
    const c = el(textarea.name, { styleProfile: 'rhea' });
    document.body.append(c);
    await flush();
    const editor = c.querySelector('textarea') as HTMLTextAreaElement;
    const original = editor.matches.bind(editor);
    vi.spyOn(editor, 'matches').mockImplementation(
      (selector) => selector === ':focus-visible' || original(selector)
    );
    editor.focus();
    await flush();
    expect(c.getExposes().focusVisible.get()).toBe(true);
    expect(tokens(c)).toContain('border-ring');
    expect(tokens(c)).toContain('ring-ring/30');
    expect(tokens(c)).toContain('ring-3');
    editor.blur();
    await flush();
    expect(tokens(c)).not.toContain('ring-ring/30');
  });
  it('keeps absent-width-source fallback safe and rejects unsupported profiles', async () => {
    const session = createRuntimeSession(textarea, {
      prototypeName: textarea.name,
      getRawProps: () => ({ styleProfile: 'rhea' as const }),
      schedule: (fn) => fn(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        const token = new EventTarget();
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
        wiring.attach('event', [
          [EVENT_GLOBAL_TARGET_CAP, () => new EventTarget()],
          [EVENT_ROOT_TARGET_CAP, () => new EventTarget()],
        ]);
      },
    });
    await session.mount();
    expect(session.controller.getRuleStyleTokens()).not.toContain('text-sm');
    await session.dispose();
    expect(() =>
      createRuntimeSession(textarea, {
        prototypeName: textarea.name,
        getRawProps: () => ({ styleProfile: 'not-a-profile' as ShadcnStyleChoice }),
        schedule: (fn) => fn(),
        commit: (_children, signal) => signal?.done(),
        onRuntimeReady(wiring) {
          const token = new EventTarget();
          wiring.attach('context', [
            [CONTEXT_INSTANCE_TOKEN_CAP, token],
            [CONTEXT_PARENT_CAP, () => null],
          ]);
          wiring.attach('event', [
            [EVENT_GLOBAL_TARGET_CAP, () => new EventTarget()],
            [EVENT_ROOT_TARGET_CAP, () => new EventTarget()],
          ]);
        },
      })
    ).toThrow(/Unknown|Unsupported/);
  });
});
