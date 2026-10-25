// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { observeS4Startup, installS4InitJournal } from './demo-matrix-observation';
import { settleFamilyQueryBatch } from './family-query-observer';
import { runS4Journey } from '../../../../../../scripts/analysis/shadow-s4-journey.mjs';
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/internal/demo-matrix/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
describe.sequential('S4 complete public Dialog settings', () => {
  for (const locale of ['zh-cn', 'en'])
    it(`${locale}: native Light/split/mixed acceptance`, async () => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light',
      });
      let closing: Promise<void> | undefined;
      const closeContext = () => (closing ??= context.close());
      onTestFinished(closeContext);
      context.on('close', () => {
        try {
          console.info(
            '[S4 context closed]',
            JSON.stringify({
              locale,
              nodeMs: globalThis.performance.now(),
              dateNow: Date.now(),
            })
          );
        } catch {
          /* Diagnostic output cannot replace cleanup. */
        }
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      let phase = 'created';
      const note = (next: string, outcome: string) => {
        phase = next;
        try {
          console.info(
            '[S4 node phase]',
            JSON.stringify({
              locale,
              phase,
              outcome,
              nodeMs: globalThis.performance.now(),
              nodeTimeOrigin: globalThis.performance.timeOrigin,
              dateNow: Date.now(),
            })
          );
        } catch {
          /* Diagnostic output cannot replace the original result. */
        }
      };
      const consoleErrors: Array<{ phase: string; nodeMs: number; text: string }> = [];
      let consoleErrorsDropped = 0;
      const browserObservation = (message: { text(): string; type(): string }) => {
        try {
          const text = message.text();
          if (message.type() === 'error') {
            if (consoleErrors.length < 32) {
              const row = {
                phase,
                nodeMs: globalThis.performance.now(),
                text: text.slice(0, 4000),
              };
              consoleErrors.push(row);
              console.info('[S4 console error]', JSON.stringify({ locale, ...row }));
            } else consoleErrorsDropped++;
            return;
          }
          if (!text.startsWith('[S4 startup change]') && !text.startsWith('[S4 init observation]'))
            return;
          console.info(
            '[S4 browser stream]',
            JSON.stringify({
              locale,
              phase,
              receivedNodeMs: globalThis.performance.now(),
              dateNow: Date.now(),
              text,
            })
          );
        } catch {
          /* Console delivery is optional diagnostic evidence. */
        }
      };
      page.on('console', browserObservation);
      try {
        note('init-script', 'begin');
        try {
          const setup = await settleFamilyQueryBatch(
            [page.addInitScript(installS4InitJournal)],
            2000
          );
          note(
            'init-script',
            setup.complete && setup.outcomes[0]?.status === 'fulfilled' ? 'return' : 'unavailable'
          );
        } catch {
          note('init-script', 'error');
        }
        note('goto', 'begin');
        try {
          await page.goto(`${baseUrl}/${locale}/internal/demo-matrix/#shadow-split-s4`);
          note('goto', 'return');
        } catch (error) {
          note('goto', 'error');
          throw error;
        }
        let startupPassed = false;
        let predicateExpression: { text: string; sha256: string; utf8Bytes: number } | null = null;
        try {
          const text = Function.prototype.toString.call(observeS4Startup);
          predicateExpression = {
            text,
            sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
            utf8Bytes: Buffer.byteLength(text, 'utf8'),
          };
        } catch {
          /* Missing expression observation is evidence debt. */
        }
        note('startup-wait', 'begin');
        try {
          await page.waitForFunction(observeS4Startup, undefined, { timeout: 60_000 });
          startupPassed = true;
        } finally {
          note('startup-wait', startupPassed ? 'return' : 'error');
          // Read the same predicate's journal only after its original verdict.
          // A late or unavailable snapshot never replaces that verdict.
          try {
            const result = await settleFamilyQueryBatch(
              [
                page.evaluate(() => ({
                  startup: (window as any).__puiS4Startup ?? null,
                  init: (window as any).__puiS4InitJournal ?? null,
                })),
              ],
              2000
            );
            const collectionOutcome = !result.complete
              ? 'budget-expired'
              : result.outcomes[0]?.status === 'fulfilled'
                ? 'fulfilled'
                : 'rejected';
            let collectionReason: string | null = null;
            if (result.complete && result.outcomes[0]?.status === 'rejected') {
              try {
                collectionReason = String(result.outcomes[0].reason);
              } catch {
                collectionReason = '[unreadable rejection reason]';
              }
            }
            const observation =
              result.complete && result.outcomes[0]?.status === 'fulfilled'
                ? result.outcomes[0].value.startup
                : null;
            const initObservation =
              result.complete && result.outcomes[0]?.status === 'fulfilled'
                ? result.outcomes[0].value.init
                : null;
            const evidence = {
              source: {
                sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
                dirty: !!execFileSync('git', ['status', '--porcelain'], {
                  encoding: 'utf8',
                }).trim(),
              },
              locale,
              startupPassed,
              errors: [...errors],
              consoleErrors: [...consoleErrors],
              consoleErrorsDropped,
              capturedAt: new Date().toISOString(),
              collectionComplete: result.complete,
              collectionOutcome,
              collectionReason,
              predicateExpression,
              expressionBoundary:
                'Actual Node function passed to waitForFunction; not proof of browser execution.',
              observation,
              initObservation,
            };
            console.log('[S4 startup predicate]', JSON.stringify(evidence));
            const directory = path.join(
              process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ??
                path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'homepage-evidence'),
              's4-startup'
            );
            await settleFamilyQueryBatch(
              [
                mkdir(directory, { recursive: true }).then(() =>
                  writeFile(
                    path.join(directory, `${locale}.json`),
                    JSON.stringify(evidence, null, 2)
                  )
                ),
              ],
              2000
            );
          } catch {
            // Missing diagnostics are evidence debt, not a replacement failure.
          }
        }
        page.on('framenavigated', (f) => {
          if (f === page.mainFrame()) errors.push(`Unexpected navigation: ${f.url()}`);
        });
        note('journey', 'begin');
        try {
          await runS4Journey(page);
          note('journey', 'return');
        } catch (error) {
          note('journey', 'error');
          throw error;
        }
        expect(errors).toEqual([]);
      } finally {
        note('context-close', 'begin');
        try {
          await closeContext();
          note('context-close', 'return');
        } catch (error) {
          note('context-close', 'error');
          throw error;
        } finally {
          try {
            page.off('console', browserObservation);
          } catch {
            /* diagnostic subscription only */
          }
        }
      }
    }, 150_000);
});
