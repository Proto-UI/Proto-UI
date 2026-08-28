import { beforeEach, describe, expect, it } from 'vitest';
import {
  initSiteShadcnControls,
  registerSiteShadcnControls,
  selectValue,
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
    document.body.append(root);
    initSiteShadcnControls(document);
    await settle();

    expect(customElements.get('wc-shadcn-select-root')).toBeDefined();
    expect(selectValue(root)).toBe('react');
    expect(item.getAttribute('role')).toBe('option');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(value.textContent).toBe('React');
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
});
