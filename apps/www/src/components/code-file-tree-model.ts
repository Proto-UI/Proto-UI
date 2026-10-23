export interface CodeFileNode {
  key: string;
  parentKey: string;
  name: string;
  depth: number;
  fileIndex?: number;
}

/** Canonical authored paths, never generated installation commands. */
export function codeFileNodes(paths: readonly string[], directories: readonly string[] = []): CodeFileNode[] {
  const nodes = new Map<string, CodeFileNode>();
  const add = (path: string, fileIndex?: number) => {
    const parts = path.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..'))
      throw new Error('[CodeExample] File paths require non-empty relative segments.');
    parts.forEach((name, depth) => {
      const key = parts.slice(0, depth + 1).join('/');
      const leaf = fileIndex !== undefined && depth === parts.length - 1;
      const old = nodes.get(key);
      if (old && (leaf || old.fileIndex !== undefined))
        throw new Error('[CodeExample] File paths must not collide with files or folders.');
      if (!old) nodes.set(key, { key, parentKey: parts.slice(0, depth).join('/'), name, depth, ...(leaf ? { fileIndex } : {}) });
    });
  };
  directories.forEach((path) => add(path));
  paths.forEach((path, index) => add(path, index));
  // Keep children contiguous even when authored paths interleave directories.
  const ordered: CodeFileNode[] = [];
  const visit = (parent: string) => {
    for (const node of nodes.values()) if (node.parentKey === parent) {
      ordered.push(node);
      visit(node.key);
    }
  };
  visit('');
  return ordered;
}

/** Pinned BlockViewer uses a distinct indentation multiplier for folders. */
export function codeTreeIndent(depth: number, folder: boolean): string {
  const index = depth + 1;
  return `${index * (folder ? index === 1 ? 1 : 1.2 : index === 2 ? 1.2 : 1.3)}rem`;
}

