// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { startBrowserFixture, type BrowserFixture } from './browser-fixture';
import type {
  PropsPolicyMode,
  PropsPolicyProbe,
  PropsPolicySnapshot,
} from './fixtures/differential-browser/props-policy-probe';
import type {
  mountSelectLegacySlotProbe,
  SelectLegacySlotSnapshot,
} from '../../prototypes/base/test/fixtures/select-legacy-slot';

type SelectProbe = ReturnType<typeof mountSelectLegacySlotProbe>;
type Observation = { stage: string; snapshot: unknown; color?: string };
const modes: PropsPolicyMode[] = ['adapter-default', 'adapter-explicit', 'compiled-explicit'];
let fixture: BrowserFixture;
beforeAll(async () => {
  fixture = await startBrowserFixture('sprint1-ownership');
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

async function runBrowserCase(
  id: string,
  query: string,
  exercise: (page: Page, records: Observation[]) => Promise<void>
) {
  const context = await fixture.browser.newContext({
    viewport: { width: 800, height: 500 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const records: Observation[] = [];
  const errors: string[] = [];
  let failure: string | undefined;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    await page.goto(`${fixture.baseUrl}/sprint1-ownership.html?${query}`);
    await page.waitForFunction(
      () => !!(window as unknown as { ownershipProbe?: unknown }).ownershipProbe
    );
    await exercise(page, records);
    expect(errors).toEqual([]);
  } catch (error) {
    failure = String(error);
    await page
      .screenshot({ path: path.join(fixture.evidenceDir, id + '-failure.png'), fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    const compilation = await page
      .evaluate(() => (window as unknown as { ownershipCompilation: unknown }).ownershipCompilation)
      .catch(() => undefined);
    const repository = fileURLToPath(new URL('../../../', import.meta.url));
    const inputs = [
      'packages/compiler/test/sprint1-ownership.browser.test.ts',
      'packages/compiler/test/ownership-fixture-plugin.ts',
      'packages/compiler/test/props-policy-source.ts',
      'packages/compiler/test/fixtures/differential-browser/props-policy.proto.ts',
      'packages/compiler/test/fixtures/differential-browser/props-policy-probe.ts',
      'packages/compiler/test/fixtures/differential-browser/sprint1-ownership.ts',
      'packages/compiler/test/fixtures/differential-browser/sprint1-ownership.html',
      'packages/prototypes/base/test/fixtures/select-legacy-slot.ts',
      'packages/prototypes/base/test/select-legacy-slot-source.ts',
      'packages/prototypes/base/src/select/item.proto.ts',
    ];
    await writeFile(
      path.join(fixture.evidenceDir, id + '.json'),
      JSON.stringify(
        {
          id,
          query,
          environment: 'real-browser',
          browser: fixture.browser.version(),
          node: process.version,
          sourceRevision: process.env.GITHUB_SHA ?? null,
          inputSource: 'public host Props / public handle / deliberate legacy-slot test write',
          scope:
            'Mounted browser consumer, DOM attributes and computed style. No physical-input, assistive-technology or full Shenko/verdant application claim.',
          sourceFiles: inputs.map((file) => ({
            file,
            sha256: createHash('sha256')
              .update(readFileSync(path.join(repository, file)))
              .digest('hex'),
          })),
          compilation,
          records,
          errors,
          failure,
        },
        null,
        2
      )
    );
    await context.close();
  }
}

async function propsRead(page: Page, records: Observation[], stage: string) {
  const observation = await page.evaluate(() => ({
    snapshot: (window as unknown as { ownershipProbe: PropsPolicyProbe }).ownershipProbe.read(),
    color: document.querySelector('[data-pui-root]')
      ? getComputedStyle(document.querySelector('[data-pui-root]')!).color
      : '',
  }));
  records.push({ stage, ...observation });
  return observation;
}
function identity(snapshot: PropsPolicySnapshot) {
  expect(snapshot).toMatchObject({
    sameRoot: true,
    sameLabel: true,
    sameChild: true,
    sameHandle: true,
    childText: 'native-child',
  });
  expect(snapshot.phases.filter(({ phase }) => phase === 'created')).toHaveLength(1);
  expect(snapshot.phases.filter(({ phase }) => phase === 'mounted')).toHaveLength(1);
}

describe.each(modes)('#1453 browser %s', (mode) => {
  it.each([false, true])(
    'keeps watcher=%s update ownership and actual commits',
    async (watcher) => {
      const id = `props-${mode}-${watcher ? 'watch' : 'no-watch'}`;
      await runBrowserCase(
        id,
        `kind=props&mode=${mode}&watcher=${watcher}`,
        async (page, records) => {
          await page.waitForFunction(() =>
            (window as unknown as { ownershipProbe: PropsPolicyProbe }).ownershipProbe.ready()
          );
          await settle(page);
          const initial = await propsRead(page, records, 'initial');
          expect(initial.snapshot).toMatchObject({ text: 'first', online: false });
          expect(initial.snapshot.phases.map(({ phase }) => phase)).toEqual(['created', 'mounted']);
          identity(initial.snapshot);
          for (const [label, tone] of [
            ['second', 'online'],
            ['third', 'offline'],
            ['fourth', 'online'],
          ] as const) {
            const before = (await propsRead(page, records, `before-${label}`)).snapshot;
            const invalidated = await page.evaluate(
              ({ label, tone }) => {
                const probe = (window as unknown as { ownershipProbe: PropsPolicyProbe })
                  .ownershipProbe;
                probe.write(label, tone);
                return probe.read();
              },
              { label, tone }
            );
            records.push({ stage: `host-receipt-${label}`, snapshot: invalidated });
            if (mode === 'adapter-explicit') {
              expect(invalidated.text).toBe(before.text);
              expect(invalidated.online).toBe(before.online);
              expect(invalidated.phases).toEqual(before.phases);
            }
            await page.evaluate(() =>
              (
                window as unknown as { ownershipProbe: PropsPolicyProbe }
              ).ownershipProbe.synchronize()
            );
            await settle(page);
            const synchronized = await propsRead(page, records, `synchronized-${label}`);
            identity(synchronized.snapshot);
            expect(synchronized.snapshot.online).toBe(tone === 'online');
            expect(synchronized.color).toBe(
              tone === 'online' ? 'rgb(20, 110, 50)' : 'rgb(120, 40, 40)'
            );
            expect(synchronized.snapshot.text).toBe(
              mode === 'adapter-default' || watcher ? label : before.text
            );
            if (!watcher && mode !== 'adapter-default')
              expect(synchronized.snapshot.phases).toEqual(before.phases);
            if (label === 'second')
              await page.screenshot({
                path: path.join(fixture.evidenceDir, id + '-synchronized.png'),
                fullPage: true,
              });
            await page.evaluate(() =>
              (window as unknown as { ownershipProbe: PropsPolicyProbe }).ownershipProbe.update()
            );
            await settle(page);
            const committed = (await propsRead(page, records, `committed-${label}`)).snapshot;
            expect(committed).toMatchObject({ text: label, online: tone === 'online' });
            identity(committed);
            const updates = committed.phases
              .slice(before.phases.length)
              .filter(({ phase }) => phase === 'updated');
            expect(updates.length).toBeGreaterThan(0);
            expect(updates.every((entry) => entry.text === label)).toBe(true);
            await page.evaluate(
              ({ label, tone }) => {
                const probe = (window as unknown as { ownershipProbe: PropsPolicyProbe })
                  .ownershipProbe;
                probe.write(label, tone);
                probe.synchronize();
              },
              { label, tone }
            );
            await settle(page);
            expect((await propsRead(page, records, `identical-${label}`)).snapshot).toEqual(
              committed
            );
          }
          const beforeRapid = (await propsRead(page, records, 'before-redundant')).snapshot;
          await page.evaluate(() =>
            (window as unknown as { ownershipProbe: PropsPolicyProbe }).ownershipProbe.update(6)
          );
          await settle(page);
          const afterRapid = (await propsRead(page, records, 'after-redundant')).snapshot;
          identity(afterRapid);
          const updates = afterRapid.phases.slice(beforeRapid.phases.length);
          expect(updates.length).toBeGreaterThan(0);
          expect(updates.length).toBeLessThanOrEqual(6);
          expect(updates.every(({ phase, text }) => phase === 'updated' && text === 'fourth')).toBe(
            true
          );
          expect(afterRapid.phases.filter(({ phase }) => phase === 'watch')).toHaveLength(
            watcher ? 3 : 0
          );
          await settle(page);
          expect((await propsRead(page, records, 'quiescent')).snapshot).toEqual(afterRapid);
          await page.evaluate(() =>
            (window as unknown as { ownershipProbe: PropsPolicyProbe }).ownershipProbe.dispose()
          );
          const disposed = (await propsRead(page, records, 'disposed')).snapshot;
          expect(disposed.text).toBeNull();
          expect(disposed.phases.filter(({ phase }) => phase === 'unmounted')).toHaveLength(1);
          expect(disposed.phases.filter(({ phase }) => phase === 'beforeDispose')).toHaveLength(1);
          expect(
            await page.evaluate(() =>
              (
                window as unknown as { ownershipProbe: PropsPolicyProbe }
              ).ownershipProbe.retainedTouchRejects()
            )
          ).toBe(true);
        }
      );
    },
    60_000
  );
});

describe('#1156 browser committed Select ownership', () => {
  it.each([
    ['base', 'current'],
    ['shadcn', 'current'],
    ['brutalist', 'current'],
    ['base', 'hook'],
    ['base', 'legacy'],
  ] as const)(
    '%s %s witnesses actual conflicting legacy writes',
    async (family, variant) => {
      const id = `select-${family}-${variant}`;
      await runBrowserCase(
        id,
        `kind=select&family=${family}&variant=${variant}`,
        async (page, records) => {
          const read = async (stage: string) => {
            await settle(page);
            const snapshot = await page.evaluate(() =>
              (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.read()
            );
            records.push({ stage, snapshot });
            return snapshot;
          };
          const initial = await read('initial');
          expect(initial).toMatchObject({
            value: 'alpha',
            selected: [true, false],
            aria: ['true', 'false'],
            writes: [0, 0],
          });
          expect(
            await page.evaluate(() =>
              (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.write([
                false,
                true,
              ])
            )
          ).toEqual([false, true]);
          const conflict = await read('first-conflict');
          expect(conflict).toMatchObject({
            value: 'alpha',
            legacy: [false, true],
            writes: [1, 1],
            connected: true,
          });
          await page.screenshot({
            path: path.join(fixture.evidenceDir, id + '-conflict.png'),
            fullPage: true,
          });
          await page.evaluate(() =>
            (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.refuse()
          );
          const refused = await read('refused-root-request');
          expect(refused.value).toBe('alpha');
          expect(refused.requests).toEqual([
            { value: 'beta', textValue: 'beta', reason: 'programmatic' },
          ]);
          await page.evaluate(() =>
            (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.commit('beta')
          );
          const committed = await read('committed-beta');
          expect(committed).toMatchObject({
            value: 'beta',
            selected: [false, true],
            aria: ['false', 'true'],
          });
          expect(
            await page.evaluate(() =>
              (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.write([
                true,
                false,
              ])
            )
          ).toEqual([true, false]);
          const second = await read('second-conflict');
          expect(second).toMatchObject({
            value: 'beta',
            legacy: [true, false],
            writes: [2, 2],
            connected: true,
          });
          await page.evaluate(() =>
            (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.commit('alpha')
          );
          const repeated = await read('committed-alpha');
          const follows = (snapshot: SelectLegacySlotSnapshot) =>
            ['alpha', 'beta'].every((value, index) => {
              const selected = value === snapshot.value;
              return (
                snapshot.selected[index] === selected && snapshot.aria[index] === String(selected)
              );
            });
          expect([initial, conflict, refused, committed, second, repeated].map(follows)).toEqual(
            variant === 'legacy'
              ? [true, false, true, true, false, true]
              : [true, true, true, true, true, true]
          );
          await page.evaluate(() =>
            (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.dispose()
          );
          const connected = await page.evaluate(
            () =>
              (window as unknown as { ownershipProbe: SelectProbe }).ownershipProbe.root.isConnected
          );
          records.push({ stage: 'disposed', snapshot: { connected } });
          expect(connected).toBe(false);
        }
      );
    },
    60_000
  );
});
