import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  collectProtoStyleTokens,
  collectProtoStyleTokensFromFiles,
} from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import * as drawer from '../src/drawer';

// Independent oracle: shadcn-drawer-command-density.presentation.v0.md;
// Fixed consumer Button density; minimum-height/wrapping is an explicit project adaptation.
// Preserve paint/state: this is not full upstream Button equivalence.
// Source-host evidence below is not browser geometry or hit-area evidence.
const sourceRoot = path.resolve('packages/prototypes/shadcn/src');
const commands = [
  ['trigger', 'asDrawerTrigger'],
  ['close', 'asDrawerClose'],
] as const;
const density = [
  'min-h-8',
  'px-2.5',
  'py-0',
  'rounded-lg',
  'text-sm',
  'font-medium',
  'min-w-0',
  'max-w-full',
  'whitespace-normal',
  'wrap-anywhere',
  'text-center',
];
const oldDensity = ['h-8', 'py-2', 'px-3', 'rounded-md', 'whitespace-nowrap'];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const prototype of Object.values(drawer).filter(
  (value, index, all) => typeof value === 'object' && value !== null && all.indexOf(value) === index
)) {
  AdaptToWebComponent(prototype, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lives.created++;
        if (event.type === 'instance.dispose.done') lives.disposed++;
      },
    },
  });
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
function fixture(props: Record<string, unknown> = {}) {
  const root = element(drawer.drawerRoot.name, props);
  const trigger = element(drawer.drawerTrigger.name);
  const content = element(drawer.drawerContent.name, { enterDuration: 0, leaveDuration: 0 });
  const title = element(drawer.drawerTitle.name);
  const close = element(drawer.drawerClose.name);
  trigger.textContent = 'Open Drawer';
  title.textContent = 'Drawer settings';
  close.textContent = 'Close';
  content.append(title, close);
  root.append(trigger, content);
  document.body.append(root);
  const requests: unknown[] = [];
  root.addEventListener('openChange', (event) => requests.push((event as CustomEvent).detail));
  return { root, trigger, content, close, requests };
}
const tokensOf = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lives.disposed).toBe(lives.created);
});

describe('Shadcn Drawer command default density with bounded label wrapping', () => {
  for (const [part, hook] of commands) {
    it(`${part} owns default density without a second interaction behavior`, async () => {
      const file = path.join(sourceRoot, `drawer/${part}.proto.ts`);
      const tokens = await collectProtoStyleTokensFromFiles([file]);
      expect(tokens).toEqual(expect.arrayContaining(density));
      for (const old of oldDensity) expect(tokens).not.toContain(old);
      expect(tokens).toEqual(
        expect.arrayContaining([
          'inline-flex',
          'items-center',
          'justify-center',
          'border',
          'border-input',
          'bg-background',
          'text-sm',
          'font-medium',
          'outline-none',
          'ring-2',
          'ring-ring',
          'ring-offset-2',
          'opacity-50',
          'cursor-not-allowed',
        ])
      );
      const source = await readFile(file, 'utf8');
      expect(source.match(new RegExp(`${hook}\\(\\)`, 'g'))).toHaveLength(1);
      expect(source).not.toContain('asButton');
      expect(source).not.toContain("from '../style'");
      expect(
        tokens.some((token) => typeof token === 'string' && /^(shadow|translate|scale)/.test(token))
      ).toBe(false);
    });

    it(`${part} contributes executable Document and Shadow CSS through its real source host`, async () => {
      const nodes = fixture();
      nodes.trigger.click();
      await flush();
      const tokens = tokensOf(nodes[part]);
      expect(tokens).toEqual(expect.arrayContaining(density));
      for (const old of oldDensity) expect(tokens).not.toContain(old);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('min-height: 2rem;');
        expect(css).toContain('padding-inline: 0.625rem;');
        expect(css).toContain('box-sizing: border-box;');
        expect(css).toContain('white-space: normal;');
        expect(css).toContain('overflow-wrap: anywhere;');
        expect(css).toContain('text-align: center;');
        expect(css).toContain('max-width: 100%;');
        expect(css).toContain('min-width: 0px;');
        expect(css).toContain('font-weight: 500;');
        expect(css).toContain('font-size: 0.875rem;');
        expect(css).toContain('line-height: 1.25rem;');
        expect(css).toContain('padding-block: 0px;');
      }
    });
  }

  it('keeps one request per source-host command and the existing title relation', async () => {
    const nodes = fixture();
    await flush();
    nodes.trigger.click();
    await flush();
    expect(nodes.trigger.getAttribute('aria-expanded')).toBe('true');
    const titleId = nodes.content.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(nodes.requests).toEqual([
      { open: true, reason: 'trigger.press', focusReason: 'pointer' },
    ]);
    nodes.close.click();
    await flush();
    expect(nodes.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(nodes.requests).toEqual([
      { open: true, reason: 'trigger.press', focusReason: 'pointer' },
      { open: false, reason: 'close.press', focusReason: 'pointer' },
    ]);
    nodes.trigger.click();
    await flush();
    expect(nodes.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(nodes.content.getAttribute('aria-labelledby')).toBe(titleId);
    expect(nodes.requests).toHaveLength(3);
    for (const part of ['trigger', 'close'] as const)
      expect(tokensOf(nodes[part])).toEqual(expect.arrayContaining(density));
  });

  it('retains controlled refusal and disabled suppression on both real commands', async () => {
    const nodes = fixture({ open: true });
    await flush();
    nodes.close.click();
    await flush();
    expect(nodes.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(nodes.requests).toEqual([
      { open: false, reason: 'close.press', focusReason: 'pointer' },
    ]);
    setElementProps(nodes.root, { open: true, disabled: true });
    await flush();
    for (const part of ['trigger', 'close'] as const) {
      expect(nodes[part].getAttribute('aria-disabled')).toBe('true');
      expect(tokensOf(nodes[part])).toEqual(
        expect.arrayContaining(['data-[disabled]:opacity-50', 'data-[disabled]:cursor-not-allowed'])
      );
      nodes[part].click();
    }
    await flush();
    expect(nodes.requests).toHaveLength(1);
    expect(nodes.trigger.getAttribute('aria-expanded')).toBe('true');
    setElementProps(nodes.root, { open: false, disabled: false });
    await flush();
    expect(nodes.trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps complete-family Document and Shadow closure without banning other components old utilities', async () => {
    const collected = await collectProtoStyleTokens(sourceRoot);
    const complete = collected.filter((token): token is string => typeof token === 'string');
    expect(complete).toHaveLength(collected.length);
    expect(complete).toEqual(expect.arrayContaining([...density, 'text-sm']));
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(complete);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('min-height: 2rem;');
      expect(css).toContain('padding-inline: 0.625rem;');
      expect(css).toContain('font-size: 0.875rem;');
      expect(css).toContain('line-height: 1.25rem;');
    }
  });
});
