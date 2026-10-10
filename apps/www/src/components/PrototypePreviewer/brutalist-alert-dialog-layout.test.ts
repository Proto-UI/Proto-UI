import { describe, expect, it } from 'vitest';
import demo from '../../content/docs/demo-brutalist-alert-dialog.demo';

describe('Neo-Brutalist AlertDialog preview composition', () => {
  // T-BRUTALIST-ALERT-DIALOG-0001-CASE-4
  it('uses the reusable groups in the demo instead of flattening all four children into Content', () => {
    const root = demo.root.children[0] as any;
    const content = root.children.find(
      (child: any) => child.prototypeId === 'brutalist-alert-dialog-content'
    );
    expect(content.children.map((child: any) => child.prototypeId)).toEqual([
      'brutalist-alert-dialog-header',
      'brutalist-alert-dialog-footer',
    ]);
    expect(content.children[0].children.map((child: any) => child.prototypeId)).toEqual([
      'brutalist-alert-dialog-title',
      'brutalist-alert-dialog-description',
    ]);
    expect(content.children[1].children.map((child: any) => child.prototypeId)).toEqual([
      'brutalist-alert-dialog-cancel',
      'brutalist-alert-dialog-action',
    ]);
  });
});
