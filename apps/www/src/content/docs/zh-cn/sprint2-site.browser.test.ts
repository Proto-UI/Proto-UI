// @vitest-environment node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PREFERRED_ADAPTER_KEY } from '../../../components/adapter-preference-key';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';

// #1488 B/C/D. Public page inputs and native Chromium actions; no patched
// component state or CSS. Unit conformance separately observes public handles.
let browser: Browser;
let baseUrl: string;
let source: unknown;
const out = process.env.PROTO_UI_SPRINT2_SITE_EVIDENCE_DIR;
const locales = ['en', 'zh-cn'] as const;
const themes = ['light', 'dark'] as const;
type Mode = 'enhanced' | 'failed-scripts' | 'no-js';

beforeAll(async () => {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const patch = execFileSync('git', ['diff', '--binary', 'HEAD']);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .sort();
  const files = await Promise.all(
    untracked.map(async (file) => ({
      path: file,
      sha256: createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
    }))
  );
  source = {
    sha,
    trackedPatchSha256: createHash('sha256').update(patch).digest('hex'),
    untracked: files,
  };
  baseUrl = await startServer('/en/ui-libraries/shadcn/tabs/');
  browser = await launchBrowser();
}, 180_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

async function open(
  route: string,
  theme: (typeof themes)[number],
  mode: Mode,
  runtime = 'wc',
  width = 1440
) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    colorScheme: theme,
    javaScriptEnabled: mode !== 'no-js',
  });
  await context.addInitScript(({ key, runtime }) => localStorage.setItem(key, runtime), {
    key: PREFERRED_ADAPTER_KEY,
    runtime,
  });
  if (mode === 'failed-scripts')
    await context.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort('failed') : route.continue()
    );
  const page = await context.newPage();
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function capture(page: Page, id: string, observations: unknown) {
  if (!out) return;
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, `${id}.png`) });
  await writeFile(
    path.join(out, `${id}.json`),
    JSON.stringify(
      {
        source,
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        route: new URL(page.url()).pathname,
        viewport: page.viewportSize(),
        theme: await page.locator('html').getAttribute('data-theme'),
        // A no-script document can retain its SSR theme even when the browser
        // preference is light. Preserve both facts instead of relabeling it.
        preferredColorScheme: await page.evaluate(() =>
          matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
        ),
        observations,
      },
      null,
      2
    )
  );
}

async function paint(owner: Locator) {
  return owner.evaluate((node) => {
    const surface =
      node.querySelector(':scope > wc-site-shadcn-surface, :scope > wc-site-brutalist-surface') ??
      node;
    const style = getComputedStyle(surface),
      bounds = node.getBoundingClientRect();
    const paintBounds = surface.getBoundingClientRect();
    return {
      nativeTag: node.localName,
      enhanced: node.getAttribute('data-site-link-enhanced'),
      text: node.textContent?.trim(),
      href: node.getAttribute('href'),
      current: node.getAttribute('aria-current'),
      radius: [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ],
      brutalistRadius: getComputedStyle(node).getPropertyValue('--site-brutalist-radius').trim(),
      borders: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      background: style.backgroundColor,
      outline: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      width: bounds.width,
      height: bounds.height,
      paintWidth: paintBounds.width,
      paintHeight: paintBounds.height,
      focused: document.activeElement === node,
    };
  });
}

async function settledRadius(owner: Locator) {
  // Observe the authored transition to completion. Do not finish/cancel
  // animations, disable motion, alter CSS or introduce a grace-period sleep.
  await owner.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  await expect
    .poll(() =>
      owner.evaluate(
        (node) =>
          node
            .getAnimations()
            .filter((animation) => animation.pending || animation.playState === 'running').length
      )
    )
    .toBe(0);
  const observation = await owner.evaluate(async (node) => {
    const read = () => getComputedStyle(node).borderTopLeftRadius;
    const before = read();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    return { before, after: read(), retainedAnimationFrames: 2 };
  });
  expect(observation.after).toBe(observation.before);
  return observation;
}

function expectBrutalistRadius(observation: Awaited<ReturnType<typeof paint>>) {
  // The public Brutalist Surface's default uses rounded-base and the same
  // family radius bank as sidebar.css. Equality of two incorrect square rows
  // must not satisfy family parity. Other site chrome has its own recipes.
  expect(observation.brutalistRadius).not.toBe('');
  expect(observation.radius).toEqual(Array(4).fill(observation.brutalistRadius));
}

let hitFailure = 0;
let scrollObservation = 0;
async function fullNativeHitTarget(owner: Locator) {
  await owner.scrollIntoViewIfNeeded();
  const observation = await owner.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const points = [
      [rect.left + 3, rect.top + rect.height / 2],
      [rect.right - 3, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.top + 3],
      [rect.left + rect.width / 2, rect.bottom - 3],
    ].map(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return {
        x,
        y,
        matchesOwner: hit?.closest('a, summary') === node,
        hitTag: hit?.localName ?? null,
        hitText: hit?.textContent?.trim().slice(0, 120) ?? null,
      };
    });
    return {
      bounds: rect.toJSON(),
      points,
      enhanced: node.getAttribute('data-site-link-enhanced'),
    };
  });
  const allHit = observation.points.every((point) => point.matchesOwner);
  if (!allHit)
    await capture(owner.page(), `hit-failure-${++hitFailure}`, {
      observation,
      screenshotTiming: 'after the recorded point observation',
    });
  expect(allHit, JSON.stringify(observation)).toBe(true);
  return observation;
}

async function waitForEnhancedNavigation(group: Locator, leaf: Locator) {
  // The header trigger can be ready before the progressive navigation batch.
  // Measure the named enhanced owners, not their still-working SSR fallback.
  for (const target of [group, leaf])
    await expect
      .poll(() => target.getAttribute('data-site-link-enhanced'), { timeout: 20_000 })
      .toBe('true');
}

async function takeNativeScrollControl(page: Page, leaf: Locator) {
  await leaf.hover();
  const probe = await leaf.evaluateHandle((node) => {
    let scroller: HTMLElement | null = null;
    let current: Element | null = node;
    while (current) {
      if (
        current instanceof HTMLElement &&
        current.clientHeight > 0 &&
        current.scrollHeight > current.clientHeight &&
        /^(auto|scroll|overlay)$/.test(getComputedStyle(current).overflowY)
      ) {
        scroller = current;
        break;
      }
      const parent: Element | null = current.assignedSlot ?? current.parentElement;
      const root = current.getRootNode();
      current = parent ?? (root instanceof ShadowRoot ? root.host : null);
    }
    if (!scroller) throw new Error('Mobile navigation has no actual scroll viewport');
    const owner = scroller;
    const read = () => ({
      top: owner.scrollTop,
      max: owner.scrollHeight - owner.clientHeight,
      tag: owner.localName,
      bounds: owner.getBoundingClientRect().toJSON(),
    });
    const point = () => {
      const rect = owner.getBoundingClientRect();
      const left = Math.max(8, rect.left + owner.clientLeft + 8);
      const right = Math.min(innerWidth - 8, rect.left + owner.clientLeft + owner.clientWidth - 8);
      const top = Math.max(8, rect.top + owner.clientTop + 8);
      const bottom = Math.min(innerHeight - 8, rect.top + owner.clientTop + owner.clientHeight - 8);
      if (right <= left || bottom <= top)
        throw new Error('Scroll viewport has no visible input area');
      return { x: (left + right) / 2, y: (top + bottom) / 2 };
    };
    const wheel = {
      received: false,
      trusted: false,
      deltaY: 0,
      observedTopAtEvent: 0,
      includesLeaf: false,
      includesScroller: false,
      targetTag: '',
      clientX: 0,
      clientY: 0,
      pathTags: new Array<string>(),
      ownerAtEvent: read(),
    };
    const input = { prepared: false, before: read(), deltaY: 0, expectedTop: 0 };
    const prepareInput = () => {
      input.before = read();
      input.deltaY = input.before.top > 0 ? -32 : 32;
      input.expectedTop = Math.max(0, Math.min(input.before.max, input.before.top + input.deltaY));
      input.prepared = true;
      return input;
    };
    const onWheel = (event: WheelEvent) => {
      const path = event.composedPath();
      const target = path[0];
      wheel.received = true;
      wheel.trusted = event.isTrusted;
      wheel.deltaY = event.deltaY;
      wheel.observedTopAtEvent = owner.scrollTop;
      wheel.includesLeaf = path.includes(node);
      wheel.includesScroller = path.includes(owner);
      wheel.targetTag = target instanceof Element ? target.localName : '';
      wheel.clientX = event.clientX;
      wheel.clientY = event.clientY;
      wheel.pathTags = path.map((part) =>
        part instanceof Element ? part.localName : Object.prototype.toString.call(part)
      );
      wheel.ownerAtEvent = read();
    };
    node.ownerDocument.addEventListener('wheel', onWheel, {
      capture: true,
      once: true,
      passive: true,
    });
    return {
      read,
      wheel,
      point,
      input,
      prepareInput,
      dispose: () => node.ownerDocument.removeEventListener('wheel', onWheel, true),
    };
  });
  const id = `native-scroll-${++scrollObservation}`;
  try {
    // The route-entry reveal may continue during pending layout. A genuine
    // user's wheel is the existing visibility policy's takeover boundary.
    // User input belongs to the visible scroll viewport. The current leaf may
    // move while route-entry layout settles; it is not the wheel's owner.
    const point = await probe.evaluate((value) => value.point());
    await page.mouse.move(point.x, point.y);
    // Native scrolling may reach the compositor before a passive wheel
    // callback reads scrollTop. Keep the pre-input baseline independent.
    const input = await probe.evaluate((value) => value.prepareInput());
    await page.mouse.wheel(0, input.deltaY);
    await expect.poll(() => probe.evaluate((value) => value.wheel.received)).toBe(true);
    const wheel = await probe.evaluate((value) => value.wheel);
    expect(wheel.trusted && wheel.includesScroller, JSON.stringify({ point, wheel })).toBe(true);
    expect(wheel.deltaY).toBe(input.deltaY);
    expect(input.expectedTop).not.toBe(input.before.top);
    await expect
      .poll(() => probe.evaluate((value) => Math.abs(value.read().top - value.input.expectedTop)))
      .toBeLessThanOrEqual(1);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const after = await probe.evaluate((value) => value.read());
    expect(after.top).not.toBe(input.before.top);
    expect(Math.abs(after.top - input.expectedTop)).toBeLessThanOrEqual(1);
    return { point, input, wheel, after, retainedAnimationFrames: 2 };
  } catch (error) {
    await capture(page, id, {
      wheel: await probe.evaluate((value) => value.wheel),
      input: await probe.evaluate((value) => value.input),
      actualScroller: await probe.evaluate((value) => value.read()),
      screenshotTiming: 'after the recorded wheel observations',
    });
    throw error;
  } finally {
    try {
      await probe.evaluate((value) => value.dispose());
    } finally {
      await probe.dispose();
    }
  }
}

for (const locale of locales)
  for (const [index, runtime] of RUNTIMES.entries()) {
    it(`B: ${locale}/${runtime} switches one live Tabs owner through all three exhibition profiles`, async () => {
      const { context, page } = await open(
        `/${locale}/ui-libraries/shadcn/tabs/`,
        themes[index % 2]!,
        'enhanced',
        runtime
      );
      try {
        const preview = page.locator(
          `[data-adapter-panel="${runtime}"] [data-demo-id="demo-shadcn-tabs-profile-switch"]`
        );
        await preview.scrollIntoViewIfNeeded();
        const password = preview.getByRole('tab', { name: 'Password', exact: true });
        await password.click();
        await expect.poll(() => password.getAttribute('aria-selected')).toBe('true');
        const content = preview.locator('[data-demo-ref="passwordContent"]');
        await content.waitFor({ state: 'visible' });
        const tabNode = await password.elementHandle(),
          contentNode = await content.elementHandle();
        const childNode = await password.evaluateHandle((node) => node.firstChild);
        const initialSettled = await settledRadius(password);
        const initialRadius = initialSettled.after;
        await capture(page, `tabs-${locale}-${runtime}-0-rhea`, {
          selected: 'password',
          radius: initialRadius,
          settled: initialSettled,
        });
        for (const [step, [key, profile]] of [
          ['1', 'nova'],
          ['2', 'rhea'],
          ['3', 'new-york-v4'],
          ['1', 'nova'],
        ].entries()) {
          await page.keyboard.press(`Alt+${key}`);
          await expect
            .poll(() => preview.locator('[data-demo-ref="profileStatus"]').textContent())
            .toBe(`Profile: ${profile}`);
          expect(await password.getAttribute('aria-selected')).toBe('true');
          expect(
            await tabNode!.evaluate((node) => node.isConnected && document.activeElement === node)
          ).toBe(true);
          expect(
            await password.evaluate((node, child) => node.firstChild === child, childNode)
          ).toBe(true);
          expect(await contentNode!.evaluate((node) => node.isConnected)).toBe(true);
          expect(await content.evaluate((node, original) => node === original, contentNode)).toBe(
            true
          );
          expect(
            await preview
              .getByRole('tab', { name: 'Billing', exact: true })
              .getAttribute('aria-disabled')
          ).toBe('true');
          if (profile === 'nova')
            await expect
              .poll(() => password.evaluate((node) => getComputedStyle(node).borderTopLeftRadius))
              .not.toBe(initialRadius);
          const settled = await settledRadius(password);
          if (profile === 'rhea') expect(settled.after).toBe(initialRadius);
          if (profile === 'nova') expect(settled.after).not.toBe(initialRadius);
          await capture(page, `tabs-${locale}-${runtime}-${step + 1}-${profile}`, {
            profile,
            selected: 'password',
            focusRetained: true,
            tabAndPanelIdentityRetained: true,
            radius: settled.after,
            settled,
          });
        }
        await preview.getByRole('tab', { name: 'Account', exact: true }).click();
        await expect
          .poll(() =>
            preview.getByRole('tab', { name: 'Account', exact: true }).getAttribute('aria-selected')
          )
          .toBe('true');
        await preview.getByRole('button', { name: 'rhea', exact: true }).click();
        await expect
          .poll(() => preview.locator('[data-demo-ref="profileStatus"]').textContent())
          .toBe('Profile: rhea');
      } finally {
        await context.close();
      }
    }, 60_000);
  }

for (const locale of locales)
  for (const theme of themes)
    for (const family of ['shadcn', 'brutalist'])
      for (const mode of ['enhanced', 'failed-scripts'] as const) {
        it(`C: ${locale}/${theme}/${family}/${mode} preserves group/leaf geometry and native disclosure`, async () => {
          const route = `/${locale}/ui-libraries/${family}/${family === 'brutalist' ? 'components/button' : 'tabs'}/`;
          const { context, page } = await open(route, theme, mode);
          try {
            const sidebar = page.locator('.sidebar-pane .top-level');
            const leaf = sidebar.locator('a[aria-current="page"]');
            const group = leaf.locator('xpath=ancestor::details[1]/summary');
            const details = group.locator('..');
            if (mode === 'enhanced') {
              // Navigation enhances one target per idle turn. Wait for the
              // actual population before measuring its final geometry; this
              // test does not define a one-second navigation startup budget.
              await waitForEnhancedNavigation(group, leaf);
            } else expect(await group.getAttribute('data-site-link-enhanced')).toBeNull();
            const initial = await paint(leaf);
            expect(initial.href).toBe(route);
            const groupNode = await group.elementHandle();
            const leafNode = await leaf.elementHandle();
            await group.hover();
            const groupHover = await paint(group);
            await capture(
              page,
              `sidebar-${locale}-${theme}-${family}-${mode}-group-hover`,
              groupHover
            );
            await leaf.hover();
            const leafHover = await paint(leaf);
            expect(groupHover.radius).toEqual(leafHover.radius);
            if (family === 'shadcn') expect(parseFloat(groupHover.radius[0]!)).toBeGreaterThan(0);
            else {
              expectBrutalistRadius(groupHover);
              expectBrutalistRadius(leafHover);
            }
            expect(groupHover.height).toBeGreaterThanOrEqual(32);
            expect(leafHover.height).toBeGreaterThanOrEqual(32);
            expect(Math.abs(groupHover.width - groupHover.paintWidth)).toBeLessThanOrEqual(1);
            expect(Math.abs(leafHover.width - leafHover.paintWidth)).toBeLessThanOrEqual(1);
            await fullNativeHitTarget(group);
            await fullNativeHitTarget(leaf);
            await page.keyboard.press('Tab');
            await group.focus();
            await page.keyboard.press('Enter');
            await expect
              .poll(() => details.evaluate((node) => (node as HTMLDetailsElement).open))
              .toBe(false);
            await page.keyboard.press('Enter');
            await expect
              .poll(() => details.evaluate((node) => (node as HTMLDetailsElement).open))
              .toBe(true);
            expect(await groupNode!.evaluate((node) => node.isConnected)).toBe(true);
            expect(await leafNode!.evaluate((node) => node.isConnected)).toBe(true);
            expect((await paint(leaf)).current).toBe('page');
            const focused = await paint(group);
            expect(focused.focused).toBe(true);
            expect(focused.outline !== 'none' || focused.boxShadow !== 'none').toBe(true);
            await capture(page, `sidebar-${locale}-${theme}-${family}-${mode}-focus`, {
              groupHover,
              leafHover,
              focused,
            });
          } finally {
            await context.close();
          }
        }, 60_000);
      }

for (const locale of locales)
  for (const family of ['shadcn', 'brutalist'])
    for (const mode of ['enhanced', 'no-js'] as const) {
      it(`C: ${locale}/${family}/${mode} keeps full mobile navigation targets`, async () => {
        const route = `/${locale}/ui-libraries/${family}/${family === 'brutalist' ? 'components/button' : 'tabs'}/`;
        const { context, page } = await open(route, 'light', mode, 'wc', 390);
        try {
          if (mode === 'enhanced')
            await page
              .locator('[data-site-contents-command] [data-projection-generation-state="active"]')
              .getByRole('button')
              .click();
          const leaf = page.locator('.top-level a[aria-current="page"]:visible');
          const group = leaf.locator('xpath=ancestor::details[1]/summary');
          let nativeScroll: Awaited<ReturnType<typeof takeNativeScrollControl>> | undefined;
          if (mode === 'enhanced') {
            await waitForEnhancedNavigation(group, leaf);
            nativeScroll = await takeNativeScrollControl(page, leaf);
          }
          const groupHit = await fullNativeHitTarget(group);
          await group.hover();
          const groupPaint = await paint(group);
          const leafHit = await fullNativeHitTarget(leaf);
          await leaf.hover();
          const leafPaint = await paint(leaf);
          expect(groupPaint.radius).toEqual(leafPaint.radius);
          if (family === 'brutalist') {
            expectBrutalistRadius(groupPaint);
            expectBrutalistRadius(leafPaint);
          }
          expect(groupPaint.height).toBeGreaterThanOrEqual(44);
          expect(leafPaint.height).toBeGreaterThanOrEqual(44);
          await capture(page, `sidebar-mobile-${locale}-${family}-${mode}`, {
            scriptMode: mode,
            groupPaint,
            leafPaint,
            groupHit,
            leafHit,
            nativeScroll,
          });
        } finally {
          await context.close();
        }
      }, 60_000);
    }

for (const locale of locales)
  for (const theme of themes)
    for (const mode of ['enhanced', 'failed-scripts'] as const) {
      it(`D: ${locale}/${theme}/${mode} preserves a native, focused Hero pill without prose underline`, async () => {
        const { context, page } = await open(`/${locale}/`, theme, mode);
        try {
          if (mode === 'enhanced')
            await page.waitForFunction(
              () =>
                document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset
                  .runtimeState === 'ready'
            );
          const pill = page.locator('.homepage-hero__eyebrow a:visible');
          const expectedName =
            locale === 'zh-cn'
              ? '我们还要发明多少次 Button？'
              : 'How many more times must we reinvent the Button?';
          expect(await pill.getAttribute('href')).toBe(`/${locale}/whitepaper/0-preface/`);
          expect(await pill.getAttribute('role')).toBeNull();
          expect(await pill.ariaSnapshot()).toContain(`link "${expectedName}"`);
          const initialBackground = await pill.evaluate(
            (node) => getComputedStyle(node).backgroundColor
          );
          await pill.hover();
          await expect
            .poll(() => pill.evaluate((node) => getComputedStyle(node).backgroundColor))
            .not.toBe(initialBackground);
          const decorations = await pill.evaluate((node) =>
            [node, ...node.querySelectorAll('*')]
              .filter((part) => part.textContent?.trim())
              .map((part) => getComputedStyle(part).textDecorationLine)
          );
          expect(decorations.every((value) => !value.includes('underline'))).toBe(true);
          await capture(page, `hero-${locale}-${theme}-${mode}-hover`, {
            expectedName,
            decorations,
          });
          await page.keyboard.press('Tab');
          await pill.focus();
          expect(await pill.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
          const focus = await pill.evaluate((node) => ({
            outline: getComputedStyle(node).outlineStyle,
            width: getComputedStyle(node).outlineWidth,
          }));
          expect(focus.outline).toBe('solid');
          expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
          const innerFocusPaint = () =>
            pill.evaluate((node) =>
              [...node.querySelectorAll('*')].flatMap((part) => {
                const style = getComputedStyle(part);
                return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
                  style.boxShadow !== 'none'
                  ? [{ tag: part.tagName, outline: style.outline, shadow: style.boxShadow }]
                  : [];
              })
            );
          await expect.poll(innerFocusPaint).toEqual([]);
          await capture(page, `hero-${locale}-${theme}-${mode}-focus`, focus);
          if (locale === 'en' && theme === 'light') {
            await page.emulateMedia({ forcedColors: 'active' });
            expect(await pill.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
            const forcedFocus = await pill.evaluate((node) => ({
              outline: getComputedStyle(node).outlineStyle,
              width: getComputedStyle(node).outlineWidth,
              color: getComputedStyle(node).outlineColor,
              background: getComputedStyle(document.body).backgroundColor,
            }));
            expect(forcedFocus.outline).toBe('solid');
            expect(parseFloat(forcedFocus.width)).toBeGreaterThanOrEqual(2);
            expect(forcedFocus.color).not.toBe(forcedFocus.background);
            await expect.poll(innerFocusPaint).toEqual([]);
            await capture(page, `hero-${locale}-${theme}-${mode}-forced-colors`, forcedFocus);
          }
          await Promise.all([
            page.waitForURL(`**/${locale}/whitepaper/0-preface/`),
            page.keyboard.press('Enter'),
          ]);
          expect(new URL(page.url()).pathname).toBe(`/${locale}/whitepaper/0-preface/`);
        } finally {
          await context.close();
        }
      }, 60_000);
    }

for (const locale of locales) {
  it(`#1154: ${locale} renders the current public Hook evidence without accepting the historical candidate`, async () => {
    const { context, page } = await open(`/${locale}/specifications/as-hook/`, 'light', 'enhanced');
    try {
      const article = page.locator('[data-doc-flow]');
      const text = await article.innerText();
      expect(text).toContain('C-HOOK-0001-K');
      expect(text).toContain('1154');
      expect(text).toContain('R3');
      for (const statement of locale === 'en'
        ? [
            'The container command exited 1',
            'freezing assertions were not reached',
            'All 13 original generic conditions and both original #1154 checkboxes remain incomplete',
          ]
        : [
            '容器命令 exit 1',
            '冻结断言尚未执行',
            '原始 13 项 generic 条件及 #1154 的两个原始 checkbox 仍未完成',
          ])
        expect(text.replace(/\s+/g, ' ')).toContain(statement);
      expect(
        await article.locator('a[href*="issue-1154-container-preparation"]').count()
      ).toBeGreaterThan(0);
      await article
        .locator('a[href*="issue-1154-container-preparation"]')
        .first()
        .scrollIntoViewIfNeeded();
      await capture(page, `hook-evidence-${locale}`, {
        retainedHistoricalFailure: 'C-HOOK-0001-K',
        historicalConditions: 13,
      });
    } finally {
      await context.close();
    }
  }, 60_000);
}
