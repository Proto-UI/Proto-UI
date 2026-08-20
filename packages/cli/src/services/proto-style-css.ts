const PUI_STYLE_ATTR = 'data-pui-style';
const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const SYSTEM_THEME_FALLBACK_ROOT =
  ":root:not(.dark):not(.light):not([data-theme='dark']):not([data-theme='light'])";

type CssRule = {
  token: string;
  css: string[];
};

const spacing: Record<string, string> = {
  '0': '0px',
  px: '1px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '11': '2.75rem',
  '12': '3rem',
  '16': '4rem',
  '32': '8rem',
  '64': '16rem',
  '28': '7rem',
  '56': '14rem',
  '80': '20rem',
};

const colorVars = new Set([
  'accent',
  'accent-foreground',
  'background',
  'border',
  'destructive',
  'destructive-foreground',
  'foreground',
  'input',
  'muted',
  'muted-foreground',
  'main',
  'main-foreground',
  'overlay',
  'secondary-background',
  'primary',
  'primary-foreground',
  'popover',
  'popover-foreground',
  'ring',
  'secondary',
  'secondary-foreground',
  'canary',
  'canary-foreground',
  'mint',
  'mint-foreground',
  'lavender',
  'lavender-foreground',
  'coral',
  'coral-foreground',
  'sky',
  'sky-foreground',
]);

const staticUtilities: Record<string, string[]> = {
  absolute: ['position: absolute;'],
  fixed: ['position: fixed;'],
  relative: ['position: relative;'],
  block: ['display: block;'],
  flex: ['display: flex;'],
  'inline-flex': ['display: inline-flex;'],
  'flex-1': ['flex: 1 1 0%;'],
  grid: ['display: grid;'],
  hidden: ['display: none;'],
  'flex-col': ['flex-direction: column;'],
  'flex-row': ['flex-direction: row;'],
  'flex-col-reverse': ['flex-direction: column-reverse;'],
  'items-center': ['align-items: center;'],
  'items-start': ['align-items: flex-start;'],
  'items-end': ['align-items: flex-end;'],
  'justify-center': ['justify-content: center;'],
  'justify-between': ['justify-content: space-between;'],
  'justify-end': ['justify-content: flex-end;'],
  'shrink-0': ['flex-shrink: 0;'],
  'self-start': ['align-self: flex-start;'],
  'pointer-events-none': ['pointer-events: none;'],
  'cursor-not-allowed': ['cursor: not-allowed;'],
  'cursor-default': ['cursor: default;'],
  'cursor-pointer': ['cursor: pointer;'],
  'select-none': ['user-select: none;'],
  'outline-none': ['outline: 2px solid transparent;', 'outline-offset: 2px;'],
  'outline-1': ['outline-style: solid;', 'outline-width: 1px;'],
  'outline-ring': ['outline-color: var(--pui-ring);'],
  'aspect-square': ['aspect-ratio: 1 / 1;'],
  'overflow-auto': ['overflow: auto;'],
  'touch-none': ['touch-action: none;'],
  'object-cover': ['object-fit: cover;'],
  'fill-foreground': ['fill: var(--pui-foreground);'],
  'overflow-hidden': ['overflow: hidden;'],
  'overflow-x-hidden': ['overflow-x: hidden;'],
  'overflow-y-auto': ['overflow-y: auto;'],
  'resize-y': ['resize: vertical;'],
  'whitespace-nowrap': ['white-space: nowrap;'],
  'bg-clip-padding': ['background-clip: padding-box;'],
  'will-change-transform': ['will-change: transform;'],
  'animate-in': [
    'animation-name: pui-enter;',
    'animation-duration: var(--pui-animation-duration, 150ms);',
    'animation-timing-function: ease;',
    'animation-fill-mode: both;',
  ],
  'animate-out': [
    'animation-name: pui-exit;',
    'animation-duration: var(--pui-animation-duration, 150ms);',
    'animation-timing-function: ease;',
    'animation-fill-mode: both;',
  ],
  'fade-in-0': ['--pui-enter-opacity: 0;'],
  'fade-out-0': ['--pui-exit-opacity: 0;'],
  'zoom-in-95': ['--pui-enter-scale: 0.95;'],
  'zoom-out-95': ['--pui-exit-scale: 0.95;'],
  'slide-in-from-bottom-2': ['--pui-translate-y: 0.5rem;'],
  'slide-in-from-left-2': ['--pui-translate-x: -0.5rem;'],
  'slide-in-from-right-2': ['--pui-translate-x: 0.5rem;'],
  'slide-in-from-top-2': ['--pui-translate-y: -0.5rem;'],
  'transition-all': ['transition-property: all;'],
  'transition-[color,box-shadow]': ['transition-property: color, box-shadow;'],
  'transition-opacity': ['transition-property: opacity;'],
  'transition-none': ['transition-property: none;'],
  'transition-colors': [
    'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;',
  ],
  'duration-150': ['transition-duration: 150ms;', '--pui-animation-duration: 150ms;'],
  'duration-200': ['transition-duration: 200ms;', '--pui-animation-duration: 200ms;'],
  'ease-in-out': ['transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);'],
  'font-medium': ['font-weight: 500;'],
  'font-black': ['font-weight: 900;'],
  'font-heading': ['font-family: var(--pui-font-heading, ui-sans-serif, system-ui, sans-serif);'],
  'font-semibold': ['font-weight: 600;'],
  'font-bold': ['font-weight: 700;'],
  'font-mono': [
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;',
  ],
  uppercase: ['text-transform: uppercase;'],
  'leading-6': ['line-height: 1.5rem;'],
  'leading-relaxed': ['line-height: 1.625;'],
  'leading-none': ['line-height: 1;'],
  'tracking-tight': ['letter-spacing: -0.025em;'],
  'text-left': ['text-align: left;'],
  'text-xs': ['font-size: 0.75rem;', 'line-height: 1rem;'],
  'text-sm': ['font-size: 0.875rem;', 'line-height: 1.25rem;'],
  'text-base': ['font-size: 1rem;', 'line-height: 1.5rem;'],
  'text-lg': ['font-size: 1.125rem;', 'line-height: 1.75rem;'],
  'text-[0.8rem]': ['font-size: 0.8rem;'],
  'text-xl': ['font-size: 1.25rem;', 'line-height: 1.75rem;'],
  underline: ['text-decoration-line: underline;'],
  'underline-offset-4': ['text-underline-offset: 4px;'],
  border: ['border-width: 1px;', 'border-style: solid;'],
  'border-2': ['border-width: 2px;', 'border-style: solid;'],
  'border-b-2': ['border-bottom-width: 2px;', 'border-bottom-style: solid;'],
  'border-t-2': ['border-top-width: 2px;', 'border-top-style: solid;'],
  'border-b': ['border-bottom-width: 1px;', 'border-bottom-style: solid;'],
  'border-l-2': ['border-left-width: 2px;', 'border-left-style: solid;'],
  'border-ink': ['border-color: var(--pui-foreground);'],
  'border-black': ['border-color: #000;'],
  'border-foreground': ['border-color: var(--pui-foreground);'],
  'border-transparent': ['border-color: transparent;'],
  'bg-transparent': ['background-color: transparent;'],
  'bg-black': ['background-color: #000;'],
  'bg-foreground': ['background-color: var(--pui-foreground);'],
  'bg-canvas': ['background-color: var(--pui-background);'],
  'bg-paper': ['background-color: var(--pui-background);'],
  'bg-card': ['background-color: var(--pui-card);'],
  'bg-gray-100': ['background-color: #f3f4f6;'],
  'bg-gray-200': ['background-color: #e5e7eb;'],
  'bg-yellow-300': ['background-color: #fde047;'],
  'text-ink': ['color: var(--pui-foreground);'],
  'text-card-foreground': ['color: var(--pui-card-foreground);'],
  'text-gray-500': ['color: #6b7280;'],
  'inset-0': ['inset: 0px;'],
  'bottom-0': ['bottom: 0px;'],
  'bottom-full': ['bottom: 100%;'],
  'left-auto': ['left: auto;'],
  'right-0': ['right: 0px;'],
  'right-full': ['right: 100%;'],
  'top-auto': ['top: auto;'],
  'opacity-70': ['opacity: 0.7;'],
  'opacity-100': ['opacity: 1;'],
  'opacity-50': ['opacity: 0.5;'],
  'ring-inset': ['--pui-ring-inset: inset;'],
  'ring-0': ['--pui-ring-width: 0px;', ...ringShadow()],
  'ring-2': ['--pui-ring-width: 2px;', ...ringShadow()],
  'ring-3': ['--pui-ring-width: 3px;', ...ringShadow()],
  'ring-offset-0': ['--pui-ring-offset-width: 0px;'],
  'ring-offset-2': ['--pui-ring-offset-width: 2px;'],
  'ring-offset-background': ['--pui-ring-offset-color: var(--pui-background);'],
  'shadow-xs': ['--pui-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);', ...composedShadow()],
  'shadow-sm': [
    '--pui-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);',
    ...composedShadow(),
  ],
  'shadow-md': [
    '--pui-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);',
    ...composedShadow(),
  ],
  'shadow-lg': [
    '--pui-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);',
    ...composedShadow(),
  ],
  'shadow-[3px_3px_0_0_#000]': ['--pui-shadow: 3px 3px 0 0 #000;', ...composedShadow()],
  'shadow-[4px_4px_0_0_#000]': ['--pui-shadow: 4px 4px 0 0 #000;', ...composedShadow()],
  'shadow-[6px_6px_0_0_#000]': ['--pui-shadow: 6px 6px 0 0 #000;', ...composedShadow()],
  'shadow-[-3px_3px_0_0_#000]': ['--pui-shadow: -3px 3px 0 0 #000;', ...composedShadow()],
  'shadow-[inset_0_0_0_2px_#000,3px_3px_0_0_#000]': [
    '--pui-shadow: inset 0 0 0 2px #000, 3px 3px 0 0 #000;',
    ...composedShadow(),
  ],
  'shadow-[inset_0_0_0_2px_#000]': ['--pui-shadow: inset 0 0 0 2px #000;', ...composedShadow()],
  'shadow-[2px_2px_0_0_var(--pui-foreground)]': [
    '--pui-shadow: 2px 2px 0 0 var(--pui-foreground);',
    ...composedShadow(),
  ],
  'shadow-[3px_3px_0_0_var(--pui-foreground)]': [
    '--pui-shadow: 3px 3px 0 0 var(--pui-foreground);',
    ...composedShadow(),
  ],
  'shadow-[4px_4px_0_0_var(--pui-foreground)]': [
    '--pui-shadow: 4px 4px 0 0 var(--pui-foreground);',
    ...composedShadow(),
  ],
  'shadow-[6px_6px_0_0_var(--pui-foreground)]': [
    '--pui-shadow: 6px 6px 0 0 var(--pui-foreground);',
    ...composedShadow(),
  ],
  'shadow-[-3px_3px_0_0_var(--pui-foreground)]': [
    '--pui-shadow: -3px 3px 0 0 var(--pui-foreground);',
    ...composedShadow(),
  ],
  'shadow-none': ['--pui-shadow: 0 0 #0000;', ...composedShadow()],
  'shadow-hard': ['--pui-shadow: 2px 2px 0 0 var(--pui-foreground);', ...composedShadow()],
  'backdrop-blur-xs': ['backdrop-filter: blur(4px);'],
  'z-40': ['z-index: 40;'],
  'z-50': ['z-index: 50;'],
  'max-w-lg': ['max-width: 32rem;'],
  'max-w-[75%]': ['max-width: 75%;'],
  'ml-auto': ['margin-left: auto;'],
  'w-fit': ['width: fit-content;'],
  peer: [],
  'group/button': [],
  'group/toggle': [],
  'group/brutalist-dialog-trigger': [],
  'group/brutalist-button': [],
  'group/brutalist-toggle': [],
};

export function renderProtoStyleTokenCss(tokens: string[]): string {
  const rules: CssRule[] = [];
  const unknown: string[] = [];

  for (const token of tokens) {
    const rule = renderTokenRule(token);
    if (rule) rules.push(rule);
    else unknown.push(token);
  }

  const lines = [
    '/* This file is auto-generated by @proto.ui/cli (proto-ui tokens). */',
    '/* Do not edit by hand. */',
    '',
    `[${PUI_STYLE_ATTR}],`,
    `[${PUI_STYLE_ATTR}]::before,`,
    `[${PUI_STYLE_ATTR}]::after {`,
    '  box-sizing: border-box;',
    '}',
    '',
    '@layer proto-ui {',
  ];

  if (
    rules.some((rule) => {
      const utility = splitVariants(rule.token).at(-1);
      return utility === 'animate-in' || utility === 'animate-out';
    })
  ) {
    lines.push(
      '  @keyframes pui-enter {',
      '    from {',
      '      opacity: var(--pui-enter-opacity, 1);',
      '      transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-enter-scale, 1));',
      '    }',
      '  }',
      '',
      '  @keyframes pui-exit {',
      '    to {',
      '      opacity: var(--pui-exit-opacity, 1);',
      '      transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-exit-scale, 1));',
      '    }',
      '  }',
      ''
    );
  }

  for (const rule of rules) {
    const selectors = buildSelectors(rule.token);
    if (selectors.length === 0 || rule.css.length === 0) continue;
    lines.push(`  ${selectors.join(',\n  ')} {`);
    for (const decl of rule.css) lines.push(`    ${decl}`);
    lines.push('  }');
    lines.push('');
  }

  const systemDarkRules = rules.filter((rule) => hasDarkVariant(rule.token));
  if (systemDarkRules.length > 0) {
    lines.push(`  @media ${SYSTEM_DARK_MEDIA_QUERY} {`);
    for (const rule of systemDarkRules) {
      const selectors = buildSelectors(rule.token, { systemPreferenceFallback: true });
      if (selectors.length === 0 || rule.css.length === 0) continue;
      lines.push(`    ${selectors.join(',\n    ')} {`);
      for (const decl of rule.css) lines.push(`      ${decl}`);
      lines.push('    }');
      lines.push('');
    }
    lines.push('  }');
    lines.push('');
  }

  if (unknown.length > 0) {
    lines.push('  /* Unsupported Proto UI style tokens:');
    for (const token of unknown) lines.push(`   * - ${token}`);
    lines.push('   */');
    lines.push('');
  }

  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

export function renderProtoStyleEntryCss({
  themeImport,
  tokensImport,
}: {
  themeImport: string;
  tokensImport: string;
}): string {
  return [
    '/* This file is auto-generated by @proto.ui/cli. */',
    '/* Do not edit by hand. */',
    '',
    `@import '${themeImport}';`,
    `@import '${tokensImport}';`,
    '',
  ].join('\n');
}

export function renderPrefixedThemeCss(input: string): string {
  const variableNames = new Set<string>();
  input.replace(/--([a-z0-9-]+)\s*:/g, (_match, name: string) => {
    variableNames.add(name);
    return '';
  });

  let css = input.replace(/--([a-z0-9-]+)\s*:/g, '--pui-$1:');
  css = css.replace(/var\(--([a-z0-9-]+)\)/g, (match, name: string) => {
    return variableNames.has(name) ? `var(--pui-${name})` : match;
  });
  css = css.replace(/var\(--color-blue-300\)/g, '#93c5fd');
  css = css.replace(/var\(--color-blue-500\)/g, '#3b82f6');
  css = css.replace(/var\(--color-blue-600\)/g, '#2563eb');
  css = css.replace(/var\(--color-blue-700\)/g, '#1d4ed8');
  css = css.replace(/var\(--color-blue-800\)/g, '#1e40af');
  css = css.replace(
    /(--pui-radius:\s*[^;]+;)/,
    [
      '$1',
      '    --pui-radius-xl: calc(var(--pui-radius) + 4px);',
      '    --pui-radius-lg: var(--pui-radius);',
      '    --pui-radius-md: max(calc(var(--pui-radius) - 2px), 0px);',
      '    --pui-radius-sm: max(calc(var(--pui-radius) - 4px), 0px);',
    ].join('\n')
  );

  css = appendSystemDarkThemeFallback(css);

  return `${css.trimEnd()}\n`;
}

function appendSystemDarkThemeFallback(css: string): string {
  const darkRule = css.match(
    /:root\.dark,\s*:root\[data-theme=(?:'dark'|"dark")\]\s*\{([\s\S]*?)\n\s*\}/
  );
  if (!darkRule) return css;

  const declarations = (darkRule[1] ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (declarations.length === 0) return css;

  return [
    css.trimEnd(),
    '',
    `@media ${SYSTEM_DARK_MEDIA_QUERY} {`,
    `  ${SYSTEM_THEME_FALLBACK_ROOT} {`,
    ...declarations.map((declaration) => `    ${declaration}`),
    '  }',
    '}',
  ].join('\n');
}

function renderTokenRule(token: string): CssRule | null {
  const parts = splitVariants(token);
  const utility = parts[parts.length - 1] ?? token;
  const css = renderUtility(utility);
  if (!css) return null;
  return { token, css };
}

function renderUtility(utility: string): string[] | null {
  if (utility in staticUtilities) return staticUtilities[utility] ?? [];

  const spacingRule = renderSpacingUtility(utility);
  if (spacingRule) return spacingRule;

  const colorRule = renderColorUtility(utility);
  if (colorRule) return colorRule;

  const roundedRule = renderRoundedUtility(utility);
  if (roundedRule) return roundedRule;

  const transformRule = renderTransformUtility(utility);
  if (transformRule) return transformRule;

  return null;
}

function renderSpacingUtility(utility: string): string[] | null {
  const spacingMatch = utility.match(
    /^(gap|h|w|min-h|min-w|max-h|size|p|px|py|pl|pr|pt|pb|mt|mb|ml|mr|top|left|right)-(.+)$/
  );
  if (!spacingMatch) return null;
  const [, kind, rawValue] = spacingMatch;
  const value = spacingValue(rawValue);
  if (!value) return null;

  if (kind === 'gap') return [`gap: ${value};`];
  if (kind === 'h') return [`height: ${value};`];
  if (kind === 'w') return [`width: ${value};`];
  if (kind === 'min-h') return [`min-height: ${value};`];
  if (kind === 'min-w') return [`min-width: ${value};`];
  if (kind === 'max-h') return [`max-height: ${value};`];
  if (kind === 'size') return [`width: ${value};`, `height: ${value};`];
  if (kind === 'p') return [`padding: ${value};`];
  if (kind === 'px') return [`padding-inline: ${value};`];
  if (kind === 'py') return [`padding-block: ${value};`];
  if (kind === 'pl') return [`padding-left: ${value};`];
  if (kind === 'pr') return [`padding-right: ${value};`];
  if (kind === 'pt') return [`padding-top: ${value};`];
  if (kind === 'pb') return [`padding-bottom: ${value};`];
  if (kind === 'mt') return [`margin-top: ${value};`];
  if (kind === 'mb') return [`margin-bottom: ${value};`];
  if (kind === 'ml') return [`margin-left: ${value};`];
  if (kind === 'mr') return [`margin-right: ${value};`];
  if (kind === 'top') return [`top: ${value};`];
  if (kind === 'right') return [`right: ${value};`];
  if (kind === 'left') return [`left: ${value};`];
  return null;
}

function renderColorUtility(utility: string): string[] | null {
  if (utility === 'bg-black/50') return ['background-color: rgb(0 0 0 / 0.5);'];
  if (utility === 'bg-black/80') return ['background-color: rgb(0 0 0 / 0.8);'];

  const colorMatch = utility.match(/^(bg|text|border|ring|ring-offset)-([a-z-]+)(?:\/(\d+))?$/);
  if (!colorMatch) return null;
  const [, kind, name, opacity] = colorMatch;
  if (!colorVars.has(name)) return null;
  const color = colorValue(name, opacity);

  if (kind === 'bg') return [`background-color: ${color};`];
  if (kind === 'text') return [`color: ${color};`];
  if (kind === 'border') return [`border-color: ${color};`];
  if (kind === 'ring') return [`--pui-ring-color: ${color};`, ...ringShadow()];
  if (kind === 'ring-offset') return [`--pui-ring-offset-color: ${color};`];
  return null;
}

function renderRoundedUtility(utility: string): string[] | null {
  if (utility === 'rounded-none') return ['border-radius: 0;'];
  if (utility === 'rounded-full') return ['border-radius: 9999px;'];
  if (utility === 'rounded-xl') return ['border-radius: var(--pui-radius-xl);'];
  if (utility === 'rounded-lg') return ['border-radius: var(--pui-radius-lg);'];
  if (utility === 'rounded-md') return ['border-radius: var(--pui-radius-md);'];
  if (utility === 'rounded-sm') return ['border-radius: var(--pui-radius-sm);'];
  if (utility === 'rounded-[min(var(--radius-md),12px)]') {
    return ['border-radius: min(var(--pui-radius-md), 12px);'];
  }
  return null;
}

function renderTransformUtility(utility: string): string[] | null {
  if (utility === '-translate-x-1/2') return ['--pui-translate-x: -50%;', transformValue()];
  if (utility === '-translate-y-1/2') return ['--pui-translate-y: -50%;', transformValue()];
  if (utility === 'translate-x-0') return ['--pui-translate-x: 0px;', transformValue()];
  if (utility === 'translate-y-0') return ['--pui-translate-y: 0px;', transformValue()];
  if (utility === 'translate-y-px') return ['--pui-translate-y: 1px;', transformValue()];
  if (utility === 'translate-x-px') return ['--pui-translate-x: 1px;', transformValue()];
  if (utility === '-translate-x-px') return ['--pui-translate-x: -1px;', transformValue()];
  if (utility === '-translate-y-px') return ['--pui-translate-y: -1px;', transformValue()];

  const translateMatch = utility.match(/^translate-(x|y)-(.+)$/);
  if (translateMatch) {
    const [, axis, rawValue] = translateMatch;
    const value = spacingValue(rawValue);
    if (value) return [`--pui-translate-${axis}: ${value};`, transformValue()];
  }

  const scaleMatch = utility.match(/^scale-\[(.+)\]$/);
  if (scaleMatch)
    return [
      `--pui-scale-x: ${scaleMatch[1]};`,
      `--pui-scale-y: ${scaleMatch[1]};`,
      transformValue(),
    ];

  return null;
}

function buildSelectors(
  token: string,
  { systemPreferenceFallback = false }: { systemPreferenceFallback?: boolean } = {}
): string[] {
  const parts = splitVariants(token);
  const variants = parts.slice(0, -1);
  let selectors = [`:where([${PUI_STYLE_ATTR}~="${escapeCssString(token)}"])`];
  let dark = false;

  for (const variant of variants) {
    if (variant === 'dark') {
      dark = true;
      continue;
    }
    selectors = selectors.flatMap((selector) => applyVariant(selector, variant));
  }

  if (dark) {
    if (systemPreferenceFallback) {
      return selectors.map((selector) => `:where(${SYSTEM_THEME_FALLBACK_ROOT}) ${selector}`);
    }

    selectors = selectors.flatMap((selector) => [
      `:where(.dark) ${selector}`,
      `:where(.dark)${selector}`,
      `:where([data-theme='dark']) ${selector}`,
      `:where([data-theme='dark'])${selector}`,
    ]);
  }

  return selectors;
}

function hasDarkVariant(token: string): boolean {
  return splitVariants(token).slice(0, -1).includes('dark');
}

function applyVariant(selector: string, variant: string): string[] {
  if (variant === 'hover') return [`${selector}:hover`];
  if (variant === 'active') return [`${selector}:active`];
  if (variant === 'disabled') return [`${selector}:disabled`];
  if (variant === 'focus-visible') return [`${selector}:focus-visible`];
  if (variant === 'placeholder') return [`${selector}::placeholder`];

  const notDataMatch = variant.match(/^not-\[data-([a-zA-Z0-9-]+)\]$/);
  if (notDataMatch) {
    return [`${selector}:not([data-${notDataMatch[1]}])`];
  }

  if (variant.startsWith('aria-')) {
    const name = variant.slice('aria-'.length);
    return [`${selector}[aria-${name}='true']`];
  }

  const dataMatch = variant.match(/^data-\[(.+)\]$/);
  if (dataMatch) {
    const body = dataMatch[1] ?? '';
    const eq = body.indexOf('=');
    if (eq >= 0) {
      const name = body.slice(0, eq);
      const value = body.slice(eq + 1).replace(/^['\"]|['\"]$/g, '');
      return [`${selector}[data-${name}='${escapeCssString(value)}']`];
    }
    return [`${selector}[data-${body}]`];
  }

  return [selector];
}

function splitVariants(token: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of token) {
    if (char === '[') depth += 1;
    if (char === ']') depth = Math.max(0, depth - 1);
    if (char === ':' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  parts.push(current);
  return parts.filter(Boolean);
}

function spacingValue(raw: string): string | null {
  if (raw === 'fit') return 'fit-content';
  if (raw === 'full') return '100%';
  if (raw === '1/2') return '50%';
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1).replaceAll('_', ' ');
  return spacing[raw] ?? null;
}

function colorValue(name: string, opacity?: string): string {
  const base = `var(--pui-${name})`;
  if (!opacity) return base;
  return `color-mix(in oklab, ${base} ${Number(opacity)}%, transparent)`;
}

function ringShadow(): string[] {
  return [
    '--pui-ring-offset-shadow: 0 0 0 var(--pui-ring-offset-width, 0px) var(--pui-ring-offset-color, #fff);',
    '--pui-ring-shadow: var(--pui-ring-inset,) 0 0 0 calc(var(--pui-ring-width, 0px) + var(--pui-ring-offset-width, 0px)) var(--pui-ring-color, var(--pui-ring));',
    ...composedShadow(),
  ];
}

function composedShadow(): string[] {
  return [
    'box-shadow: var(--pui-ring-offset-shadow, 0 0 #0000), var(--pui-ring-shadow, 0 0 #0000), var(--pui-shadow, 0 0 #0000);',
  ];
}

function transformValue() {
  return [
    'transform: translate(var(--pui-translate-x, 0), var(--pui-translate-y, 0)) scale(var(--pui-scale-x, 1), var(--pui-scale-y, 1));',
  ].join('');
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
