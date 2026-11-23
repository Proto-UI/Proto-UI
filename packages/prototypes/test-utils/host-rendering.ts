/** Deliver the real host rendering opportunities used by WC portal conceal.
 * This does not complete a Transition or substitute for a detached-view check.
 */
export async function afterTwoHostFrames(): Promise<void> {
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  );
}
