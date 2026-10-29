import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import * as popover from '../src/popover';

// Independent oracle: shadcn-popover-command-density.presentation.v0.md;
// fixed Base + Nova c2a67849 button default, not an upstream Popover Close.
// Source-host evidence below is not browser geometry or hit-area evidence.
const sourceRoot = path.resolve('packages/prototypes/shadcn/src');
const commands = ['trigger', 'close'] as const;
const density = ['h-8', 'px-2.5', 'rounded-lg'];
const oldDensity = ['py-2', 'px-3', 'rounded-md'];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const prototype of Object.values(popover).filter(
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
function fixture() {
  const root = element(popover.popoverRoot.name, { a11yLabel: 'Settings' });
  const trigger = element(popover.popoverTrigger.name);
  const content = element(popover.popoverContent.name, { enterDuration: 0, leaveDuration: 0 });
  const title = element(popover.popoverTitle.name);
  const close = element(popover.popoverClose.name);
  trigger.textContent = 'Open Popover';
  title.textContent = 'Popover settings';
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

describe('Shadcn Popover command default Nova density', () => {
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
        expect(css).toContain('height: 2rem;');
        expect(css).toContain('padding-inline: 0.625rem;');
        expect(css).toContain('box-sizing: border-box;');
        expect(css).toContain('font-size: 0.875rem;');
        expect(css).toContain('line-height: 1.25rem;');
        expect(css).not.toContain('padding-block: 0.5rem;');
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

  it('keeps complete-family Document and Shadow closure without banning other components old utilities', async () => {
    const collected = await collectProtoStyleTokens(sourceRoot);
    const complete = collected.filter((token): token is string => typeof token === 'string');
    expect(complete).toHaveLength(collected.length);
    expect(complete).toEqual(expect.arrayContaining([...density, 'text-sm']));
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(complete);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('height: 2rem;');
      expect(css).toContain('padding-inline: 0.625rem;');
      expect(css).toContain('font-size: 0.875rem;');
      expect(css).toContain('line-height: 1.25rem;');
    }
  });
});
