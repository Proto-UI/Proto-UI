/**
 * MDX 扫描器：使用 remark + remark-mdx 解析 .mdx 文件
 * 提取 PrototypePreviewer 的 adapter 状态（data-adapter-panel）及 demoId
 */
import { visit } from 'unist-util-visit';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import type { Root } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx';
import { readFile } from 'node:fs/promises';
import {
  AdapterIds,
  type RuntimeId,
} from '../../src/components/PrototypePreviewer/runtimes/registry';

export type PrototypePreviewerProps = {
  demoId?: string;
  prototypeId?: string;
  initialRuntime?: RuntimeId;
  runtimes?: RuntimeId[];
};

export type ScannedBlock = {
  /** 文件路径 */
  filePath: string;
  /** adapter panel 标识：wc | react | vue */
  adapterPanel: RuntimeId;
  /** PrototypePreviewer 的 props */
  previewerProps: PrototypePreviewerProps;
  /** 在文档中的顺序索引 */
  index: number;
};

function getAttribute(node: MdxJsxFlowElement, name: string): string | undefined {
  const attr = node.attributes?.find(
    (a: any): a is { type: 'mdxJsxAttribute'; name: string; value?: unknown } =>
      a.type === 'mdxJsxAttribute' && a.name === name
  );
  if (attr?.value == null) return undefined;
  if (typeof attr.value === 'string') return attr.value;
  const v = attr.value as { type?: string; value?: string };
  if (v?.type === 'mdxJsxAttributeValueExpression') return undefined;
  return v?.value;
}

function getAttributeExpression(
  node: MdxJsxFlowElement,
  name: string
): string | string[] | undefined {
  const attr = node.attributes?.find(
    (a: any): a is { type: 'mdxJsxAttribute'; name: string; value?: unknown } =>
      a.type === 'mdxJsxAttribute' && a.name === name
  );
  if (!attr?.value) return undefined;
  const v = attr.value as { type?: string; value?: string };
  if (v?.type === 'mdxJsxAttributeValueExpression' && v.value) {
    const expr = v.value.trim();
    if (expr.startsWith('[') && expr.endsWith(']')) {
      try {
        return eval(expr) as string[];
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function parsePreviewerProps(node: MdxJsxFlowElement): PrototypePreviewerProps {
  const demoId = getAttribute(node, 'demoId');
  const prototypeId = getAttribute(node, 'prototypeId');
  const initialRuntime = getAttribute(node, 'initialRuntime') as RuntimeId | undefined;
  const runtimes = getAttributeExpression(node, 'runtimes') as RuntimeId[] | undefined;
  return { demoId, prototypeId, initialRuntime, runtimes };
}

function findPrototypePreviewerInChildren(node: MdxJsxFlowElement): PrototypePreviewerProps | null {
  let found: PrototypePreviewerProps | null = null;
  visit(node, (n) => {
    if (found) return;
    const el = n as MdxJsxFlowElement;
    if (el.type === 'mdxJsxFlowElement' && el.name === 'PrototypePreviewer') {
      found = parsePreviewerProps(el);
    }
  });
  return found;
}

/**
 * 扫描单个 MDX 文件的 AST，提取 data-adapter-panel 与 PrototypePreviewer
 */
export function scanMdxAst(tree: Root, filePath: string): ScannedBlock[] {
  const blocks: ScannedBlock[] = [];
  let index = 0;

  visit(tree, (node) => {
    const el = node as MdxJsxFlowElement;
    if (el.type !== 'mdxJsxFlowElement') return;

    const adapterPanel = getAttribute(el, 'data-adapter-panel') as RuntimeId | undefined;
    if (!adapterPanel || !AdapterIds.includes(adapterPanel as (typeof AdapterIds)[number])) return;

    const previewerProps = findPrototypePreviewerInChildren(el);
    if (!previewerProps?.demoId && !previewerProps?.prototypeId) return;

    blocks.push({
      filePath,
      adapterPanel,
      previewerProps,
      index: index++,
    });
  });

  return blocks;
}

/**
 * 解析 MDX 文件并扫描
 */
export async function scanMdxFile(filePath: string): Promise<ScannedBlock[]> {
  const content = await readFile(filePath, 'utf-8');
  const processor = unified().use(remarkParse).use(remarkMdx);
  const tree = processor.parse(content) as Root;
  return scanMdxAst(tree, filePath);
}
