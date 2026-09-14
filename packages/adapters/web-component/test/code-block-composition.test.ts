import { describe, expect, it } from 'vitest';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { CodeBlock } from '../../../compositions/chatui/src/code-block';
import { AdaptToWebComponent, setElementProps } from '../src';
type ProtoElement = HTMLElement & {
  getExposes(): Record<string, unknown>;
  update(): void;
};

const CODE_SAMPLE = `function greet(name: string) {
  return \`hello ${'${name}'}\`;
}
${'x'.repeat(160)}`;

async function flushComposition(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('adapter-web-component: private CodeBlock composition', () => {
  it('mounts every part, preserves authored code, and leaves Button action App-owned', async () => {
    const tagByPart = {
      root: 'x-chatui-code-block-root-test',
      header: 'x-chatui-code-block-header-test',
      content: 'x-chatui-code-block-content-test',
      button: 'x-chatui-code-block-button-test',
    } as const;
    const registrations = [
      [tagByPart.root, CodeBlock.Root],
      [tagByPart.header, CodeBlock.Header],
      [tagByPart.content, CodeBlock.Content],
      [tagByPart.button, brutalistButton],
    ] as const;
    for (const [tag, prototype] of registrations) {
      if (!customElements.get(tag)) {
        customElements.define(
          tag,
          AdaptToWebComponent(prototype, { register: false, registerAs: tag })
        );
      }
    }

    const root = document.createElement(tagByPart.root) as ProtoElement;
    const header = document.createElement(tagByPart.header) as ProtoElement;
    const content = document.createElement(tagByPart.content) as ProtoElement;
    const button = document.createElement(tagByPart.button) as ProtoElement;
    const metadata = document.createElement('span');
    metadata.textContent = 'TypeScript · server.ts';
    button.textContent = 'Copy';
    content.textContent = CODE_SAMPLE;

    let actionCalls = 0;
    button.addEventListener('click', (event) => {
      if (event instanceof CustomEvent) actionCalls += 1;
    });
    header.append(metadata, button);
    root.append(header, content);
    document.body.appendChild(root);

    try {
      await flushComposition();

      expect(Array.from(root.children)).toEqual([header, content]);
      expect(Array.from(header.children)).toEqual([metadata, button]);
      expect(root.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-w-0', 'flex-col', 'rounded-lg'])
      );
      expect(header.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'items-center', 'justify-between'])
      );
      expect(content.textContent).toBe(CODE_SAMPLE);
      expect(content.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['whitespace-pre-wrap', 'wrap-anywhere'])
      );
      setElementProps(content, {
        code: 'shadow code',
        language: 'typescript',
        filename: 'server.ts',
        highlightedTokens: [{ text: 'shadow token' }],
        copy: true,
        clipboard: true,
        selection: true,
        scroll: true,
        role: 'code',
        a11yName: 'Shadow code block',
      });
      content.update();
      await flushComposition();
      expect(content.textContent).toBe(CODE_SAMPLE);
      expect(content.hasAttribute('role')).toBe(false);
      expect(content.hasAttribute('aria-label')).toBe(false);
      expect(content.getExposes()).toEqual({});
      expect(content.getAttribute('data-pui-style')).not.toMatch(/(?:overflow-x|scroll|nowrap)/);
      expect(root.getExposes()).toEqual({});
      expect(header.getExposes()).toEqual({});
      expect(content.getExposes()).toEqual({});

      root.update();
      header.update();
      content.update();
      await flushComposition();
      expect(actionCalls).toBe(0);

      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushComposition();
      expect(actionCalls).toBe(1);
    } finally {
      root.remove();
      await flushComposition();
    }
  });

  it('mounts distinct Root and Content parts when Header is omitted', async () => {
    const rootTag = 'x-chatui-code-block-root-headerless-test';
    const contentTag = 'x-chatui-code-block-content-headerless-test';
    if (!customElements.get(rootTag)) {
      customElements.define(
        rootTag,
        AdaptToWebComponent(CodeBlock.Root, { register: false, registerAs: rootTag })
      );
    }
    if (!customElements.get(contentTag)) {
      customElements.define(
        contentTag,
        AdaptToWebComponent(CodeBlock.Content, { register: false, registerAs: contentTag })
      );
    }

    const root = document.createElement(rootTag) as ProtoElement;
    const content = document.createElement(contentTag) as ProtoElement;
    content.textContent = '  const header = undefined;';
    root.appendChild(content);
    document.body.appendChild(root);

    try {
      await flushComposition();

      expect(Array.from(root.children)).toEqual([content]);
      expect(content.parentElement).toBe(root);
      expect(root.querySelectorAll('[data-pui-root]')).toHaveLength(1);
      expect(content.textContent).toBe('  const header = undefined;');
    } finally {
      root.remove();
      await flushComposition();
    }
  });
});
