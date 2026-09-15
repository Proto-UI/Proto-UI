import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Message } from '@proto.ui/compositions-chatui/message';
import { CodeBlock } from '@proto.ui/compositions-chatui/code-block';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { createReactAdapter } from '../src/adapt';
import type { ReactAdapterHandle } from '../src/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('adapter-react: private Message composition', () => {
  it('preserves App content, identity, semantics, and retry ownership through streaming', async () => {
    const adapt = createReactAdapter(React);
    const Root = adapt(Message.Root);
    const Leading = adapt(Message.Leading);
    const Header = adapt(Message.Header);
    const Content = adapt(Message.Content);
    const Footer = adapt(Message.Footer);
    const Actions = adapt(Message.Actions);
    const CodeRoot = adapt(CodeBlock.Root);
    const CodeContent = adapt(CodeBlock.Content);
    const Button = adapt(brutalistButton);
    const assistantRef = React.createRef<ReactAdapterHandle<typeof Message.Root>>();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = createRoot(host);
    let retryCalls = 0;

    const renderTranscript = (text: string, compact: boolean) =>
      React.createElement(
        'section',
        { className: 'transcript' },
        React.createElement(
          'article',
          { 'aria-label': 'User message', role: 'article' },
          React.createElement(
            Root,
            { alignment: 'end', tone: 'user', className: 'user-root' },
            React.createElement(Header, null, 'You'),
            React.createElement(Content, { className: 'user-content' }, 'Show a code example.')
          )
        ),
        React.createElement(
          'article',
          { 'aria-label': 'Assistant reply', role: 'article' },
          React.createElement(
            Root,
            {
              ref: assistantRef,
              className: 'assistant-root',
              alignment: compact ? 'stretch' : 'start',
              tone: compact ? 'system' : 'assistant',
              spacing: compact ? 'compact' : 'default',
            },
            React.createElement(Leading, { className: 'message-leading' }, 'A'),
            React.createElement(Header, { className: 'message-header' }, 'Assistant'),
            React.createElement(
              Content,
              { className: 'assistant-content' },
              React.createElement('span', { className: 'streamed-text' }, text),
              React.createElement(
                CodeRoot,
                null,
                React.createElement(
                  CodeContent,
                  { className: 'code-content' },
                  'const answer = 42;'
                )
              )
            ),
            React.createElement(Footer, { className: 'message-footer' }, 'Just now'),
            React.createElement(Actions, { className: 'message-actions' }, 'App action label'),
            React.createElement(Actions, { className: 'message-actions' }, 'Another App action')
          )
        ),
        React.createElement(
          'article',
          { 'aria-label': 'Failed reply', role: 'article' },
          React.createElement(
            Root,
            { className: 'failed-root' },
            React.createElement(Header, null, 'Assistant'),
            React.createElement(Content, null, 'The request failed.'),
            React.createElement(
              Actions,
              null,
              React.createElement(
                Button,
                {
                  className: 'retry-button',
                  onClick: () => {
                    retryCalls += 1;
                  },
                },
                'Retry'
              )
            )
          )
        )
      );

    try {
      await act(async () => {
        app.render(renderTranscript('Here is', false));
        await Promise.resolve();
      });

      const transcript = host.querySelector('.transcript');
      const root = host.querySelector<HTMLElement>('.assistant-root');
      const content = host.querySelector<HTMLElement>('.assistant-content');
      const code = host.querySelector<HTMLElement>('.code-content');
      const retry = host.querySelector<HTMLElement>('.retry-button');
      expect(root).not.toBeNull();
      expect(content).not.toBeNull();
      expect(retry).not.toBeNull();
      expect(root?.parentElement?.getAttribute('role')).toBe('article');
      expect(root?.parentElement?.getAttribute('aria-label')).toBe('Assistant reply');
      expect(host.querySelector('.user-content')?.textContent).toBe('Show a code example.');
      expect(code?.textContent).toBe('const answer = 42;');
      expect(root?.querySelector('.message-leading')?.textContent).toBe('A');
      expect(root?.querySelector('.message-footer')?.textContent).toBe('Just now');
      expect(root?.querySelectorAll('.message-actions')).toHaveLength(2);
      expect(root?.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['me-auto', 'p-4', 'gap-3'])
      );
      expect(assistantRef.current?.getExposes()).toEqual({});
      expect(retryCalls).toBe(0);

      await act(async () => {
        app.render(renderTranscript('Here is the complete answer.', true));
        await Promise.resolve();
      });

      expect(host.querySelector('.transcript')).toBe(transcript);
      expect(host.querySelector('.assistant-root')).toBe(root);
      expect(host.querySelector('.assistant-content')).toBe(content);
      expect(host.querySelector('.code-content')).toBe(code);
      expect(content?.querySelector('.streamed-text')?.textContent).toBe(
        'Here is the complete answer.'
      );
      const tokens = root?.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
      expect(tokens).toEqual(expect.arrayContaining(['w-full', 'p-2', 'gap-2']));
      for (const token of ['me-auto', 'p-4', 'gap-3']) expect(tokens).not.toContain(token);
      for (const selector of [
        '.assistant-root',
        '.message-leading',
        '.message-header',
        '.assistant-content',
        '.message-footer',
        '.message-actions',
        '.failed-root',
      ]) {
        for (const part of host.querySelectorAll(selector)) {
          expect(part.hasAttribute('role')).toBe(false);
          expect(part.hasAttribute('aria-label')).toBe(false);
          expect(part.hasAttribute('aria-live')).toBe(false);
        }
      }
      expect(root?.parentElement?.getAttribute('aria-label')).toBe('Assistant reply');
      expect(assistantRef.current?.getExposes()).toEqual({});
      expect(retryCalls).toBe(0);

      await act(async () => {
        retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });
      expect(retryCalls).toBe(1);
    } finally {
      await act(async () => app.unmount());
      host.remove();
    }
  });
});
