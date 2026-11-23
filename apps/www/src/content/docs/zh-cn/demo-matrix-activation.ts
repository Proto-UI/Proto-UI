import type { Page } from 'playwright-core';
import { matrixPreviewersInitialized } from './demo-matrix-observation';

type ActivationTarget = {
  previewerId: string | null;
  demoId: string | null;
  runtime: string | null;
};

export type MatrixActivationReceipt = {
  startedAt: number;
  deadline: number;
  finishedAt: number | null;
  status: 'activating' | 'covered' | 'failed';
  error: string | null;
  targets: number;
  scrolls: number;
  layoutRevisits: number;
  visited: Array<ActivationTarget & { via: 'initialized' | 'viewport' }>;
  missingAtTraversalEnd: ActivationTarget[];
  ownerChanges: ActivationTarget[];
  originalScroll: { x: number; y: number };
  restoredScroll: { x: number; y: number } | null;
  restorationError: string | null;
};

/** Browser-evaluated user traversal. Only scroll position and this test's
 * diagnostic journal are written. The real IntersectionObserver/bootstrap owns
 * activation; this never calls initPreviewer or writes its readiness markers. */
export async function activateMatrixPreviews({
  startedAt,
  deadline,
}: {
  startedAt: number;
  deadline: number;
}): Promise<MatrixActivationReceipt> {
  type Root = HTMLElement & { __previewer__?: unknown };
  const roots = Array.from(document.querySelectorAll<Root>('[data-previewer-id]'));
  const view = window;
  const target = (root: Root): ActivationTarget => ({
    previewerId: root.dataset.previewerId ?? null,
    demoId: root.closest('.demo-matrix__item')?.id ?? null,
    runtime: root.dataset.initialRuntime ?? null,
  });
  const receipt: MatrixActivationReceipt = {
    startedAt,
    deadline,
    finishedAt: null,
    status: 'activating',
    error: null,
    targets: roots.length,
    scrolls: 0,
    layoutRevisits: 0,
    visited: [],
    missingAtTraversalEnd: [],
    ownerChanges: [],
    originalScroll: { x: view.scrollX, y: view.scrollY },
    restoredScroll: null,
    restorationError: null,
  };
  (
    view as typeof window & { __puiMatrixActivation?: MatrixActivationReceipt }
  ).__puiMatrixActivation = receipt;
  const owners = new Map<Root, unknown>();
  const rememberOwner = (root: Root) => {
    if (root.__previewer__ && !owners.has(root)) owners.set(root, root.__previewer__);
  };
  for (const root of roots) rememberOwner(root);
  const remaining = () => {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error('Matrix activation exhausted the original 60000ms inited phase');
    return left;
  };
  const inViewport = (root: Root) => {
    const rect = root.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < view.innerHeight &&
      rect.right > 0 &&
      rect.left < view.innerWidth
    );
  };
  // Cross real rendering opportunities so the browser can deliver its own
  // intersection observations. No synthetic observer callbacks are used.
  const rendered = () =>
    new Promise<void>((resolve, reject) => {
      const left = remaining();
      let second = 0;
      const first = view.requestAnimationFrame(() => {
        second = view.requestAnimationFrame(() => {
          view.clearTimeout(timer);
          try {
            remaining();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      const timer = view.setTimeout(() => {
        view.cancelAnimationFrame(first);
        view.cancelAnimationFrame(second);
        reject(new Error('Matrix activation exhausted the original 60000ms inited phase'));
      }, left);
    });

  try {
    if (!roots.length) throw new Error('Matrix activation found no previewers');
    let index = 0;
    while (index < roots.length) {
      remaining();
      const root = roots[index]!;
      if (!root.isConnected)
        throw new Error(`Matrix previewer disconnected: ${root.dataset.previewerId}`);
      if (root.dataset.inited === '1') {
        rememberOwner(root);
        receipt.visited.push({ ...target(root), via: 'initialized' });
        index++;
        continue;
      }
      if (!inViewport(root)) {
        root.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
        receipt.scrolls++;
        if (!inViewport(root))
          throw new Error(
            `Native scrolling did not expose matrix previewer: ${root.dataset.previewerId}`
          );
      }
      await rendered();
      const before = index;
      // One real viewport can expose several adapter columns/rows. Inspect each
      // exact root, without spending two frames again on its already seen peers.
      while (index < roots.length) {
        const visible = roots[index]!;
        if (!visible.isConnected)
          throw new Error(`Matrix previewer disconnected: ${visible.dataset.previewerId}`);
        const initialized = visible.dataset.inited === '1';
        if (!initialized && !inViewport(visible)) break;
        rememberOwner(visible);
        receipt.visited.push({ ...target(visible), via: initialized ? 'initialized' : 'viewport' });
        index++;
      }
      // Earlier asynchronous mounts can change row heights between scrolling
      // and IO delivery. Revisit a displaced target under the same deadline.
      if (index === before) receipt.layoutRevisits++;
    }
    receipt.status = 'covered';
  } catch (error) {
    receipt.status = 'failed';
    receipt.error = error instanceof Error ? error.message : String(error);
  } finally {
    // Restore the original observation viewport without remounting any owner.
    for (const root of roots) rememberOwner(root);
    try {
      view.scrollTo({
        left: receipt.originalScroll.x,
        top: receipt.originalScroll.y,
        behavior: 'instant',
      });
      if (receipt.status === 'covered') {
        await rendered();
      }
      receipt.restoredScroll = { x: view.scrollX, y: view.scrollY };
      if (
        Math.abs(view.scrollX - receipt.originalScroll.x) > 1 ||
        Math.abs(view.scrollY - receipt.originalScroll.y) > 1
      )
        throw new Error('Native scrolling did not restore the original Matrix viewport');
    } catch (error) {
      receipt.status = 'failed';
      receipt.restorationError = error instanceof Error ? error.message : String(error);
      receipt.error ??= receipt.restorationError;
    }
    for (const [root, owner] of owners)
      if (!root.isConnected || root.__previewer__ !== owner)
        receipt.ownerChanges.push(target(root));
    if (receipt.ownerChanges.length) {
      receipt.status = 'failed';
      receipt.error ??= 'A mounted Matrix owner changed during viewport traversal';
    }
    receipt.missingAtTraversalEnd = roots.filter((root) => root.dataset.inited !== '1').map(target);
    receipt.finishedAt = Date.now();
  }
  return receipt;
}

/** Activation and the unchanged all-previewers predicate share one deadline.
 * The outer timer also fails a blocked renderer; a late reply cannot renew it. */
export async function waitForMatrixInitialization(
  page: Pick<Page, 'evaluate' | 'waitForFunction'>,
  runtimeCount: number
): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + 60_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async () => {
    const receipt = await page.evaluate(activateMatrixPreviews, { startedAt, deadline });
    if (receipt.status !== 'covered') throw new Error(receipt.error ?? 'Matrix activation failed');
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new Error('Matrix activation exhausted the original 60000ms inited phase');
    await page.waitForFunction(matrixPreviewersInitialized, runtimeCount, { timeout: remaining });
    if (Date.now() > deadline)
      throw new Error('Matrix initialization completed after the original 60000ms inited phase');
  })();
  try {
    await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Matrix activation/initialization exceeded the original 60000ms inited phase'
              )
            ),
          Math.max(0, deadline - Date.now())
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
