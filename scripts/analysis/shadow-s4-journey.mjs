import assert from 'node:assert/strict';

// P-BASE-DIALOG-CONTENT FOCUS/DISMISS/CONTROLLED/A11Y-RELATIONS/PRESENCE,
// A-WEB-COMPONENT G/I and C-LIFECYCLE-0008: actual native output, not mock events.
export async function runS4Journey(page) {
  await page.locator('[data-shadow-s4][data-ready=true]').waitFor();
  const cdp = await page.context().newCDPSession(page);
  const axDialogs = async () =>
    (await cdp.send('Accessibility.getFullAXTree')).nodes.filter(
      (n) => !n.ignored && n.role?.value === 'dialog'
    );
  const results = [];
  try {
    for (const profile of ['light', 'split', 'mixed']) {
      const part = (key) => page.locator(`[data-s4-profile=${profile}][data-s4-part=${key}]`);
      const card = page.locator(`[data-s4-card=${profile}]`);
      const content = part('content');
      const component = (key) => content.locator(`[data-s3-component=${key}]`);
      const requests = async () => JSON.parse(await card.getAttribute('data-requests'));
      const model = async () =>
        JSON.parse(await content.locator('[data-s3-profile]').getAttribute('data-model'));
      const counts = async () => JSON.parse(await card.getAttribute('data-counts'));
      const active = async () =>
        page.evaluate(() => {
          let el = document.activeElement;
          while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
          return (
            el?.closest('[data-s4-part],[data-s3-component]')?.getAttribute('data-s3-component') ??
            el?.closest('[data-s4-part]')?.getAttribute('data-s4-part') ??
            el?.tagName
          );
        });
      const opened = async () => {
        await page.waitForTimeout(300);
        assert.equal(await card.getAttribute('data-open'), 'true');
        assert.equal(await content.evaluate((el) => el.parentElement === document.body), true);
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        const dialogs = await axDialogs();
        assert.equal(dialogs.length, 1);
        assert.equal(dialogs[0].name?.value, `S4 ${profile} settings`);
        assert.match(dialogs[0].description?.value ?? '', /Tabs/);
        const geometry = await content.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const s = (el.shadowRoot?.querySelector('[part=surface]') ?? el).getBoundingClientRect();
          return {
            dx: r.x + r.width / 2 - innerWidth / 2,
            dy: r.y + r.height / 2 - innerHeight / 2,
            fits:
              r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
            surface: [s.x - r.x, s.y - r.y, s.width - r.width, s.height - r.height],
          };
        });
        assert.ok(
          Math.abs(geometry.dx) < 1 && Math.abs(geometry.dy) < 1 && geometry.fits,
          JSON.stringify(geometry)
        );
        assert.ok(geometry.surface.every((n) => Math.abs(n) < 1));
      };
      const closed = async () => {
        await page.waitForTimeout(300);
        assert.equal(await card.getAttribute('data-open'), 'false');
        assert.equal((await axDialogs()).length, 0);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        assert.equal(await active(), 'trigger');
      };
      await part('trigger').focus();
      await page.keyboard.press('Enter');
      await opened();
      assert.equal(
        await content.evaluate((el) => el.contains(document.activeElement)),
        true,
        'entry belongs to Content'
      );
      // C-AS-FOCUS-SCOPE-0002 H/I: native Tab wrap and recovery. An arbitrary
      // DOM .focus() is not the governed Proto focus-request gate (E).
      await part('icon').focus();
      await page.keyboard.press('Tab');
      assert.equal(await active(), 'trigger-a');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await active(), 'icon');
      await part('trigger').focus();
      await page.keyboard.press('Tab');
      assert.equal(
        await content.evaluate((el) => el.contains(document.activeElement)),
        true,
        'Tab recovers into active scope'
      );
      await component('trigger-a').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await active(), 'trigger-b');
      await page.keyboard.press('Tab');
      assert.equal(
        await content.locator('[data-s3-details]').evaluate((el) => document.activeElement === el),
        true,
        'scope preserves native panel entry'
      );
      await component('trigger-c').click();
      await page.keyboard.press('Tab');
      assert.equal(await active(), 'content-c', 'empty panel remains a tab stop in scope');
      await component('trigger-b').focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('Tab');
      assert.equal(await active(), 'switch');
      await page.keyboard.press('Space');
      await component('checkbox').click();
      await component('button').click();
      await page.waitForTimeout(40);
      assert.deepEqual(await model(), {
        checked: true,
        checkboxChecked: true,
        switchChanges: 1,
        checkboxChanges: 1,
        clicks: 1,
      });
      // Internal clicks never produce outside-dismiss requests.
      assert.equal((await requests()).length, 1);
      const badgePaint = () =>
        component('badge').evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot?.querySelector('[part=surface]') ?? el).backgroundColor
        );
      const initialBadge = await badgePaint();
      await content.locator('[data-s4-action=tone]').click();
      const updatedBadge = await badgePaint();
      assert.notEqual(updatedBadge, initialBadge, 'live tone changes actual Badge paint');
      await content.locator('[data-s4-action=slot]').click();
      assert.equal(await component('badge').textContent(), 'Updated');
      await content.locator('[data-s4-action=disabled]').click();
      assert.equal(await component('switch').getAttribute('aria-disabled'), 'true');
      const disabledBox = await component('switch').boundingBox();
      await page.mouse.click(
        disabledBox.x + disabledBox.width / 2,
        disabledBox.y + disabledBox.height / 2
      );
      assert.equal((await model()).switchChanges, 1);
      await component('trigger-a').focus();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        assert.ok(
          !['switch', 'checkbox', 'button'].includes(await active()),
          'disabled settings are not tab stops'
        );
      }
      await content.locator('[data-s4-action=disabled]').click();
      await content.locator('[data-s4-action=scheme]').click();
      await page.waitForTimeout(80);
      const dark = await content.evaluate(
        (el) =>
          getComputedStyle(el.shadowRoot?.querySelector('[part=surface]') ?? el).backgroundColor
      );
      await content.locator('[data-s4-action=scheme]').click();
      await page.waitForTimeout(80);
      assert.notEqual(
        await content.evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot?.querySelector('[part=surface]') ?? el).backgroundColor
        ),
        dark
      );
      const reject = content.locator('[data-s4-reject]');
      await reject.check();
      for (const dismiss of [
        () => page.keyboard.press('Escape'),
        () => part('close').click(),
        () => part('icon').click(),
        () => page.mouse.click(5, 5),
      ]) {
        const before = (await requests()).length;
        await dismiss();
        await opened();
        assert.equal((await requests()).length, before + 1, 'one request per declined dismissal');
      }
      await reject.uncheck();
      for (const dismiss of [
        () => page.keyboard.press('Escape'),
        () => part('close').click(),
        () => part('icon').click(),
        () => page.mouse.click(5, 5),
      ]) {
        const before = (await requests()).length;
        await dismiss();
        await closed();
        assert.equal((await requests()).length, before + 1);
        await part('trigger').click();
        await opened();
        assert.deepEqual(await model(), {
          checked: true,
          checkboxChecked: true,
          switchChanges: 1,
          checkboxChanges: 1,
          clicks: 1,
        });
        assert.equal(await component('switch').getAttribute('aria-checked'), 'true');
        assert.equal(await component('checkbox').getAttribute('aria-checked'), 'true');
        assert.equal(await badgePaint(), updatedBadge);
        assert.equal(await component('badge').textContent(), 'Updated');
      }
      const beforeMove = await counts();
      await content.locator('[data-s4-action=move]').click();
      await opened();
      assert.deepEqual(await counts(), beforeMove);
      await content.locator('[data-s4-action=remove]').click();
      await page.waitForTimeout(100);
      assert.equal((await axDialogs()).length, 0);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      const removed = await counts();
      assert.ok(Object.values(removed).every((v) => v.dispose >= 1));
      assert.equal(await page.locator(`[data-s4-profile=${profile}]`).count(), 0);
      await card.locator('[data-s4-action=reconnect]').click();
      await part('trigger').click();
      await opened();
      assert.equal((await model()).checked, true);
      await component('switch').click();
      await page.waitForTimeout(40);
      assert.equal(
        (await model()).switchChanges,
        2,
        'no duplicate listeners after view/owner recreation'
      );
      assert.equal((await model()).checked, false);
      await page.setViewportSize({ width: 480, height: 900 });
      await opened();
      await page.keyboard.press('Escape');
      await closed();
      await page.setViewportSize({ width: 1440, height: 1000 });
      results.push({ profile, requests: (await requests()).length, counts: await counts() });
    }
    return results;
  } finally {
    await cdp.detach();
  }
}
