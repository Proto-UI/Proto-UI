import * as React from 'react';
import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  tooltipContent,
  tooltipRoot,
  tooltipTrigger,
} from '../../../prototypes/base/src/tooltip';
import { createReactAdapter } from '../src';
import type { ReactAdapterHandle } from '../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const tokens = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

function retainSnapshot(name: string, snapshot: Record<string, unknown>) {
  const directory = process.env.PROTO_UI_TOOLTIP_RELATION_EVIDENCE_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `react-tooltip-${name}.json`), JSON.stringify(snapshot, null, 2), {
    flag: 'wx',
  });
}

function readDescription(trigger: HTMLElement, hostId: string) {
  const description = tokens(trigger);
  const owned = description.filter((id) => id !== hostId);
  const targets = [...document.querySelectorAll<HTMLElement>('[id]')];
  return {
    description,
    owned: owned.map((id) => ({
      id,
      targets: targets
        .filter((target) => target.id === id)
        .map((target) => ({ connected: target.isConnected, role: target.getAttribute('role') })),
    })),
  };
}

function expectBoundDescription(snapshot: ReturnType<typeof readDescription>, hostId: string) {
  expect(snapshot.description).toContain(hostId);
  expect(snapshot.owned.length).toBeLessThanOrEqual(1);
  expect(snapshot.owned, `physical Content IDREFs: ${JSON.stringify(snapshot)}`).toEqual(
    snapshot.owned.map(({ id }) => ({ id, targets: [{ connected: true, role: 'tooltip' }] }))
  );
}

function contentFor(className: string) {
  const matches = document.querySelectorAll<HTMLElement>(`.${className}`);
  expect(matches).toHaveLength(1);
  const content = matches[0]!;
  expect(content.isConnected).toBe(true);
  expect(content.getAttribute('role')).toBe('tooltip');
  expect(content.id).toMatch(/^pui-tooltip-\d+-content$/);
  return content;
}

describe('React Tooltip physical description relationship', () => {
  it('never publishes a dangling IDREF during batched open and retained reopen', async () => {
    // Real React batches the adapter's pending portal view. The observation is
    // synchronous inside act, before React flushes that batch; no fake clock,
    // renderer, host target or scheduler supplies the result. This proves a
    // lifecycle boundary in Happy DOM, not native painting or the old run's cause.
    const adapt = createReactAdapter({ ...React, createPortal });
    const Root = adapt(tooltipRoot);
    const Trigger = adapt(tooltipTrigger);
    const Content = adapt(tooltipContent);
    const rootRef = React.createRef<ReactAdapterHandle<typeof tooltipRoot>>();
    const contentRef = React.createRef<ReactAdapterHandle<typeof tooltipContent>>();
    const host = document.createElement('div');
    const help = document.createElement('span');
    help.id = 'tooltip-react-lifecycle-host-description';
    help.textContent = 'Host-owned help';
    document.body.append(host, help);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(
          React.createElement(
            Root,
            { ref: rootRef },
            React.createElement(Trigger, { hostClassName: 'test-tooltip-lifecycle-trigger' }),
            React.createElement(
              Content,
              {
                ref: contentRef,
                hostClassName: 'test-tooltip-lifecycle-content',
                enterDuration: 0,
                leaveDuration: 0,
              },
              'Tooltip description'
            )
          )
        );
      });
      const trigger = host.querySelector<HTMLElement>('.test-tooltip-lifecycle-trigger')!;
      expect(trigger).toBeInstanceOf(HTMLElement);
      trigger.setAttribute('aria-describedby', help.id);
      let stableId: string | undefined;
      for (const reason of ['first-materialization', 'retained-rematerialization']) {
        expect(rootRef.current!.getExposes().open.get()).toBe(false);
        expect(tokens(trigger)).toEqual([help.id]);
        let beforeCommit: ReturnType<typeof readDescription> | undefined;
        await act(async () => {
          rootRef.current!.getExposes().openTooltip(reason);
          expect(rootRef.current!.getExposes().open.get()).toBe(true);
          beforeCommit = readDescription(trigger, help.id);
        });
        retainSnapshot(reason, {
          rootOpen: rootRef.current!.getExposes().open.get(),
          beforeCommit,
          afterCommit: readDescription(trigger, help.id),
        });
        expect(beforeCommit).toBeDefined();
        expectBoundDescription(beforeCommit!, help.id);
        const content = contentFor('test-tooltip-lifecycle-content');
        expect(tokens(trigger)).toEqual([help.id, content.id]);
        expectBoundDescription(readDescription(trigger, help.id), help.id);
        if (stableId === undefined) stableId = content.id;
        else expect(content.id).toBe(stableId);

        // Use the authored Transition completion API to reach actual L1 detach;
        // this test does not advance, wait for or claim animation timing.
        await act(async () => {
          contentRef.current!.getExposes().controls.complete();
          rootRef.current!.getExposes().close('test.close');
          contentRef.current!.getExposes().controls.complete();
          expect(rootRef.current!.getExposes().open.get()).toBe(false);
          expect(tokens(trigger)).toEqual([help.id]);
        });
        expect(tokens(trigger)).toEqual([help.id]);
        expect(
          [...document.querySelectorAll<HTMLElement>('[id]')].filter((node) => node.id === stableId)
        ).toHaveLength(0);
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
      help.remove();
    }
  });

  it('keeps optional Content, controlled authority and sibling domains independent', async () => {
    const adapt = createReactAdapter({ ...React, createPortal });
    const Root = adapt(tooltipRoot);
    const Trigger = adapt(tooltipTrigger);
    const Content = adapt(tooltipContent);
    const rootRef = React.createRef<ReactAdapterHandle<typeof tooltipRoot>>();
    const requests: { open: boolean; reason: string | null }[] = [];
    let setOpen!: React.Dispatch<React.SetStateAction<boolean>>;
    let setHasContent!: React.Dispatch<React.SetStateAction<boolean>>;
    function App() {
      const [open, updateOpen] = React.useState(false);
      const [hasContent, updateHasContent] = React.useState(false);
      setOpen = updateOpen;
      setHasContent = updateHasContent;
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Root,
          { ref: rootRef, open, onOpenChange: (request) => requests.push(request) },
          React.createElement(Trigger, { hostClassName: 'test-tooltip-optional-trigger' }),
          hasContent
            ? React.createElement(
                Content,
                { hostClassName: 'test-tooltip-optional-content', enterDuration: 0, leaveDuration: 0 },
                'Own description'
              )
            : null
        ),
        React.createElement(
          Root,
          { defaultOpen: true },
          React.createElement(Trigger, { hostClassName: 'test-tooltip-sibling-trigger' }),
          React.createElement(
            Content,
            { hostClassName: 'test-tooltip-sibling-content', enterDuration: 0, leaveDuration: 0 },
            'Sibling description'
          )
        )
      );
    }
    const host = document.createElement('div');
    const help = document.createElement('span');
    help.id = 'tooltip-react-optional-host-description';
    document.body.append(host, help);
    const root = createRoot(host);
    try {
      await act(async () => root.render(React.createElement(App)));
      const trigger = host.querySelector<HTMLElement>('.test-tooltip-optional-trigger')!;
      const siblingTrigger = host.querySelector<HTMLElement>('.test-tooltip-sibling-trigger')!;
      expect(trigger).toBeInstanceOf(HTMLElement);
      expect(siblingTrigger).toBeInstanceOf(HTMLElement);
      trigger.setAttribute('aria-describedby', help.id);
      const sibling = contentFor('test-tooltip-sibling-content');
      expect(tokens(siblingTrigger)).toEqual([sibling.id]);

      await act(async () => {
        rootRef.current!.getExposes().openTooltip('test.controlled.request');
        expect(rootRef.current!.getExposes().open.get()).toBe(false);
        expect(tokens(trigger)).toEqual([help.id]);
      });
      expect(requests).toEqual([{ open: true, reason: 'test.controlled.request' }]);
      await act(async () => setOpen(true));
      expect(rootRef.current!.getExposes().open.get()).toBe(true);
      expect(tokens(trigger)).toEqual([help.id]);
      expect(tokens(siblingTrigger)).toEqual([sibling.id]);

      await act(async () => setHasContent(true));
      const own = contentFor('test-tooltip-optional-content');
      const ownId = own.id;
      retainSnapshot('optional-content-added', {
        own: readDescription(trigger, help.id),
        siblingId: sibling.id,
        siblingDescriptions: tokens(siblingTrigger),
      });
      expect(ownId).not.toBe(sibling.id);
      expect(tokens(trigger)).toEqual([help.id, ownId]);
      expectBoundDescription(readDescription(trigger, help.id), help.id);
      expect(tokens(siblingTrigger)).toEqual([sibling.id]);

      await act(async () => setHasContent(false));
      retainSnapshot('optional-content-removed', {
        rootOpen: rootRef.current!.getExposes().open.get(),
        own: readDescription(trigger, help.id),
        removedIdCount: [...document.querySelectorAll<HTMLElement>('[id]')].filter(
          (node) => node.id === ownId
        ).length,
        siblingId: sibling.id,
        siblingDescriptions: tokens(siblingTrigger),
      });
      expect(rootRef.current!.getExposes().open.get()).toBe(true);
      expect(tokens(trigger)).toEqual([help.id]);
      expect(document.getElementById(ownId)).toBeNull();
      expect(tokens(siblingTrigger)).toEqual([sibling.id]);
      expect(sibling.isConnected).toBe(true);
      await act(async () => setOpen(false));
      expect(rootRef.current!.getExposes().open.get()).toBe(false);
      expect(tokens(trigger)).toEqual([help.id]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      help.remove();
    }
  });
});
