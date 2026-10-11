import type { NativeLinkConfig, NativeLinkSnapshot } from '@proto.ui/core';

/** URL assignment is not HTML parsing. Keep relative app routes and safe URI schemes. */
export function normalizeNativeLinkConfig(config: NativeLinkConfig): NativeLinkSnapshot {
  let href = typeof config.href === 'string' ? config.href.trim() : '';
  // Browsers strip embedded tab/newline and leading C0 before scheme parsing.
  // Reject controls rather than accepting an obfuscated executable protocol.
  if (/[\u0000-\u001f\u007f]/.test(href)) href = '';
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(href)?.[1].toLowerCase();
  if (scheme && !['http', 'https', 'mailto', 'tel', 'sms', 'ftp', 'ftps'].includes(scheme))
    href = '';
  let target = typeof config.target === 'string' ? config.target : '';
  if (/[\u0000-\u0020\u007f<>]/.test(target)) target = '';
  const rel = (typeof config.rel === 'string' ? config.rel : '').split(/\s+/).filter(Boolean);
  if (
    target.toLowerCase() === '_blank' &&
    !rel.some((token) => token.toLowerCase() === 'noopener')
  ) {
    rel.push('noopener');
  }
  return Object.freeze({ href, target, rel: rel.join(' '), disabled: config.disabled === true });
}
