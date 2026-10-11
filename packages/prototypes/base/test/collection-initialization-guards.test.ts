import { afterEach, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toolbarRoot, toolbarSeparator } from '../src/toolbar';
import {
  MESSAGE_SCROLLER_FAMILY,
  messageScrollerRoot,
  messageScrollerJump,
} from '../src/message-scroller';

let requests = 0;
// Measure the portable anatomy command boundary, without inventing scroll geometry
// or claiming physical scrolling. The real Jump and Button prototypes run unchanged.
const viewportProbe = definePrototype({
  name: 'collection-guard-viewport-probe',
  setup(def) {
    def.anatomy.claim(MESSAGE_SCROLLER_FAMILY, { role: 'viewport' });
    def.expose.method('jumpToEnd', () => {
      requests += 1;
    });
  },
});
for (const p of [
  toolbarRoot,
  toolbarSeparator,
  messageScrollerRoot,
  messageScrollerJump,
  viewportProbe,
])
  AdaptToWebComponent(p as any, { registerAs: `guard-${p.name}` });
const flush = async () => {
  for (let n = 0; n < 20; n++) await Promise.resolve();
};
const element = (name: string, props = {}): any => {
  const e = document.createElement(`guard-${name}`);
  setElementProps(e, props);
  return e;
};
afterEach(async () => {
  document.body.replaceChildren();
  requests = 0;
  await flush();
});

it.each(['horizontal', 'vertical'] as const)(
  'initializes the separator cross axis in an initially %s toolbar',
  async (orientation) => {
    const root = element('base-toolbar-root', { orientation });
    const separator = element('base-toolbar-separator');
    root.append(separator);
    document.body.append(root);
    await flush();
    expect(separator.getAttribute('aria-orientation')).toBe(
      orientation === 'vertical' ? 'horizontal' : 'vertical'
    );
    setElementProps(root, { orientation: orientation === 'vertical' ? 'horizontal' : 'vertical' });
    await flush();
    expect(separator.getAttribute('aria-orientation')).toBe(orientation);
  }
);
it('reads the existing context when a separator is first inserted after root mount', async () => {
  const root = element('base-toolbar-root', { orientation: 'vertical' });
  document.body.append(root);
  await flush();
  const separator = element('base-toolbar-separator');
  root.append(separator);
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
});
async function mountJump(disabled = false) {
  const root = element('base-message-scroller-root');
  const viewport = element('collection-guard-viewport-probe');
  const jump = element('base-message-scroller-jump', { disabled });
  root.append(viewport, jump);
  document.body.append(root);
  await flush();
  return jump;
}
it('suppresses a disabled jump command and resumes after re-enabling', async () => {
  const jump = await mountJump(true);
  jump.click();
  expect(requests).toBe(0);
  setElementProps(jump, { disabled: false });
  jump.click();
  expect(requests).toBe(1);
  setElementProps(jump, { disabled: true });
  jump.click();
  expect(requests).toBe(1);
});
it('rechecks disabled after the Button click signal synchronously disables Jump', async () => {
  const jump = await mountJump();
  let signals = 0;
  jump.addEventListener('click', (event: Event) => {
    // Only the exposed signal, not the physical input event used by this fixture.
    if (!(event instanceof CustomEvent)) return;
    signals += 1;
    setElementProps(jump, { disabled: true });
  });
  jump.click();
  expect(signals).toBe(1);
  expect(jump.getExposes().disabled.get()).toBe(true);
  expect(requests).toBe(0);
});
