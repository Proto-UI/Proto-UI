import { describe, expect, it } from 'vitest';
import demo from '../../content/docs/demo-shadcn-alert-dialog.demo';
import { FINF_WORKSPACE_COMPONENT_ENTRIES } from '../../../../../packages/cli/src/registry/finf-components';

describe('Shadcn New York AlertDialog preview composition', () => {
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
    const root = demo.root.children[0] as any;
    const content = root.children.find(
      (child: any) => child.prototypeId === 'shadcn-alert-dialog-content'
    );
    expect(content.children.map((child: any) => child.prototypeId)).toEqual([
      'shadcn-alert-dialog-header',
      'shadcn-alert-dialog-footer',
    ]);
    expect(content.children[0].children.map((child: any) => child.prototypeId)).toEqual([
      'shadcn-alert-dialog-title',
      'shadcn-alert-dialog-description',
    ]);
    expect(content.children[1].children.map((child: any) => child.prototypeId)).toEqual([
      'shadcn-alert-dialog-cancel',
      'shadcn-alert-dialog-action',
    ]);
  });
});
