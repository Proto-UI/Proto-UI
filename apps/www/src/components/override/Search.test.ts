import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/www/src/components/override/Search.astro', 'utf8');
const commands = readFileSync('apps/www/src/components/site-search-commands.ts', 'utf8');
const homepage = readFileSync(
  'apps/www/src/components/Homepage/homepage-runtime-client.ts',
  'utf8'
);
const triggerCss = readFileSync('apps/www/src/styles/search-trigger.css', 'utf8');
const familyCss = readFileSync('apps/www/src/styles/site-library-family.css', 'utf8');
const headerCss = readFileSync('apps/www/src/styles/site-header.css', 'utf8');

describe('Search command ownership', () => {
  it('uses the current family Button for trigger, close and retry', () => {
    expect(commands).toContain('prototypeId: `${family}-button`');
    expect(commands).toContain("const commands: SearchCommand[] = ['open', 'close', 'retry']");
    expect(source).toContain('data-search-command-mount="open"');
    expect(source).not.toMatch(/<button\b|HTMLButtonElement/);
    expect(homepage).toContain('search?.materialize(request)');
    expect(homepage).toContain('searchPublication?.rollback()');
    expect(commands).toContain('Homepage Search must use its page transaction');
  });

  it('consumes only outward activation and avoids sync props/focus reentry', () => {
    expect(commands).toContain('event instanceof view.CustomEvent');
    expect(source).toContain('openMount.contains(event.target)');
    expect(source).toContain('queueMicrotask');
    expect(commands).toContain('focusSelf');
    expect(source).not.toMatch(/(?:openBtn|retryBtn)\.disabled\s*=/);
    expect(commands).toContain("context.api.setProps('search-command', {");
    expect(commands).toContain('...props,');
  });

  it('prepares only from existing public Button intent facts, never a private native detector or idle task', () => {
    expect(commands).toContain("context.api.getExposes('search-command')");
    expect(commands).toContain("['hovered', 'focusVisible']");
    expect(commands).toContain('fact.subscribe(');
    expect(commands).toContain('for (const unsubscribe of intentSubscriptions) unsubscribe()');
    expect(commands).not.toMatch(
      /button\.addEventListener\(['"](?:pointerenter|mouseenter|focus|focusin)['"]/
    );
    // The existing document focusin listener belongs to deferred public focus
    // ownership, not a Button-local detector or resource-preparation hook.
    expect(source).not.toMatch(/requestIdleCallback|DOMContentLoaded/);
    expect(source).toContain('prepare: prepareOnIntent');
    expect(source).toContain('if (!isCurrentOpen(session) || uiInitialized) return');
  });

  it('keeps native dialog and Pagefind as explicit remaining boundaries', () => {
    expect(source).toContain('<dialog');
    expect(source).toContain("dialog.addEventListener('cancel'");
    expect(source).toContain('dialog.showModal()');
    expect(source).toContain('new PagefindUI(');
    expect(triggerCss).toContain('remain CSS-owned');
  });

  it('removes command skins while retaining layout and Pagefind CSS', () => {
    expect(triggerCss).not.toContain('site-search > button[data-open-modal]');
    expect(triggerCss).not.toContain('.search-failure__retry:disabled');
    expect(headerCss).not.toContain('Search is service-owned');
    expect(familyCss).not.toContain('site-search button[data-open-modal]');
    expect(headerCss).not.toContain(
      "[data-site-library-family='brutalist'] .site-header .site-header-search"
    );
    expect(triggerCss).toContain('.pagefind-ui__search-input');
    for (const rule of triggerCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/data-open-modal|search-toolbar__close(?!-label)|search-failure__retry/.test(rule[1])) {
        expect(rule[2]).not.toMatch(
          /@apply.*(?:border|rounded|bg-|text-|shadow|hover:|focus-visible:)|\b(?:border|background|color|box-shadow|outline)\s*:/
        );
      }
    }
  });
});
