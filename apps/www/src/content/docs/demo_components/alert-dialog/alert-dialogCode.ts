import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-alert-dialog': formatCode(`
<wc-shadcn-alert-dialog-root style-profile="rhea">
  <wc-shadcn-alert-dialog-trigger style-profile="rhea" variant="outline">Show Dialog</wc-shadcn-alert-dialog-trigger>
  <wc-shadcn-alert-dialog-mask style-profile="rhea"></wc-shadcn-alert-dialog-mask>
  <wc-shadcn-alert-dialog-content style-profile="rhea">
    <wc-shadcn-alert-dialog-header style-profile="rhea">
      <wc-shadcn-alert-dialog-title style-profile="rhea">Are you absolutely sure?</wc-shadcn-alert-dialog-title>
      <wc-shadcn-alert-dialog-description style-profile="rhea">
        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
      </wc-shadcn-alert-dialog-description>
    </wc-shadcn-alert-dialog-header>
    <wc-shadcn-alert-dialog-footer style-profile="rhea">
      <wc-shadcn-alert-dialog-cancel style-profile="rhea">Cancel</wc-shadcn-alert-dialog-cancel>
      <wc-shadcn-alert-dialog-action style-profile="rhea">Continue</wc-shadcn-alert-dialog-action>
    </wc-shadcn-alert-dialog-footer>
  </wc-shadcn-alert-dialog-content>
</wc-shadcn-alert-dialog-root>
    `),
    'demo-shadcn-alert-dialog-small': formatCode(`
<wc-shadcn-alert-dialog-root style-profile="rhea">
  <wc-shadcn-alert-dialog-trigger style-profile="rhea" variant="outline">Show Dialog</wc-shadcn-alert-dialog-trigger>
  <wc-shadcn-alert-dialog-mask style-profile="rhea"></wc-shadcn-alert-dialog-mask>
  <wc-shadcn-alert-dialog-content style-profile="rhea" size="sm">
    <wc-shadcn-alert-dialog-header style-profile="rhea" align="center">
      <wc-shadcn-alert-dialog-title style-profile="rhea">Allow accessory to connect?</wc-shadcn-alert-dialog-title>
      <wc-shadcn-alert-dialog-description style-profile="rhea">
        Do you want to allow the USB accessory to connect to this device?
      </wc-shadcn-alert-dialog-description>
    </wc-shadcn-alert-dialog-header>
    <wc-shadcn-alert-dialog-footer style-profile="rhea">
      <wc-shadcn-alert-dialog-cancel style-profile="rhea">Don't allow</wc-shadcn-alert-dialog-cancel>
      <wc-shadcn-alert-dialog-action style-profile="rhea">Allow</wc-shadcn-alert-dialog-action>
    </wc-shadcn-alert-dialog-footer>
  </wc-shadcn-alert-dialog-content>
</wc-shadcn-alert-dialog-root>
    `),
    'demo-shadcn-alert-dialog-media': formatCode(`
<wc-shadcn-alert-dialog-root style-profile="rhea">
  <wc-shadcn-alert-dialog-trigger style-profile="rhea" variant="outline">Share Project</wc-shadcn-alert-dialog-trigger>
  <wc-shadcn-alert-dialog-mask style-profile="rhea"></wc-shadcn-alert-dialog-mask>
  <wc-shadcn-alert-dialog-content style-profile="rhea">
    <wc-shadcn-alert-dialog-header style-profile="rhea" align="center">
      <div class="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground" aria-hidden="true">+</div>
      <wc-shadcn-alert-dialog-title style-profile="rhea">Share this project?</wc-shadcn-alert-dialog-title>
      <wc-shadcn-alert-dialog-description style-profile="rhea">
        Anyone with the link will be able to view and edit this project.
      </wc-shadcn-alert-dialog-description>
    </wc-shadcn-alert-dialog-header>
    <wc-shadcn-alert-dialog-footer style-profile="rhea">
      <wc-shadcn-alert-dialog-cancel style-profile="rhea">Cancel</wc-shadcn-alert-dialog-cancel>
      <wc-shadcn-alert-dialog-action style-profile="rhea">Share</wc-shadcn-alert-dialog-action>
    </wc-shadcn-alert-dialog-footer>
  </wc-shadcn-alert-dialog-content>
</wc-shadcn-alert-dialog-root>
    `),
    'demo-shadcn-alert-dialog-destructive': formatCode(`
<wc-shadcn-alert-dialog-root style-profile="rhea">
  <wc-shadcn-alert-dialog-trigger style-profile="rhea" variant="destructive">Delete Chat</wc-shadcn-alert-dialog-trigger>
  <wc-shadcn-alert-dialog-mask style-profile="rhea"></wc-shadcn-alert-dialog-mask>
  <wc-shadcn-alert-dialog-content style-profile="rhea" size="sm">
    <wc-shadcn-alert-dialog-header style-profile="rhea" align="center">
      <div class="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive" aria-hidden="true">!</div>
      <wc-shadcn-alert-dialog-title style-profile="rhea">Delete chat?</wc-shadcn-alert-dialog-title>
      <wc-shadcn-alert-dialog-description style-profile="rhea">
        This will permanently delete this chat conversation and remove any memories saved during this chat.
      </wc-shadcn-alert-dialog-description>
    </wc-shadcn-alert-dialog-header>
    <wc-shadcn-alert-dialog-footer style-profile="rhea">
      <wc-shadcn-alert-dialog-cancel style-profile="rhea" variant="outline">Cancel</wc-shadcn-alert-dialog-cancel>
      <wc-shadcn-alert-dialog-action style-profile="rhea" variant="destructive">Delete</wc-shadcn-alert-dialog-action>
    </wc-shadcn-alert-dialog-footer>
  </wc-shadcn-alert-dialog-content>
</wc-shadcn-alert-dialog-root>
    `),
    'demo-shadcn-alert-dialog-controlled': formatCode(`
<wc-shadcn-alert-dialog-root id="controlled-alert" style-profile="rhea">
  <wc-shadcn-alert-dialog-trigger style-profile="rhea" variant="outline">Archive Workspace</wc-shadcn-alert-dialog-trigger>
  <wc-shadcn-alert-dialog-mask style-profile="rhea"></wc-shadcn-alert-dialog-mask>
  <wc-shadcn-alert-dialog-content style-profile="rhea">
    <wc-shadcn-alert-dialog-header style-profile="rhea">
      <wc-shadcn-alert-dialog-title style-profile="rhea">Archive this workspace?</wc-shadcn-alert-dialog-title>
      <wc-shadcn-alert-dialog-description style-profile="rhea">
        Members will keep read-only access until an administrator restores the workspace.
      </wc-shadcn-alert-dialog-description>
    </wc-shadcn-alert-dialog-header>
    <wc-shadcn-alert-dialog-footer style-profile="rhea">
      <wc-shadcn-alert-dialog-cancel style-profile="rhea">Cancel</wc-shadcn-alert-dialog-cancel>
      <wc-shadcn-alert-dialog-action id="archive-action" style-profile="rhea">Archive</wc-shadcn-alert-dialog-action>
    </wc-shadcn-alert-dialog-footer>
  </wc-shadcn-alert-dialog-content>
</wc-shadcn-alert-dialog-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#controlled-alert');
  setElementProps(root, { open: false });
  root.addEventListener('openChange', (e) => setElementProps(root, { open: e.detail.open }));
</script>
    `),
    'demo-shadcn-alert-dialog-rtl': formatCode(`
<div dir="rtl" lang="ar" class="flex gap-4">
  <wc-shadcn-alert-dialog-root style-profile="rhea">
    <wc-shadcn-alert-dialog-trigger style-profile="rhea" variant="outline">إظهار الحوار</wc-shadcn-alert-dialog-trigger>
    <wc-shadcn-alert-dialog-mask style-profile="rhea"></wc-shadcn-alert-dialog-mask>
    <wc-shadcn-alert-dialog-content style-profile="rhea">
      <div dir="rtl" lang="ar" class="grid gap-6">
        <wc-shadcn-alert-dialog-header style-profile="rhea">
          <wc-shadcn-alert-dialog-title style-profile="rhea">هل أنت متأكد تمامًا؟</wc-shadcn-alert-dialog-title>
          <wc-shadcn-alert-dialog-description style-profile="rhea">
            لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا من خوادمنا.
          </wc-shadcn-alert-dialog-description>
        </wc-shadcn-alert-dialog-header>
        <wc-shadcn-alert-dialog-footer style-profile="rhea">
          <wc-shadcn-alert-dialog-cancel style-profile="rhea">إلغاء</wc-shadcn-alert-dialog-cancel>
          <wc-shadcn-alert-dialog-action style-profile="rhea">متابعة</wc-shadcn-alert-dialog-action>
        </wc-shadcn-alert-dialog-footer>
      </div>
    </wc-shadcn-alert-dialog-content>
  </wc-shadcn-alert-dialog-root>
</div>
    `),
    'demo-brutalist-alert-dialog': formatCode(`
<wc-brutalist-alert-dialog-root>
  <wc-brutalist-alert-dialog-trigger>Open</wc-brutalist-alert-dialog-trigger>
  <wc-brutalist-alert-dialog-mask></wc-brutalist-alert-dialog-mask>
  <wc-brutalist-alert-dialog-content>
    <wc-brutalist-alert-dialog-header>
      <wc-brutalist-alert-dialog-title>Are you absolutely sure?</wc-brutalist-alert-dialog-title>
      <wc-brutalist-alert-dialog-description>
        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
      </wc-brutalist-alert-dialog-description>
    </wc-brutalist-alert-dialog-header>
    <wc-brutalist-alert-dialog-footer>
      <wc-brutalist-alert-dialog-cancel>Cancel</wc-brutalist-alert-dialog-cancel>
      <wc-brutalist-alert-dialog-action>Continue</wc-brutalist-alert-dialog-action>
    </wc-brutalist-alert-dialog-footer>
  </wc-brutalist-alert-dialog-content>
</wc-brutalist-alert-dialog-root>
    `),
    'demo-brutalist-alert-dialog-small': formatCode(`
<wc-brutalist-alert-dialog-root>
  <wc-brutalist-alert-dialog-trigger>Show Dialog</wc-brutalist-alert-dialog-trigger>
  <wc-brutalist-alert-dialog-mask></wc-brutalist-alert-dialog-mask>
  <wc-brutalist-alert-dialog-content size="sm">
    <wc-brutalist-alert-dialog-header>
      <wc-brutalist-alert-dialog-title>Allow accessory to connect?</wc-brutalist-alert-dialog-title>
      <wc-brutalist-alert-dialog-description>
        Do you want to allow the USB accessory to connect to this device?
      </wc-brutalist-alert-dialog-description>
    </wc-brutalist-alert-dialog-header>
    <wc-brutalist-alert-dialog-footer>
      <wc-brutalist-alert-dialog-cancel>Don't allow</wc-brutalist-alert-dialog-cancel>
      <wc-brutalist-alert-dialog-action>Allow</wc-brutalist-alert-dialog-action>
    </wc-brutalist-alert-dialog-footer>
  </wc-brutalist-alert-dialog-content>
</wc-brutalist-alert-dialog-root>
    `),
    'demo-brutalist-alert-dialog-media': formatCode(`
<wc-brutalist-alert-dialog-root>
  <wc-brutalist-alert-dialog-trigger>Share Project</wc-brutalist-alert-dialog-trigger>
  <wc-brutalist-alert-dialog-mask></wc-brutalist-alert-dialog-mask>
  <wc-brutalist-alert-dialog-content>
    <wc-brutalist-alert-dialog-header>
      <div class="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-secondary-background font-bold" aria-hidden="true">+</div>
      <wc-brutalist-alert-dialog-title>Share this project?</wc-brutalist-alert-dialog-title>
      <wc-brutalist-alert-dialog-description>
        Anyone with the link will be able to view and edit this project.
      </wc-brutalist-alert-dialog-description>
    </wc-brutalist-alert-dialog-header>
    <wc-brutalist-alert-dialog-footer>
      <wc-brutalist-alert-dialog-cancel>Cancel</wc-brutalist-alert-dialog-cancel>
      <wc-brutalist-alert-dialog-action>Share</wc-brutalist-alert-dialog-action>
    </wc-brutalist-alert-dialog-footer>
  </wc-brutalist-alert-dialog-content>
</wc-brutalist-alert-dialog-root>
    `),
    'demo-brutalist-alert-dialog-destructive': formatCode(`
<wc-brutalist-alert-dialog-root>
  <wc-brutalist-alert-dialog-trigger>Delete Chat</wc-brutalist-alert-dialog-trigger>
  <wc-brutalist-alert-dialog-mask></wc-brutalist-alert-dialog-mask>
  <wc-brutalist-alert-dialog-content size="sm">
    <wc-brutalist-alert-dialog-header>
      <div class="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-destructive/20 font-bold text-destructive" aria-hidden="true">!</div>
      <wc-brutalist-alert-dialog-title>Delete chat?</wc-brutalist-alert-dialog-title>
      <wc-brutalist-alert-dialog-description>
        This will permanently delete this chat conversation and remove any saved memories.
      </wc-brutalist-alert-dialog-description>
    </wc-brutalist-alert-dialog-header>
    <wc-brutalist-alert-dialog-footer>
      <wc-brutalist-alert-dialog-cancel>Cancel</wc-brutalist-alert-dialog-cancel>
      <wc-brutalist-alert-dialog-action>Delete</wc-brutalist-alert-dialog-action>
    </wc-brutalist-alert-dialog-footer>
  </wc-brutalist-alert-dialog-content>
</wc-brutalist-alert-dialog-root>
    `),
    'demo-brutalist-alert-dialog-controlled': formatCode(`
<wc-brutalist-alert-dialog-root id="brutalist-controlled">
  <wc-brutalist-alert-dialog-trigger>Archive Workspace</wc-brutalist-alert-dialog-trigger>
  <wc-brutalist-alert-dialog-mask></wc-brutalist-alert-dialog-mask>
  <wc-brutalist-alert-dialog-content>
    <wc-brutalist-alert-dialog-header>
      <wc-brutalist-alert-dialog-title>Archive this workspace?</wc-brutalist-alert-dialog-title>
      <wc-brutalist-alert-dialog-description>
        Members will keep read-only access until an administrator restores the workspace.
      </wc-brutalist-alert-dialog-description>
    </wc-brutalist-alert-dialog-header>
    <wc-brutalist-alert-dialog-footer>
      <wc-brutalist-alert-dialog-cancel>Cancel</wc-brutalist-alert-dialog-cancel>
      <wc-brutalist-alert-dialog-action>Archive</wc-brutalist-alert-dialog-action>
    </wc-brutalist-alert-dialog-footer>
  </wc-brutalist-alert-dialog-content>
</wc-brutalist-alert-dialog-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#brutalist-controlled');
  setElementProps(root, { open: false });
  root.addEventListener('openChange', (e) => setElementProps(root, { open: e.detail.open }));
</script>
    `),
    'demo-bootstrap-2-3-2-alert-dialog': formatCode(`
<wc-bootstrap-2-3-2-alert-dialog-root>
  <wc-bootstrap-2-3-2-alert-dialog-trigger>Show Dialog</wc-bootstrap-2-3-2-alert-dialog-trigger>
  <wc-bootstrap-2-3-2-alert-dialog-mask></wc-bootstrap-2-3-2-alert-dialog-mask>
  <wc-bootstrap-2-3-2-alert-dialog-content>
    <wc-bootstrap-2-3-2-alert-dialog-title>Are you absolutely sure?</wc-bootstrap-2-3-2-alert-dialog-title>
    <wc-bootstrap-2-3-2-alert-dialog-description>
      This action cannot be undone. This will permanently delete your account and remove your data from our servers.
    </wc-bootstrap-2-3-2-alert-dialog-description>
    <wc-bootstrap-2-3-2-alert-dialog-footer>
      <wc-bootstrap-2-3-2-alert-dialog-cancel>Cancel</wc-bootstrap-2-3-2-alert-dialog-cancel>
      <wc-bootstrap-2-3-2-alert-dialog-action>Continue</wc-bootstrap-2-3-2-alert-dialog-action>
    </wc-bootstrap-2-3-2-alert-dialog-footer>
  </wc-bootstrap-2-3-2-alert-dialog-content>
</wc-bootstrap-2-3-2-alert-dialog-root>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-small': formatCode(`
<wc-bootstrap-2-3-2-alert-dialog-root>
  <wc-bootstrap-2-3-2-alert-dialog-trigger>Show Compact Dialog</wc-bootstrap-2-3-2-alert-dialog-trigger>
  <wc-bootstrap-2-3-2-alert-dialog-mask></wc-bootstrap-2-3-2-alert-dialog-mask>
  <wc-bootstrap-2-3-2-alert-dialog-content size="sm">
    <wc-bootstrap-2-3-2-alert-dialog-title>Allow accessory to connect?</wc-bootstrap-2-3-2-alert-dialog-title>
    <wc-bootstrap-2-3-2-alert-dialog-description>
      Do you want to allow the USB accessory to connect to this device?
    </wc-bootstrap-2-3-2-alert-dialog-description>
    <wc-bootstrap-2-3-2-alert-dialog-footer>
      <wc-bootstrap-2-3-2-alert-dialog-cancel>Don't allow</wc-bootstrap-2-3-2-alert-dialog-cancel>
      <wc-bootstrap-2-3-2-alert-dialog-action>Allow</wc-bootstrap-2-3-2-alert-dialog-action>
    </wc-bootstrap-2-3-2-alert-dialog-footer>
  </wc-bootstrap-2-3-2-alert-dialog-content>
</wc-bootstrap-2-3-2-alert-dialog-root>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-destructive': formatCode(`
<wc-bootstrap-2-3-2-alert-dialog-root>
  <wc-bootstrap-2-3-2-alert-dialog-trigger variant="danger">Delete Chat</wc-bootstrap-2-3-2-alert-dialog-trigger>
  <wc-bootstrap-2-3-2-alert-dialog-mask></wc-bootstrap-2-3-2-alert-dialog-mask>
  <wc-bootstrap-2-3-2-alert-dialog-content size="sm">
    <wc-bootstrap-2-3-2-alert-dialog-title>Delete chat?</wc-bootstrap-2-3-2-alert-dialog-title>
    <wc-bootstrap-2-3-2-alert-dialog-description>
      This will permanently delete this chat conversation and remove any saved memories.
    </wc-bootstrap-2-3-2-alert-dialog-description>
    <wc-bootstrap-2-3-2-alert-dialog-footer>
      <wc-bootstrap-2-3-2-alert-dialog-cancel>Cancel</wc-bootstrap-2-3-2-alert-dialog-cancel>
      <wc-bootstrap-2-3-2-alert-dialog-action variant="danger">Delete</wc-bootstrap-2-3-2-alert-dialog-action>
    </wc-bootstrap-2-3-2-alert-dialog-footer>
  </wc-bootstrap-2-3-2-alert-dialog-content>
</wc-bootstrap-2-3-2-alert-dialog-root>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-controlled': formatCode(`
<wc-bootstrap-2-3-2-alert-dialog-root id="bs-controlled">
  <wc-bootstrap-2-3-2-alert-dialog-trigger>Archive Workspace</wc-bootstrap-2-3-2-alert-dialog-trigger>
  <wc-bootstrap-2-3-2-alert-dialog-mask></wc-bootstrap-2-3-2-alert-dialog-mask>
  <wc-bootstrap-2-3-2-alert-dialog-content>
    <wc-bootstrap-2-3-2-alert-dialog-title>Archive this workspace?</wc-bootstrap-2-3-2-alert-dialog-title>
    <wc-bootstrap-2-3-2-alert-dialog-description>
      Members will keep read-only access until an administrator restores the workspace.
    </wc-bootstrap-2-3-2-alert-dialog-description>
    <wc-bootstrap-2-3-2-alert-dialog-footer>
      <wc-bootstrap-2-3-2-alert-dialog-cancel>Cancel</wc-bootstrap-2-3-2-alert-dialog-cancel>
      <wc-bootstrap-2-3-2-alert-dialog-action>Archive</wc-bootstrap-2-3-2-alert-dialog-action>
    </wc-bootstrap-2-3-2-alert-dialog-footer>
  </wc-bootstrap-2-3-2-alert-dialog-content>
</wc-bootstrap-2-3-2-alert-dialog-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#bs-controlled');
  setElementProps(root, { open: false });
  root.addEventListener('openChange', (e) => setElementProps(root, { open: e.detail.open }));
</script>
    `),
    'demo-liquid-glass-alert-dialog': formatCode(`
<wc-liquid-glass-alert-dialog-root>
  <wc-liquid-glass-alert-dialog-trigger>Show Dialog</wc-liquid-glass-alert-dialog-trigger>
  <wc-liquid-glass-alert-dialog-mask></wc-liquid-glass-alert-dialog-mask>
  <wc-liquid-glass-alert-dialog-content>
    <div class="grid gap-1.5">
      <wc-liquid-glass-alert-dialog-title>Are you absolutely sure?</wc-liquid-glass-alert-dialog-title>
      <wc-liquid-glass-alert-dialog-description>
        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
      </wc-liquid-glass-alert-dialog-description>
    </div>
    <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
      <wc-liquid-glass-alert-dialog-cancel>Cancel</wc-liquid-glass-alert-dialog-cancel>
      <wc-liquid-glass-alert-dialog-action>Continue</wc-liquid-glass-alert-dialog-action>
    </div>
  </wc-liquid-glass-alert-dialog-content>
</wc-liquid-glass-alert-dialog-root>
    `),
    'demo-liquid-glass-alert-dialog-small': formatCode(`
<wc-liquid-glass-alert-dialog-root>
  <wc-liquid-glass-alert-dialog-trigger>Show Compact Sheet</wc-liquid-glass-alert-dialog-trigger>
  <wc-liquid-glass-alert-dialog-mask></wc-liquid-glass-alert-dialog-mask>
  <wc-liquid-glass-alert-dialog-content size="sm">
    <div class="grid gap-1.5 text-center">
      <wc-liquid-glass-alert-dialog-title>Allow accessory to connect?</wc-liquid-glass-alert-dialog-title>
      <wc-liquid-glass-alert-dialog-description>
        Do you want to allow the USB accessory to connect to this device?
      </wc-liquid-glass-alert-dialog-description>
    </div>
    <div class="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
      <wc-liquid-glass-alert-dialog-cancel>Don't allow</wc-liquid-glass-alert-dialog-cancel>
      <wc-liquid-glass-alert-dialog-action>Allow</wc-liquid-glass-alert-dialog-action>
    </div>
  </wc-liquid-glass-alert-dialog-content>
</wc-liquid-glass-alert-dialog-root>
    `),
    'demo-liquid-glass-alert-dialog-destructive': formatCode(`
<wc-liquid-glass-alert-dialog-root>
  <wc-liquid-glass-alert-dialog-trigger variant="destructive">Delete Chat</wc-liquid-glass-alert-dialog-trigger>
  <wc-liquid-glass-alert-dialog-mask></wc-liquid-glass-alert-dialog-mask>
  <wc-liquid-glass-alert-dialog-content size="sm">
    <div class="grid place-items-center gap-1.5 text-center">
      <wc-liquid-glass-alert-dialog-title>Delete chat?</wc-liquid-glass-alert-dialog-title>
      <wc-liquid-glass-alert-dialog-description>
        This will permanently delete this chat conversation and remove any saved memories.
      </wc-liquid-glass-alert-dialog-description>
    </div>
    <div class="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
      <wc-liquid-glass-alert-dialog-cancel>Cancel</wc-liquid-glass-alert-dialog-cancel>
      <wc-liquid-glass-alert-dialog-action variant="destructive">Delete</wc-liquid-glass-alert-dialog-action>
    </div>
  </wc-liquid-glass-alert-dialog-content>
</wc-liquid-glass-alert-dialog-root>
    `),
    'demo-liquid-glass-alert-dialog-opaque': formatCode(`
<wc-liquid-glass-alert-dialog-root>
  <wc-liquid-glass-alert-dialog-trigger variant="prominent" material="opaque">Open Opaque Fallback</wc-liquid-glass-alert-dialog-trigger>
  <wc-liquid-glass-alert-dialog-mask></wc-liquid-glass-alert-dialog-mask>
  <wc-liquid-glass-alert-dialog-content material="opaque">
    <div class="grid gap-1.5">
      <wc-liquid-glass-alert-dialog-title>Publish release notes?</wc-liquid-glass-alert-dialog-title>
      <wc-liquid-glass-alert-dialog-description>
        Opaque material mode keeps full contrast over dense backdrops or reduced-transparency environments.
      </wc-liquid-glass-alert-dialog-description>
    </div>
    <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
      <wc-liquid-glass-alert-dialog-cancel>Cancel</wc-liquid-glass-alert-dialog-cancel>
      <wc-liquid-glass-alert-dialog-action>Publish</wc-liquid-glass-alert-dialog-action>
    </div>
  </wc-liquid-glass-alert-dialog-content>
</wc-liquid-glass-alert-dialog-root>
    `),
    'demo-liquid-glass-alert-dialog-controlled': formatCode(`
<wc-liquid-glass-alert-dialog-root id="lg-controlled">
  <wc-liquid-glass-alert-dialog-trigger>Archive Workspace</wc-liquid-glass-alert-dialog-trigger>
  <wc-liquid-glass-alert-dialog-mask></wc-liquid-glass-alert-dialog-mask>
  <wc-liquid-glass-alert-dialog-content>
    <div class="grid gap-1.5">
      <wc-liquid-glass-alert-dialog-title>Archive this workspace?</wc-liquid-glass-alert-dialog-title>
      <wc-liquid-glass-alert-dialog-description>
        Members will keep read-only access until an administrator restores the workspace.
      </wc-liquid-glass-alert-dialog-description>
    </div>
    <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
      <wc-liquid-glass-alert-dialog-cancel>Cancel</wc-liquid-glass-alert-dialog-cancel>
      <wc-liquid-glass-alert-dialog-action>Archive</wc-liquid-glass-alert-dialog-action>
    </div>
  </wc-liquid-glass-alert-dialog-content>
</wc-liquid-glass-alert-dialog-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#lg-controlled');
  setElementProps(root, { open: false });
  root.addEventListener('openChange', (e) => setElementProps(root, { open: e.detail.open }));
</script>
    `),
  },
  react: {
    'demo-shadcn-alert-dialog': formatCode(`
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/react';

export function AlertDialogDemo() {
  return (
    <ShadcnAlertDialogRoot styleProfile="rhea">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">
        Show Dialog
      </ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea">
        <ShadcnAlertDialogHeader styleProfile="rhea">
          <ShadcnAlertDialogTitle styleProfile="rhea">
            Are you absolutely sure?
          </ShadcnAlertDialogTitle>
          <ShadcnAlertDialogDescription styleProfile="rhea">
            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
          </ShadcnAlertDialogDescription>
        </ShadcnAlertDialogHeader>
        <ShadcnAlertDialogFooter styleProfile="rhea">
          <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
          <ShadcnAlertDialogAction styleProfile="rhea">Continue</ShadcnAlertDialogAction>
        </ShadcnAlertDialogFooter>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
  );
}
    `),
    'demo-shadcn-alert-dialog-small': formatCode(`
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/react';

export function AlertDialogSmallDemo() {
  return (
    <ShadcnAlertDialogRoot styleProfile="rhea">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">
        Show Dialog
      </ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea" size="sm">
        <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
          <ShadcnAlertDialogTitle styleProfile="rhea">
            Allow accessory to connect?
          </ShadcnAlertDialogTitle>
          <ShadcnAlertDialogDescription styleProfile="rhea">
            Do you want to allow the USB accessory to connect to this device?
          </ShadcnAlertDialogDescription>
        </ShadcnAlertDialogHeader>
        <ShadcnAlertDialogFooter styleProfile="rhea">
          <ShadcnAlertDialogCancel styleProfile="rhea">Don&apos;t allow</ShadcnAlertDialogCancel>
          <ShadcnAlertDialogAction styleProfile="rhea">Allow</ShadcnAlertDialogAction>
        </ShadcnAlertDialogFooter>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
  );
}
    `),
    'demo-shadcn-alert-dialog-media': formatCode(`
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/react';

export function AlertDialogMediaDemo() {
  return (
    <ShadcnAlertDialogRoot styleProfile="rhea">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">
        Share Project
      </ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea">
        <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
          <div
            className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground"
            aria-hidden="true"
          >
            +
          </div>
          <ShadcnAlertDialogTitle styleProfile="rhea">Share this project?</ShadcnAlertDialogTitle>
          <ShadcnAlertDialogDescription styleProfile="rhea">
            Anyone with the link will be able to view and edit this project.
          </ShadcnAlertDialogDescription>
        </ShadcnAlertDialogHeader>
        <ShadcnAlertDialogFooter styleProfile="rhea">
          <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
          <ShadcnAlertDialogAction styleProfile="rhea">Share</ShadcnAlertDialogAction>
        </ShadcnAlertDialogFooter>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
  );
}
    `),
    'demo-shadcn-alert-dialog-destructive': formatCode(`
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/react';

export function AlertDialogDestructiveDemo() {
  return (
    <ShadcnAlertDialogRoot styleProfile="rhea">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="destructive">
        Delete Chat
      </ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea" size="sm">
        <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
          <div
            className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
            aria-hidden="true"
          >
            !
          </div>
          <ShadcnAlertDialogTitle styleProfile="rhea">Delete chat?</ShadcnAlertDialogTitle>
          <ShadcnAlertDialogDescription styleProfile="rhea">
            This will permanently delete this chat conversation and remove any memories saved during this chat.
          </ShadcnAlertDialogDescription>
        </ShadcnAlertDialogHeader>
        <ShadcnAlertDialogFooter styleProfile="rhea">
          <ShadcnAlertDialogCancel styleProfile="rhea" variant="outline">
            Cancel
          </ShadcnAlertDialogCancel>
          <ShadcnAlertDialogAction styleProfile="rhea" variant="destructive">
            Delete
          </ShadcnAlertDialogAction>
        </ShadcnAlertDialogFooter>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
  );
}
    `),
    'demo-shadcn-alert-dialog-controlled': formatCode(`
import { useState } from 'react';
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/react';

export function AlertDialogControlledDemo() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('Active');
  return (
    <div className="flex items-center gap-4">
      <ShadcnAlertDialogRoot
        styleProfile="rhea"
        open={open}
        onOpenChange={(detail) => setOpen(detail.open)}
      >
        <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">
          Archive Workspace
        </ShadcnAlertDialogTrigger>
        <ShadcnAlertDialogMask styleProfile="rhea" />
        <ShadcnAlertDialogContent styleProfile="rhea">
          <ShadcnAlertDialogHeader styleProfile="rhea">
            <ShadcnAlertDialogTitle styleProfile="rhea">
              Archive this workspace?
            </ShadcnAlertDialogTitle>
            <ShadcnAlertDialogDescription styleProfile="rhea">
              Members will keep read-only access until an administrator restores the workspace.
            </ShadcnAlertDialogDescription>
          </ShadcnAlertDialogHeader>
          <ShadcnAlertDialogFooter styleProfile="rhea">
            <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
            <ShadcnAlertDialogAction styleProfile="rhea" onAction={() => setStatus('Archived')}>
              Archive
            </ShadcnAlertDialogAction>
          </ShadcnAlertDialogFooter>
        </ShadcnAlertDialogContent>
      </ShadcnAlertDialogRoot>
      <span className="text-xs text-muted-foreground">Status: {status}</span>
    </div>
  );
}
    `),
    'demo-shadcn-alert-dialog-rtl': formatCode(`
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/react';

export function AlertDialogRtlDemo() {
  return (
    <div dir="rtl" lang="ar" className="flex gap-4">
      <ShadcnAlertDialogRoot styleProfile="rhea">
        <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">
          إظهار الحوار
        </ShadcnAlertDialogTrigger>
        <ShadcnAlertDialogMask styleProfile="rhea" />
        <ShadcnAlertDialogContent styleProfile="rhea">
          <div dir="rtl" lang="ar" className="grid gap-6">
            <ShadcnAlertDialogHeader styleProfile="rhea">
              <ShadcnAlertDialogTitle styleProfile="rhea">هل أنت متأكد تمامًا؟</ShadcnAlertDialogTitle>
              <ShadcnAlertDialogDescription styleProfile="rhea">
                لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا من خوادمنا.
              </ShadcnAlertDialogDescription>
            </ShadcnAlertDialogHeader>
            <ShadcnAlertDialogFooter styleProfile="rhea">
              <ShadcnAlertDialogCancel styleProfile="rhea">إلغاء</ShadcnAlertDialogCancel>
              <ShadcnAlertDialogAction styleProfile="rhea">متابعة</ShadcnAlertDialogAction>
            </ShadcnAlertDialogFooter>
          </div>
        </ShadcnAlertDialogContent>
      </ShadcnAlertDialogRoot>
    </div>
  );
}
    `),
    'demo-brutalist-alert-dialog': formatCode(`
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/react';

export function BrutalistAlertDialogDemo() {
  return (
    <BrutalistAlertDialogRoot>
      <BrutalistAlertDialogTrigger>Open</BrutalistAlertDialogTrigger>
      <BrutalistAlertDialogMask />
      <BrutalistAlertDialogContent>
        <BrutalistAlertDialogHeader>
          <BrutalistAlertDialogTitle>Are you absolutely sure?</BrutalistAlertDialogTitle>
          <BrutalistAlertDialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
          </BrutalistAlertDialogDescription>
        </BrutalistAlertDialogHeader>
        <BrutalistAlertDialogFooter>
          <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
          <BrutalistAlertDialogAction>Continue</BrutalistAlertDialogAction>
        </BrutalistAlertDialogFooter>
      </BrutalistAlertDialogContent>
    </BrutalistAlertDialogRoot>
  );
}
    `),
    'demo-brutalist-alert-dialog-small': formatCode(`
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/react';

export function BrutalistAlertDialogSmallDemo() {
  return (
    <BrutalistAlertDialogRoot>
      <BrutalistAlertDialogTrigger>Show Dialog</BrutalistAlertDialogTrigger>
      <BrutalistAlertDialogMask />
      <BrutalistAlertDialogContent size="sm">
        <BrutalistAlertDialogHeader>
          <BrutalistAlertDialogTitle>Allow accessory to connect?</BrutalistAlertDialogTitle>
          <BrutalistAlertDialogDescription>
            Do you want to allow the USB accessory to connect to this device?
          </BrutalistAlertDialogDescription>
        </BrutalistAlertDialogHeader>
        <BrutalistAlertDialogFooter>
          <BrutalistAlertDialogCancel>Don&apos;t allow</BrutalistAlertDialogCancel>
          <BrutalistAlertDialogAction>Allow</BrutalistAlertDialogAction>
        </BrutalistAlertDialogFooter>
      </BrutalistAlertDialogContent>
    </BrutalistAlertDialogRoot>
  );
}
    `),
    'demo-brutalist-alert-dialog-media': formatCode(`
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/react';

export function BrutalistAlertDialogMediaDemo() {
  return (
    <BrutalistAlertDialogRoot>
      <BrutalistAlertDialogTrigger>Share Project</BrutalistAlertDialogTrigger>
      <BrutalistAlertDialogMask />
      <BrutalistAlertDialogContent>
        <BrutalistAlertDialogHeader>
          <div className="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-secondary-background font-bold" aria-hidden="true">+</div>
          <BrutalistAlertDialogTitle>Share this project?</BrutalistAlertDialogTitle>
          <BrutalistAlertDialogDescription>
            Anyone with the link will be able to view and edit this project.
          </BrutalistAlertDialogDescription>
        </BrutalistAlertDialogHeader>
        <BrutalistAlertDialogFooter>
          <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
          <BrutalistAlertDialogAction>Share</BrutalistAlertDialogAction>
        </BrutalistAlertDialogFooter>
      </BrutalistAlertDialogContent>
    </BrutalistAlertDialogRoot>
  );
}
    `),
    'demo-brutalist-alert-dialog-destructive': formatCode(`
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/react';

export function BrutalistAlertDialogDestructiveDemo() {
  return (
    <BrutalistAlertDialogRoot>
      <BrutalistAlertDialogTrigger>Delete Chat</BrutalistAlertDialogTrigger>
      <BrutalistAlertDialogMask />
      <BrutalistAlertDialogContent size="sm">
        <BrutalistAlertDialogHeader>
          <div className="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-destructive/20 font-bold text-destructive" aria-hidden="true">!</div>
          <BrutalistAlertDialogTitle>Delete chat?</BrutalistAlertDialogTitle>
          <BrutalistAlertDialogDescription>
            This will permanently delete this chat conversation and remove any saved memories.
          </BrutalistAlertDialogDescription>
        </BrutalistAlertDialogHeader>
        <BrutalistAlertDialogFooter>
          <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
          <BrutalistAlertDialogAction>Delete</BrutalistAlertDialogAction>
        </BrutalistAlertDialogFooter>
      </BrutalistAlertDialogContent>
    </BrutalistAlertDialogRoot>
  );
}
    `),
    'demo-brutalist-alert-dialog-controlled': formatCode(`
import { useState } from 'react';
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/react';

export function BrutalistAlertDialogControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <BrutalistAlertDialogRoot open={open} onOpenChange={(detail) => setOpen(detail.open)}>
      <BrutalistAlertDialogTrigger>Archive Workspace</BrutalistAlertDialogTrigger>
      <BrutalistAlertDialogMask />
      <BrutalistAlertDialogContent>
        <BrutalistAlertDialogHeader>
          <BrutalistAlertDialogTitle>Archive this workspace?</BrutalistAlertDialogTitle>
          <BrutalistAlertDialogDescription>
            Members will keep read-only access until an administrator restores the workspace.
          </BrutalistAlertDialogDescription>
        </BrutalistAlertDialogHeader>
        <BrutalistAlertDialogFooter>
          <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
          <BrutalistAlertDialogAction>Archive</BrutalistAlertDialogAction>
        </BrutalistAlertDialogFooter>
      </BrutalistAlertDialogContent>
    </BrutalistAlertDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-alert-dialog': formatCode(`
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/react';

export function BootstrapAlertDialogDemo() {
  return (
    <BootstrapAlertDialogRoot>
      <BootstrapAlertDialogTrigger>Show Dialog</BootstrapAlertDialogTrigger>
      <BootstrapAlertDialogMask />
      <BootstrapAlertDialogContent>
        <BootstrapAlertDialogTitle>Are you absolutely sure?</BootstrapAlertDialogTitle>
        <BootstrapAlertDialogDescription>
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </BootstrapAlertDialogDescription>
        <BootstrapAlertDialogFooter>
          <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
          <BootstrapAlertDialogAction>Continue</BootstrapAlertDialogAction>
        </BootstrapAlertDialogFooter>
      </BootstrapAlertDialogContent>
    </BootstrapAlertDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-alert-dialog-small': formatCode(`
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/react';

export function BootstrapAlertDialogSmallDemo() {
  return (
    <BootstrapAlertDialogRoot>
      <BootstrapAlertDialogTrigger>Show Compact Dialog</BootstrapAlertDialogTrigger>
      <BootstrapAlertDialogMask />
      <BootstrapAlertDialogContent size="sm">
        <BootstrapAlertDialogTitle>Allow accessory to connect?</BootstrapAlertDialogTitle>
        <BootstrapAlertDialogDescription>
          Do you want to allow the USB accessory to connect to this device?
        </BootstrapAlertDialogDescription>
        <BootstrapAlertDialogFooter>
          <BootstrapAlertDialogCancel>Don&apos;t allow</BootstrapAlertDialogCancel>
          <BootstrapAlertDialogAction>Allow</BootstrapAlertDialogAction>
        </BootstrapAlertDialogFooter>
      </BootstrapAlertDialogContent>
    </BootstrapAlertDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-alert-dialog-destructive': formatCode(`
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/react';

export function BootstrapAlertDialogDestructiveDemo() {
  return (
    <BootstrapAlertDialogRoot>
      <BootstrapAlertDialogTrigger variant="danger">Delete Chat</BootstrapAlertDialogTrigger>
      <BootstrapAlertDialogMask />
      <BootstrapAlertDialogContent size="sm">
        <BootstrapAlertDialogTitle>Delete chat?</BootstrapAlertDialogTitle>
        <BootstrapAlertDialogDescription>
          This will permanently delete this chat conversation and remove any saved memories.
        </BootstrapAlertDialogDescription>
        <BootstrapAlertDialogFooter>
          <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
          <BootstrapAlertDialogAction variant="danger">Delete</BootstrapAlertDialogAction>
        </BootstrapAlertDialogFooter>
      </BootstrapAlertDialogContent>
    </BootstrapAlertDialogRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-alert-dialog-controlled': formatCode(`
import { useState } from 'react';
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/react';

export function BootstrapAlertDialogControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <BootstrapAlertDialogRoot open={open} onOpenChange={(detail) => setOpen(detail.open)}>
      <BootstrapAlertDialogTrigger>Archive Workspace</BootstrapAlertDialogTrigger>
      <BootstrapAlertDialogMask />
      <BootstrapAlertDialogContent>
        <BootstrapAlertDialogTitle>Archive this workspace?</BootstrapAlertDialogTitle>
        <BootstrapAlertDialogDescription>
          Members will keep read-only access until an administrator restores the workspace.
        </BootstrapAlertDialogDescription>
        <BootstrapAlertDialogFooter>
          <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
          <BootstrapAlertDialogAction>Archive</BootstrapAlertDialogAction>
        </BootstrapAlertDialogFooter>
      </BootstrapAlertDialogContent>
    </BootstrapAlertDialogRoot>
  );
}
    `),
    'demo-liquid-glass-alert-dialog': formatCode(`
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/react';

export function LiquidGlassAlertDialogDemo() {
  return (
    <LiquidGlassAlertDialogRoot>
      <LiquidGlassAlertDialogTrigger>Show Dialog</LiquidGlassAlertDialogTrigger>
      <LiquidGlassAlertDialogMask />
      <LiquidGlassAlertDialogContent>
        <div className="grid gap-1.5">
          <LiquidGlassAlertDialogTitle>Are you absolutely sure?</LiquidGlassAlertDialogTitle>
          <LiquidGlassAlertDialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
          </LiquidGlassAlertDialogDescription>
        </div>
        <div className="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
          <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
          <LiquidGlassAlertDialogAction>Continue</LiquidGlassAlertDialogAction>
        </div>
      </LiquidGlassAlertDialogContent>
    </LiquidGlassAlertDialogRoot>
  );
}
    `),
    'demo-liquid-glass-alert-dialog-small': formatCode(`
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/react';

export function LiquidGlassAlertDialogSmallDemo() {
  return (
    <LiquidGlassAlertDialogRoot>
      <LiquidGlassAlertDialogTrigger>Show Compact Sheet</LiquidGlassAlertDialogTrigger>
      <LiquidGlassAlertDialogMask />
      <LiquidGlassAlertDialogContent size="sm">
        <div className="grid gap-1.5 text-center">
          <LiquidGlassAlertDialogTitle>Allow accessory to connect?</LiquidGlassAlertDialogTitle>
          <LiquidGlassAlertDialogDescription>
            Do you want to allow the USB accessory to connect to this device?
          </LiquidGlassAlertDialogDescription>
        </div>
        <div className="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
          <LiquidGlassAlertDialogCancel>Don&apos;t allow</LiquidGlassAlertDialogCancel>
          <LiquidGlassAlertDialogAction>Allow</LiquidGlassAlertDialogAction>
        </div>
      </LiquidGlassAlertDialogContent>
    </LiquidGlassAlertDialogRoot>
  );
}
    `),
    'demo-liquid-glass-alert-dialog-destructive': formatCode(`
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/react';

export function LiquidGlassAlertDialogDestructiveDemo() {
  return (
    <LiquidGlassAlertDialogRoot>
      <LiquidGlassAlertDialogTrigger variant="destructive">
        Delete Chat
      </LiquidGlassAlertDialogTrigger>
      <LiquidGlassAlertDialogMask />
      <LiquidGlassAlertDialogContent size="sm">
        <div className="grid place-items-center gap-1.5 text-center">
          <LiquidGlassAlertDialogTitle>Delete chat?</LiquidGlassAlertDialogTitle>
          <LiquidGlassAlertDialogDescription>
            This will permanently delete this chat conversation and remove any saved memories.
          </LiquidGlassAlertDialogDescription>
        </div>
        <div className="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
          <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
          <LiquidGlassAlertDialogAction variant="destructive">Delete</LiquidGlassAlertDialogAction>
        </div>
      </LiquidGlassAlertDialogContent>
    </LiquidGlassAlertDialogRoot>
  );
}
    `),
    'demo-liquid-glass-alert-dialog-opaque': formatCode(`
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/react';

export function LiquidGlassAlertDialogOpaqueDemo() {
  return (
    <LiquidGlassAlertDialogRoot>
      <LiquidGlassAlertDialogTrigger variant="prominent" material="opaque">
        Open Opaque Fallback
      </LiquidGlassAlertDialogTrigger>
      <LiquidGlassAlertDialogMask />
      <LiquidGlassAlertDialogContent material="opaque">
        <div className="grid gap-1.5">
          <LiquidGlassAlertDialogTitle>Publish release notes?</LiquidGlassAlertDialogTitle>
          <LiquidGlassAlertDialogDescription>
            Opaque material mode keeps full contrast over dense backdrops or reduced-transparency environments.
          </LiquidGlassAlertDialogDescription>
        </div>
        <div className="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
          <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
          <LiquidGlassAlertDialogAction>Publish</LiquidGlassAlertDialogAction>
        </div>
      </LiquidGlassAlertDialogContent>
    </LiquidGlassAlertDialogRoot>
  );
}
    `),
    'demo-liquid-glass-alert-dialog-controlled': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/react';

export function LiquidGlassAlertDialogControlledDemo() {
  const [open, setOpen] = useState(false);
  return (
    <LiquidGlassAlertDialogRoot open={open} onOpenChange={(detail) => setOpen(detail.open)}>
      <LiquidGlassAlertDialogTrigger>Archive Workspace</LiquidGlassAlertDialogTrigger>
      <LiquidGlassAlertDialogMask />
      <LiquidGlassAlertDialogContent>
        <div className="grid gap-1.5">
          <LiquidGlassAlertDialogTitle>Archive this workspace?</LiquidGlassAlertDialogTitle>
          <LiquidGlassAlertDialogDescription>
            Members will keep read-only access until an administrator restores the workspace.
          </LiquidGlassAlertDialogDescription>
        </div>
        <div className="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
          <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
          <LiquidGlassAlertDialogAction>Archive</LiquidGlassAlertDialogAction>
        </div>
      </LiquidGlassAlertDialogContent>
    </LiquidGlassAlertDialogRoot>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-alert-dialog': formatCode(`
<script setup lang="ts">
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Show Dialog</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea">
      <ShadcnAlertDialogHeader styleProfile="rhea">
        <ShadcnAlertDialogTitle styleProfile="rhea">Are you absolutely sure?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Continue</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>
    `),
    'demo-shadcn-alert-dialog-small': formatCode(`
<script setup lang="ts">
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Show Dialog</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea" size="sm">
      <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
        <ShadcnAlertDialogTitle styleProfile="rhea">Allow accessory to connect?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          Do you want to allow the USB accessory to connect to this device?
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Don't allow</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Allow</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>
    `),
    'demo-shadcn-alert-dialog-media': formatCode(`
<script setup lang="ts">
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Share Project</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea">
      <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
        <div class="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground" aria-hidden="true">+</div>
        <ShadcnAlertDialogTitle styleProfile="rhea">Share this project?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          Anyone with the link will be able to view and edit this project.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Share</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>
    `),
    'demo-shadcn-alert-dialog-destructive': formatCode(`
<script setup lang="ts">
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="destructive">Delete Chat</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea" size="sm">
      <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
        <div class="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive" aria-hidden="true">!</div>
        <ShadcnAlertDialogTitle styleProfile="rhea">Delete chat?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          This will permanently delete this chat conversation and remove any memories saved during this chat.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea" variant="outline">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea" variant="destructive">Delete</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>
    `),
    'demo-shadcn-alert-dialog-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue';

const open = ref(false);
const status = ref('Active');
</script>

<template>
  <div class="flex items-center gap-4">
    <ShadcnAlertDialogRoot styleProfile="rhea" :open="open" @open-change="open = $event.open">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Archive Workspace</ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea">
        <ShadcnAlertDialogHeader styleProfile="rhea">
          <ShadcnAlertDialogTitle styleProfile="rhea">Archive this workspace?</ShadcnAlertDialogTitle>
          <ShadcnAlertDialogDescription styleProfile="rhea">
            Members will keep read-only access until an administrator restores the workspace.
          </ShadcnAlertDialogDescription>
        </ShadcnAlertDialogHeader>
        <ShadcnAlertDialogFooter styleProfile="rhea">
          <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
          <ShadcnAlertDialogAction styleProfile="rhea" @action="status = 'Archived'">Archive</ShadcnAlertDialogAction>
        </ShadcnAlertDialogFooter>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
    <span class="text-xs text-muted-foreground">Status: {{ status }}</span>
  </div>
</template>
    `),
    'demo-shadcn-alert-dialog-rtl': formatCode(`
<script setup lang="ts">
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <div dir="rtl" lang="ar" class="flex gap-4">
    <ShadcnAlertDialogRoot styleProfile="rhea">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">إظهار الحوار</ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea">
        <div dir="rtl" lang="ar" class="grid gap-6">
          <ShadcnAlertDialogHeader styleProfile="rhea">
            <ShadcnAlertDialogTitle styleProfile="rhea">هل أنت متأكد تمامًا؟</ShadcnAlertDialogTitle>
            <ShadcnAlertDialogDescription styleProfile="rhea">
              لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا من خوادمنا.
            </ShadcnAlertDialogDescription>
          </ShadcnAlertDialogHeader>
          <ShadcnAlertDialogFooter styleProfile="rhea">
            <ShadcnAlertDialogCancel styleProfile="rhea">إلغاء</ShadcnAlertDialogCancel>
            <ShadcnAlertDialogAction styleProfile="rhea">متابعة</ShadcnAlertDialogAction>
          </ShadcnAlertDialogFooter>
        </div>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
  </div>
</template>
    `),
    'demo-brutalist-alert-dialog': formatCode(`
<script setup lang="ts">
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Open</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent>
      <BrutalistAlertDialogHeader>
        <BrutalistAlertDialogTitle>Are you absolutely sure?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Continue</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>
    `),
    'demo-brutalist-alert-dialog-small': formatCode(`
<script setup lang="ts">
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Show Dialog</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent size="sm">
      <BrutalistAlertDialogHeader>
        <BrutalistAlertDialogTitle>Allow accessory to connect?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          Do you want to allow the USB accessory to connect to this device?
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Don't allow</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Allow</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>
    `),
    'demo-brutalist-alert-dialog-media': formatCode(`
<script setup lang="ts">
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Share Project</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent>
      <BrutalistAlertDialogHeader>
        <div class="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-secondary-background font-bold" aria-hidden="true">+</div>
        <BrutalistAlertDialogTitle>Share this project?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          Anyone with the link will be able to view and edit this project.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Share</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>
    `),
    'demo-brutalist-alert-dialog-destructive': formatCode(`
<script setup lang="ts">
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Delete Chat</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent size="sm">
      <BrutalistAlertDialogHeader>
        <div class="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-destructive/20 font-bold text-destructive" aria-hidden="true">!</div>
        <BrutalistAlertDialogTitle>Delete chat?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          This will permanently delete this chat conversation and remove any saved memories.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Delete</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>
    `),
    'demo-brutalist-alert-dialog-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <BrutalistAlertDialogRoot :open="open" @open-change="open = $event.open">
    <BrutalistAlertDialogTrigger>Archive Workspace</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent>
      <BrutalistAlertDialogHeader>
        <BrutalistAlertDialogTitle>Archive this workspace?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          Members will keep read-only access until an administrator restores the workspace.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Archive</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-alert-dialog': formatCode(`
<script setup lang="ts">
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapAlertDialogRoot>
    <BootstrapAlertDialogTrigger>Show Dialog</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent>
      <BootstrapAlertDialogTitle>Are you absolutely sure?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction>Continue</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-small': formatCode(`
<script setup lang="ts">
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapAlertDialogRoot>
    <BootstrapAlertDialogTrigger>Show Compact Dialog</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent size="sm">
      <BootstrapAlertDialogTitle>Allow accessory to connect?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        Do you want to allow the USB accessory to connect to this device?
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Don't allow</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction>Allow</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-destructive': formatCode(`
<script setup lang="ts">
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapAlertDialogRoot>
    <BootstrapAlertDialogTrigger variant="danger">Delete Chat</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent size="sm">
      <BootstrapAlertDialogTitle>Delete chat?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        This will permanently delete this chat conversation and remove any saved memories.
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction variant="danger">Delete</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <BootstrapAlertDialogRoot :open="open" @open-change="open = $event.open">
    <BootstrapAlertDialogTrigger>Archive Workspace</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent>
      <BootstrapAlertDialogTitle>Archive this workspace?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        Members will keep read-only access until an administrator restores the workspace.
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction>Archive</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>
    `),
    'demo-liquid-glass-alert-dialog': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger>Show Dialog</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent>
      <div class="grid gap-1.5">
        <LiquidGlassAlertDialogTitle>Are you absolutely sure?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Continue</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>
    `),
    'demo-liquid-glass-alert-dialog-small': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger>Show Compact Sheet</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent size="sm">
      <div class="grid gap-1.5 text-center">
        <LiquidGlassAlertDialogTitle>Allow accessory to connect?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          Do you want to allow the USB accessory to connect to this device?
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Don't allow</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Allow</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>
    `),
    'demo-liquid-glass-alert-dialog-destructive': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger variant="destructive">Delete Chat</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent size="sm">
      <div class="grid place-items-center gap-1.5 text-center">
        <LiquidGlassAlertDialogTitle>Delete chat?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          This will permanently delete this chat conversation and remove any saved memories.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction variant="destructive">Delete</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>
    `),
    'demo-liquid-glass-alert-dialog-opaque': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue';
</script>

<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger variant="prominent" material="opaque">Open Opaque Fallback</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent material="opaque">
      <div class="grid gap-1.5">
        <LiquidGlassAlertDialogTitle>Publish release notes?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          Opaque material mode keeps full contrast over dense backdrops or reduced-transparency environments.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Publish</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>
    `),
    'demo-liquid-glass-alert-dialog-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue';

const open = ref(false);
</script>

<template>
  <LiquidGlassAlertDialogRoot :open="open" @open-change="open = $event.open">
    <LiquidGlassAlertDialogTrigger>Archive Workspace</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent>
      <div class="grid gap-1.5">
        <LiquidGlassAlertDialogTitle>Archive this workspace?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          Members will keep read-only access until an administrator restores the workspace.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Archive</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-alert-dialog': formatCode(`
<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Show Dialog</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea">
      <ShadcnAlertDialogHeader styleProfile="rhea">
        <ShadcnAlertDialogTitle styleProfile="rhea">Are you absolutely sure?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Continue</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>

<script>
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAlertDialogRoot,
    ShadcnAlertDialogTrigger,
    ShadcnAlertDialogMask,
    ShadcnAlertDialogContent,
    ShadcnAlertDialogHeader,
    ShadcnAlertDialogTitle,
    ShadcnAlertDialogDescription,
    ShadcnAlertDialogFooter,
    ShadcnAlertDialogCancel,
    ShadcnAlertDialogAction,
  },
};
</script>
    `),
    'demo-shadcn-alert-dialog-small': formatCode(`
<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Show Dialog</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea" size="sm">
      <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
        <ShadcnAlertDialogTitle styleProfile="rhea">Allow accessory to connect?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          Do you want to allow the USB accessory to connect to this device?
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Don't allow</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Allow</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>

<script>
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAlertDialogRoot,
    ShadcnAlertDialogTrigger,
    ShadcnAlertDialogMask,
    ShadcnAlertDialogContent,
    ShadcnAlertDialogHeader,
    ShadcnAlertDialogTitle,
    ShadcnAlertDialogDescription,
    ShadcnAlertDialogFooter,
    ShadcnAlertDialogCancel,
    ShadcnAlertDialogAction,
  },
};
</script>
    `),
    'demo-shadcn-alert-dialog-media': formatCode(`
<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Share Project</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea">
      <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
        <div class="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground" aria-hidden="true">+</div>
        <ShadcnAlertDialogTitle styleProfile="rhea">Share this project?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          Anyone with the link will be able to view and edit this project.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Share</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>

<script>
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAlertDialogRoot,
    ShadcnAlertDialogTrigger,
    ShadcnAlertDialogMask,
    ShadcnAlertDialogContent,
    ShadcnAlertDialogHeader,
    ShadcnAlertDialogTitle,
    ShadcnAlertDialogDescription,
    ShadcnAlertDialogFooter,
    ShadcnAlertDialogCancel,
    ShadcnAlertDialogAction,
  },
};
</script>
    `),
    'demo-shadcn-alert-dialog-destructive': formatCode(`
<template>
  <ShadcnAlertDialogRoot styleProfile="rhea">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="destructive">Delete Chat</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea" size="sm">
      <ShadcnAlertDialogHeader styleProfile="rhea" align="center">
        <div class="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive" aria-hidden="true">!</div>
        <ShadcnAlertDialogTitle styleProfile="rhea">Delete chat?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          This will permanently delete this chat conversation and remove any memories saved during this chat.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea" variant="outline">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea" variant="destructive">Delete</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>

<script>
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAlertDialogRoot,
    ShadcnAlertDialogTrigger,
    ShadcnAlertDialogMask,
    ShadcnAlertDialogContent,
    ShadcnAlertDialogHeader,
    ShadcnAlertDialogTitle,
    ShadcnAlertDialogDescription,
    ShadcnAlertDialogFooter,
    ShadcnAlertDialogCancel,
    ShadcnAlertDialogAction,
  },
};
</script>
    `),
    'demo-shadcn-alert-dialog-controlled': formatCode(`
<template>
  <ShadcnAlertDialogRoot styleProfile="rhea" :open="open" @openChange="open = $event.open">
    <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">Archive Workspace</ShadcnAlertDialogTrigger>
    <ShadcnAlertDialogMask styleProfile="rhea" />
    <ShadcnAlertDialogContent styleProfile="rhea">
      <ShadcnAlertDialogHeader styleProfile="rhea">
        <ShadcnAlertDialogTitle styleProfile="rhea">Archive this workspace?</ShadcnAlertDialogTitle>
        <ShadcnAlertDialogDescription styleProfile="rhea">
          Members will keep read-only access until an administrator restores the workspace.
        </ShadcnAlertDialogDescription>
      </ShadcnAlertDialogHeader>
      <ShadcnAlertDialogFooter styleProfile="rhea">
        <ShadcnAlertDialogCancel styleProfile="rhea">Cancel</ShadcnAlertDialogCancel>
        <ShadcnAlertDialogAction styleProfile="rhea">Archive</ShadcnAlertDialogAction>
      </ShadcnAlertDialogFooter>
    </ShadcnAlertDialogContent>
  </ShadcnAlertDialogRoot>
</template>

<script>
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAlertDialogRoot,
    ShadcnAlertDialogTrigger,
    ShadcnAlertDialogMask,
    ShadcnAlertDialogContent,
    ShadcnAlertDialogHeader,
    ShadcnAlertDialogTitle,
    ShadcnAlertDialogDescription,
    ShadcnAlertDialogFooter,
    ShadcnAlertDialogCancel,
    ShadcnAlertDialogAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-shadcn-alert-dialog-rtl': formatCode(`
<template>
  <div dir="rtl" lang="ar" class="flex gap-4">
    <ShadcnAlertDialogRoot styleProfile="rhea">
      <ShadcnAlertDialogTrigger styleProfile="rhea" variant="outline">إظهار الحوار</ShadcnAlertDialogTrigger>
      <ShadcnAlertDialogMask styleProfile="rhea" />
      <ShadcnAlertDialogContent styleProfile="rhea">
        <div dir="rtl" lang="ar" class="grid gap-6">
          <ShadcnAlertDialogHeader styleProfile="rhea">
            <ShadcnAlertDialogTitle styleProfile="rhea">هل أنت متأكد تمامًا؟</ShadcnAlertDialogTitle>
            <ShadcnAlertDialogDescription styleProfile="rhea">
              لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا من خوادمنا.
            </ShadcnAlertDialogDescription>
          </ShadcnAlertDialogHeader>
          <ShadcnAlertDialogFooter styleProfile="rhea">
            <ShadcnAlertDialogCancel styleProfile="rhea">إلغاء</ShadcnAlertDialogCancel>
            <ShadcnAlertDialogAction styleProfile="rhea">متابعة</ShadcnAlertDialogAction>
          </ShadcnAlertDialogFooter>
        </div>
      </ShadcnAlertDialogContent>
    </ShadcnAlertDialogRoot>
  </div>
</template>

<script>
import {
  ShadcnAlertDialogRoot,
  ShadcnAlertDialogTrigger,
  ShadcnAlertDialogMask,
  ShadcnAlertDialogContent,
  ShadcnAlertDialogHeader,
  ShadcnAlertDialogTitle,
  ShadcnAlertDialogDescription,
  ShadcnAlertDialogFooter,
  ShadcnAlertDialogCancel,
  ShadcnAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnAlertDialogRoot,
    ShadcnAlertDialogTrigger,
    ShadcnAlertDialogMask,
    ShadcnAlertDialogContent,
    ShadcnAlertDialogHeader,
    ShadcnAlertDialogTitle,
    ShadcnAlertDialogDescription,
    ShadcnAlertDialogFooter,
    ShadcnAlertDialogCancel,
    ShadcnAlertDialogAction,
  },
};
</script>
    `),
    'demo-brutalist-alert-dialog': formatCode(`
<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Open</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent>
      <BrutalistAlertDialogHeader>
        <BrutalistAlertDialogTitle>Are you absolutely sure?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Continue</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>

<script>
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAlertDialogRoot,
    BrutalistAlertDialogTrigger,
    BrutalistAlertDialogMask,
    BrutalistAlertDialogContent,
    BrutalistAlertDialogHeader,
    BrutalistAlertDialogTitle,
    BrutalistAlertDialogDescription,
    BrutalistAlertDialogFooter,
    BrutalistAlertDialogCancel,
    BrutalistAlertDialogAction,
  },
};
</script>
    `),
    'demo-brutalist-alert-dialog-small': formatCode(`
<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Show Dialog</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent size="sm">
      <BrutalistAlertDialogHeader>
        <BrutalistAlertDialogTitle>Allow accessory to connect?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          Do you want to allow the USB accessory to connect to this device?
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Don't allow</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Allow</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>

<script>
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAlertDialogRoot,
    BrutalistAlertDialogTrigger,
    BrutalistAlertDialogMask,
    BrutalistAlertDialogContent,
    BrutalistAlertDialogHeader,
    BrutalistAlertDialogTitle,
    BrutalistAlertDialogDescription,
    BrutalistAlertDialogFooter,
    BrutalistAlertDialogCancel,
    BrutalistAlertDialogAction,
  },
};
</script>
    `),
    'demo-brutalist-alert-dialog-media': formatCode(`
<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Share Project</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent>
      <BrutalistAlertDialogHeader>
        <div class="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-secondary-background font-bold" aria-hidden="true">+</div>
        <BrutalistAlertDialogTitle>Share this project?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          Anyone with the link will be able to view and edit this project.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Share</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>

<script>
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAlertDialogRoot,
    BrutalistAlertDialogTrigger,
    BrutalistAlertDialogMask,
    BrutalistAlertDialogContent,
    BrutalistAlertDialogHeader,
    BrutalistAlertDialogTitle,
    BrutalistAlertDialogDescription,
    BrutalistAlertDialogFooter,
    BrutalistAlertDialogCancel,
    BrutalistAlertDialogAction,
  },
};
</script>
    `),
    'demo-brutalist-alert-dialog-destructive': formatCode(`
<template>
  <BrutalistAlertDialogRoot>
    <BrutalistAlertDialogTrigger>Delete Chat</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent size="sm">
      <BrutalistAlertDialogHeader>
        <div class="mb-1 inline-flex size-10 items-center justify-center rounded-base border-2 border-black bg-destructive/20 font-bold text-destructive" aria-hidden="true">!</div>
        <BrutalistAlertDialogTitle>Delete chat?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          This will permanently delete this chat conversation and remove any saved memories.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Delete</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>

<script>
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAlertDialogRoot,
    BrutalistAlertDialogTrigger,
    BrutalistAlertDialogMask,
    BrutalistAlertDialogContent,
    BrutalistAlertDialogHeader,
    BrutalistAlertDialogTitle,
    BrutalistAlertDialogDescription,
    BrutalistAlertDialogFooter,
    BrutalistAlertDialogCancel,
    BrutalistAlertDialogAction,
  },
};
</script>
    `),
    'demo-brutalist-alert-dialog-controlled': formatCode(`
<template>
  <BrutalistAlertDialogRoot :open="open" @openChange="open = $event.open">
    <BrutalistAlertDialogTrigger>Archive Workspace</BrutalistAlertDialogTrigger>
    <BrutalistAlertDialogMask />
    <BrutalistAlertDialogContent>
      <BrutalistAlertDialogHeader>
        <BrutalistAlertDialogTitle>Archive this workspace?</BrutalistAlertDialogTitle>
        <BrutalistAlertDialogDescription>
          Members will keep read-only access until an administrator restores the workspace.
        </BrutalistAlertDialogDescription>
      </BrutalistAlertDialogHeader>
      <BrutalistAlertDialogFooter>
        <BrutalistAlertDialogCancel>Cancel</BrutalistAlertDialogCancel>
        <BrutalistAlertDialogAction>Archive</BrutalistAlertDialogAction>
      </BrutalistAlertDialogFooter>
    </BrutalistAlertDialogContent>
  </BrutalistAlertDialogRoot>
</template>

<script>
import {
  BrutalistAlertDialogRoot,
  BrutalistAlertDialogTrigger,
  BrutalistAlertDialogMask,
  BrutalistAlertDialogContent,
  BrutalistAlertDialogHeader,
  BrutalistAlertDialogTitle,
  BrutalistAlertDialogDescription,
  BrutalistAlertDialogFooter,
  BrutalistAlertDialogCancel,
  BrutalistAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistAlertDialogRoot,
    BrutalistAlertDialogTrigger,
    BrutalistAlertDialogMask,
    BrutalistAlertDialogContent,
    BrutalistAlertDialogHeader,
    BrutalistAlertDialogTitle,
    BrutalistAlertDialogDescription,
    BrutalistAlertDialogFooter,
    BrutalistAlertDialogCancel,
    BrutalistAlertDialogAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-alert-dialog': formatCode(`
<template>
  <BootstrapAlertDialogRoot>
    <BootstrapAlertDialogTrigger>Show Dialog</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent>
      <BootstrapAlertDialogTitle>Are you absolutely sure?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        This action cannot be undone. This will permanently delete your account and remove your data from our servers.
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction>Continue</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>

<script>
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapAlertDialogRoot,
    BootstrapAlertDialogTrigger,
    BootstrapAlertDialogMask,
    BootstrapAlertDialogContent,
    BootstrapAlertDialogTitle,
    BootstrapAlertDialogDescription,
    BootstrapAlertDialogFooter,
    BootstrapAlertDialogCancel,
    BootstrapAlertDialogAction,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-small': formatCode(`
<template>
  <BootstrapAlertDialogRoot>
    <BootstrapAlertDialogTrigger>Show Compact Dialog</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent size="sm">
      <BootstrapAlertDialogTitle>Allow accessory to connect?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        Do you want to allow the USB accessory to connect to this device?
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Don't allow</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction>Allow</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>

<script>
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapAlertDialogRoot,
    BootstrapAlertDialogTrigger,
    BootstrapAlertDialogMask,
    BootstrapAlertDialogContent,
    BootstrapAlertDialogTitle,
    BootstrapAlertDialogDescription,
    BootstrapAlertDialogFooter,
    BootstrapAlertDialogCancel,
    BootstrapAlertDialogAction,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-destructive': formatCode(`
<template>
  <BootstrapAlertDialogRoot>
    <BootstrapAlertDialogTrigger variant="danger">Delete Chat</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent size="sm">
      <BootstrapAlertDialogTitle>Delete chat?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        This will permanently delete this chat conversation and remove any saved memories.
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction variant="danger">Delete</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>

<script>
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapAlertDialogRoot,
    BootstrapAlertDialogTrigger,
    BootstrapAlertDialogMask,
    BootstrapAlertDialogContent,
    BootstrapAlertDialogTitle,
    BootstrapAlertDialogDescription,
    BootstrapAlertDialogFooter,
    BootstrapAlertDialogCancel,
    BootstrapAlertDialogAction,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-alert-dialog-controlled': formatCode(`
<template>
  <BootstrapAlertDialogRoot :open="open" @openChange="open = $event.open">
    <BootstrapAlertDialogTrigger>Archive Workspace</BootstrapAlertDialogTrigger>
    <BootstrapAlertDialogMask />
    <BootstrapAlertDialogContent>
      <BootstrapAlertDialogTitle>Archive this workspace?</BootstrapAlertDialogTitle>
      <BootstrapAlertDialogDescription>
        Members will keep read-only access until an administrator restores the workspace.
      </BootstrapAlertDialogDescription>
      <BootstrapAlertDialogFooter>
        <BootstrapAlertDialogCancel>Cancel</BootstrapAlertDialogCancel>
        <BootstrapAlertDialogAction>Archive</BootstrapAlertDialogAction>
      </BootstrapAlertDialogFooter>
    </BootstrapAlertDialogContent>
  </BootstrapAlertDialogRoot>
</template>

<script>
import {
  BootstrapAlertDialogRoot,
  BootstrapAlertDialogTrigger,
  BootstrapAlertDialogMask,
  BootstrapAlertDialogContent,
  BootstrapAlertDialogTitle,
  BootstrapAlertDialogDescription,
  BootstrapAlertDialogFooter,
  BootstrapAlertDialogCancel,
  BootstrapAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BootstrapAlertDialogRoot,
    BootstrapAlertDialogTrigger,
    BootstrapAlertDialogMask,
    BootstrapAlertDialogContent,
    BootstrapAlertDialogTitle,
    BootstrapAlertDialogDescription,
    BootstrapAlertDialogFooter,
    BootstrapAlertDialogCancel,
    BootstrapAlertDialogAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
    'demo-liquid-glass-alert-dialog': formatCode(`
<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger>Show Dialog</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent>
      <div class="grid gap-1.5">
        <LiquidGlassAlertDialogTitle>Are you absolutely sure?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          This action cannot be undone. This will permanently delete your account and remove your data from our servers.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Continue</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>

<script>
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAlertDialogRoot,
    LiquidGlassAlertDialogTrigger,
    LiquidGlassAlertDialogMask,
    LiquidGlassAlertDialogContent,
    LiquidGlassAlertDialogTitle,
    LiquidGlassAlertDialogDescription,
    LiquidGlassAlertDialogCancel,
    LiquidGlassAlertDialogAction,
  },
};
</script>
    `),
    'demo-liquid-glass-alert-dialog-small': formatCode(`
<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger>Show Compact Sheet</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent size="sm">
      <div class="grid gap-1.5 text-center">
        <LiquidGlassAlertDialogTitle>Allow accessory to connect?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          Do you want to allow the USB accessory to connect to this device?
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Don't allow</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Allow</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>

<script>
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAlertDialogRoot,
    LiquidGlassAlertDialogTrigger,
    LiquidGlassAlertDialogMask,
    LiquidGlassAlertDialogContent,
    LiquidGlassAlertDialogTitle,
    LiquidGlassAlertDialogDescription,
    LiquidGlassAlertDialogCancel,
    LiquidGlassAlertDialogAction,
  },
};
</script>
    `),
    'demo-liquid-glass-alert-dialog-destructive': formatCode(`
<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger variant="destructive">Delete Chat</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent size="sm">
      <div class="grid place-items-center gap-1.5 text-center">
        <LiquidGlassAlertDialogTitle>Delete chat?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          This will permanently delete this chat conversation and remove any saved memories.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-center gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction variant="destructive">Delete</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>

<script>
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAlertDialogRoot,
    LiquidGlassAlertDialogTrigger,
    LiquidGlassAlertDialogMask,
    LiquidGlassAlertDialogContent,
    LiquidGlassAlertDialogTitle,
    LiquidGlassAlertDialogDescription,
    LiquidGlassAlertDialogCancel,
    LiquidGlassAlertDialogAction,
  },
};
</script>
    `),
    'demo-liquid-glass-alert-dialog-opaque': formatCode(`
<template>
  <LiquidGlassAlertDialogRoot>
    <LiquidGlassAlertDialogTrigger variant="prominent" material="opaque">Open Opaque Fallback</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent material="opaque">
      <div class="grid gap-1.5">
        <LiquidGlassAlertDialogTitle>Publish release notes?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          Opaque material mode keeps full contrast over dense backdrops or reduced-transparency environments.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Publish</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>

<script>
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAlertDialogRoot,
    LiquidGlassAlertDialogTrigger,
    LiquidGlassAlertDialogMask,
    LiquidGlassAlertDialogContent,
    LiquidGlassAlertDialogTitle,
    LiquidGlassAlertDialogDescription,
    LiquidGlassAlertDialogCancel,
    LiquidGlassAlertDialogAction,
  },
};
</script>
    `),
    'demo-liquid-glass-alert-dialog-controlled': formatCode(`
<template>
  <LiquidGlassAlertDialogRoot :open="open" @openChange="open = $event.open">
    <LiquidGlassAlertDialogTrigger>Archive Workspace</LiquidGlassAlertDialogTrigger>
    <LiquidGlassAlertDialogMask />
    <LiquidGlassAlertDialogContent>
      <div class="grid gap-1.5">
        <LiquidGlassAlertDialogTitle>Archive this workspace?</LiquidGlassAlertDialogTitle>
        <LiquidGlassAlertDialogDescription>
          Members will keep read-only access until an administrator restores the workspace.
        </LiquidGlassAlertDialogDescription>
      </div>
      <div class="flex flex-wrap-reverse items-center justify-end gap-2.5 pt-1">
        <LiquidGlassAlertDialogCancel>Cancel</LiquidGlassAlertDialogCancel>
        <LiquidGlassAlertDialogAction>Archive</LiquidGlassAlertDialogAction>
      </div>
    </LiquidGlassAlertDialogContent>
  </LiquidGlassAlertDialogRoot>
</template>

<script>
import {
  LiquidGlassAlertDialogRoot,
  LiquidGlassAlertDialogTrigger,
  LiquidGlassAlertDialogMask,
  LiquidGlassAlertDialogContent,
  LiquidGlassAlertDialogTitle,
  LiquidGlassAlertDialogDescription,
  LiquidGlassAlertDialogCancel,
  LiquidGlassAlertDialogAction,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassAlertDialogRoot,
    LiquidGlassAlertDialogTrigger,
    LiquidGlassAlertDialogMask,
    LiquidGlassAlertDialogContent,
    LiquidGlassAlertDialogTitle,
    LiquidGlassAlertDialogDescription,
    LiquidGlassAlertDialogCancel,
    LiquidGlassAlertDialogAction,
  },
  data() {
    return { open: false };
  },
};
</script>
    `),
  },
};
