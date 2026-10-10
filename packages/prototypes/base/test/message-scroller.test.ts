import { it, expect } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
} from '../src/message-scroller';
for (const p of [messageScrollerRoot, messageScrollerViewport, messageScrollerJump])
  AdaptToWebComponent(p, { registerAs: `test-${p.name}` });
it('composes one scroll surface and application-owned new content facts', async () => {
  const root = document.createElement('test-base-message-scroller-root') as any,
    viewport = document.createElement('test-base-message-scroller-viewport') as any,
    jump = document.createElement('test-base-message-scroller-jump') as any;
  setElementProps(root, { newContentCount: 4 });
  root.append(viewport, jump);
  document.body.append(root);
  for (let n = 0; n < 20; n++) await Promise.resolve();
  expect(viewport.getExposes().following).toBeDefined();
  expect(viewport.getAttribute('aria-label')).toBe('Messages');
  expect(viewport.getExposes().scrollYPosition).toBeDefined();
  expect(jump.getExposes().newContentCount.get()).toBe(4);
  setElementProps(root, { a11yLabel: 'Team conversation', newContentCount: -3.5 });
  for (let n = 0; n < 20; n++) await Promise.resolve();
  expect(viewport.getAttribute('aria-label')).toBe('Team conversation');
  expect(jump.getExposes().newContentCount.get()).toBe(0);
  expect(() => jump.click()).not.toThrow();
  root.remove();
});
