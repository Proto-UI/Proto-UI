import assert from 'node:assert/strict';

export async function runS5Journey(page) {
  const scene = page.locator('[data-shadow-s5]');
  await scene.locator('[data-s5-profile=split] textarea').first().waitFor();
  const action = (key) => scene.locator(`[data-s5-action=${key}]`).click();
  const cards = ['light', 'split', 'mixed'];
  const host = (profile, key) =>
    scene.locator(`[data-s5-profile=${profile}] [data-s5-component=${key}]`);
  const editor = (profile, key) => host(profile, key).locator('input,textarea');
  const metrics = async () => {
    const result = {};
    for (const profile of cards) {
      result[profile] = {};
      for (const key of ['input', 'base', 'styled', 'tab'])
        result[profile][key] = await editor(profile, key).evaluate((el) => {
          const r = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          return {
            width: r.width,
            height: r.height,
            font: s.font,
            padding: s.padding,
            border: s.borderWidth,
            minHeight: s.minHeight,
            display: s.display,
            color: s.color,
          };
        });
    }
    return result;
  };
  const initial = await metrics();
  const parity = (actual, expected, label = '') => {
    const { width: aw, height: ah, ...a } = actual,
      { width: ew, height: eh, ...e } = expected;
    assert.ok(
      Math.abs(aw - ew) < 0.1 && Math.abs(ah - eh) < 0.1,
      `${label}: geometry ${aw}x${ah} vs ${ew}x${eh}`
    );
    assert.deepEqual(a, e, label);
  };
  for (const key of ['input', 'base', 'styled', 'tab']) {
    parity(initial.split[key], initial.light[key], `${key}: split/light physical metrics`);
    parity(initial.mixed[key], initial.light[key], `${key}: mixed/light physical metrics`);
  }
  for (const profile of cards) {
    for (const key of ['input', 'base', 'styled', 'tab']) {
      const el = editor(profile, key);
      await el.fill(`${key} edited`);
      assert.equal(await el.inputValue(), `${key} edited`);
      const counts = JSON.parse(
        await scene.locator(`[data-s5-profile=${profile}]`).getAttribute('data-counts')
      );
      assert.equal(
        counts[`${key}:valueChange`],
        1,
        `${profile}/${key}: one normalized notification`
      );
    }
    const el = editor(profile, 'styled');
    // Selection survives a real unrelated update without blur from clicking controls.
    const selection = await el.evaluate(async (target) => {
      const host =
        target.getRootNode() instanceof ShadowRoot
          ? target.getRootNode().host
          : target.parentElement;
      target.focus();
      target.setSelectionRange(2, 5, 'backward');
      host.update();
      await new Promise((resolve) => queueMicrotask(resolve));
      return {
        start: target.selectionStart,
        end: target.selectionEnd,
        direction: target.selectionDirection,
        active: target.getRootNode().activeElement === target,
        focused: host.getExposes().focused.get(),
        focusVisible: host.getExposes().focusVisible.get(),
        nativeFocusVisible: target.matches(':focus-visible'),
      };
    });
    assert.equal(
      selection.focusVisible,
      selection.nativeFocusVisible,
      `${profile}: native focus-visible parity`
    );
    assert.deepEqual(
      { ...selection, focusVisible: true, nativeFocusVisible: true },
      {
        start: 2,
        end: 5,
        direction: 'backward',
        active: true,
        focused: true,
        focusVisible: true,
        nativeFocusVisible: true,
      }
    );
  }
  await action('reject');
  for (const profile of cards) {
    await editor(profile, 'styled').fill('rejected');
    await page.waitForTimeout(25);
    assert.equal(await editor(profile, 'styled').inputValue(), 'styled edited');
    // Protocol simulation, not a claim about a real platform IME session.
    const during = await editor(profile, 'styled').evaluate(async (target) => {
      target.focus();
      target.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true, composed: true })
      );
      target.value = '候选文字';
      target.setSelectionRange(1, 3);
      const section = document.querySelector('[data-shadow-s5]');
      section.querySelector('[data-s5-action=patch]').click();
      await new Promise((resolve) => queueMicrotask(resolve));
      const during = {
        value: target.value,
        start: target.selectionStart,
        end: target.selectionEnd,
        connected: target.isConnected,
      };
      target.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '候选文字' })
      );
      return during;
    });
    assert.deepEqual(during, { value: '候选文字', start: 1, end: 3, connected: true });
    await page.waitForTimeout(25);
    assert.equal(await editor(profile, 'styled').inputValue(), 'styled edited');
  }
  await action('reject');
  await action('rows');
  const taller = await metrics();
  assert.ok(taller.split.styled.height > initial.split.styled.height);
  for (const key of ['base', 'styled', 'tab']) parity(taller.split[key], taller.light[key]);
  await action('custom');
  await page.waitForTimeout(200);
  for (const profile of cards)
    assert.equal(
      await editor(profile, 'styled').evaluate((el) => getComputedStyle(el).color),
      'rgb(109, 40, 217)',
      `${profile}: ${await editor(profile, 'styled').getAttribute('style')}`
    );
  await action('custom');
  await action('readOnly');
  for (const profile of cards) {
    const el = editor(profile, 'styled');
    await el.focus();
    await page.keyboard.type('blocked');
    assert.equal(await el.inputValue(), 'styled edited');
  }
  await action('readOnly');
  await action('disabled');
  for (const profile of cards) assert.equal(await editor(profile, 'styled').isDisabled(), true);
  await action('disabled');
  const lightPaint = await editor('split', 'styled').evaluate(
    (el) => getComputedStyle(el).backgroundColor
  );
  await action('theme');
  await page.waitForTimeout(250);
  const darkPaint = await editor('split', 'styled').evaluate(
    (el) => getComputedStyle(el).backgroundColor
  );
  assert.notEqual(darkPaint, lightPaint, 'dark paint must actually change');
  for (const profile of cards)
    assert.equal(
      await editor(profile, 'styled').evaluate((el) => getComputedStyle(el).backgroundColor),
      darkPaint
    );
  await action('theme');
  await page.waitForTimeout(250);
  for (const keep of [false, true]) {
    if (keep) await action('keepMounted');
    for (const profile of cards)
      for (let i = 0; i < 3; i++) {
        await host(profile, 'trigger-b').click();
        assert.equal(await editor(profile, 'tab').isVisible(), false);
        await host(profile, 'trigger-a').click();
        assert.equal(await editor(profile, 'tab').inputValue(), 'tab edited');
      }
  }
  for (const profile of cards) {
    await host(profile, 'trigger-a').focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await editor(profile, 'tab').evaluate((el) => el.getRootNode().activeElement === el),
      true,
      `${profile}: Tab enters native editor: ${await page.evaluate(() => {
        let el = document.activeElement;
        while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
        return el?.outerHTML.slice(0, 1000);
      })}`
    );
    await host(profile, 'styled').evaluate((el) => el.getExposes().focusSelf());
    assert.equal(
      await editor(profile, 'styled').evaluate((el) => el.getRootNode().activeElement === el),
      true
    );
    await host(profile, 'styled').evaluate((el) => el.getExposes().blurSelf());
    assert.equal(
      await editor(profile, 'styled').evaluate((el) => el.getRootNode().activeElement === el),
      false
    );
  }
  // Exactly one accessible editor per native root, with its actual name.
  const client = await page.context().newCDPSession(page);
  const ax = await client.send('Accessibility.getFullAXTree');
  for (const profile of cards)
    for (const key of ['input', 'base', 'styled', 'tab']) {
      const matches = ax.nodes.filter(
        (n) => !n.ignored && n.role?.value === 'textbox' && n.name?.value === `${profile} ${key}`
      );
      assert.equal(matches.length, 1, `${profile}/${key}: single named AX textbox`);
    }
  await client.detach();
  await action('disconnect');
  await page.waitForTimeout(30);
  await action('disconnect');
  for (const profile of cards)
    assert.equal(await editor(profile, 'styled').inputValue(), 'styled edited');
  return {
    profiles: cards,
    initial,
    checks:
      'native metrics, controlled/uncontrolled, one notification, selection, synthetic composition, rows, customization, readOnly/disabled, Tabs epochs, AX, reconnect',
  };
}
