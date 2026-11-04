/**
 * Opt-in Shadcn website typography preset. This is a consumer theme input,
 * not a font loader or a change to the default passive Surface contract.
 * Geist bytes and licensing are supplied by the consuming application.
 * The fallback tail is deliberate: Geist has no CJK coverage.
 */
const sans =
  '"Geist", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

export const SHADCN_TYPOGRAPHY = Object.freeze({
  'font-sans': sans,
  'font-heading': sans,
});
