import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-context-menu': formatCode(`
<proto-ui-shadcn-context-menu-root id="context-menu-hero">
  <proto-ui-shadcn-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
  >
    Right click here
  </proto-ui-shadcn-context-menu-trigger>
  <proto-ui-shadcn-context-menu-content class="w-52">
    <proto-ui-shadcn-context-menu-item data-value="back">Back <span class="ml-auto text-xs text-muted-foreground">⌘[</span></proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item data-value="forward">Forward <span class="ml-auto text-xs text-muted-foreground">⌘]</span></proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item data-value="reload">Reload <span class="ml-auto text-xs text-muted-foreground">⌘R</span></proto-ui-shadcn-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border/50"></div>
    <proto-ui-shadcn-context-menu-item data-value="save-page">Save Page...</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item data-value="create-shortcut">Create Shortcut...</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item data-value="devtools">Developer Tools</proto-ui-shadcn-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border/50"></div>
    <proto-ui-shadcn-context-menu-item data-value="delete">Delete <span class="ml-auto text-xs">⌫</span></proto-ui-shadcn-context-menu-item>
  </proto-ui-shadcn-context-menu-content>
</proto-ui-shadcn-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#context-menu-hero');
  setElementProps(root, { styleProfile: 'rhea' });
  const forward = root.querySelector('[data-value="forward"]');
  const del = root.querySelector('[data-value="delete"]');
  setElementProps(forward, { value: 'forward', disabled: true });
  setElementProps(del, { value: 'delete', variant: 'destructive' });
</script>
    `),
    'demo-shadcn-context-menu-basic': formatCode(`
<proto-ui-shadcn-context-menu-root id="context-menu-basic">
  <proto-ui-shadcn-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
  >
    Right click here
  </proto-ui-shadcn-context-menu-trigger>
  <proto-ui-shadcn-context-menu-content>
    <proto-ui-shadcn-context-menu-item>Back</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item id="basic-forward">Forward</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Reload</proto-ui-shadcn-context-menu-item>
  </proto-ui-shadcn-context-menu-content>
</proto-ui-shadcn-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#context-menu-basic'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#basic-forward'), { value: 'forward', disabled: true });
</script>
    `),
    'demo-shadcn-context-menu-shortcuts': formatCode(`
<proto-ui-shadcn-context-menu-root id="context-menu-shortcuts">
  <proto-ui-shadcn-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
  >
    Right click here
  </proto-ui-shadcn-context-menu-trigger>
  <proto-ui-shadcn-context-menu-content class="w-52">
    <div class="px-2 py-1 text-xs font-medium text-muted-foreground">File</div>
    <proto-ui-shadcn-context-menu-item>New File <span class="ml-auto text-xs text-muted-foreground">⌘N</span></proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Open File <span class="ml-auto text-xs text-muted-foreground">⌘O</span></proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Save <span class="ml-auto text-xs text-muted-foreground">⌘S</span></proto-ui-shadcn-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border/50"></div>
    <div class="px-2 py-1 text-xs font-medium text-muted-foreground">Edit</div>
    <proto-ui-shadcn-context-menu-item>Cut <span class="ml-auto text-xs text-muted-foreground">⌘X</span></proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Copy <span class="ml-auto text-xs text-muted-foreground">⌘C</span></proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Paste <span class="ml-auto text-xs text-muted-foreground">⌘V</span></proto-ui-shadcn-context-menu-item>
  </proto-ui-shadcn-context-menu-content>
</proto-ui-shadcn-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#context-menu-shortcuts'), { styleProfile: 'rhea' });
</script>
    `),
    'demo-shadcn-context-menu-destructive': formatCode(`
<proto-ui-shadcn-context-menu-root id="context-menu-destructive">
  <proto-ui-shadcn-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
  >
    Right click here
  </proto-ui-shadcn-context-menu-trigger>
  <proto-ui-shadcn-context-menu-content class="w-48">
    <proto-ui-shadcn-context-menu-item>Edit</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Duplicate</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Share</proto-ui-shadcn-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border/50"></div>
    <proto-ui-shadcn-context-menu-item id="destructive-delete">Delete</proto-ui-shadcn-context-menu-item>
  </proto-ui-shadcn-context-menu-content>
</proto-ui-shadcn-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#context-menu-destructive');
  setElementProps(root, { styleProfile: 'rhea' });
  root.querySelectorAll('proto-ui-shadcn-context-menu-item').forEach((item) => {
    setElementProps(item, { inset: true });
  });
  setElementProps(document.querySelector('#destructive-delete'), { inset: true, variant: 'destructive' });
</script>
    `),
    'demo-shadcn-context-menu-sides': formatCode(`
<div id="context-menu-sides" class="grid max-w-md grid-cols-2 gap-4">
  <proto-ui-shadcn-context-menu-root data-side="top">
    <proto-ui-shadcn-context-menu-trigger class="flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">Right click (top)</proto-ui-shadcn-context-menu-trigger>
    <proto-ui-shadcn-context-menu-content>
      <proto-ui-shadcn-context-menu-item>Back</proto-ui-shadcn-context-menu-item>
      <proto-ui-shadcn-context-menu-item>Forward</proto-ui-shadcn-context-menu-item>
      <proto-ui-shadcn-context-menu-item>Reload</proto-ui-shadcn-context-menu-item>
    </proto-ui-shadcn-context-menu-content>
  </proto-ui-shadcn-context-menu-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('#context-menu-sides proto-ui-shadcn-context-menu-root').forEach((root) => {
    setElementProps(root, { styleProfile: 'rhea' });
    setElementProps(root.querySelector('proto-ui-shadcn-context-menu-content'), {
      side: root.dataset.side,
      sideOffset: 4,
    });
  });
</script>
    `),
    'demo-shadcn-context-menu-keep-open': formatCode(`
<proto-ui-shadcn-context-menu-root id="context-menu-keep-open">
  <proto-ui-shadcn-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
  >
    Right click to toggle options
  </proto-ui-shadcn-context-menu-trigger>
  <proto-ui-shadcn-context-menu-content class="w-56">
    <proto-ui-shadcn-context-menu-item>Show Bookmarks Bar</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Show Full URLs</proto-ui-shadcn-context-menu-item>
    <proto-ui-shadcn-context-menu-item>Show Developer Tools</proto-ui-shadcn-context-menu-item>
  </proto-ui-shadcn-context-menu-content>
</proto-ui-shadcn-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#context-menu-keep-open'), {
    styleProfile: 'rhea',
    closeOnItemCommit: false,
  });
</script>
    `),
    'demo-brutalist-context-menu': formatCode(`
<proto-ui-brutalist-context-menu-root id="brutalist-cm">
  <proto-ui-brutalist-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground"
  >
    Right click here
  </proto-ui-brutalist-context-menu-trigger>
  <proto-ui-brutalist-context-menu-content class="w-56">
    <proto-ui-brutalist-context-menu-item>Back <span class="ml-auto text-xs opacity-70">⌘[</span></proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item id="brutalist-forward">Forward <span class="ml-auto text-xs opacity-70">⌘]</span></proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item>Reload <span class="ml-auto text-xs opacity-70">⌘R</span></proto-ui-brutalist-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-0.5 bg-black"></div>
    <proto-ui-brutalist-context-menu-item>Save Page As...</proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item>Developer Tools</proto-ui-brutalist-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-0.5 bg-black"></div>
    <proto-ui-brutalist-context-menu-item id="brutalist-delete">Delete</proto-ui-brutalist-context-menu-item>
  </proto-ui-brutalist-context-menu-content>
</proto-ui-brutalist-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-forward'), { disabled: true });
  setElementProps(document.querySelector('#brutalist-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-brutalist-context-menu-basic': formatCode(`
<proto-ui-brutalist-context-menu-root>
  <proto-ui-brutalist-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground"
  >
    Right click here
  </proto-ui-brutalist-context-menu-trigger>
  <proto-ui-brutalist-context-menu-content>
    <proto-ui-brutalist-context-menu-item>Back</proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item id="brutalist-basic-forward">Forward</proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item>Reload</proto-ui-brutalist-context-menu-item>
  </proto-ui-brutalist-context-menu-content>
</proto-ui-brutalist-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-basic-forward'), { disabled: true });
</script>
    `),
    'demo-brutalist-context-menu-destructive': formatCode(`
<proto-ui-brutalist-context-menu-root>
  <proto-ui-brutalist-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground"
  >
    Right click here
  </proto-ui-brutalist-context-menu-trigger>
  <proto-ui-brutalist-context-menu-content class="w-48">
    <proto-ui-brutalist-context-menu-item>Edit</proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item>Share</proto-ui-brutalist-context-menu-item>
    <div role="separator" class="-mx-1 my-1 h-0.5 bg-black"></div>
    <proto-ui-brutalist-context-menu-item id="brutalist-destr-del">Delete</proto-ui-brutalist-context-menu-item>
  </proto-ui-brutalist-context-menu-content>
</proto-ui-brutalist-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-destr-del'), { inset: true, variant: 'destructive' });
</script>
    `),
    'demo-brutalist-context-menu-sides': formatCode(`
<proto-ui-brutalist-context-menu-root>
  <proto-ui-brutalist-context-menu-trigger
    class="flex h-28 w-44 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground"
  >
    Right click (top)
  </proto-ui-brutalist-context-menu-trigger>
  <proto-ui-brutalist-context-menu-content id="brutalist-side-top">
    <proto-ui-brutalist-context-menu-item>Back</proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item>Forward</proto-ui-brutalist-context-menu-item>
    <proto-ui-brutalist-context-menu-item>Reload</proto-ui-brutalist-context-menu-item>
  </proto-ui-brutalist-context-menu-content>
</proto-ui-brutalist-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-side-top'), { side: 'top', sideOffset: 4 });
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu': formatCode(`
<proto-ui-bootstrap-2-3-2-context-menu-root>
  <proto-ui-bootstrap-2-3-2-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground"
  >
    Right click here
  </proto-ui-bootstrap-2-3-2-context-menu-trigger>
  <proto-ui-bootstrap-2-3-2-context-menu-content>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Back</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item id="bs-forward">Forward</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Reload</proto-ui-bootstrap-2-3-2-context-menu-item>
    <div role="separator" class="my-2 h-px bg-border"></div>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Save Page...</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Developer Tools</proto-ui-bootstrap-2-3-2-context-menu-item>
    <div role="separator" class="my-2 h-px bg-border"></div>
    <proto-ui-bootstrap-2-3-2-context-menu-item id="bs-delete">Delete</proto-ui-bootstrap-2-3-2-context-menu-item>
  </proto-ui-bootstrap-2-3-2-context-menu-content>
</proto-ui-bootstrap-2-3-2-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-forward'), { disabled: true });
  setElementProps(document.querySelector('#bs-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu-basic': formatCode(`
<proto-ui-bootstrap-2-3-2-context-menu-root>
  <proto-ui-bootstrap-2-3-2-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground"
  >
    Right click here
  </proto-ui-bootstrap-2-3-2-context-menu-trigger>
  <proto-ui-bootstrap-2-3-2-context-menu-content>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Back</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item id="bs-basic-forward">Forward</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Reload</proto-ui-bootstrap-2-3-2-context-menu-item>
  </proto-ui-bootstrap-2-3-2-context-menu-content>
</proto-ui-bootstrap-2-3-2-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-basic-forward'), { disabled: true });
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu-destructive': formatCode(`
<proto-ui-bootstrap-2-3-2-context-menu-root>
  <proto-ui-bootstrap-2-3-2-context-menu-trigger
    class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground"
  >
    Right click here
  </proto-ui-bootstrap-2-3-2-context-menu-trigger>
  <proto-ui-bootstrap-2-3-2-context-menu-content>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Edit</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Share</proto-ui-bootstrap-2-3-2-context-menu-item>
    <div role="separator" class="my-2 h-px bg-border"></div>
    <proto-ui-bootstrap-2-3-2-context-menu-item id="bs-destr-delete">Delete</proto-ui-bootstrap-2-3-2-context-menu-item>
  </proto-ui-bootstrap-2-3-2-context-menu-content>
</proto-ui-bootstrap-2-3-2-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-destr-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu-sides': formatCode(`
<proto-ui-bootstrap-2-3-2-context-menu-root>
  <proto-ui-bootstrap-2-3-2-context-menu-trigger
    class="flex h-28 w-44 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground"
  >
    Right click (top)
  </proto-ui-bootstrap-2-3-2-context-menu-trigger>
  <proto-ui-bootstrap-2-3-2-context-menu-content id="bs-side-top">
    <proto-ui-bootstrap-2-3-2-context-menu-item>Back</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Forward</proto-ui-bootstrap-2-3-2-context-menu-item>
    <proto-ui-bootstrap-2-3-2-context-menu-item>Reload</proto-ui-bootstrap-2-3-2-context-menu-item>
  </proto-ui-bootstrap-2-3-2-context-menu-content>
</proto-ui-bootstrap-2-3-2-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-side-top'), { side: 'top', sideOffset: 4 });
</script>
    `),
    'demo-liquid-glass-context-menu': formatCode(`
<div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-context-menu-root>
    <proto-ui-liquid-glass-context-menu-trigger class="h-36 w-72 border-dashed bg-secondary/70">
      Right click here
    </proto-ui-liquid-glass-context-menu-trigger>
    <proto-ui-liquid-glass-context-menu-content class="w-52">
      <proto-ui-liquid-glass-context-menu-item>Back</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item id="lg-forward">Forward</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item>Reload</proto-ui-liquid-glass-context-menu-item>
      <div role="separator" class="mx-2 my-1 h-px bg-border/60"></div>
      <proto-ui-liquid-glass-context-menu-item>Save Page...</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item>Developer Tools</proto-ui-liquid-glass-context-menu-item>
      <div role="separator" class="mx-2 my-1 h-px bg-border/60"></div>
      <proto-ui-liquid-glass-context-menu-item id="lg-delete">Delete</proto-ui-liquid-glass-context-menu-item>
    </proto-ui-liquid-glass-context-menu-content>
  </proto-ui-liquid-glass-context-menu-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-forward'), { disabled: true });
  setElementProps(document.querySelector('#lg-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-liquid-glass-context-menu-basic': formatCode(`
<div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-context-menu-root>
    <proto-ui-liquid-glass-context-menu-trigger class="h-36 w-72 border-dashed bg-secondary/70">
      Right click here
    </proto-ui-liquid-glass-context-menu-trigger>
    <proto-ui-liquid-glass-context-menu-content>
      <proto-ui-liquid-glass-context-menu-item>Back</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item id="lg-basic-forward">Forward</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item>Reload</proto-ui-liquid-glass-context-menu-item>
    </proto-ui-liquid-glass-context-menu-content>
  </proto-ui-liquid-glass-context-menu-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-basic-forward'), { disabled: true });
</script>
    `),
    'demo-liquid-glass-context-menu-destructive': formatCode(`
<div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-context-menu-root>
    <proto-ui-liquid-glass-context-menu-trigger class="h-36 w-72 border-dashed bg-secondary/70">
      Right click here
    </proto-ui-liquid-glass-context-menu-trigger>
    <proto-ui-liquid-glass-context-menu-content class="w-48">
      <proto-ui-liquid-glass-context-menu-item>Edit</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item>Share</proto-ui-liquid-glass-context-menu-item>
      <div role="separator" class="mx-2 my-1 h-px bg-border/60"></div>
      <proto-ui-liquid-glass-context-menu-item id="lg-destr-delete">Delete</proto-ui-liquid-glass-context-menu-item>
    </proto-ui-liquid-glass-context-menu-content>
  </proto-ui-liquid-glass-context-menu-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-destr-delete'), { inset: true, variant: 'destructive' });
</script>
    `),
    'demo-liquid-glass-context-menu-sides': formatCode(`
<proto-ui-liquid-glass-context-menu-root>
  <proto-ui-liquid-glass-context-menu-trigger class="h-28 w-44 border-dashed bg-secondary/70">
    Right click (top)
  </proto-ui-liquid-glass-context-menu-trigger>
  <proto-ui-liquid-glass-context-menu-content id="lg-side-top">
    <proto-ui-liquid-glass-context-menu-item>Back</proto-ui-liquid-glass-context-menu-item>
    <proto-ui-liquid-glass-context-menu-item>Forward</proto-ui-liquid-glass-context-menu-item>
    <proto-ui-liquid-glass-context-menu-item>Reload</proto-ui-liquid-glass-context-menu-item>
  </proto-ui-liquid-glass-context-menu-content>
</proto-ui-liquid-glass-context-menu-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-side-top'), { side: 'top', sideOffset: 4 });
</script>
    `),
    'demo-liquid-glass-context-menu-opaque': formatCode(`
<div class="grid max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <proto-ui-liquid-glass-context-menu-root>
    <proto-ui-liquid-glass-context-menu-trigger class="h-32 w-full border-dashed bg-secondary/70">Auto (Liquid Glass)</proto-ui-liquid-glass-context-menu-trigger>
    <proto-ui-liquid-glass-context-menu-content id="lg-mat-auto">
      <proto-ui-liquid-glass-context-menu-item>Copy</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item>Paste</proto-ui-liquid-glass-context-menu-item>
    </proto-ui-liquid-glass-context-menu-content>
  </proto-ui-liquid-glass-context-menu-root>
  <proto-ui-liquid-glass-context-menu-root>
    <proto-ui-liquid-glass-context-menu-trigger class="h-32 w-full border-dashed bg-secondary/70">Opaque surface</proto-ui-liquid-glass-context-menu-trigger>
    <proto-ui-liquid-glass-context-menu-content id="lg-mat-opaque">
      <proto-ui-liquid-glass-context-menu-item>Copy</proto-ui-liquid-glass-context-menu-item>
      <proto-ui-liquid-glass-context-menu-item>Paste</proto-ui-liquid-glass-context-menu-item>
    </proto-ui-liquid-glass-context-menu-content>
  </proto-ui-liquid-glass-context-menu-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-mat-auto'), { material: 'auto' });
  setElementProps(document.querySelector('#lg-mat-opaque'), { material: 'opaque' });
</script>
    `),
  },
  react: {
    'demo-shadcn-context-menu': formatCode(`
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/react';

export function ContextMenuDemo() {
  return (
    <ShadcnContextMenuRoot styleProfile="rhea">
      <ShadcnContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click here
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent className="w-52">
        <ShadcnContextMenuItem value="back">
          Back <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘[</span>
        </ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="forward" disabled>
          Forward <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘]</span>
        </ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="reload">
          Reload <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘R</span>
        </ShadcnContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border/50" />
        <ShadcnContextMenuItem value="save-page">
          Save Page... <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘S</span>
        </ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="create-shortcut">Create Shortcut...</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="devtools">Developer Tools</ShadcnContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border/50" />
        <ShadcnContextMenuItem value="delete" variant="destructive">
          Delete <span className="ml-auto text-xs tracking-widest">⌫</span>
        </ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  );
}
    `),
    'demo-shadcn-context-menu-basic': formatCode(`
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/react';

export function ContextMenuBasicDemo() {
  return (
    <ShadcnContextMenuRoot styleProfile="rhea">
      <ShadcnContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click here
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent>
        <ShadcnContextMenuItem value="back">Back</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="forward" disabled>Forward</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="reload">Reload</ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  );
}
    `),
    'demo-shadcn-context-menu-shortcuts': formatCode(`
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/react';

export function ContextMenuShortcutsDemo() {
  return (
    <ShadcnContextMenuRoot styleProfile="rhea">
      <ShadcnContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click here
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent className="w-52">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">File</div>
        <ShadcnContextMenuItem value="new-file">New File <span className="ml-auto text-xs text-muted-foreground">⌘N</span></ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="open-file">Open File <span className="ml-auto text-xs text-muted-foreground">⌘O</span></ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="save">Save <span className="ml-auto text-xs text-muted-foreground">⌘S</span></ShadcnContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border/50" />
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Edit</div>
        <ShadcnContextMenuItem value="cut">Cut <span className="ml-auto text-xs text-muted-foreground">⌘X</span></ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="copy">Copy <span className="ml-auto text-xs text-muted-foreground">⌘C</span></ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="paste">Paste <span className="ml-auto text-xs text-muted-foreground">⌘V</span></ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  );
}
    `),
    'demo-shadcn-context-menu-destructive': formatCode(`
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/react';

export function ContextMenuDestructiveDemo() {
  return (
    <ShadcnContextMenuRoot styleProfile="rhea">
      <ShadcnContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click here
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent className="w-48">
        <ShadcnContextMenuItem value="edit" inset>Edit</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="duplicate" inset>Duplicate</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="share" inset>Share</ShadcnContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border/50" />
        <ShadcnContextMenuItem value="delete" variant="destructive" inset>
          Delete
        </ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  );
}
    `),
    'demo-shadcn-context-menu-sides': formatCode(`
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/react';

export function ContextMenuSidesDemo() {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <ShadcnContextMenuRoot key={side} styleProfile="rhea">
          <ShadcnContextMenuTrigger className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Right click ({side})
          </ShadcnContextMenuTrigger>
          <ShadcnContextMenuContent side={side} sideOffset={4}>
            <ShadcnContextMenuItem value="back">Back</ShadcnContextMenuItem>
            <ShadcnContextMenuItem value="forward">Forward</ShadcnContextMenuItem>
            <ShadcnContextMenuItem value="reload">Reload</ShadcnContextMenuItem>
          </ShadcnContextMenuContent>
        </ShadcnContextMenuRoot>
      ))}
    </div>
  );
}
    `),
    'demo-shadcn-context-menu-keep-open': formatCode(`
import { useState } from 'react';
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/react';

export function ContextMenuKeepOpenDemo() {
  const [bookmarks, setBookmarks] = useState(true);
  const [urls, setUrls] = useState(false);
  const [devtools, setDevtools] = useState(true);

  return (
    <ShadcnContextMenuRoot styleProfile="rhea" closeOnItemCommit={false}>
      <ShadcnContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click to toggle options
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent className="w-56">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Appearance</div>
        <ShadcnContextMenuItem value="bookmarks" onSelect={() => setBookmarks((v) => !v)}>
          <span className="inline-block w-4 text-center text-xs">{bookmarks ? '✓' : ''}</span>
          Show Bookmarks Bar
        </ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="urls" onSelect={() => setUrls((v) => !v)}>
          <span className="inline-block w-4 text-center text-xs">{urls ? '✓' : ''}</span>
          Show Full URLs
        </ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="devtools" onSelect={() => setDevtools((v) => !v)}>
          <span className="inline-block w-4 text-center text-xs">{devtools ? '✓' : ''}</span>
          Show Developer Tools
        </ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  );
}
    `),
    'demo-brutalist-context-menu': formatCode(`
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/react';

export function BrutalistContextMenuDemo() {
  return (
    <BrutalistContextMenuRoot>
      <BrutalistContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
        Right click here
      </BrutalistContextMenuTrigger>
      <BrutalistContextMenuContent className="w-56">
        <BrutalistContextMenuItem value="back">
          Back <span className="ml-auto text-xs opacity-70">⌘[</span>
        </BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="forward" disabled>
          Forward <span className="ml-auto text-xs opacity-70">⌘]</span>
        </BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="reload">
          Reload <span className="ml-auto text-xs opacity-70">⌘R</span>
        </BrutalistContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-0.5 bg-black" />
        <BrutalistContextMenuItem value="save-page">Save Page As...</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="devtools">Developer Tools</BrutalistContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-0.5 bg-black" />
        <BrutalistContextMenuItem value="delete" variant="destructive">
          Delete <span className="ml-auto text-xs">⌫</span>
        </BrutalistContextMenuItem>
      </BrutalistContextMenuContent>
    </BrutalistContextMenuRoot>
  );
}
    `),
    'demo-brutalist-context-menu-basic': formatCode(`
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/react';

export function BrutalistContextMenuBasicDemo() {
  return (
    <BrutalistContextMenuRoot>
      <BrutalistContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
        Right click here
      </BrutalistContextMenuTrigger>
      <BrutalistContextMenuContent>
        <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="forward" disabled>Forward</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
      </BrutalistContextMenuContent>
    </BrutalistContextMenuRoot>
  );
}
    `),
    'demo-brutalist-context-menu-destructive': formatCode(`
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/react';

export function BrutalistContextMenuDestructiveDemo() {
  return (
    <BrutalistContextMenuRoot>
      <BrutalistContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
        Right click here
      </BrutalistContextMenuTrigger>
      <BrutalistContextMenuContent className="w-48">
        <BrutalistContextMenuItem value="edit" inset>Edit</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="share" inset>Share</BrutalistContextMenuItem>
        <div role="separator" className="-mx-1 my-1 h-0.5 bg-black" />
        <BrutalistContextMenuItem value="delete" variant="destructive" inset>
          Delete
        </BrutalistContextMenuItem>
      </BrutalistContextMenuContent>
    </BrutalistContextMenuRoot>
  );
}
    `),
    'demo-brutalist-context-menu-sides': formatCode(`
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/react';

export function BrutalistContextMenuSidesDemo() {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <BrutalistContextMenuRoot key={side}>
          <BrutalistContextMenuTrigger className="flex h-28 w-full items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
            Right click ({side})
          </BrutalistContextMenuTrigger>
          <BrutalistContextMenuContent side={side} sideOffset={4}>
            <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
            <BrutalistContextMenuItem value="forward">Forward</BrutalistContextMenuItem>
            <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
          </BrutalistContextMenuContent>
        </BrutalistContextMenuRoot>
      ))}
    </div>
  );
}
    `),
    'demo-bootstrap-2-3-2-context-menu': formatCode(`
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/react';

export function BootstrapContextMenuDemo() {
  return (
    <BootstrapContextMenuRoot>
      <BootstrapContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
        Right click here
      </BootstrapContextMenuTrigger>
      <BootstrapContextMenuContent>
        <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="forward" disabled>Forward</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
        <div role="separator" className="my-2 h-px bg-border" />
        <BootstrapContextMenuItem value="save-page">Save Page...</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="devtools">Developer Tools</BootstrapContextMenuItem>
        <div role="separator" className="my-2 h-px bg-border" />
        <BootstrapContextMenuItem value="delete" variant="destructive">Delete</BootstrapContextMenuItem>
      </BootstrapContextMenuContent>
    </BootstrapContextMenuRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-context-menu-basic': formatCode(`
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/react';

export function BootstrapContextMenuBasicDemo() {
  return (
    <BootstrapContextMenuRoot>
      <BootstrapContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
        Right click here
      </BootstrapContextMenuTrigger>
      <BootstrapContextMenuContent>
        <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="forward" disabled>Forward</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
      </BootstrapContextMenuContent>
    </BootstrapContextMenuRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-context-menu-destructive': formatCode(`
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/react';

export function BootstrapContextMenuDestructiveDemo() {
  return (
    <BootstrapContextMenuRoot>
      <BootstrapContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
        Right click here
      </BootstrapContextMenuTrigger>
      <BootstrapContextMenuContent>
        <BootstrapContextMenuItem value="edit">Edit</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="share">Share</BootstrapContextMenuItem>
        <div role="separator" className="my-2 h-px bg-border" />
        <BootstrapContextMenuItem value="delete" variant="destructive">Delete</BootstrapContextMenuItem>
      </BootstrapContextMenuContent>
    </BootstrapContextMenuRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-context-menu-sides': formatCode(`
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/react';

export function BootstrapContextMenuSidesDemo() {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <BootstrapContextMenuRoot key={side}>
          <BootstrapContextMenuTrigger className="flex h-28 w-full items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
            Right click ({side})
          </BootstrapContextMenuTrigger>
          <BootstrapContextMenuContent side={side} sideOffset={4}>
            <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
            <BootstrapContextMenuItem value="forward">Forward</BootstrapContextMenuItem>
            <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
          </BootstrapContextMenuContent>
        </BootstrapContextMenuRoot>
      ))}
    </div>
  );
}
    `),
    'demo-liquid-glass-context-menu': formatCode(`
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/react';

export function LiquidGlassContextMenuDemo() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassContextMenuRoot>
        <LiquidGlassContextMenuTrigger className="h-36 w-72 border-dashed bg-secondary/70">
          Right click here
        </LiquidGlassContextMenuTrigger>
        <LiquidGlassContextMenuContent className="w-52">
          <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="forward" disabled>Forward</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
          <div role="separator" className="mx-2 my-1 h-px bg-border/60" />
          <LiquidGlassContextMenuItem value="save-page">Save Page...</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="devtools">Developer Tools</LiquidGlassContextMenuItem>
          <div role="separator" className="mx-2 my-1 h-px bg-border/60" />
          <LiquidGlassContextMenuItem value="delete" variant="destructive">Delete</LiquidGlassContextMenuItem>
        </LiquidGlassContextMenuContent>
      </LiquidGlassContextMenuRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-context-menu-basic': formatCode(`
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/react';

export function LiquidGlassContextMenuBasicDemo() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassContextMenuRoot>
        <LiquidGlassContextMenuTrigger className="h-36 w-72 border-dashed bg-secondary/70">
          Right click here
        </LiquidGlassContextMenuTrigger>
        <LiquidGlassContextMenuContent>
          <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="forward" disabled>Forward</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
        </LiquidGlassContextMenuContent>
      </LiquidGlassContextMenuRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-context-menu-destructive': formatCode(`
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/react';

export function LiquidGlassContextMenuDestructiveDemo() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassContextMenuRoot>
        <LiquidGlassContextMenuTrigger className="h-36 w-72 border-dashed bg-secondary/70">
          Right click here
        </LiquidGlassContextMenuTrigger>
        <LiquidGlassContextMenuContent className="w-48">
          <LiquidGlassContextMenuItem value="edit" inset>Edit</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="share" inset>Share</LiquidGlassContextMenuItem>
          <div role="separator" className="mx-2 my-1 h-px bg-border/60" />
          <LiquidGlassContextMenuItem value="delete" variant="destructive" inset>
            Delete
          </LiquidGlassContextMenuItem>
        </LiquidGlassContextMenuContent>
      </LiquidGlassContextMenuRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-context-menu-sides': formatCode(`
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/react';

export function LiquidGlassContextMenuSidesDemo() {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <LiquidGlassContextMenuRoot key={side}>
          <LiquidGlassContextMenuTrigger className="h-28 w-full border-dashed bg-secondary/70">
            Right click ({side})
          </LiquidGlassContextMenuTrigger>
          <LiquidGlassContextMenuContent side={side} sideOffset={4}>
            <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
            <LiquidGlassContextMenuItem value="forward">Forward</LiquidGlassContextMenuItem>
            <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
          </LiquidGlassContextMenuContent>
        </LiquidGlassContextMenuRoot>
      ))}
    </div>
  );
}
    `),
    'demo-liquid-glass-context-menu-opaque': formatCode(`
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/react';

export function LiquidGlassContextMenuOpaqueDemo() {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassContextMenuRoot>
        <LiquidGlassContextMenuTrigger className="h-32 w-full border-dashed bg-secondary/70">
          Auto (Liquid Glass)
        </LiquidGlassContextMenuTrigger>
        <LiquidGlassContextMenuContent material="auto">
          <LiquidGlassContextMenuItem value="copy">Copy</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="paste">Paste</LiquidGlassContextMenuItem>
        </LiquidGlassContextMenuContent>
      </LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuRoot>
        <LiquidGlassContextMenuTrigger className="h-32 w-full border-dashed bg-secondary/70">
          Opaque surface
        </LiquidGlassContextMenuTrigger>
        <LiquidGlassContextMenuContent material="opaque">
          <LiquidGlassContextMenuItem value="copy">Copy</LiquidGlassContextMenuItem>
          <LiquidGlassContextMenuItem value="paste">Paste</LiquidGlassContextMenuItem>
        </LiquidGlassContextMenuContent>
      </LiquidGlassContextMenuRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-context-menu': formatCode(`
<script setup lang="ts">
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-52">
      <ShadcnContextMenuItem value="back">Back <span class="ml-auto text-xs text-muted-foreground">⌘[</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="forward" :disabled="true">Forward <span class="ml-auto text-xs text-muted-foreground">⌘]</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="reload">Reload <span class="ml-auto text-xs text-muted-foreground">⌘R</span></ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <ShadcnContextMenuItem value="save-page">Save Page...</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="create-shortcut">Create Shortcut...</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="devtools">Developer Tools</ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <ShadcnContextMenuItem value="delete" variant="destructive">Delete <span class="ml-auto text-xs">⌫</span></ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>
    `),
    'demo-shadcn-context-menu-basic': formatCode(`
<script setup lang="ts">
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent>
      <ShadcnContextMenuItem value="back">Back</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="forward" :disabled="true">Forward</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="reload">Reload</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>
    `),
    'demo-shadcn-context-menu-shortcuts': formatCode(`
<script setup lang="ts">
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-52">
      <div class="px-2 py-1 text-xs font-medium text-muted-foreground">File</div>
      <ShadcnContextMenuItem value="new-file">New File <span class="ml-auto text-xs text-muted-foreground">⌘N</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="open-file">Open File <span class="ml-auto text-xs text-muted-foreground">⌘O</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="save">Save <span class="ml-auto text-xs text-muted-foreground">⌘S</span></ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <div class="px-2 py-1 text-xs font-medium text-muted-foreground">Edit</div>
      <ShadcnContextMenuItem value="cut">Cut <span class="ml-auto text-xs text-muted-foreground">⌘X</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="copy">Copy <span class="ml-auto text-xs text-muted-foreground">⌘C</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="paste">Paste <span class="ml-auto text-xs text-muted-foreground">⌘V</span></ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>
    `),
    'demo-shadcn-context-menu-destructive': formatCode(`
<script setup lang="ts">
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-48">
      <ShadcnContextMenuItem value="edit" :inset="true">Edit</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="duplicate" :inset="true">Duplicate</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="share" :inset="true">Share</ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <ShadcnContextMenuItem value="delete" variant="destructive" :inset="true">Delete</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>
    `),
    'demo-shadcn-context-menu-sides': formatCode(`
<script setup lang="ts">
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue';

const sides = ['top', 'right', 'bottom', 'left'] as const;
</script>

<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4">
    <ShadcnContextMenuRoot v-for="side in sides" :key="side" styleProfile="rhea">
      <ShadcnContextMenuTrigger class="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click ({{ side }})
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent :side="side" :sideOffset="4">
        <ShadcnContextMenuItem value="back">Back</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="forward">Forward</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="reload">Reload</ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  </div>
</template>
    `),
    'demo-shadcn-context-menu-keep-open': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue';

const bookmarks = ref(true);
const urls = ref(false);
const devtools = ref(true);
</script>

<template>
  <ShadcnContextMenuRoot styleProfile="rhea" :closeOnItemCommit="false">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click to toggle options
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-56">
      <ShadcnContextMenuItem value="bookmarks" @select="bookmarks = !bookmarks">{{ bookmarks ? '✓ ' : '' }}Show Bookmarks Bar</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="urls" @select="urls = !urls">{{ urls ? '✓ ' : '' }}Show Full URLs</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="devtools" @select="devtools = !devtools">{{ devtools ? '✓ ' : '' }}Show Developer Tools</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>
    `),
    'demo-brutalist-context-menu': formatCode(`
<script setup lang="ts">
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistContextMenuRoot>
    <BrutalistContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
      Right click here
    </BrutalistContextMenuTrigger>
    <BrutalistContextMenuContent class="w-56">
      <BrutalistContextMenuItem value="back">Back <span class="ml-auto text-xs opacity-70">⌘[</span></BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="forward" :disabled="true">Forward <span class="ml-auto text-xs opacity-70">⌘]</span></BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="reload">Reload <span class="ml-auto text-xs opacity-70">⌘R</span></BrutalistContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistContextMenuItem value="save-page">Save Page As...</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="devtools">Developer Tools</BrutalistContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistContextMenuItem value="delete" variant="destructive">Delete</BrutalistContextMenuItem>
    </BrutalistContextMenuContent>
  </BrutalistContextMenuRoot>
</template>
    `),
    'demo-brutalist-context-menu-basic': formatCode(`
<script setup lang="ts">
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistContextMenuRoot>
    <BrutalistContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
      Right click here
    </BrutalistContextMenuTrigger>
    <BrutalistContextMenuContent>
      <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="forward" :disabled="true">Forward</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
    </BrutalistContextMenuContent>
  </BrutalistContextMenuRoot>
</template>
    `),
    'demo-brutalist-context-menu-destructive': formatCode(`
<script setup lang="ts">
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistContextMenuRoot>
    <BrutalistContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
      Right click here
    </BrutalistContextMenuTrigger>
    <BrutalistContextMenuContent class="w-48">
      <BrutalistContextMenuItem value="edit" :inset="true">Edit</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="share" :inset="true">Share</BrutalistContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistContextMenuItem value="delete" variant="destructive" :inset="true">Delete</BrutalistContextMenuItem>
    </BrutalistContextMenuContent>
  </BrutalistContextMenuRoot>
</template>
    `),
    'demo-brutalist-context-menu-sides': formatCode(`
<script setup lang="ts">
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue';

const sides = ['top', 'right', 'bottom', 'left'] as const;
</script>

<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4">
    <BrutalistContextMenuRoot v-for="side in sides" :key="side">
      <BrutalistContextMenuTrigger class="flex h-28 w-full items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
        Right click ({{ side }})
      </BrutalistContextMenuTrigger>
      <BrutalistContextMenuContent :side="side" :sideOffset="4">
        <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="forward">Forward</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
      </BrutalistContextMenuContent>
    </BrutalistContextMenuRoot>
  </div>
</template>
    `),
    'demo-bootstrap-2-3-2-context-menu': formatCode(`
<script setup lang="ts">
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapContextMenuRoot>
    <BootstrapContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
      Right click here
    </BootstrapContextMenuTrigger>
    <BootstrapContextMenuContent>
      <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="forward" :disabled="true">Forward</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
      <div role="separator" class="my-2 h-px bg-border" />
      <BootstrapContextMenuItem value="save-page">Save Page...</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="devtools">Developer Tools</BootstrapContextMenuItem>
      <div role="separator" class="my-2 h-px bg-border" />
      <BootstrapContextMenuItem value="delete" variant="destructive">Delete</BootstrapContextMenuItem>
    </BootstrapContextMenuContent>
  </BootstrapContextMenuRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-context-menu-basic': formatCode(`
<script setup lang="ts">
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapContextMenuRoot>
    <BootstrapContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
      Right click here
    </BootstrapContextMenuTrigger>
    <BootstrapContextMenuContent>
      <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="forward" :disabled="true">Forward</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
    </BootstrapContextMenuContent>
  </BootstrapContextMenuRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-context-menu-destructive': formatCode(`
<script setup lang="ts">
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <BootstrapContextMenuRoot>
    <BootstrapContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
      Right click here
    </BootstrapContextMenuTrigger>
    <BootstrapContextMenuContent>
      <BootstrapContextMenuItem value="edit">Edit</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="share">Share</BootstrapContextMenuItem>
      <div role="separator" class="my-2 h-px bg-border" />
      <BootstrapContextMenuItem value="delete" variant="destructive">Delete</BootstrapContextMenuItem>
    </BootstrapContextMenuContent>
  </BootstrapContextMenuRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-context-menu-sides': formatCode(`
<script setup lang="ts">
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue';

const sides = ['top', 'right', 'bottom', 'left'] as const;
</script>

<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4">
    <BootstrapContextMenuRoot v-for="side in sides" :key="side">
      <BootstrapContextMenuTrigger class="flex h-28 w-full items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
        Right click ({{ side }})
      </BootstrapContextMenuTrigger>
      <BootstrapContextMenuContent :side="side" :sideOffset="4">
        <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="forward">Forward</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
      </BootstrapContextMenuContent>
    </BootstrapContextMenuRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-context-menu': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-36 w-72 border-dashed bg-secondary/70">
        Right click here
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent class="w-52">
        <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="forward" :disabled="true">Forward</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
        <div role="separator" class="mx-2 my-1 h-px bg-border/60" />
        <LiquidGlassContextMenuItem value="save-page">Save Page...</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="devtools">Developer Tools</LiquidGlassContextMenuItem>
        <div role="separator" class="mx-2 my-1 h-px bg-border/60" />
        <LiquidGlassContextMenuItem value="delete" variant="destructive">Delete</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-context-menu-basic': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-36 w-72 border-dashed bg-secondary/70">
        Right click here
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent>
        <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="forward" :disabled="true">Forward</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-context-menu-destructive': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-36 w-72 border-dashed bg-secondary/70">
        Right click here
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent class="w-48">
        <LiquidGlassContextMenuItem value="edit" :inset="true">Edit</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="share" :inset="true">Share</LiquidGlassContextMenuItem>
        <div role="separator" class="mx-2 my-1 h-px bg-border/60" />
        <LiquidGlassContextMenuItem value="delete" variant="destructive" :inset="true">Delete</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-context-menu-sides': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue';

const sides = ['top', 'right', 'bottom', 'left'] as const;
</script>

<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot v-for="side in sides" :key="side">
      <LiquidGlassContextMenuTrigger class="h-28 w-full border-dashed bg-secondary/70">
        Right click ({{ side }})
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent :side="side" :sideOffset="4">
        <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="forward">Forward</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-context-menu-opaque': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-32 w-full border-dashed bg-secondary/70">Auto (Liquid Glass)</LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent material="auto">
        <LiquidGlassContextMenuItem value="copy">Copy</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="paste">Paste</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-32 w-full border-dashed bg-secondary/70">Opaque surface</LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent material="opaque">
        <LiquidGlassContextMenuItem value="copy">Copy</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="paste">Paste</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-context-menu': formatCode(`
<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-52">
      <ShadcnContextMenuItem value="back">Back <span class="ml-auto text-xs text-muted-foreground">⌘[</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="forward" :disabled="true">Forward <span class="ml-auto text-xs text-muted-foreground">⌘]</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="reload">Reload <span class="ml-auto text-xs text-muted-foreground">⌘R</span></ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <ShadcnContextMenuItem value="save-page">Save Page...</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="create-shortcut">Create Shortcut...</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="devtools">Developer Tools</ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <ShadcnContextMenuItem value="delete" variant="destructive">Delete</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>

<script>
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnContextMenuRoot,
    ShadcnContextMenuTrigger,
    ShadcnContextMenuContent,
    ShadcnContextMenuItem,
  },
};
</script>
    `),
    'demo-shadcn-context-menu-basic': formatCode(`
<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent>
      <ShadcnContextMenuItem value="back">Back</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="forward" :disabled="true">Forward</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="reload">Reload</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>

<script>
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnContextMenuRoot, ShadcnContextMenuTrigger, ShadcnContextMenuContent, ShadcnContextMenuItem },
};
</script>
    `),
    'demo-shadcn-context-menu-shortcuts': formatCode(`
<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-52">
      <div class="px-2 py-1 text-xs font-medium text-muted-foreground">File</div>
      <ShadcnContextMenuItem value="new-file">New File <span class="ml-auto text-xs text-muted-foreground">⌘N</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="open-file">Open File <span class="ml-auto text-xs text-muted-foreground">⌘O</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="save">Save <span class="ml-auto text-xs text-muted-foreground">⌘S</span></ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <div class="px-2 py-1 text-xs font-medium text-muted-foreground">Edit</div>
      <ShadcnContextMenuItem value="cut">Cut <span class="ml-auto text-xs text-muted-foreground">⌘X</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="copy">Copy <span class="ml-auto text-xs text-muted-foreground">⌘C</span></ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="paste">Paste <span class="ml-auto text-xs text-muted-foreground">⌘V</span></ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>

<script>
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnContextMenuRoot, ShadcnContextMenuTrigger, ShadcnContextMenuContent, ShadcnContextMenuItem },
};
</script>
    `),
    'demo-shadcn-context-menu-destructive': formatCode(`
<template>
  <ShadcnContextMenuRoot styleProfile="rhea">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click here
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-48">
      <ShadcnContextMenuItem value="edit" :inset="true">Edit</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="duplicate" :inset="true">Duplicate</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="share" :inset="true">Share</ShadcnContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border/50" />
      <ShadcnContextMenuItem value="delete" variant="destructive" :inset="true">Delete</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>

<script>
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnContextMenuRoot, ShadcnContextMenuTrigger, ShadcnContextMenuContent, ShadcnContextMenuItem },
};
</script>
    `),
    'demo-shadcn-context-menu-sides': formatCode(`
<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4">
    <ShadcnContextMenuRoot v-for="side in sides" :key="side" styleProfile="rhea">
      <ShadcnContextMenuTrigger class="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Right click ({{ side }})
      </ShadcnContextMenuTrigger>
      <ShadcnContextMenuContent :side="side" :sideOffset="4">
        <ShadcnContextMenuItem value="back">Back</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="forward">Forward</ShadcnContextMenuItem>
        <ShadcnContextMenuItem value="reload">Reload</ShadcnContextMenuItem>
      </ShadcnContextMenuContent>
    </ShadcnContextMenuRoot>
  </div>
</template>

<script>
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnContextMenuRoot, ShadcnContextMenuTrigger, ShadcnContextMenuContent, ShadcnContextMenuItem },
  data() { return { sides: ['top', 'right', 'bottom', 'left'] }; },
};
</script>
    `),
    'demo-shadcn-context-menu-keep-open': formatCode(`
<template>
  <ShadcnContextMenuRoot styleProfile="rhea" :closeOnItemCommit="false">
    <ShadcnContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      Right click to toggle options
    </ShadcnContextMenuTrigger>
    <ShadcnContextMenuContent class="w-56">
      <ShadcnContextMenuItem value="bookmarks" @select="bookmarks = !bookmarks">{{ bookmarks ? '✓ ' : '' }}Show Bookmarks Bar</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="urls" @select="urls = !urls">{{ urls ? '✓ ' : '' }}Show Full URLs</ShadcnContextMenuItem>
      <ShadcnContextMenuItem value="devtools" @select="devtools = !devtools">{{ devtools ? '✓ ' : '' }}Show Developer Tools</ShadcnContextMenuItem>
    </ShadcnContextMenuContent>
  </ShadcnContextMenuRoot>
</template>

<script>
import {
  ShadcnContextMenuContent,
  ShadcnContextMenuItem,
  ShadcnContextMenuRoot,
  ShadcnContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { ShadcnContextMenuRoot, ShadcnContextMenuTrigger, ShadcnContextMenuContent, ShadcnContextMenuItem },
  data() { return { bookmarks: true, urls: false, devtools: true }; },
};
</script>
    `),
    'demo-brutalist-context-menu': formatCode(`
<template>
  <BrutalistContextMenuRoot>
    <BrutalistContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
      Right click here
    </BrutalistContextMenuTrigger>
    <BrutalistContextMenuContent class="w-56">
      <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="forward" :disabled="true">Forward</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistContextMenuItem value="save-page">Save Page As...</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="devtools">Developer Tools</BrutalistContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistContextMenuItem value="delete" variant="destructive">Delete</BrutalistContextMenuItem>
    </BrutalistContextMenuContent>
  </BrutalistContextMenuRoot>
</template>

<script>
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistContextMenuRoot, BrutalistContextMenuTrigger, BrutalistContextMenuContent, BrutalistContextMenuItem },
};
</script>
    `),
    'demo-brutalist-context-menu-basic': formatCode(`
<template>
  <BrutalistContextMenuRoot>
    <BrutalistContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
      Right click here
    </BrutalistContextMenuTrigger>
    <BrutalistContextMenuContent>
      <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="forward" :disabled="true">Forward</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
    </BrutalistContextMenuContent>
  </BrutalistContextMenuRoot>
</template>

<script>
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistContextMenuRoot, BrutalistContextMenuTrigger, BrutalistContextMenuContent, BrutalistContextMenuItem },
};
</script>
    `),
    'demo-brutalist-context-menu-destructive': formatCode(`
<template>
  <BrutalistContextMenuRoot>
    <BrutalistContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
      Right click here
    </BrutalistContextMenuTrigger>
    <BrutalistContextMenuContent class="w-48">
      <BrutalistContextMenuItem value="edit" :inset="true">Edit</BrutalistContextMenuItem>
      <BrutalistContextMenuItem value="share" :inset="true">Share</BrutalistContextMenuItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistContextMenuItem value="delete" variant="destructive" :inset="true">Delete</BrutalistContextMenuItem>
    </BrutalistContextMenuContent>
  </BrutalistContextMenuRoot>
</template>

<script>
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistContextMenuRoot, BrutalistContextMenuTrigger, BrutalistContextMenuContent, BrutalistContextMenuItem },
};
</script>
    `),
    'demo-brutalist-context-menu-sides': formatCode(`
<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4">
    <BrutalistContextMenuRoot v-for="side in sides" :key="side">
      <BrutalistContextMenuTrigger class="flex h-28 w-full items-center justify-center rounded-base border-2 border-dashed border-black bg-secondary-background text-sm font-sans font-medium text-foreground">
        Right click ({{ side }})
      </BrutalistContextMenuTrigger>
      <BrutalistContextMenuContent :side="side" :sideOffset="4">
        <BrutalistContextMenuItem value="back">Back</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="forward">Forward</BrutalistContextMenuItem>
        <BrutalistContextMenuItem value="reload">Reload</BrutalistContextMenuItem>
      </BrutalistContextMenuContent>
    </BrutalistContextMenuRoot>
  </div>
</template>

<script>
import {
  BrutalistContextMenuContent,
  BrutalistContextMenuItem,
  BrutalistContextMenuRoot,
  BrutalistContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BrutalistContextMenuRoot, BrutalistContextMenuTrigger, BrutalistContextMenuContent, BrutalistContextMenuItem },
  data() { return { sides: ['top', 'right', 'bottom', 'left'] }; },
};
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu': formatCode(`
<template>
  <BootstrapContextMenuRoot>
    <BootstrapContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
      Right click here
    </BootstrapContextMenuTrigger>
    <BootstrapContextMenuContent>
      <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="forward" :disabled="true">Forward</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
      <div role="separator" class="my-2 h-px bg-border" />
      <BootstrapContextMenuItem value="save-page">Save Page...</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="devtools">Developer Tools</BootstrapContextMenuItem>
      <div role="separator" class="my-2 h-px bg-border" />
      <BootstrapContextMenuItem value="delete" variant="destructive">Delete</BootstrapContextMenuItem>
    </BootstrapContextMenuContent>
  </BootstrapContextMenuRoot>
</template>

<script>
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BootstrapContextMenuRoot, BootstrapContextMenuTrigger, BootstrapContextMenuContent, BootstrapContextMenuItem },
};
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu-basic': formatCode(`
<template>
  <BootstrapContextMenuRoot>
    <BootstrapContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
      Right click here
    </BootstrapContextMenuTrigger>
    <BootstrapContextMenuContent>
      <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="forward" :disabled="true">Forward</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
    </BootstrapContextMenuContent>
  </BootstrapContextMenuRoot>
</template>

<script>
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BootstrapContextMenuRoot, BootstrapContextMenuTrigger, BootstrapContextMenuContent, BootstrapContextMenuItem },
};
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu-destructive': formatCode(`
<template>
  <BootstrapContextMenuRoot>
    <BootstrapContextMenuTrigger class="flex h-36 w-72 items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
      Right click here
    </BootstrapContextMenuTrigger>
    <BootstrapContextMenuContent>
      <BootstrapContextMenuItem value="edit">Edit</BootstrapContextMenuItem>
      <BootstrapContextMenuItem value="share">Share</BootstrapContextMenuItem>
      <div role="separator" class="my-2 h-px bg-border" />
      <BootstrapContextMenuItem value="delete" variant="destructive">Delete</BootstrapContextMenuItem>
    </BootstrapContextMenuContent>
  </BootstrapContextMenuRoot>
</template>

<script>
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BootstrapContextMenuRoot, BootstrapContextMenuTrigger, BootstrapContextMenuContent, BootstrapContextMenuItem },
};
</script>
    `),
    'demo-bootstrap-2-3-2-context-menu-sides': formatCode(`
<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4">
    <BootstrapContextMenuRoot v-for="side in sides" :key="side">
      <BootstrapContextMenuTrigger class="flex h-28 w-full items-center justify-center rounded border border-dashed border-border bg-secondary text-sm text-foreground">
        Right click ({{ side }})
      </BootstrapContextMenuTrigger>
      <BootstrapContextMenuContent :side="side" :sideOffset="4">
        <BootstrapContextMenuItem value="back">Back</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="forward">Forward</BootstrapContextMenuItem>
        <BootstrapContextMenuItem value="reload">Reload</BootstrapContextMenuItem>
      </BootstrapContextMenuContent>
    </BootstrapContextMenuRoot>
  </div>
</template>

<script>
import {
  BootstrapContextMenuContent,
  BootstrapContextMenuItem,
  BootstrapContextMenuRoot,
  BootstrapContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { BootstrapContextMenuRoot, BootstrapContextMenuTrigger, BootstrapContextMenuContent, BootstrapContextMenuItem },
  data() { return { sides: ['top', 'right', 'bottom', 'left'] }; },
};
</script>
    `),
    'demo-liquid-glass-context-menu': formatCode(`
<template>
  <div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-36 w-72 border-dashed bg-secondary/70">
        Right click here
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent class="w-52">
        <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="forward" :disabled="true">Forward</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
        <div role="separator" class="mx-2 my-1 h-px bg-border/60" />
        <LiquidGlassContextMenuItem value="save-page">Save Page...</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="devtools">Developer Tools</LiquidGlassContextMenuItem>
        <div role="separator" class="mx-2 my-1 h-px bg-border/60" />
        <LiquidGlassContextMenuItem value="delete" variant="destructive">Delete</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>

<script>
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassContextMenuRoot, LiquidGlassContextMenuTrigger, LiquidGlassContextMenuContent, LiquidGlassContextMenuItem },
};
</script>
    `),
    'demo-liquid-glass-context-menu-basic': formatCode(`
<template>
  <div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-36 w-72 border-dashed bg-secondary/70">
        Right click here
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent>
        <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="forward" :disabled="true">Forward</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>

<script>
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassContextMenuRoot, LiquidGlassContextMenuTrigger, LiquidGlassContextMenuContent, LiquidGlassContextMenuItem },
};
</script>
    `),
    'demo-liquid-glass-context-menu-destructive': formatCode(`
<template>
  <div class="flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-36 w-72 border-dashed bg-secondary/70">
        Right click here
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent class="w-48">
        <LiquidGlassContextMenuItem value="edit" :inset="true">Edit</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="share" :inset="true">Share</LiquidGlassContextMenuItem>
        <div role="separator" class="mx-2 my-1 h-px bg-border/60" />
        <LiquidGlassContextMenuItem value="delete" variant="destructive" :inset="true">Delete</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>

<script>
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassContextMenuRoot, LiquidGlassContextMenuTrigger, LiquidGlassContextMenuContent, LiquidGlassContextMenuItem },
};
</script>
    `),
    'demo-liquid-glass-context-menu-sides': formatCode(`
<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot v-for="side in sides" :key="side">
      <LiquidGlassContextMenuTrigger class="h-28 w-full border-dashed bg-secondary/70">
        Right click ({{ side }})
      </LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent :side="side" :sideOffset="4">
        <LiquidGlassContextMenuItem value="back">Back</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="forward">Forward</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="reload">Reload</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>

<script>
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassContextMenuRoot, LiquidGlassContextMenuTrigger, LiquidGlassContextMenuContent, LiquidGlassContextMenuItem },
  data() { return { sides: ['top', 'right', 'bottom', 'left'] }; },
};
</script>
    `),
    'demo-liquid-glass-context-menu-opaque': formatCode(`
<template>
  <div class="grid w-full max-w-md grid-cols-2 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-32 w-full border-dashed bg-secondary/70">Auto (Liquid Glass)</LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent material="auto">
        <LiquidGlassContextMenuItem value="copy">Copy</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="paste">Paste</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
    <LiquidGlassContextMenuRoot>
      <LiquidGlassContextMenuTrigger class="h-32 w-full border-dashed bg-secondary/70">Opaque surface</LiquidGlassContextMenuTrigger>
      <LiquidGlassContextMenuContent material="opaque">
        <LiquidGlassContextMenuItem value="copy">Copy</LiquidGlassContextMenuItem>
        <LiquidGlassContextMenuItem value="paste">Paste</LiquidGlassContextMenuItem>
      </LiquidGlassContextMenuContent>
    </LiquidGlassContextMenuRoot>
  </div>
</template>

<script>
import {
  LiquidGlassContextMenuContent,
  LiquidGlassContextMenuItem,
  LiquidGlassContextMenuRoot,
  LiquidGlassContextMenuTrigger,
} from '../proto-ui/components/vue2';

export default {
  components: { LiquidGlassContextMenuRoot, LiquidGlassContextMenuTrigger, LiquidGlassContextMenuContent, LiquidGlassContextMenuItem },
};
</script>
    `),
  },
};
