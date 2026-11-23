import assert from 'node:assert/strict';

export const numberFieldImeText = (controlled) => ({
  candidates: [controlled ? '3' : '12', controlled ? '3,5' : '1234,5'],
  text: controlled ? '3,5' : '1234,5',
});

/** Error.stack alone omits AggregateError children, including earlier editing failures. */
export function formatEvidenceError(error) {
  const original = error?.stack ?? String(error);
  if (!(error instanceof AggregateError)) return original;
  return `${original}\n${error.errors
    .map((cause, index) => `Cause ${index + 1}: ${formatEvidenceError(cause)}`)
    .join('\n')}`;
}

/** Page-side observation only: never dispatch an event or change the editor. */
export function installNumberFieldImeTrace(element) {
  window.__puiNumberFieldIme?.dispose();
  const events = [];
  const record = (event) =>
    events.push({
      type: event.type,
      isTrusted: event.isTrusted,
      composed: event.composed,
      isComposing: typeof event.isComposing === 'boolean' ? event.isComposing : null,
      data: typeof event.data === 'string' ? event.data : null,
      inputType: typeof event.inputType === 'string' ? event.inputType : null,
      value: element.value,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
    });
  const types = ['compositionstart', 'compositionupdate', 'beforeinput', 'input', 'compositionend'];
  for (const type of types) element.addEventListener(type, record, true);
  window.__puiNumberFieldIme = {
    events,
    dispose: () => {
      for (const type of types) element.removeEventListener(type, record, true);
    },
  };
}

export function stopNumberFieldImeTrace() {
  const recorder = window.__puiNumberFieldIme;
  recorder?.dispose();
  delete window.__puiNumberFieldIme;
  return recorder?.events ?? [];
}

/**
 * CDP's commit may expose an untrusted compositionend even on an independent
 * HTML input. Keep that bit and compare it exactly to the same browser's
 * control; neither filtering untrusted events nor accepting either bit proves
 * native provenance. The complete prefix must still be trusted.
 */
export function assertNumberFieldImeTrace(events, expected) {
  assert.ok(events.length > 0, 'native composition events observed');
  assert.equal(events[0].type, 'compositionstart', 'native composition starts the trace');
  assert.equal(events.at(-1).type, 'compositionend', 'native composition completes the trace');
  for (const type of ['compositionstart', 'compositionend'])
    assert.equal(events.filter((event) => event.type === type).length, 1, `one native ${type}`);
  assert.ok(
    events.slice(0, -1).every((event) => event.isTrusted === true),
    'native composition start, updates and editing input must be trusted'
  );
  assert.equal(typeof events.at(-1).isTrusted, 'boolean', 'retain the actual end-event trust bit');
  for (const type of ['compositionupdate', 'beforeinput', 'input'])
    assert.ok(
      events.some(
        (event) =>
          event.type === type && (type === 'compositionupdate' || event.isComposing === true)
      ),
      `native composing ${type} observed between composition boundaries`
    );
  const trace = events.map((event) => ({
    type: event.type,
    isTrusted: event.isTrusted,
    composed: event.composed,
    isComposing: event.isComposing,
    data: event.data,
    inputType: event.inputType,
    value: event.value,
    selectionStart: event.selectionStart,
    selectionEnd: event.selectionEnd,
  }));
  if (expected !== undefined)
    assert.deepEqual(
      trace,
      expected,
      'native composition matches the independent HTML input, including the end-event trust bit'
    );
  return trace;
}

/** Both owners receive a terminal record even if setup, assertions or recording fail. */
export async function runNumberFieldImeOwners(evidence, runCase, onTerminal = async () => {}) {
  const failures = [];
  for (const controlled of [false, true]) {
    const result = { controlled, status: 'running', nativeEvents: [], componentEvents: [] };
    evidence.cases.push(result);
    try {
      await runCase(controlled, result);
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed';
      result.error = formatEvidenceError(error);
      failures.push(error);
    }
    try {
      await onTerminal(result);
    } catch (error) {
      result.status = 'failed';
      result.terminalWriteError = formatEvidenceError(error);
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      'Number Field IME owner cases failed; both terminal results retained'
    );
}

/** No Proto, Adapter or website code is loaded into this separate browser context. */
export async function captureNumberFieldImeControl(browser, controlled) {
  const { candidates, text } = numberFieldImeText(controlled);
  const evidence = {
    browser: browser.version(),
    controlled,
    text,
    status: 'running',
    input: 'Plain HTML input; same CDP candidate and commit sequence as the component',
    boundary:
      'Browser-engine composition; physical OS IME and assistive technology are not claimed',
    nativeEvents: [],
  };
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const client = await context.newCDPSession(page);
    await page.setContent(
      '<input type="text" inputmode="decimal" value="20,5" aria-label="Independent native IME control">'
    );
    const input = page.locator('input');
    await input.click();
    await input.press('Control+A');
    await input.evaluate(installNumberFieldImeTrace);
    try {
      for (const candidate of candidates) {
        await client.send('Input.imeSetComposition', {
          text: candidate,
          selectionStart: candidate.length,
          selectionEnd: candidate.length,
        });
        assert.equal(
          await input.inputValue(),
          candidate,
          'independent native candidate is visible'
        );
      }
      await client.send('Input.insertText', { text });
      assert.equal(await input.inputValue(), text, 'independent native input commits the raw text');
    } finally {
      evidence.nativeEvents = await page.evaluate(stopNumberFieldImeTrace);
    }
    evidence.trace = assertNumberFieldImeTrace(evidence.nativeEvents);
    // Retain the original false premise as a measurement, not a passing claim.
    evidence.legacyEveryEventTrusted = evidence.nativeEvents.every((event) => event.isTrusted);

    // This forgery exists only in the empty native control. It must fail before
    // comparison, even if its end-event trust bit matches the real CDP end.
    await input.evaluate(installNumberFieldImeTrace);
    await input.evaluate((element, text) => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      element.dispatchEvent(
        new CompositionEvent('compositionupdate', { bubbles: true, data: text })
      );
      for (const type of ['beforeinput', 'input'])
        element.dispatchEvent(
          new InputEvent(type, {
            bubbles: true,
            data: text,
            inputType: 'insertCompositionText',
            isComposing: true,
          })
        );
      element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
    }, text);
    const forgedEvents = await page.evaluate(stopNumberFieldImeTrace);
    assert.throws(() => assertNumberFieldImeTrace(forgedEvents, evidence.trace), /must be trusted/);
    evidence.negativeControl = { events: forgedEvents, rejected: true };
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed';
    evidence.error = formatEvidenceError(error);
  } finally {
    try {
      await context?.close();
    } catch (error) {
      evidence.status = 'failed';
      evidence.cleanupError = formatEvidenceError(error);
    }
  }
  return evidence;
}
