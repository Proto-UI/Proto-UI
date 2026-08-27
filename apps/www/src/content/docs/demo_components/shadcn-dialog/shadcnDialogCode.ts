import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/registry';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-dialog': formatCode(`
<wc-shadcn-dialog-root class="relative inline-flex items-start">
  <wc-shadcn-dialog-trigger>
    <wc-shadcn-button>Open Dialog</wc-shadcn-button>
  </wc-shadcn-dialog-trigger>
  <wc-shadcn-dialog-mask></wc-shadcn-dialog-mask>
  <wc-shadcn-dialog-content>
    <wc-shadcn-dialog-header>
      <wc-shadcn-dialog-title>Edit Profile</wc-shadcn-dialog-title>
      <wc-shadcn-dialog-description>
        Make changes to your profile here. Click save when you're done.
      </wc-shadcn-dialog-description>
    </wc-shadcn-dialog-header>
    <wc-shadcn-dialog-footer>
      <wc-shadcn-dialog-close>
        <wc-shadcn-button variant="outline">Cancel</wc-shadcn-button>
      </wc-shadcn-dialog-close>
      <wc-shadcn-dialog-close>
        <wc-shadcn-button>Save changes</wc-shadcn-button>
      </wc-shadcn-dialog-close>
    </wc-shadcn-dialog-footer>
  </wc-shadcn-dialog-content>
</wc-shadcn-dialog-root>
    `),
  },
  react: {
    'demo-shadcn-dialog': formatCode(`
import {
  ShadcnButton,
  ShadcnDialogRoot,
  ShadcnDialogTrigger,
  ShadcnDialogMask,
  ShadcnDialogContent,
  ShadcnDialogHeader,
  ShadcnDialogFooter,
  ShadcnDialogTitle,
  ShadcnDialogDescription,
  ShadcnDialogClose,
} from '@prototype-libs/shadcn';

export function DemoShadcnDialogDemo() {
  return (
    <ShadcnDialogRoot className="relative inline-flex items-start">
      <ShadcnDialogTrigger>
        <ShadcnButton>Open Dialog</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent>
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>Edit Profile</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            Make changes to your profile here. Click save when you're done.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        <ShadcnDialogFooter>
          <ShadcnDialogClose>
            <ShadcnButton variant="outline">Cancel</ShadcnButton>
          </ShadcnDialogClose>
          <ShadcnDialogClose>
            <ShadcnButton>Save changes</ShadcnButton>
          </ShadcnDialogClose>
        </ShadcnDialogFooter>
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-dialog': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDialogRoot,
  ShadcnDialogTrigger,
  ShadcnDialogMask,
  ShadcnDialogContent,
  ShadcnDialogHeader,
  ShadcnDialogFooter,
  ShadcnDialogTitle,
  ShadcnDialogDescription,
  ShadcnDialogClose,
} from '@prototype-libs/shadcn';

</script>

<template>
  <ShadcnDialogRoot class="relative inline-flex items-start">
    <ShadcnDialogTrigger>
      <ShadcnButton>Open Dialog</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Edit Profile</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          Make changes to your profile here. Click save when you're done.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <ShadcnDialogFooter>
        <ShadcnDialogClose>
          <ShadcnButton variant="outline">Cancel</ShadcnButton>
        </ShadcnDialogClose>
        <ShadcnDialogClose>
          <ShadcnButton>Save changes</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
  },
};
