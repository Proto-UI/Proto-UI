import fs from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { setElementProps } from '@proto.ui/adapter-web-component';
import { createDialogFixture, flush, type Fixture } from './fixture';

type Sample = { step: string; actual: unknown; expected: unknown };
type Observation = {
  id: string; input: string; samples: Sample[]; firstDivergence: Sample | null;
  error: string | null; cleanupError: string | null; finished: boolean;
};
const cell = process.env.PROTO_UI_DIALOG_STUDY_CELL;
if (!cell) throw new Error('The study runner must provide an isolated evidence directory.');

async function observe(id: string, controlled: boolean, body: (f: Fixture, check: (step: string, actual: unknown, expected: unknown) => void) => Promise<void>) {
  const observation: Observation = {
    id, input: 'synthetic DOM events; unit transition completion; real Adapter/prototype instances',
    samples: [], firstDivergence: null, error: null, cleanupError: null, finished: false,
  };
  const check = (step: string, actual: unknown, expected: unknown) => {
    const sample = { step, actual: structuredClone(actual), expected: structuredClone(expected) };
    observation.samples.push(sample);
    try { expect(actual, `${id}: ${step}`).toEqual(expected); }
    catch (error) { observation.firstDivergence = sample; throw error; }
  };
  let f: Fixture | undefined;
  let failed = false;
  let primaryError: unknown;
  try {
    f = createDialogFixture(controlled);
    await flush();
    await body(f, check);
  } catch (error) {
    failed = true;
    primaryError = error;
    observation.error = String(error instanceof Error ? error.stack : error);
  } finally {
    if (f) {
      try { await f.cleanup(); }
      catch (error) {
        observation.cleanupError = String(error instanceof Error ? error.stack : error);
        if (!failed) { failed = true; primaryError = error; }
      }
    }
    observation.finished = true;
    fs.appendFileSync(path.join(cell!, 'oracle.jsonl'), JSON.stringify(observation) + '\n');
  }
  if (failed) throw primaryError;
}

// Expectations are public and await independent review. They are never held-out.
it('D754-FOCUS', () => observe('D754-FOCUS', false, async (f, check) => {
  await f.open();
  check('wrapped initial owner', document.activeElement === f.cancel, true);
  for (const [from, to, reverse] of [[f.cancel, f.save, false], [f.save, f.cancel, false], [f.cancel, f.save, true]] as const) {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: reverse, bubbles: true, cancelable: true });
    from.dispatchEvent(event);
    await flush();
    check(`Tab from ${from.textContent} reverse=${reverse}`, {
      reachedExpectedControl: document.activeElement === to, preventedHostTraversal: event.defaultPrevented,
    }, { reachedExpectedControl: true, preventedHostTraversal: true });
  }
  await f.escape();
  await f.complete();
  check('keyboard close restores opening owner', document.activeElement === f.trigger, true);
}));

it('D754-CONTROLLED', () => observe('D754-CONTROLLED', true, async (f, check) => {
  await f.complete();
  check('owner initially open', f.root.getExposes().open.get(), true);
  await f.escape();
  check('request identity', f.requests, [{ open: false, reason: 'escape', focusReason: 'keyboard' }]);
  check('declined request retains owner and view', {
    open: f.root.getExposes().open.get(), detached: f.content.hasAttribute('data-pui-view-detached'),
    leaving: f.content.getExposes().transitionState.get() === 'leaving',
  }, { open: true, detached: false, leaving: false });
  await flush();
  check('delayed owner is still authoritative', f.root.getExposes().open.get(), true);
  setElementProps(f.root, { open: false });
  await flush();
  check('acceptance starts leave', {
    open: f.root.getExposes().open.get(), state: f.content.getExposes().transitionState.get(),
  }, { open: false, state: 'leaving' });
  await f.complete();
  check('accepted close detaches', f.content.hasAttribute('data-pui-view-detached'), true);
}));

it('D754-RELATIONS', () => observe('D754-RELATIONS', false, async (f, check) => {
  await f.open();
  check('live relations target present parts', {
    title: f.content.getAttribute('aria-labelledby') === f.title.id,
    description: f.content.getAttribute('aria-describedby') === f.description.id,
  }, { title: true, description: true });
  f.title.remove();
  f.description.remove();
  await flush();
  check('removal clears relations and uses Root fallback', {
    labelledBy: f.content.getAttribute('aria-labelledby'), describedBy: f.content.getAttribute('aria-describedby'),
    label: f.content.getAttribute('aria-label'),
  }, { labelledBy: null, describedBy: null, label: 'Record editor fallback' });
  f.content.prepend(f.title, f.description);
  await flush();
  check('re-added relations resolve live same-domain targets', {
    title: document.getElementById(f.content.getAttribute('aria-labelledby') ?? '') === f.title,
    description: document.getElementById(f.content.getAttribute('aria-describedby') ?? '') === f.description,
  }, { title: true, description: true });
}));

it('D754-PRESENCE', () => observe('D754-PRESENCE', false, async (f, check) => {
  await f.open();
  await f.escape();
  check('leave retains view after logical close', {
    open: f.root.getExposes().open.get(), state: f.content.getExposes().transitionState.get(),
    detached: f.content.hasAttribute('data-pui-view-detached'),
  }, { open: false, state: 'leaving', detached: false });
  await f.complete();
  check('closed boundary detaches view', f.content.hasAttribute('data-pui-view-detached'), true);
  await vi.waitFor(() => expect(document.body.style.overflow).toBe(''));
  check('closed boundary releases modal lock', document.body.style.overflow, '');
}));

it('D754-ACTION', () => observe('D754-ACTION', false, async (f, check) => {
  await f.open();
  f.cancel.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
  await flush();
  check('Cancel invokes only cancel', f.actions, ['cancel']);
  check('Cancel closes the logical dialog', f.root.getExposes().open.get(), false);
  await f.complete();
  await vi.waitFor(() => expect(f.content.parentElement).toBe(f.root));
  await f.open();
  f.save.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
  await flush();
  check('Save invokes only save once after reopen', f.actions, ['cancel', 'save']);
  check('Save closes the logical dialog', f.root.getExposes().open.get(), false);
}));
