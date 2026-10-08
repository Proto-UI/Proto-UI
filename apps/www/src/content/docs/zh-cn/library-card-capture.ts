import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, CDPSession, Page } from 'playwright-core';

export type CaptureClip = { x: number; y: number; width: number; height: number; scale: number };
export type CleanupIssue = { operation: string; error: string };
type ReportCleanup = (issue: CleanupIssue) => void;
const reportCleanup: ReportCleanup = (issue) =>
  console.warn('[library-card-evidence-cleanup]', JSON.stringify(issue));

async function withinDeadline<T>(work: () => Promise<T>, milliseconds: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function detachBounded(session: CDPSession, report: ReportCleanup, operation: string) {
  try {
    await withinDeadline(() => session.detach(), 1000, 'CDP detach exceeded 1000ms');
  } catch (error) {
    // Cleanup is secondary evidence. Never replace a primary capture error or
    // keep its caller from retaining the original failure and actual image.
    report({ operation, error: String(error) });
  }
}

export async function captureCurrentViewport(
  page: Page,
  file: string,
  clip?: CaptureClip,
  report: ReportCleanup = reportCleanup
) {
  let session: CDPSession | undefined;
  let finished = false;
  let bytes: Buffer;
  try {
    bytes = await withinDeadline(
      async () => {
        const obtained = await page.context().newCDPSession(page);
        if (finished) {
          await detachBounded(obtained, report, 'late-session.detach');
          throw new Error('Screenshot session arrived after the capture deadline');
        }
        session = obtained;
        // Avoid Playwright's document.fonts.ready wait while a test owns a
        // held font request. Acquisition and send share one capture deadline.
        const screenshot = await session.send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: !!clip,
          ...(clip ? { clip } : {}),
        });
        if (finished) throw new Error('Screenshot arrived after the capture deadline');
        return Buffer.from(screenshot.data, 'base64');
      },
      15_000,
      'Current-frame screenshot exceeded 15s'
    );
  } finally {
    finished = true;
    if (session) await detachBounded(session, report, 'session.detach');
  }
  // Publish only after the bounded capture has returned its bytes. A synchronous
  // local write cannot outlive a rejected async race and publish a late target.
  // Filesystem errors remain primary errors; cleanup already finished above.
  writeFileSync(file, bytes);
  return { file: path.basename(file), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function closeEvidenceContext(
  context: Pick<BrowserContext, 'close'>,
  preservePrimaryError: boolean,
  report: ReportCleanup = reportCleanup
) {
  try {
    await withinDeadline(() => context.close(), 1000, 'Evidence context close exceeded 1000ms');
  } catch (error) {
    report({ operation: 'context.close', error: String(error) });
    if (!preservePrimaryError) throw error;
  }
}

/** Serialized into the no-script test page. Inline style mutation is synchronous;
 * unlike addStyleTag it does not await a style.onload callback in that page. */
export function applyDoubleRootTextScale() {
  const root = document.documentElement;
  const before = Number.parseFloat(getComputedStyle(root).fontSize);
  root.style.setProperty('font-size', '200%', 'important');
  const after = Number.parseFloat(getComputedStyle(root).fontSize);
  if (!Number.isFinite(before) || before <= 0 || after !== before * 2)
    throw new Error(`Required 200% root text scale was not applied: ${before}px -> ${after}px`);
  return {
    before,
    after,
    value: root.style.getPropertyValue('font-size'),
    priority: root.style.getPropertyPriority('font-size'),
  };
}
