import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  hoverCardContent,
  hoverCardRoot,
  hoverCardTrigger,
} from '@proto.ui/prototypes-base/hover-card';
for (const p of [hoverCardContent, hoverCardRoot, hoverCardTrigger]) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});
it('withdraws a removed hovered Content from current HoverCard interaction intent', async () => {
  vi.useFakeTimers();
  const root = document.createElement('base-hover-card-root') as any;
  const trigger = document.createElement('base-hover-card-trigger') as any;
  const content = document.createElement('base-hover-card-content') as any;
  setElementProps(root, { openDelay: 0, closeDelay: 20 });
  root.append(trigger, content);
  document.body.append(root);
  await flush();
  trigger.dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(1);
  await flush();
  content.getExposes().controls.complete();
  await flush();
  content.dispatchEvent(new Event('pointerenter'));
  trigger.dispatchEvent(new Event('pointerleave'));
  await vi.advanceTimersByTimeAsync(30);
  await flush();
  expect(root.getExposes().open.get()).toBe(true);
  content.remove();
  await flush();
  await vi.advanceTimersByTimeAsync(100);
  await flush();
  console.log(
    JSON.stringify({
      contentConnected: content.isConnected,
      triggerHovered: trigger.getExposes().hovered.get(),
      triggerFocused: trigger.getExposes().focused.get(),
      rootOpen: root.getExposes().open.get(),
    })
  );
  expect(root.getExposes().open.get()).toBe(false);
});
