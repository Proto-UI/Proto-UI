export interface HappyDomTextWalkerCorrection { restore(): void; }
export function repairHappyDomTextWalker(window: Window, root: Node): HappyDomTextWalkerCorrection;
