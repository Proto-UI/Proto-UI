import { describe, expect, it } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';

import { AdaptToWebComponent } from '../src/adapt';
import { createShadowOwnerShell } from '../src/shadow-owner-shell';

async function flushReconciliation() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

describe('adapter-web-component Shadow owner shell', () => {
  it('keeps owner nodes while replacing and clearing view-epoch children', () => {
    const host = document.createElement('x-shadow-owner-shell');
    const root = host.attachShadow({ mode: 'open' });
    const shell = createShadowOwnerShell(root);
    const style = document.createElement('style');
    const first = document.createElement('div');
    const second = document.createElement('span');

    shell.replaceRenderedChildren([first]);
    expect(root.innerHTML).toBe('<div></div>');
    expect(shell.hasOnlyRenderedNode(first)).toBe(true);

    shell.attachOwnerNode(style);
    shell.replaceRenderedChildren([second]);
    expect(root.innerHTML).toBe('<style></style><span></span>');
    expect(first.isConnected).toBe(false);
    expect(shell.hasOnlyRenderedNode(second)).toBe(true);

    shell.clearRenderedChildren();
    expect(root.innerHTML).toBe('<style></style>');
    expect(second.isConnected).toBe(false);
  });

  it('preserves non-view ShadowRoot nodes across repeatable view epochs', async () => {
    let run!: RunHandle<any>;
    const proto = definePrototype({
      name: 'x-shadow-owner-view-epochs',
      setup(def) {
        def.feedback.style.use(tw('bg-owner-shell-test'));
        def.lifecycle.onCreated((nextRun) => {
          run = nextRun;
        });
        def.expose('view', {
          show: () => run.lifecycle.setPresent(true),
          hide: () => run.lifecycle.setPresent(false),
        });
        return (renderer) => renderer.el('div', 'epoch');
      },
    });

    AdaptToWebComponent(proto, { shadow: true, schedule: (task) => task() });
    const element = document.createElement(proto.name) as HTMLElement & {
      getExposes(): { view: { show(): void; hide(): void } };
    };
    document.body.appendChild(element);
    const root = element.shadowRoot;
    if (!root) throw new Error('open ShadowRoot was not created');
    expect(root.innerHTML).toBe('<div>epoch</div>');
    expect(element.getAttribute('data-pui-style')).toBe('bg-owner-shell-test');
    expect(root.querySelector('div')?.hasAttribute('data-pui-style')).toBe(false);

    const ownerStyle = document.createElement('style');
    ownerStyle.setAttribute('data-owner-resource', '');
    root.prepend(ownerStyle);

    element.getExposes().view.hide();
    await flushReconciliation();
    expect(root.querySelector('div')).toBeNull();
    expect(root.querySelector('[data-owner-resource]')).toBe(ownerStyle);

    element.getExposes().view.show();
    await flushReconciliation();
    expect(root.querySelector('div')?.textContent).toBe('epoch');
    expect(root.querySelector('[data-owner-resource]')).toBe(ownerStyle);

    element.remove();
    await flushReconciliation();
  });
});
