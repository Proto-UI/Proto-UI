import { randomUUID } from 'node:crypto';
import type { CDPSession, Page } from 'playwright-core';

// Test-only observation of the existing Playwright 1.58.2 utility context.
// Preserve the original getter outcome; unavailable capture is evidence debt.
const utilityNamePrefix = '__playwright_utility_world_';
const slotName = 'proto-ui.test.utility-data-family-observation';
type Context = {
  id: number;
  uniqueId: string;
  name: string;
  origin: string;
  auxData?: Record<string, unknown>;
};

const installExpression = (ownerToken: string) => String.raw`(() => {
  const ownerToken = ${JSON.stringify(ownerToken)};
  const key = Symbol.for(${JSON.stringify(slotName)});
  if (Object.prototype.hasOwnProperty.call(globalThis, key))
    return { available: false, reason: 'observation-slot-already-owned' };
  const roots = document.querySelectorAll('[data-homepage-runtime]');
  if (roots.length !== 1) return { available: false, reason: 'root-not-unique', count: roots.length };
  const root = roots[0];
  const prototype = Element.prototype;
  const original = Object.getOwnPropertyDescriptor(prototype, 'getAttribute');
  if (!original || typeof original.value !== 'function')
    return { available: false, reason: 'getAttribute-data-descriptor-unavailable' };
  const native = original.value;
  const apply = Reflect.apply;
  const now = performance.now.bind(performance);
  const reads = [];
  let totalReads = 0, droppedReads = 0, observerError = false;
  function observed(...args) {
    let row;
    try {
      if (this === root && args[0] === 'data-family') {
        totalReads++;
        if (reads.length < 64) {
          row = { ordinal: totalReads, beforeMs: now() };
          reads.push(row);
        } else droppedReads++;
      }
    } catch { observerError = true; }
    try {
      const value = apply(native, this, args);
      try {
        if (row) { row.afterMs = now(); row.value = value; row.outcome = 'returned'; }
      } catch { observerError = true; }
      return value;
    } catch (error) {
      try {
        if (row) { row.afterMs = now(); row.outcome = 'threw'; row.error = String(error); }
      } catch { observerError = true; }
      throw error;
    }
  }
  const controller = {
    collectAndRestore(requestOwnerToken) {
      if (requestOwnerToken !== ownerToken ||
          Object.getOwnPropertyDescriptor(globalThis, key)?.value !== controller)
        return { unavailable: 'observation-owner-mismatch', ownerMatched: false, restored: false };
      const result = { ownerMatched: true, wrapperStillOwned: false, restored: false };
      const errorText = error => { try { return String(error); } catch { return 'diagnostic error'; } };
      try {
        Object.assign(result, { timeOrigin: performance.timeOrigin, pageMs: now(),
          totalReads, droppedReads, observerError, reads: reads.map(row => ({ ...row })),
          currentRootSame: document.querySelector('[data-homepage-runtime]') === root,
          rootConnected: root.isConnected });
      } catch (error) { result.captureError = errorText(error); }
      finally {
        try {
          result.wrapperStillOwned = Object.getOwnPropertyDescriptor(prototype, 'getAttribute')?.value === observed;
          if (result.wrapperStillOwned) {
            Object.defineProperty(prototype, 'getAttribute', original);
            const restored = Object.getOwnPropertyDescriptor(prototype, 'getAttribute');
            result.restored = restored?.value === native && restored.configurable === original.configurable &&
              restored.enumerable === original.enumerable && restored.writable === original.writable;
          }
        } catch (error) { result.restoreError = errorText(error); }
        try { if (globalThis[key] === controller) delete globalThis[key]; }
        catch (error) { result.slotCleanupError = errorText(error); }
      }
      return result;
    }
  };
  Object.defineProperty(controller, 'ownerToken', { value: ownerToken });
  Object.defineProperty(globalThis, key, { configurable: true, value: controller });
  try {
    Object.defineProperty(prototype, 'getAttribute', { ...original, value: observed });
  } catch (error) {
    if (globalThis[key] === controller) delete globalThis[key];
    return { available: false, reason: 'install-failed', error: String(error) };
  }
  return { available: true, timeOrigin: performance.timeOrigin, pageMs: now(),
    rootConnected: root.isConnected, nativeFunctionSource: Function.prototype.toString.call(native) };
})()`;

const collectExpression = (ownerToken: string) => `(() => {
  const ownerToken = ${JSON.stringify(ownerToken)};
  const controller = Object.getOwnPropertyDescriptor(globalThis, Symbol.for(${JSON.stringify(slotName)}))?.value;
  if (!controller) return { unavailable: 'observation-slot-missing', ownerMatched: false };
  if (Object.getOwnPropertyDescriptor(controller, 'ownerToken')?.value !== ownerToken)
    return { unavailable: 'observation-owner-mismatch', ownerMatched: false };
  return controller.collectAndRestore(ownerToken);
})()`;

// Bound observation only. The caller retains every original query Promise.
export async function settleFamilyQueryBatch<T>(
  requests: readonly Promise<T>[],
  budgetMs: number
): Promise<{ complete: true; outcomes: PromiseSettledResult<T>[] } | { complete: false }> {
  const settled = Promise.allSettled(requests).then((outcomes) => ({
    complete: true as const,
    outcomes,
  }));
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) return { complete: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      settled,
      new Promise<{ complete: false }>((resolve) => {
        timer = setTimeout(() => resolve({ complete: false }), budgetMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function prepareUtilityFamilyReadObservation(page: Page) {
  const contexts = new Map<number, Context>();
  const report: Record<string, any> = {
    available: false,
    usable: false,
    source: 'utility-realm family query observation',
    nodeTimeOrigin: performance.timeOrigin,
    contexts: [],
    setup: {},
    collection: {},
    errors: [],
  };
  let ownerToken: string | undefined;
  let session: CDPSession | undefined;
  let chosen: Context | undefined;
  let closed = false;
  const describe = (error: unknown) => {
    try {
      return String(error);
    } catch {
      return 'diagnostic error could not be stringified';
    }
  };
  const onCreated = ({ context }: { context: Context }) => {
    contexts.set(context.id, context);
  };
  const onDestroyed = ({ executionContextId }: { executionContextId: number }) => {
    contexts.delete(executionContextId);
    if (chosen?.id === executionContextId) report.contextDestroyed = true;
  };
  const onCleared = () => {
    contexts.clear();
    report.contextsCleared = true;
  };
  const detach = async () => {
    if (!session || closed) return;
    closed = true;
    try {
      session.off('Runtime.executionContextCreated', onCreated);
      session.off('Runtime.executionContextDestroyed', onDestroyed);
      session.off('Runtime.executionContextsCleared', onCleared);
    } catch (error) {
      report.errors.push({ phase: 'remove-listeners', error: describe(error) });
    }
    try {
      await session.detach();
      report.detached = true;
    } catch (error) {
      report.errors.push({ phase: 'detach', error: describe(error) });
    }
    if (!report.detached || report.errors.length) report.usable = false;
  };
  try {
    report.setup.nodeStartedMs = performance.now();
    ownerToken = randomUUID();
    session = await page.context().newCDPSession(page);
    session.on('Runtime.executionContextCreated', onCreated);
    session.on('Runtime.executionContextDestroyed', onDestroyed);
    session.on('Runtime.executionContextsCleared', onCleared);
    await session.send('Runtime.enable');
    const { frameTree } = await session.send('Page.getFrameTree');
    report.mainFrame = {
      id: frameTree.frame.id,
      url: frameTree.frame.url,
      loaderId: frameTree.frame.loaderId,
    };
    report.contexts = [...contexts.values()];
    const candidates = [...contexts.values()].filter(
      (context) =>
        context.auxData?.frameId === frameTree.frame.id &&
        context.auxData?.isDefault === false &&
        context.name.startsWith(utilityNamePrefix) &&
        context.name.length > utilityNamePrefix.length &&
        typeof context.uniqueId === 'string' &&
        context.uniqueId.length > 0
    );
    if (candidates.length !== 1) {
      report.unavailable = `expected one observed main-frame utility context, got ${candidates.length}`;
      await detach();
    } else {
      chosen = candidates[0]!;
      report.selectedContext = chosen;
      report.install = { nodeStartedMs: performance.now() };
      const result = await session.send('Runtime.evaluate', {
        expression: installExpression(ownerToken),
        uniqueContextId: chosen.uniqueId,
        returnByValue: true,
        silent: true,
      });
      report.install.nodeReturnedMs = performance.now();
      report.install.facts = result.result.value;
      report.install.exceptionDetails = result.exceptionDetails ?? null;
      report.available = !result.exceptionDetails && result.result.value?.available === true;
    }
  } catch (error) {
    report.errors.push({ phase: 'setup', error: describe(error) });
  } finally {
    report.setup.nodeReturnedMs = performance.now();
  }

  return {
    report,
    async disposeIncompleteCapture(contextCloseSucceeded: boolean) {
      // A pending query may still call the getter. Do not restore it before context retirement.
      report.usable = false;
      report.unavailable = 'query-drain-incomplete; getter capture was not collected';
      report.incompleteCapture = { contextCloseSucceeded, restorationAttempted: false };
      report.detachmentRequested = true;
      await detach();
      return report;
    },
    async collectAndRestore() {
      if (closed) return report;
      try {
        // An unacknowledged install can still own a hook. Check our token even when unavailable.
        if (session && chosen && ownerToken) {
          report.collection.nodeStartedMs = performance.now();
          const result = await session.send('Runtime.evaluate', {
            expression: collectExpression(ownerToken),
            uniqueContextId: chosen.uniqueId,
            returnByValue: true,
            silent: true,
          });
          report.collection.nodeReturnedMs = performance.now();
          report.collection.facts = result.result.value;
          report.collection.exceptionDetails = result.exceptionDetails ?? null;
          const facts = result.result.value;
          report.usable =
            report.available &&
            !result.exceptionDetails &&
            facts?.ownerMatched === true &&
            facts.totalReads > 0 &&
            facts.droppedReads === 0 &&
            facts.observerError === false &&
            !facts.captureError &&
            facts.currentRootSame === true &&
            facts.restored === true &&
            !facts.slotCleanupError &&
            !report.contextDestroyed &&
            !report.contextsCleared;
          if (facts?.totalReads === 0) report.unavailable = 'zero matching utility reads captured';
        }
      } catch (error) {
        report.errors.push({ phase: 'collect-and-restore', error: describe(error) });
      } finally {
        report.collection.nodeReturnedMs ??= performance.now();
        await detach();
      }
      return report;
    },
  };
}
