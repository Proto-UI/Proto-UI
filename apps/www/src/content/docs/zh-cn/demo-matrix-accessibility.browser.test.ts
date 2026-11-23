// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, CDPSession, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from './browser-harness';
import { collectMatrixInteractiveFacts } from './demo-matrix-observation';
import { collectMatrixAccessibilityFacts } from './demo-matrix-accessibility';

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
  const sourcePath = 'apps/www/src/content/docs/zh-cn/demo-matrix-accessibility.ts';
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
    { id: 'size-1', attributes: 'size="1"', domRole: 'combobox', nativeRole: 'combobox' },
    { id: 'size-4', attributes: 'size="4"', domRole: 'listbox', nativeRole: 'listbox' },
    {
      id: 'multiple-size-1',
      attributes: 'multiple size="1"',
      domRole: 'listbox',
      nativeRole: 'combobox',
    },
    {
      id: 'multiple-size-4',
      attributes: 'multiple size="4"',
      domRole: 'listbox',
      nativeRole: 'listbox',
    },
  ])(
    'observes $id using Chromium facts and retains HTML-AAM comparison',
    async ({ id, attributes, domRole, nativeRole }) => {
      const page = await browser.newPage();
      const cdp = await page.context().newCDPSession(page);
      const samples: unknown[] = [];
      let failure: unknown;
      const roles = ['combobox', 'listbox'];
      try {
        await page.setContent(
          matrix(
            `<label for="native">Destination</label><select id="native" ${attributes}><option>First</option><option>Second</option></select>`,
            `<div id="explicit" role="${domRole}" aria-label="Destination" tabindex="0">First</div>`
          )
        );
        const approximation = (await page.evaluate(collectMatrixInteractiveFacts, roles)).control;
        const observer = await collectMatrixAccessibilityFacts(page, roles);
        const native = await axFact(cdp, '#native');
        const explicit = await axFact(cdp, '#explicit');
        samples.push({ step: 'native-and-html-aam', approximation, observer, native, explicit });
        expect(approximation).toEqual([
          [{ role: domRole, name: 'Destination' }],
          [{ role: domRole, name: 'Destination' }],
        ]);
        // Chromium's own select-listbox-modes fixture maps multiple size=1 to
        // comboBoxSelect. Keep that platform fact separate from HTML-AAM's
        // multiple=>listbox expectation, without a UA sniff in the collector.
        // https://chromium.googlesource.com/chromium/src/+/1397c45b3e2ebf77a4f6480da0fae2c88349c28b/content/test/data/accessibility/html/select-listbox-modes-expected-blink.txt
        expect(native.role).toBe(nativeRole);
        for (const [index, actual] of [native, explicit].entries())
          expect(observer.facts.control![index]![0]).toEqual({
            role: actual.role,
            name: actual.name,
          });
        if (id === 'multiple-size-1') {
          // This is the original false green: DOM inference calls both listbox,
          // while real native and explicit roles differ. The AX observer rejects it.
          expect(approximation[0]).toEqual(approximation[1]);
          expect(() =>
            expect(observer.facts.control![0]).toEqual(observer.facts.control![1])
          ).toThrow();
          expect(() =>
            expect({ role: native.role, name: native.name }).toEqual(approximation[0]![0])
          ).toThrow();
          await page
            .locator('#explicit')
            .evaluate((element, role) => element.setAttribute('role', role), nativeRole);
        }
        const equivalent = await collectMatrixAccessibilityFacts(page, roles);
        samples.push({ step: 'actual-role-equivalence', observer: equivalent });
        expect(equivalent.facts.control).toEqual([
          [{ role: nativeRole, name: 'Destination' }],
          [{ role: nativeRole, name: 'Destination' }],
        ]);
        await page
          .locator('#explicit')
          .evaluate(
            (element, wrongRole) => element.setAttribute('role', wrongRole),
            nativeRole === 'combobox' ? 'listbox' : 'combobox'
          );
        const negative = await collectMatrixAccessibilityFacts(page, roles);
        const changed = await axFact(cdp, '#explicit');
        samples.push({ step: 'wrong-role-negative', observer: negative, explicit: changed });
        expect(negative.facts.control![1]![0]!.role).toBe(changed.role);
        expect(() =>
          expect(negative.facts.control![0]).toEqual(negative.facts.control![1])
        ).toThrow();
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
    }
  );

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
        approximation: (await page.evaluate(collectMatrixInteractiveFacts, ['textbox'])).control,
        observer: await collectMatrixAccessibilityFacts(page, ['textbox']),
        native: await axFact(cdp, '#native'),
        explicit: await axFact(cdp, '#explicit'),
      });
      const before = await read();
      samples.push({ step: 'three-ordered-labels', ...before });
      expect(before.observer.facts.control).toEqual([
        [{ role: 'textbox', name: 'First Second Third' }],
        [{ role: 'textbox', name: 'First Second Third' }],
      ]);
      expect(before.approximation).toEqual(before.observer.facts.control);
      expect(before.native.name).toBe('First Second Third');
      expect(before.explicit.name).toBe(before.native.name);
      await page
        .locator('#second')
        .evaluate((label) => label.replaceWith(label.querySelector('input')!));
      const after = await read();
      samples.push({ step: 'second-label-removed', ...after });
      expect(after.native.name).toBe('First Third');
      expect(after.explicit.name).toBe('First Second Third');
      expect(after.observer.facts.control![0]![0]!.name).toBe(after.native.name);
      expect(after.observer.facts.control![1]![0]!.name).toBe(after.explicit.name);
      expect(() =>
        expect(after.observer.facts.control![0]).toEqual(after.observer.facts.control![1])
      ).toThrow();
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
