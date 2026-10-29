import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import * as drawer from '../src/drawer';

// Independent oracle: shadcn-drawer-command-density.presentation.v0.md;
// Fixed New York Button default density; wrapping is an explicit opt-in adaptation.
// Preserve paint/state: this is not full upstream Button equivalence.
// Source-host evidence below is not browser geometry or hit-area evidence.
const sourceRoot = path.resolve('packages/prototypes/shadcn/src');
const commands = ['trigger', 'close'] as const;
const density = [
  'h-9',
  'px-4',
  'py-2',
  'rounded-md',
  'text-sm',
  'font-medium',
  'whitespace-nowrap',
];
const oldDensity = ['min-h-8', 'h-8', 'py-0', 'px-2.5', 'rounded-lg'];
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
  for (const part of commands) {
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
        expect(css).toContain('height: 2.25rem;');
        expect(css).toContain('padding-inline: 1rem;');
        expect(css).toContain('box-sizing: border-box;');
        expect(css).toContain('white-space: nowrap;');
        expect(tokens).not.toContain('min-h-9');
        expect(tokens).not.toContain('whitespace-normal');
        expect(css).toContain('font-weight: 500;');
        expect(css).toContain('font-size: 0.875rem;');
        expect(css).toContain('line-height: 1.25rem;');
        expect(css).toContain('padding-block: 0.5rem;');
      }
    });
  }

  it('changes to the explicit wrapping extension and back without fixed-height residue', async () => {
    const nodes = fixture();
    nodes.trigger.click();
    await flush();
    for (const part of ['trigger', 'close'] as const) {
      setElementProps(nodes[part], { wrap: true });
      await flush();
      const tokens = tokensOf(nodes[part]);
      expect(tokens).toEqual(
        expect.arrayContaining([
          'min-h-9',
          'px-4',
          'py-1',
          'whitespace-normal',
          'min-w-0',
          'max-w-full',
          'wrap-anywhere',
          'text-center',
        ])
      );
      for (const old of ['h-9', 'py-2', 'whitespace-nowrap']) expect(tokens).not.toContain(old);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('min-height: 2.25rem;');
        expect(css).toContain('padding-block: 0.25rem;');
      }
      setElementProps(nodes[part], { wrap: false });
      await flush();
      expect(tokensOf(nodes[part])).toContain('h-9');
      expect(tokensOf(nodes[part])).not.toContain('min-h-9');
    }
  });

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
      expect(nodes[part].getExposes().disabled.get()).toBe(true);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(tokensOf(nodes[part]));
        expect(css).toContain('opacity: 0.5;');
        expect(css).toContain('pointer-events: none;');
      }
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
      expect(css).toContain('height: 2.25rem;');
      expect(css).toContain('padding-inline: 1rem;');
      expect(css).toContain('font-size: 0.875rem;');
      expect(css).toContain('line-height: 1.25rem;');
    }
  });
});
