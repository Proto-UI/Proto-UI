import { describe, expect, it } from 'vitest';
import * as Vue from 'vue';
import { Message } from '@proto.ui/compositions-chatui/message';
import { CodeBlock } from '@proto.ui/compositions-chatui/code-block';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';
import { createVueAdapter } from '../src/adapt';
import type { VueAdapterHandle } from '../src/types';

async function flushComposition(): Promise<void> {
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}

describe('adapter-vue: private Message composition', () => {
  it('preserves App content, identity, semantics, and retry ownership through streaming', async () => {
    const adapt = createVueAdapter(Vue);
    const Root = adapt(Message.Root);
    const Leading = adapt(Message.Leading);
    const Header = adapt(Message.Header);
    const Content = adapt(Message.Content);
    const Footer = adapt(Message.Footer);
    const Actions = adapt(Message.Actions);
    const CodeRoot = adapt(CodeBlock.Root);
    const CodeContent = adapt(CodeBlock.Content);
    const Button = adapt(brutalistButton);
    const assistantRef = Vue.ref<VueAdapterHandle<typeof Message.Root>>();
    const text = Vue.ref('Here is');
    const compact = Vue.ref(false);
    let retryCalls = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = Vue.createApp({
      setup() {
        return () =>
          Vue.h('section', { class: 'transcript' }, [
            Vue.h('article', { 'aria-label': 'User message', role: 'article' }, [
              Vue.h(Root, { alignment: 'end', tone: 'user', class: 'user-root' }, () => [
                Vue.h(Header, null, () => 'You'),
                Vue.h(Content, { class: 'user-content' }, () => 'Show a code example.'),
              ]),
            ]),
            Vue.h('article', { 'aria-label': 'Assistant reply', role: 'article' }, [
              Vue.h(
                Root,
                {
                  ref: assistantRef,
                  class: 'assistant-root',
                  alignment: compact.value ? 'stretch' : 'start',
                  tone: compact.value ? 'system' : 'assistant',
                  spacing: compact.value ? 'compact' : 'default',
                },
                () => [
                  Vue.h(Leading, { class: 'message-leading' }, () => 'A'),
                  Vue.h(Header, { class: 'message-header' }, () => 'Assistant'),
                  Vue.h(Content, { class: 'assistant-content' }, () => [
                    Vue.h('span', { class: 'streamed-text' }, text.value),
                    Vue.h(CodeRoot, null, () =>
                      Vue.h(CodeContent, { class: 'code-content' }, () => 'const answer = 42;')
                    ),
                  ]),
                  Vue.h(Footer, { class: 'message-footer' }, () => 'Just now'),
                  Vue.h(Actions, { class: 'message-actions' }, () => 'App action label'),
                  Vue.h(Actions, { class: 'message-actions' }, () => 'Another App action'),
                ]
              ),
            ]),
            Vue.h('article', { 'aria-label': 'Failed reply', role: 'article' }, [
              Vue.h(Root, { class: 'failed-root' }, () => [
                Vue.h(Header, null, () => 'Assistant'),
                Vue.h(Content, null, () => 'The request failed.'),
                Vue.h(Actions, null, () =>
                  Vue.h(
                    Button,
                    {
                      class: 'retry-button',
                      onClick: () => {
                        retryCalls += 1;
                      },
                    },
                    () => 'Retry'
                  )
                ),
              ]),
            ]),
          ]);
      },
    });

    try {
      app.mount(host);
      await flushComposition();

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
      expect(assistantRef.value?.getExposes()).toEqual({});
      expect(retryCalls).toBe(0);

      text.value = 'Here is the complete answer.';
      compact.value = true;
      await flushComposition();

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
      expect(assistantRef.value?.getExposes()).toEqual({});
      expect(retryCalls).toBe(0);

      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushComposition();
      expect(retryCalls).toBe(1);
    } finally {
      app.unmount();
      host.remove();
    }
  });
});
