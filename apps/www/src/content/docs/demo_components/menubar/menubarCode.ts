import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-menubar': formatCode(`
<shadcn-menubar-root id="menubar-hero" a11y-label="Project commands">
  <shadcn-menubar-trigger value="file">File</shadcn-menubar-trigger>
  <shadcn-menubar-content value="file" a11y-label="File commands">
    <shadcn-menubar-item value="new" text-value="New document">New document</shadcn-menubar-item>
    <shadcn-menubar-item value="open" text-value="Open document">Open document</shadcn-menubar-item>
    <shadcn-menubar-item value="incognito" disabled>New incognito window</shadcn-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
    <shadcn-menubar-item value="print" text-value="Print">Print... <span class="ml-auto text-xs text-muted-foreground">⌘P</span></shadcn-menubar-item>
  </shadcn-menubar-content>

  <shadcn-menubar-trigger value="edit">Edit</shadcn-menubar-trigger>
  <shadcn-menubar-content value="edit" a11y-label="Edit commands">
    <shadcn-menubar-item value="undo" text-value="Undo">Undo</shadcn-menubar-item>
    <shadcn-menubar-item value="redo" text-value="Redo">Redo</shadcn-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
    <shadcn-menubar-item value="cut" text-value="Cut">Cut</shadcn-menubar-item>
    <shadcn-menubar-item value="copy" text-value="Copy">Copy</shadcn-menubar-item>
    <shadcn-menubar-item value="paste" text-value="Paste">Paste</shadcn-menubar-item>
  </shadcn-menubar-content>

  <shadcn-menubar-trigger value="view">View</shadcn-menubar-trigger>
  <shadcn-menubar-content value="view" a11y-label="View commands">
    <shadcn-menubar-item value="reload" inset>Reload</shadcn-menubar-item>
    <shadcn-menubar-item value="force-reload" inset disabled>Force Reload</shadcn-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
    <shadcn-menubar-item value="fullscreen" inset>Toggle Fullscreen</shadcn-menubar-item>
    <shadcn-menubar-item value="sidebar" inset>Hide Sidebar</shadcn-menubar-item>
  </shadcn-menubar-content>

  <shadcn-menubar-trigger value="profiles">Profiles</shadcn-menubar-trigger>
  <shadcn-menubar-content value="profiles" a11y-label="Profile commands">
    <shadcn-menubar-item value="andy">Andy</shadcn-menubar-item>
    <shadcn-menubar-item value="benoit">Benoit</shadcn-menubar-item>
    <shadcn-menubar-item value="luis">Luis</shadcn-menubar-item>
  </shadcn-menubar-content>
</shadcn-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#menubar-hero'), { styleProfile: 'rhea' });
</script>
    `),
    'demo-shadcn-menubar-destructive': formatCode(`
<shadcn-menubar-root id="menubar-destructive" a11y-label="Document actions">
  <shadcn-menubar-trigger value="file">File</shadcn-menubar-trigger>
  <shadcn-menubar-content value="file" a11y-label="File actions">
    <shadcn-menubar-item value="new-file">New File</shadcn-menubar-item>
    <shadcn-menubar-item value="open-folder">Open Folder</shadcn-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
    <shadcn-menubar-item value="save">Save</shadcn-menubar-item>
  </shadcn-menubar-content>

  <shadcn-menubar-trigger value="more">More</shadcn-menubar-trigger>
  <shadcn-menubar-content value="more" a11y-label="More actions">
    <shadcn-menubar-item value="settings">Settings</shadcn-menubar-item>
    <shadcn-menubar-item value="help">Help</shadcn-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
    <shadcn-menubar-item id="delete-item" value="delete">Delete</shadcn-menubar-item>
  </shadcn-menubar-content>
</shadcn-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#menubar-destructive'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#delete-item'), { variant: 'destructive' });
</script>
    `),
    'demo-shadcn-menubar-states': formatCode(`
<shadcn-menubar-root id="menubar-states" a11y-label="View preferences">
  <shadcn-menubar-trigger value="view">View</shadcn-menubar-trigger>
  <shadcn-menubar-content value="view" a11y-label="View options">
    <shadcn-menubar-item id="bookmarks-item" value="bookmarks">Always Show Bookmarks Bar</shadcn-menubar-item>
    <shadcn-menubar-item id="urls-item" value="urls">✓ Always Show Full URLs</shadcn-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
    <shadcn-menubar-item id="reload-item" value="reload">Reload</shadcn-menubar-item>
    <shadcn-menubar-item id="force-item" value="force-reload">Force Reload</shadcn-menubar-item>
  </shadcn-menubar-content>
  <shadcn-menubar-trigger id="admin-trigger" value="admin">Admin</shadcn-menubar-trigger>
  <shadcn-menubar-content value="admin" a11y-label="Admin options">
    <shadcn-menubar-item value="audit">Audit log</shadcn-menubar-item>
  </shadcn-menubar-content>
</shadcn-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#menubar-states'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#bookmarks-item'), { closeOnSelect: false });
  setElementProps(document.querySelector('#urls-item'), { closeOnSelect: false });
  setElementProps(document.querySelector('#reload-item'), { inset: true });
  setElementProps(document.querySelector('#force-item'), { inset: true, disabled: true });
  setElementProps(document.querySelector('#admin-trigger'), { disabled: true });
</script>
    `),
    'demo-shadcn-menubar-controlled': formatCode(`
<shadcn-menubar-root id="menubar-controlled" a11y-label="Workspace settings">
  <shadcn-menubar-trigger value="profiles">Profiles</shadcn-menubar-trigger>
  <shadcn-menubar-content value="profiles" a11y-label="Switch profile">
    <shadcn-menubar-item value="Andy">Andy</shadcn-menubar-item>
    <shadcn-menubar-item value="Benoit">Benoit</shadcn-menubar-item>
    <shadcn-menubar-item value="Luis">Luis</shadcn-menubar-item>
  </shadcn-menubar-content>
  <shadcn-menubar-trigger value="theme">Theme</shadcn-menubar-trigger>
  <shadcn-menubar-content value="theme" a11y-label="Choose theme">
    <shadcn-menubar-item value="Light">Light</shadcn-menubar-item>
    <shadcn-menubar-item value="Dark">Dark</shadcn-menubar-item>
    <shadcn-menubar-item value="System">System</shadcn-menubar-item>
  </shadcn-menubar-content>
</shadcn-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#menubar-controlled');
  setElementProps(root, { styleProfile: 'rhea', value: '', loop: false });
  root.addEventListener('valueChange', (event) => {
    setElementProps(root, { value: event.detail.value });
  });
</script>
    `),
    'demo-shadcn-menubar-profiles': formatCode(`
<div class="grid gap-4 sm:grid-cols-2">
  <shadcn-menubar-root data-profile="rhea">...</shadcn-menubar-root>
  <shadcn-menubar-root data-profile="new-york-v4">...</shadcn-menubar-root>
  <shadcn-menubar-root data-profile="nova">...</shadcn-menubar-root>
  <shadcn-menubar-root data-profile="maia">...</shadcn-menubar-root>
  <shadcn-menubar-root data-profile="lyra">...</shadcn-menubar-root>
  <shadcn-menubar-root data-profile="mira">...</shadcn-menubar-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  document.querySelectorAll('shadcn-menubar-root[data-profile]').forEach((el) => {
    setElementProps(el, { styleProfile: el.dataset.profile });
  });
</script>
    `),
    'demo-brutalist-menubar': formatCode(`
<brutalist-menubar-root a11y-label="Workspace menu">
  <brutalist-menubar-trigger value="file">File</brutalist-menubar-trigger>
  <brutalist-menubar-content value="file" a11y-label="File menu">
    <brutalist-menubar-item value="new-tab">New Tab</brutalist-menubar-item>
    <brutalist-menubar-item value="new-window">New Window</brutalist-menubar-item>
    <brutalist-menubar-item value="incognito" disabled>New Incognito Window</brutalist-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-0.5 bg-black"></div>
    <brutalist-menubar-item value="print">Print...</brutalist-menubar-item>
  </brutalist-menubar-content>

  <brutalist-menubar-trigger value="edit">Edit</brutalist-menubar-trigger>
  <brutalist-menubar-content value="edit" a11y-label="Edit menu">
    <brutalist-menubar-item value="undo">Undo</brutalist-menubar-item>
    <brutalist-menubar-item value="redo">Redo</brutalist-menubar-item>
  </brutalist-menubar-content>

  <brutalist-menubar-trigger value="view">View</brutalist-menubar-trigger>
  <brutalist-menubar-content value="view" a11y-label="View menu">
    <brutalist-menubar-item value="reload" inset>Reload</brutalist-menubar-item>
    <brutalist-menubar-item value="fullscreen" inset>Toggle Fullscreen</brutalist-menubar-item>
  </brutalist-menubar-content>

  <brutalist-menubar-trigger value="profiles">Profiles</brutalist-menubar-trigger>
  <brutalist-menubar-content value="profiles" a11y-label="Profiles menu">
    <brutalist-menubar-item value="andy">Andy</brutalist-menubar-item>
    <brutalist-menubar-item value="benoit">Benoit</brutalist-menubar-item>
    <brutalist-menubar-item value="luis">Luis</brutalist-menubar-item>
  </brutalist-menubar-content>
</brutalist-menubar-root>
    `),
    'demo-brutalist-menubar-destructive': formatCode(`
<brutalist-menubar-root a11y-label="Document actions">
  <brutalist-menubar-trigger value="file">File</brutalist-menubar-trigger>
  <brutalist-menubar-content value="file" a11y-label="File actions">
    <brutalist-menubar-item value="new-file">New File</brutalist-menubar-item>
    <brutalist-menubar-item value="save">Save</brutalist-menubar-item>
  </brutalist-menubar-content>
  <brutalist-menubar-trigger value="more">More</brutalist-menubar-trigger>
  <brutalist-menubar-content value="more" a11y-label="More actions">
    <brutalist-menubar-item value="settings">Settings</brutalist-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-0.5 bg-black"></div>
    <brutalist-menubar-item id="brutalist-delete" value="delete">Delete</brutalist-menubar-item>
  </brutalist-menubar-content>
</brutalist-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#brutalist-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-brutalist-menubar-states': formatCode(`
<brutalist-menubar-root a11y-label="View preferences">
  <brutalist-menubar-trigger value="view">View</brutalist-menubar-trigger>
  <brutalist-menubar-content value="view" a11y-label="View options">
    <brutalist-menubar-item id="b-bookmarks" value="bookmarks">Always Show Bookmarks Bar</brutalist-menubar-item>
    <brutalist-menubar-item id="b-urls" value="urls">✓ Always Show Full URLs</brutalist-menubar-item>
    <div role="separator" class="-mx-1 my-1 h-0.5 bg-black"></div>
    <brutalist-menubar-item id="b-reload" value="reload">Reload</brutalist-menubar-item>
    <brutalist-menubar-item id="b-force" value="force-reload">Force Reload</brutalist-menubar-item>
  </brutalist-menubar-content>
  <brutalist-menubar-trigger id="b-admin" value="admin">Admin</brutalist-menubar-trigger>
  <brutalist-menubar-content value="admin" a11y-label="Admin options">
    <brutalist-menubar-item value="audit">Audit log</brutalist-menubar-item>
  </brutalist-menubar-content>
</brutalist-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#b-bookmarks'), { closeOnSelect: false });
  setElementProps(document.querySelector('#b-urls'), { closeOnSelect: false });
  setElementProps(document.querySelector('#b-reload'), { inset: true });
  setElementProps(document.querySelector('#b-force'), { inset: true, disabled: true });
  setElementProps(document.querySelector('#b-admin'), { disabled: true });
</script>
    `),
    'demo-brutalist-menubar-controlled': formatCode(`
<brutalist-menubar-root id="brutalist-controlled" a11y-label="Workspace settings">
  <brutalist-menubar-trigger value="profiles">Profiles</brutalist-menubar-trigger>
  <brutalist-menubar-content value="profiles" a11y-label="Switch profile">
    <brutalist-menubar-item value="Andy">Andy</brutalist-menubar-item>
    <brutalist-menubar-item value="Benoit">Benoit</brutalist-menubar-item>
    <brutalist-menubar-item value="Luis">Luis</brutalist-menubar-item>
  </brutalist-menubar-content>
  <brutalist-menubar-trigger value="theme">Theme</brutalist-menubar-trigger>
  <brutalist-menubar-content value="theme" a11y-label="Choose theme">
    <brutalist-menubar-item value="Light">Light</brutalist-menubar-item>
    <brutalist-menubar-item value="Dark">Dark</brutalist-menubar-item>
    <brutalist-menubar-item value="System">System</brutalist-menubar-item>
  </brutalist-menubar-content>
</brutalist-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#brutalist-controlled');
  setElementProps(root, { value: '', loop: false });
  root.addEventListener('valueChange', (event) => {
    setElementProps(root, { value: event.detail.value });
  });
</script>
    `),
    'demo-bootstrap-2-3-2-menubar': formatCode(`
<bootstrap-2-3-2-menubar-root a11y-label="Application menu">
  <bootstrap-2-3-2-menubar-trigger value="file">File</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="file" a11y-label="File menu">
    <bootstrap-2-3-2-menubar-item value="new-tab">New Tab</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="new-window">New Window</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="incognito" disabled>New Incognito Window</bootstrap-2-3-2-menubar-item>
    <div role="separator" class="my-1 h-px bg-border"></div>
    <bootstrap-2-3-2-menubar-item value="print">Print...</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>

  <bootstrap-2-3-2-menubar-trigger value="edit">Edit</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="edit" a11y-label="Edit menu">
    <bootstrap-2-3-2-menubar-item value="undo">Undo</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="redo">Redo</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>

  <bootstrap-2-3-2-menubar-trigger value="view">View</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="view" a11y-label="View menu">
    <bootstrap-2-3-2-menubar-item value="reload" inset>Reload</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="fullscreen" inset>Toggle Fullscreen</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>

  <bootstrap-2-3-2-menubar-trigger value="profiles">Profiles</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="profiles" a11y-label="Profiles menu">
    <bootstrap-2-3-2-menubar-item value="andy">Andy</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="benoit">Benoit</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
</bootstrap-2-3-2-menubar-root>
    `),
    'demo-bootstrap-2-3-2-menubar-destructive': formatCode(`
<bootstrap-2-3-2-menubar-root a11y-label="Document actions">
  <bootstrap-2-3-2-menubar-trigger value="file">File</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="file" a11y-label="File actions">
    <bootstrap-2-3-2-menubar-item value="new-file">New File</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="save">Save</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
  <bootstrap-2-3-2-menubar-trigger value="more">More</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="more" a11y-label="More actions">
    <bootstrap-2-3-2-menubar-item value="settings">Settings</bootstrap-2-3-2-menubar-item>
    <div role="separator" class="my-1 h-px bg-border"></div>
    <bootstrap-2-3-2-menubar-item id="bs-delete" value="delete">Delete</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
</bootstrap-2-3-2-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-bootstrap-2-3-2-menubar-states': formatCode(`
<bootstrap-2-3-2-menubar-root a11y-label="View preferences">
  <bootstrap-2-3-2-menubar-trigger value="view">View</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="view" a11y-label="View options">
    <bootstrap-2-3-2-menubar-item id="bs-bookmarks" value="bookmarks">Always Show Bookmarks Bar</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item id="bs-urls" value="urls">✓ Always Show Full URLs</bootstrap-2-3-2-menubar-item>
    <div role="separator" class="my-1 h-px bg-border"></div>
    <bootstrap-2-3-2-menubar-item id="bs-reload" value="reload">Reload</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item id="bs-force" value="force-reload">Force Reload</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
  <bootstrap-2-3-2-menubar-trigger id="bs-admin" value="admin">Admin</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="admin" a11y-label="Admin options">
    <bootstrap-2-3-2-menubar-item value="audit">Audit log</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
</bootstrap-2-3-2-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#bs-bookmarks'), { closeOnSelect: false });
  setElementProps(document.querySelector('#bs-urls'), { closeOnSelect: false });
  setElementProps(document.querySelector('#bs-reload'), { inset: true });
  setElementProps(document.querySelector('#bs-force'), { inset: true, disabled: true });
  setElementProps(document.querySelector('#bs-admin'), { disabled: true });
</script>
    `),
    'demo-bootstrap-2-3-2-menubar-controlled': formatCode(`
<bootstrap-2-3-2-menubar-root id="bs-controlled" a11y-label="Workspace settings">
  <bootstrap-2-3-2-menubar-trigger value="profiles">Profiles</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="profiles" a11y-label="Switch profile">
    <bootstrap-2-3-2-menubar-item value="Andy">Andy</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="Benoit">Benoit</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="Luis">Luis</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
  <bootstrap-2-3-2-menubar-trigger value="theme">Theme</bootstrap-2-3-2-menubar-trigger>
  <bootstrap-2-3-2-menubar-content value="theme" a11y-label="Choose theme">
    <bootstrap-2-3-2-menubar-item value="Light">Light</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="Dark">Dark</bootstrap-2-3-2-menubar-item>
    <bootstrap-2-3-2-menubar-item value="System">System</bootstrap-2-3-2-menubar-item>
  </bootstrap-2-3-2-menubar-content>
</bootstrap-2-3-2-menubar-root>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  const root = document.querySelector('#bs-controlled');
  setElementProps(root, { value: '', loop: false });
  root.addEventListener('valueChange', (event) => {
    setElementProps(root, { value: event.detail.value });
  });
</script>
    `),
    'demo-liquid-glass-menubar': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-menubar-root a11y-label="Workspace menu">
    <liquid-glass-menubar-trigger value="file">File</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="file" a11y-label="File menu">
      <liquid-glass-menubar-item value="new-tab">New Tab</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="new-window">New Window</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="incognito" disabled>New Private Window</liquid-glass-menubar-item>
      <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
      <liquid-glass-menubar-item value="print">Print...</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>

    <liquid-glass-menubar-trigger value="edit">Edit</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="edit" a11y-label="Edit menu">
      <liquid-glass-menubar-item value="undo">Undo</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="redo">Redo</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>

    <liquid-glass-menubar-trigger value="view">View</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="view" a11y-label="View menu">
      <liquid-glass-menubar-item value="reload" inset>Reload</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="fullscreen" inset>Enter Full Screen</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
  </liquid-glass-menubar-root>
</div>
    `),
    'demo-liquid-glass-menubar-destructive': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-menubar-root a11y-label="Document actions">
    <liquid-glass-menubar-trigger value="file">File</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="file" a11y-label="File actions">
      <liquid-glass-menubar-item value="new-file">New File</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="save">Save</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
    <liquid-glass-menubar-trigger value="more">More</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="more" a11y-label="More actions">
      <liquid-glass-menubar-item value="settings">Settings</liquid-glass-menubar-item>
      <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
      <liquid-glass-menubar-item id="lg-delete" value="delete">Delete</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
  </liquid-glass-menubar-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-delete'), { variant: 'destructive' });
</script>
    `),
    'demo-liquid-glass-menubar-states': formatCode(`
<div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
  <liquid-glass-menubar-root a11y-label="View preferences">
    <liquid-glass-menubar-trigger value="view">View</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="view" a11y-label="View options">
      <liquid-glass-menubar-item id="lg-bookmarks" value="bookmarks">Always Show Bookmarks Bar</liquid-glass-menubar-item>
      <liquid-glass-menubar-item id="lg-urls" value="urls">✓ Always Show Full URLs</liquid-glass-menubar-item>
      <div role="separator" class="-mx-1 my-1 h-px bg-border"></div>
      <liquid-glass-menubar-item id="lg-reload" value="reload">Reload</liquid-glass-menubar-item>
      <liquid-glass-menubar-item id="lg-force" value="force-reload">Force Reload</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
    <liquid-glass-menubar-trigger id="lg-admin" value="admin">Admin</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content value="admin" a11y-label="Admin options">
      <liquid-glass-menubar-item value="audit">Audit log</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
  </liquid-glass-menubar-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-bookmarks'), { closeOnSelect: false });
  setElementProps(document.querySelector('#lg-urls'), { closeOnSelect: false });
  setElementProps(document.querySelector('#lg-reload'), { inset: true });
  setElementProps(document.querySelector('#lg-force'), { inset: true, disabled: true });
  setElementProps(document.querySelector('#lg-admin'), { disabled: true });
</script>
    `),
    'demo-liquid-glass-menubar-material': formatCode(`
<div class="grid gap-5 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-2">
  <liquid-glass-menubar-root a11y-label="Glass menu">
    <liquid-glass-menubar-trigger value="file">File</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content id="lg-auto" value="file">
      <liquid-glass-menubar-item value="new">New Window</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="share">Share</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
  </liquid-glass-menubar-root>

  <liquid-glass-menubar-root a11y-label="Opaque menu">
    <liquid-glass-menubar-trigger value="file">File</liquid-glass-menubar-trigger>
    <liquid-glass-menubar-content id="lg-opaque" value="file">
      <liquid-glass-menubar-item value="new">New Window</liquid-glass-menubar-item>
      <liquid-glass-menubar-item value="share">Share</liquid-glass-menubar-item>
    </liquid-glass-menubar-content>
  </liquid-glass-menubar-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#lg-auto'), { material: 'auto' });
  setElementProps(document.querySelector('#lg-opaque'), { material: 'opaque' });
</script>
    `),
  },
  react: {
    'demo-shadcn-menubar': formatCode(`
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/react';

export function MenubarDemo() {
  return (
    <ShadcnMenubarRoot styleProfile="rhea" a11yLabel="Project commands">
      <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="file" a11yLabel="File commands">
        <ShadcnMenubarItem value="new" textValue="New document">New document</ShadcnMenubarItem>
        <ShadcnMenubarItem value="open" textValue="Open document">Open document</ShadcnMenubarItem>
        <ShadcnMenubarItem value="incognito" disabled>New incognito window</ShadcnMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        <ShadcnMenubarItem value="print" textValue="Print">Print...</ShadcnMenubarItem>
      </ShadcnMenubarContent>

      <ShadcnMenubarTrigger value="edit">Edit</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="edit" a11yLabel="Edit commands">
        <ShadcnMenubarItem value="undo" textValue="Undo">Undo</ShadcnMenubarItem>
        <ShadcnMenubarItem value="redo" textValue="Redo">Redo</ShadcnMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        <ShadcnMenubarItem value="cut" textValue="Cut">Cut</ShadcnMenubarItem>
        <ShadcnMenubarItem value="copy" textValue="Copy">Copy</ShadcnMenubarItem>
        <ShadcnMenubarItem value="paste" textValue="Paste">Paste</ShadcnMenubarItem>
      </ShadcnMenubarContent>

      <ShadcnMenubarTrigger value="view">View</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="view" a11yLabel="View commands">
        <ShadcnMenubarItem value="reload" inset>Reload</ShadcnMenubarItem>
        <ShadcnMenubarItem value="force-reload" inset disabled>Force Reload</ShadcnMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        <ShadcnMenubarItem value="fullscreen" inset>Toggle Fullscreen</ShadcnMenubarItem>
        <ShadcnMenubarItem value="sidebar" inset>Hide Sidebar</ShadcnMenubarItem>
      </ShadcnMenubarContent>

      <ShadcnMenubarTrigger value="profiles">Profiles</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="profiles" a11yLabel="Profile commands">
        <ShadcnMenubarItem value="andy">Andy</ShadcnMenubarItem>
        <ShadcnMenubarItem value="benoit">Benoit</ShadcnMenubarItem>
        <ShadcnMenubarItem value="luis">Luis</ShadcnMenubarItem>
      </ShadcnMenubarContent>
    </ShadcnMenubarRoot>
  );
}
    `),
    'demo-shadcn-menubar-destructive': formatCode(`
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/react';

export function MenubarDestructiveDemo() {
  return (
    <ShadcnMenubarRoot styleProfile="rhea" a11yLabel="Document actions">
      <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="file" a11yLabel="File actions">
        <ShadcnMenubarItem value="new-file">New File</ShadcnMenubarItem>
        <ShadcnMenubarItem value="open-folder">Open Folder</ShadcnMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        <ShadcnMenubarItem value="save">Save</ShadcnMenubarItem>
      </ShadcnMenubarContent>

      <ShadcnMenubarTrigger value="more">More</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="more" a11yLabel="More actions">
        <ShadcnMenubarItem value="settings">Settings</ShadcnMenubarItem>
        <ShadcnMenubarItem value="help">Help</ShadcnMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        <ShadcnMenubarItem value="delete" variant="destructive">Delete</ShadcnMenubarItem>
      </ShadcnMenubarContent>
    </ShadcnMenubarRoot>
  );
}
    `),
    'demo-shadcn-menubar-states': formatCode(`
import { useState } from 'react';
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/react';

export function MenubarStatesDemo() {
  const [bookmarks, setBookmarks] = useState(false);
  const [urls, setUrls] = useState(true);

  return (
    <ShadcnMenubarRoot styleProfile="rhea" a11yLabel="View preferences">
      <ShadcnMenubarTrigger value="view">View</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="view" a11yLabel="View options">
        <ShadcnMenubarItem value="bookmarks" closeOnSelect={false} onSelect={() => setBookmarks((v) => !v)}>
          <span className="inline-block w-4 text-center" aria-hidden="true">{bookmarks ? '✓' : ''}</span>
          Always Show Bookmarks Bar
        </ShadcnMenubarItem>
        <ShadcnMenubarItem value="urls" closeOnSelect={false} onSelect={() => setUrls((v) => !v)}>
          <span className="inline-block w-4 text-center" aria-hidden="true">{urls ? '✓' : ''}</span>
          Always Show Full URLs
        </ShadcnMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        <ShadcnMenubarItem value="reload" inset>Reload</ShadcnMenubarItem>
        <ShadcnMenubarItem value="force-reload" inset disabled>Force Reload</ShadcnMenubarItem>
      </ShadcnMenubarContent>
      <ShadcnMenubarTrigger value="admin" disabled>Admin</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="admin" a11yLabel="Admin options">
        <ShadcnMenubarItem value="audit">Audit log</ShadcnMenubarItem>
      </ShadcnMenubarContent>
    </ShadcnMenubarRoot>
  );
}
    `),
    'demo-shadcn-menubar-controlled': formatCode(`
import { useState } from 'react';
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/react';

export function MenubarControlledDemo() {
  const [openMenu, setOpenMenu] = useState('');
  const [profile, setProfile] = useState('Benoit');
  const [theme, setTheme] = useState('System');

  return (
    <div className="grid justify-items-start gap-3">
      <ShadcnMenubarRoot
        styleProfile="rhea"
        value={openMenu}
        loop={false}
        onValueChange={(detail) => setOpenMenu(detail.value)}
        a11yLabel="Workspace settings"
      >
        <ShadcnMenubarTrigger value="profiles">Profiles</ShadcnMenubarTrigger>
        <ShadcnMenubarContent value="profiles" a11yLabel="Switch profile">
          <ShadcnMenubarItem value="Andy" onSelect={() => setProfile('Andy')}>Andy</ShadcnMenubarItem>
          <ShadcnMenubarItem value="Benoit" onSelect={() => setProfile('Benoit')}>Benoit</ShadcnMenubarItem>
          <ShadcnMenubarItem value="Luis" onSelect={() => setProfile('Luis')}>Luis</ShadcnMenubarItem>
        </ShadcnMenubarContent>

        <ShadcnMenubarTrigger value="theme">Theme</ShadcnMenubarTrigger>
        <ShadcnMenubarContent value="theme" a11yLabel="Choose theme">
          <ShadcnMenubarItem value="Light" onSelect={() => setTheme('Light')}>Light</ShadcnMenubarItem>
          <ShadcnMenubarItem value="Dark" onSelect={() => setTheme('Dark')}>Dark</ShadcnMenubarItem>
          <ShadcnMenubarItem value="System" onSelect={() => setTheme('System')}>System</ShadcnMenubarItem>
        </ShadcnMenubarContent>
      </ShadcnMenubarRoot>
      <p className="text-xs text-muted-foreground">
        Profile: {profile} · Theme: {theme} · Open: {openMenu || 'none'}
      </p>
    </div>
  );
}
    `),
    'demo-shadcn-menubar-profiles': formatCode(`
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/react';

const profiles = ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'mira'] as const;

export function MenubarProfilesDemo() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {profiles.map((profile) => (
        <ShadcnMenubarRoot key={profile} styleProfile={profile} a11yLabel={\`\${profile} menubar\`}>
          <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
          <ShadcnMenubarContent value="file">
            <ShadcnMenubarItem value="new">New File</ShadcnMenubarItem>
            <ShadcnMenubarItem value="save">Save</ShadcnMenubarItem>
          </ShadcnMenubarContent>
          <ShadcnMenubarTrigger value="edit">Edit</ShadcnMenubarTrigger>
          <ShadcnMenubarContent value="edit">
            <ShadcnMenubarItem value="undo">Undo</ShadcnMenubarItem>
            <ShadcnMenubarItem value="redo">Redo</ShadcnMenubarItem>
          </ShadcnMenubarContent>
        </ShadcnMenubarRoot>
      ))}
    </div>
  );
}
    `),
    'demo-brutalist-menubar': formatCode(`
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/react';

export function BrutalistMenubarDemo() {
  return (
    <BrutalistMenubarRoot a11yLabel="Workspace menu">
      <BrutalistMenubarTrigger value="file">File</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="file" a11yLabel="File menu">
        <BrutalistMenubarItem value="new-tab">New Tab</BrutalistMenubarItem>
        <BrutalistMenubarItem value="new-window">New Window</BrutalistMenubarItem>
        <BrutalistMenubarItem value="incognito" disabled>New Incognito Window</BrutalistMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-0.5 bg-black" />
        <BrutalistMenubarItem value="print">Print...</BrutalistMenubarItem>
      </BrutalistMenubarContent>

      <BrutalistMenubarTrigger value="edit">Edit</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="edit" a11yLabel="Edit menu">
        <BrutalistMenubarItem value="undo">Undo</BrutalistMenubarItem>
        <BrutalistMenubarItem value="redo">Redo</BrutalistMenubarItem>
      </BrutalistMenubarContent>

      <BrutalistMenubarTrigger value="view">View</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="view" a11yLabel="View menu">
        <BrutalistMenubarItem value="reload" inset>Reload</BrutalistMenubarItem>
        <BrutalistMenubarItem value="fullscreen" inset>Toggle Fullscreen</BrutalistMenubarItem>
      </BrutalistMenubarContent>

      <BrutalistMenubarTrigger value="profiles">Profiles</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="profiles" a11yLabel="Profiles menu">
        <BrutalistMenubarItem value="andy">Andy</BrutalistMenubarItem>
        <BrutalistMenubarItem value="benoit">Benoit</BrutalistMenubarItem>
        <BrutalistMenubarItem value="luis">Luis</BrutalistMenubarItem>
      </BrutalistMenubarContent>
    </BrutalistMenubarRoot>
  );
}
    `),
    'demo-brutalist-menubar-destructive': formatCode(`
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/react';

export function BrutalistMenubarDestructiveDemo() {
  return (
    <BrutalistMenubarRoot a11yLabel="Document actions">
      <BrutalistMenubarTrigger value="file">File</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="file" a11yLabel="File actions">
        <BrutalistMenubarItem value="new-file">New File</BrutalistMenubarItem>
        <BrutalistMenubarItem value="save">Save</BrutalistMenubarItem>
      </BrutalistMenubarContent>

      <BrutalistMenubarTrigger value="more">More</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="more" a11yLabel="More actions">
        <BrutalistMenubarItem value="settings">Settings</BrutalistMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-0.5 bg-black" />
        <BrutalistMenubarItem value="delete" variant="destructive">Delete</BrutalistMenubarItem>
      </BrutalistMenubarContent>
    </BrutalistMenubarRoot>
  );
}
    `),
    'demo-brutalist-menubar-states': formatCode(`
import { useState } from 'react';
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/react';

export function BrutalistMenubarStatesDemo() {
  const [bookmarks, setBookmarks] = useState(false);
  const [urls, setUrls] = useState(true);

  return (
    <BrutalistMenubarRoot a11yLabel="View preferences">
      <BrutalistMenubarTrigger value="view">View</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="view" a11yLabel="View options">
        <BrutalistMenubarItem value="bookmarks" closeOnSelect={false} onSelect={() => setBookmarks((v) => !v)}>
          {bookmarks ? '✓ ' : ''}Always Show Bookmarks Bar
        </BrutalistMenubarItem>
        <BrutalistMenubarItem value="urls" closeOnSelect={false} onSelect={() => setUrls((v) => !v)}>
          {urls ? '✓ ' : ''}Always Show Full URLs
        </BrutalistMenubarItem>
        <div role="separator" className="-mx-1 my-1 h-0.5 bg-black" />
        <BrutalistMenubarItem value="reload" inset>Reload</BrutalistMenubarItem>
        <BrutalistMenubarItem value="force-reload" inset disabled>Force Reload</BrutalistMenubarItem>
      </BrutalistMenubarContent>
      <BrutalistMenubarTrigger value="admin" disabled>Admin</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="admin">
        <BrutalistMenubarItem value="audit">Audit log</BrutalistMenubarItem>
      </BrutalistMenubarContent>
    </BrutalistMenubarRoot>
  );
}
    `),
    'demo-brutalist-menubar-controlled': formatCode(`
import { useState } from 'react';
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/react';

export function BrutalistMenubarControlledDemo() {
  const [openMenu, setOpenMenu] = useState('');
  return (
    <BrutalistMenubarRoot
      value={openMenu}
      loop={false}
      onValueChange={(detail) => setOpenMenu(detail.value)}
      a11yLabel="Workspace settings"
    >
      <BrutalistMenubarTrigger value="profiles">Profiles</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="profiles">
        <BrutalistMenubarItem value="Andy">Andy</BrutalistMenubarItem>
        <BrutalistMenubarItem value="Benoit">Benoit</BrutalistMenubarItem>
      </BrutalistMenubarContent>
      <BrutalistMenubarTrigger value="theme">Theme</BrutalistMenubarTrigger>
      <BrutalistMenubarContent value="theme">
        <BrutalistMenubarItem value="Light">Light</BrutalistMenubarItem>
        <BrutalistMenubarItem value="Dark">Dark</BrutalistMenubarItem>
      </BrutalistMenubarContent>
    </BrutalistMenubarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-menubar': formatCode(`
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/react';

export function BootstrapMenubarDemo() {
  return (
    <Bootstrap232MenubarRoot a11yLabel="Application menu">
      <Bootstrap232MenubarTrigger value="file">File</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="file" a11yLabel="File menu">
        <Bootstrap232MenubarItem value="new-tab">New Tab</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="new-window">New Window</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="incognito" disabled>New Incognito Window</Bootstrap232MenubarItem>
        <div role="separator" className="my-1 h-px bg-border" />
        <Bootstrap232MenubarItem value="print">Print...</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>

      <Bootstrap232MenubarTrigger value="edit">Edit</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="edit" a11yLabel="Edit menu">
        <Bootstrap232MenubarItem value="undo">Undo</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="redo">Redo</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>

      <Bootstrap232MenubarTrigger value="view">View</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="view" a11yLabel="View menu">
        <Bootstrap232MenubarItem value="reload" inset>Reload</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="fullscreen" inset>Toggle Fullscreen</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
    </Bootstrap232MenubarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-menubar-destructive': formatCode(`
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/react';

export function BootstrapMenubarDestructiveDemo() {
  return (
    <Bootstrap232MenubarRoot a11yLabel="Document actions">
      <Bootstrap232MenubarTrigger value="file">File</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="file">
        <Bootstrap232MenubarItem value="new-file">New File</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="save">Save</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
      <Bootstrap232MenubarTrigger value="more">More</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="more">
        <Bootstrap232MenubarItem value="settings">Settings</Bootstrap232MenubarItem>
        <div role="separator" className="my-1 h-px bg-border" />
        <Bootstrap232MenubarItem value="delete" variant="destructive">Delete</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
    </Bootstrap232MenubarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-menubar-states': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/react';

export function BootstrapMenubarStatesDemo() {
  const [bookmarks, setBookmarks] = useState(false);
  const [urls, setUrls] = useState(true);

  return (
    <Bootstrap232MenubarRoot a11yLabel="View preferences">
      <Bootstrap232MenubarTrigger value="view">View</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="view">
        <Bootstrap232MenubarItem value="bookmarks" closeOnSelect={false} onSelect={() => setBookmarks((v) => !v)}>
          {bookmarks ? '✓ ' : ''}Always Show Bookmarks Bar
        </Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="urls" closeOnSelect={false} onSelect={() => setUrls((v) => !v)}>
          {urls ? '✓ ' : ''}Always Show Full URLs
        </Bootstrap232MenubarItem>
        <div role="separator" className="my-1 h-px bg-border" />
        <Bootstrap232MenubarItem value="reload" inset>Reload</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="force-reload" inset disabled>Force Reload</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
      <Bootstrap232MenubarTrigger value="admin" disabled>Admin</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="admin">
        <Bootstrap232MenubarItem value="audit">Audit log</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
    </Bootstrap232MenubarRoot>
  );
}
    `),
    'demo-bootstrap-2-3-2-menubar-controlled': formatCode(`
import { useState } from 'react';
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/react';

export function BootstrapMenubarControlledDemo() {
  const [openMenu, setOpenMenu] = useState('');
  return (
    <Bootstrap232MenubarRoot
      value={openMenu}
      loop={false}
      onValueChange={(detail) => setOpenMenu(detail.value)}
      a11yLabel="Workspace settings"
    >
      <Bootstrap232MenubarTrigger value="profiles">Profiles</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="profiles">
        <Bootstrap232MenubarItem value="Andy">Andy</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="Benoit">Benoit</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
      <Bootstrap232MenubarTrigger value="theme">Theme</Bootstrap232MenubarTrigger>
      <Bootstrap232MenubarContent value="theme">
        <Bootstrap232MenubarItem value="Light">Light</Bootstrap232MenubarItem>
        <Bootstrap232MenubarItem value="Dark">Dark</Bootstrap232MenubarItem>
      </Bootstrap232MenubarContent>
    </Bootstrap232MenubarRoot>
  );
}
    `),
    'demo-liquid-glass-menubar': formatCode(`
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/react';

export function LiquidGlassMenubarDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassMenubarRoot a11yLabel="Workspace menu">
        <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="file" a11yLabel="File menu">
          <LiquidGlassMenubarItem value="new-tab">New Tab</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="new-window">New Window</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="incognito" disabled>New Private Window</LiquidGlassMenubarItem>
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
          <LiquidGlassMenubarItem value="print">Print...</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>

        <LiquidGlassMenubarTrigger value="edit">Edit</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="edit" a11yLabel="Edit menu">
          <LiquidGlassMenubarItem value="undo">Undo</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="redo">Redo</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>

        <LiquidGlassMenubarTrigger value="view">View</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="view" a11yLabel="View menu">
          <LiquidGlassMenubarItem value="reload" inset>Reload</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="fullscreen" inset>Enter Full Screen</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
      </LiquidGlassMenubarRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-menubar-destructive': formatCode(`
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/react';

export function LiquidGlassMenubarDestructiveDemo() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassMenubarRoot a11yLabel="Document actions">
        <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="file">
          <LiquidGlassMenubarItem value="new-file">New File</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="save">Save</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
        <LiquidGlassMenubarTrigger value="more">More</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="more">
          <LiquidGlassMenubarItem value="settings">Settings</LiquidGlassMenubarItem>
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
          <LiquidGlassMenubarItem value="delete" variant="destructive">Delete</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
      </LiquidGlassMenubarRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-menubar-states': formatCode(`
import { useState } from 'react';
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/react';

export function LiquidGlassMenubarStatesDemo() {
  const [bookmarks, setBookmarks] = useState(false);
  const [urls, setUrls] = useState(true);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
      <LiquidGlassMenubarRoot a11yLabel="View preferences">
        <LiquidGlassMenubarTrigger value="view">View</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="view">
          <LiquidGlassMenubarItem value="bookmarks" closeOnSelect={false} onSelect={() => setBookmarks((v) => !v)}>
            {bookmarks ? '✓ ' : ''}Always Show Bookmarks Bar
          </LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="urls" closeOnSelect={false} onSelect={() => setUrls((v) => !v)}>
            {urls ? '✓ ' : ''}Always Show Full URLs
          </LiquidGlassMenubarItem>
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
          <LiquidGlassMenubarItem value="reload" inset>Reload</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="force-reload" inset disabled>Force Reload</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
        <LiquidGlassMenubarTrigger value="admin" disabled>Admin</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="admin">
          <LiquidGlassMenubarItem value="audit">Audit log</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
      </LiquidGlassMenubarRoot>
    </div>
  );
}
    `),
    'demo-liquid-glass-menubar-material': formatCode(`
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/react';

export function LiquidGlassMenubarMaterialDemo() {
  return (
    <div className="grid gap-5 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-2">
      <LiquidGlassMenubarRoot a11yLabel="Glass menu">
        <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="file" material="auto">
          <LiquidGlassMenubarItem value="new">New Window</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="share">Share</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
      </LiquidGlassMenubarRoot>

      <LiquidGlassMenubarRoot a11yLabel="Opaque menu">
        <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
        <LiquidGlassMenubarContent value="file" material="opaque">
          <LiquidGlassMenubarItem value="new">New Window</LiquidGlassMenubarItem>
          <LiquidGlassMenubarItem value="share">Share</LiquidGlassMenubarItem>
        </LiquidGlassMenubarContent>
      </LiquidGlassMenubarRoot>
    </div>
  );
}
    `),
  },
  vue: {
    'demo-shadcn-menubar': formatCode(`
<script setup lang="ts">
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnMenubarRoot style-profile="rhea" a11y-label="Project commands">
    <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="file" a11y-label="File commands">
      <ShadcnMenubarItem value="new" text-value="New document">New document</ShadcnMenubarItem>
      <ShadcnMenubarItem value="open" text-value="Open document">Open document</ShadcnMenubarItem>
      <ShadcnMenubarItem value="incognito" :disabled="true">New incognito window</ShadcnMenubarItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border" />
      <ShadcnMenubarItem value="print" text-value="Print">Print...</ShadcnMenubarItem>
    </ShadcnMenubarContent>

    <ShadcnMenubarTrigger value="edit">Edit</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="edit" a11y-label="Edit commands">
      <ShadcnMenubarItem value="undo" text-value="Undo">Undo</ShadcnMenubarItem>
      <ShadcnMenubarItem value="redo" text-value="Redo">Redo</ShadcnMenubarItem>
    </ShadcnMenubarContent>

    <ShadcnMenubarTrigger value="view">View</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="view" a11y-label="View commands">
      <ShadcnMenubarItem value="reload" :inset="true">Reload</ShadcnMenubarItem>
      <ShadcnMenubarItem value="fullscreen" :inset="true">Toggle Fullscreen</ShadcnMenubarItem>
    </ShadcnMenubarContent>

    <ShadcnMenubarTrigger value="profiles">Profiles</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="profiles" a11y-label="Profile commands">
      <ShadcnMenubarItem value="andy">Andy</ShadcnMenubarItem>
      <ShadcnMenubarItem value="benoit">Benoit</ShadcnMenubarItem>
      <ShadcnMenubarItem value="luis">Luis</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>
    `),
    'demo-shadcn-menubar-destructive': formatCode(`
<script setup lang="ts">
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <ShadcnMenubarRoot style-profile="rhea" a11y-label="Document actions">
    <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="file">
      <ShadcnMenubarItem value="new-file">New File</ShadcnMenubarItem>
      <ShadcnMenubarItem value="save">Save</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="more">More</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="more">
      <ShadcnMenubarItem value="settings">Settings</ShadcnMenubarItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border" />
      <ShadcnMenubarItem value="delete" variant="destructive">Delete</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>
    `),
    'demo-shadcn-menubar-states': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue';

const bookmarks = ref(false);
const urls = ref(true);
</script>

<template>
  <ShadcnMenubarRoot style-profile="rhea" a11y-label="View preferences">
    <ShadcnMenubarTrigger value="view">View</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="view">
      <ShadcnMenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
        {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
      </ShadcnMenubarItem>
      <ShadcnMenubarItem value="urls" :close-on-select="false" @select="urls = !urls">
        {{ urls ? '✓ ' : '' }}Always Show Full URLs
      </ShadcnMenubarItem>
      <div role="separator" class="-mx-1 my-1 h-px bg-border" />
      <ShadcnMenubarItem value="reload" :inset="true">Reload</ShadcnMenubarItem>
      <ShadcnMenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="admin" :disabled="true">Admin</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="admin">
      <ShadcnMenubarItem value="audit">Audit log</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>
    `),
    'demo-shadcn-menubar-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue';

const openMenu = ref('');
</script>

<template>
  <ShadcnMenubarRoot
    style-profile="rhea"
    :value="openMenu"
    :loop="false"
    @value-change="(detail) => (openMenu = detail.value)"
  >
    <ShadcnMenubarTrigger value="profiles">Profiles</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="profiles">
      <ShadcnMenubarItem value="Andy">Andy</ShadcnMenubarItem>
      <ShadcnMenubarItem value="Benoit">Benoit</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="theme">Theme</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="theme">
      <ShadcnMenubarItem value="Light">Light</ShadcnMenubarItem>
      <ShadcnMenubarItem value="Dark">Dark</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>
    `),
    'demo-shadcn-menubar-profiles': formatCode(`
<script setup lang="ts">
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue';

const profiles = ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'mira'] as const;
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <ShadcnMenubarRoot v-for="profile in profiles" :key="profile" :style-profile="profile">
      <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="file">
        <ShadcnMenubarItem value="new">New File</ShadcnMenubarItem>
        <ShadcnMenubarItem value="save">Save</ShadcnMenubarItem>
      </ShadcnMenubarContent>
    </ShadcnMenubarRoot>
  </div>
</template>
    `),
    'demo-brutalist-menubar': formatCode(`
<script setup lang="ts">
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistMenubarRoot a11y-label="Workspace menu">
    <BrutalistMenubarTrigger value="file">File</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="file">
      <BrutalistMenubarItem value="new-tab">New Tab</BrutalistMenubarItem>
      <BrutalistMenubarItem value="new-window">New Window</BrutalistMenubarItem>
      <BrutalistMenubarItem value="incognito" :disabled="true">New Incognito Window</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="edit">Edit</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="edit">
      <BrutalistMenubarItem value="undo">Undo</BrutalistMenubarItem>
      <BrutalistMenubarItem value="redo">Redo</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="view">View</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="view">
      <BrutalistMenubarItem value="reload" :inset="true">Reload</BrutalistMenubarItem>
      <BrutalistMenubarItem value="fullscreen" :inset="true">Toggle Fullscreen</BrutalistMenubarItem>
    </BrutalistMenubarContent>
  </BrutalistMenubarRoot>
</template>
    `),
    'demo-brutalist-menubar-destructive': formatCode(`
<script setup lang="ts">
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <BrutalistMenubarRoot a11y-label="Document actions">
    <BrutalistMenubarTrigger value="file">File</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="file">
      <BrutalistMenubarItem value="new-file">New File</BrutalistMenubarItem>
      <BrutalistMenubarItem value="save">Save</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="more">More</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="more">
      <BrutalistMenubarItem value="settings">Settings</BrutalistMenubarItem>
      <div role="separator" class="-mx-1 my-1 h-0.5 bg-black" />
      <BrutalistMenubarItem value="delete" variant="destructive">Delete</BrutalistMenubarItem>
    </BrutalistMenubarContent>
  </BrutalistMenubarRoot>
</template>
    `),
    'demo-brutalist-menubar-states': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue';

const bookmarks = ref(false);
const urls = ref(true);
</script>

<template>
  <BrutalistMenubarRoot a11y-label="View preferences">
    <BrutalistMenubarTrigger value="view">View</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="view">
      <BrutalistMenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
        {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
      </BrutalistMenubarItem>
      <BrutalistMenubarItem value="urls" :close-on-select="false" @select="urls = !urls">
        {{ urls ? '✓ ' : '' }}Always Show Full URLs
      </BrutalistMenubarItem>
      <BrutalistMenubarItem value="reload" :inset="true">Reload</BrutalistMenubarItem>
      <BrutalistMenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="admin" :disabled="true">Admin</BrutalistMenubarTrigger>
  </BrutalistMenubarRoot>
</template>
    `),
    'demo-brutalist-menubar-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue';

const openMenu = ref('');
</script>

<template>
  <BrutalistMenubarRoot :value="openMenu" :loop="false" @value-change="(d) => (openMenu = d.value)">
    <BrutalistMenubarTrigger value="profiles">Profiles</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="profiles">
      <BrutalistMenubarItem value="Andy">Andy</BrutalistMenubarItem>
      <BrutalistMenubarItem value="Benoit">Benoit</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="theme">Theme</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="theme">
      <BrutalistMenubarItem value="Light">Light</BrutalistMenubarItem>
      <BrutalistMenubarItem value="Dark">Dark</BrutalistMenubarItem>
    </BrutalistMenubarContent>
  </BrutalistMenubarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-menubar': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232MenubarRoot a11y-label="Application menu">
    <Bootstrap232MenubarTrigger value="file">File</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="file">
      <Bootstrap232MenubarItem value="new-tab">New Tab</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="new-window">New Window</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="incognito" :disabled="true">New Incognito Window</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="edit">Edit</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="edit">
      <Bootstrap232MenubarItem value="undo">Undo</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="redo">Redo</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
  </Bootstrap232MenubarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-menubar-destructive': formatCode(`
<script setup lang="ts">
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <Bootstrap232MenubarRoot a11y-label="Document actions">
    <Bootstrap232MenubarTrigger value="file">File</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="file">
      <Bootstrap232MenubarItem value="new-file">New File</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="save">Save</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="more">More</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="more">
      <Bootstrap232MenubarItem value="settings">Settings</Bootstrap232MenubarItem>
      <div role="separator" class="my-1 h-px bg-border" />
      <Bootstrap232MenubarItem value="delete" variant="destructive">Delete</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
  </Bootstrap232MenubarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-menubar-states': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue';

const bookmarks = ref(false);
const urls = ref(true);
</script>

<template>
  <Bootstrap232MenubarRoot a11y-label="View preferences">
    <Bootstrap232MenubarTrigger value="view">View</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="view">
      <Bootstrap232MenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
        {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
      </Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="urls" :close-on-select="false" @select="urls = !urls">
        {{ urls ? '✓ ' : '' }}Always Show Full URLs
      </Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="reload" :inset="true">Reload</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="admin" :disabled="true">Admin</Bootstrap232MenubarTrigger>
  </Bootstrap232MenubarRoot>
</template>
    `),
    'demo-bootstrap-2-3-2-menubar-controlled': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue';

const openMenu = ref('');
</script>

<template>
  <Bootstrap232MenubarRoot :value="openMenu" :loop="false" @value-change="(d) => (openMenu = d.value)">
    <Bootstrap232MenubarTrigger value="profiles">Profiles</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="profiles">
      <Bootstrap232MenubarItem value="Andy">Andy</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="Benoit">Benoit</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="theme">Theme</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="theme">
      <Bootstrap232MenubarItem value="Light">Light</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="Dark">Dark</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
  </Bootstrap232MenubarRoot>
</template>
    `),
    'demo-liquid-glass-menubar': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassMenubarRoot a11y-label="Workspace menu">
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file">
        <LiquidGlassMenubarItem value="new-tab">New Tab</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="new-window">New Window</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="incognito" :disabled="true">New Private Window</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
      <LiquidGlassMenubarTrigger value="edit">Edit</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="edit">
        <LiquidGlassMenubarItem value="undo">Undo</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="redo">Redo</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-menubar-destructive': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassMenubarRoot a11y-label="Document actions">
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file">
        <LiquidGlassMenubarItem value="new-file">New File</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="save">Save</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
      <LiquidGlassMenubarTrigger value="more">More</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="more">
        <LiquidGlassMenubarItem value="settings">Settings</LiquidGlassMenubarItem>
        <div role="separator" class="-mx-1 my-1 h-px bg-border" />
        <LiquidGlassMenubarItem value="delete" variant="destructive">Delete</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-menubar-states': formatCode(`
<script setup lang="ts">
import { ref } from 'vue';
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue';

const bookmarks = ref(false);
const urls = ref(true);
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassMenubarRoot a11y-label="View preferences">
      <LiquidGlassMenubarTrigger value="view">View</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="view">
        <LiquidGlassMenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
          {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
        </LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="urls" :close-on-select="false" @select="urls = !urls">
          {{ urls ? '✓ ' : '' }}Always Show Full URLs
        </LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="reload" :inset="true">Reload</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
      <LiquidGlassMenubarTrigger value="admin" :disabled="true">Admin</LiquidGlassMenubarTrigger>
    </LiquidGlassMenubarRoot>
  </div>
</template>
    `),
    'demo-liquid-glass-menubar-material': formatCode(`
<script setup lang="ts">
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue';
</script>

<template>
  <div class="grid gap-5 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-2">
    <LiquidGlassMenubarRoot>
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file" material="auto">
        <LiquidGlassMenubarItem value="new">New Window</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="share">Share</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>

    <LiquidGlassMenubarRoot>
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file" material="opaque">
        <LiquidGlassMenubarItem value="new">New Window</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="share">Share</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>
  </div>
</template>
    `),
  },
  vue2: {
    'demo-shadcn-menubar': formatCode(`
<template>
  <ShadcnMenubarRoot style-profile="rhea" a11y-label="Project commands">
    <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="file" a11y-label="File commands">
      <ShadcnMenubarItem value="new" text-value="New document">New document</ShadcnMenubarItem>
      <ShadcnMenubarItem value="open" text-value="Open document">Open document</ShadcnMenubarItem>
      <ShadcnMenubarItem value="incognito" :disabled="true">New incognito window</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="edit">Edit</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="edit" a11y-label="Edit commands">
      <ShadcnMenubarItem value="undo" text-value="Undo">Undo</ShadcnMenubarItem>
      <ShadcnMenubarItem value="redo" text-value="Redo">Redo</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>

<script>
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMenubarRoot,
    ShadcnMenubarTrigger,
    ShadcnMenubarContent,
    ShadcnMenubarItem,
  },
};
</script>
    `),
    'demo-shadcn-menubar-destructive': formatCode(`
<template>
  <ShadcnMenubarRoot style-profile="rhea" a11y-label="Document actions">
    <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="file">
      <ShadcnMenubarItem value="new-file">New File</ShadcnMenubarItem>
      <ShadcnMenubarItem value="save">Save</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="more">More</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="more">
      <ShadcnMenubarItem value="settings">Settings</ShadcnMenubarItem>
      <ShadcnMenubarItem value="delete" variant="destructive">Delete</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>

<script>
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMenubarRoot,
    ShadcnMenubarTrigger,
    ShadcnMenubarContent,
    ShadcnMenubarItem,
  },
};
</script>
    `),
    'demo-shadcn-menubar-states': formatCode(`
<template>
  <ShadcnMenubarRoot style-profile="rhea" a11y-label="View preferences">
    <ShadcnMenubarTrigger value="view">View</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="view">
      <ShadcnMenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
        {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
      </ShadcnMenubarItem>
      <ShadcnMenubarItem value="urls" :close-on-select="false" @select="urls = !urls">
        {{ urls ? '✓ ' : '' }}Always Show Full URLs
      </ShadcnMenubarItem>
      <ShadcnMenubarItem value="reload" :inset="true">Reload</ShadcnMenubarItem>
      <ShadcnMenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="admin" :disabled="true">Admin</ShadcnMenubarTrigger>
  </ShadcnMenubarRoot>
</template>

<script>
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMenubarRoot,
    ShadcnMenubarTrigger,
    ShadcnMenubarContent,
    ShadcnMenubarItem,
  },
  data() {
    return { bookmarks: false, urls: true };
  },
};
</script>
    `),
    'demo-shadcn-menubar-controlled': formatCode(`
<template>
  <ShadcnMenubarRoot
    style-profile="rhea"
    :value="openMenu"
    :loop="false"
    @value-change="onValueChange"
  >
    <ShadcnMenubarTrigger value="profiles">Profiles</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="profiles">
      <ShadcnMenubarItem value="Andy">Andy</ShadcnMenubarItem>
      <ShadcnMenubarItem value="Benoit">Benoit</ShadcnMenubarItem>
    </ShadcnMenubarContent>
    <ShadcnMenubarTrigger value="theme">Theme</ShadcnMenubarTrigger>
    <ShadcnMenubarContent value="theme">
      <ShadcnMenubarItem value="Light">Light</ShadcnMenubarItem>
      <ShadcnMenubarItem value="Dark">Dark</ShadcnMenubarItem>
    </ShadcnMenubarContent>
  </ShadcnMenubarRoot>
</template>

<script>
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMenubarRoot,
    ShadcnMenubarTrigger,
    ShadcnMenubarContent,
    ShadcnMenubarItem,
  },
  data() {
    return { openMenu: '' };
  },
  methods: {
    onValueChange(detail) {
      this.openMenu = detail.value;
    },
  },
};
</script>
    `),
    'demo-shadcn-menubar-profiles': formatCode(`
<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <ShadcnMenubarRoot v-for="profile in profiles" :key="profile" :style-profile="profile">
      <ShadcnMenubarTrigger value="file">File</ShadcnMenubarTrigger>
      <ShadcnMenubarContent value="file">
        <ShadcnMenubarItem value="new">New File</ShadcnMenubarItem>
        <ShadcnMenubarItem value="save">Save</ShadcnMenubarItem>
      </ShadcnMenubarContent>
    </ShadcnMenubarRoot>
  </div>
</template>

<script>
import {
  ShadcnMenubarRoot,
  ShadcnMenubarTrigger,
  ShadcnMenubarContent,
  ShadcnMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    ShadcnMenubarRoot,
    ShadcnMenubarTrigger,
    ShadcnMenubarContent,
    ShadcnMenubarItem,
  },
  data() {
    return { profiles: ['rhea', 'new-york-v4', 'nova', 'maia', 'lyra', 'mira'] };
  },
};
</script>
    `),
    'demo-brutalist-menubar': formatCode(`
<template>
  <BrutalistMenubarRoot a11y-label="Workspace menu">
    <BrutalistMenubarTrigger value="file">File</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="file">
      <BrutalistMenubarItem value="new-tab">New Tab</BrutalistMenubarItem>
      <BrutalistMenubarItem value="new-window">New Window</BrutalistMenubarItem>
      <BrutalistMenubarItem value="incognito" :disabled="true">New Incognito Window</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="edit">Edit</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="edit">
      <BrutalistMenubarItem value="undo">Undo</BrutalistMenubarItem>
      <BrutalistMenubarItem value="redo">Redo</BrutalistMenubarItem>
    </BrutalistMenubarContent>
  </BrutalistMenubarRoot>
</template>

<script>
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistMenubarRoot,
    BrutalistMenubarTrigger,
    BrutalistMenubarContent,
    BrutalistMenubarItem,
  },
};
</script>
    `),
    'demo-brutalist-menubar-destructive': formatCode(`
<template>
  <BrutalistMenubarRoot a11y-label="Document actions">
    <BrutalistMenubarTrigger value="more">More</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="more">
      <BrutalistMenubarItem value="settings">Settings</BrutalistMenubarItem>
      <BrutalistMenubarItem value="delete" variant="destructive">Delete</BrutalistMenubarItem>
    </BrutalistMenubarContent>
  </BrutalistMenubarRoot>
</template>

<script>
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistMenubarRoot,
    BrutalistMenubarTrigger,
    BrutalistMenubarContent,
    BrutalistMenubarItem,
  },
};
</script>
    `),
    'demo-brutalist-menubar-states': formatCode(`
<template>
  <BrutalistMenubarRoot a11y-label="View preferences">
    <BrutalistMenubarTrigger value="view">View</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="view">
      <BrutalistMenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
        {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
      </BrutalistMenubarItem>
      <BrutalistMenubarItem value="reload" :inset="true">Reload</BrutalistMenubarItem>
      <BrutalistMenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="admin" :disabled="true">Admin</BrutalistMenubarTrigger>
  </BrutalistMenubarRoot>
</template>

<script>
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistMenubarRoot,
    BrutalistMenubarTrigger,
    BrutalistMenubarContent,
    BrutalistMenubarItem,
  },
  data() {
    return { bookmarks: false };
  },
};
</script>
    `),
    'demo-brutalist-menubar-controlled': formatCode(`
<template>
  <BrutalistMenubarRoot :value="openMenu" :loop="false" @value-change="onValueChange">
    <BrutalistMenubarTrigger value="profiles">Profiles</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="profiles">
      <BrutalistMenubarItem value="Andy">Andy</BrutalistMenubarItem>
      <BrutalistMenubarItem value="Benoit">Benoit</BrutalistMenubarItem>
    </BrutalistMenubarContent>
    <BrutalistMenubarTrigger value="theme">Theme</BrutalistMenubarTrigger>
    <BrutalistMenubarContent value="theme">
      <BrutalistMenubarItem value="Light">Light</BrutalistMenubarItem>
      <BrutalistMenubarItem value="Dark">Dark</BrutalistMenubarItem>
    </BrutalistMenubarContent>
  </BrutalistMenubarRoot>
</template>

<script>
import {
  BrutalistMenubarRoot,
  BrutalistMenubarTrigger,
  BrutalistMenubarContent,
  BrutalistMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    BrutalistMenubarRoot,
    BrutalistMenubarTrigger,
    BrutalistMenubarContent,
    BrutalistMenubarItem,
  },
  data() {
    return { openMenu: '' };
  },
  methods: {
    onValueChange(detail) {
      this.openMenu = detail.value;
    },
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-menubar': formatCode(`
<template>
  <Bootstrap232MenubarRoot a11y-label="Application menu">
    <Bootstrap232MenubarTrigger value="file">File</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="file">
      <Bootstrap232MenubarItem value="new-tab">New Tab</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="new-window">New Window</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="incognito" :disabled="true">New Incognito Window</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="edit">Edit</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="edit">
      <Bootstrap232MenubarItem value="undo">Undo</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="redo">Redo</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
  </Bootstrap232MenubarRoot>
</template>

<script>
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232MenubarRoot,
    Bootstrap232MenubarTrigger,
    Bootstrap232MenubarContent,
    Bootstrap232MenubarItem,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-menubar-destructive': formatCode(`
<template>
  <Bootstrap232MenubarRoot a11y-label="Document actions">
    <Bootstrap232MenubarTrigger value="more">More</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="more">
      <Bootstrap232MenubarItem value="settings">Settings</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="delete" variant="destructive">Delete</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
  </Bootstrap232MenubarRoot>
</template>

<script>
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232MenubarRoot,
    Bootstrap232MenubarTrigger,
    Bootstrap232MenubarContent,
    Bootstrap232MenubarItem,
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-menubar-states': formatCode(`
<template>
  <Bootstrap232MenubarRoot a11y-label="View preferences">
    <Bootstrap232MenubarTrigger value="view">View</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="view">
      <Bootstrap232MenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
        {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
      </Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="reload" :inset="true">Reload</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="admin" :disabled="true">Admin</Bootstrap232MenubarTrigger>
  </Bootstrap232MenubarRoot>
</template>

<script>
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232MenubarRoot,
    Bootstrap232MenubarTrigger,
    Bootstrap232MenubarContent,
    Bootstrap232MenubarItem,
  },
  data() {
    return { bookmarks: false };
  },
};
</script>
    `),
    'demo-bootstrap-2-3-2-menubar-controlled': formatCode(`
<template>
  <Bootstrap232MenubarRoot :value="openMenu" :loop="false" @value-change="onValueChange">
    <Bootstrap232MenubarTrigger value="profiles">Profiles</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="profiles">
      <Bootstrap232MenubarItem value="Andy">Andy</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="Benoit">Benoit</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
    <Bootstrap232MenubarTrigger value="theme">Theme</Bootstrap232MenubarTrigger>
    <Bootstrap232MenubarContent value="theme">
      <Bootstrap232MenubarItem value="Light">Light</Bootstrap232MenubarItem>
      <Bootstrap232MenubarItem value="Dark">Dark</Bootstrap232MenubarItem>
    </Bootstrap232MenubarContent>
  </Bootstrap232MenubarRoot>
</template>

<script>
import {
  Bootstrap232MenubarRoot,
  Bootstrap232MenubarTrigger,
  Bootstrap232MenubarContent,
  Bootstrap232MenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    Bootstrap232MenubarRoot,
    Bootstrap232MenubarTrigger,
    Bootstrap232MenubarContent,
    Bootstrap232MenubarItem,
  },
  data() {
    return { openMenu: '' };
  },
  methods: {
    onValueChange(detail) {
      this.openMenu = detail.value;
    },
  },
};
</script>
    `),
    'demo-liquid-glass-menubar': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassMenubarRoot a11y-label="Workspace menu">
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file">
        <LiquidGlassMenubarItem value="new-tab">New Tab</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="new-window">New Window</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
      <LiquidGlassMenubarTrigger value="edit">Edit</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="edit">
        <LiquidGlassMenubarItem value="undo">Undo</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="redo">Redo</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>
  </div>
</template>

<script>
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassMenubarRoot,
    LiquidGlassMenubarTrigger,
    LiquidGlassMenubarContent,
    LiquidGlassMenubarItem,
  },
};
</script>
    `),
    'demo-liquid-glass-menubar-destructive': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassMenubarRoot a11y-label="Document actions">
      <LiquidGlassMenubarTrigger value="more">More</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="more">
        <LiquidGlassMenubarItem value="settings">Settings</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="delete" variant="destructive">Delete</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>
  </div>
</template>

<script>
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassMenubarRoot,
    LiquidGlassMenubarTrigger,
    LiquidGlassMenubarContent,
    LiquidGlassMenubarItem,
  },
};
</script>
    `),
    'demo-liquid-glass-menubar-states': formatCode(`
<template>
  <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6">
    <LiquidGlassMenubarRoot a11y-label="View preferences">
      <LiquidGlassMenubarTrigger value="view">View</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="view">
        <LiquidGlassMenubarItem value="bookmarks" :close-on-select="false" @select="bookmarks = !bookmarks">
          {{ bookmarks ? '✓ ' : '' }}Always Show Bookmarks Bar
        </LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="reload" :inset="true">Reload</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="force-reload" :inset="true" :disabled="true">Force Reload</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
      <LiquidGlassMenubarTrigger value="admin" :disabled="true">Admin</LiquidGlassMenubarTrigger>
    </LiquidGlassMenubarRoot>
  </div>
</template>

<script>
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassMenubarRoot,
    LiquidGlassMenubarTrigger,
    LiquidGlassMenubarContent,
    LiquidGlassMenubarItem,
  },
  data() {
    return { bookmarks: false };
  },
};
</script>
    `),
    'demo-liquid-glass-menubar-material': formatCode(`
<template>
  <div class="grid gap-5 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-2">
    <LiquidGlassMenubarRoot>
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file" material="auto">
        <LiquidGlassMenubarItem value="new">New Window</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="share">Share</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>

    <LiquidGlassMenubarRoot>
      <LiquidGlassMenubarTrigger value="file">File</LiquidGlassMenubarTrigger>
      <LiquidGlassMenubarContent value="file" material="opaque">
        <LiquidGlassMenubarItem value="new">New Window</LiquidGlassMenubarItem>
        <LiquidGlassMenubarItem value="share">Share</LiquidGlassMenubarItem>
      </LiquidGlassMenubarContent>
    </LiquidGlassMenubarRoot>
  </div>
</template>

<script>
import {
  LiquidGlassMenubarRoot,
  LiquidGlassMenubarTrigger,
  LiquidGlassMenubarContent,
  LiquidGlassMenubarItem,
} from '../proto-ui/components/vue2';

export default {
  components: {
    LiquidGlassMenubarRoot,
    LiquidGlassMenubarTrigger,
    LiquidGlassMenubarContent,
    LiquidGlassMenubarItem,
  },
};
</script>
    `),
  },
};
