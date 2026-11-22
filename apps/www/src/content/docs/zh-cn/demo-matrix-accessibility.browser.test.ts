// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, CDPSession, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from './browser-harness';
import { collectMatrixInteractiveFacts } from './demo-matrix-observation';

// Bounded HTML-AAM controls, not an audit of all Demo Matrix content or ATs.
// https://www.w3.org/TR/html-aam-1.0/#el-select
// https://www.w3.org/TR/html-aam-1.0/#accname-computation
let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
});

function matrix(native: string, explicit: string) {
  return `<style>body { font: 16px sans-serif; padding: 24px } .demo-matrix__adapters { display: flex; gap: 40px } .demo-matrix__adapter { width: 280px } [role] { min-height: 24px; border: 1px solid; padding: 4px }</style>
    <article class="demo-matrix__item" id="control"><div class="demo-matrix__adapters">
    <section class="demo-matrix__adapter">${native}</section>
    <section class="demo-matrix__adapter">${explicit}</section>
    </div></article>`;
}
async function axFact(cdp: CDPSession, selector: string) {
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  expect(nodeId, `DOM node for ${selector}`).toBeGreaterThan(0);
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', {
    backendNodeId: node.backendNodeId,
    fetchRelatives: false,
  });
  const observed = nodes.find((item) => item.backendDOMNodeId === node.backendNodeId);
  expect(observed?.ignored, `AX node for ${selector}`).toBe(false);
  return {
    role: String(observed?.role?.value ?? ''),
    name: String(observed?.name?.value ?? ''),
    raw: observed,
  };
}
async function record(page: Page, id: string, samples: unknown[], error?: unknown) {
  const evidence =
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? process.env.PROTO_UI_BROWSER_EVIDENCE_DIR;
  if (!evidence) return;
  const directory = path.join(evidence, 'demo-matrix-accessibility');
  await mkdir(directory, { recursive: true });
  const sourcePath = 'apps/www/src/content/docs/zh-cn/demo-matrix-observation.ts';
  await writeFile(
    path.join(directory, `${id}.json`),
    JSON.stringify(
      {
        sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        sourcePath,
        sourceDigest: createHash('sha256')
          .update(await readFile(sourcePath))
          .digest('hex'),
        browser: browser.version(),
        samples,
        terminal: error ? 'failed' : 'passed',
        error: error ? String(error) : null,
        boundary:
          'Chromium AX facts for named native/explicit controls; not physical assistive-technology acceptance or a complete accessible-name implementation.',
      },
      null,
      2
    )
  );
  await page.screenshot({ path: path.join(directory, `${id}.png`) });
}

describe('Demo Matrix observer against native Chromium accessibility facts', () => {
  it.each([
    { id: 'size-1', attributes: 'size="1"', role: 'combobox' },
    { id: 'size-4', attributes: 'size="4"', role: 'listbox' },
    { id: 'multiple-size-1', attributes: 'multiple size="1"', role: 'listbox' },
    { id: 'multiple-size-4', attributes: 'multiple size="4"', role: 'listbox' },
  ])('observes native and explicit $id as $role', async ({ id, attributes, role }) => {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    const samples: unknown[] = [];
    let failure: unknown;
    try {
      await page.setContent(
        matrix(
          `<label for="native">Destination</label><select id="native" ${attributes}><option>First</option><option>Second</option></select>`,
          `<div id="explicit" role="${role}" aria-label="Destination" tabindex="0">First</div>`
        )
      );
      const observer = (await page.evaluate(collectMatrixInteractiveFacts, ['combobox', 'listbox']))
        .control;
      const native = await axFact(cdp, '#native');
      const explicit = await axFact(cdp, '#explicit');
      samples.push({ step: 'positive', observer, native, explicit });
      expect(observer).toEqual([[{ role, name: 'Destination' }], [{ role, name: 'Destination' }]]);
      for (const actual of [native, explicit])
        expect({ role: actual.role, name: actual.name }).toEqual(observer[0]![0]);
      // A wrong explicit role must remain a parity failure in both observations.
      await page
        .locator('#explicit')
        .evaluate(
          (element, wrongRole) => element.setAttribute('role', wrongRole),
          role === 'combobox' ? 'listbox' : 'combobox'
        );
      const negative = (await page.evaluate(collectMatrixInteractiveFacts, ['combobox', 'listbox']))
        .control;
      const changed = await axFact(cdp, '#explicit');
      samples.push({ step: 'wrong-role-negative', observer: negative, explicit: changed });
      expect(negative[1]![0]!.role).toBe(changed.role);
      expect(() => expect(negative[0]).toEqual(negative[1])).toThrow();
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      try {
        await record(page, id, samples, failure);
      } finally {
        await cdp.detach();
        await page.close();
      }
    }
  });

  it('preserves ordered explicit and wrapping labels and catches the lost-second-label negative', async () => {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    const samples: unknown[] = [];
    let failure: unknown;
    try {
      await page.setContent(
        matrix(
          '<label for="native">First</label><label id="second">Second<input id="native"></label><label for="native">Third</label>',
          '<span id="first">First</span><span id="middle">Second</span><span id="last">Third</span><div id="explicit" role="textbox" aria-labelledby="first middle last"></div>'
        )
      );
      const read = async () => ({
        observer: (await page.evaluate(collectMatrixInteractiveFacts, ['textbox'])).control,
        native: await axFact(cdp, '#native'),
        explicit: await axFact(cdp, '#explicit'),
      });
      const before = await read();
      samples.push({ step: 'three-ordered-labels', ...before });
      expect(before.observer).toEqual([
        [{ role: 'textbox', name: 'First Second Third' }],
        [{ role: 'textbox', name: 'First Second Third' }],
      ]);
      expect(before.native.name).toBe('First Second Third');
      expect(before.explicit.name).toBe(before.native.name);
      await page
        .locator('#second')
        .evaluate((label) => label.replaceWith(label.querySelector('input')!));
      const after = await read();
      samples.push({ step: 'second-label-removed', ...after });
      expect(after.native.name).toBe('First Third');
      expect(after.explicit.name).toBe('First Second Third');
      expect(after.observer[0]![0]!.name).toBe(after.native.name);
      expect(after.observer[1]![0]!.name).toBe(after.explicit.name);
      expect(() => expect(after.observer[0]).toEqual(after.observer[1])).toThrow();
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      try {
        await record(page, 'ordered-labels', samples, failure);
      } finally {
        await cdp.detach();
        await page.close();
      }
    }
  });
});
