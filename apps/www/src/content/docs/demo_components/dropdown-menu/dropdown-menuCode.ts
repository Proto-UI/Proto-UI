export const codeMap = {
  wc: {
    'demo-shadcn-dropdown-menu': `<shadcn-dropdown-root>
  <shadcn-dropdown-trigger>Open</shadcn-dropdown-trigger>
  <shadcn-dropdown-content align="start" class="w-40">
    <shadcn-dropdown-group>
      <shadcn-dropdown-label>My Account</shadcn-dropdown-label>
      <shadcn-dropdown-item value="profile" text-value="Profile">
        Profile
        <shadcn-dropdown-shortcut>⇧⌘P</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="billing" text-value="Billing">
        Billing
        <shadcn-dropdown-shortcut>⌘B</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="settings" text-value="Settings">
        Settings
        <shadcn-dropdown-shortcut>⌘S</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-group a11y-label="Team actions">
      <shadcn-dropdown-item value="team" text-value="Team">Team</shadcn-dropdown-item>
      <shadcn-dropdown-item value="new-team" text-value="New Team">
        New Team
        <shadcn-dropdown-shortcut>⌘+T</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-group a11y-label="Resources">
      <shadcn-dropdown-item value="github" text-value="GitHub">GitHub</shadcn-dropdown-item>
      <shadcn-dropdown-item value="support" text-value="Support">Support</shadcn-dropdown-item>
      <shadcn-dropdown-item value="api" text-value="API" disabled>API</shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-item value="logout" text-value="Log out">
      Log out
      <shadcn-dropdown-shortcut>⇧⌘Q</shadcn-dropdown-shortcut>
    </shadcn-dropdown-item>
  </shadcn-dropdown-content>
</shadcn-dropdown-root>`,
    'demo-shadcn-dropdown-menu-basic': `<shadcn-dropdown-root>
  <shadcn-dropdown-trigger>Open</shadcn-dropdown-trigger>
  <shadcn-dropdown-content align="start" class="w-40">
    <shadcn-dropdown-group>
      <shadcn-dropdown-label>My Account</shadcn-dropdown-label>
      <shadcn-dropdown-item value="profile" text-value="Profile">Profile</shadcn-dropdown-item>
      <shadcn-dropdown-item value="billing" text-value="Billing">Billing</shadcn-dropdown-item>
      <shadcn-dropdown-item value="settings" text-value="Settings">Settings</shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-item value="github" text-value="GitHub">GitHub</shadcn-dropdown-item>
    <shadcn-dropdown-item value="support" text-value="Support">Support</shadcn-dropdown-item>
    <shadcn-dropdown-item value="api" text-value="API" disabled>API</shadcn-dropdown-item>
  </shadcn-dropdown-content>
</shadcn-dropdown-root>`,
    'demo-shadcn-dropdown-menu-shortcuts': `<shadcn-dropdown-root>
  <shadcn-dropdown-trigger>Open</shadcn-dropdown-trigger>
  <shadcn-dropdown-content align="start" class="w-44">
    <shadcn-dropdown-group>
      <shadcn-dropdown-label>My Account</shadcn-dropdown-label>
      <shadcn-dropdown-item value="profile" text-value="Profile">
        Profile
        <shadcn-dropdown-shortcut>⇧⌘P</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="billing" text-value="Billing">
        Billing
        <shadcn-dropdown-shortcut>⌘B</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="settings" text-value="Settings">
        Settings
        <shadcn-dropdown-shortcut>⌘S</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-item value="logout" text-value="Log out">
      Log out
      <shadcn-dropdown-shortcut>⇧⌘Q</shadcn-dropdown-shortcut>
    </shadcn-dropdown-item>
  </shadcn-dropdown-content>
</shadcn-dropdown-root>`,
    'demo-shadcn-dropdown-destructive': `<shadcn-dropdown-root>
  <shadcn-dropdown-trigger>Actions</shadcn-dropdown-trigger>
  <shadcn-dropdown-content align="start">
    <shadcn-dropdown-group>
      <shadcn-dropdown-item value="edit" text-value="Edit">
        <lucide-pencil-icon size="16"></lucide-pencil-icon>
        Edit
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="share" text-value="Share">
        <lucide-share-icon size="16"></lucide-share-icon>
        Share
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="archive" text-value="Archive">
        <lucide-archive-icon size="16"></lucide-archive-icon>
        Archive
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-group>
      <shadcn-dropdown-item value="delete" text-value="Delete" variant="destructive">
        <lucide-trash-icon size="16"></lucide-trash-icon>
        Delete
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
  </shadcn-dropdown-content>
</shadcn-dropdown-root>`,
    'demo-shadcn-dropdown-inset': `<shadcn-dropdown-root>
  <shadcn-dropdown-trigger>Edit</shadcn-dropdown-trigger>
  <shadcn-dropdown-content align="start" class="w-44">
    <shadcn-dropdown-group>
      <shadcn-dropdown-label>Clipboard</shadcn-dropdown-label>
      <shadcn-dropdown-item value="copy" text-value="Copy">
        <lucide-copy-icon size="16"></lucide-copy-icon>
        Copy
        <shadcn-dropdown-shortcut>⌘C</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="cut" text-value="Cut">
        <lucide-scissors-icon size="16"></lucide-scissors-icon>
        Cut
        <shadcn-dropdown-shortcut>⌘X</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
      <shadcn-dropdown-item value="paste" text-value="Paste" inset>
        Paste
        <shadcn-dropdown-shortcut>⌘V</shadcn-dropdown-shortcut>
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
    <shadcn-dropdown-separator></shadcn-dropdown-separator>
    <shadcn-dropdown-group>
      <shadcn-dropdown-label inset>More actions</shadcn-dropdown-label>
      <shadcn-dropdown-item value="rename" text-value="Rename" inset>
        Rename
      </shadcn-dropdown-item>
    </shadcn-dropdown-group>
  </shadcn-dropdown-content>
</shadcn-dropdown-root>`,
    'demo-shadcn-dropdown-menu-indicator': `<div class="flex flex-wrap items-center gap-4">
  <shadcn-dropdown-root>
    <shadcn-dropdown-trigger indicator indicator-icon="chevron-down">Options</shadcn-dropdown-trigger>
    <shadcn-dropdown-content align="end" class="w-40">
      <shadcn-dropdown-item value="duplicate" text-value="Duplicate">Duplicate</shadcn-dropdown-item>
      <shadcn-dropdown-item value="export" text-value="Export">Export</shadcn-dropdown-item>
      <shadcn-dropdown-separator></shadcn-dropdown-separator>
      <shadcn-dropdown-item value="delete" text-value="Delete" variant="destructive">Delete</shadcn-dropdown-item>
    </shadcn-dropdown-content>
  </shadcn-dropdown-root>

  <shadcn-dropdown-root>
    <shadcn-dropdown-trigger indicator indicator-icon="chevrons-up-down">Workspace</shadcn-dropdown-trigger>
    <shadcn-dropdown-content side="right" align="start" side-offset="6" class="w-40">
      <shadcn-dropdown-label>Switch workspace</shadcn-dropdown-label>
      <shadcn-dropdown-item value="personal" text-value="Personal">Personal</shadcn-dropdown-item>
      <shadcn-dropdown-item value="studio" text-value="Design Studio">Design Studio</shadcn-dropdown-item>
      <shadcn-dropdown-item value="acme" text-value="Acme Inc.">Acme Inc.</shadcn-dropdown-item>
    </shadcn-dropdown-content>
  </shadcn-dropdown-root>
</div>`,
    'demo-brutalist-dropdown-menu': `<brutalist-dropdown-root>
  <brutalist-dropdown-trigger>Open</brutalist-dropdown-trigger>
  <brutalist-dropdown-content align="start" class="w-44">
    <brutalist-dropdown-group>
      <brutalist-dropdown-label>My Account</brutalist-dropdown-label>
      <brutalist-dropdown-item value="profile" text-value="Profile">
        Profile
        <brutalist-dropdown-shortcut>⇧⌘P</brutalist-dropdown-shortcut>
      </brutalist-dropdown-item>
      <brutalist-dropdown-item value="billing" text-value="Billing">
        Billing
        <brutalist-dropdown-shortcut>⌘B</brutalist-dropdown-shortcut>
      </brutalist-dropdown-item>
      <brutalist-dropdown-item value="settings" text-value="Settings">
        Settings
        <brutalist-dropdown-shortcut>⌘S</brutalist-dropdown-shortcut>
      </brutalist-dropdown-item>
    </brutalist-dropdown-group>
    <brutalist-dropdown-separator></brutalist-dropdown-separator>
    <brutalist-dropdown-group a11y-label="Team actions">
      <brutalist-dropdown-item value="team" text-value="Team">Team</brutalist-dropdown-item>
      <brutalist-dropdown-item value="new-team" text-value="New Team">
        New Team
        <brutalist-dropdown-shortcut>⌘+T</brutalist-dropdown-shortcut>
      </brutalist-dropdown-item>
    </brutalist-dropdown-group>
    <brutalist-dropdown-separator></brutalist-dropdown-separator>
    <brutalist-dropdown-group a11y-label="Resources">
      <brutalist-dropdown-item value="github" text-value="GitHub">GitHub</brutalist-dropdown-item>
      <brutalist-dropdown-item value="support" text-value="Support">Support</brutalist-dropdown-item>
      <brutalist-dropdown-item value="api" text-value="API" disabled>API</brutalist-dropdown-item>
    </brutalist-dropdown-group>
    <brutalist-dropdown-separator></brutalist-dropdown-separator>
    <brutalist-dropdown-item value="logout" text-value="Log out">
      Log out
      <brutalist-dropdown-shortcut>⇧⌘Q</brutalist-dropdown-shortcut>
    </brutalist-dropdown-item>
  </brutalist-dropdown-content>
</brutalist-dropdown-root>`,
    'demo-brutalist-dropdown-menu-destructive': `<brutalist-dropdown-root>
  <brutalist-dropdown-trigger>Actions</brutalist-dropdown-trigger>
  <brutalist-dropdown-content align="start" class="w-44">
    <brutalist-dropdown-group>
      <brutalist-dropdown-item value="edit" text-value="Edit">
        <lucide-pencil-icon size="16"></lucide-pencil-icon>
        Edit
      </brutalist-dropdown-item>
      <brutalist-dropdown-item value="share" text-value="Share">
        <lucide-share-icon size="16"></lucide-share-icon>
        Share
      </brutalist-dropdown-item>
      <brutalist-dropdown-item value="archive" text-value="Archive">
        <lucide-archive-icon size="16"></lucide-archive-icon>
        Archive
      </brutalist-dropdown-item>
    </brutalist-dropdown-group>
    <brutalist-dropdown-separator></brutalist-dropdown-separator>
    <brutalist-dropdown-group>
      <brutalist-dropdown-item value="delete" text-value="Delete" variant="destructive">
        <lucide-trash-icon size="16"></lucide-trash-icon>
        Delete
      </brutalist-dropdown-item>
    </brutalist-dropdown-group>
  </brutalist-dropdown-content>
</brutalist-dropdown-root>`,
    'demo-brutalist-dropdown-menu-inset': `<brutalist-dropdown-root>
  <brutalist-dropdown-trigger>Edit</brutalist-dropdown-trigger>
  <brutalist-dropdown-content align="start" class="w-44">
    <brutalist-dropdown-group>
      <brutalist-dropdown-label>Clipboard</brutalist-dropdown-label>
      <brutalist-dropdown-item value="copy" text-value="Copy">
        <lucide-copy-icon size="16"></lucide-copy-icon>
        Copy
      </brutalist-dropdown-item>
      <brutalist-dropdown-item value="cut" text-value="Cut">
        <lucide-scissors-icon size="16"></lucide-scissors-icon>
        Cut
      </brutalist-dropdown-item>
      <brutalist-dropdown-item value="paste" text-value="Paste" inset>Paste</brutalist-dropdown-item>
    </brutalist-dropdown-group>
    <brutalist-dropdown-separator></brutalist-dropdown-separator>
    <brutalist-dropdown-group>
      <brutalist-dropdown-label inset>More actions</brutalist-dropdown-label>
      <brutalist-dropdown-item value="rename" text-value="Rename" inset>Rename</brutalist-dropdown-item>
    </brutalist-dropdown-group>
  </brutalist-dropdown-content>
</brutalist-dropdown-root>`,
    'demo-brutalist-dropdown-menu-indicator': `<div class="flex flex-wrap items-center gap-4">
  <brutalist-dropdown-root>
    <brutalist-dropdown-trigger indicator indicator-icon="chevron-down">Options</brutalist-dropdown-trigger>
    <brutalist-dropdown-content align="end" class="w-40">
      <brutalist-dropdown-item value="duplicate" text-value="Duplicate">Duplicate</brutalist-dropdown-item>
      <brutalist-dropdown-item value="export" text-value="Export">Export</brutalist-dropdown-item>
      <brutalist-dropdown-separator></brutalist-dropdown-separator>
      <brutalist-dropdown-item value="delete" text-value="Delete" variant="destructive">Delete</brutalist-dropdown-item>
    </brutalist-dropdown-content>
  </brutalist-dropdown-root>

  <brutalist-dropdown-root>
    <brutalist-dropdown-trigger indicator indicator-icon="chevrons-up-down">Workspace</brutalist-dropdown-trigger>
    <brutalist-dropdown-content align="start" class="w-40">
      <brutalist-dropdown-label>Switch workspace</brutalist-dropdown-label>
      <brutalist-dropdown-item value="personal" text-value="Personal">Personal</brutalist-dropdown-item>
      <brutalist-dropdown-item value="studio" text-value="Design Studio">Design Studio</brutalist-dropdown-item>
    </brutalist-dropdown-content>
  </brutalist-dropdown-root>
</div>`,
    'demo-bootstrap-2-3-2-dropdown-menu': `<bootstrap-2-3-2-dropdown-root>
  <bootstrap-2-3-2-dropdown-trigger>Open</bootstrap-2-3-2-dropdown-trigger>
  <bootstrap-2-3-2-dropdown-content align="start" class="w-40">
    <bootstrap-2-3-2-dropdown-group>
      <bootstrap-2-3-2-dropdown-label>My Account</bootstrap-2-3-2-dropdown-label>
      <bootstrap-2-3-2-dropdown-item value="profile" text-value="Profile">
        Profile
        <bootstrap-2-3-2-dropdown-shortcut>⇧⌘P</bootstrap-2-3-2-dropdown-shortcut>
      </bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="billing" text-value="Billing">
        Billing
        <bootstrap-2-3-2-dropdown-shortcut>⌘B</bootstrap-2-3-2-dropdown-shortcut>
      </bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="settings" text-value="Settings">
        Settings
        <bootstrap-2-3-2-dropdown-shortcut>⌘S</bootstrap-2-3-2-dropdown-shortcut>
      </bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
    <bootstrap-2-3-2-dropdown-separator></bootstrap-2-3-2-dropdown-separator>
    <bootstrap-2-3-2-dropdown-group a11y-label="Team actions">
      <bootstrap-2-3-2-dropdown-item value="team" text-value="Team">Team</bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="new-team" text-value="New Team">
        New Team
        <bootstrap-2-3-2-dropdown-shortcut>⌘+T</bootstrap-2-3-2-dropdown-shortcut>
      </bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
    <bootstrap-2-3-2-dropdown-separator></bootstrap-2-3-2-dropdown-separator>
    <bootstrap-2-3-2-dropdown-group a11y-label="Resources">
      <bootstrap-2-3-2-dropdown-item value="github" text-value="GitHub">GitHub</bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="support" text-value="Support">Support</bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="api" text-value="API" disabled>API</bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
    <bootstrap-2-3-2-dropdown-separator></bootstrap-2-3-2-dropdown-separator>
    <bootstrap-2-3-2-dropdown-item value="logout" text-value="Log out">
      Log out
      <bootstrap-2-3-2-dropdown-shortcut>⇧⌘Q</bootstrap-2-3-2-dropdown-shortcut>
    </bootstrap-2-3-2-dropdown-item>
  </bootstrap-2-3-2-dropdown-content>
</bootstrap-2-3-2-dropdown-root>`,
    'demo-bootstrap-2-3-2-dropdown-menu-destructive': `<bootstrap-2-3-2-dropdown-root>
  <bootstrap-2-3-2-dropdown-trigger>Actions</bootstrap-2-3-2-dropdown-trigger>
  <bootstrap-2-3-2-dropdown-content align="start" class="w-44">
    <bootstrap-2-3-2-dropdown-group>
      <bootstrap-2-3-2-dropdown-item value="edit" text-value="Edit">
        <lucide-pencil-icon size="14"></lucide-pencil-icon>
        Edit
      </bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="share" text-value="Share">
        <lucide-share-icon size="14"></lucide-share-icon>
        Share
      </bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="archive" text-value="Archive" disabled>
        <lucide-archive-icon size="14"></lucide-archive-icon>
        Archive
      </bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
    <bootstrap-2-3-2-dropdown-separator></bootstrap-2-3-2-dropdown-separator>
    <bootstrap-2-3-2-dropdown-group>
      <bootstrap-2-3-2-dropdown-item value="delete" text-value="Delete" variant="destructive">
        <lucide-trash-icon size="14"></lucide-trash-icon>
        Delete
      </bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
  </bootstrap-2-3-2-dropdown-content>
</bootstrap-2-3-2-dropdown-root>`,
    'demo-bootstrap-2-3-2-dropdown-menu-inset': `<bootstrap-2-3-2-dropdown-root>
  <bootstrap-2-3-2-dropdown-trigger>Edit</bootstrap-2-3-2-dropdown-trigger>
  <bootstrap-2-3-2-dropdown-content align="start" class="w-44">
    <bootstrap-2-3-2-dropdown-group>
      <bootstrap-2-3-2-dropdown-label>Clipboard</bootstrap-2-3-2-dropdown-label>
      <bootstrap-2-3-2-dropdown-item value="copy" text-value="Copy">
        <lucide-copy-icon size="14"></lucide-copy-icon>
        Copy
      </bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="cut" text-value="Cut">
        <lucide-scissors-icon size="14"></lucide-scissors-icon>
        Cut
      </bootstrap-2-3-2-dropdown-item>
      <bootstrap-2-3-2-dropdown-item value="paste" text-value="Paste" inset>Paste</bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
    <bootstrap-2-3-2-dropdown-separator></bootstrap-2-3-2-dropdown-separator>
    <bootstrap-2-3-2-dropdown-group>
      <bootstrap-2-3-2-dropdown-label inset>More actions</bootstrap-2-3-2-dropdown-label>
      <bootstrap-2-3-2-dropdown-item value="rename" text-value="Rename" inset>Rename</bootstrap-2-3-2-dropdown-item>
    </bootstrap-2-3-2-dropdown-group>
  </bootstrap-2-3-2-dropdown-content>
</bootstrap-2-3-2-dropdown-root>`,
    'demo-liquid-glass-dropdown-menu': `<liquid-glass-dropdown-root>
  <liquid-glass-dropdown-trigger>Open</liquid-glass-dropdown-trigger>
  <liquid-glass-dropdown-content align="start" class="w-44">
    <liquid-glass-dropdown-group>
      <liquid-glass-dropdown-label>My Account</liquid-glass-dropdown-label>
      <liquid-glass-dropdown-item value="profile" text-value="Profile">
        Profile
        <liquid-glass-dropdown-shortcut>⇧⌘P</liquid-glass-dropdown-shortcut>
      </liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="billing" text-value="Billing">
        Billing
        <liquid-glass-dropdown-shortcut>⌘B</liquid-glass-dropdown-shortcut>
      </liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="settings" text-value="Settings">
        Settings
        <liquid-glass-dropdown-shortcut>⌘S</liquid-glass-dropdown-shortcut>
      </liquid-glass-dropdown-item>
    </liquid-glass-dropdown-group>
    <liquid-glass-dropdown-separator></liquid-glass-dropdown-separator>
    <liquid-glass-dropdown-group a11y-label="Team actions">
      <liquid-glass-dropdown-item value="team" text-value="Team">Team</liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="new-team" text-value="New Team">
        New Team
        <liquid-glass-dropdown-shortcut>⌘+T</liquid-glass-dropdown-shortcut>
      </liquid-glass-dropdown-item>
    </liquid-glass-dropdown-group>
    <liquid-glass-dropdown-separator></liquid-glass-dropdown-separator>
    <liquid-glass-dropdown-group a11y-label="Resources">
      <liquid-glass-dropdown-item value="github" text-value="GitHub">GitHub</liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="support" text-value="Support">Support</liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="api" text-value="API" disabled>API</liquid-glass-dropdown-item>
    </liquid-glass-dropdown-group>
    <liquid-glass-dropdown-separator></liquid-glass-dropdown-separator>
    <liquid-glass-dropdown-item value="logout" text-value="Log out">
      Log out
      <liquid-glass-dropdown-shortcut>⇧⌘Q</liquid-glass-dropdown-shortcut>
    </liquid-glass-dropdown-item>
  </liquid-glass-dropdown-content>
</liquid-glass-dropdown-root>`,
    'demo-liquid-glass-dropdown-menu-destructive': `<liquid-glass-dropdown-root>
  <liquid-glass-dropdown-trigger>Actions</liquid-glass-dropdown-trigger>
  <liquid-glass-dropdown-content align="start" class="w-48">
    <liquid-glass-dropdown-group>
      <liquid-glass-dropdown-label>Document</liquid-glass-dropdown-label>
      <liquid-glass-dropdown-item value="copy" text-value="Copy">
        <lucide-copy-icon size="16"></lucide-copy-icon>
        Copy
      </liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="share" text-value="Share">
        <lucide-share-icon size="16"></lucide-share-icon>
        Share
      </liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="rename" text-value="Rename" inset>Rename</liquid-glass-dropdown-item>
    </liquid-glass-dropdown-group>
    <liquid-glass-dropdown-separator></liquid-glass-dropdown-separator>
    <liquid-glass-dropdown-group>
      <liquid-glass-dropdown-item value="delete" text-value="Delete" variant="destructive">
        <lucide-trash-icon size="16"></lucide-trash-icon>
        Delete
      </liquid-glass-dropdown-item>
    </liquid-glass-dropdown-group>
  </liquid-glass-dropdown-content>
</liquid-glass-dropdown-root>`,
    'demo-liquid-glass-dropdown-menu-prominence': `<div class="flex flex-wrap items-center gap-4">
  <liquid-glass-dropdown-root>
    <liquid-glass-dropdown-trigger prominence="regular" indicator>Options</liquid-glass-dropdown-trigger>
    <liquid-glass-dropdown-content align="start" class="w-40">
      <liquid-glass-dropdown-item value="duplicate" text-value="Duplicate">Duplicate</liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="archive" text-value="Archive">Archive</liquid-glass-dropdown-item>
    </liquid-glass-dropdown-content>
  </liquid-glass-dropdown-root>

  <liquid-glass-dropdown-root>
    <liquid-glass-dropdown-trigger prominence="prominent" indicator>Create New</liquid-glass-dropdown-trigger>
    <liquid-glass-dropdown-content align="end" class="w-44">
      <liquid-glass-dropdown-label>New item</liquid-glass-dropdown-label>
      <liquid-glass-dropdown-item value="note" text-value="Note">Note</liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="folder" text-value="Folder">Folder</liquid-glass-dropdown-item>
    </liquid-glass-dropdown-content>
  </liquid-glass-dropdown-root>
</div>`,
    'demo-liquid-glass-dropdown-menu-opaque': `<div class="flex flex-wrap items-center gap-4">
  <liquid-glass-dropdown-root>
    <liquid-glass-dropdown-trigger material="opaque">Opaque Surface</liquid-glass-dropdown-trigger>
    <liquid-glass-dropdown-content align="start" material="opaque" class="w-44">
      <liquid-glass-dropdown-label>Solid fallback</liquid-glass-dropdown-label>
      <liquid-glass-dropdown-item value="inspect" text-value="Inspect">Inspect</liquid-glass-dropdown-item>
      <liquid-glass-dropdown-item value="export" text-value="Export">Export</liquid-glass-dropdown-item>
    </liquid-glass-dropdown-content>
  </liquid-glass-dropdown-root>

  <liquid-glass-dropdown-root>
    <liquid-glass-dropdown-trigger disabled>Unavailable</liquid-glass-dropdown-trigger>
    <liquid-glass-dropdown-content>
      <liquid-glass-dropdown-item value="locked" text-value="Locked">Locked</liquid-glass-dropdown-item>
    </liquid-glass-dropdown-content>
  </liquid-glass-dropdown-root>
</div>`,
  },
  react: {
    'demo-shadcn-dropdown-menu': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem value="profile" textValue="Profile">
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="billing" textValue="Billing">
            Billing
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="settings" textValue="Settings">
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Team actions">
          <DropdownMenuItem value="team" textValue="Team">Team</DropdownMenuItem>
          <DropdownMenuItem value="new-team" textValue="New Team">
            New Team
            <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Resources">
          <DropdownMenuItem value="github" textValue="GitHub">GitHub</DropdownMenuItem>
          <DropdownMenuItem value="support" textValue="Support">Support</DropdownMenuItem>
          <DropdownMenuItem value="api" textValue="API" disabled>API</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="logout" textValue="Log out">
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-shadcn-dropdown-menu-basic': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuBasic() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem value="profile">Profile</DropdownMenuItem>
          <DropdownMenuItem value="billing">Billing</DropdownMenuItem>
          <DropdownMenuItem value="settings">Settings</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
        <DropdownMenuItem value="support">Support</DropdownMenuItem>
        <DropdownMenuItem value="api" disabled>API</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-shadcn-dropdown-menu-shortcuts': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuShortcuts() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem value="profile">
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="billing">
            Billing
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="settings">
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="logout">
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-shadcn-dropdown-destructive': `import { ArchiveIcon, PencilIcon, ShareIcon, TrashIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuDestructive() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem value="edit">
            <PencilIcon size={16} />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem value="share">
            <ShareIcon size={16} />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem value="archive">
            <ArchiveIcon size={16} />
            Archive
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem value="delete" variant="destructive">
            <TrashIcon size={16} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-shadcn-dropdown-inset': `import { CopyIcon, ScissorsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuInset() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Clipboard</DropdownMenuLabel>
          <DropdownMenuItem value="copy">
            <CopyIcon size={16} />
            Copy
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="cut">
            <ScissorsIcon size={16} />
            Cut
            <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="paste" inset>
            Paste
            <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>More actions</DropdownMenuLabel>
          <DropdownMenuItem value="rename" inset>Rename</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-shadcn-dropdown-menu-indicator': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuIndicator() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger indicator indicatorIcon="chevron-down">
          Options
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem value="duplicate">Duplicate</DropdownMenuItem>
          <DropdownMenuItem value="export">Export</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="delete" variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger indicator indicatorIcon="chevrons-up-down">
          Workspace
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={6} className="w-40">
          <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
          <DropdownMenuItem value="personal">Personal</DropdownMenuItem>
          <DropdownMenuItem value="studio">Design Studio</DropdownMenuItem>
          <DropdownMenuItem value="acme">Acme Inc.</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}`,
    'demo-brutalist-dropdown-menu': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/brutalist/dropdown-menu';

export function BrutalistDropdownMenuDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem value="profile">
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="billing">
            Billing
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem value="settings">
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Team actions">
          <DropdownMenuItem value="team">Team</DropdownMenuItem>
          <DropdownMenuItem value="new-team">
            New Team
            <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Resources">
          <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
          <DropdownMenuItem value="support">Support</DropdownMenuItem>
          <DropdownMenuItem value="api" disabled>API</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="logout">
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-brutalist-dropdown-menu-destructive': `import { ArchiveIcon, PencilIcon, ShareIcon, TrashIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/brutalist/dropdown-menu';

export function BrutalistDropdownDestructive() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem value="edit"><PencilIcon size={16} /> Edit</DropdownMenuItem>
          <DropdownMenuItem value="share"><ShareIcon size={16} /> Share</DropdownMenuItem>
          <DropdownMenuItem value="archive"><ArchiveIcon size={16} /> Archive</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem value="delete" variant="destructive">
            <TrashIcon size={16} /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-brutalist-dropdown-menu-inset': `import { CopyIcon, ScissorsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/brutalist/dropdown-menu';

export function BrutalistDropdownInset() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Clipboard</DropdownMenuLabel>
          <DropdownMenuItem value="copy"><CopyIcon size={16} /> Copy</DropdownMenuItem>
          <DropdownMenuItem value="cut"><ScissorsIcon size={16} /> Cut</DropdownMenuItem>
          <DropdownMenuItem value="paste" inset>Paste</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>More actions</DropdownMenuLabel>
          <DropdownMenuItem value="rename" inset>Rename</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-brutalist-dropdown-menu-indicator': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/brutalist/dropdown-menu';

export function BrutalistDropdownIndicator() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger indicator indicatorIcon="chevron-down">Options</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem value="duplicate">Duplicate</DropdownMenuItem>
          <DropdownMenuItem value="export">Export</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="delete" variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger indicator indicatorIcon="chevrons-up-down">Workspace</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
          <DropdownMenuItem value="personal">Personal</DropdownMenuItem>
          <DropdownMenuItem value="studio">Design Studio</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}`,
    'demo-bootstrap-2-3-2-dropdown-menu': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/bootstrap-2-3-2/dropdown-menu';

export function BootstrapDropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem value="profile">Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem value="billing">Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem value="settings">Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Team actions">
          <DropdownMenuItem value="team">Team</DropdownMenuItem>
          <DropdownMenuItem value="new-team">New Team <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Resources">
          <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
          <DropdownMenuItem value="support">Support</DropdownMenuItem>
          <DropdownMenuItem value="api" disabled>API</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="logout">Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-bootstrap-2-3-2-dropdown-menu-destructive': `import { ArchiveIcon, PencilIcon, ShareIcon, TrashIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/bootstrap-2-3-2/dropdown-menu';

export function BootstrapDropdownDestructive() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem value="edit"><PencilIcon size={14} /> Edit</DropdownMenuItem>
          <DropdownMenuItem value="share"><ShareIcon size={14} /> Share</DropdownMenuItem>
          <DropdownMenuItem value="archive" disabled><ArchiveIcon size={14} /> Archive</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem value="delete" variant="destructive">
            <TrashIcon size={14} /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-bootstrap-2-3-2-dropdown-menu-inset': `import { CopyIcon, ScissorsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/bootstrap-2-3-2/dropdown-menu';

export function BootstrapDropdownInset() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Clipboard</DropdownMenuLabel>
          <DropdownMenuItem value="copy"><CopyIcon size={14} /> Copy</DropdownMenuItem>
          <DropdownMenuItem value="cut"><ScissorsIcon size={14} /> Cut</DropdownMenuItem>
          <DropdownMenuItem value="paste" inset>Paste</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel inset>More actions</DropdownMenuLabel>
          <DropdownMenuItem value="rename" inset>Rename</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-liquid-glass-dropdown-menu': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/liquid-glass/dropdown-menu';

export function LiquidGlassDropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuItem value="profile">Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem value="billing">Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem value="settings">Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Team actions">
          <DropdownMenuItem value="team">Team</DropdownMenuItem>
          <DropdownMenuItem value="new-team">New Team <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup a11yLabel="Resources">
          <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
          <DropdownMenuItem value="support">Support</DropdownMenuItem>
          <DropdownMenuItem value="api" disabled>API</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="logout">Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-liquid-glass-dropdown-menu-destructive': `import { CopyIcon, ShareIcon, TrashIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/liquid-glass/dropdown-menu';

export function LiquidGlassDropdownDestructive() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Document</DropdownMenuLabel>
          <DropdownMenuItem value="copy"><CopyIcon size={16} /> Copy</DropdownMenuItem>
          <DropdownMenuItem value="share"><ShareIcon size={16} /> Share</DropdownMenuItem>
          <DropdownMenuItem value="rename" inset>Rename</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem value="delete" variant="destructive">
            <TrashIcon size={16} /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}`,
    'demo-liquid-glass-dropdown-menu-prominence': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/liquid-glass/dropdown-menu';

export function LiquidGlassDropdownProminence() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger prominence="regular" indicator>Options</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem value="duplicate">Duplicate</DropdownMenuItem>
          <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger prominence="prominent" indicator>Create New</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>New item</DropdownMenuLabel>
          <DropdownMenuItem value="note">Note</DropdownMenuItem>
          <DropdownMenuItem value="folder">Folder</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}`,
    'demo-liquid-glass-dropdown-menu-opaque': `import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/liquid-glass/dropdown-menu';

export function LiquidGlassDropdownOpaque() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger material="opaque">Opaque Surface</DropdownMenuTrigger>
        <DropdownMenuContent align="start" material="opaque" className="w-44">
          <DropdownMenuLabel>Solid fallback</DropdownMenuLabel>
          <DropdownMenuItem value="inspect">Inspect</DropdownMenuItem>
          <DropdownMenuItem value="export">Export</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger disabled>Unavailable</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem value="locked">Locked</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}`,
  },
  vue: {
    'demo-shadcn-dropdown-menu': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-40">
      <DropdownMenuGroup>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem value="profile" text-value="Profile">
          Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem value="billing" text-value="Billing">
          Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem value="settings" text-value="Settings">
          Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup a11y-label="Team actions">
        <DropdownMenuItem value="team">Team</DropdownMenuItem>
        <DropdownMenuItem value="new-team">
          New Team <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup a11y-label="Resources">
        <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
        <DropdownMenuItem value="support">Support</DropdownMenuItem>
        <DropdownMenuItem value="api" disabled>API</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="logout">
        Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-menu-basic': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-40">
      <DropdownMenuGroup>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem value="profile">Profile</DropdownMenuItem>
        <DropdownMenuItem value="billing">Billing</DropdownMenuItem>
        <DropdownMenuItem value="settings">Settings</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
      <DropdownMenuItem value="support">Support</DropdownMenuItem>
      <DropdownMenuItem value="api" disabled>API</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-menu-shortcuts': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-44">
      <DropdownMenuGroup>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem value="profile">Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="billing">Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="settings">Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="logout">Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-destructive': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuGroup>
        <DropdownMenuItem value="edit">Edit</DropdownMenuItem>
        <DropdownMenuItem value="share">Share</DropdownMenuItem>
        <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem value="delete" variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-inset': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-44">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Clipboard</DropdownMenuLabel>
        <DropdownMenuItem value="copy">Copy <DropdownMenuShortcut>⌘C</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="cut">Cut <DropdownMenuShortcut>⌘X</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="paste" inset>Paste <DropdownMenuShortcut>⌘V</DropdownMenuShortcut></DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel inset>More actions</DropdownMenuLabel>
        <DropdownMenuItem value="rename" inset>Rename</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-menu-indicator': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <DropdownMenu>
      <DropdownMenuTrigger indicator indicator-icon="chevron-down">Options</DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-40">
        <DropdownMenuItem value="duplicate">Duplicate</DropdownMenuItem>
        <DropdownMenuItem value="export">Export</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu>
      <DropdownMenuTrigger indicator indicator-icon="chevrons-up-down">Workspace</DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" :side-offset="6" class="w-40">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuItem value="personal">Personal</DropdownMenuItem>
        <DropdownMenuItem value="studio">Design Studio</DropdownMenuItem>
        <DropdownMenuItem value="acme">Acme Inc.</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>`,
    'demo-brutalist-dropdown-menu': `<template>
  <BrutalistDropdownRoot>
    <BrutalistDropdownTrigger>Open</BrutalistDropdownTrigger>
    <BrutalistDropdownContent align="start" class="w-44">
      <BrutalistDropdownGroup>
        <BrutalistDropdownLabel>My Account</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="profile">Profile <BrutalistDropdownShortcut>⇧⌘P</BrutalistDropdownShortcut></BrutalistDropdownItem>
        <BrutalistDropdownItem value="billing">Billing <BrutalistDropdownShortcut>⌘B</BrutalistDropdownShortcut></BrutalistDropdownItem>
        <BrutalistDropdownItem value="settings">Settings <BrutalistDropdownShortcut>⌘S</BrutalistDropdownShortcut></BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup a11y-label="Team actions">
        <BrutalistDropdownItem value="team">Team</BrutalistDropdownItem>
        <BrutalistDropdownItem value="new-team">New Team <BrutalistDropdownShortcut>⌘+T</BrutalistDropdownShortcut></BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup a11y-label="Resources">
        <BrutalistDropdownItem value="github">GitHub</BrutalistDropdownItem>
        <BrutalistDropdownItem value="support">Support</BrutalistDropdownItem>
        <BrutalistDropdownItem value="api" disabled>API</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownItem value="logout">Log out <BrutalistDropdownShortcut>⇧⌘Q</BrutalistDropdownShortcut></BrutalistDropdownItem>
    </BrutalistDropdownContent>
  </BrutalistDropdownRoot>
</template>`,
    'demo-brutalist-dropdown-menu-destructive': `<template>
  <BrutalistDropdownRoot>
    <BrutalistDropdownTrigger>Actions</BrutalistDropdownTrigger>
    <BrutalistDropdownContent align="start" class="w-44">
      <BrutalistDropdownGroup>
        <BrutalistDropdownItem value="edit">Edit</BrutalistDropdownItem>
        <BrutalistDropdownItem value="share">Share</BrutalistDropdownItem>
        <BrutalistDropdownItem value="archive">Archive</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup>
        <BrutalistDropdownItem value="delete" variant="destructive">Delete</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
    </BrutalistDropdownContent>
  </BrutalistDropdownRoot>
</template>`,
    'demo-brutalist-dropdown-menu-inset': `<template>
  <BrutalistDropdownRoot>
    <BrutalistDropdownTrigger>Edit</BrutalistDropdownTrigger>
    <BrutalistDropdownContent align="start" class="w-44">
      <BrutalistDropdownGroup>
        <BrutalistDropdownLabel>Clipboard</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="copy">Copy</BrutalistDropdownItem>
        <BrutalistDropdownItem value="cut">Cut</BrutalistDropdownItem>
        <BrutalistDropdownItem value="paste" inset>Paste</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup>
        <BrutalistDropdownLabel inset>More actions</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="rename" inset>Rename</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
    </BrutalistDropdownContent>
  </BrutalistDropdownRoot>
</template>`,
    'demo-brutalist-dropdown-menu-indicator': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistDropdownRoot>
      <BrutalistDropdownTrigger indicator indicator-icon="chevron-down">Options</BrutalistDropdownTrigger>
      <BrutalistDropdownContent align="end" class="w-40">
        <BrutalistDropdownItem value="duplicate">Duplicate</BrutalistDropdownItem>
        <BrutalistDropdownItem value="export">Export</BrutalistDropdownItem>
        <BrutalistDropdownSeparator />
        <BrutalistDropdownItem value="delete" variant="destructive">Delete</BrutalistDropdownItem>
      </BrutalistDropdownContent>
    </BrutalistDropdownRoot>

    <BrutalistDropdownRoot>
      <BrutalistDropdownTrigger indicator indicator-icon="chevrons-up-down">Workspace</BrutalistDropdownTrigger>
      <BrutalistDropdownContent align="start" class="w-40">
        <BrutalistDropdownLabel>Switch workspace</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="personal">Personal</BrutalistDropdownItem>
        <BrutalistDropdownItem value="studio">Design Studio</BrutalistDropdownItem>
      </BrutalistDropdownContent>
    </BrutalistDropdownRoot>
  </div>
</template>`,
    'demo-bootstrap-2-3-2-dropdown-menu': `<template>
  <BootstrapDropdownRoot>
    <BootstrapDropdownTrigger>Open</BootstrapDropdownTrigger>
    <BootstrapDropdownContent align="start" class="w-40">
      <BootstrapDropdownGroup>
        <BootstrapDropdownLabel>My Account</BootstrapDropdownLabel>
        <BootstrapDropdownItem value="profile">Profile <BootstrapDropdownShortcut>⇧⌘P</BootstrapDropdownShortcut></BootstrapDropdownItem>
        <BootstrapDropdownItem value="billing">Billing <BootstrapDropdownShortcut>⌘B</BootstrapDropdownShortcut></BootstrapDropdownItem>
        <BootstrapDropdownItem value="settings">Settings <BootstrapDropdownShortcut>⌘S</BootstrapDropdownShortcut></BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup a11y-label="Team actions">
        <BootstrapDropdownItem value="team">Team</BootstrapDropdownItem>
        <BootstrapDropdownItem value="new-team">New Team <BootstrapDropdownShortcut>⌘+T</BootstrapDropdownShortcut></BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup a11y-label="Resources">
        <BootstrapDropdownItem value="github">GitHub</BootstrapDropdownItem>
        <BootstrapDropdownItem value="support">Support</BootstrapDropdownItem>
        <BootstrapDropdownItem value="api" disabled>API</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownItem value="logout">Log out <BootstrapDropdownShortcut>⇧⌘Q</BootstrapDropdownShortcut></BootstrapDropdownItem>
    </BootstrapDropdownContent>
  </BootstrapDropdownRoot>
</template>`,
    'demo-bootstrap-2-3-2-dropdown-menu-destructive': `<template>
  <BootstrapDropdownRoot>
    <BootstrapDropdownTrigger>Actions</BootstrapDropdownTrigger>
    <BootstrapDropdownContent align="start" class="w-44">
      <BootstrapDropdownGroup>
        <BootstrapDropdownItem value="edit">Edit</BootstrapDropdownItem>
        <BootstrapDropdownItem value="share">Share</BootstrapDropdownItem>
        <BootstrapDropdownItem value="archive" disabled>Archive</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup>
        <BootstrapDropdownItem value="delete" variant="destructive">Delete</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
    </BootstrapDropdownContent>
  </BootstrapDropdownRoot>
</template>`,
    'demo-bootstrap-2-3-2-dropdown-menu-inset': `<template>
  <BootstrapDropdownRoot>
    <BootstrapDropdownTrigger>Edit</BootstrapDropdownTrigger>
    <BootstrapDropdownContent align="start" class="w-44">
      <BootstrapDropdownGroup>
        <BootstrapDropdownLabel>Clipboard</BootstrapDropdownLabel>
        <BootstrapDropdownItem value="copy">Copy</BootstrapDropdownItem>
        <BootstrapDropdownItem value="cut">Cut</BootstrapDropdownItem>
        <BootstrapDropdownItem value="paste" inset>Paste</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup>
        <BootstrapDropdownLabel inset>More actions</BootstrapDropdownLabel>
        <BootstrapDropdownItem value="rename" inset>Rename</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
    </BootstrapDropdownContent>
  </BootstrapDropdownRoot>
</template>`,
    'demo-liquid-glass-dropdown-menu': `<template>
  <LiquidGlassDropdownRoot>
    <LiquidGlassDropdownTrigger>Open</LiquidGlassDropdownTrigger>
    <LiquidGlassDropdownContent align="start" class="w-44">
      <LiquidGlassDropdownGroup>
        <LiquidGlassDropdownLabel>My Account</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="profile">Profile <LiquidGlassDropdownShortcut>⇧⌘P</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="billing">Billing <LiquidGlassDropdownShortcut>⌘B</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="settings">Settings <LiquidGlassDropdownShortcut>⌘S</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownGroup a11y-label="Team actions">
        <LiquidGlassDropdownItem value="team">Team</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="new-team">New Team <LiquidGlassDropdownShortcut>⌘+T</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownGroup a11y-label="Resources">
        <LiquidGlassDropdownItem value="github">GitHub</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="support">Support</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="api" disabled>API</LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownItem value="logout">Log out <LiquidGlassDropdownShortcut>⇧⌘Q</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
    </LiquidGlassDropdownContent>
  </LiquidGlassDropdownRoot>
</template>`,
    'demo-liquid-glass-dropdown-menu-destructive': `<template>
  <LiquidGlassDropdownRoot>
    <LiquidGlassDropdownTrigger>Actions</LiquidGlassDropdownTrigger>
    <LiquidGlassDropdownContent align="start" class="w-48">
      <LiquidGlassDropdownGroup>
        <LiquidGlassDropdownLabel>Document</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="copy">Copy</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="share">Share</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="rename" inset>Rename</LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownGroup>
        <LiquidGlassDropdownItem value="delete" variant="destructive">Delete</LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
    </LiquidGlassDropdownContent>
  </LiquidGlassDropdownRoot>
</template>`,
    'demo-liquid-glass-dropdown-menu-prominence': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger prominence="regular" indicator>Options</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent align="start" class="w-40">
        <LiquidGlassDropdownItem value="duplicate">Duplicate</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="archive">Archive</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>

    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger prominence="prominent" indicator>Create New</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent align="end" class="w-44">
        <LiquidGlassDropdownLabel>New item</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="note">Note</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="folder">Folder</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>
  </div>
</template>`,
    'demo-liquid-glass-dropdown-menu-opaque': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger material="opaque">Opaque Surface</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent align="start" material="opaque" class="w-44">
        <LiquidGlassDropdownLabel>Solid fallback</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="inspect">Inspect</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="export">Export</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>

    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger disabled>Unavailable</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent>
        <LiquidGlassDropdownItem value="locked">Locked</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>
  </div>
</template>`,
  },
  vue2: {
    'demo-shadcn-dropdown-menu': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-40">
      <DropdownMenuGroup>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem value="profile" text-value="Profile">
          Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem value="billing" text-value="Billing">
          Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem value="settings" text-value="Settings">
          Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup a11y-label="Team actions">
        <DropdownMenuItem value="team">Team</DropdownMenuItem>
        <DropdownMenuItem value="new-team">
          New Team <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup a11y-label="Resources">
        <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
        <DropdownMenuItem value="support">Support</DropdownMenuItem>
        <DropdownMenuItem value="api" :disabled="true">API</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="logout">
        Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-menu-basic': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-40">
      <DropdownMenuGroup>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem value="profile">Profile</DropdownMenuItem>
        <DropdownMenuItem value="billing">Billing</DropdownMenuItem>
        <DropdownMenuItem value="settings">Settings</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="github">GitHub</DropdownMenuItem>
      <DropdownMenuItem value="support">Support</DropdownMenuItem>
      <DropdownMenuItem value="api" :disabled="true">API</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-menu-shortcuts': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Open</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-44">
      <DropdownMenuGroup>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem value="profile">Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="billing">Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="settings">Settings <DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="logout">Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-destructive': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuGroup>
        <DropdownMenuItem value="edit">Edit</DropdownMenuItem>
        <DropdownMenuItem value="share">Share</DropdownMenuItem>
        <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem value="delete" variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-inset': `<template>
  <DropdownMenu>
    <DropdownMenuTrigger>Edit</DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-44">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Clipboard</DropdownMenuLabel>
        <DropdownMenuItem value="copy">Copy <DropdownMenuShortcut>⌘C</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="cut">Cut <DropdownMenuShortcut>⌘X</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem value="paste" :inset="true">Paste <DropdownMenuShortcut>⌘V</DropdownMenuShortcut></DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel :inset="true">More actions</DropdownMenuLabel>
        <DropdownMenuItem value="rename" :inset="true">Rename</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>`,
    'demo-shadcn-dropdown-menu-indicator': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <DropdownMenu>
      <DropdownMenuTrigger :indicator="true" indicator-icon="chevron-down">Options</DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-40">
        <DropdownMenuItem value="duplicate">Duplicate</DropdownMenuItem>
        <DropdownMenuItem value="export">Export</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu>
      <DropdownMenuTrigger :indicator="true" indicator-icon="chevrons-up-down">Workspace</DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" :side-offset="6" class="w-40">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuItem value="personal">Personal</DropdownMenuItem>
        <DropdownMenuItem value="studio">Design Studio</DropdownMenuItem>
        <DropdownMenuItem value="acme">Acme Inc.</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>`,
    'demo-brutalist-dropdown-menu': `<template>
  <BrutalistDropdownRoot>
    <BrutalistDropdownTrigger>Open</BrutalistDropdownTrigger>
    <BrutalistDropdownContent align="start" class="w-44">
      <BrutalistDropdownGroup>
        <BrutalistDropdownLabel>My Account</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="profile">Profile <BrutalistDropdownShortcut>⇧⌘P</BrutalistDropdownShortcut></BrutalistDropdownItem>
        <BrutalistDropdownItem value="billing">Billing <BrutalistDropdownShortcut>⌘B</BrutalistDropdownShortcut></BrutalistDropdownItem>
        <BrutalistDropdownItem value="settings">Settings <BrutalistDropdownShortcut>⌘S</BrutalistDropdownShortcut></BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup a11y-label="Team actions">
        <BrutalistDropdownItem value="team">Team</BrutalistDropdownItem>
        <BrutalistDropdownItem value="new-team">New Team <BrutalistDropdownShortcut>⌘+T</BrutalistDropdownShortcut></BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup a11y-label="Resources">
        <BrutalistDropdownItem value="github">GitHub</BrutalistDropdownItem>
        <BrutalistDropdownItem value="support">Support</BrutalistDropdownItem>
        <BrutalistDropdownItem value="api" :disabled="true">API</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownItem value="logout">Log out <BrutalistDropdownShortcut>⇧⌘Q</BrutalistDropdownShortcut></BrutalistDropdownItem>
    </BrutalistDropdownContent>
  </BrutalistDropdownRoot>
</template>`,
    'demo-brutalist-dropdown-menu-destructive': `<template>
  <BrutalistDropdownRoot>
    <BrutalistDropdownTrigger>Actions</BrutalistDropdownTrigger>
    <BrutalistDropdownContent align="start" class="w-44">
      <BrutalistDropdownGroup>
        <BrutalistDropdownItem value="edit">Edit</BrutalistDropdownItem>
        <BrutalistDropdownItem value="share">Share</BrutalistDropdownItem>
        <BrutalistDropdownItem value="archive">Archive</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup>
        <BrutalistDropdownItem value="delete" variant="destructive">Delete</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
    </BrutalistDropdownContent>
  </BrutalistDropdownRoot>
</template>`,
    'demo-brutalist-dropdown-menu-inset': `<template>
  <BrutalistDropdownRoot>
    <BrutalistDropdownTrigger>Edit</BrutalistDropdownTrigger>
    <BrutalistDropdownContent align="start" class="w-44">
      <BrutalistDropdownGroup>
        <BrutalistDropdownLabel>Clipboard</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="copy">Copy</BrutalistDropdownItem>
        <BrutalistDropdownItem value="cut">Cut</BrutalistDropdownItem>
        <BrutalistDropdownItem value="paste" :inset="true">Paste</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
      <BrutalistDropdownSeparator />
      <BrutalistDropdownGroup>
        <BrutalistDropdownLabel :inset="true">More actions</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="rename" :inset="true">Rename</BrutalistDropdownItem>
      </BrutalistDropdownGroup>
    </BrutalistDropdownContent>
  </BrutalistDropdownRoot>
</template>`,
    'demo-brutalist-dropdown-menu-indicator': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <BrutalistDropdownRoot>
      <BrutalistDropdownTrigger :indicator="true" indicator-icon="chevron-down">Options</BrutalistDropdownTrigger>
      <BrutalistDropdownContent align="end" class="w-40">
        <BrutalistDropdownItem value="duplicate">Duplicate</BrutalistDropdownItem>
        <BrutalistDropdownItem value="export">Export</BrutalistDropdownItem>
        <BrutalistDropdownSeparator />
        <BrutalistDropdownItem value="delete" variant="destructive">Delete</BrutalistDropdownItem>
      </BrutalistDropdownContent>
    </BrutalistDropdownRoot>

    <BrutalistDropdownRoot>
      <BrutalistDropdownTrigger :indicator="true" indicator-icon="chevrons-up-down">Workspace</BrutalistDropdownTrigger>
      <BrutalistDropdownContent align="start" class="w-40">
        <BrutalistDropdownLabel>Switch workspace</BrutalistDropdownLabel>
        <BrutalistDropdownItem value="personal">Personal</BrutalistDropdownItem>
        <BrutalistDropdownItem value="studio">Design Studio</BrutalistDropdownItem>
      </BrutalistDropdownContent>
    </BrutalistDropdownRoot>
  </div>
</template>`,
    'demo-bootstrap-2-3-2-dropdown-menu': `<template>
  <BootstrapDropdownRoot>
    <BootstrapDropdownTrigger>Open</BootstrapDropdownTrigger>
    <BootstrapDropdownContent align="start" class="w-40">
      <BootstrapDropdownGroup>
        <BootstrapDropdownLabel>My Account</BootstrapDropdownLabel>
        <BootstrapDropdownItem value="profile">Profile <BootstrapDropdownShortcut>⇧⌘P</BootstrapDropdownShortcut></BootstrapDropdownItem>
        <BootstrapDropdownItem value="billing">Billing <BootstrapDropdownShortcut>⌘B</BootstrapDropdownShortcut></BootstrapDropdownItem>
        <BootstrapDropdownItem value="settings">Settings <BootstrapDropdownShortcut>⌘S</BootstrapDropdownShortcut></BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup a11y-label="Team actions">
        <BootstrapDropdownItem value="team">Team</BootstrapDropdownItem>
        <BootstrapDropdownItem value="new-team">New Team <BootstrapDropdownShortcut>⌘+T</BootstrapDropdownShortcut></BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup a11y-label="Resources">
        <BootstrapDropdownItem value="github">GitHub</BootstrapDropdownItem>
        <BootstrapDropdownItem value="support">Support</BootstrapDropdownItem>
        <BootstrapDropdownItem value="api" :disabled="true">API</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownItem value="logout">Log out <BootstrapDropdownShortcut>⇧⌘Q</BootstrapDropdownShortcut></BootstrapDropdownItem>
    </BootstrapDropdownContent>
  </BootstrapDropdownRoot>
</template>`,
    'demo-bootstrap-2-3-2-dropdown-menu-destructive': `<template>
  <BootstrapDropdownRoot>
    <BootstrapDropdownTrigger>Actions</BootstrapDropdownTrigger>
    <BootstrapDropdownContent align="start" class="w-44">
      <BootstrapDropdownGroup>
        <BootstrapDropdownItem value="edit">Edit</BootstrapDropdownItem>
        <BootstrapDropdownItem value="share">Share</BootstrapDropdownItem>
        <BootstrapDropdownItem value="archive" :disabled="true">Archive</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup>
        <BootstrapDropdownItem value="delete" variant="destructive">Delete</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
    </BootstrapDropdownContent>
  </BootstrapDropdownRoot>
</template>`,
    'demo-bootstrap-2-3-2-dropdown-menu-inset': `<template>
  <BootstrapDropdownRoot>
    <BootstrapDropdownTrigger>Edit</BootstrapDropdownTrigger>
    <BootstrapDropdownContent align="start" class="w-44">
      <BootstrapDropdownGroup>
        <BootstrapDropdownLabel>Clipboard</BootstrapDropdownLabel>
        <BootstrapDropdownItem value="copy">Copy</BootstrapDropdownItem>
        <BootstrapDropdownItem value="cut">Cut</BootstrapDropdownItem>
        <BootstrapDropdownItem value="paste" :inset="true">Paste</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
      <BootstrapDropdownSeparator />
      <BootstrapDropdownGroup>
        <BootstrapDropdownLabel :inset="true">More actions</BootstrapDropdownLabel>
        <BootstrapDropdownItem value="rename" :inset="true">Rename</BootstrapDropdownItem>
      </BootstrapDropdownGroup>
    </BootstrapDropdownContent>
  </BootstrapDropdownRoot>
</template>`,
    'demo-liquid-glass-dropdown-menu': `<template>
  <LiquidGlassDropdownRoot>
    <LiquidGlassDropdownTrigger>Open</LiquidGlassDropdownTrigger>
    <LiquidGlassDropdownContent align="start" class="w-44">
      <LiquidGlassDropdownGroup>
        <LiquidGlassDropdownLabel>My Account</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="profile">Profile <LiquidGlassDropdownShortcut>⇧⌘P</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="billing">Billing <LiquidGlassDropdownShortcut>⌘B</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="settings">Settings <LiquidGlassDropdownShortcut>⌘S</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownGroup a11y-label="Team actions">
        <LiquidGlassDropdownItem value="team">Team</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="new-team">New Team <LiquidGlassDropdownShortcut>⌘+T</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownGroup a11y-label="Resources">
        <LiquidGlassDropdownItem value="github">GitHub</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="support">Support</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="api" :disabled="true">API</LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownItem value="logout">Log out <LiquidGlassDropdownShortcut>⇧⌘Q</LiquidGlassDropdownShortcut></LiquidGlassDropdownItem>
    </LiquidGlassDropdownContent>
  </LiquidGlassDropdownRoot>
</template>`,
    'demo-liquid-glass-dropdown-menu-destructive': `<template>
  <LiquidGlassDropdownRoot>
    <LiquidGlassDropdownTrigger>Actions</LiquidGlassDropdownTrigger>
    <LiquidGlassDropdownContent align="start" class="w-48">
      <LiquidGlassDropdownGroup>
        <LiquidGlassDropdownLabel>Document</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="copy">Copy</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="share">Share</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="rename" :inset="true">Rename</LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
      <LiquidGlassDropdownSeparator />
      <LiquidGlassDropdownGroup>
        <LiquidGlassDropdownItem value="delete" variant="destructive">Delete</LiquidGlassDropdownItem>
      </LiquidGlassDropdownGroup>
    </LiquidGlassDropdownContent>
  </LiquidGlassDropdownRoot>
</template>`,
    'demo-liquid-glass-dropdown-menu-prominence': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger prominence="regular" :indicator="true">Options</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent align="start" class="w-40">
        <LiquidGlassDropdownItem value="duplicate">Duplicate</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="archive">Archive</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>

    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger prominence="prominent" :indicator="true">Create New</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent align="end" class="w-44">
        <LiquidGlassDropdownLabel>New item</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="note">Note</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="folder">Folder</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>
  </div>
</template>`,
    'demo-liquid-glass-dropdown-menu-opaque': `<template>
  <div class="flex flex-wrap items-center gap-4">
    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger material="opaque">Opaque Surface</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent align="start" material="opaque" class="w-44">
        <LiquidGlassDropdownLabel>Solid fallback</LiquidGlassDropdownLabel>
        <LiquidGlassDropdownItem value="inspect">Inspect</LiquidGlassDropdownItem>
        <LiquidGlassDropdownItem value="export">Export</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>

    <LiquidGlassDropdownRoot>
      <LiquidGlassDropdownTrigger :disabled="true">Unavailable</LiquidGlassDropdownTrigger>
      <LiquidGlassDropdownContent>
        <LiquidGlassDropdownItem value="locked">Locked</LiquidGlassDropdownItem>
      </LiquidGlassDropdownContent>
    </LiquidGlassDropdownRoot>
  </div>
</template>`,
  },
};
