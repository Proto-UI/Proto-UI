/** Both keys are accepted by the existing document shortcut handler. A neutral
 * hint is identical in server HTML, no-JS and every UA before/after enhancement;
 * it does not need a platform guess followed by a visible client correction. */
export const siteSearchShortcutLabel = (ctrlLabel: string) => `⌘ / ${ctrlLabel} K`;
