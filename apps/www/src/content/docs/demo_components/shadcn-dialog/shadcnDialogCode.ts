import { formatCode } from '@/utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-dialog': formatCode(`
<wc-shadcn-dialog-root style-profile="rhea" class="relative inline-flex items-start">
  <wc-shadcn-dialog-trigger style-profile="rhea">
    <wc-shadcn-button style-profile="rhea">Open Dialog</wc-shadcn-button>
  </wc-shadcn-dialog-trigger>
  <wc-shadcn-dialog-mask style-profile="rhea"></wc-shadcn-dialog-mask>
  <wc-shadcn-dialog-content style-profile="rhea">
    <wc-shadcn-dialog-header style-profile="rhea">
      <wc-shadcn-dialog-title style-profile="rhea">Edit Profile</wc-shadcn-dialog-title>
      <wc-shadcn-dialog-description style-profile="rhea">
        Make changes to your profile here. Click save when you're done.
      </wc-shadcn-dialog-description>
    </wc-shadcn-dialog-header>
    <wc-shadcn-dialog-footer style-profile="rhea">
      <wc-shadcn-dialog-close style-profile="rhea">
        <wc-shadcn-button style-profile="rhea" variant="outline">Cancel</wc-shadcn-button>
      </wc-shadcn-dialog-close>
      <wc-shadcn-dialog-close style-profile="rhea">
        <wc-shadcn-button style-profile="rhea">Save changes</wc-shadcn-button>
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
    <ShadcnDialogRoot styleProfile="rhea" className="relative inline-flex items-start">
      <ShadcnDialogTrigger styleProfile="rhea">
        <ShadcnButton styleProfile="rhea">Open Dialog</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask styleProfile="rhea" />
      <ShadcnDialogContent styleProfile="rhea">
        <ShadcnDialogHeader styleProfile="rhea">
          <ShadcnDialogTitle styleProfile="rhea">Edit Profile</ShadcnDialogTitle>
          <ShadcnDialogDescription styleProfile="rhea">
            Make changes to your profile here. Click save when you're done.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        <ShadcnDialogFooter styleProfile="rhea">
          <ShadcnDialogClose styleProfile="rhea">
            <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
          </ShadcnDialogClose>
          <ShadcnDialogClose styleProfile="rhea">
            <ShadcnButton styleProfile="rhea">Save changes</ShadcnButton>
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
  <ShadcnDialogRoot styleProfile="rhea" class="relative inline-flex items-start">
    <ShadcnDialogTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea">Open Dialog</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask styleProfile="rhea" />
    <ShadcnDialogContent styleProfile="rhea">
      <ShadcnDialogHeader styleProfile="rhea">
        <ShadcnDialogTitle styleProfile="rhea">Edit Profile</ShadcnDialogTitle>
        <ShadcnDialogDescription styleProfile="rhea">
          Make changes to your profile here. Click save when you're done.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <ShadcnDialogFooter styleProfile="rhea">
        <ShadcnDialogClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
        </ShadcnDialogClose>
        <ShadcnDialogClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea">Save changes</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-dialog': formatCode(`
<template>
  <ShadcnDialogRoot styleProfile="rhea" class="relative inline-flex items-start">
    <ShadcnDialogTrigger styleProfile="rhea">
      <ShadcnButton styleProfile="rhea">Open Dialog</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask styleProfile="rhea" />
    <ShadcnDialogContent styleProfile="rhea">
      <ShadcnDialogHeader styleProfile="rhea">
        <ShadcnDialogTitle styleProfile="rhea">Edit Profile</ShadcnDialogTitle>
        <ShadcnDialogDescription styleProfile="rhea">
          Make changes to your profile here. Click save when you're done.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <ShadcnDialogFooter styleProfile="rhea">
        <ShadcnDialogClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea" variant="outline">Cancel</ShadcnButton>
        </ShadcnDialogClose>
        <ShadcnDialogClose styleProfile="rhea">
          <ShadcnButton styleProfile="rhea">Save changes</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>

<script>
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
} from '../proto-ui/components/vue2';

export default {
  components: {
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
  },
};
</script>
    `),
  },
};
