import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import * as popover from '../src/popover';

// Independent oracle: internal/contracts/overlay/shadcn-popover-title.presentation.v0.md
// and fixed Nova c2a67849 style-nova.css:925–944. Happy DOM is source-runtime
// evidence; actual default/custom inheritance belongs to the public browser suite.
const sourceRoot = path.resolve('packages/prototypes/shadcn/src');
const owned = new Set<HTMLElement>();
const lifecycle = { created: 0, disposed: 0 };

for (const prototype of [
  popover.popoverRoot,
  popover.popoverTrigger,
  popover.popoverContent,
  popover.popoverTitle,
  popover.popoverDescription,
  popover.popoverClose,
]) {
  AdaptToWebComponent(prototype, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lifecycle.created++;
        if (event.type === 'instance.dispose.done') lifecycle.disposed++;
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
  const root = element(popover.popoverRoot.name, {
    defaultOpen: true,
    a11yLabel: 'Fallback settings',
  });
  const trigger = element(popover.popoverTrigger.name);
  const content = element(popover.popoverContent.name, { enterDuration: 0, leaveDuration: 0 });
  const title = element(popover.popoverTitle.name);
  const description = element(popover.popoverDescription.name);
  const close = element(popover.popoverClose.name);
  title.textContent = 'Popover settings';
  description.textContent = 'Change the presentation.';
  trigger.textContent = 'Open';
  close.textContent = 'Close';
  content.append(title, description, close);
  root.append(trigger, content);
  document.body.append(root);
  return { root, trigger, content, title, description, close };
}

const tokens = (node: Element) =>
  (node.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);

afterEach(async () => {
  for (const node of owned) node.remove();
  owned.clear();
  await expect.poll(() => lifecycle.disposed).toBe(lifecycle.created);
});

describe('Shadcn Popover Title bounded Nova presentation', () => {
  it('projects the independent Title recipe through the actual source host', async () => {
    const { title, content } = fixture();
    await flush();
    expect(tokens(title)).toEqual(['font-medium']);
    expect(tokens(content)).toContain('text-sm');
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(tokens(title));
      expect(css).toContain('font-weight: 500;');
      expect(css).not.toContain('font-size:');
      expect(css).not.toContain('line-height:');
      expect(css).not.toContain('Unsupported Proto UI style tokens');
    }
  });

  it('keeps the live title name and ID relation across text replacement and remove/remount', async () => {
    const { title, content, description } = fixture();
    await flush();
    const originalId = title.id;
    expect(originalId).not.toBe('');
    expect(content.getAttribute('aria-labelledby')).toBe(originalId);
    expect(content.getAttribute('aria-describedby')).toBe(description.id);
    expect(title.hasAttribute('tabindex')).toBe(false);

    title.textContent = 'Updated settings';
    await flush();
    expect(title.id).toBe(originalId);
    expect(document.getElementById(content.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Updated settings'
    );

    title.remove();
    await flush();
    expect(content.getAttribute('aria-labelledby')).toBeNull();
    expect(content.getAttribute('aria-label')).toBe('Fallback settings');

    content.prepend(title);
    await flush();
    expect(title.id).toBe(originalId);
    expect(content.getAttribute('aria-labelledby')).toBe(originalId);
    expect(content.getAttribute('aria-label')).toBeNull();
    expect(tokens(title)).toEqual(['font-medium']);
  });

  it('retains naming and presentation after close and reopen without adding an owner', async () => {
    const { title, content, close, trigger } = fixture();
    await flush();
    const titleId = title.id;
    close.click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(content.getAttribute('aria-labelledby')).toBe(titleId);
    expect(tokens(title)).toEqual(['font-medium']);
  });

  it(
    'lowers the complete family input through Document and Shadow without losing the existing text scale',
    { timeout: 120000 },
    async () => {
    const collected = await collectProtoStyleTokens(sourceRoot);
    const complete = collected.filter((token): token is string => typeof token === 'string');
    expect(complete.length).toBe(collected.length);
    expect(complete).toContain('font-medium');
    expect(complete).toContain('text-sm');
    // Other components still own these tokens. This slice must not erase them.
    expect(complete).toContain('text-lg');
    expect(complete).toContain('font-semibold');
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(complete);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('font-weight: 500;');
      expect(css).toContain('font-size: 0.875rem;');
      expect(css).toContain('line-height: 1.25rem;');
    }
  });
});
