import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { performance as nodePerformance } from 'node:perf_hooks';
import path from 'node:path';
import type { Locator, Page } from 'playwright-core';
import { installDocsCallTimingObserver } from './docs-query-timing.mjs';

type Poll = { pollId: number; expected: boolean; phase: string };

/** Replaces the existing journal callback in the same RPC. No input or layout write. */
export function installAccordionInputJournal(observe: boolean) {
  const w = window as any;
  w.__accordionInputEvidence = [];
  for (const type of ['pointerdown', 'click', 'keydown', 'keyup'])
    document.addEventListener(
      type,
      (event) => {
        const ref = (event.target as Element | null)
          ?.closest?.('[data-demo-ref]')
          ?.getAttribute('data-demo-ref');
        if (ref)
          w.__accordionInputEvidence.push({
            type,
            trusted: event.isTrusted,
            ref,
            key: (event as KeyboardEvent).key ?? null,
          });
      },
      { capture: true }
    );
  if (!observe) return;

  const ids = new WeakMap<object, string>();
  const rows: any[] = [];
  const recentEvents: Event[] = [];
  let next = 0,
    errors = 0,
    dropped = 0;
  let armed = false,
    reopened = false,
    stopped = false;
  let windowStart: number | null = null,
    windowStop: any = null;
  const id = (value: any) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
    let identity = ids.get(value);
    if (!identity) {
      identity = `main:${++next}`;
      ids.set(value, identity);
    }
    return identity;
  };
  const node = (value: any) => {
    if (!(value instanceof Element)) return { identity: id(value), tag: value?.nodeName ?? null };
    const owners = [];
    for (let p: Element | null = value; p; p = p.parentElement) {
      const attributes = Array.from(p.attributes).filter((a) =>
        /runtime|generation|owner|pui-view/.test(a.name)
      );
      if (attributes.length)
        owners.push({ identity: id(p), attributes: attributes.map((a) => [a.name, a.value]) });
    }
    return {
      identity: id(value),
      tag: value.localName,
      ref: value.getAttribute('data-demo-ref'),
      id: value.id,
      connected: value.isConnected,
      expanded: value.getAttribute('aria-expanded'),
      controls: value.getAttribute('aria-controls'),
      disabled: value.getAttribute('aria-disabled'),
      inertAncestor: !!value.closest('[inert]'),
      owners,
    };
  };
  const record = (
    stage: string,
    facts: any = {},
    root?: Element,
    token?: object,
    router?: object,
    native?: Event
  ) => {
    try {
      if (!armed || stopped) return;
      const ref = root?.getAttribute('data-demo-ref');
      if (
        (stage.startsWith('router.') || stage.startsWith('react.')) &&
        ref !== 'single-lifetime-trigger' &&
        ref !== 'single-overview-trigger'
      )
        return;
      if (
        stage.startsWith('router.emit') &&
        !['press.commit', 'key.down', 'key.up'].includes(facts.type)
      )
        return;
      if (rows.length >= 512) {
        ++dropped;
        return;
      }
      const dispatching = recentEvents.filter((event) => event.eventPhase !== 0);
      rows.push({
        stage,
        pageMs: performance.now(),
        timeOrigin: performance.timeOrigin,
        dateNow: Date.now(),
        event: id(native),
        eventPhase: native?.eventPhase ?? null,
        eventType: native?.type ?? null,
        key: (native as KeyboardEvent | undefined)?.key ?? null,
        trusted: native?.isTrusted ?? null,
        keyboardOwner: id((native as any)?.[Symbol.for('@proto.ui/router/keyboard-press-owner')]),
        dispatching: dispatching.map((event) => ({
          identity: id(event),
          type: event.type,
          phase: event.eventPhase,
          key: (event as KeyboardEvent).key ?? null,
        })),
        root: node(root),
        token: id(token),
        routerOrGate: id(router),
        target: node(native?.target),
        active: node(document.activeElement),
        ...facts,
      });
    } catch {
      ++errors;
    }
  };
  w.__accordionTrace = {
    record,
    snapshot: () => ({
      namespace: 'main',
      scope: 'second-trigger Space through fresh Enter, ending at the next original key',
      rows: [...rows],
      errors,
      dropped,
      windowStart,
      windowStop,
      finalActive: node(document.activeElement),
      eventAssociation:
        'native is exact only when supplied by the transformed handler; dispatching list is context, not caller attribution',
    }),
  };
  for (const type of ['keydown', 'keyup', 'click', 'pointerdown', 'focusin', 'focusout'])
    document.addEventListener(
      type,
      (event) => {
        try {
          const target =
            event.target instanceof Element ? event.target.closest('[data-demo-ref]') : null;
          const key = (event as KeyboardEvent).key;
          if (
            !armed &&
            type === 'keydown' &&
            key === ' ' &&
            target?.getAttribute('data-demo-ref') === 'single-lifetime-trigger'
          ) {
            armed = true;
            windowStart = performance.now();
          } else if (
            armed &&
            !reopened &&
            type === 'keydown' &&
            key === 'Enter' &&
            target?.getAttribute('data-demo-ref') === 'single-lifetime-trigger'
          )
            reopened = true;
          else if (reopened && !stopped && type === 'keydown') {
            stopped = true;
            windowStop = {
              at: performance.now(),
              reason: 'next-original-key-after-reopen',
              key,
              target: node(event.target),
            };
          }
          for (let i = recentEvents.length - 1; i >= 0; --i)
            if (!recentEvents[i].eventPhase) recentEvents.splice(i, 1);
          recentEvents.push(event);
          record('document.capture', {}, undefined, undefined, undefined, event);
        } catch {
          ++errors;
        }
      },
      true
    );
  for (const type of ['keydown', 'keyup', 'click', 'focusin', 'focusout'])
    window.addEventListener(type, (event) =>
      record('window.observation', {}, undefined, undefined, undefined, event)
    );
  new MutationObserver((records) => {
    try {
      if (!armed || stopped) return;
      const grouped = new Map<
        string,
        { target: Element; attribute: string | null; count: number; oldValues: (string | null)[] }
      >();
      for (const change of records) {
        if (
          !(change.target instanceof Element) ||
          change.target.getAttribute('data-demo-ref') !== 'single-lifetime-trigger'
        )
          continue;
        const key = `${id(change.target)}:${change.attributeName}`;
        let group = grouped.get(key);
        if (!group) {
          group = {
            target: change.target,
            attribute: change.attributeName,
            count: 0,
            oldValues: [],
          };
          grouped.set(key, group);
        }
        ++group.count;
        if (!group.oldValues.includes(change.oldValue)) group.oldValues.push(change.oldValue);
      }
      for (const group of grouped.values())
        record('mutation.delivery-batch', {
          attribute: group.attribute,
          recordCount: group.count,
          distinctOldValues: group.oldValues,
          subject: node(group.target),
          meaning:
            'delivery batch; repeated records aggregated, not exact mutation instants or complete parent-remount coverage',
        });
    } catch {
      ++errors;
    }
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      'aria-expanded',
      'aria-controls',
      'data-pui-view-pending',
      'data-pui-view-detached',
      'data-pui-view-revealing',
    ],
  });
}

/** Test-only SDK taps retain original getter calls and Promise/error propagation. */
export function createAccordionActivationObservation(page: Page, button: Locator) {
  const directory = process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR;
  if (!directory) return null;
  const require = createRequire(path.join(process.cwd(), 'apps/www/package.json'));
  const sdkRoot = path.dirname(require.resolve('playwright-core/package.json'));
  const observer = installDocsCallTimingObserver(page, {
    sdkRoot,
    selector: (button as unknown as { _selector: string })._selector,
    attribute: 'aria-expanded',
    cap: 1024,
  });
  let sequence = 0,
    query = 0,
    phase = 'initial',
    failed = false,
    errors = 0;
  const polls: Record<string, unknown>[] = [];
  const safe = (read: () => unknown) => {
    try {
      return read();
    } catch {
      ++errors;
      return undefined;
    }
  };
  const clock = () => ({
    nodeMs: nodePerformance.now(),
    timeOrigin: nodePerformance.timeOrigin,
    dateNow: Date.now(),
  });
  const freezeFailure = () => {
    if (!failed) {
      failed = true;
      safe(() => observer.freezeVerdict(false));
    }
  };
  return {
    setPhase(value: string) {
      phase = value;
    },
    beginPoll(expected: boolean): Poll {
      const poll = { pollId: ++sequence, expected, phase };
      safe(() => polls.push({ stage: 'poll.begin', ...poll, ...clock() }));
      return poll;
    },
    read(poll: Poll, read: () => Promise<string | null>) {
      return observer.runOriginalQuery({ ...poll, query: ++query }, read);
    },
    pass(poll: Poll) {
      safe(() => polls.push({ stage: 'poll.pass', pollId: poll.pollId, ...clock() }));
    },
    fail(poll: Poll) {
      freezeFailure();
      safe(() => polls.push({ stage: 'poll.fail', pollId: poll.pollId, ...clock() }));
    },
    failCase() {
      freezeFailure();
      safe(() => polls.push({ stage: 'original-case.fail', ...clock() }));
    },
    async beforeClose() {
      if (!failed) safe(() => observer.freezeVerdict(true));
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const main = await Promise.race([
          page.evaluate(() => (window as any).__accordionTrace?.snapshot()),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Post-verdict Accordion capture exceeded 2s')),
              2000
            );
          }),
        ]);
        await mkdir(directory, { recursive: true });
        await writeFile(
          path.join(directory, 'activation-before-close.json'),
          JSON.stringify(
            { main, node: observer.snapshot(), polls, callerDiagnosticErrors: errors },
            null,
            2
          )
        );
        if (failed)
          await page.screenshot({
            path: path.join(directory, 'activation-failure.png'),
            fullPage: true,
            timeout: 1500,
          });
      } catch {
        ++errors;
      } finally {
        clearTimeout(timer);
      }
      safe(() => observer.markContextCloseStart());
    },
    async afterClose(contextClosed: boolean) {
      safe(() => observer.disposeAfterContextClosed(contextClosed));
      try {
        await writeFile(
          path.join(directory, 'activation-final.json'),
          JSON.stringify(
            { contextClosed, node: observer.snapshot(), polls, callerDiagnosticErrors: errors },
            null,
            2
          )
        );
      } catch {
        ++errors;
      }
    },
  };
}
