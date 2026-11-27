import type { ChildView, ComponentIR, ElementView } from '../component-ir.ts';
import { reject } from '../validation/diagnostic.ts';

/** React keys preserve identity only among children of the same host parent. */
export function checkReactChildTopology(ir: ComponentIR): void {
  for (const body of [ir, ...ir.components]) {
    const parents = new Map<string, { parent: number; child: ChildView }>();
    let occurrence = 0;

    function visit(view: ElementView): void {
      // Count render occurrences, not object identities: direct IR can reuse a
      // wrapper object at two sites which become distinct React host parents.
      const parent = occurrence++;
      for (const child of view.children) {
        if (child.kind === 'element') {
          visit(child);
        } else if (child.kind === 'child') {
          const previous = parents.get(child.component);
          if (previous && previous.parent !== parent) {
            reject(
              'child-parent-topology',
              child.source,
              `The React backend does not yet support logical keyed child identity for ${JSON.stringify(child.component)} across different host element parents. This is a missing backend capability for valid component topology, even when the current keys are distinct.`,
              [body.id, child.component, previous.child.key, child.key]
            );
          }
          parents.set(child.component, { parent, child });
        }
      }
    }

    visit(body.view);
  }
}
