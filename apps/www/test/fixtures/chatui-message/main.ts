import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVueAdapter } from '@proto.ui/adapter-vue';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  Message,
  type MessageAlignment,
  type MessageTone,
  type MessageSpacing,
} from '../../../../../packages/compositions/chatui/src/message';
import { CodeBlock } from '../../../../../packages/compositions/chatui/src/code-block';
import { brutalistButton } from '@proto.ui/prototypes-brutalist/button';

const styleSource = '/@id/__x00__virtual:message-styles.css';
await import(/* @vite-ignore */ styleSource);
const runtime = new URLSearchParams(location.search).get('runtime') ?? 'wc';
const host = document.querySelector<HTMLElement>('#transcript');
if (!host) throw new Error('Message fixture transcript is missing.');
const transcript = host;
document.querySelector('#runtime-name')!.textContent = runtime;
document.body.dataset.runtime = runtime;

const cases = [
  {
    id: 'user',
    name: 'User message',
    author: 'You',
    text: 'Show a code example.',
    tone: 'user',
    alignment: 'end',
  },
  {
    id: 'assistant',
    name: 'Assistant reply',
    author: 'Assistant',
    text: 'Here is a short example.',
    tone: 'assistant',
    alignment: 'start',
  },
  {
    id: 'failed',
    name: 'Failed reply',
    author: 'Assistant',
    text: 'The request failed.',
    tone: 'default',
    alignment: 'start',
  },
  {
    id: 'activity',
    name: 'Activity update',
    author: 'Activity',
    text: 'The App paused this run.',
    tone: 'system',
    alignment: 'start',
  },
] as const;
type MessageCase = (typeof cases)[number];
const code = 'const answer = 42;\nconsole.log(answer);';
let streamedText = cases[1].text as string;
let spacing: MessageSpacing = 'default';
let tone: MessageTone = 'assistant';
let alignment: MessageAlignment = 'start';
let retryCount = 0;
let update: () => Promise<void>;

function propsFor(item: MessageCase) {
  return {
    spacing,
    tone: item.id === 'assistant' ? tone : item.tone,
    alignment: item.id === 'assistant' ? alignment : item.alignment,
    'data-demo-ref': 'message-root',
  };
}
function textFor(item: MessageCase): string {
  if (item.id === 'assistant') return streamedText;
  if (item.id === 'failed' && retryCount > 0) return 'The App requested a retry.';
  return item.text;
}
function retry(): void {
  retryCount += 1;
  document.querySelector('#retry-count')!.textContent = String(retryCount);
  void update();
}

function mountWebComponents(): () => Promise<void> {
  const Root = AdaptToWebComponent(Message.Root);
  const Leading = AdaptToWebComponent(Message.Leading);
  const Header = AdaptToWebComponent(Message.Header);
  const Content = AdaptToWebComponent(Message.Content);
  const Footer = AdaptToWebComponent(Message.Footer);
  const Actions = AdaptToWebComponent(Message.Actions);
  const CodeRoot = AdaptToWebComponent(CodeBlock.Root);
  const CodeContent = AdaptToWebComponent(CodeBlock.Content);
  const Button = AdaptToWebComponent(brutalistButton);
  const entries = cases.map((item) => {
    const wrapper = document.createElement('article');
    wrapper.dataset.case = item.id;
    wrapper.setAttribute('role', 'article');
    wrapper.setAttribute('aria-label', item.name);
    const root = new Root();
    root.dataset.demoRef = 'message-root';
    setElementProps(root, propsFor(item));
    const header = new Header();
    header.dataset.demoRef = 'message-header';
    header.textContent = item.author;
    const content = new Content();
    content.dataset.demoRef = 'message-content';
    const text = document.createElement('span');
    text.dataset.streamedText = '';
    text.textContent = textFor(item);
    content.appendChild(text);
    if (item.id === 'assistant') {
      const leading = new Leading();
      leading.dataset.demoRef = 'message-leading';
      leading.textContent = 'A';
      root.appendChild(leading);
      const codeRoot = new CodeRoot();
      const codeContent = new CodeContent();
      codeContent.dataset.demoRef = 'code-content';
      codeContent.textContent = code;
      codeRoot.appendChild(codeContent);
      content.appendChild(codeRoot);
    }
    root.append(header, content);
    if (item.id === 'assistant') {
      const footer = new Footer();
      footer.dataset.demoRef = 'message-footer';
      footer.textContent = 'App timestamp: just now';
      root.appendChild(footer);
      for (const label of ['App action label', 'Another App action']) {
        const actions = new Actions();
        actions.dataset.demoRef = 'message-actions';
        actions.textContent = label;
        root.appendChild(actions);
      }
    }
    if (item.id === 'failed') {
      const actions = new Actions();
      actions.dataset.demoRef = 'message-actions';
      const button = new Button();
      button.dataset.demoRef = 'retry';
      button.textContent = 'Retry';
      button.addEventListener('click', (event) => {
        if (event instanceof CustomEvent) retry();
      });
      actions.appendChild(button);
      root.appendChild(actions);
    }
    wrapper.appendChild(root);
    transcript.appendChild(wrapper);
    return { item, root, text };
  });
  return async () => {
    for (const { item, root, text } of entries) {
      text.textContent = textFor(item);
      setElementProps(root, propsFor(item));
      root.update();
    }
    await Promise.resolve();
  };
}

function mountReact(): () => Promise<void> {
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
  const app = createRoot(transcript);
  const h = React.createElement;
  const marker = (name: string) => ({ className: name, 'data-demo-ref': name });
  return async () => {
    app.render(
      h(
        React.Fragment,
        null,
        ...cases.map((item) =>
          h(
            'article',
            { key: item.id, 'data-case': item.id, role: 'article', 'aria-label': item.name },
            h(
              Root,
              propsFor(item),
              item.id === 'assistant' ? h(Leading, marker('message-leading'), 'A') : null,
              h(Header, marker('message-header'), item.author),
              h(
                Content,
                marker('message-content'),
                h('span', { 'data-streamed-text': '' }, textFor(item)),
                item.id === 'assistant'
                  ? h(CodeRoot, null, h(CodeContent, marker('code-content'), code))
                  : null
              ),
              item.id === 'assistant'
                ? h(Footer, marker('message-footer'), 'App timestamp: just now')
                : null,
              item.id === 'assistant'
                ? h(Actions, marker('message-actions'), 'App action label')
                : null,
              item.id === 'assistant'
                ? h(Actions, marker('message-actions'), 'Another App action')
                : null,
              item.id === 'failed'
                ? h(
                    Actions,
                    marker('message-actions'),
                    h(Button, { ...marker('retry'), onClick: retry }, 'Retry')
                  )
                : null
            )
          )
        )
      )
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };
}

function mountVue(): () => Promise<void> {
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
  const revision = Vue.ref(0);
  const app = Vue.createApp({
    setup() {
      return () => {
        void revision.value;
        return cases.map((item) =>
          Vue.h(
            'article',
            {
              key: item.id,
              'data-case': item.id,
              role: 'article',
              'aria-label': item.name,
            },
            [
              Vue.h(Root, propsFor(item), () => [
                item.id === 'assistant'
                  ? Vue.h(Leading, { 'data-demo-ref': 'message-leading' }, () => 'A')
                  : null,
                Vue.h(Header, { 'data-demo-ref': 'message-header' }, () => item.author),
                Vue.h(Content, { 'data-demo-ref': 'message-content' }, () => [
                  Vue.h('span', { 'data-streamed-text': '' }, textFor(item)),
                  item.id === 'assistant'
                    ? Vue.h(CodeRoot, null, () =>
                        Vue.h(CodeContent, { 'data-demo-ref': 'code-content' }, () => code)
                      )
                    : null,
                ]),
                item.id === 'assistant'
                  ? Vue.h(
                      Footer,
                      { 'data-demo-ref': 'message-footer' },
                      () => 'App timestamp: just now'
                    )
                  : null,
                item.id === 'assistant'
                  ? Vue.h(Actions, { 'data-demo-ref': 'message-actions' }, () => 'App action label')
                  : null,
                item.id === 'assistant'
                  ? Vue.h(
                      Actions,
                      { 'data-demo-ref': 'message-actions' },
                      () => 'Another App action'
                    )
                  : null,
                item.id === 'failed'
                  ? Vue.h(Actions, { 'data-demo-ref': 'message-actions' }, () =>
                      Vue.h(Button, { 'data-demo-ref': 'retry', onClick: retry }, () => 'Retry')
                    )
                  : null,
              ]),
            ]
          )
        );
      };
    },
  });
  app.mount(transcript);
  return async () => {
    revision.value += 1;
    await Vue.nextTick();
  };
}

if (runtime === 'wc') update = mountWebComponents();
else if (runtime === 'react') update = mountReact();
else if (runtime === 'vue') update = mountVue();
else throw new Error(`Unknown Message fixture runtime: ${runtime}`);

document.querySelector('#append')!.addEventListener('click', () => {
  streamedText += ` Streaming update: ${'longword'.repeat(24)}`;
  void update();
});
document.querySelector('#density')!.addEventListener('click', () => {
  spacing = spacing === 'default' ? 'compact' : 'default';
  void update();
});
document.querySelector('#tone')!.addEventListener('change', (event) => {
  tone = (event.currentTarget as HTMLSelectElement).value as MessageTone;
  void update();
});
document.querySelector('#alignment')!.addEventListener('change', (event) => {
  alignment = (event.currentTarget as HTMLSelectElement).value as MessageAlignment;
  void update();
});
document.querySelector('#theme')!.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.className = dark ? 'dark' : 'light';
});
document.querySelector('#direction')!.addEventListener('change', (event) => {
  transcript.dir = (event.currentTarget as HTMLSelectElement).value;
});
await update();
await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
document.body.dataset.ready = 'true';
