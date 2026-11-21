import * as React from 'react';
import { createRoot } from 'react-dom/client';
import manifest from 'virtual:collapsible-manifest';
import { CollapsiblePart as Root } from 'virtual:collapsible-root';
import { CollapsiblePart as Trigger } from 'virtual:collapsible-trigger';
import { CollapsiblePart as Content } from 'virtual:collapsible-content';

type OpenChange = { open: boolean; reason: string };

const requests: OpenChange[] = [];
let pending: OpenChange | null = null;
let controlledOpen = false;

function propose(payload: OpenChange): void {
  pending = { open: !!payload.open, reason: String(payload.reason) };
  requests.push(pending);
}

const host = document.getElementById('collapsible-root')!;
const root = createRoot(host);

function render(): void {
  root.render(
    React.createElement(
      'div',
      { className: 'collapsible-cases' },
      React.createElement(
        'section',
        { 'data-collapsible-case': 'uncontrolled' },
        React.createElement(
          Root,
          null,
          React.createElement(Trigger, null, 'Uncontrolled disclosure'),
          React.createElement(Content, { keepMounted: false }, 'Uncontrolled disclosure content')
        )
      ),
      React.createElement(
        'section',
        { 'data-collapsible-case': 'retained' },
        React.createElement(
          Root,
          { defaultOpen: true },
          React.createElement(Trigger, null, 'Retained disclosure'),
          React.createElement(Content, { keepMounted: true }, 'Retained disclosure content')
        )
      ),
      React.createElement(
        'section',
        { 'data-collapsible-case': 'disabled' },
        React.createElement(
          Root,
          { defaultOpen: true, disabled: true },
          React.createElement(Trigger, null, 'Disabled disclosure'),
          React.createElement(Content, { keepMounted: false }, 'Disabled disclosure content')
        )
      ),
      React.createElement(
        'section',
        { 'data-collapsible-case': 'controlled' },
        React.createElement(
          Root,
          { open: controlledOpen, onOpenChange: propose },
          React.createElement(Trigger, null, 'Controlled disclosure'),
          React.createElement(Content, { keepMounted: false }, 'Controlled disclosure content')
        )
      ),
      React.createElement(
        'section',
        { 'data-collapsible-case': 'owner' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              if (!pending) return;
              controlledOpen = pending.open;
              pending = null;
              render();
            },
          },
          'Accept'
        )
      )
    )
  );
}

render();

function caseSection(name: string): HTMLElement | null {
  return host.querySelector(`[data-collapsible-case="${name}"]`);
}

function caseTrigger(name: string): Element | null {
  return caseSection(name)?.querySelector('[role="button"], button') ?? null;
}

(window as unknown as Record<string, unknown>).collapsibleProbe = {
  ready(): boolean {
    const trigger = caseTrigger('uncontrolled');
    return !!trigger && trigger.getAttribute('aria-expanded') !== null;
  },
  read(): { requests: OpenChange[]; pending: OpenChange | null; controlledOpen: boolean } {
    return {
      requests: requests.map((entry) => ({ ...entry })),
      pending: pending ? { ...pending } : null,
      controlledOpen,
    };
  },
  unmount(): void {
    root.unmount();
  },
  evidence(): Record<string, unknown> {
    return {
      profile: manifest.profile,
      componentName: manifest.componentName,
      entries: manifest.entries,
      requests: requests.map((entry) => ({ ...entry })),
      pending: pending ? { ...pending } : null,
      controlledOpen,
    };
  },
};

document.body.dataset.ready = 'true';
