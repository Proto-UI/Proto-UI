import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeSession } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleScope } from '../src/style-scope';
import { ShadcnCardRoot, ShadcnCardHeader, ShadcnCardContent, ShadcnCardFooter } from '../src/card';
import textarea from '../src/textarea';
for (const p of [
  styleScope,
  ShadcnCardRoot,
  ShadcnCardHeader,
  ShadcnCardContent,
  ShadcnCardFooter,
  textarea,
])
  AdaptToWebComponent(p as any);
const el = (name: string, props: any = {}) => {
  const e = document.createElement(name);
  setElementProps(e, props);
  return e;
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const tokens = (e: Element) => (e.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
});
describe('public passive Card style scope', () => {
  it.each([
    { styleProfile: 'nova' as const },
    { styleProfile: 'new-york' as const, size: 'sm' as const },
  ])('rejects unsupported style/density without silently projecting partial paint', (props) => {
    expect(() =>
      createRuntimeSession(ShadcnCardRoot, {
        prototypeName: ShadcnCardRoot.name,
        getRawProps: () => props,
        schedule: (fn) => fn(),
        commit: (_c, s) => s?.done(),
        onRuntimeReady(w) {
          const token = new EventTarget();
          w.attach('context', [
            [CONTEXT_INSTANCE_TOKEN_CAP, token],
            [CONTEXT_PARENT_CAP, () => null],
          ]);
        },
      })
    ).toThrow(/Unsupported style|supports only/);
  });

  it('inherits outer changes without locking the implicit root and keeps real child identity', async () => {
    const outer = el(styleScope.name, { styleProfile: 'rhea' }),
      root = el(ShadcnCardRoot.name),
      header = el(ShadcnCardHeader.name),
      content = el(ShadcnCardContent.name),
      footer = el(ShadcnCardFooter.name),
      control = el(textarea.name);
    const heading = document.createElement('h2'),
      anchor = document.createElement('a');
    heading.textContent = 'Title';
    anchor.href = '#native';
    anchor.textContent = 'Action';
    header.append(heading);
    content.append(control);
    footer.append(anchor);
    root.append(header, content, footer);
    outer.append(root);
    document.body.append(outer);
    await flush();
    const editor = control.querySelector('textarea')!;
    editor.value = 'kept';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'kept' }));
    editor.focus();
    editor.setSelectionRange(1, 3);
    await flush();
    expect(tokens(root)).toContain('py-5');
    expect(tokens(header)).toContain('px-5');
    expect(tokens(content)).toContain('px-5');
    expect(tokens(footer)).toContain('px-5');
    expect(tokens(editor)).toContain('resize-none');
    setElementProps(outer, { styleProfile: 'new-york' });
    await flush();
    expect(tokens(root)).toContain('py-6');
    expect(tokens(root)).toContain('border');
    expect(tokens(header)).toContain('px-6');
    expect(tokens(editor)).toContain('resize-y');
    expect(control.querySelector('textarea')).toBe(editor);
    expect(editor.value).toBe('kept');
    expect(editor.selectionStart).toBe(1);
    expect(editor.selectionEnd).toBe(3);
    expect(document.activeElement).toBe(editor);
    expect(header.firstChild).toBe(heading);
    expect(footer.firstChild).toBe(anchor);
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.tabIndex).toBe(-1);
    setElementProps(root, { styleProfile: 'rhea' });
    await flush();
    setElementProps(outer, { styleProfile: 'new-york' });
    await flush();
    expect(tokens(root)).toContain('py-5');
    expect(tokens(header)).toContain('px-5');
    expect(tokens(editor)).toContain('resize-none');
  });
  it('coordinates small spacing/dividers and restores default without touching descendants', async () => {
    const root = el(ShadcnCardRoot.name, { styleProfile: 'rhea', size: 'sm' }),
      header = el(ShadcnCardHeader.name, { divider: true }),
      content = el(ShadcnCardContent.name),
      footer = el(ShadcnCardFooter.name, { divider: true });
    root.append(header, content, footer);
    document.body.append(root);
    await flush();
    expect(tokens(root)).toContain('gap-4');
    expect(tokens(root)).toContain('py-4');
    for (const e of [header, content, footer]) expect(tokens(e)).toContain('px-4');
    expect(tokens(header)).toContain('pb-4');
    expect(tokens(footer)).toContain('pt-4');
    expect(tokens(header)).toContain('rounded-t-[min(var(--pui-radius-4xl),24px)]');
    setElementProps(root, { styleProfile: 'rhea', size: 'default' });
    await flush();
    for (const e of [header, content, footer]) expect(tokens(e)).toContain('px-5');
    expect(tokens(header)).toContain('pb-5');
    expect(tokens(footer)).toContain('pt-5');
    document.documentElement.dataset.theme = 'dark';
    await flush();
    expect(tokens(root)).toContain('ring-foreground/10');
    expect(tokens(root)).not.toContain('ring-foreground/5');
    setElementProps(header, { divider: false });
    setElementProps(footer, { divider: false });
    await flush();
    expect(tokens(header)).not.toContain('pb-5');
    expect(tokens(footer)).not.toContain('pt-5');
  });
  it('keeps nested explicit boundaries independent and standalone parts compatible', async () => {
    const outer = el(ShadcnCardRoot.name, { styleProfile: 'rhea', size: 'sm' }),
      inner = el(ShadcnCardRoot.name, { styleProfile: 'new-york' }),
      header = el(ShadcnCardHeader.name),
      standalone = el(ShadcnCardContent.name);
    inner.append(header);
    outer.append(inner);
    document.body.append(outer, standalone);
    await flush();
    expect(tokens(header)).toContain('px-6');
    expect(tokens(standalone)).toEqual(['px-6']);
    setElementProps(outer, { styleProfile: 'rhea' });
    await flush();
    expect(tokens(header)).toContain('px-6');
  });
});
