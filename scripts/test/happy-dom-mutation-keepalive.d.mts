export function retainHappyDomMutationCallbacks(view: {
  MutationObserver: typeof MutationObserver;
  happyDOM?: unknown;
}): {
  retainedCount(): number;
  restore(): void;
};
