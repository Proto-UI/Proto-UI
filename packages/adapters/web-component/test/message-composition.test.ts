import { describe, expect, it } from 'vitest';
import { Message } from '@proto.ui/compositions-chatui/message';
import { CodeBlock } from '@proto.ui/compositions-chatui/code-block';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { AdaptToWebComponent, setElementProps } from '../src';

async function flushComposition(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('adapter-web-component: private Message composition', () => {
  it('preserves App content, identity, semantics, and retry ownership through streaming', async () => {
    const Root = AdaptToWebComponent(Message.Root, { registerAs: 'x-message-root-test' });
    const Leading = AdaptToWebComponent(Message.Leading, { registerAs: 'x-message-leading-test' });
    const Header = AdaptToWebComponent(Message.Header, { registerAs: 'x-message-header-test' });
    const Content = AdaptToWebComponent(Message.Content, { registerAs: 'x-message-content-test' });
    const Footer = AdaptToWebComponent(Message.Footer, { registerAs: 'x-message-footer-test' });
    const Actions = AdaptToWebComponent(Message.Actions, { registerAs: 'x-message-actions-test' });
    const CodeRoot = AdaptToWebComponent(CodeBlock.Root, {
      registerAs: 'x-message-code-root-test',
    });
    const CodeContent = AdaptToWebComponent(CodeBlock.Content, {
      registerAs: 'x-message-code-content-test',
    });
    const Button = AdaptToWebComponent(brutalistButton, { registerAs: 'x-message-retry-test' });
    const transcript = document.createElement('section');
    const userWrapper = document.createElement('article');
    userWrapper.setAttribute('role', 'article');
    userWrapper.setAttribute('aria-label', 'User message');
    const user = new Root();
    setElementProps(user, { alignment: 'end', tone: 'user' });
    const userHeader = new Header();
    userHeader.textContent = 'You';
    const userContent = new Content();
    userContent.textContent = 'Show a code example.';
    user.append(userHeader, userContent);
    userWrapper.appendChild(user);

    const assistantWrapper = document.createElement('article');
    assistantWrapper.setAttribute('role', 'article');
    assistantWrapper.setAttribute('aria-label', 'Assistant reply');
    const root = new Root();
    setElementProps(root, { alignment: 'start', tone: 'assistant', spacing: 'default' });
    const leading = new Leading();
    leading.textContent = 'A';
    const header = new Header();
    header.textContent = 'Assistant';
    const content = new Content();
    const streamedText = document.createElement('span');
    streamedText.textContent = 'Here is';
    const code = new CodeRoot();
    const codeContent = new CodeContent();
    codeContent.textContent = 'const answer = 42;';
    code.appendChild(codeContent);
    content.append(streamedText, code);
    const footer = new Footer();
    footer.textContent = 'Just now';
    const actions = new Actions();
    actions.textContent = 'App action label';
    const extraActions = new Actions();
    extraActions.textContent = 'Another App action';
    root.append(leading, header, content, footer, actions, extraActions);
    assistantWrapper.appendChild(root);

    const failedWrapper = document.createElement('article');
    failedWrapper.setAttribute('role', 'article');
    failedWrapper.setAttribute('aria-label', 'Failed reply');
    const failed = new Root();
    const failedHeader = new Header();
    failedHeader.textContent = 'Assistant';
    const failedContent = new Content();
    failedContent.textContent = 'The request failed.';
    const failedActions = new Actions();
    const retry = new Button();
    retry.textContent = 'Retry';
    let retryCalls = 0;
    retry.addEventListener('click', (event) => {
      if (event instanceof CustomEvent) retryCalls += 1;
    });
    failedActions.appendChild(retry);
    failed.append(failedHeader, failedContent, failedActions);
    failedWrapper.appendChild(failed);
    transcript.append(userWrapper, assistantWrapper, failedWrapper);
    document.body.appendChild(transcript);

    try {
      await flushComposition();

      expect(root.parentElement?.getAttribute('role')).toBe('article');
      expect(root.parentElement?.getAttribute('aria-label')).toBe('Assistant reply');
      expect(userContent.textContent).toBe('Show a code example.');
      expect(codeContent.textContent).toBe('const answer = 42;');
      expect(Array.from(root.children)).toEqual([
        leading,
        header,
        content,
        footer,
        actions,
        extraActions,
      ]);
      expect(Array.from(user.children)).toEqual([userHeader, userContent]);
      expect(root.getAttribute('data-pui-style')?.split(/\s+/)).toEqual(
        expect.arrayContaining(['me-auto', 'p-4', 'gap-3'])
      );
      expect(root.getExposes()).toEqual({});
      expect(retryCalls).toBe(0);

      streamedText.textContent = 'Here is the complete answer.';
      setElementProps(root, { alignment: 'stretch', tone: 'system', spacing: 'compact' });
      root.update();
      content.update();
      failed.update();
      await flushComposition();

      expect(assistantWrapper.parentElement).toBe(transcript);
      expect(assistantWrapper.firstElementChild).toBe(root);
      expect(root.children[2]).toBe(content);
      expect(content.children[1]).toBe(code);
      expect(code.firstElementChild).toBe(codeContent);
      expect(streamedText.textContent).toBe('Here is the complete answer.');
      const tokens = root.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
      expect(tokens).toEqual(expect.arrayContaining(['w-full', 'p-2', 'gap-2']));
      for (const token of ['me-auto', 'p-4', 'gap-3']) expect(tokens).not.toContain(token);
      for (const part of [root, leading, header, content, footer, actions, extraActions, failed]) {
        expect(part.hasAttribute('role')).toBe(false);
        expect(part.hasAttribute('aria-label')).toBe(false);
        expect(part.hasAttribute('aria-live')).toBe(false);
        expect(part.getExposes()).toEqual({});
      }
      expect(root.parentElement?.getAttribute('aria-label')).toBe('Assistant reply');
      expect(retryCalls).toBe(0);

      retry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushComposition();
      expect(retryCalls).toBe(1);
    } finally {
      transcript.remove();
      await flushComposition();
    }
  });
});
