import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Partial<Record<RuntimeId, Record<string, string>>> = {
  wc: {
    'demo-shadcn-dialog-custom-close': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-dialog-root>
    <wc-shadcn-dialog-trigger>
      <wc-shadcn-button variant="outline">Share</wc-shadcn-button>
    </wc-shadcn-dialog-trigger>
    <wc-shadcn-dialog-mask></wc-shadcn-dialog-mask>
    <wc-shadcn-dialog-content>
      <wc-shadcn-dialog-header>
        <wc-shadcn-dialog-title>Share link</wc-shadcn-dialog-title>
        <wc-shadcn-dialog-description>
          Anyone who has this link will be able to view this.
        </wc-shadcn-dialog-description>
      </wc-shadcn-dialog-header>
      <div class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm break-all">
        https://pui.cyjin.dev/en/ui-libraries/shadcn/dialog/
      </div>
      <wc-shadcn-dialog-footer class="justify-start">
        <wc-shadcn-dialog-close>
          <wc-shadcn-button variant="secondary">Close</wc-shadcn-button>
        </wc-shadcn-dialog-close>
      </wc-shadcn-dialog-footer>
      <wc-shadcn-dialog-close-icon></wc-shadcn-dialog-close-icon>
    </wc-shadcn-dialog-content>
  </wc-shadcn-dialog-root>
</wc-shadcn-style-scope>
    `),
    'demo-shadcn-dialog-no-close': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-dialog-root>
    <wc-shadcn-dialog-trigger>
      <wc-shadcn-button variant="outline">No Close Button</wc-shadcn-button>
    </wc-shadcn-dialog-trigger>
    <wc-shadcn-dialog-mask></wc-shadcn-dialog-mask>
    <wc-shadcn-dialog-content data-pui-no-default-close>
      <wc-shadcn-dialog-header>
        <wc-shadcn-dialog-title>No Close Button</wc-shadcn-dialog-title>
        <wc-shadcn-dialog-description>
          This dialog doesn't have a close button in the top-right corner.
        </wc-shadcn-dialog-description>
      </wc-shadcn-dialog-header>
      <wc-shadcn-dialog-footer>
        <wc-shadcn-dialog-close>
          <wc-shadcn-button variant="outline">Done</wc-shadcn-button>
        </wc-shadcn-dialog-close>
      </wc-shadcn-dialog-footer>
    </wc-shadcn-dialog-content>
  </wc-shadcn-dialog-root>
</wc-shadcn-style-scope>
    `),
    'demo-shadcn-dialog-sticky-footer': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-dialog-root>
    <wc-shadcn-dialog-trigger>
      <wc-shadcn-button variant="outline">Sticky Footer</wc-shadcn-button>
    </wc-shadcn-dialog-trigger>
    <wc-shadcn-dialog-mask></wc-shadcn-dialog-mask>
    <wc-shadcn-dialog-content>
      <wc-shadcn-dialog-header>
        <wc-shadcn-dialog-title>Sticky Footer</wc-shadcn-dialog-title>
        <wc-shadcn-dialog-description>
          This dialog keeps its footer actions visible while the content scrolls.
        </wc-shadcn-dialog-description>
      </wc-shadcn-dialog-header>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
        <!-- Long scrollable content -->
      </div>
      <wc-shadcn-dialog-footer>
        <wc-shadcn-dialog-close>
          <wc-shadcn-button variant="outline">Close</wc-shadcn-button>
        </wc-shadcn-dialog-close>
      </wc-shadcn-dialog-footer>
      <wc-shadcn-dialog-close-icon></wc-shadcn-dialog-close-icon>
    </wc-shadcn-dialog-content>
  </wc-shadcn-dialog-root>
</wc-shadcn-style-scope>
    `),
    'demo-shadcn-dialog-scrollable': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <wc-shadcn-dialog-root>
    <wc-shadcn-dialog-trigger>
      <wc-shadcn-button variant="outline">Scrollable Content</wc-shadcn-button>
    </wc-shadcn-dialog-trigger>
    <wc-shadcn-dialog-mask></wc-shadcn-dialog-mask>
    <wc-shadcn-dialog-content>
      <wc-shadcn-dialog-header>
        <wc-shadcn-dialog-title>Scrollable Content</wc-shadcn-dialog-title>
        <wc-shadcn-dialog-description>
          Long content scrolls cleanly while the dialog header stays in view.
        </wc-shadcn-dialog-description>
      </wc-shadcn-dialog-header>
      <div class="max-h-[50vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
        <!-- Long scrollable content -->
      </div>
      <wc-shadcn-dialog-close-icon></wc-shadcn-dialog-close-icon>
    </wc-shadcn-dialog-content>
  </wc-shadcn-dialog-root>
</wc-shadcn-style-scope>
    `),
    'demo-shadcn-dialog-rtl': formatCode(`
<wc-shadcn-style-scope style-profile="rhea">
  <div dir="rtl">
    <wc-shadcn-dialog-root>
      <wc-shadcn-dialog-trigger>
        <wc-shadcn-button variant="outline">فتح الحوار</wc-shadcn-button>
      </wc-shadcn-dialog-trigger>
      <wc-shadcn-dialog-mask></wc-shadcn-dialog-mask>
      <wc-shadcn-dialog-content>
        <div dir="rtl" class="grid gap-4 text-start">
          <wc-shadcn-dialog-header>
            <wc-shadcn-dialog-title>تعديل الملف الشخصي</wc-shadcn-dialog-title>
            <wc-shadcn-dialog-description>
              قم بإجراء تغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.
            </wc-shadcn-dialog-description>
          </wc-shadcn-dialog-header>
          <wc-shadcn-dialog-footer>
            <wc-shadcn-dialog-close>
              <wc-shadcn-button variant="outline">إلغاء</wc-shadcn-button>
            </wc-shadcn-dialog-close>
            <wc-shadcn-dialog-close>
              <wc-shadcn-button>حفظ التغييرات</wc-shadcn-button>
            </wc-shadcn-dialog-close>
          </wc-shadcn-dialog-footer>
        </div>
        <wc-shadcn-dialog-close-icon></wc-shadcn-dialog-close-icon>
      </wc-shadcn-dialog-content>
    </wc-shadcn-dialog-root>
  </div>
</wc-shadcn-style-scope>
    `),
    'demo-brutalist-dialog': formatCode(`
<wc-brutalist-dialog-root>
  <wc-brutalist-dialog-trigger>Edit Profile</wc-brutalist-dialog-trigger>
  <wc-brutalist-dialog-mask></wc-brutalist-dialog-mask>
  <wc-brutalist-dialog-content>
    <div class="min-w-0 pe-12">
      <wc-brutalist-dialog-header>
        <wc-brutalist-dialog-title>Edit profile</wc-brutalist-dialog-title>
        <wc-brutalist-dialog-description>
          Make changes to your profile here. Click save when you're done.
        </wc-brutalist-dialog-description>
      </wc-brutalist-dialog-header>
    </div>
    <wc-brutalist-dialog-footer>
      <wc-brutalist-dialog-close>
        <wc-brutalist-button variant="neutral">Cancel</wc-brutalist-button>
      </wc-brutalist-dialog-close>
      <wc-brutalist-dialog-close>
        <wc-brutalist-button>Save changes</wc-brutalist-button>
      </wc-brutalist-dialog-close>
    </wc-brutalist-dialog-footer>
    <wc-brutalist-dialog-close-icon></wc-brutalist-dialog-close-icon>
  </wc-brutalist-dialog-content>
</wc-brutalist-dialog-root>
    `),
    'demo-brutalist-dialog-scrollable': formatCode(`
<wc-brutalist-dialog-root>
  <wc-brutalist-dialog-trigger>Scrollable Content</wc-brutalist-dialog-trigger>
  <wc-brutalist-dialog-mask></wc-brutalist-dialog-mask>
  <wc-brutalist-dialog-content>
    <div class="min-w-0 pe-12">
      <wc-brutalist-dialog-header>
        <wc-brutalist-dialog-title>Scrollable Content</wc-brutalist-dialog-title>
        <wc-brutalist-dialog-description>
          Scroll through long changelog entries while keeping the header anchored.
        </wc-brutalist-dialog-description>
      </wc-brutalist-dialog-header>
    </div>
    <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
      <!-- Scrollable items -->
    </div>
    <wc-brutalist-dialog-close-icon></wc-brutalist-dialog-close-icon>
  </wc-brutalist-dialog-content>
</wc-brutalist-dialog-root>
    `),
    'demo-brutalist-dialog-sticky-footer': formatCode(`
<wc-brutalist-dialog-root>
  <wc-brutalist-dialog-trigger>Sticky Footer</wc-brutalist-dialog-trigger>
  <wc-brutalist-dialog-mask></wc-brutalist-dialog-mask>
  <wc-brutalist-dialog-content>
    <div class="min-w-0 pe-12">
      <wc-brutalist-dialog-header>
        <wc-brutalist-dialog-title>Sticky Footer</wc-brutalist-dialog-title>
        <wc-brutalist-dialog-description>
          Footer actions stay visible while you read through the modal body.
        </wc-brutalist-dialog-description>
      </wc-brutalist-dialog-header>
    </div>
    <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
      <!-- Scrollable body -->
    </div>
    <wc-brutalist-dialog-footer>
      <wc-brutalist-dialog-close>
        <wc-brutalist-button variant="neutral">Close</wc-brutalist-button>
      </wc-brutalist-dialog-close>
    </wc-brutalist-dialog-footer>
    <wc-brutalist-dialog-close-icon></wc-brutalist-dialog-close-icon>
  </wc-brutalist-dialog-content>
</wc-brutalist-dialog-root>
    `),
    'demo-bootstrap-2-3-2-dialog': formatCode(`
<wc-bootstrap-2-3-2-dialog-root a11y-label="Edit profile">
  <wc-bootstrap-2-3-2-dialog-trigger>Open Dialog</wc-bootstrap-2-3-2-dialog-trigger>
  <wc-bootstrap-2-3-2-dialog-mask></wc-bootstrap-2-3-2-dialog-mask>
  <wc-bootstrap-2-3-2-dialog-content>
    <wc-bootstrap-2-3-2-dialog-header>
      <wc-bootstrap-2-3-2-dialog-title>Edit profile</wc-bootstrap-2-3-2-dialog-title>
    </wc-bootstrap-2-3-2-dialog-header>
    <div class="px-[15px] py-[15px]">
      <wc-bootstrap-2-3-2-dialog-description>
        Make changes to your profile here. Click save when you're done.
      </wc-bootstrap-2-3-2-dialog-description>
    </div>
    <wc-bootstrap-2-3-2-dialog-footer>
      <wc-bootstrap-2-3-2-dialog-close>Close</wc-bootstrap-2-3-2-dialog-close>
      <wc-bootstrap-2-3-2-dialog-close>Save changes</wc-bootstrap-2-3-2-dialog-close>
    </wc-bootstrap-2-3-2-dialog-footer>
    <wc-bootstrap-2-3-2-dialog-close-icon></wc-bootstrap-2-3-2-dialog-close-icon>
  </wc-bootstrap-2-3-2-dialog-content>
</wc-bootstrap-2-3-2-dialog-root>
    `),
    'demo-bootstrap-2-3-2-dialog-no-close': formatCode(`
<wc-bootstrap-2-3-2-dialog-root a11y-label="No close button">
  <wc-bootstrap-2-3-2-dialog-trigger>No Close Button</wc-bootstrap-2-3-2-dialog-trigger>
  <wc-bootstrap-2-3-2-dialog-mask></wc-bootstrap-2-3-2-dialog-mask>
  <wc-bootstrap-2-3-2-dialog-content>
    <wc-bootstrap-2-3-2-dialog-header>
      <wc-bootstrap-2-3-2-dialog-title>No Close Button</wc-bootstrap-2-3-2-dialog-title>
    </wc-bootstrap-2-3-2-dialog-header>
    <div class="px-[15px] py-[15px]">
      <wc-bootstrap-2-3-2-dialog-description>
        This modal omits the top-right close icon and delegates dismissal to Escape, backdrop click, or the footer button.
      </wc-bootstrap-2-3-2-dialog-description>
    </div>
    <wc-bootstrap-2-3-2-dialog-footer>
      <wc-bootstrap-2-3-2-dialog-close>Close</wc-bootstrap-2-3-2-dialog-close>
    </wc-bootstrap-2-3-2-dialog-footer>
  </wc-bootstrap-2-3-2-dialog-content>
</wc-bootstrap-2-3-2-dialog-root>
    `),
    'demo-bootstrap-2-3-2-dialog-scrollable': formatCode(`
<wc-bootstrap-2-3-2-dialog-root a11y-label="Scrollable content">
  <wc-bootstrap-2-3-2-dialog-trigger>Scrollable Content</wc-bootstrap-2-3-2-dialog-trigger>
  <wc-bootstrap-2-3-2-dialog-mask></wc-bootstrap-2-3-2-dialog-mask>
  <wc-bootstrap-2-3-2-dialog-content>
    <wc-bootstrap-2-3-2-dialog-header>
      <wc-bootstrap-2-3-2-dialog-title>Scrollable Content</wc-bootstrap-2-3-2-dialog-title>
    </wc-bootstrap-2-3-2-dialog-header>
    <div class="max-h-[45vh] overflow-y-auto px-[15px] py-[15px]">
      <wc-bootstrap-2-3-2-dialog-description>
        Long body text scrolls cleanly inside the 560px classic modal frame.
      </wc-bootstrap-2-3-2-dialog-description>
    </div>
    <wc-bootstrap-2-3-2-dialog-close-icon></wc-bootstrap-2-3-2-dialog-close-icon>
  </wc-bootstrap-2-3-2-dialog-content>
</wc-bootstrap-2-3-2-dialog-root>
    `),
    'demo-bootstrap-2-3-2-dialog-sticky-footer': formatCode(`
<wc-bootstrap-2-3-2-dialog-root a11y-label="Sticky footer">
  <wc-bootstrap-2-3-2-dialog-trigger>Sticky Footer</wc-bootstrap-2-3-2-dialog-trigger>
  <wc-bootstrap-2-3-2-dialog-mask></wc-bootstrap-2-3-2-dialog-mask>
  <wc-bootstrap-2-3-2-dialog-content>
    <wc-bootstrap-2-3-2-dialog-header>
      <wc-bootstrap-2-3-2-dialog-title>Deployment checklist</wc-bootstrap-2-3-2-dialog-title>
    </wc-bootstrap-2-3-2-dialog-header>
    <div class="max-h-[40vh] overflow-y-auto px-[15px] py-[15px]">
      <wc-bootstrap-2-3-2-dialog-description>
        Review the checklist while the modal footer stays pinned below.
      </wc-bootstrap-2-3-2-dialog-description>
    </div>
    <wc-bootstrap-2-3-2-dialog-footer>
      <wc-bootstrap-2-3-2-dialog-close>Cancel</wc-bootstrap-2-3-2-dialog-close>
      <wc-bootstrap-2-3-2-dialog-close>Confirm</wc-bootstrap-2-3-2-dialog-close>
    </wc-bootstrap-2-3-2-dialog-footer>
    <wc-bootstrap-2-3-2-dialog-close-icon></wc-bootstrap-2-3-2-dialog-close-icon>
  </wc-bootstrap-2-3-2-dialog-content>
</wc-bootstrap-2-3-2-dialog-root>
    `),
    'demo-liquid-glass-dialog': formatCode(`
<wc-liquid-glass-dialog-root a11y-label="Edit profile">
  <wc-liquid-glass-dialog-trigger>Open Dialog</wc-liquid-glass-dialog-trigger>
  <wc-liquid-glass-dialog-mask></wc-liquid-glass-dialog-mask>
  <wc-liquid-glass-dialog-content>
    <wc-liquid-glass-dialog-title>Edit profile</wc-liquid-glass-dialog-title>
    <wc-liquid-glass-dialog-description>
      Make changes to your profile here. Click save when you're done.
    </wc-liquid-glass-dialog-description>
    <div class="flex justify-end gap-2">
      <wc-liquid-glass-dialog-close prominence="regular">Cancel</wc-liquid-glass-dialog-close>
      <wc-liquid-glass-dialog-close prominence="prominent">Save changes</wc-liquid-glass-dialog-close>
    </div>
  </wc-liquid-glass-dialog-content>
</wc-liquid-glass-dialog-root>
    `),
    'demo-liquid-glass-dialog-prominence': formatCode(`
<wc-liquid-glass-dialog-root a11y-label="Delete workspace">
  <wc-liquid-glass-dialog-trigger prominence="prominent">Delete Workspace</wc-liquid-glass-dialog-trigger>
  <wc-liquid-glass-dialog-mask></wc-liquid-glass-dialog-mask>
  <wc-liquid-glass-dialog-content>
    <wc-liquid-glass-dialog-title>Delete workspace?</wc-liquid-glass-dialog-title>
    <wc-liquid-glass-dialog-description>
      This removes local previews and archived builds from this device.
    </wc-liquid-glass-dialog-description>
    <div class="flex justify-end gap-2">
      <wc-liquid-glass-dialog-close prominence="regular">Keep Workspace</wc-liquid-glass-dialog-close>
      <wc-liquid-glass-dialog-close prominence="destructive">Delete</wc-liquid-glass-dialog-close>
    </div>
  </wc-liquid-glass-dialog-content>
</wc-liquid-glass-dialog-root>
    `),
    'demo-liquid-glass-dialog-scrollable': formatCode(`
<wc-liquid-glass-dialog-root a11y-label="Scrollable sheet">
  <wc-liquid-glass-dialog-trigger>Scrollable Content</wc-liquid-glass-dialog-trigger>
  <wc-liquid-glass-dialog-mask></wc-liquid-glass-dialog-mask>
  <wc-liquid-glass-dialog-content>
    <wc-liquid-glass-dialog-title>Material guidelines</wc-liquid-glass-dialog-title>
    <wc-liquid-glass-dialog-description>
      Scrollable content stays readable while footer controls remain fixed below.
    </wc-liquid-glass-dialog-description>
    <div class="max-h-[42vh] overflow-y-auto pr-2 grid gap-2.5 text-sm text-muted-foreground">
      <!-- Scrollable notes -->
    </div>
    <div class="flex justify-end gap-2">
      <wc-liquid-glass-dialog-close prominence="prominent">Done</wc-liquid-glass-dialog-close>
    </div>
  </wc-liquid-glass-dialog-content>
</wc-liquid-glass-dialog-root>
    `),
    'demo-liquid-glass-dialog-opaque': formatCode(`
<wc-liquid-glass-dialog-root a11y-label="Opaque surface dialog">
  <wc-liquid-glass-dialog-trigger>Opaque Material</wc-liquid-glass-dialog-trigger>
  <wc-liquid-glass-dialog-mask></wc-liquid-glass-dialog-mask>
  <wc-liquid-glass-dialog-content material="opaque">
    <wc-liquid-glass-dialog-title>Opaque surface opt-out</wc-liquid-glass-dialog-title>
    <wc-liquid-glass-dialog-description>
      Set material="opaque" on the content surface when dense text or data requires a solid background.
    </wc-liquid-glass-dialog-description>
    <div class="flex justify-end gap-2">
      <wc-liquid-glass-dialog-close prominence="regular">Close</wc-liquid-glass-dialog-close>
    </div>
  </wc-liquid-glass-dialog-content>
</wc-liquid-glass-dialog-root>
    `),
  },
  react: {
    'demo-shadcn-dialog-custom-close': formatCode(`
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';

export function DialogCustomCloseDemo() {
  return (
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>
        <ShadcnButton variant="outline">Share</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent>
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>Share link</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            Anyone who has this link will be able to view this.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm break-all">
          https://pui.cyjin.dev/en/ui-libraries/shadcn/dialog/
        </div>
        <ShadcnDialogFooter className="justify-start">
          <ShadcnDialogClose>
            <ShadcnButton variant="secondary">Close</ShadcnButton>
          </ShadcnDialogClose>
        </ShadcnDialogFooter>
        <ShadcnDialogCloseIcon />
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  );
}
    `),
    'demo-shadcn-dialog-no-close': formatCode(`
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';

export function DialogNoCloseButtonDemo() {
  return (
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>
        <ShadcnButton variant="outline">No Close Button</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent close={null}>
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>No Close Button</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            This dialog doesn&apos;t have a close button in the top-right corner.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        <ShadcnDialogFooter>
          <ShadcnDialogClose>
            <ShadcnButton variant="outline">Done</ShadcnButton>
          </ShadcnDialogClose>
        </ShadcnDialogFooter>
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  );
}
    `),
    'demo-shadcn-dialog-sticky-footer': formatCode(`
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';

export function DialogStickyFooterDemo() {
  return (
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>
        <ShadcnButton variant="outline">Sticky Footer</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent>
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>Sticky Footer</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            This dialog keeps its footer actions visible while the content scrolls.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        <div className="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
          {/* Long scrollable content */}
        </div>
        <ShadcnDialogFooter>
          <ShadcnDialogClose>
            <ShadcnButton variant="outline">Close</ShadcnButton>
          </ShadcnDialogClose>
        </ShadcnDialogFooter>
        <ShadcnDialogCloseIcon />
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  );
}
    `),
    'demo-shadcn-dialog-scrollable': formatCode(`
import {
  ShadcnButton,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';

export function DialogScrollableDemo() {
  return (
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>
        <ShadcnButton variant="outline">Scrollable Content</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent>
        <ShadcnDialogHeader>
          <ShadcnDialogTitle>Scrollable Content</ShadcnDialogTitle>
          <ShadcnDialogDescription>
            Long content scrolls cleanly while the dialog header stays in view.
          </ShadcnDialogDescription>
        </ShadcnDialogHeader>
        <div className="max-h-[50vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
          {/* Long scrollable content */}
        </div>
        <ShadcnDialogCloseIcon />
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  );
}
    `),
    'demo-shadcn-dialog-rtl': formatCode(`
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';

export function DialogRtlDemo() {
  return (
    <div dir="rtl">
      <ShadcnDialogRoot>
        <ShadcnDialogTrigger>
          <ShadcnButton variant="outline">فتح الحوار</ShadcnButton>
        </ShadcnDialogTrigger>
        <ShadcnDialogMask />
        <ShadcnDialogContent>
          <div dir="rtl" className="grid gap-4 text-start">
            <ShadcnDialogHeader>
              <ShadcnDialogTitle>تعديل الملف الشخصي</ShadcnDialogTitle>
              <ShadcnDialogDescription>
                قم بإجراء تغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.
              </ShadcnDialogDescription>
            </ShadcnDialogHeader>
            <ShadcnDialogFooter>
              <ShadcnDialogClose>
                <ShadcnButton variant="outline">إلغاء</ShadcnButton>
              </ShadcnDialogClose>
              <ShadcnDialogClose>
                <ShadcnButton>حفظ التغييرات</ShadcnButton>
              </ShadcnDialogClose>
            </ShadcnDialogFooter>
          </div>
          <ShadcnDialogCloseIcon />
        </ShadcnDialogContent>
      </ShadcnDialogRoot>
    </div>
  );
}
    `),
    'demo-brutalist-dialog': formatCode(`
import {
  BrutalistButton,
  BrutalistDialogClose,
  BrutalistDialogCloseIcon,
  BrutalistDialogContent,
  BrutalistDialogDescription,
  BrutalistDialogFooter,
  BrutalistDialogHeader,
  BrutalistDialogMask,
  BrutalistDialogRoot,
  BrutalistDialogTitle,
  BrutalistDialogTrigger,
} from '@/components/proto-ui/brutalist';

export function BrutalistDialogDemo() {
  return (
    <BrutalistDialogRoot>
      <BrutalistDialogTrigger>Edit Profile</BrutalistDialogTrigger>
      <BrutalistDialogMask />
      <BrutalistDialogContent>
        <div className="min-w-0 pe-12">
          <BrutalistDialogHeader>
            <BrutalistDialogTitle>Edit profile</BrutalistDialogTitle>
            <BrutalistDialogDescription>
              Make changes to your profile here. Click save when you&apos;re done.
            </BrutalistDialogDescription>
          </BrutalistDialogHeader>
        </div>
        <BrutalistDialogFooter>
          <BrutalistDialogClose>
            <BrutalistButton variant="neutral">Cancel</BrutalistButton>
          </BrutalistDialogClose>
          <BrutalistDialogClose>
            <BrutalistButton>Save changes</BrutalistButton>
          </BrutalistDialogClose>
        </BrutalistDialogFooter>
        <BrutalistDialogCloseIcon />
      </BrutalistDialogContent>
    </BrutalistDialogRoot>
  );
}
    `),
    'demo-brutalist-dialog-scrollable': formatCode(`
import {
  BrutalistDialogCloseIcon,
  BrutalistDialogContent,
  BrutalistDialogDescription,
  BrutalistDialogHeader,
  BrutalistDialogMask,
  BrutalistDialogRoot,
  BrutalistDialogTitle,
  BrutalistDialogTrigger,
} from '@/components/proto-ui/brutalist';

export function BrutalistDialogScrollableDemo() {
  return (
    <BrutalistDialogRoot>
      <BrutalistDialogTrigger>Scrollable Content</BrutalistDialogTrigger>
      <BrutalistDialogMask />
      <BrutalistDialogContent>
        <div className="min-w-0 pe-12">
          <BrutalistDialogHeader>
            <BrutalistDialogTitle>Scrollable Content</BrutalistDialogTitle>
            <BrutalistDialogDescription>
              Scroll through long changelog entries while keeping the header anchored.
            </BrutalistDialogDescription>
          </BrutalistDialogHeader>
        </div>
        <div className="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
          {/* Scrollable items */}
        </div>
        <BrutalistDialogCloseIcon />
      </BrutalistDialogContent>
    </BrutalistDialogRoot>
  );
}
    `),
    'demo-brutalist-dialog-sticky-footer': formatCode(`
import {
  BrutalistButton,
  BrutalistDialogClose,
  BrutalistDialogCloseIcon,
  BrutalistDialogContent,
  BrutalistDialogDescription,
  BrutalistDialogFooter,
  BrutalistDialogHeader,
  BrutalistDialogMask,
  BrutalistDialogRoot,
  BrutalistDialogTitle,
  BrutalistDialogTrigger,
} from '@/components/proto-ui/brutalist';

export function BrutalistDialogStickyFooterDemo() {
  return (
    <BrutalistDialogRoot>
      <BrutalistDialogTrigger>Sticky Footer</BrutalistDialogTrigger>
      <BrutalistDialogMask />
      <BrutalistDialogContent>
        <div className="min-w-0 pe-12">
          <BrutalistDialogHeader>
            <BrutalistDialogTitle>Sticky Footer</BrutalistDialogTitle>
            <BrutalistDialogDescription>
              Footer actions stay visible while you read through the modal body.
            </BrutalistDialogDescription>
          </BrutalistDialogHeader>
        </div>
        <div className="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
          {/* Scrollable body */}
        </div>
        <BrutalistDialogFooter>
          <BrutalistDialogClose>
            <BrutalistButton variant="neutral">Close</BrutalistButton>
          </BrutalistDialogClose>
        </BrutalistDialogFooter>
        <BrutalistDialogCloseIcon />
      </BrutalistDialogContent>
    </BrutalistDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-dialog': formatCode(`
import {
  BootstrapDialogClose,
  BootstrapDialogCloseIcon,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogFooter,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';

export function BootstrapDialogDemo() {
  return (
    <BootstrapDialogRoot a11yLabel="Edit profile">
      <BootstrapDialogTrigger>Open Dialog</BootstrapDialogTrigger>
      <BootstrapDialogMask />
      <BootstrapDialogContent>
        <BootstrapDialogHeader>
          <BootstrapDialogTitle>Edit profile</BootstrapDialogTitle>
        </BootstrapDialogHeader>
        <div className="px-[15px] py-[15px]">
          <BootstrapDialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </BootstrapDialogDescription>
        </div>
        <BootstrapDialogFooter>
          <BootstrapDialogClose>Close</BootstrapDialogClose>
          <BootstrapDialogClose>Save changes</BootstrapDialogClose>
        </BootstrapDialogFooter>
        <BootstrapDialogCloseIcon />
      </BootstrapDialogContent>
    </BootstrapDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-dialog-no-close': formatCode(`
import {
  BootstrapDialogClose,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogFooter,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';

export function BootstrapDialogNoCloseDemo() {
  return (
    <BootstrapDialogRoot a11yLabel="No close button">
      <BootstrapDialogTrigger>No Close Button</BootstrapDialogTrigger>
      <BootstrapDialogMask />
      <BootstrapDialogContent>
        <BootstrapDialogHeader>
          <BootstrapDialogTitle>No Close Button</BootstrapDialogTitle>
        </BootstrapDialogHeader>
        <div className="px-[15px] py-[15px]">
          <BootstrapDialogDescription>
            This modal omits the top-right close icon and delegates dismissal to Escape, backdrop click, or the footer button.
          </BootstrapDialogDescription>
        </div>
        <BootstrapDialogFooter>
          <BootstrapDialogClose>Close</BootstrapDialogClose>
        </BootstrapDialogFooter>
      </BootstrapDialogContent>
    </BootstrapDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-dialog-scrollable': formatCode(`
import {
  BootstrapDialogCloseIcon,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';

export function BootstrapDialogScrollableDemo() {
  return (
    <BootstrapDialogRoot a11yLabel="Scrollable content">
      <BootstrapDialogTrigger>Scrollable Content</BootstrapDialogTrigger>
      <BootstrapDialogMask />
      <BootstrapDialogContent>
        <BootstrapDialogHeader>
          <BootstrapDialogTitle>Scrollable Content</BootstrapDialogTitle>
        </BootstrapDialogHeader>
        <div className="max-h-[45vh] overflow-y-auto px-[15px] py-[15px]">
          <BootstrapDialogDescription>
            Long body text scrolls cleanly inside the 560px classic modal frame.
          </BootstrapDialogDescription>
        </div>
        <BootstrapDialogCloseIcon />
      </BootstrapDialogContent>
    </BootstrapDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-dialog-sticky-footer': formatCode(`
import {
  BootstrapDialogClose,
  BootstrapDialogCloseIcon,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogFooter,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';

export function BootstrapDialogStickyFooterDemo() {
  return (
    <BootstrapDialogRoot a11yLabel="Sticky footer">
      <BootstrapDialogTrigger>Sticky Footer</BootstrapDialogTrigger>
      <BootstrapDialogMask />
      <BootstrapDialogContent>
        <BootstrapDialogHeader>
          <BootstrapDialogTitle>Deployment checklist</BootstrapDialogTitle>
        </BootstrapDialogHeader>
        <div className="max-h-[40vh] overflow-y-auto px-[15px] py-[15px]">
          <BootstrapDialogDescription>
            Review the checklist while the modal footer stays pinned below.
          </BootstrapDialogDescription>
        </div>
        <BootstrapDialogFooter>
          <BootstrapDialogClose>Cancel</BootstrapDialogClose>
          <BootstrapDialogClose>Confirm</BootstrapDialogClose>
        </BootstrapDialogFooter>
        <BootstrapDialogCloseIcon />
      </BootstrapDialogContent>
    </BootstrapDialogRoot>
  );
}
    `),
    'demo-liquid-glass-dialog': formatCode(`
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';

export function LiquidGlassDialogDemo() {
  return (
    <LiquidGlassDialogRoot a11yLabel="Edit profile">
      <LiquidGlassDialogTrigger>Open Dialog</LiquidGlassDialogTrigger>
      <LiquidGlassDialogMask />
      <LiquidGlassDialogContent>
        <LiquidGlassDialogTitle>Edit profile</LiquidGlassDialogTitle>
        <LiquidGlassDialogDescription>
          Make changes to your profile here. Click save when you&apos;re done.
        </LiquidGlassDialogDescription>
        <div className="flex justify-end gap-2">
          <LiquidGlassDialogClose prominence="regular">Cancel</LiquidGlassDialogClose>
          <LiquidGlassDialogClose prominence="prominent">Save changes</LiquidGlassDialogClose>
        </div>
      </LiquidGlassDialogContent>
    </LiquidGlassDialogRoot>
  );
}
    `),
    'demo-liquid-glass-dialog-prominence': formatCode(`
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';

export function LiquidGlassDialogProminenceDemo() {
  return (
    <LiquidGlassDialogRoot a11yLabel="Delete workspace">
      <LiquidGlassDialogTrigger prominence="prominent">Delete Workspace</LiquidGlassDialogTrigger>
      <LiquidGlassDialogMask />
      <LiquidGlassDialogContent>
        <LiquidGlassDialogTitle>Delete workspace?</LiquidGlassDialogTitle>
        <LiquidGlassDialogDescription>
          This removes local previews and archived builds from this device.
        </LiquidGlassDialogDescription>
        <div className="flex justify-end gap-2">
          <LiquidGlassDialogClose prominence="regular">Keep Workspace</LiquidGlassDialogClose>
          <LiquidGlassDialogClose prominence="destructive">Delete</LiquidGlassDialogClose>
        </div>
      </LiquidGlassDialogContent>
    </LiquidGlassDialogRoot>
  );
}
    `),
    'demo-liquid-glass-dialog-scrollable': formatCode(`
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';

export function LiquidGlassDialogScrollableDemo() {
  return (
    <LiquidGlassDialogRoot a11yLabel="Scrollable sheet">
      <LiquidGlassDialogTrigger>Scrollable Content</LiquidGlassDialogTrigger>
      <LiquidGlassDialogMask />
      <LiquidGlassDialogContent>
        <LiquidGlassDialogTitle>Material guidelines</LiquidGlassDialogTitle>
        <LiquidGlassDialogDescription>
          Scrollable content stays readable while footer controls remain fixed below.
        </LiquidGlassDialogDescription>
        <div className="max-h-[42vh] overflow-y-auto pr-2 grid gap-2.5 text-sm text-muted-foreground">
          {/* Scrollable notes */}
        </div>
        <div className="flex justify-end gap-2">
          <LiquidGlassDialogClose prominence="prominent">Done</LiquidGlassDialogClose>
        </div>
      </LiquidGlassDialogContent>
    </LiquidGlassDialogRoot>
  );
}
    `),
    'demo-liquid-glass-dialog-opaque': formatCode(`
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';

export function LiquidGlassDialogOpaqueDemo() {
  return (
    <LiquidGlassDialogRoot a11yLabel="Opaque surface dialog">
      <LiquidGlassDialogTrigger>Opaque Material</LiquidGlassDialogTrigger>
      <LiquidGlassDialogMask />
      <LiquidGlassDialogContent material="opaque">
        <LiquidGlassDialogTitle>Opaque surface opt-out</LiquidGlassDialogTitle>
        <LiquidGlassDialogDescription>
          Set material=&quot;opaque&quot; on the content surface when dense text or data requires a solid background.
        </LiquidGlassDialogDescription>
        <div className="flex justify-end gap-2">
          <LiquidGlassDialogClose prominence="regular">Close</LiquidGlassDialogClose>
        </div>
      </LiquidGlassDialogContent>
    </LiquidGlassDialogRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-dialog-custom-close': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';
</script>

<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">Share</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Share link</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          Anyone who has this link will be able to view this.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <div class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm break-all">
        https://pui.cyjin.dev/en/ui-libraries/shadcn/dialog/
      </div>
      <ShadcnDialogFooter class="justify-start">
        <ShadcnDialogClose>
          <ShadcnButton variant="secondary">Close</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
      <ShadcnDialogCloseIcon />
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-no-close': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';
</script>

<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">No Close Button</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <template #close />
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>No Close Button</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          This dialog doesn't have a close button in the top-right corner.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <ShadcnDialogFooter>
        <ShadcnDialogClose>
          <ShadcnButton variant="outline">Done</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-sticky-footer': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';
</script>

<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">Sticky Footer</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Sticky Footer</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          This dialog keeps its footer actions visible while the content scrolls.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
        <!-- Long scrollable content -->
      </div>
      <ShadcnDialogFooter>
        <ShadcnDialogClose>
          <ShadcnButton variant="outline">Close</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
      <ShadcnDialogCloseIcon />
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-scrollable': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';
</script>

<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">Scrollable Content</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Scrollable Content</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          Long content scrolls cleanly while the dialog header stays in view.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <div class="max-h-[50vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
        <!-- Long scrollable content -->
      </div>
      <ShadcnDialogCloseIcon />
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnButton,
  ShadcnDialogClose,
  ShadcnDialogCloseIcon,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogFooter,
  ShadcnDialogHeader,
  ShadcnDialogMask,
  ShadcnDialogRoot,
  ShadcnDialogTitle,
  ShadcnDialogTrigger,
} from '@/components/proto-ui/shadcn';
</script>

<template>
  <div dir="rtl">
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>
        <ShadcnButton variant="outline">فتح الحوار</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent>
        <div dir="rtl" class="grid gap-4 text-start">
          <ShadcnDialogHeader>
            <ShadcnDialogTitle>تعديل الملف الشخصي</ShadcnDialogTitle>
            <ShadcnDialogDescription>
              قم بإجراء تغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.
            </ShadcnDialogDescription>
          </ShadcnDialogHeader>
          <ShadcnDialogFooter>
            <ShadcnDialogClose>
              <ShadcnButton variant="outline">إلغاء</ShadcnButton>
            </ShadcnDialogClose>
            <ShadcnDialogClose>
              <ShadcnButton>حفظ التغييرات</ShadcnButton>
            </ShadcnDialogClose>
          </ShadcnDialogFooter>
        </div>
        <ShadcnDialogCloseIcon />
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  </div>
</template>
    `),
    'demo-brutalist-dialog': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  BrutalistDialogClose,
  BrutalistDialogCloseIcon,
  BrutalistDialogContent,
  BrutalistDialogDescription,
  BrutalistDialogFooter,
  BrutalistDialogHeader,
  BrutalistDialogMask,
  BrutalistDialogRoot,
  BrutalistDialogTitle,
  BrutalistDialogTrigger,
} from '@/components/proto-ui/brutalist';
</script>

<template>
  <BrutalistDialogRoot>
    <BrutalistDialogTrigger>Edit Profile</BrutalistDialogTrigger>
    <BrutalistDialogMask />
    <BrutalistDialogContent>
      <div class="min-w-0 pe-12">
        <BrutalistDialogHeader>
          <BrutalistDialogTitle>Edit profile</BrutalistDialogTitle>
          <BrutalistDialogDescription>
            Make changes to your profile here. Click save when you're done.
          </BrutalistDialogDescription>
        </BrutalistDialogHeader>
      </div>
      <BrutalistDialogFooter>
        <BrutalistDialogClose>
          <BrutalistButton variant="neutral">Cancel</BrutalistButton>
        </BrutalistDialogClose>
        <BrutalistDialogClose>
          <BrutalistButton>Save changes</BrutalistButton>
        </BrutalistDialogClose>
      </BrutalistDialogFooter>
      <BrutalistDialogCloseIcon />
    </BrutalistDialogContent>
  </BrutalistDialogRoot>
</template>
    `),
    'demo-brutalist-dialog-scrollable': formatCode(`
<script setup lang="ts">
import {
  BrutalistDialogCloseIcon,
  BrutalistDialogContent,
  BrutalistDialogDescription,
  BrutalistDialogHeader,
  BrutalistDialogMask,
  BrutalistDialogRoot,
  BrutalistDialogTitle,
  BrutalistDialogTrigger,
} from '@/components/proto-ui/brutalist';
</script>

<template>
  <BrutalistDialogRoot>
    <BrutalistDialogTrigger>Scrollable Content</BrutalistDialogTrigger>
    <BrutalistDialogMask />
    <BrutalistDialogContent>
      <div class="min-w-0 pe-12">
        <BrutalistDialogHeader>
          <BrutalistDialogTitle>Scrollable Content</BrutalistDialogTitle>
          <BrutalistDialogDescription>
            Scroll through long changelog entries while keeping the header anchored.
          </BrutalistDialogDescription>
        </BrutalistDialogHeader>
      </div>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
        <!-- Scrollable items -->
      </div>
      <BrutalistDialogCloseIcon />
    </BrutalistDialogContent>
  </BrutalistDialogRoot>
</template>
    `),
    'demo-brutalist-dialog-sticky-footer': formatCode(`
<script setup lang="ts">
import {
  BrutalistButton,
  BrutalistDialogClose,
  BrutalistDialogCloseIcon,
  BrutalistDialogContent,
  BrutalistDialogDescription,
  BrutalistDialogFooter,
  BrutalistDialogHeader,
  BrutalistDialogMask,
  BrutalistDialogRoot,
  BrutalistDialogTitle,
  BrutalistDialogTrigger,
} from '@/components/proto-ui/brutalist';
</script>

<template>
  <BrutalistDialogRoot>
    <BrutalistDialogTrigger>Sticky Footer</BrutalistDialogTrigger>
    <BrutalistDialogMask />
    <BrutalistDialogContent>
      <div class="min-w-0 pe-12">
        <BrutalistDialogHeader>
          <BrutalistDialogTitle>Sticky Footer</BrutalistDialogTitle>
          <BrutalistDialogDescription>
            Footer actions stay visible while you read through the modal body.
          </BrutalistDialogDescription>
        </BrutalistDialogHeader>
      </div>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
        <!-- Scrollable body -->
      </div>
      <BrutalistDialogFooter>
        <BrutalistDialogClose>
          <BrutalistButton variant="neutral">Close</BrutalistButton>
        </BrutalistDialogClose>
      </BrutalistDialogFooter>
      <BrutalistDialogCloseIcon />
    </BrutalistDialogContent>
  </BrutalistDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog': formatCode(`
<script setup lang="ts">
import {
  BootstrapDialogClose,
  BootstrapDialogCloseIcon,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogFooter,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';
</script>

<template>
  <BootstrapDialogRoot a11y-label="Edit profile">
    <BootstrapDialogTrigger>Open Dialog</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>Edit profile</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          Make changes to your profile here. Click save when you're done.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogFooter>
        <BootstrapDialogClose>Close</BootstrapDialogClose>
        <BootstrapDialogClose>Save changes</BootstrapDialogClose>
      </BootstrapDialogFooter>
      <BootstrapDialogCloseIcon />
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog-no-close': formatCode(`
<script setup lang="ts">
import {
  BootstrapDialogClose,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogFooter,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';
</script>

<template>
  <BootstrapDialogRoot a11y-label="No close button">
    <BootstrapDialogTrigger>No Close Button</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>No Close Button</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          This modal omits the top-right close icon and delegates dismissal to Escape, backdrop click, or the footer button.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogFooter>
        <BootstrapDialogClose>Close</BootstrapDialogClose>
      </BootstrapDialogFooter>
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog-scrollable': formatCode(`
<script setup lang="ts">
import {
  BootstrapDialogCloseIcon,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';
</script>

<template>
  <BootstrapDialogRoot a11y-label="Scrollable content">
    <BootstrapDialogTrigger>Scrollable Content</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>Scrollable Content</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="max-h-[45vh] overflow-y-auto px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          Long body text scrolls cleanly inside the 560px classic modal frame.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogCloseIcon />
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog-sticky-footer': formatCode(`
<script setup lang="ts">
import {
  BootstrapDialogClose,
  BootstrapDialogCloseIcon,
  BootstrapDialogContent,
  BootstrapDialogDescription,
  BootstrapDialogFooter,
  BootstrapDialogHeader,
  BootstrapDialogMask,
  BootstrapDialogRoot,
  BootstrapDialogTitle,
  BootstrapDialogTrigger,
} from '@/components/proto-ui/bootstrap-2-3-2';
</script>

<template>
  <BootstrapDialogRoot a11y-label="Sticky footer">
    <BootstrapDialogTrigger>Sticky Footer</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>Deployment checklist</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="max-h-[40vh] overflow-y-auto px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          Review the checklist while the modal footer stays pinned below.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogFooter>
        <BootstrapDialogClose>Cancel</BootstrapDialogClose>
        <BootstrapDialogClose>Confirm</BootstrapDialogClose>
      </BootstrapDialogFooter>
      <BootstrapDialogCloseIcon />
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';
</script>

<template>
  <LiquidGlassDialogRoot a11y-label="Edit profile">
    <LiquidGlassDialogTrigger>Open Dialog</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent>
      <LiquidGlassDialogTitle>Edit profile</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        Make changes to your profile here. Click save when you're done.
      </LiquidGlassDialogDescription>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="regular">Cancel</LiquidGlassDialogClose>
        <LiquidGlassDialogClose prominence="prominent">Save changes</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog-prominence': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';
</script>

<template>
  <LiquidGlassDialogRoot a11y-label="Delete workspace">
    <LiquidGlassDialogTrigger prominence="prominent">Delete Workspace</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent>
      <LiquidGlassDialogTitle>Delete workspace?</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        This removes local previews and archived builds from this device.
      </LiquidGlassDialogDescription>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="regular">Keep Workspace</LiquidGlassDialogClose>
        <LiquidGlassDialogClose prominence="destructive">Delete</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog-scrollable': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';
</script>

<template>
  <LiquidGlassDialogRoot a11y-label="Scrollable sheet">
    <LiquidGlassDialogTrigger>Scrollable Content</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent>
      <LiquidGlassDialogTitle>Material guidelines</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        Scrollable content stays readable while footer controls remain fixed below.
      </LiquidGlassDialogDescription>
      <div class="max-h-[42vh] overflow-y-auto pr-2 grid gap-2.5 text-sm text-muted-foreground">
        <!-- Scrollable notes -->
      </div>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="prominent">Done</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog-opaque': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassDialogClose,
  LiquidGlassDialogContent,
  LiquidGlassDialogDescription,
  LiquidGlassDialogMask,
  LiquidGlassDialogRoot,
  LiquidGlassDialogTitle,
  LiquidGlassDialogTrigger,
} from '@/components/proto-ui/liquid-glass';
</script>

<template>
  <LiquidGlassDialogRoot a11y-label="Opaque surface dialog">
    <LiquidGlassDialogTrigger>Opaque Material</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent material="opaque">
      <LiquidGlassDialogTitle>Opaque surface opt-out</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        Set material="opaque" on the content surface when dense text or data requires a solid background.
      </LiquidGlassDialogDescription>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="regular">Close</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-dialog-custom-close': formatCode(`
<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">Share</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Share link</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          Anyone who has this link will be able to view this.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <ShadcnDialogFooter class="justify-start">
        <ShadcnDialogClose>
          <ShadcnButton variant="secondary">Close</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
      <ShadcnDialogCloseIcon />
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-no-close': formatCode(`
<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">No Close Button</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <template #close />
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>No Close Button</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          This dialog doesn't have a close button in the top-right corner.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <ShadcnDialogFooter>
        <ShadcnDialogClose>
          <ShadcnButton variant="outline">Done</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-sticky-footer': formatCode(`
<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">Sticky Footer</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Sticky Footer</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          This dialog keeps its footer actions visible while the content scrolls.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
        <!-- Long scrollable content -->
      </div>
      <ShadcnDialogFooter>
        <ShadcnDialogClose>
          <ShadcnButton variant="outline">Close</ShadcnButton>
        </ShadcnDialogClose>
      </ShadcnDialogFooter>
      <ShadcnDialogCloseIcon />
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-scrollable': formatCode(`
<template>
  <ShadcnDialogRoot>
    <ShadcnDialogTrigger>
      <ShadcnButton variant="outline">Scrollable Content</ShadcnButton>
    </ShadcnDialogTrigger>
    <ShadcnDialogMask />
    <ShadcnDialogContent>
      <ShadcnDialogHeader>
        <ShadcnDialogTitle>Scrollable Content</ShadcnDialogTitle>
        <ShadcnDialogDescription>
          Long content scrolls cleanly while the dialog header stays in view.
        </ShadcnDialogDescription>
      </ShadcnDialogHeader>
      <div class="max-h-[50vh] overflow-y-auto pr-2 grid gap-3 text-sm text-muted-foreground">
        <!-- Long scrollable content -->
      </div>
      <ShadcnDialogCloseIcon />
    </ShadcnDialogContent>
  </ShadcnDialogRoot>
</template>
    `),
    'demo-shadcn-dialog-rtl': formatCode(`
<template>
  <div dir="rtl">
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>
        <ShadcnButton variant="outline">فتح الحوار</ShadcnButton>
      </ShadcnDialogTrigger>
      <ShadcnDialogMask />
      <ShadcnDialogContent>
        <div dir="rtl" class="grid gap-4 text-start">
          <ShadcnDialogHeader>
            <ShadcnDialogTitle>تعديل الملف الشخصي</ShadcnDialogTitle>
            <ShadcnDialogDescription>
              قم بإجراء تغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.
            </ShadcnDialogDescription>
          </ShadcnDialogHeader>
          <ShadcnDialogFooter>
            <ShadcnDialogClose>
              <ShadcnButton variant="outline">إلغاء</ShadcnButton>
            </ShadcnDialogClose>
            <ShadcnDialogClose>
              <ShadcnButton>حفظ التغييرات</ShadcnButton>
            </ShadcnDialogClose>
          </ShadcnDialogFooter>
        </div>
        <ShadcnDialogCloseIcon />
      </ShadcnDialogContent>
    </ShadcnDialogRoot>
  </div>
</template>
    `),
    'demo-brutalist-dialog': formatCode(`
<template>
  <BrutalistDialogRoot>
    <BrutalistDialogTrigger>Edit Profile</BrutalistDialogTrigger>
    <BrutalistDialogMask />
    <BrutalistDialogContent>
      <div class="min-w-0 pe-12">
        <BrutalistDialogHeader>
          <BrutalistDialogTitle>Edit profile</BrutalistDialogTitle>
          <BrutalistDialogDescription>
            Make changes to your profile here. Click save when you're done.
          </BrutalistDialogDescription>
        </BrutalistDialogHeader>
      </div>
      <BrutalistDialogFooter>
        <BrutalistDialogClose>
          <BrutalistButton variant="neutral">Cancel</BrutalistButton>
        </BrutalistDialogClose>
        <BrutalistDialogClose>
          <BrutalistButton>Save changes</BrutalistButton>
        </BrutalistDialogClose>
      </BrutalistDialogFooter>
      <BrutalistDialogCloseIcon />
    </BrutalistDialogContent>
  </BrutalistDialogRoot>
</template>
    `),
    'demo-brutalist-dialog-scrollable': formatCode(`
<template>
  <BrutalistDialogRoot>
    <BrutalistDialogTrigger>Scrollable Content</BrutalistDialogTrigger>
    <BrutalistDialogMask />
    <BrutalistDialogContent>
      <div class="min-w-0 pe-12">
        <BrutalistDialogHeader>
          <BrutalistDialogTitle>Scrollable Content</BrutalistDialogTitle>
          <BrutalistDialogDescription>
            Scroll through long changelog entries while keeping the header anchored.
          </BrutalistDialogDescription>
        </BrutalistDialogHeader>
      </div>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
        <!-- Scrollable items -->
      </div>
      <BrutalistDialogCloseIcon />
    </BrutalistDialogContent>
  </BrutalistDialogRoot>
</template>
    `),
    'demo-brutalist-dialog-sticky-footer': formatCode(`
<template>
  <BrutalistDialogRoot>
    <BrutalistDialogTrigger>Sticky Footer</BrutalistDialogTrigger>
    <BrutalistDialogMask />
    <BrutalistDialogContent>
      <div class="min-w-0 pe-12">
        <BrutalistDialogHeader>
          <BrutalistDialogTitle>Sticky Footer</BrutalistDialogTitle>
          <BrutalistDialogDescription>
            Footer actions stay visible while you read through the modal body.
          </BrutalistDialogDescription>
        </BrutalistDialogHeader>
      </div>
      <div class="max-h-[45vh] overflow-y-auto pr-2 grid gap-3 text-sm">
        <!-- Scrollable body -->
      </div>
      <BrutalistDialogFooter>
        <BrutalistDialogClose>
          <BrutalistButton variant="neutral">Close</BrutalistButton>
        </BrutalistDialogClose>
      </BrutalistDialogFooter>
      <BrutalistDialogCloseIcon />
    </BrutalistDialogContent>
  </BrutalistDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog': formatCode(`
<template>
  <BootstrapDialogRoot a11y-label="Edit profile">
    <BootstrapDialogTrigger>Open Dialog</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>Edit profile</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          Make changes to your profile here. Click save when you're done.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogFooter>
        <BootstrapDialogClose>Close</BootstrapDialogClose>
        <BootstrapDialogClose>Save changes</BootstrapDialogClose>
      </BootstrapDialogFooter>
      <BootstrapDialogCloseIcon />
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog-no-close': formatCode(`
<template>
  <BootstrapDialogRoot a11y-label="No close button">
    <BootstrapDialogTrigger>No Close Button</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>No Close Button</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          This modal omits the top-right close icon and delegates dismissal to Escape, backdrop click, or the footer button.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogFooter>
        <BootstrapDialogClose>Close</BootstrapDialogClose>
      </BootstrapDialogFooter>
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog-scrollable': formatCode(`
<template>
  <BootstrapDialogRoot a11y-label="Scrollable content">
    <BootstrapDialogTrigger>Scrollable Content</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>Scrollable Content</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="max-h-[45vh] overflow-y-auto px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          Long body text scrolls cleanly inside the 560px classic modal frame.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogCloseIcon />
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-dialog-sticky-footer': formatCode(`
<template>
  <BootstrapDialogRoot a11y-label="Sticky footer">
    <BootstrapDialogTrigger>Sticky Footer</BootstrapDialogTrigger>
    <BootstrapDialogMask />
    <BootstrapDialogContent>
      <BootstrapDialogHeader>
        <BootstrapDialogTitle>Deployment checklist</BootstrapDialogTitle>
      </BootstrapDialogHeader>
      <div class="max-h-[40vh] overflow-y-auto px-[15px] py-[15px]">
        <BootstrapDialogDescription>
          Review the checklist while the modal footer stays pinned below.
        </BootstrapDialogDescription>
      </div>
      <BootstrapDialogFooter>
        <BootstrapDialogClose>Cancel</BootstrapDialogClose>
        <BootstrapDialogClose>Confirm</BootstrapDialogClose>
      </BootstrapDialogFooter>
      <BootstrapDialogCloseIcon />
    </BootstrapDialogContent>
  </BootstrapDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog': formatCode(`
<template>
  <LiquidGlassDialogRoot a11y-label="Edit profile">
    <LiquidGlassDialogTrigger>Open Dialog</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent>
      <LiquidGlassDialogTitle>Edit profile</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        Make changes to your profile here. Click save when you're done.
      </LiquidGlassDialogDescription>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="regular">Cancel</LiquidGlassDialogClose>
        <LiquidGlassDialogClose prominence="prominent">Save changes</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog-prominence': formatCode(`
<template>
  <LiquidGlassDialogRoot a11y-label="Delete workspace">
    <LiquidGlassDialogTrigger prominence="prominent">Delete Workspace</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent>
      <LiquidGlassDialogTitle>Delete workspace?</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        This removes local previews and archived builds from this device.
      </LiquidGlassDialogDescription>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="regular">Keep Workspace</LiquidGlassDialogClose>
        <LiquidGlassDialogClose prominence="destructive">Delete</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog-scrollable': formatCode(`
<template>
  <LiquidGlassDialogRoot a11y-label="Scrollable sheet">
    <LiquidGlassDialogTrigger>Scrollable Content</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent>
      <LiquidGlassDialogTitle>Material guidelines</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        Scrollable content stays readable while footer controls remain fixed below.
      </LiquidGlassDialogDescription>
      <div class="max-h-[42vh] overflow-y-auto pr-2 grid gap-2.5 text-sm text-muted-foreground">
        <!-- Scrollable notes -->
      </div>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="prominent">Done</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
    'demo-liquid-glass-dialog-opaque': formatCode(`
<template>
  <LiquidGlassDialogRoot a11y-label="Opaque surface dialog">
    <LiquidGlassDialogTrigger>Opaque Material</LiquidGlassDialogTrigger>
    <LiquidGlassDialogMask />
    <LiquidGlassDialogContent material="opaque">
      <LiquidGlassDialogTitle>Opaque surface opt-out</LiquidGlassDialogTitle>
      <LiquidGlassDialogDescription>
        Set material="opaque" on the content surface when dense text or data requires a solid background.
      </LiquidGlassDialogDescription>
      <div class="flex justify-end gap-2">
        <LiquidGlassDialogClose prominence="regular">Close</LiquidGlassDialogClose>
      </div>
    </LiquidGlassDialogContent>
  </LiquidGlassDialogRoot>
</template>
    `),
  },
};
