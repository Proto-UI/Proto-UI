export const HOMEPAGE_BASELINE = '1fd4c08a067a8322295c78b2b708d2b4cbc01304';
export const HOMEPAGE_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
export const HOMEPAGE_ROUTES = ['/zh-cn/', '/en/'] as const;
export const HOMEPAGE_POINTER_RUNTIME_SEQUENCE = [
  'react',
  'vue',
  'vue2',
  'wc',
  'react',
  'wc',
] as const;
export const HOMEPAGE_KEYBOARD_TRANSITION = { from: 'react', to: 'vue' } as const;
export const DOCUMENTATION_VARIANTS = [
  { id: 'base-toggle', family: 'base', route: '/zh-cn/ui-libraries/base/toggle/' },
  { id: 'shadcn-radio-group', family: 'shadcn', route: '/zh-cn/ui-libraries/shadcn/radio-group/' },
  {
    id: 'brutalist-tooltip',
    family: 'brutalist',
    route: '/zh-cn/ui-libraries/brutalist/components/tooltip/',
  },
] as const;

export function verifyRevision(actual: string, expected: string, status: string): void {
  if (!/^[a-f0-9]{40}$/.test(expected))
    throw new Error('Expected revision must be a full Git SHA.');
  if (actual !== expected)
    throw new Error(`Revision mismatch: expected ${expected}, got ${actual}.`);
  if (status.trim())
    throw new Error('Evidence requires a clean source worktree before server startup.');
}

export function layoutFailures(
  metrics: {
    viewportWidth: number;
    documentWidth: number;
    bodyWidth: number;
    family?: string;
    fonts: Array<{
      name: string;
      fontFamily: string;
      prototypeId?: string | null;
      styleTokens?: string[];
    }>;
  },
  { requireSansSerif = true } = {}
): string[] {
  const failures: string[] = [];
  if (Math.max(metrics.documentWidth, metrics.bodyWidth) > metrics.viewportWidth + 1) {
    failures.push(
      `Horizontal overflow: ${Math.max(metrics.documentWidth, metrics.bodyWidth)} > ${metrics.viewportWidth}`
    );
  }
  if (!metrics.fonts.some((font) => font.name === 'heading'))
    failures.push('Missing heading font sample.');
  for (const font of metrics.fonts) {
    const intentionalMono =
      metrics.family === 'brutalist' &&
      ['brutalist-button', 'brutalist-textarea-root'].includes(font.prototypeId ?? '') &&
      font.styleTokens?.includes('font-mono') &&
      /monospace/i.test(font.fontFamily);
    const serif = /(?:^|,)\s*serif\s*(?:,|$)|Times New Roman|Noto Serif|Songti|SimSun/i.test(
      font.fontFamily
    );
    if (
      requireSansSerif &&
      (serif || (!intentionalMono && !/(?:sans-serif|system-ui)/i.test(font.fontFamily)))
    ) {
      failures.push(`${font.name} does not inherit a sans-serif stack: ${font.fontFamily}`);
    }
  }
  return failures;
}

/** Only the pinned baseline's reproduced React Select Home failure is a negative control. */
export function classifyHistoricalFailure(input: {
  revisionKind: string;
  route: string;
  stage: string | null;
  errorName: string;
  activeRole?: string | null;
  activeText?: string | null;
  committedRuntime?: string;
}): 'baseline-react-select-home-focus' | 'unexpected' {
  return input.revisionKind === 'baseline' &&
    (input.route === '/zh-cn/' || input.route === '/en/') &&
    input.stage === 'keyboard-home' &&
    input.errorName === 'TimeoutError' &&
    input.activeRole === 'option' &&
    input.activeText?.trim() === 'React' &&
    input.committedRuntime === 'react'
    ? 'baseline-react-select-home-focus'
    : 'unexpected';
}

/** Keep the serialized browser snapshot and its classification on one typed boundary. */
export function classifyCapturedFailure(input: {
  revisionKind: string;
  route: string;
  stage: string | null;
  errorName: string;
  failureState: {
    activeElement: { role: string | null; text?: string } | null;
    home?: { runnerRuntime?: string };
  } | null;
}): ReturnType<typeof classifyHistoricalFailure> {
  return classifyHistoricalFailure({
    ...input,
    activeRole: input.failureState?.activeElement?.role,
    activeText: input.failureState?.activeElement?.text,
    committedRuntime: input.failureState?.home?.runnerRuntime,
  });
}
