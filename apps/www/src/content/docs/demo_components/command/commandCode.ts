import { formatCode } from '../../../../utils/conversionUtils';
import type { RuntimeId } from '@/components/PrototypePreviewer/runtimes/ids';

const shadcnInlineWc = formatCode(`
<shadcn-style-scope id="command-scope" class="contents">
  <div class="w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md">
    <shadcn-command-root id="command-root">
      <shadcn-command-input-wrapper>
        <shadcn-input-shell id="command-shell">
          <shadcn-command-input id="command-input"></shadcn-command-input>
        </shadcn-input-shell>
      </shadcn-command-input-wrapper>
      <shadcn-command-content>
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">Suggestions</div>
        <shadcn-command-item data-cmd="calendar">Calendar</shadcn-command-item>
        <shadcn-command-item data-cmd="search-emoji">Search Emoji</shadcn-command-item>
        <shadcn-command-item data-cmd="calculator">Calculator</shadcn-command-item>
        <div class="my-1 h-px bg-border" role="separator"></div>
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">Settings</div>
        <shadcn-command-item data-cmd="profile"><span>Profile</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘P</span></shadcn-command-item>
        <shadcn-command-item data-cmd="billing"><span>Billing</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘B</span></shadcn-command-item>
        <shadcn-command-item data-cmd="settings"><span>Settings</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘S</span></shadcn-command-item>
        <shadcn-command-empty>No results found.</shadcn-command-empty>
      </shadcn-command-content>
    </shadcn-command-root>
  </div>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#command-scope'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#command-shell'), { focusIndicator: 'none' });
  setElementProps(document.querySelector('#command-input'), {
    placeholder: 'Type a command or search...',
    a11yLabel: 'Type a command or search',
  });
  const root = document.querySelector('#command-root');
  setElementProps(root, { a11yLabel: 'Command menu' });
  root.addEventListener('execute', (event) => console.log('execute', event.detail));
</script>
`);

const shadcnInlineReact = formatCode(`
import {
  ShadcnStyleScope,
  ShadcnCommandRoot,
  ShadcnCommandInputWrapper,
  ShadcnInputShell,
  ShadcnCommandInput,
  ShadcnCommandContent,
  ShadcnCommandItem,
  ShadcnCommandEmpty,
} from '@/components/ui/command';

export function CommandDemo() {
  return (
    <ShadcnStyleScope styleProfile="rhea" className="contents">
      <div className="w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md">
        <ShadcnCommandRoot
          a11yLabel="Command menu"
          onExecute={(detail) => console.log('execute', detail)}
        >
          <ShadcnCommandInputWrapper>
            <ShadcnInputShell focusIndicator="none">
              <ShadcnCommandInput
                placeholder="Type a command or search..."
                a11yLabel="Type a command or search"
              />
            </ShadcnInputShell>
          </ShadcnCommandInputWrapper>
          <ShadcnCommandContent>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">Suggestions</div>
            <ShadcnCommandItem value="calendar" textValue="Calendar">Calendar</ShadcnCommandItem>
            <ShadcnCommandItem value="search-emoji" textValue="Search Emoji">Search Emoji</ShadcnCommandItem>
            <ShadcnCommandItem value="calculator" textValue="Calculator" disabled>Calculator</ShadcnCommandItem>
            <div className="my-1 h-px bg-border" role="separator" />
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">Settings</div>
            <ShadcnCommandItem value="profile" textValue="Profile">
              <span>Profile</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">⌘P</span>
            </ShadcnCommandItem>
            <ShadcnCommandItem value="billing" textValue="Billing">
              <span>Billing</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">⌘B</span>
            </ShadcnCommandItem>
            <ShadcnCommandItem value="settings" textValue="Settings">
              <span>Settings</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">⌘S</span>
            </ShadcnCommandItem>
            <ShadcnCommandEmpty>No results found.</ShadcnCommandEmpty>
          </ShadcnCommandContent>
        </ShadcnCommandRoot>
      </div>
    </ShadcnStyleScope>
  );
}
`);

const shadcnInlineVue = formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea" class="contents">
    <div class="w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md">
      <ShadcnCommandRoot a11y-label="Command menu" @execute="onExecute">
        <ShadcnCommandInputWrapper>
          <ShadcnInputShell focus-indicator="none">
            <ShadcnCommandInput placeholder="Type a command or search..." a11y-label="Type a command or search" />
          </ShadcnInputShell>
        </ShadcnCommandInputWrapper>
        <ShadcnCommandContent>
          <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">Suggestions</div>
          <ShadcnCommandItem value="calendar" text-value="Calendar">Calendar</ShadcnCommandItem>
          <ShadcnCommandItem value="search-emoji" text-value="Search Emoji">Search Emoji</ShadcnCommandItem>
          <ShadcnCommandItem value="calculator" text-value="Calculator" :disabled="true">Calculator</ShadcnCommandItem>
          <div class="my-1 h-px bg-border" role="separator" />
          <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground" aria-hidden="true">Settings</div>
          <ShadcnCommandItem value="profile" text-value="Profile">
            <span>Profile</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘P</span>
          </ShadcnCommandItem>
          <ShadcnCommandItem value="billing" text-value="Billing">
            <span>Billing</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘B</span>
          </ShadcnCommandItem>
          <ShadcnCommandItem value="settings" text-value="Settings">
            <span>Settings</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘S</span>
          </ShadcnCommandItem>
          <ShadcnCommandEmpty>No results found.</ShadcnCommandEmpty>
        </ShadcnCommandContent>
      </ShadcnCommandRoot>
    </div>
  </ShadcnStyleScope>
</template>
`);

const shadcnDialogWc = formatCode(`
<shadcn-style-scope id="dialog-scope" class="contents">
  <shadcn-dialog-root>
    <shadcn-dialog-trigger>Open Menu</shadcn-dialog-trigger>
    <shadcn-command-dialog-mask id="cmd-mask"></shadcn-command-dialog-mask>
    <shadcn-command-dialog-content id="cmd-dialog">
      <shadcn-dialog-title class="sr-only">Command Palette</shadcn-dialog-title>
      <shadcn-dialog-description class="sr-only">Search for a command to run.</shadcn-dialog-description>
      <shadcn-command-root id="cmd-root">
        <shadcn-command-input-wrapper>
          <shadcn-input-shell id="cmd-shell">
            <shadcn-command-input id="cmd-input"></shadcn-command-input>
          </shadcn-input-shell>
        </shadcn-command-input-wrapper>
        <shadcn-command-content>
          <shadcn-command-item>Calendar</shadcn-command-item>
          <shadcn-command-item>Search Emoji</shadcn-command-item>
          <shadcn-command-item>Calculator</shadcn-command-item>
          <shadcn-command-empty>No results found.</shadcn-command-empty>
        </shadcn-command-content>
      </shadcn-command-root>
    </shadcn-command-dialog-content>
  </shadcn-dialog-root>
</shadcn-style-scope>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#dialog-scope'), { styleProfile: 'rhea' });
  setElementProps(document.querySelector('#cmd-mask'), { enterDuration: 100, leaveDuration: 100 });
  setElementProps(document.querySelector('#cmd-dialog'), { enterDuration: 100, leaveDuration: 100 });
  setElementProps(document.querySelector('#cmd-shell'), { focusIndicator: 'none' });
  setElementProps(document.querySelector('#cmd-input'), { placeholder: 'Type a command or search...' });
</script>
`);

const shadcnDialogReact = formatCode(`
import {
  ShadcnStyleScope,
  ShadcnDialogRoot,
  ShadcnDialogTrigger,
  ShadcnDialogTitle,
  ShadcnDialogDescription,
  ShadcnCommandDialogMask,
  ShadcnCommandDialogContent,
  ShadcnCommandRoot,
  ShadcnCommandInputWrapper,
  ShadcnInputShell,
  ShadcnCommandInput,
  ShadcnCommandContent,
  ShadcnCommandItem,
  ShadcnCommandEmpty,
} from '@/components/ui/command';

export function CommandDialogDemo() {
  return (
    <ShadcnStyleScope styleProfile="rhea" className="contents">
      <ShadcnDialogRoot>
        <ShadcnDialogTrigger>Open Menu</ShadcnDialogTrigger>
        <ShadcnCommandDialogMask enterDuration={100} leaveDuration={100} />
        <ShadcnCommandDialogContent enterDuration={100} leaveDuration={100}>
          <ShadcnDialogTitle className="sr-only">Command Palette</ShadcnDialogTitle>
          <ShadcnDialogDescription className="sr-only">Search for a command to run.</ShadcnDialogDescription>
          <ShadcnCommandRoot a11yLabel="Command menu">
            <ShadcnCommandInputWrapper>
              <ShadcnInputShell focusIndicator="none">
                <ShadcnCommandInput placeholder="Type a command or search..." />
              </ShadcnInputShell>
            </ShadcnCommandInputWrapper>
            <ShadcnCommandContent>
              <ShadcnCommandItem value="calendar" textValue="Calendar">Calendar</ShadcnCommandItem>
              <ShadcnCommandItem value="search-emoji" textValue="Search Emoji">Search Emoji</ShadcnCommandItem>
              <ShadcnCommandItem value="calculator" textValue="Calculator">Calculator</ShadcnCommandItem>
              <ShadcnCommandEmpty>No results found.</ShadcnCommandEmpty>
            </ShadcnCommandContent>
          </ShadcnCommandRoot>
        </ShadcnCommandDialogContent>
      </ShadcnDialogRoot>
    </ShadcnStyleScope>
  );
}
`);

const shadcnDialogVue = formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea" class="contents">
    <ShadcnDialogRoot>
      <ShadcnDialogTrigger>Open Menu</ShadcnDialogTrigger>
      <ShadcnCommandDialogMask :enter-duration="100" :leave-duration="100" />
      <ShadcnCommandDialogContent :enter-duration="100" :leave-duration="100">
        <ShadcnDialogTitle class="sr-only">Command Palette</ShadcnDialogTitle>
        <ShadcnDialogDescription class="sr-only">Search for a command to run.</ShadcnDialogDescription>
        <ShadcnCommandRoot a11y-label="Command menu">
          <ShadcnCommandInputWrapper>
            <ShadcnInputShell focus-indicator="none">
              <ShadcnCommandInput placeholder="Type a command or search..." />
            </ShadcnInputShell>
          </ShadcnCommandInputWrapper>
          <ShadcnCommandContent>
            <ShadcnCommandItem value="calendar" text-value="Calendar">Calendar</ShadcnCommandItem>
            <ShadcnCommandItem value="search-emoji" text-value="Search Emoji">Search Emoji</ShadcnCommandItem>
            <ShadcnCommandItem value="calculator" text-value="Calculator">Calculator</ShadcnCommandItem>
            <ShadcnCommandEmpty>No results found.</ShadcnCommandEmpty>
          </ShadcnCommandContent>
        </ShadcnCommandRoot>
      </ShadcnCommandDialogContent>
    </ShadcnDialogRoot>
  </ShadcnStyleScope>
</template>
`);

function makeSimpleFamilySnippets(
  prefix: 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass',
  pascal: 'Brutalist' | 'Bootstrap232' | 'LiquidGlass',
  dialogContentTag: string,
  dialogContentPascal: string
) {
  const inlineWc = formatCode(`
<div class="w-full max-w-sm">
  <${prefix}-command-root id="command-root">
    <${prefix}-command-input id="command-input"></${prefix}-command-input>
    <${prefix}-command-content>
      <${prefix}-command-item>Calendar</${prefix}-command-item>
      <${prefix}-command-item>Search Emoji</${prefix}-command-item>
      <${prefix}-command-item>Calculator</${prefix}-command-item>
      <${prefix}-command-item><span>Profile</span><span class="ml-auto font-mono text-xs">⌘P</span></${prefix}-command-item>
      <${prefix}-command-item><span>Billing</span><span class="ml-auto font-mono text-xs">⌘B</span></${prefix}-command-item>
      <${prefix}-command-item><span>Settings</span><span class="ml-auto font-mono text-xs">⌘S</span></${prefix}-command-item>
      <${prefix}-command-empty>No results found.</${prefix}-command-empty>
    </${prefix}-command-content>
  </${prefix}-command-root>
</div>
<script type="module">
  import { setElementProps } from '@proto.ui/adapter-web-component';
  setElementProps(document.querySelector('#command-input'), {
    placeholder: 'Type a command or search...',
    a11yLabel: 'Type a command or search',
  });
  const root = document.querySelector('#command-root');
  setElementProps(root, { a11yLabel: 'Command menu' });
  root.addEventListener('execute', (event) => console.log('execute', event.detail));
</script>
`);

  const inlineReact = formatCode(`
<${pascal}CommandRoot
  a11yLabel="Command menu"
  onExecute={(detail) => console.log('execute', detail)}
>
  <${pascal}CommandInput placeholder="Type a command or search..." a11yLabel="Type a command or search" />
  <${pascal}CommandContent>
    <${pascal}CommandItem value="calendar" textValue="Calendar">Calendar</${pascal}CommandItem>
    <${pascal}CommandItem value="search-emoji" textValue="Search Emoji">Search Emoji</${pascal}CommandItem>
    <${pascal}CommandItem value="calculator" textValue="Calculator" disabled>Calculator</${pascal}CommandItem>
    <${pascal}CommandItem value="profile" textValue="Profile">
      <span>Profile</span>
      <span className="ml-auto font-mono text-xs">⌘P</span>
    </${pascal}CommandItem>
    <${pascal}CommandItem value="billing" textValue="Billing">
      <span>Billing</span>
      <span className="ml-auto font-mono text-xs">⌘B</span>
    </${pascal}CommandItem>
    <${pascal}CommandItem value="settings" textValue="Settings">
      <span>Settings</span>
      <span className="ml-auto font-mono text-xs">⌘S</span>
    </${pascal}CommandItem>
    <${pascal}CommandEmpty>No results found.</${pascal}CommandEmpty>
  </${pascal}CommandContent>
</${pascal}CommandRoot>
`);

  const inlineVue = formatCode(`
<template>
  <${pascal}CommandRoot a11y-label="Command menu" @execute="onExecute">
    <${pascal}CommandInput placeholder="Type a command or search..." a11y-label="Type a command or search" />
    <${pascal}CommandContent>
      <${pascal}CommandItem value="calendar" text-value="Calendar">Calendar</${pascal}CommandItem>
      <${pascal}CommandItem value="search-emoji" text-value="Search Emoji">Search Emoji</${pascal}CommandItem>
      <${pascal}CommandItem value="calculator" text-value="Calculator" :disabled="true">Calculator</${pascal}CommandItem>
      <${pascal}CommandItem value="profile" text-value="Profile">
        <span>Profile</span><span class="ml-auto font-mono text-xs">⌘P</span>
      </${pascal}CommandItem>
      <${pascal}CommandItem value="billing" text-value="Billing">
        <span>Billing</span><span class="ml-auto font-mono text-xs">⌘B</span>
      </${pascal}CommandItem>
      <${pascal}CommandItem value="settings" text-value="Settings">
        <span>Settings</span><span class="ml-auto font-mono text-xs">⌘S</span>
      </${pascal}CommandItem>
      <${pascal}CommandEmpty>No results found.</${pascal}CommandEmpty>
    </${pascal}CommandContent>
  </${pascal}CommandRoot>
</template>
`);

  const dialogWc = formatCode(`
<${prefix}-dialog-root>
  <${prefix}-dialog-trigger>Open Menu</${prefix}-dialog-trigger>
  <${prefix}-dialog-mask></${prefix}-dialog-mask>
  <${dialogContentTag}>
    <${prefix}-dialog-title>Command Palette</${prefix}-dialog-title>
    <${prefix}-dialog-description>Search for a command to run.</${prefix}-dialog-description>
    <${prefix}-command-root>
      <${prefix}-command-input id="dialog-command-input"></${prefix}-command-input>
      <${prefix}-command-content>
        <${prefix}-command-item>Calendar</${prefix}-command-item>
        <${prefix}-command-item>Search Emoji</${prefix}-command-item>
        <${prefix}-command-item>Calculator</${prefix}-command-item>
        <${prefix}-command-empty>No results found.</${prefix}-command-empty>
      </${prefix}-command-content>
    </${prefix}-command-root>
  </${dialogContentTag}>
</${prefix}-dialog-root>
`);

  const dialogReact = formatCode(`
<${pascal}DialogRoot>
  <${pascal}DialogTrigger>Open Menu</${pascal}DialogTrigger>
  <${pascal}DialogMask />
  <${dialogContentPascal}>
    <${pascal}DialogTitle>Command Palette</${pascal}DialogTitle>
    <${pascal}DialogDescription>Search for a command to run.</${pascal}DialogDescription>
    <${pascal}CommandRoot a11yLabel="Command menu">
      <${pascal}CommandInput placeholder="Type a command or search..." />
      <${pascal}CommandContent>
        <${pascal}CommandItem value="calendar" textValue="Calendar">Calendar</${pascal}CommandItem>
        <${pascal}CommandItem value="search-emoji" textValue="Search Emoji">Search Emoji</${pascal}CommandItem>
        <${pascal}CommandItem value="calculator" textValue="Calculator">Calculator</${pascal}CommandItem>
        <${pascal}CommandEmpty>No results found.</${pascal}CommandEmpty>
      </${pascal}CommandContent>
    </${pascal}CommandRoot>
  </${dialogContentPascal}>
</${pascal}DialogRoot>
`);

  const dialogVue = formatCode(`
<template>
  <${pascal}DialogRoot>
    <${pascal}DialogTrigger>Open Menu</${pascal}DialogTrigger>
    <${pascal}DialogMask />
    <${dialogContentPascal}>
      <${pascal}DialogTitle>Command Palette</${pascal}DialogTitle>
      <${pascal}DialogDescription>Search for a command to run.</${pascal}DialogDescription>
      <${pascal}CommandRoot a11y-label="Command menu">
        <${pascal}CommandInput placeholder="Type a command or search..." />
        <${pascal}CommandContent>
          <${pascal}CommandItem value="calendar" text-value="Calendar">Calendar</${pascal}CommandItem>
          <${pascal}CommandItem value="search-emoji" text-value="Search Emoji">Search Emoji</${pascal}CommandItem>
          <${pascal}CommandItem value="calculator" text-value="Calculator">Calculator</${pascal}CommandItem>
          <${pascal}CommandEmpty>No results found.</${pascal}CommandEmpty>
        </${pascal}CommandContent>
      </${pascal}CommandRoot>
    </${dialogContentPascal}>
  </${pascal}DialogRoot>
</template>
`);

  const shortcutsWc = formatCode(`
<${prefix}-command-root id="shortcuts-root">
  <${prefix}-command-input id="shortcuts-input"></${prefix}-command-input>
  <${prefix}-command-content>
    <${prefix}-command-item><span>Profile</span><span class="ml-auto font-mono text-xs">⌘P</span></${prefix}-command-item>
    <${prefix}-command-item><span>Billing</span><span class="ml-auto font-mono text-xs">⌘B</span></${prefix}-command-item>
    <${prefix}-command-item><span>Settings</span><span class="ml-auto font-mono text-xs">⌘S</span></${prefix}-command-item>
    <${prefix}-command-item><span>Keyboard Shortcuts</span><span class="ml-auto font-mono text-xs">⌘K</span></${prefix}-command-item>
    <${prefix}-command-empty>No matching shortcuts.</${prefix}-command-empty>
  </${prefix}-command-content>
</${prefix}-command-root>
`);

  const shortcutsReact = formatCode(`
<${pascal}CommandRoot a11yLabel="Settings shortcuts">
  <${pascal}CommandInput placeholder="Search settings or keywords..." />
  <${pascal}CommandContent>
    <${pascal}CommandItem value="profile" textValue="Profile" keywords="account user">
      <span>Profile</span><span className="ml-auto font-mono text-xs">⌘P</span>
    </${pascal}CommandItem>
    <${pascal}CommandItem value="billing" textValue="Billing" keywords="invoice payment">
      <span>Billing</span><span className="ml-auto font-mono text-xs">⌘B</span>
    </${pascal}CommandItem>
    <${pascal}CommandItem value="settings" textValue="Settings" keywords="preferences config">
      <span>Settings</span><span className="ml-auto font-mono text-xs">⌘S</span>
    </${pascal}CommandItem>
    <${pascal}CommandItem value="shortcuts" textValue="Keyboard Shortcuts" keywords="hotkeys keybindings">
      <span>Keyboard Shortcuts</span><span className="ml-auto font-mono text-xs">⌘K</span>
    </${pascal}CommandItem>
    <${pascal}CommandEmpty>No matching shortcuts.</${pascal}CommandEmpty>
  </${pascal}CommandContent>
</${pascal}CommandRoot>
`);

  const shortcutsVue = formatCode(`
<template>
  <${pascal}CommandRoot a11y-label="Settings shortcuts">
    <${pascal}CommandInput placeholder="Search settings or keywords..." />
    <${pascal}CommandContent>
      <${pascal}CommandItem value="profile" text-value="Profile" keywords="account user">
        <span>Profile</span><span class="ml-auto font-mono text-xs">⌘P</span>
      </${pascal}CommandItem>
      <${pascal}CommandItem value="billing" text-value="Billing" keywords="invoice payment">
        <span>Billing</span><span class="ml-auto font-mono text-xs">⌘B</span>
      </${pascal}CommandItem>
      <${pascal}CommandItem value="settings" text-value="Settings" keywords="preferences config">
        <span>Settings</span><span class="ml-auto font-mono text-xs">⌘S</span>
      </${pascal}CommandItem>
      <${pascal}CommandItem value="shortcuts" text-value="Keyboard Shortcuts" keywords="hotkeys keybindings">
        <span>Keyboard Shortcuts</span><span class="ml-auto font-mono text-xs">⌘K</span>
      </${pascal}CommandItem>
      <${pascal}CommandEmpty>No matching shortcuts.</${pascal}CommandEmpty>
    </${pascal}CommandContent>
  </${pascal}CommandRoot>
</template>
`);

  return {
    inlineWc,
    inlineReact,
    inlineVue,
    dialogWc,
    dialogReact,
    dialogVue,
    shortcutsWc,
    shortcutsReact,
    shortcutsVue,
  };
}

const brutalist = makeSimpleFamilySnippets(
  'brutalist',
  'Brutalist',
  'brutalist-command-dialog-content',
  'BrutalistCommandDialogContent'
);
const bootstrap = makeSimpleFamilySnippets(
  'bootstrap-2-3-2',
  'Bootstrap232',
  'bootstrap-2-3-2-dialog-content',
  'Bootstrap232DialogContent'
);
const liquidGlass = makeSimpleFamilySnippets(
  'liquid-glass',
  'LiquidGlass',
  'liquid-glass-dialog-content',
  'LiquidGlassDialogContent'
);

const shadcnShortcutsWc = formatCode(`
<shadcn-style-scope id="shortcuts-scope" class="contents">
  <div class="w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md">
    <shadcn-command-root>
      <shadcn-command-input-wrapper>
        <shadcn-input-shell>
          <shadcn-command-input></shadcn-command-input>
        </shadcn-input-shell>
      </shadcn-command-input-wrapper>
      <shadcn-command-content>
        <shadcn-command-item><span>Profile</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘P</span></shadcn-command-item>
        <shadcn-command-item><span>Billing</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘B</span></shadcn-command-item>
        <shadcn-command-item><span>Settings</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘S</span></shadcn-command-item>
        <shadcn-command-item><span>Keyboard Shortcuts</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘K</span></shadcn-command-item>
        <shadcn-command-empty>No matching shortcuts.</shadcn-command-empty>
      </shadcn-command-content>
    </shadcn-command-root>
  </div>
</shadcn-style-scope>
`);

const shadcnShortcutsReact = formatCode(`
<ShadcnStyleScope styleProfile="rhea" className="contents">
  <div className="w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md">
    <ShadcnCommandRoot a11yLabel="Settings shortcuts">
      <ShadcnCommandInputWrapper>
        <ShadcnInputShell focusIndicator="none">
          <ShadcnCommandInput placeholder="Search settings or keywords..." />
        </ShadcnInputShell>
      </ShadcnCommandInputWrapper>
      <ShadcnCommandContent>
        <ShadcnCommandItem value="profile" textValue="Profile" keywords="account avatar user">
          <span>Profile</span><span className="ml-auto font-mono text-xs text-muted-foreground">⌘P</span>
        </ShadcnCommandItem>
        <ShadcnCommandItem value="billing" textValue="Billing" keywords="invoice payment plan">
          <span>Billing</span><span className="ml-auto font-mono text-xs text-muted-foreground">⌘B</span>
        </ShadcnCommandItem>
        <ShadcnCommandItem value="settings" textValue="Settings" keywords="preferences config">
          <span>Settings</span><span className="ml-auto font-mono text-xs text-muted-foreground">⌘S</span>
        </ShadcnCommandItem>
        <ShadcnCommandItem value="shortcuts" textValue="Keyboard Shortcuts" keywords="hotkeys keybindings">
          <span>Keyboard Shortcuts</span><span className="ml-auto font-mono text-xs text-muted-foreground">⌘K</span>
        </ShadcnCommandItem>
        <ShadcnCommandEmpty>No matching shortcuts.</ShadcnCommandEmpty>
      </ShadcnCommandContent>
    </ShadcnCommandRoot>
  </div>
</ShadcnStyleScope>
`);

const shadcnShortcutsVue = formatCode(`
<template>
  <ShadcnStyleScope style-profile="rhea" class="contents">
    <div class="w-full max-w-sm rounded-[var(--pui-radius-3xl)] border border-border bg-popover shadow-md">
      <ShadcnCommandRoot a11y-label="Settings shortcuts">
        <ShadcnCommandInputWrapper>
          <ShadcnInputShell focus-indicator="none">
            <ShadcnCommandInput placeholder="Search settings or keywords..." />
          </ShadcnInputShell>
        </ShadcnCommandInputWrapper>
        <ShadcnCommandContent>
          <ShadcnCommandItem value="profile" text-value="Profile" keywords="account avatar user">
            <span>Profile</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘P</span>
          </ShadcnCommandItem>
          <ShadcnCommandItem value="billing" text-value="Billing" keywords="invoice payment plan">
            <span>Billing</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘B</span>
          </ShadcnCommandItem>
          <ShadcnCommandItem value="settings" text-value="Settings" keywords="preferences config">
            <span>Settings</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘S</span>
          </ShadcnCommandItem>
          <ShadcnCommandItem value="shortcuts" text-value="Keyboard Shortcuts" keywords="hotkeys keybindings">
            <span>Keyboard Shortcuts</span><span class="ml-auto font-mono text-xs text-muted-foreground">⌘K</span>
          </ShadcnCommandItem>
          <ShadcnCommandEmpty>No matching shortcuts.</ShadcnCommandEmpty>
        </ShadcnCommandContent>
      </ShadcnCommandRoot>
    </div>
  </ShadcnStyleScope>
</template>
`);

export const codeMap: Record<RuntimeId, Record<string, string>> = {
  wc: {
    'demo-shadcn-command': shadcnInlineWc,
    'demo-shadcn-command-dialog': shadcnDialogWc,
    'demo-shadcn-command-shortcuts': shadcnShortcutsWc,
    'demo-shadcn-command-groups': shadcnInlineWc,
    'demo-shadcn-command-scrollable': shadcnInlineWc,
    'demo-brutalist-command': brutalist.inlineWc,
    'demo-brutalist-command-dialog': brutalist.dialogWc,
    'demo-brutalist-command-shortcuts': brutalist.shortcutsWc,
    'demo-brutalist-command-scrollable': brutalist.inlineWc,
    'demo-bootstrap-2-3-2-command': bootstrap.inlineWc,
    'demo-bootstrap-2-3-2-command-dialog': bootstrap.dialogWc,
    'demo-bootstrap-2-3-2-command-shortcuts': bootstrap.shortcutsWc,
    'demo-bootstrap-2-3-2-command-scrollable': bootstrap.inlineWc,
    'demo-liquid-glass-command': liquidGlass.inlineWc,
    'demo-liquid-glass-command-dialog': liquidGlass.dialogWc,
    'demo-liquid-glass-command-shortcuts': liquidGlass.shortcutsWc,
    'demo-liquid-glass-command-scrollable': liquidGlass.inlineWc,
  },
  react: {
    'demo-shadcn-command': shadcnInlineReact,
    'demo-shadcn-command-dialog': shadcnDialogReact,
    'demo-shadcn-command-shortcuts': shadcnShortcutsReact,
    'demo-shadcn-command-groups': shadcnInlineReact,
    'demo-shadcn-command-scrollable': shadcnInlineReact,
    'demo-brutalist-command': brutalist.inlineReact,
    'demo-brutalist-command-dialog': brutalist.dialogReact,
    'demo-brutalist-command-shortcuts': brutalist.shortcutsReact,
    'demo-brutalist-command-scrollable': brutalist.inlineReact,
    'demo-bootstrap-2-3-2-command': bootstrap.inlineReact,
    'demo-bootstrap-2-3-2-command-dialog': bootstrap.dialogReact,
    'demo-bootstrap-2-3-2-command-shortcuts': bootstrap.shortcutsReact,
    'demo-bootstrap-2-3-2-command-scrollable': bootstrap.inlineReact,
    'demo-liquid-glass-command': liquidGlass.inlineReact,
    'demo-liquid-glass-command-dialog': liquidGlass.dialogReact,
    'demo-liquid-glass-command-shortcuts': liquidGlass.shortcutsReact,
    'demo-liquid-glass-command-scrollable': liquidGlass.inlineReact,
  },
  vue: {
    'demo-shadcn-command': shadcnInlineVue,
    'demo-shadcn-command-dialog': shadcnDialogVue,
    'demo-shadcn-command-shortcuts': shadcnShortcutsVue,
    'demo-shadcn-command-groups': shadcnInlineVue,
    'demo-shadcn-command-scrollable': shadcnInlineVue,
    'demo-brutalist-command': brutalist.inlineVue,
    'demo-brutalist-command-dialog': brutalist.dialogVue,
    'demo-brutalist-command-shortcuts': brutalist.shortcutsVue,
    'demo-brutalist-command-scrollable': brutalist.inlineVue,
    'demo-bootstrap-2-3-2-command': bootstrap.inlineVue,
    'demo-bootstrap-2-3-2-command-dialog': bootstrap.dialogVue,
    'demo-bootstrap-2-3-2-command-shortcuts': bootstrap.shortcutsVue,
    'demo-bootstrap-2-3-2-command-scrollable': bootstrap.inlineVue,
    'demo-liquid-glass-command': liquidGlass.inlineVue,
    'demo-liquid-glass-command-dialog': liquidGlass.dialogVue,
    'demo-liquid-glass-command-shortcuts': liquidGlass.shortcutsVue,
    'demo-liquid-glass-command-scrollable': liquidGlass.inlineVue,
  },
  vue2: {
    'demo-shadcn-command': shadcnInlineVue,
    'demo-shadcn-command-dialog': shadcnDialogVue,
    'demo-shadcn-command-shortcuts': shadcnShortcutsVue,
    'demo-shadcn-command-groups': shadcnInlineVue,
    'demo-shadcn-command-scrollable': shadcnInlineVue,
    'demo-brutalist-command': brutalist.inlineVue,
    'demo-brutalist-command-dialog': brutalist.dialogVue,
    'demo-brutalist-command-shortcuts': brutalist.shortcutsVue,
    'demo-brutalist-command-scrollable': brutalist.inlineVue,
    'demo-bootstrap-2-3-2-command': bootstrap.inlineVue,
    'demo-bootstrap-2-3-2-command-dialog': bootstrap.dialogVue,
    'demo-bootstrap-2-3-2-command-shortcuts': bootstrap.shortcutsVue,
    'demo-bootstrap-2-3-2-command-scrollable': bootstrap.inlineVue,
    'demo-liquid-glass-command': liquidGlass.inlineVue,
    'demo-liquid-glass-command-dialog': liquidGlass.dialogVue,
    'demo-liquid-glass-command-shortcuts': liquidGlass.shortcutsVue,
    'demo-liquid-glass-command-scrollable': liquidGlass.inlineVue,
  },
};
