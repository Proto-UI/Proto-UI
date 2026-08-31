// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const ORDINARY_FLOW_GAP_PX = 16;
const SECTION_FLOW_GAP_PX = 64;
const GAP_TOLERANCE_PX = 0.5;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
] as const;

const SELECT_ROUTES = [
  { locale: 'en', path: '/en/ui-libraries/shadcn/select/' },
  { locale: 'zh-cn', path: '/zh-cn/ui-libraries/shadcn/select/' },
] as const;

const QUICK_START_ROUTES = [
  { locale: 'en', path: '/en/start-here/quick-start/' },
  { locale: 'zh-cn', path: '/zh-cn/start-here/quick-start/' },
] as const;

const ALL_ROUTES = [...SELECT_ROUTES, ...QUICK_START_ROUTES] as const;

type FlowFacts = {
  directChildCount: number;
  directGaps: number[];
  footerExists: boolean;
  footerInsideFlow: boolean;
  overflow: number;
};

type SelectFacts = {
  paragraphToPreviewer: number;
  previewerToHeading: number;
  headerToPanel: number;
  previousTag: string;
  nextClass: string;
};

type QuickStartFacts = {
  paragraphToExpressiveCode: number;
  expressiveCodeToParagraph: number;
  paragraphToCodeExample: number;
  codeExampleToParagraph: number;
  codeExampleStripToPanel: number;
  expressivePreviousTag: string;
  expressiveNextTag: string;
  examplePreviousTag: string;
  exampleNextTag: string;
};

let browser: Browser;
let baseUrl = '';

function expectGap(actual: number, expected: number, label: string): void {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ${expected}px, received ${actual}px`
  ).toBeLessThanOrEqual(GAP_TOLERANCE_PX);
}

async function openDocsRoute(
  route: string,
  viewport: Readonly<{ width: number; height: number }>
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.locator('main[data-pagefind-body]').waitFor({ state: 'visible' });
  return { page, close: () => context.close() };
}

async function readFlowFacts(page: Page): Promise<FlowFacts> {
  return page.evaluate(() => {
    const flow = document.querySelector<HTMLElement>('[data-doc-flow]');
    if (!flow) throw new Error('MarkdownContent must expose the documentation flow boundary.');

    const visibleChildren = [...flow.children].filter((child): child is HTMLElement => {
      if (!(child instanceof HTMLElement)) return false;
      const rect = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
    const directGaps = visibleChildren.slice(1).map((child, index) => {
      const previous = visibleChildren[index]!;
      return child.getBoundingClientRect().top - previous.getBoundingClientRect().bottom;
    });
    const footer = document.querySelector<HTMLElement>('main[data-pagefind-body] footer');
    const root = document.documentElement;

    return {
      directChildCount: visibleChildren.length,
      directGaps,
      footerExists: Boolean(footer),
      footerInsideFlow: footer ? flow.contains(footer) : false,
      overflow: root.scrollWidth - root.clientWidth,
    };
  });
}

async function readSelectFacts(page: Page): Promise<SelectFacts> {
  await page.locator('[data-previewer-id][data-inited="1"]').first().waitFor({ state: 'visible' });

  return page.evaluate(() => {
    const flow = document.querySelector<HTMLElement>('[data-doc-flow]');
    const previewer = flow?.querySelector<HTMLElement>(':scope > [data-previewer-id]');
    const paragraph = previewer?.previousElementSibling as HTMLElement | null;
    const heading = previewer?.nextElementSibling as HTMLElement | null;
    const header = previewer?.querySelector<HTMLElement>('.proto-previewer__header');
    const panel = previewer?.querySelector<HTMLElement>('.proto-previewer__preview-panel');
    if (!flow || !previewer || !paragraph || !heading || !header || !panel) {
      throw new Error(
        'The Select page must expose its prose, previewer, heading, and inner panels.'
      );
    }

    return {
      paragraphToPreviewer:
        previewer.getBoundingClientRect().top - paragraph.getBoundingClientRect().bottom,
      previewerToHeading:
        heading.getBoundingClientRect().top - previewer.getBoundingClientRect().bottom,
      headerToPanel: panel.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
      previousTag: paragraph.tagName,
      nextClass: heading.className,
    };
  });
}

async function readQuickStartFacts(page: Page): Promise<QuickStartFacts> {
  await page.locator('[data-code-example]').waitFor({ state: 'visible' });
  await page.locator('.expressive-code').first().waitFor({ state: 'visible' });

  return page.evaluate(() => {
    const renderedSibling = (
      element: Element,
      direction: 'previousElementSibling' | 'nextElementSibling'
    ): HTMLElement | null => {
      let sibling = element[direction];
      while (sibling) {
        if (sibling instanceof HTMLElement) {
          const rect = sibling.getBoundingClientRect();
          const style = getComputedStyle(sibling);
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          ) {
            return sibling;
          }
        }
        sibling = sibling[direction];
      }
      return null;
    };

    const flow = document.querySelector<HTMLElement>('[data-doc-flow]');
    const expressiveCode = flow?.querySelector<HTMLElement>(':scope > .expressive-code');
    const codeExample = flow?.querySelector<HTMLElement>(':scope > [data-code-example]');
    const expressivePrevious = expressiveCode
      ? renderedSibling(expressiveCode, 'previousElementSibling')
      : null;
    const expressiveNext = expressiveCode
      ? renderedSibling(expressiveCode, 'nextElementSibling')
      : null;
    const examplePrevious = codeExample
      ? renderedSibling(codeExample, 'previousElementSibling')
      : null;
    const exampleNext = codeExample ? renderedSibling(codeExample, 'nextElementSibling') : null;
    const exampleStrip = codeExample?.querySelector<HTMLElement>(':scope > .code-example__strip');
    const examplePanel = codeExample?.querySelector<HTMLElement>(
      ':scope > .code-example__host-panel:not([hidden])'
    );

    if (
      !flow ||
      !expressiveCode ||
      !codeExample ||
      !expressivePrevious ||
      !expressiveNext ||
      !examplePrevious ||
      !exampleNext ||
      !exampleStrip ||
      !examplePanel
    ) {
      throw new Error('The Quick Start page must expose its prose, code blocks, and inner panels.');
    }

    return {
      paragraphToExpressiveCode:
        expressiveCode.getBoundingClientRect().top -
        expressivePrevious.getBoundingClientRect().bottom,
      expressiveCodeToParagraph:
        expressiveNext.getBoundingClientRect().top - expressiveCode.getBoundingClientRect().bottom,
      paragraphToCodeExample:
        codeExample.getBoundingClientRect().top - examplePrevious.getBoundingClientRect().bottom,
      codeExampleToParagraph:
        exampleNext.getBoundingClientRect().top - codeExample.getBoundingClientRect().bottom,
      codeExampleStripToPanel:
        examplePanel.getBoundingClientRect().top - exampleStrip.getBoundingClientRect().bottom,
      expressivePreviousTag: expressivePrevious.tagName,
      expressiveNextTag: expressiveNext.tagName,
      examplePreviousTag: examplePrevious.tagName,
      exampleNextTag: exampleNext.tagName,
    };
  });
}

function expectFlowBoundary(facts: FlowFacts, label: string): void {
  expect(facts.directChildCount, `${label}/visible direct children`).toBeGreaterThan(1);
  expect(facts.footerExists, `${label}/footer`).toBe(true);
  expect(facts.footerInsideFlow, `${label}/footer ownership`).toBe(false);
  expect(facts.overflow, `${label}/viewport overflow`).toBeLessThanOrEqual(0);
  for (const [index, gap] of facts.directGaps.entries()) {
    expect(gap, `${label}/direct adjacency ${index + 1}`).toBeGreaterThanOrEqual(
      ORDINARY_FLOW_GAP_PX - GAP_TOLERANCE_PX
    );
  }
}

beforeAll(async () => {
  baseUrl = await startServer(ALL_ROUTES[0].path);
  for (const route of ALL_ROUTES.slice(1)) {
    const response = await fetch(`${baseUrl}${route.path}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Unable to warm ${route.path}: HTTP ${response.status}.`);
  }
  browser = await launchBrowser();
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('documentation content-flow browser regression', () => {
  for (const viewport of VIEWPORTS) {
    it(`keeps prose and PrototypePreviewer rhythm scoped at ${viewport.width}px`, async () => {
      for (const route of SELECT_ROUTES) {
        const { page, close } = await openDocsRoute(route.path, viewport);
        const label = `${route.locale}/select/${viewport.width}`;

        try {
          const flow = await readFlowFacts(page);
          const select = await readSelectFacts(page);
          expectFlowBoundary(flow, label);
          expect(select.previousTag, `${label}/previewer predecessor`).toBe('P');
          expect(select.nextClass, `${label}/previewer successor`).toContain('sl-heading-wrapper');
          expectGap(select.paragraphToPreviewer, ORDINARY_FLOW_GAP_PX, `${label}/prose-preview`);
          expectGap(select.previewerToHeading, SECTION_FLOW_GAP_PX, `${label}/preview-heading`);
          expectGap(select.headerToPanel, 0, `${label}/previewer internal boundary`);
        } finally {
          await close();
        }
      }
    }, 240_000);

    it(`keeps prose and code-block rhythm scoped at ${viewport.width}px`, async () => {
      for (const route of QUICK_START_ROUTES) {
        const { page, close } = await openDocsRoute(route.path, viewport);
        const label = `${route.locale}/quick-start/${viewport.width}`;

        try {
          const flow = await readFlowFacts(page);
          const quickStart = await readQuickStartFacts(page);
          expectFlowBoundary(flow, label);
          expect(quickStart.expressivePreviousTag, `${label}/code predecessor`).toBe('P');
          expect(quickStart.expressiveNextTag, `${label}/code successor`).toBe('P');
          expect(quickStart.examplePreviousTag, `${label}/example predecessor`).toBe('P');
          expect(quickStart.exampleNextTag, `${label}/example successor`).toBe('P');
          expectGap(
            quickStart.paragraphToExpressiveCode,
            ORDINARY_FLOW_GAP_PX,
            `${label}/prose-expressive-code`
          );
          expectGap(
            quickStart.expressiveCodeToParagraph,
            ORDINARY_FLOW_GAP_PX,
            `${label}/expressive-code-prose`
          );
          expectGap(
            quickStart.paragraphToCodeExample,
            ORDINARY_FLOW_GAP_PX,
            `${label}/prose-code-example`
          );
          expectGap(
            quickStart.codeExampleToParagraph,
            ORDINARY_FLOW_GAP_PX,
            `${label}/code-example-prose`
          );
          expectGap(
            quickStart.codeExampleStripToPanel,
            0,
            `${label}/CodeExample internal boundary`
          );
        } finally {
          await close();
        }
      }
    }, 240_000);
  }
});
