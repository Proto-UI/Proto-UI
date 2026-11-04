import { describe, expect, it } from 'vitest';
import type { DemoChild } from './demo-types';
import demo from '../../content/docs/demo-shadcn-alert-dialog.demo';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../../../../../packages/cli/src/registry/finf-components';

function prototypeChildren(node: DemoChild | undefined) {
  if (!node || typeof node === 'string' || node.kind !== 'proto' || !node.children) {
    throw new Error('Expected the authored AlertDialog prototype group');
  }
  return node.children.map((child) => {
    if (typeof child === 'string' || child.kind !== 'proto') {
      throw new Error('Expected an authored AlertDialog prototype part');
    }
    return child;
  });
}

describe('Shadcn AlertDialog preview composition', () => {
  it('exposes both reusable groups from workspace source facades', () => {
    const items = FINF_WORKSPACE_COMPONENT_ENTRIES['shadcn-alert-dialog'].items;
    for (const role of ['Header', 'Footer'])
      expect(items).toContainEqual(
        expect.objectContaining({
          prototypeImport: `alertDialog${role}`,
          reactExport: `ShadcnAlertDialog${role}`,
          vueExport: `ShadcnAlertDialog${role}`,
          wcExport: `ShadcnAlertDialog${role}Element`,
        })
      );
  });

  // T-SHADCN-ALERT-DIALOG-0001-CASE-4
  it('uses the reusable groups in the demo instead of flattening all four children into Content', () => {
    expect(demo.root.prototypeId).toBe('shadcn-style-scope');
    expect(demo.root.props).toEqual({ styleProfile: 'rhea' });
    expect(demo.root.children).toHaveLength(1);
    const authoredRoot = demo.root.children[0];
    expect(authoredRoot.kind).toBe('box');
    const root = authoredRoot.children[0];
    const content = prototypeChildren(root).find(
      (child) => child.prototypeId === 'shadcn-alert-dialog-content'
    );
    const groups = prototypeChildren(content);
    expect(groups.map((child) => child.prototypeId)).toEqual([
      'shadcn-alert-dialog-header',
      'shadcn-alert-dialog-footer',
    ]);
    expect(prototypeChildren(groups[0]).map((child) => child.prototypeId)).toEqual([
      'shadcn-alert-dialog-title',
      'shadcn-alert-dialog-description',
    ]);
    expect(prototypeChildren(groups[1]).map((child) => child.prototypeId)).toEqual([
      'shadcn-alert-dialog-cancel',
      'shadcn-alert-dialog-action',
    ]);
  });
});
