import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, setLabel, readState } from './fixtures/select-group-native';
import { collectProtoStyleTokens } from '../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../cli/src/services/proto-style-css';

afterEach(async () => {
  await unmount();
  vi.restoreAllMocks();
  document.querySelectorAll('style[data-group-fixture]').forEach((node) => node.remove());
});
const node = (name: string) => {
  const element = document.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`);
  if (!element) throw new Error(`Missing ${name}`);
  return element;
};
const label = (name: string) => {
  const id = node(name).getAttribute('aria-labelledby');
  return id ? document.getElementById(id)?.textContent : null;
};
it('native fixture composes real parts and rebinds only the owning group without changing selection', async () => {
  // Neutral host facts exercise fixture wiring only, never native geometry evidence.
  const hostFacts = document.createElement('style');
  hostFacts.dataset.groupFixture = '';
  hostFacts.textContent =
    '[data-demo-ref=surface]{border:0px solid;padding:0px}[data-demo-ref=viewport]{padding:4px}';
  document.head.append(hostFacts);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const trigger = this.getAttribute('data-demo-ref') === 'trigger';
    const width = 240,
      height = trigger ? 36 : 32,
      left = 220,
      top = trigger ? 340 : 0;
    return {
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON() {},
    } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1100);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this === document.documentElement ? 1100 : 240;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(240);
  await mount('ltr');
  await act(async () => {
    node('trigger').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(label('frameworks')).toBe('Framework adapters');
  expect(label('nested')).toBe('Legacy adapter');
  expect(label('platform')).toBe('Web platform');
  expect(node('separator').textContent).toBe('');
  expect(node('separator').getAttribute('aria-hidden')).toBe('true');
  expect(readState().value).toBe('react');
  await setLabel('removed');
  expect(readState().diagnostic).toBe('');
  expect(readState().phase).not.toBe('closed');
  expect(label('frameworks')).toBeNull();
  expect(label('nested')).toBe('Legacy adapter');
  expect(label('platform')).toBe('Web platform');
  expect(readState().value).toBe('react');
  await setLabel('rebound');
  expect(readState().diagnostic).toBe('');
  expect(readState().phase).not.toBe('closed');
  expect(label('frameworks')).toBe('Framework adapters (rebound)');
  expect(label('nested')).toBe('Legacy adapter');
  expect(label('platform')).toBe('Web platform');
  expect(readState().value).toBe('react');
});
it('production style-token emitter includes New York label and separator geometry', async () => {
  const tokens = (await collectProtoStyleTokens('packages/prototypes/shadcn/src/select')).map(
    (token) => {
      if (typeof token !== 'string') throw new TypeError('Expected style token string');
      return token;
    }
  );
  for (const token of [
    'px-2',
    'py-1.5',
    'text-xs',
    'text-muted-foreground',
    'pointer-events-none',
    '-mx-1',
    'my-1',
    'h-px',
    'bg-border',
  ])
    expect(tokens).toContain(token);
  const css = renderProtoStyleTokenCss(tokens);
  expect(css).toContain('var(--pui-muted-foreground)');
  expect(css).toContain('var(--pui-border)');
  expect(css).toContain('height: 1px');
});
