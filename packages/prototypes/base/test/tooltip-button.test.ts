import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { asButton, type ButtonProps, type ButtonExposes } from '../src/button';
import { useTooltipTrigger, tooltipRoot, tooltipContent } from '../src/tooltip';

const TooltipButton = AdaptToWebComponent(
  definePrototype<ButtonProps, ButtonExposes>({
    name: 'test-tooltip-button',
    setup() {
      asButton();
      useTooltipTrigger();
    },
  })
);
const Root = AdaptToWebComponent(tooltipRoot);
const Content = AdaptToWebComponent(tooltipContent);
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});
it('composes Button activation and Tooltip description on one focus target', async () => {
  vi.useFakeTimers();
  const root = new Root(),
    button = new TooltipButton(),
    content = new Content();
  setElementProps(root, { openDelay: 0, closeDelay: 0 });
  button.textContent = 'Save';
  content.textContent = 'Save this document';
  root.append(button, content);
  document.body.append(root);
  await flush();
  expect(button.getAttribute('role')).toBe('button');
  expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  button.focus();
  await vi.advanceTimersByTimeAsync(0);
  await flush();
  expect(root.getExposes().open.get()).toBe(true);
  expect(button.getAttribute('aria-describedby')).toBe(content.id);
});

it('does not replace the command default disabled value or its public focus owner', async () => {
  const DisabledButton = AdaptToWebComponent(
    definePrototype<ButtonProps, ButtonExposes>({
      name: 'test-tooltip-disabled-command',
      setup(def) {
        asButton();
        def.props.setDefaults({ disabled: true });
        useTooltipTrigger();
      },
    })
  );
  const root = new Root(),
    button = new DisabledButton();
  root.append(button);
  document.body.append(root);
  await flush();
  expect(button.getExposes().disabled.get()).toBe(true);
  expect(button.getAttribute('tabindex')).not.toBe('0');
});
