export interface HappyDomTextWalkerCorrection {
  restore(): void;
}

export function repairHappyDomTextWalker(
  view: {
    NodeFilter: typeof NodeFilter;
    Node: typeof Node;
    happyDOM?: unknown;
  },
  root: HTMLElement
): HappyDomTextWalkerCorrection;
