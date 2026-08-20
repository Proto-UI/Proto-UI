const HELP_TEXT = `proto-ui

Usage:
  proto-ui [--help|-h|help]
  proto-ui init [--prototypes <shadcn|brutalist>] [--root-dir <dir>] [--styles-dir <dir>] [--no-styles] [--no-interactive] [--yes|-y]
  proto-ui add <host> <component> [--root-dir <dir>] [--no-install] [--no-interactive]

Core commands:
  init              Create ./proto-ui, write config, and optionally generate style preset files
  add               Install adapter/prototype packages and generate component facade exports

Style commands:
  proto-ui shadcn --styles-dir ./src/styles
  proto-ui tokens --input ./packages/prototypes --out ./src/styles/proto-ui-tokens.generated.css
  proto-ui style --out ./src/styles/proto-ui-style.css
  proto-ui theme shadcn --out ./src/styles/shadcn-theme.css

Examples:
  proto-ui init
  proto-ui init --no-styles
  proto-ui init --prototypes brutalist
  proto-ui add react shadcn-button
  proto-ui add wc shadcn-button --no-install
`;

const COMMAND_HELP: Record<string, string> = {
  init: `proto-ui init

Usage:
  proto-ui init [--prototypes <shadcn|brutalist>] [--root-dir <dir>] [--styles-dir <dir>] [--no-styles] [--no-tailwind] [--no-interactive] [--yes|-y]

Behavior:
  - creates ./proto-ui by default
  - writes proto-ui/config.json
  - creates proto-ui/components, proto-ui/adapters, proto-ui/prototypes
  - generates style preset files unless disabled
  - configures one project-wide style preset (default: shadcn)

Options:
  --root-dir <dir>        Custom Proto UI workspace root (default: ./proto-ui)
  --styles-dir <dir>      Where style preset files are written (default: ./src/styles)
  --prototypes <preset>   Project-wide style preset: shadcn or brutalist
  --no-styles             Skip style preset generation
  --no-tailwind           Alias of --no-styles
  --no-interactive        Never prompt
  --yes, -y               Accept defaults without prompting
`,
  add: `proto-ui add

Usage:
  proto-ui add <host> <component> [--root-dir <dir>] [--no-install] [--no-interactive]

Examples:
  proto-ui add react shadcn-button
  proto-ui add vue shadcn-button
  proto-ui add wc shadcn-button --no-install

Behavior:
  - reads proto-ui/config.json
  - checks host runtime requirements
  - installs Proto UI adapter/prototype packages unless --no-install is used
  - generates proto-ui/components/<host>/index.ts
  - updates proto-ui/components/index.ts
  - when styles are enabled, rejects components that require a different project-wide preset
  - with --no-styles, reports that the application owns the required semantic tokens
  - never replaces the configured style preset automatically
`,
};

export function printHelp(): void {
  console.log(HELP_TEXT);
}

export function printCommandHelp(command: string): void {
  const text = COMMAND_HELP[command];
  if (!text) {
    printHelp();
    return;
  }
  console.log(text);
}
