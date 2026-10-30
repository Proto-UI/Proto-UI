import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateSiteLocale } from './site-locale-navigation';

describe('shared locale navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/en/docs/?q=search#section');
  });
  it('uses only mapped pathnames, preserving the actual query and fragment', () => {
    expect(navigateSiteLocale(window, 'en', { 'zh-cn': '/zh-cn/docs/' }, 'zh-cn')).toBe(true);
    expect(window.location.pathname).toBe('/zh-cn/docs/');
    expect(window.location.search).toBe('?q=search');
    expect(window.location.hash).toBe('#section');
    expect(localStorage.getItem('preferred-locale')).toBe('zh-cn');
  });
  it.each(['en', 'missing', '__proto__', null])(
    'ignores unchanged or unmapped selection %s',
    (value) => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      expect(
        navigateSiteLocale(window, 'en', { en: '/en/docs/', 'zh-cn': '/zh-cn/docs/' }, value)
      ).toBe(false);
      expect(window.location.pathname).toBe('/en/docs/');
      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    }
  );
  it('rejects an external path even if a malformed map contains it', () => {
    expect(navigateSiteLocale(window, 'en', { foreign: '//example.com/' }, 'foreign')).toBe(false);
  });
  it('does not make optional storage a navigation prerequisite', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(navigateSiteLocale(window, 'en', { 'zh-cn': '/zh-cn/docs/' }, 'zh-cn')).toBe(true);
    expect(window.location.pathname).toBe('/zh-cn/docs/');
    setItem.mockRestore();
  });
});
