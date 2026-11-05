import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asTextareaRoot,
  type TextareaRootProps,
} from '../../../prototypes/base/src/textarea/root.proto';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { AdaptToWebComponent, setElementProps } from '../src';
import {
  SHADOW_SPLIT_ROOT_STYLE_ATTR as ROOT,
  SHADOW_SPLIT_SURFACE_ATTR as SURFACE,
} from '../src/shadow-split-effects';

// The private split projection paints through the compiled companion, so this
// binds the actual surfaced editor and the exact compiled target. jsdom cannot
// rasterize ::placeholder; native computed-color evidence stays a parent check.
const TOKENS = [
  'text-foreground',
  'placeholder:text-muted-foreground',
  'placeholder:text-destructive',
];
const hostSelector = (token: string) => `:host([${ROOT}~="${token}"])`;
const surfacePaint = (token: string) =>
  `${hostSelector(token)} > [${SURFACE}][data-pui-style~="${token}"]::placeholder`;
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};

describe('private Shadow split placeholder color on the actual editor', () => {
  it('admits placeholder paint on the surfaced editor and withdraws it', async () => {
    const artifact = renderProtoShadowSplitStyleArtifact([...TOKENS]);
    const proto = definePrototype<TextareaRootProps & { enabled?: boolean }>({
      name: 'test-wc-split-placeholder-color',
      modules: asTextareaRoot.modules,
      setup(def) {
        asTextareaRoot();
        def.props.define({ enabled: { type: 'boolean', default: false } });
        def.props.setDefaults({ defaultValue: '', placeholder: 'A hint' });
        def.feedback.style.use(tw('text-foreground'));
        def.rule({
          when: (w) => w.prop('enabled').eq(false),
          intent: (i) => i.feedback.style.use(tw('placeholder:text-muted-foreground')),
        });
        def.rule({
          when: (w) => w.prop('enabled').eq(true),
          intent: (i) => i.feedback.style.use(tw('placeholder:text-destructive')),
        });
        return () => null;
      },
    });
    const C = AdaptToWebComponent(proto, {
      shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact },
    });
    const el = new C();
    document.body.append(el);
    await flush();
    try {
      const editor = el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea');
      expect(editor).not.toBeNull();
      const textarea = editor!;
      expect(textarea.getAttribute(SURFACE)).toBe('');
      expect(el.getAttribute(ROOT)).toContain('placeholder:text-muted-foreground');
      expect(textarea.getAttribute('data-pui-style')).toContain(
        'placeholder:text-muted-foreground'
      );
      expect(textarea.getAttribute('data-pui-style')).toContain('text-foreground');
      expect(textarea.placeholder).toBe('A hint');

      // The compiled companion carries the paint on the surfaced editor only:
      // never a host wrapper rule and never a second target for the same token.
      for (const token of TOKENS.slice(1)) {
        expect(artifact.cssText).not.toContain(`${hostSelector(token)} {`);
        expect(artifact.cssText).toContain(`${surfacePaint(token)} {`);
      }

      textarea.value = 'kept text';
      textarea.dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: 'kept text' })
      );
      textarea.setSelectionRange(1, 4);

      setElementProps(el, { enabled: true });
      el.update();
      await flush();
      expect(el.shadowRoot!.querySelector('textarea')).toBe(textarea);
      expect(textarea.value).toBe('kept text');
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([1, 4]);
      expect(textarea.getAttribute('data-pui-style')).toContain('placeholder:text-destructive');
      expect(textarea.getAttribute('data-pui-style')).not.toContain(
        'placeholder:text-muted-foreground'
      );
      expect(el.getAttribute(ROOT)).toContain('placeholder:text-destructive');

      setElementProps(el, { enabled: false });
      el.update();
      await flush();
      expect(el.shadowRoot!.querySelector('textarea')).toBe(textarea);
      expect(textarea.value).toBe('kept text');
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([1, 4]);
      expect(textarea.getAttribute('data-pui-style')).toContain(
        'placeholder:text-muted-foreground'
      );
      expect(textarea.getAttribute('data-pui-style')).not.toContain('placeholder:text-destructive');
      // The retained projection still owns only the authored tokens.
      expect(textarea.getAttribute('data-pui-style')?.split(/\s+/)).toContain('text-foreground');
    } finally {
      el.remove();
      await flush();
    }
  });
});
