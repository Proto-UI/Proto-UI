import { it, expect, afterEach, vi } from 'vitest';
import { AdaptToWebComponent } from '../src/adapt';
import { configureTemplateStyle } from '../src/style';
import { commitChildren } from '../src/commit';
import { createRendererPrimitives, tw } from '@proto.ui/core';

it('template-props style(tw) uses the PUI carrier without a resolver', async () => {
  AdaptToWebComponent({
    name: 'x-tpl-tw',
    setup(_def) {
      return (renderer) => [renderer.el('span', { style: tw('text-red-500') }, ['x'])];
    },
  });

  const el = document.createElement('x-tpl-tw') as any;
  document.body.appendChild(el);
  await Promise.resolve();

  const span = el.querySelector('span') as HTMLSpanElement | null;
  expect(span).not.toBeNull();

  // The carrier works without a resolver; no inline style is synthesized.
  expect(span!.getAttribute('style')).toBeNull();
  expect(span!.getAttribute('data-pui-style')).toBe('text-red-500');
  expect(el.innerHTML).toBe('<span data-pui-style="text-red-500">x</span>');
  el.remove();
});

it('template-props rejects illegal keys (expose/attr channel must not exist in template)', async () => {
  AdaptToWebComponent({
    name: 'x-tpl-illegal-props',
    setup(_def) {
      return (renderer) => [
        // @ts-expect-error - template-props only allows { style?: TemplateStyleHandle }
        renderer.el('span', { id: 'x' }, ['x']),
      ];
    },
  });

  const el = document.createElement('x-tpl-illegal-props') as any;

  expect(() => {
    document.body.appendChild(el);
  }).toThrow();

  // cleanup in case it partially mounted (defensive)
  try {
    el.remove();
  } catch {}
});

it('template-props rejects non-TemplateStyleHandle style values', async () => {
  AdaptToWebComponent({
    name: 'x-tpl-illegal-style',
    setup(_def) {
      return (renderer) => [
        renderer.el(
          'span',
          {
            // @ts-expect-error - style must be TemplateStyleHandle
            style: 'color: red;',
          },
          ['x']
        ),
      ];
    },
  });

  const el = document.createElement('x-tpl-illegal-style') as any;

  expect(() => {
    document.body.appendChild(el);
  }).toThrow();

  // cleanup in case it partially mounted (defensive)
  try {
    el.remove();
  } catch {}
});

afterEach(() => configureTemplateStyle({}));

it('preserves the resolver original input, inline result, and fresh-node ownership', () => {
  const { el } = createRendererPrimitives();
  const resolver = vi.fn(() => 'padding: 3px; opacity: 0.8;');
  configureTemplateStyle({ tw: resolver });
  const root = document.createElement('div');
  root.setAttribute('data-pui-style', 'caller-root');
  commitChildren(root, el('span', { style: tw('p-2 p-4 opacity-25 opacity-50') }));
  const original = root.firstElementChild! as HTMLElement;
  expect(resolver).toHaveBeenCalledTimes(1);
  expect(resolver).toHaveBeenCalledWith('p-2 p-4 opacity-25 opacity-50');
  expect(original.getAttribute('data-pui-style')).toBe('p-4 opacity-50');
  expect(original.style.padding).toBe('3px');
  expect(original.style.opacity).toBe('0.8');
  expect(root.getAttribute('data-pui-style')).toBe('caller-root');

  configureTemplateStyle({});
  for (const props of [{ style: tw('') }, {}]) {
    commitChildren(root, el('span', props));
    expect(root.firstElementChild).not.toBe(original);
    expect(root.firstElementChild!.getAttribute('data-pui-style')).toBeNull();
    expect(root.firstElementChild!.getAttribute('style')).toBeNull();
  }
  commitChildren(root, null);
  expect(root.childNodes).toHaveLength(0);
  expect(root.getAttribute('data-pui-style')).toBe('caller-root');
});
