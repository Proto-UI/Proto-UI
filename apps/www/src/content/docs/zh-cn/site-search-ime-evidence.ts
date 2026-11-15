import type { Browser } from 'playwright-core';

export type NativeImeEvent = {
  type: string;
  trusted: boolean;
  composed?: boolean;
  composing?: boolean;
  data?: string | null;
  key?: string;
  inputType?: string;
  value?: string;
  start?: number | null;
  end?: number | null;
};

/** Serializable page-side observer; it never dispatches or changes an input. */
export function installNativeImeTrace({ selector, key }: { selector: string; key: string }) {
  const events: NativeImeEvent[] = [];
  (window as unknown as Record<string, unknown>)[key] = events;
  for (const name of [
    'compositionstart',
    'compositionupdate',
    'compositionend',
    'beforeinput',
    'input',
    'keydown',
    'keyup',
  ]) {
    document.addEventListener(
      name,
      (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest(selector)) return;
        const input = target instanceof HTMLInputElement ? target : target.querySelector('input');
        events.push({
          type: event.type,
          trusted: event.isTrusted,
          composed: event.composed,
          composing: 'isComposing' in event ? (event as InputEvent).isComposing : undefined,
          data: 'data' in event ? (event as InputEvent).data : undefined,
          key: event instanceof KeyboardEvent ? event.key : undefined,
          inputType: event instanceof InputEvent ? event.inputType : undefined,
          value: input?.value,
          start: input?.selectionStart,
          end: input?.selectionEnd,
        });
        if (events.length > 160) events.shift();
      },
      true
    );
  }
}

/**
 * Keep the actual end-event trust bit. CDP's commit can emit an untrusted end
 * even on a plain native input; the consumer must match an independent control
 * from this browser, including that bit, rather than accept either value.
 */
export function nativeImeCommitTrace(events: readonly NativeImeEvent[]) {
  const start = events.findIndex((event) => event.type === 'compositionstart');
  const end = events.findIndex((event, index) => index > start && event.type === 'compositionend');
  if (start < 0 || end < 0) throw new Error('Native IME composition is incomplete');
  const trace = events.slice(start, end + 1);
  if (trace.filter((event) => event.type === 'compositionstart').length !== 1)
    throw new Error('Native IME composition restarted before its commit');
  if (trace.slice(0, -1).some((event) => !event.trusted))
    throw new Error('Native IME start, update and input must be trusted');
  if (
    !trace.some((event) => event.type === 'compositionupdate') ||
    !trace.some((event) => event.type === 'beforeinput' && event.composing === true) ||
    !trace.some((event) => event.type === 'input' && event.composing === true)
  )
    throw new Error('Native IME composition has no native editing sequence');
  return trace.map((event) => ({
    type: event.type,
    trusted: event.trusted,
    composed: event.composed ?? null,
    composing: event.composing ?? null,
    data: event.data ?? null,
    key: event.key ?? null,
    inputType: event.inputType ?? null,
    value: event.value ?? null,
    start: event.start ?? null,
    end: event.end ?? null,
  }));
}

/** The control contains only an HTML input: no Proto, adapter or website code. */
export async function capturePlainInputImeBaseline(browser: Browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.setContent('<input aria-label="Independent native IME control">');
    await page.evaluate(installNativeImeTrace, { selector: 'input', key: '__plainImeEvents' });
    await page.locator('input').focus();
    await cdp.send('Input.insertText', { text: 'Button' });
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await cdp.send('Input.imeSetComposition', {
      text: '中',
      selectionStart: 1,
      selectionEnd: 1,
      replacementStart: 0,
      replacementEnd: 6,
    });
    await page.keyboard.press('ArrowDown');
    await cdp.send('Input.insertText', { text: 'Button' });
    const events = await page.evaluate(() => (window as any).__plainImeEvents as NativeImeEvent[]);
    const trace = nativeImeCommitTrace(events);
    if ((await page.locator('input').inputValue()) !== 'Button')
      throw new Error('Independent native IME control did not commit Button');

    // An explicit negative control belongs only to this empty control page.
    // dispatchEvent cannot manufacture the trusted native editing prefix.
    const forgedEvents = await page.evaluate(() => {
      const input = document.querySelector('input')!;
      (window as any).__plainImeEvents.length = 0;
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      input.dispatchEvent(
        new CompositionEvent('compositionupdate', { bubbles: true, data: 'Button' })
      );
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: 'Button',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: 'Button',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
      input.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: 'Button' })
      );
      return (window as any).__plainImeEvents as NativeImeEvent[];
    });
    let rejected = false;
    try {
      nativeImeCommitTrace(forgedEvents);
    } catch (error) {
      rejected = error instanceof Error && error.message.includes('must be trusted');
    }
    if (!rejected) throw new Error('The native IME oracle accepted a dispatchEvent-only forgery');
    return {
      browser: await browser.version(),
      driver: 'CDP Input.imeSetComposition / Input.insertText',
      boundary: 'Native HTML input control; no Proto; not physical OS IME or assistive technology',
      events,
      trace,
      negativeControl: { events: forgedEvents, rejected },
    };
  } finally {
    await context.close();
  }
}
