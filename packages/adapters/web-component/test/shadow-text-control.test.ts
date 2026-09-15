import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asTextControl, asFocusEntry } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { AdaptToWebComponent, setElementProps } from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import input from '../../../prototypes/base/src/input/root.proto';
import { ShadcnTextareaRoot as textarea } from '../../../prototypes/shadcn/src/textarea/root.proto';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';

let serial = 0;
const name = () => `s5-text-${++serial}`;
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const shadow = (tokens: string[] = []) =>
  ({
    mode: 'open',
    presentation: 'split',
    styleArtifact: renderProtoShadowSplitStyleArtifact(tokens),
  }) as const;
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('S5 native Shadow text surface', () => {
  it.each(['single', 'multiline'] as const)(
    'keeps an initially absent %s editor detached inside another ShadowRoot',
    async (lineMode) => {
      let run!: RunHandle<any>;
      let mounts = 0;
      const proto = definePrototype({
        name: name(),
        modules: [declareTextControl({ content: 'plain-text', engine: 'host', lineMode })],
        setup(def) {
          const control = asTextControl();
          def.lifecycle.onCreated((r) => {
            run = r;
            control.sync({ valueMode: 'uncontrolled', defaultValue: 'retained' });
            r.lifecycle.setPresent(false);
          });
          def.lifecycle.onMounted(() => {
            mounts++;
          });
          def.expose('show', () => run.lifecycle.setPresent(true));
          return () => null;
        },
      });
      const C = AdaptToWebComponent(proto, { shadow: shadow() });
      const outer = document.createElement('div');
      const outerRoot = outer.attachShadow({ mode: 'open' });
      const host = new C();
      outerRoot.append(host);
      document.body.append(outer);
      await flush();
      expect(mounts).toBe(0);
      expect(host.shadowRoot!.querySelector('input,textarea')).toBeNull();
      expect(host.shadowRoot!.querySelector('style')).not.toBeNull();
      (host.getExposes() as any).show();
      await flush();
      const editor = host.shadowRoot!.querySelector('input,textarea') as HTMLInputElement;
      expect(mounts).toBe(1);
      expect(editor.isConnected).toBe(true);
      expect(editor.value).toBe('retained');
      expect(editor.defaultValue).toBe('retained');
    }
  );
  it('refreshes entry fallback when an editor inside an open root changes eligibility', async () => {
    const panel = definePrototype({
      name: name(),
      setup() {
        asFocusEntry().configure({ strategy: 'descendant-first', fallback: 'self' });
        return (r) => r.slot();
      },
    });
    const Panel = AdaptToWebComponent(panel, { shadow: shadow() });
    const Input = AdaptToWebComponent(input, { registerAs: name(), shadow: shadow() });
    const parent = new Panel(),
      child = new Input();
    parent.append(child);
    document.body.append(parent);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
    await settle();
    expect(parent.hasAttribute('tabindex')).toBe(false);
    setElementProps(child, { disabled: true });
    child.update();
    await settle();
    expect(parent.tabIndex).toBe(0);
    setElementProps(child, { disabled: false });
    child.update();
    await settle();
    expect(parent.hasAttribute('tabindex')).toBe(false);
    const editor = child.shadowRoot!.querySelector('input')!;
    editor.remove();
    await settle();
    expect(parent.tabIndex).toBe(0);
    child.shadowRoot!.append(editor);
    await settle();
    expect(parent.hasAttribute('tabindex')).toBe(false);
    parent.remove();
    await settle();
    const previous = parent.getAttribute('tabindex');
    editor.disabled = true;
    await settle();
    expect(parent.getAttribute('tabindex')).toBe(previous);
  });
  it('rejects unsupported native dimensions without changing either target', async () => {
    let run!: RunHandle<any>;
    const proto = definePrototype({
      name: name(),
      modules: [declareTextControl({ content: 'plain-text', engine: 'host', lineMode: 'single' })],
      setup(def) {
        asTextControl();
        def.feedback.style.use(tw('w-full'));
        def.lifecycle.onCreated((r) => {
          run = r;
        });
        def.expose('invalid', () => run.feedback.style.patch(tw('w-1/2')));
        return () => null;
      },
    });
    const C = AdaptToWebComponent(proto, { shadow: shadow(['w-full', 'w-1/2']) });
    const host = new C();
    document.body.append(host);
    await flush();
    const before = host.shadowRoot!.innerHTML,
      rootStyle = host.getAttribute('data-pui-split-root-style');
    expect(() => (host.getExposes() as any).invalid()).toThrow(/native sizing/);
    expect(host.shadowRoot!.innerHTML).toBe(before);
    expect(host.getAttribute('data-pui-split-root-style')).toBe(rootStyle);
  });
  it.each(['single', 'multiline'] as const)(
    'retains one %s editor across commits and revokes its view lease',
    async (lineMode) => {
      let run!: RunHandle<any>;
      const values: string[] = [];
      const proto = definePrototype({
        name: name(),
        modules: [declareTextControl({ content: 'plain-text', engine: 'host', lineMode })],
        setup(def) {
          const control = asTextControl();
          control.on('input', (_run, event) => values.push(event.value));
          def.lifecycle.onCreated((r) => {
            run = r;
            control.sync({ valueMode: 'uncontrolled', defaultValue: 'initial' });
          });
          def.expose('view', {
            hide: () => run.lifecycle.setPresent(false),
            show: () => run.lifecycle.setPresent(true),
          });
          return () => null;
        },
      });
      const C = AdaptToWebComponent(proto, { shadow: shadow() });
      const host = new C();
      setElementProps(host, { surfaceClassName: 'owned', surfaceStyle: { color: 'red' } });
      document.body.append(host);
      await flush();
      const root = host.shadowRoot!;
      const editor = root.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea')!;
      const sheet = root.querySelector('style');
      expect(editor).not.toBeNull();
      expect(editor.parentNode).toBe(root);
      expect(editor.getAttribute('part')).toBe('control surface');
      expect(root.querySelector('div')).toBeNull();
      expect(editor.className).toBe('owned');
      editor.focus();
      editor.value = 'edited';
      editor.setSelectionRange(1, 3);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      host.update();
      await flush();
      expect(root.querySelector('input,textarea')).toBe(editor);
      expect(root.activeElement).toBe(editor);
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([1, 3]);
      expect(values).toEqual(['edited']);
      (host.getExposes() as any).view.hide();
      await flush();
      expect(editor.isConnected).toBe(false);
      expect(root.querySelector('style')).toBe(sheet);
      expect(editor.defaultValue).toBe('initial');
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      expect(values).toEqual(['edited']);
      (host.getExposes() as any).view.show();
      await flush();
      expect(root.querySelector('input,textarea')).toBe(editor);
      expect(editor.value).toBe('edited');
      editor.value = 'next';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      expect(values).toEqual(['edited', 'next']);
      host.remove();
      await flush();
      expect(root.childNodes).toHaveLength(0);
      expect(editor.className).toBe('');
      expect(editor.style.color).toBe('');
      document.body.append(host);
      await flush();
      expect(root.querySelectorAll('input,textarea')).toHaveLength(1);
      expect(root.querySelectorAll('style')).toHaveLength(1);
    }
  );

  it('rejects old companions before registration', () => {
    const profile = shadow();
    const stale = {
      ...profile,
      styleArtifact: {
        ...profile.styleArtifact,
        cssText: profile.styleArtifact.cssText.replace('--pui-split-native-text-recipe: l1;', ''),
      },
    };
    const tag = name();
    expect(() => AdaptToWebComponent(input, { registerAs: tag, shadow: stale })).toThrow(
      /native.*recipe/
    );
    expect(customElements.get(tag)).toBeUndefined();
  });

  it.each([false, true, 'split'] as const)(
    'keeps controlled native value, composition and a11y ownership (%s)',
    async (profile) => {
      const tokens = await collectProtoStyleTokens('packages/prototypes/shadcn/src/textarea');
      const C = AdaptToWebComponent(textarea, {
        registerAs: name(),
        shadow: profile === 'split' ? shadow(tokens as string[]) : profile,
      });
      const host = new C();
      const props = { value: 'accepted', ariaLabel: 'Notes', rows: 4, placeholder: 'Write' };
      setElementProps(host, props);
      document.body.append(host);
      await flush();
      const editor = (host.shadowRoot ?? host).querySelector('textarea')!;
      const proposals: string[] = [];
      host.addEventListener('valueChange', (e) => proposals.push((e as CustomEvent).detail.value));
      expect(editor.getAttribute('aria-label')).toBe('Notes');
      expect(host.getAttribute('role')).not.toBe('textbox');
      editor.value = 'rejected';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      await flush();
      expect(editor.value).toBe('accepted');
      expect(proposals).toEqual(['rejected']);
      editor.focus();
      editor.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true, composed: true })
      );
      editor.value = 'candidate';
      editor.setSelectionRange(2, 5);
      setElementProps(host, { ...props, placeholder: 'Updated' });
      host.update();
      await flush();
      expect(editor.value).toBe('candidate');
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 5]);
      editor.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, composed: true })
      );
      await flush();
      expect(editor.value).toBe('accepted');
      setElementProps(host, { ...props, disabled: true, readOnly: true });
      host.update();
      await flush();
      expect(editor.disabled).toBe(true);
      expect(editor.readOnly).toBe(true);
      expect(Number(editor.rows)).toBe(4);
    }
  );
});
