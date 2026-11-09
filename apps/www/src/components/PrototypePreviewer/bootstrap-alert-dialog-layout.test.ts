import { describe, expect, it } from 'vitest';
import demo from '../../content/docs/demo-bootstrap-2-3-2-alert-dialog.demo';

describe('Bootstrap AlertDialog modal composition', () => {
  it('groups original Cancel and Action commands in the public family Footer', () => {
    const root = demo.root.children[0] as any;
    const content = root.children.find(
      (child: any) => child.prototypeId === 'bootstrap-2-3-2-alert-dialog-content'
    );
    expect(content.children.map((child: any) => child.prototypeId)).toEqual([
      'bootstrap-2-3-2-alert-dialog-title',
      'bootstrap-2-3-2-alert-dialog-description',
      'bootstrap-2-3-2-alert-dialog-footer',
    ]);
    expect(content.children[2].children.map((child: any) => child.prototypeId)).toEqual([
      'bootstrap-2-3-2-alert-dialog-cancel',
      'bootstrap-2-3-2-alert-dialog-action',
    ]);
  });
});
