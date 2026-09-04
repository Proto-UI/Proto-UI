import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initSiteShadcnControls,
  registerSiteShadcnControls,
  setSelectValue,
  selectValue,
  setSiteSelectDisabled,
  type SiteSelectRoot,
} from './site-shadcn-controls';

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('site Shadcn control bridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    registerSiteShadcnControls();
  });

  it('registers the Shadcn Select composition and applies SSR seed props', async () => {
    const root = document.createElement('wc-shadcn-select-root') as SiteSelectRoot;
    root.dataset.siteSelectRoot = '1';
    root.dataset.siteInitialValue = 'react';

    const trigger = document.createElement('wc-shadcn-select-trigger');
    const label = document.createElement('span');
    label.id = 'runtime-label';
    label.textContent = 'Runtime';
    trigger.setAttribute('aria-labelledby', label.id);
    const value = document.createElement('wc-shadcn-select-value');
    value.dataset.placeholder = 'Runtime';
    trigger.append(value);

    const content = document.createElement('wc-shadcn-select-content');
    const item = document.createElement('wc-shadcn-select-item');
    item.dataset.value = 'react';
    item.dataset.textValue = 'React';
    item.textContent = 'React';
    content.append(item);

    root.append(trigger, content);
    document.body.append(label, root);
    initSiteShadcnControls(document);
    await settle();

    expect(customElements.get('wc-shadcn-select-root')).toBeDefined();
    expect(selectValue(root)).toBe('react');
    expect(item.getAttribute('role')).toBe('option');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(value.textContent).toBe('React');
    expect(trigger.getAttribute('aria-labelledby')).toBe('runtime-label');
  });

  it('closes a portaled Select after item commit and restores trigger focus', async () => {
    const root = document.createElement('wc-shadcn-select-root') as SiteSelectRoot;
    root.dataset.siteSelectRoot = '1';
    root.dataset.siteShadcnInitialized = '1';

    const trigger = document.createElement('wc-shadcn-select-trigger');
    const value = document.createElement('wc-shadcn-select-value');
    trigger.append(value);

    const content = document.createElement('wc-shadcn-select-content');
    const react = document.createElement('wc-shadcn-select-item');
    react.dataset.value = 'react';
    react.dataset.textValue = 'React';
    react.textContent = 'React';
    const vue = document.createElement('wc-shadcn-select-item');
    vue.dataset.value = 'vue';
    vue.dataset.textValue = 'Vue';
    vue.textContent = 'Vue';
    content.append(react, vue);
    root.append(trigger, content);
    document.body.append(root);

    initSiteShadcnControls(document);
    await settle();
    trigger.click();
    await settle();
    expect(root.getExposes?.().open?.get?.()).toBe(true);

    const requestValue = root.getExposes?.().requestValue as
      | ((request: { value: string; textValue: string; reason: 'pointer' }) => boolean)
      | undefined;
    expect(requestValue?.({ value: 'vue', textValue: 'Vue', reason: 'pointer' })).toBe(true);
    await settle();
    expect(selectValue(root)).toBe('vue');
    expect(root.getExposes?.().open?.get?.()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes before a valueChange owner update can disable the Select', async () => {
    const root = document.createElement('wc-shadcn-select-root') as SiteSelectRoot;
    root.dataset.siteSelectRoot = '1';
    root.dataset.siteShadcnInitialized = '1';

    const trigger = document.createElement('wc-shadcn-select-trigger');
    trigger.append(document.createElement('wc-shadcn-select-value'));
    const content = document.createElement('wc-shadcn-select-content');
    const item = document.createElement('wc-shadcn-select-item');
    item.dataset.value = 'react';
    item.dataset.textValue = 'React';
    item.textContent = 'React';
    content.append(item);
    root.append(trigger, content);
    document.body.append(root);

    initSiteShadcnControls(document);
    await settle();
    trigger.click();
    await settle();
    root.addEventListener('valueChange', () => root.setProps?.({ disabled: true }));

    const requestValue = root.getExposes?.().requestValue as
      | ((request: { value: string; textValue: string; reason: 'pointer' }) => boolean)
      | undefined;
    expect(requestValue?.({ value: 'react', textValue: 'React', reason: 'pointer' })).toBe(true);
    await settle();

    expect(root.getExposes?.().open?.get?.()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('preserves the selected value while async remounts toggle disabled', async () => {
    const root = document.createElement('wc-shadcn-select-root') as SiteSelectRoot;
    root.dataset.siteSelectRoot = '1';
    root.dataset.siteInitialValue = 'react';

    const trigger = document.createElement('wc-shadcn-select-trigger');
    trigger.append(document.createElement('wc-shadcn-select-value'));
    const content = document.createElement('wc-shadcn-select-content');
    const react = document.createElement('wc-shadcn-select-item');
    react.dataset.value = 'react';
    react.dataset.textValue = 'React';
    react.textContent = 'React';
    const vue = document.createElement('wc-shadcn-select-item');
    vue.dataset.value = 'vue';
    vue.dataset.textValue = 'Vue';
    vue.textContent = 'Vue';
    content.append(react, vue);
    root.append(trigger, content);
    document.body.append(root);

    initSiteShadcnControls(document);
    await settle();
    setSelectValue(root, 'vue');
    setSiteSelectDisabled(root, true);
    await settle();

    expect(selectValue(root)).toBe('vue');
    expect(trigger.getAttribute('aria-disabled')).toBe('true');

    setSiteSelectDisabled(root, false);
    await settle();
    expect(selectValue(root)).toBe('vue');
    expect(trigger.getAttribute('aria-disabled')).toBe('false');
  });

  it('registers the Shadcn Button projection for site actions', async () => {
    const button = document.createElement('wc-shadcn-button');
    button.dataset.siteShadcnButton = '1';
    button.dataset.variant = 'ghost';
    button.dataset.size = 'icon';
    button.textContent = 'Theme';
    document.body.append(button);

    initSiteShadcnControls(document);
    await settle();

    expect(customElements.get('wc-shadcn-button')).toBeDefined();
    expect(button.getAttribute('role')).toBe('button');
    expect(button.getAttribute('data-pui-style')).toContain('bg-transparent');
  });

  it.each([
    {
      label: 'disabled then value',
      update: (root: SiteSelectRoot) => {
        setSiteSelectDisabled(root, true);
        setSelectValue(root, 'vue');
      },
    },
    {
      label: 'value then disabled',
      update: (root: SiteSelectRoot) => {
        setSelectValue(root, 'vue');
        setSiteSelectDisabled(root, true);
      },
    },
    {
      label: 'repeated value while disabled',
      update: (root: SiteSelectRoot) => {
        setSiteSelectDisabled(root, true);
        setSelectValue(root, 'vue');
        setSelectValue(root, 'vue');
      },
    },
  ])('replays one merged Select prop bag for $label', async ({ update }) => {
    const root = document.createElement('div') as SiteSelectRoot;
    root.setProps = vi.fn();

    update(root);
    await settle();

    expect(root.setProps).toHaveBeenCalledTimes(1);
    expect(root.setProps).toHaveBeenLastCalledWith({ value: 'vue', disabled: true });
  });

  it('retains content text as the accessible source for projected icon buttons', async () => {
    const button = document.createElement('wc-shadcn-button');
    button.dataset.siteShadcnButton = '1';
    button.setAttribute('aria-label', 'Copy code');
    button.innerHTML = '<svg aria-hidden="true"></svg><span class="sr-only">Copy code</span>';
    document.body.append(button);

    initSiteShadcnControls(document);
    await settle();

    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.querySelector('.sr-only')?.textContent).toBe('Copy code');
  });
});
