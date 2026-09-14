import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { CodeBlock } from '../../../compositions/chatui/src/code-block';
import { createReactAdapter } from '../src/adapt';

const CODE_SAMPLE = `function greet(name: string) {
  return \`hello ${'${name}'}\`;
}
${'x'.repeat(160)}`;
const UPDATED_CODE_SAMPLE = CODE_SAMPLE.replace('hello', 'welcome');

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('adapter-react: private CodeBlock composition', () => {
  it('mounts every part, preserves authored code, and does not invoke Button on rerender', async () => {
    const adapt = createReactAdapter(React);
    const Root = adapt(CodeBlock.Root);
    const Header = adapt(CodeBlock.Header);
    const Content = adapt(CodeBlock.Content);
    const Button = adapt(brutalistButton);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = createRoot(host);
    let actionCalls = 0;

    const renderCodeBlock = (code: string) =>
      React.createElement(
        Root,
        { className: 'cb-root' },
        React.createElement(
          Header,
          { className: 'cb-header' },
          React.createElement('span', null, 'TypeScript · server.ts'),
          React.createElement(
            Button,
            {
              className: 'cb-copy',
              onClick: () => {
                actionCalls += 1;
              },
            },
            'Copy'
          )
        ),
        React.createElement(Content, { className: 'cb-content' }, code)
      );

    try {
      await act(async () => {
        app.render(renderCodeBlock(CODE_SAMPLE));
        await Promise.resolve();
      });

      const root = host.querySelector<HTMLElement>('.cb-root');
      const header = host.querySelector<HTMLElement>('.cb-header');
      const content = host.querySelector<HTMLElement>('.cb-content');
      const button = host.querySelector<HTMLElement>('.cb-copy');
      expect(root).not.toBeNull();
      expect(header).not.toBeNull();
      expect(root?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'min-w-0', 'flex-col', 'rounded-lg'])
      );
      expect(header?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['flex', 'items-center', 'justify-between'])
      );
      expect(content?.textContent).toBe(CODE_SAMPLE);
      expect(content?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['whitespace-pre-wrap', 'wrap-anywhere'])
      );
      expect(button?.textContent).toBe('Copy');

      await act(async () => {
        app.render(renderCodeBlock(UPDATED_CODE_SAMPLE));
        await Promise.resolve();
      });
      expect(content?.textContent).toBe(UPDATED_CODE_SAMPLE);
      expect(actionCalls).toBe(0);

      await act(async () => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });
      expect(actionCalls).toBe(1);
    } finally {
      await act(async () => app.unmount());
      host.remove();
    }
  });
});
