import type { Page } from 'playwright-core';
import { collectMatrixInteractiveFacts, type InteractiveFact } from './demo-matrix-observation';

type DomNode = {
  nodeType: number;
  nodeName: string;
  backendNodeId: number;
  attributes?: string[];
  children?: DomNode[];
};
type AxNode = {
  backendDOMNodeId?: number;
  ignored: boolean;
  role?: { value?: unknown };
  name?: { value?: unknown };
};
type MatrixTargets = Record<string, InteractiveFact[][]>;

/** Join browser snapshots by real backend node identity, not by inferred role,
 * accessible name, DOM id, or whichever matching node appears first in AX. */
export function matrixAccessibilityFromSnapshots(
  targets: MatrixTargets,
  document: DomNode,
  accessibility: AxNode[]
) {
  const domBySelector = new Map<string, DomNode>();
  const visit = (node: DomNode, selector: string) => {
    domBySelector.set(selector, node);
    const children = (node.children ?? []).filter((child) => child.nodeType === 1);
    for (const [index, child] of children.entries())
      visit(child, `${selector} > :nth-child(${index + 1})`);
  };
  const root = (document.children ?? []).find((node) => node.nodeType === 1);
  if (!root) throw new Error('Matrix accessibility observation has no document element');
  visit(root, ':root');
  const axByBackend = new Map<number, AxNode[]>();
  for (const node of accessibility) {
    if (node.backendDOMNodeId === undefined) continue;
    const existing = axByBackend.get(node.backendDOMNodeId) ?? [];
    existing.push(node);
    axByBackend.set(node.backendDOMNodeId, existing);
  }
  const observations: Array<{
    demoId: string;
    adapter: number;
    control: number;
    selector: string;
    backendNodeId: number;
    dom: { nodeName: string; attributes: string[]; approximation: InteractiveFact };
    actual: InteractiveFact;
    exposed: boolean;
    raw: AxNode | null;
  }> = [];
  const facts = Object.fromEntries(
    Object.entries(targets).map(([demoId, adapters]) => [
      demoId,
      adapters.map((controls, adapter) =>
        controls.map(({ selector, role, name }, control) => {
          if (!selector) throw new Error('Matrix candidate is missing its exact DOM selector');
          const node = domBySelector.get(selector);
          if (!node)
            throw new Error(`Matrix candidate disappeared before AX observation: ${selector}`);
          const matches = axByBackend.get(node.backendNodeId) ?? [];
          const exposed = matches.filter((match) => !match.ignored);
          if (exposed.length > 1)
            throw new Error(`Ambiguous exposed AX nodes for matrix candidate: ${selector}`);
          const actual = exposed[0] ?? matches[0];
          // Never silently drop a visible DOM candidate or supply its expected
          // name when AX ignores/omits it. Existing unnamed/parity checks fail.
          const fact = {
            role: actual && !actual.ignored ? String(actual.role?.value ?? '') : 'none',
            name: actual && !actual.ignored ? String(actual.name?.value ?? '') : '',
          };
          observations.push({
            demoId,
            adapter,
            control,
            selector,
            backendNodeId: node.backendNodeId,
            dom: {
              nodeName: node.nodeName,
              attributes: node.attributes ?? [],
              approximation: { role, name },
            },
            actual: fact,
            exposed: exposed.length === 1,
            raw: actual ?? null,
          });
          return fact;
        })
      ),
    ])
  );
  return { facts, observations };
}

/** Chromium CDP facts, scoped to the existing matrix's visible DOM candidates.
 * This does not claim physical assistive-technology or other-engine acceptance. */
export async function collectMatrixAccessibilityFacts(page: Page, roles: readonly string[]) {
  const targets = await page.evaluate(collectMatrixInteractiveFacts, {
    roles,
    selectors: true as const,
  });
  const session = await page.context().newCDPSession(page);
  try {
    // Do not pierce shadow roots or frames: the previous matrix candidate query
    // does not include those descendants either. Preserve that selected scope.
    const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: false });
    const { nodes } = await session.send('Accessibility.getFullAXTree');
    return {
      source: 'Chromium CDP Accessibility.getFullAXTree',
      browser: page.context().browser()?.version() ?? 'unknown',
      ...matrixAccessibilityFromSnapshots(targets, root, nodes),
    };
  } finally {
    await session.detach();
  }
}
