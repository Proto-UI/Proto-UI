export type TreeNode = Readonly<{
  key: string;
  parentKey?: string;
  textValue?: string;
  disabled?: boolean;
}>;
export type TreeEntry = TreeNode &
  Readonly<{ level: number; position: number; setSize: number; branch: boolean; visible: boolean }>;
/** Reject ambiguous identity, missing ancestors, and cycles rather than guessing hierarchy. */
export function treeEntries(nodes: readonly TreeNode[], expanded: readonly string[]): TreeEntry[] {
  const map = new Map(nodes.map((node) => [node.key, node]));
  if (map.size !== nodes.length || nodes.some((node) => !node.key))
    throw new Error('Tree keys must be non-empty and unique');
  const children = new Map<string, TreeNode[]>();
  for (const node of nodes) {
    const parent = node.parentKey ?? '';
    if (parent && !map.has(parent)) throw new Error(`Tree parent is missing: ${parent}`);
    children.set(parent, [...(children.get(parent) ?? []), node]);
    const seen = new Set([node.key]);
    let ancestor = parent;
    while (ancestor) {
      if (seen.has(ancestor)) throw new Error('Tree hierarchy contains a cycle');
      seen.add(ancestor);
      ancestor = map.get(ancestor)?.parentKey ?? '';
    }
  }
  const result: TreeEntry[] = [];
  const visit = (parent: string, level: number, visible: boolean) => {
    const siblings = children.get(parent) ?? [];
    siblings.forEach((node, index) => {
      const branch = children.has(node.key);
      result.push({
        ...node,
        level,
        position: index + 1,
        setSize: siblings.length,
        branch,
        visible,
      });
      visit(node.key, level + 1, visible && expanded.includes(node.key));
    });
  };
  visit('', 1, true);
  return result;
}
