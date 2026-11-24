import { afterEach, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asTransition } from '../src/transition';
import { asCollapsibleContent, collapsibleRoot } from '../src/collapsible';

AdaptToWebComponent(collapsibleRoot, { registerAs: 'presence-collapsible-root' });
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it.each(['transition-first', 'content-first'])(
  'retains initially closed Content with %s hook order and one canonical Root',
  async (order) => {
    const contentProto = definePrototype({
      name: `presence-content-${order}`,
      setup() {
        const early = order === 'transition-first' ? asTransition() : null;
        const content = asCollapsibleContent();
        const transition = early ?? asTransition();
        content.bindPresence(transition);
        transition.configure({ enterDuration: 0, leaveDuration: 0 });
        return (renderer) => renderer.slot();
      },
    });
    AdaptToWebComponent(contentProto);
    const root = document.createElement('presence-collapsible-root') as any;
    const content = document.createElement(contentProto.name) as any;
    const child = document.createElement('span');
    child.textContent = 'Retained author child';
    content.append(child);
    root.append(content);
    setElementProps(root, { open: false });
    setElementProps(content, { keepMounted: true, open: true });
    document.body.append(root);
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(content.getExposes().open.get()).toBe(false);
    expect(content.getExposes().hidden.get()).toBe(true);
    expect(child.isConnected).toBe(true);
    const openState = content.getExposes().open;
    setElementProps(root, { open: true });
    await flush();
    expect(content.getExposes().open).toBe(openState);
    expect(content.getExposes().hidden.get()).toBe(false);
    setElementProps(root, { open: false });
    await flush();
    expect(content.getExposes().hidden.get()).toBe(true);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(child.isConnected).toBe(true);
    setElementProps(content, { keepMounted: false, open: true });
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(content.getExposes().open.get()).toBe(false);
  }
);
