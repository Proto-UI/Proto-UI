// Shared native acceptance path for public-dist standalone and demo-matrix.
import assert from 'node:assert/strict';
const scope = '[data-shadow-s3]';
const profiles = ['light', 'split', 'mixed'];
const component = (page, profile, key) =>
  page.locator(`${scope} [data-s3-profile="${profile}"] [data-s3-component="${key}"]`);
const settle = (page) => page.waitForTimeout(240);
async function action(page, key) {
  await page.locator(`${scope} [data-action="${key}"]`).click();
  await settle(page);
}
async function option(page, key, value) {
  await page.locator(`${scope} [data-option="${key}"]`).selectOption(value);
  await settle(page);
}
export async function sampleS3(page) {
  return page.locator(scope).evaluate((section) =>
    Array.from(section.querySelectorAll('[data-s3-profile]')).map((column) => {
      const get = (key) => column.querySelector(`[data-s3-component="${key}"]`);
      const measure = (key) => {
        const el = get(key),
          r = el.getBoundingClientRect(),
          surface = el.shadowRoot?.querySelector('[part="surface"]') ?? el,
          s = surface.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          surfaceWidth: s.width,
          surfaceHeight: s.height,
          bg: getComputedStyle(surface).backgroundColor,
          opacity: getComputedStyle(surface).opacity,
        };
      };
      return {
        profile: column.dataset.s3Profile,
        value: column.dataset.value,
        changes: Number(column.dataset.changes),
        counts: JSON.parse(column.dataset.counts),
        model: JSON.parse(column.dataset.model),
        geometry: Object.fromEntries(
          [
            'root',
            'list',
            'trigger-a',
            'trigger-b',
            'switch',
            'thumb',
            'checkbox',
            'button',
            'badge',
          ].map((k) => [k, measure(k)])
        ),
        panels: ['a', 'b', 'c', 'd'].map((v) => {
          const el = get(`content-${v}`),
            trigger = get(`trigger-${v}`);
          return {
            value: v,
            id: el.id,
            triggerId: trigger.id,
            label: trigger.textContent,
            controls: trigger.getAttribute('aria-controls'),
            labelledBy: el.getAttribute('aria-labelledby'),
            display: getComputedStyle(el).display,
            height: el.getBoundingClientRect().height,
            detached: el.hasAttribute('data-pui-view-detached'),
          };
        }),
        slot: get('button').textContent,
        slotOwned: get('button').childNodes[0]?.getRootNode() === document,
        checked: get('switch').getAttribute('aria-checked'),
        checkboxChecked: get('checkbox').getAttribute('aria-checked'),
        thumbX: get('thumb').getBoundingClientRect().x - get('switch').getBoundingClientRect().x,
        glyphs: Array.from(
          (get('indicator').shadowRoot ?? get('indicator')).querySelectorAll('path')
        ).map((p) => p.getAttribute('d')),
      };
    })
  );
}
function parity(rows) {
  for (const row of rows)
    for (const [key, geometry] of Object.entries(row.geometry))
      for (const field of ['width', 'height', 'surfaceWidth', 'surfaceHeight'])
        assert.ok(
          Math.abs(geometry[field] - rows[0].geometry[key][field]) < 0.1,
          `${row.profile}/${key}/${field}: ${JSON.stringify(rows.map((r) => r.geometry[key]))}`
        );
}
async function selected(page, profile, value) {
  await settle(page);
  assert.equal(
    await component(page, profile, `trigger-${value}`).getAttribute('aria-selected'),
    'true',
    `${profile}/selected ${value}: ${JSON.stringify(await page.locator(`${scope} [data-s3-profile="${profile}"]`).evaluate((el) => ({ value: el.dataset.value, changes: el.dataset.changes })))}`
  );
}
async function focused(page, profile, key) {
  assert.equal(
    await component(page, profile, key).evaluate((el) => document.activeElement === el),
    true,
    `${profile}/focus ${key}: ${JSON.stringify(
      await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          tabindex: el?.getAttribute('tabindex'),
          disabled: el?.getAttribute('aria-disabled'),
          key: el?.getAttribute('data-s3-component'),
          model: el?.closest('[data-s3-profile]')?.getAttribute('data-model'),
        };
      })
    )}`
  );
  // C-HOST-SURFACE-PROJECTION-0001 C/D; these Shadcn Roots explicitly
  // declare outline-none. A surface ring alone must not hide a second UA ring.
  const paint = await component(page, profile, key).evaluate((el) => {
    const surface = el.shadowRoot?.querySelector('[part="surface"]') ?? el;
    const host = getComputedStyle(el),
      visual = getComputedStyle(surface);
    return {
      split: surface !== el,
      outline: host.outlineStyle,
      color: host.outlineColor,
      focusVisible: el.hasAttribute('data-focus-visible'),
      ring: visual.getPropertyValue('--pui-ring-width').trim(),
      shadow: visual.boxShadow,
    };
  });
  if (paint.split)
    assert.equal(paint.outline, 'none', `${profile}/${key}/no duplicate host outline`);
  else assert.notEqual(paint.outline, 'auto', `${profile}/${key}/authored outline replaces UA`);
  if (paint.focusVisible && ['switch', 'checkbox', 'button'].includes(key)) {
    assert.equal(paint.ring, '3px', `${profile}/${key}/surface focus ring width`);
    assert.notEqual(paint.shadow, 'none', `${profile}/${key}/surface focus ring paint`);
  }
}
async function press(page, key) {
  await page.keyboard.press(key);
  await settle(page);
}

// P-BASE-TABS-{LIST,TRIGGER,CONTENT}, C-LIFECYCLE-0008 and I1.
// Native Playwright input + actual AX tree; no synthetic routing or focus repair.
export async function runS3Journey(page, { keepMounted = false } = {}) {
  await page.waitForSelector(`${scope}[data-ready=true]`);
  await settle(page);
  if (keepMounted) await action(page, 'keepMounted');
  let rows = await sampleS3(page);
  parity(rows);
  for (const row of rows) {
    assert.equal(row.value, 'a');
    assert.equal(row.geometry.list.height, 36);
    assert.equal(row.geometry['trigger-a'].height, 29);
    assert.equal(row.geometry.switch.width, 44);
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    const verifyPanels = async () => {
      const snapshots = await sampleS3(page),
        ax = await cdp.send('Accessibility.getFullAXTree');
      const { root } = await cdp.send('DOM.getDocument');
      let activePanels = 0;
      for (const row of snapshots)
        for (const panel of row.panels) {
          const { nodeId } = await cdp.send('DOM.querySelector', {
            nodeId: root.nodeId,
            selector: `${scope} [data-s3-profile="${row.profile}"] [data-s3-component="content-${panel.value}"]`,
          });
          const { node } = await cdp.send('DOM.describeNode', { nodeId });
          const panelAX = ax.nodes.find(
            (n) => n.backendDOMNodeId === node.backendNodeId && !n.ignored
          );
          const active = panel.value === row.value;
          assert.equal(Boolean(panelAX), active, `${row.profile}/${panel.value}/AX visibility`);
          assert.equal(
            panel.display === 'none',
            !active,
            `${row.profile}/${panel.value}/actual display`
          );
          assert.equal(panel.detached, !keepMounted && !active);
          if (!active) assert.equal(panel.height, 0);
          if (active || keepMounted) {
            assert.equal(panel.controls, panel.id);
            assert.equal(panel.labelledBy, panel.triggerId);
          }
          if (active) {
            activePanels++;
            assert.ok(
              [panelAX].some(
                (n) =>
                  n &&
                  !n.ignored &&
                  n.role?.value === 'tabpanel' &&
                  n.name?.value === panel.label &&
                  n.properties?.some(
                    (p) =>
                      p.name === 'labelledby' &&
                      p.value.relatedNodes?.some((r) => r.idref === panel.triggerId)
                  )
              ),
              `${row.profile}/actual AX labelledby`
            );
          }
        }
      assert.equal(activePanels, 3, 'only three current S3 panels in AX (scoped by DOM identity)');
    };
    await verifyPanels();
    for (const profile of profiles) {
      await component(page, profile, 'trigger-a').focus();
      await press(page, 'ArrowRight');
      await focused(page, profile, 'trigger-b');
      await selected(page, profile, 'b');
      await press(page, 'Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement?.hasAttribute('data-s3-details')),
        true
      );
      await press(page, 'Shift+Tab');
      await focused(page, profile, 'trigger-b');
      await press(page, 'End');
      await selected(page, profile, 'c');
      await press(page, 'Tab');
      await focused(page, profile, 'content-c');
      await press(page, 'Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute('data-s3-after')),
        profile
      );
      await component(page, profile, 'trigger-c').focus();
      await press(page, 'ArrowRight');
      await focused(page, profile, 'trigger-c');
      await press(page, 'Home');
      await selected(page, profile, 'a');
      await press(page, 'Tab');
      await focused(page, profile, 'switch');
      await press(page, 'Space');
      await press(page, 'Tab');
      await focused(page, profile, 'checkbox');
      await press(page, 'Space');
      await press(page, 'Tab');
      await focused(page, profile, 'button');
      await press(page, 'Enter');
    }
    await verifyPanels();
    rows = await sampleS3(page);
    for (const row of rows) {
      assert.deepEqual(row.model, {
        checked: true,
        checkboxChecked: true,
        switchChanges: 1,
        checkboxChanges: 1,
        clicks: 1,
      });
      assert.equal(row.changes, 3);
      assert.equal(row.checked, 'true');
      assert.equal(row.checkboxChecked, 'true');
      assert.equal(row.thumbX, 21);
      assert.deepEqual(row.glyphs, ['m20 6-11 11-5-5']);
    }
    await option(page, 'activationMode', 'manual');
    for (const profile of profiles) {
      await component(page, profile, 'trigger-a').focus();
      await press(page, 'ArrowRight');
      await focused(page, profile, 'trigger-b');
      await selected(page, profile, 'a');
      await press(page, 'Enter');
      await selected(page, profile, 'b');
      await press(page, 'Home');
      await selected(page, profile, 'b');
      await press(page, 'Space');
      await selected(page, profile, 'a');
    }
    await option(page, 'activationMode', 'automatic');
    await option(page, 'orientation', 'vertical');
    for (const profile of profiles) {
      await component(page, profile, 'trigger-a').focus();
      await press(page, 'ArrowRight');
      await focused(page, profile, 'trigger-a');
      await press(page, 'ArrowDown');
      await selected(page, profile, 'b');
      await press(page, 'ArrowUp');
      await selected(page, profile, 'a');
    }
    await option(page, 'orientation', 'horizontal');
    await action(page, 'loop');
    for (const profile of profiles) {
      await component(page, profile, 'trigger-a').focus();
      await press(page, 'ArrowLeft');
      await selected(page, profile, 'c');
      await press(page, 'ArrowRight');
      await selected(page, profile, 'a');
    }
    await action(page, 'loop');
    // Repeated view epochs, then compounded consumer changes while A is absent.
    for (let i = 0; i < 3; i++)
      for (const profile of profiles) {
        await component(page, profile, 'trigger-b').click();
        await selected(page, profile, 'b');
        await component(page, profile, 'trigger-a').click();
        await selected(page, profile, 'a');
      }
    for (const profile of profiles) await component(page, profile, 'trigger-b').click();
    await settle(page);
    await verifyPanels();
    for (const key of ['slot', 'checked', 'tone', 'scheme', 'disabled']) await action(page, key);
    for (const profile of profiles) await component(page, profile, 'trigger-a').click();
    await settle(page);
    rows = await sampleS3(page);
    parity(rows);
    for (const row of rows) {
      assert.equal(row.checked, 'false');
      assert.equal(row.checkboxChecked, 'false');
      assert.equal(row.thumbX, 3);
      assert.deepEqual(row.glyphs, []);
      assert.equal(row.slotOwned, true);
      assert.equal(
        row.slot,
        (await page.locator(scope).getAttribute('data-lang')) === 'en'
          ? 'Save preferences'
          : '保存设置'
      );
      for (const key of ['button', 'switch', 'checkbox']) {
        assert.equal(row.geometry[key].opacity, '0.5');
        assert.equal(row.geometry[key].bg, rows[0].geometry[key].bg);
      }
      assert.equal(row.geometry.badge.bg, 'rgb(133, 215, 255)');
      assert.equal(row.counts['content-a'].setup, 1);
      if (keepMounted) {
        assert.equal(row.counts['content-a'].mount, 1);
        assert.equal(row.counts['content-a'].unmount, 0);
      } else assert.ok(row.counts['content-a'].mount > 5);
    }
    // Actual pointer hit testing (not DOM dispatch) must not activate disabled
    // rematerialized settings. Native sequential focus must skip them too.
    for (const profile of profiles) {
      for (const key of ['button', 'switch', 'checkbox']) {
        const target = component(page, profile, key);
        assert.equal(await target.getAttribute('aria-disabled'), 'true');
        assert.ok(
          await target.evaluate((el) => el.tabIndex < 0),
          `${profile}/${key}/disabled tabindex`
        );
        // Center the target below the website's sticky header, then wait past
        // scrolling/paint. A coordinate click must not hit unrelated controls.
        await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await settle(page);
        const box = await target.boundingBox();
        assert.ok(box);
        assert.ok(
          await target.evaluate((el) => {
            const box = el.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return hit && el.closest('[data-s3-component="content-a"]')?.contains(hit);
          }),
          `${profile}/${key}/pointer hits current panel, not an overlay`
        );
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.equal(await target.getAttribute('aria-disabled'), 'true');
      }
      await component(page, profile, 'trigger-a').focus();
      await press(page, 'Tab');
      await focused(page, profile, 'content-a');
      await press(page, 'Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute('data-s3-after')),
        profile
      );
    }
    assert.deepEqual(
      (await sampleS3(page)).map((r) => r.model),
      rows.map((r) => r.model)
    );
    await action(page, 'disabled');
    await action(page, 'scheme');
    await settle(page);
    const before = await sampleS3(page);
    await action(page, 'move');
    const moved = await sampleS3(page);
    assert.deepEqual(
      moved.map((r) => r.counts),
      before.map((r) => r.counts)
    );
    const handles = await page.locator(`${scope} [data-s3-split]`).elementHandles();
    await action(page, 'disconnect');
    for (const handle of handles) {
      assert.equal(await handle.evaluate((el) => el.isConnected), false);
      assert.equal(await handle.evaluate((el) => el.shadowRoot?.childNodes.length), 0);
    }
    await action(page, 'tone');
    await action(page, 'disconnect');
    await settle(page);
    const final = await sampleS3(page);
    parity(final);
    for (let i = 0; i < final.length; i++) {
      const row = final[i];
      assert.equal(row.counts.root.setup, before[i].counts.root.setup + 1);
      for (const counts of Object.values(row.counts)) {
        assert.equal(counts.setup - counts.dispose, 1, `${row.profile}/single live owner`);
        assert.ok(
          counts.mount - counts.unmount >= 0 && counts.mount - counts.unmount <= 1,
          `${row.profile}/single live view`
        );
      }
      assert.equal(row.value, 'a');
      assert.equal(row.changes, before[i].changes);
      assert.deepEqual(row.model, before[i].model);
      assert.equal(row.slot, before[i].slot);
      assert.equal(row.geometry.badge.bg, 'rgb(255, 147, 127)');
    }
    for (const profile of profiles) {
      await component(page, profile, 'button').click();
      await component(page, profile, 'switch').click();
    }
    await settle(page);
    for (const row of await sampleS3(page)) {
      assert.equal(row.model.clicks, 2);
      assert.equal(row.model.switchChanges, 2);
      assert.equal(row.checked, 'true');
    }
    await verifyPanels();
    return {
      keepMounted,
      profiles,
      phases:
        'native navigation/activation/focus, AX/layout, repeated views, compound updates, move and reconnect',
    };
  } finally {
    await cdp.detach();
  }
}
