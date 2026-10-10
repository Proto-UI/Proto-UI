import { expect, it } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';
it('projects explicit keyboard repeat flags into root and global protocol payloads', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const router = createWebProtoEventRouter({ rootEl: root, isEnabled: () => true });
  const local: unknown[] = [],
    global: unknown[] = [];
  router.rootTarget.addEventListener('key.down', (event: any) => local.push(event.detail.repeat));
  router.globalTarget.addEventListener('key.down', (event: any) =>
    global.push(event.detail.repeat)
  );
  try {
    root.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: false })
    );
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: true }));
    root.dispatchEvent(new Event('keydown', { bubbles: true }));
    expect(local).toEqual([false, true, undefined]);
    expect(global).toEqual(local);
  } finally {
    router.dispose();
    root.remove();
  }
});
