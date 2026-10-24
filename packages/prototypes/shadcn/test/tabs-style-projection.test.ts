import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  tabsRoot,
  tabsList,
  tabsTrigger,
  tabsContent,
  SHADCN_TABS_TEXT_DEFAULT_STYLES,
} from '../src/tabs';
import { styleScope } from '../src/style-scope';
import { styleContains } from '../../test-utils/style';
[styleScope, tabsRoot, tabsList, tabsTrigger, tabsContent].forEach((p) =>
  AdaptToWebComponent(p as any)
);
const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
function el(name: string, props: Record<string, unknown> = {}) {
  const node = document.createElement(name) as any;
  setElementProps(node, props);
  return node;
}
function make(style = 'nova', orientation = 'horizontal') {
  const scope = el('shadcn-style-scope', { styleProfile: style });
  const root = el('shadcn-tabs-root', { defaultValue: 'a', orientation, activationMode: 'manual' });
  const list = el('shadcn-tabs-list');
  const a = el('shadcn-tabs-trigger', { value: 'a' });
  const b = el('shadcn-tabs-trigger', { value: 'b' });
  const content = el('shadcn-tabs-content', { value: 'a', keepMounted: true });
  a.textContent = 'Account';
  b.textContent = 'Password';
  content.textContent = 'Panel';
  list.append(a, b);
  root.append(list, content);
  scope.append(root);
  document.body.append(scope);
  return { scope, root, list, a, b, content };
}
afterEach(async () => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  await flush();
});
describe('production Tabs source projection', () => {
  for (const style of ['new-york-v4', 'nova', 'rhea'])
    for (const orientation of ['horizontal', 'vertical'])
      for (const theme of ['light', 'dark']) {
        it(`${style}/${orientation}/${theme} text default surface`, async () => {
          document.documentElement.dataset.theme = theme;
          const { root, list, a, b, content } = make(style, orientation);
          await flush();
          expect(styleContains(root, 'flex-col')).toBe(orientation === 'horizontal');
          expect(
            styleContains(
              list,
              orientation === 'vertical' ? 'h-fit' : style === 'new-york-v4' ? 'h-9' : 'h-8'
            )
          ).toBe(true);
          expect(styleContains(list, style === 'rhea' ? 'rounded-2xl' : 'rounded-lg')).toBe(true);
          expect(styleContains(a, style === 'rhea' ? 'rounded-2xl' : 'rounded-md')).toBe(true);
          expect(
            styleContains(
              a,
              orientation === 'vertical' && style === 'rhea'
                ? 'px-3'
                : style === 'new-york-v4'
                  ? 'px-2'
                  : 'px-1.5'
            )
          ).toBe(true);
          expect(styleContains(a, style === 'new-york-v4' ? 'py-1' : 'py-0.5')).toBe(true);
          expect(styleContains(a, 'w-full')).toBe(orientation === 'vertical');
          expect(styleContains(a, 'shadow-sm')).toBe(style !== 'rhea');
          expect(styleContains(content, 'text-sm')).toBe(style !== 'new-york-v4');
          expect(styleContains(a, theme === 'dark' ? 'bg-input/30' : 'bg-background')).toBe(true);
          expect(
            styleContains(
              a,
              theme === 'dark' && style !== 'rhea' ? 'border-input' : 'border-transparent'
            )
          ).toBe(true);
          expect(
            styleContains(b, theme === 'dark' ? 'text-muted-foreground' : 'text-foreground/60')
          ).toBe(true);
          b.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
          await flush();
          expect(styleContains(b, 'text-foreground')).toBe(true);
          b.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
          await flush();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
          const matches = vi.spyOn(b, 'matches').mockReturnValue(true);
          b.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
          await flush();
          expect(styleContains(b, 'ring-3')).toBe(true);
          expect(styleContains(b, 'outline-1')).toBe(true);
          expect(styleContains(b, 'outline-none')).toBe(false);
          expect(styleContains(b, 'border-ring')).toBe(style !== 'rhea');
          b.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          matches.mockRestore();
          await flush();
          expect(styleContains(b, 'ring-3')).toBe(false);
          expect(styleContains(b, 'outline-1')).toBe(false);
          expect(styleContains(b, 'outline-none')).toBe(true);
          setElementProps(b, { value: 'b', disabled: true });
          await flush();
          expect(styleContains(b, 'pointer-events-none')).toBe(true);
          expect(styleContains(b, 'opacity-50')).toBe(true);
          b.click();
          await flush();
          expect(root.getExposes().value.get()).toBe('a');
          expect(a.getExposes().selected.get()).toBe(true);
        });
      }
  it('changes production paint without resetting value, handles, focus, user nodes or selection', async () => {
    const { scope, root, list, a, b, content } = make();
    await flush();
    b.click();
    b.focus();
    await flush();
    const value = root.getExposes().value,
      selected = b.getExposes().selected;
    const text = b.firstChild;
    const panelText = content.firstChild;
    const input = document.createElement('input');
    input.value = 'retained';
    content.append(input);
    input.setSelectionRange(1, 5);
    const selection = document.getSelection()!;
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 4);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.getRangeAt(0).endOffset).toBe(4);
    const focusOffsetBefore = selection.focusOffset;
    let changes = 0;
    const off = value.subscribe(() => changes++);
    changes = 0;
    for (const id of ['rhea', 'new-york-v4', 'nova', 'rhea', 'nova']) {
      setElementProps(scope, { styleProfile: id });
      await flush();
      expect(root.getExposes().value).toBe(value);
      expect(value.get()).toBe('b');
      expect(b.getExposes().selected).toBe(selected);
      expect(selected.get()).toBe(true);
      expect(document.activeElement).toBe(b);
      expect(b.firstChild).toBe(text);
      expect(content.firstChild).toBe(panelText);
      expect(input.value).toBe('retained');
      expect(input.selectionStart).toBe(1);
      expect(input.selectionEnd).toBe(5);
      expect(selection.anchorNode).toBe(text);
      expect(selection.anchorOffset).toBe(1);
      expect(selection.focusOffset).toBe(focusOffsetBefore);
      expect(selection.getRangeAt(0).startOffset).toBe(1);
      expect(selection.getRangeAt(0).endOffset).toBe(4);
      expect(styleContains(b, 'rounded-2xl')).toBe(id === 'rhea');
      expect(styleContains(b, 'rounded-md')).toBe(id !== 'rhea');
      expect(styleContains(list, 'h-9')).toBe(id === 'new-york-v4');
    }
    expect(changes).toBe(0);
    off();
  });
  it('shares root and list overrides but retains explicit leaf priority', async () => {
    const { scope, root, list, a, b } = make();
    await flush();
    setElementProps(root, { defaultValue: 'a', styleProfile: 'rhea' });
    await flush();
    expect(styleContains(a, 'rounded-2xl')).toBe(true);
    setElementProps(list, { styleProfile: 'new-york-v4' });
    await flush();
    expect(styleContains(a, 'px-2')).toBe(true);
    setElementProps(a, { value: 'a', styleProfile: 'nova' });
    setElementProps(scope, { styleProfile: 'rhea' });
    await flush();
    expect(styleContains(a, 'px-1.5')).toBe(true);
    expect(styleContains(b, 'px-2')).toBe(true);
    setElementProps(list, { styleProfile: 'inherit' });
    setElementProps(a, { value: 'a', styleProfile: 'inherit' });
    await flush();
    expect(styleContains(a, 'rounded-2xl')).toBe(true);
  });
  it('retains old Proto underline rather than aliasing upstream line', async () => {
    const { list, a } = make('new-york-v4');
    await flush();
    setElementProps(list, { appearance: 'underline' });
    setElementProps(a, { value: 'a', appearance: 'underline' });
    await flush();
    expect(styleContains(list, 'gap-6')).toBe(true);
    expect(styleContains(a, 'border-b-2')).toBe(true);
    expect(styleContains(a, 'border-foreground')).toBe(true);
    expect(styleContains(a, 'rounded-md')).toBe(false);
  });
  for (const unsupported of ['vega', 'maia', 'lyra', 'mira', 'luma', 'sera'])
    it(`rejects unprojected ${unsupported} rather than New York fallback`, async () => {
      const { a } = make();
      await flush();
      expect(() => setElementProps(a, { value: 'a', styleProfile: unsupported })).toThrow(
        'Unsupported style for this consumer'
      );
    });
  it('rejects unknown raw style even when enum coercion would conceal it', async () => {
    const { a } = make();
    await flush();
    expect(() => setElementProps(a, { value: 'a', styleProfile: 'future' })).toThrow(
      'Unknown style'
    );
  });
  it('rejects upstream line until owned decorative feedback exists', async () => {
    const { list } = make();
    await flush();
    expect(() => setElementProps(list, { variant: 'line' })).toThrow(
      'Unsupported upstream line variant'
    );
  });

  it('binds all inspected UI bytes and exact style statuses to the fixed source', () => {
    const dir = resolve('internal/fixtures/shadcn-tabs-style');
    const coverage = JSON.parse(readFileSync(resolve(dir, 'coverage.json'), 'utf8'));
    expect(SHADCN_TABS_TEXT_DEFAULT_STYLES).toEqual(['new-york-v4', 'nova', 'rhea']);
    expect(Object.isFrozen(SHADCN_TABS_TEXT_DEFAULT_STYLES)).toBe(true);
    expect(coverage.sourceCommit).toBe('3d98900e9b73c45f035f8109e9d41ba6a51685e7');
    expect(coverage.coverage.map((x: any) => x.style)).toEqual([
      'vega',
      'nova',
      'maia',
      'lyra',
      'mira',
      'luma',
      'sera',
      'rhea',
      'new-york-v4',
    ]);
    expect(
      coverage.coverage
        .filter((x: any) => x.status === 'projected-bounded-text-default')
        .map((x: any) => x.style)
    ).toEqual(['nova', 'rhea', 'new-york-v4']);
    for (const file of coverage.sources) {
      const bytes = readFileSync(resolve(dir, file.storagePath));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(
        file.gitBlob
      );
      expect(file.storagePath.endsWith('.txt')).toBe(true);
    }
    const cssDir = resolve('internal/fixtures/shadcn-style-source');
    const cssManifest = JSON.parse(readFileSync(resolve(cssDir, 'manifest.json'), 'utf8'));
    expect(cssManifest.revision).toBe(coverage.sourceCommit);
    for (const style of ['nova', 'rhea']) {
      const file = cssManifest.sources.find((x: any) => x.path.endsWith(`/style-${style}.css`));
      expect(file).toBeDefined();
      const bytes = readFileSync(resolve(cssDir, 'upstream', file.storagePath));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      const text = bytes.toString();
      expect(text).toContain('.cn-tabs-trigger');
      expect(text).toContain('px-1.5 py-0.5');
      expect(text).toContain(
        style === 'rhea'
          ? 'rounded-2xl border border-transparent!'
          : 'rounded-md border border-transparent'
      );
    }
  });
});
