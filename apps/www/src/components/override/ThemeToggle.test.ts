import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initSiteControls, registerSiteControls } from '../site-shadcn-controls';

const source = readFileSync('apps/www/src/components/override/ThemeToggle.astro', 'utf8');
const inlineScript = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
if (!inlineScript) throw new Error('ThemeToggle must retain its inline theme initialization');

type Theme = 'light' | 'dark';
type ThemeApi = { get(): Theme; toggle(): void };
type ThemeWindow = Window & typeof globalThis & { StarlightTheme: ThemeApi };

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('documentation theme activation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.dataset.theme = 'light';
    registerSiteControls();
  });

  it.each(['shadcn', 'brutalist'])(
    'commits exactly once when a %s theme icon is the native click target',
    async (family) => {
      const button = document.createElement(`wc-${family}-button`);
      button.dataset.siteButton = '1';
      button.dataset.themeToggle = '';
      button.dataset.variant = family === 'brutalist' ? 'surface' : 'ghost';
      button.dataset.size = 'icon';
      document.body.innerHTML = `<template id="starlight-theme-icons">
        <svg class="light"><path d="M0 0h10v10z"></path></svg>
        <svg class="dark"><path d="M0 0h10v10z"></path></svg>
      </template>`;
      document.body.append(button);
      const toggle = vi.fn(() => {
        const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        document.dispatchEvent(new CustomEvent('starlight-theme:change', { detail: { theme } }));
      });
      (window as ThemeWindow).StarlightTheme = {
        get: () => document.documentElement.dataset.theme as Theme,
        toggle,
      };
      window.eval(inlineScript);
      initSiteControls(document);
      await settle();

      // Native descendant clicks must remain one activation even when rendering
      // replaces the icon. This reproduces the real CI double-toggle failure.
      let targetRemainedOwned = false;
      button.addEventListener('click', (event) => {
        if (event instanceof MouseEvent)
          targetRemainedOwned = button.contains(event.target as Node);
      });
      for (const expected of ['dark', 'light']) {
        const path = button.querySelector('path')!;
        const calls = toggle.mock.calls.length;
        path.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(targetRemainedOwned).toBe(true);
        await settle();
        expect(toggle).toHaveBeenCalledTimes(calls + 1);
        expect(document.documentElement.dataset.theme).toBe(expected);
        expect(button.querySelector('.sr-only')?.textContent).toBe(
          expected === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        );
      }

      const calls = toggle.mock.calls.length;
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await settle();
      expect(toggle).toHaveBeenCalledTimes(calls + 1);
      expect(document.documentElement.dataset.theme).toBe('dark');
    }
  );
});
