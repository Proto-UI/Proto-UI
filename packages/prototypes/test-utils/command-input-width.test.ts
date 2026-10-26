import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn from '@proto.ui/prototypes-shadcn/command';
import * as brutalist from '@proto.ui/prototypes-brutalist/command';
import { collectProtoStyleTokensFromFiles } from '../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../cli/src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../../cli/src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../../cli/src/generated/brutalist-style-tokens';

// Bounded width regression, not complete upstream Command equivalence.
// Shadcn's fixed style-rhea.css blob 94bbca2a7f78845e7cfbcff68fb8f535e3848a98
// gives CommandInput w-full. Its other typography is outside this width repair.
// Brutalist has no claimed upstream Command: this is its own width robustness.
// Happy DOM checks transport and emitted CSS, never browser layout or pixels.
const families = [
  { name: 'shadcn', parts: shadcn, preset: SHADCN_STYLE_TOKENS },
  { name: 'brutalist', parts: brutalist, preset: BRUTALIST_STYLE_TOKENS },
] as const;
const widthTokens = ['min-w-0', 'w-full', 'grow'];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const { parts } of families) {
  for (const prototype of [parts.commandRoot, parts.commandInput, parts.commandContent]) {
    AdaptToWebComponent(prototype, {
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    });
  }
}
const flush = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
function element(name: string, props: Record<string, unknown> = {}) {
  const node = document.createElement(name);
  setElementProps(node, props);
  owned.add(node);
  return node;
}
function fixture(
  parts: (typeof families)[number]['parts'],
  rootProps: Record<string, unknown> = {},
  inputProps: Record<string, unknown> = {}
) {
  const root = element(parts.commandRoot.name, rootProps);
  const input = element(parts.commandInput.name, inputProps);
  const content = element(parts.commandContent.name);
  root.append(input, content);
  document.body.append(root);
  return { root, input };
}
function control(host: HTMLElement): HTMLInputElement {
  const controls = host.querySelectorAll<HTMLInputElement>('input');
  expect(controls).toHaveLength(1);
  return controls[0];
}
const tokensOf = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
function expectWidthCss(tokens: string[]) {
  for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
    const css = render(tokens);
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('[data-pui-style~="w-full"]');
    expect(css).toContain('width: 100%;');
    expect(css).toContain('min-width: 0px;');
    expect(css).toContain('flex-grow: 1;');
    expect(css).toContain('box-sizing: border-box;');
  }
}
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
});

describe.each(families)('$name CommandInput bounded width', ({ name, parts, preset }) => {
  it('owns full-width sizing while preserving flex growth and the shared input behavior', async () => {
    const file = path.resolve(`packages/prototypes/${name}/src/command/input.proto.ts`);
    const tokens = await collectProtoStyleTokensFromFiles([file]);
    expect(tokens).toEqual(expect.arrayContaining(widthTokens));
    const source = await readFile(file, 'utf8');
    expect(source.match(/asCommandInput\(\)/g)).toHaveLength(1);
    expect(source).not.toContain('@proto.ui/adapter-');
  });

  it('emits Document and Shadow width CSS from the public source host, rejecting missing w-full', async () => {
    const { input } = fixture(parts);
    await flush();
    const tokens = tokensOf(control(input));
    expect(tokens).toEqual(expect.arrayContaining(widthTokens));
    expectWidthCss(tokens);
    // Remove only the target token: unrelated family tokens cannot hide this regression.
    expect(() => expectWidthCss(tokens.filter((token) => token !== 'w-full'))).toThrow();
  });

  it('transports long root-owned values, input placeholders and repeated root disabled updates', async () => {
    const value = 'Find a workspace action without truncating the editable query '.repeat(4);
    const placeholder = 'Search all available commands, including long workspace action names';
    const { root, input } = fixture(
      parts,
      { defaultInputValue: value, disabled: true },
      { placeholder, name: 'workspace-search' }
    );
    await flush();
    const target = control(input);
    expect(target.value).toBe(value);
    expect(target.placeholder).toBe(placeholder);
    expect(target.name).toBe('workspace-search');
    expect(target.disabled).toBe(true);
    for (const disabled of [false, true, false, true]) {
      setElementProps(root, { disabled });
      await flush();
      expect(control(input)).toBe(target);
      expect(target.disabled).toBe(disabled);
      expect(target.value).toBe(value);
      expect(target.placeholder).toBe(placeholder);
      expect(target.hasAttribute('disabled')).toBe(disabled);
    }
    setElementProps(input, { placeholder: 'Updated search prompt', name: 'updated-search' });
    await flush();
    expect(control(input)).toBe(target);
    expect(target.placeholder).toBe('Updated search prompt');
    expect(target.name).toBe('updated-search');
    expect(target.value).toBe(value);
    expect(target.disabled).toBe(true);
  });

  it('preserves root-controlled value proposals and later owner updates on one physical editor', async () => {
    const { root, input } = fixture(parts, { inputValue: 'Owner query' });
    const requests: unknown[] = [];
    root.addEventListener('inputValueChange', (event) =>
      requests.push((event as CustomEvent).detail)
    );
    await flush();
    const target = control(input);
    expect(target.value).toBe('Owner query');
    target.value = 'Proposed query';
    target.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: 'Proposed query', inputType: 'insertText' })
    );
    await flush();
    expect(requests).toEqual([{ value: 'Proposed query', composing: false }]);
    expect(target.value).toBe('Owner query');
    setElementProps(root, { inputValue: 'Accepted query', disabled: true });
    await flush();
    expect(control(input)).toBe(target);
    expect(target.value).toBe('Accepted query');
    expect(target.disabled).toBe(true);
  });

  it('already closes width utilities through the generated family preset', () => {
    expect(preset).toEqual(expect.arrayContaining(widthTokens));
    expectWidthCss([...preset]);
  });
});
