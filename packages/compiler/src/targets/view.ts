import type { ElementView, SourceSpan } from './component-ir.ts';

export interface ViewBinding {
  readonly role: 'text' | 'style' | 'disabled' | 'activate' | 'child-key' | 'child-prop';
  readonly fn: string;
  readonly source: SourceSpan;
}

/** Called only after the receiver has validated the tree. The generated
 * application does not retain the tree or this compile-time traversal. */
export function viewBindings(view: ElementView): ViewBinding[] {
  const bindings: ViewBinding[] = [];
  function visit(element: ElementView): void {
    for (const role of ['style', 'disabled', 'activate'] as const) {
      const fn = element[role];
      if (fn !== undefined) bindings.push({ role, fn, source: element.source });
    }
    for (const child of element.children) {
      if (child.kind === 'text') {
        bindings.push({ role: 'text', fn: child.value, source: child.source });
      } else if (child.kind === 'child') {
        bindings.push({ role: 'child-key', fn: child.key, source: child.source });
        for (const prop of child.props) bindings.push({ role: 'child-prop', fn: prop.fn, source: prop.source });
      } else {
        visit(child);
      }
    }
  }
  visit(view);
  return bindings;
}
