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

  it('keeps direct shadow replacement semantics across update, detach, and remount', async () => {
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
      update(): void;
    };
    document.body.appendChild(element);
    const root = element.shadowRoot;
    if (!root) throw new Error('open ShadowRoot was not created');
    expect(root.innerHTML).toBe('<div>epoch</div>');
    expect(element.getAttribute('data-pui-style')).toBe('bg-owner-shell-test');
    expect(root.querySelector('div')?.hasAttribute('data-pui-style')).toBe(false);

    const injectedBeforeUpdate = document.createElement('style');
    injectedBeforeUpdate.setAttribute('data-untracked-update', '');
    root.prepend(injectedBeforeUpdate);
    element.update();
    await flushReconciliation();
    expect(injectedBeforeUpdate.isConnected).toBe(false);
    expect(root.innerHTML).toBe('<div>epoch</div>');

    const injectedBeforeDetach = document.createElement('style');
    injectedBeforeDetach.setAttribute('data-untracked-detach', '');
    root.prepend(injectedBeforeDetach);
    element.remove();
    await flushReconciliation();
    expect(root.childNodes).toHaveLength(0);
    expect(injectedBeforeDetach.isConnected).toBe(false);

    document.body.appendChild(element);
    await flushReconciliation();
    expect(root.innerHTML).toBe('<div>epoch</div>');

    element.remove();
    await flushReconciliation();
  });
});
