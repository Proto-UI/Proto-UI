import { bootstrap232ActionAppearance } from '@proto.ui/prototypes-bootstrap-2-3-2/surface';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const secondaryButton = bootstrap232ActionAppearance({ emphasis: 'secondary' });
const primaryButton = bootstrap232ActionAppearance({ emphasis: 'primary' });

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 items-start p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-dialog-root',
        ref: 'root',
        props: { a11yLabel: 'Edit profile' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-trigger',
            ref: 'trigger',
            children: ['Open Dialog'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-mask',
            ref: 'mask',
            previewTheme: 'portal',
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-dialog-content',
            ref: 'content',
            previewTheme: 'portal',
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-header',
                ref: 'header',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-title',
                    ref: 'title',
                    children: ['Edit profile'],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'grid gap-3 px-[15px] py-[15px]',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-description',
                    ref: 'description',
                    children: ["Make changes to your profile here. Click save when you're done."],
                  },
                  {
                    kind: 'box',
                    className: 'grid gap-2 text-sm',
                    children: [
                      {
                        kind: 'box',
                        className: 'flex items-center justify-between border-b border-border pb-2',
                        children: [
                          { kind: 'box', tag: 'span', className: 'font-semibold', children: ['Name'] },
                          { kind: 'box', tag: 'span', children: ['Pedro Duarte'] },
                        ],
                      },
                      {
                        kind: 'box',
                        className: 'flex items-center justify-between',
                        children: [
                          { kind: 'box', tag: 'span', className: 'font-semibold', children: ['Username'] },
                          { kind: 'box', tag: 'span', children: ['@peduarte'] },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-footer',
                ref: 'footer',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-close',
                    ref: 'close',
                    surfaceStyle: { display: 'inline-flex' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-surface-root',
                        ref: 'closeAppearance',
                        props: { ...secondaryButton.surface },
                        surfaceStyle: { ...secondaryButton.layout, pointerEvents: 'none' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'bootstrap-2-3-2-text-root',
                            ref: 'closeLabel',
                            props: { ...secondaryButton.text },
                            children: ['Close'],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-dialog-close',
                    ref: 'save',
                    surfaceStyle: { display: 'inline-flex' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'bootstrap-2-3-2-surface-root',
                        ref: 'saveAppearance',
                        props: { ...primaryButton.surface },
                        surfaceStyle: { ...primaryButton.layout, pointerEvents: 'none' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'bootstrap-2-3-2-text-root',
                            ref: 'saveLabel',
                            props: { ...primaryButton.text },
                            children: ['Save changes'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-dialog-close-icon',
                ref: 'closeIcon',
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
