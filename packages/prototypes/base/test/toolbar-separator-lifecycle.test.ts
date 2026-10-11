import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toolbarRoot, toolbarSeparator } from '../src/toolbar';

for (const proto of [toolbarRoot, toolbarSeparator]) AdaptToWebComponent(proto);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

it('retained Separator resolves its current Toolbar cross axis before a provider update', async () => {
  const first = document.createElement(toolbarRoot.name);
  const second = document.createElement(toolbarRoot.name);
  const separator = document.createElement(toolbarSeparator.name);
  setElementProps(first, { orientation: 'horizontal' });
  setElementProps(second, { orientation: 'vertical' });
  first.append(separator);
  document.body.append(first, second);
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('vertical');

  second.append(separator);
  expect(second.firstElementChild).toBe(separator);
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
  setElementProps(first, { orientation: 'vertical' });
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
  setElementProps(first, { orientation: 'horizontal' });
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
  setElementProps(second, { orientation: 'horizontal' });
  await flush();
  expect(separator.getAttribute('aria-orientation')).toBe('vertical');
});
