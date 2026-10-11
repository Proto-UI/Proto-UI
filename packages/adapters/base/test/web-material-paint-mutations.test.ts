import { afterEach, describe, expect, it } from 'vitest';
import {
  appendOwnedCarrierSheet,
  removeOwnedCarrierSheet,
  withOwnedCarrierMarker,
  isOwnedCarrierMutation,
} from '../src/material/paint-mutations';
afterEach(() => document.body.replaceChildren());
describe('exact carrier mutation ownership; real DOM records, no paint claim', () => {
  it('ignores its own final-state writes without ignoring author marker, sheet content or position edits', () => {
    const host = document.createElement('button');
    document.body.append(host);
    const observer = new MutationObserver(() => {});
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    withOwnedCarrierMarker(host, () =>
      host.setAttribute('data-pui-material-carrier', 'contact-v1')
    );
    withOwnedCarrierMarker(host, () => host.removeAttribute('data-pui-material-carrier'));
    const sheet = document.createElement('style');
    sheet.textContent = '.test { color: red; }';
    appendOwnedCarrierSheet(sheet, document.head);
    removeOwnedCarrierSheet(sheet);
    const own = observer.takeRecords();
    expect(own.length).toBeGreaterThanOrEqual(4);
    expect(own.every(isOwnedCarrierMutation)).toBe(true);
    host.setAttribute('data-pui-material-carrier', 'author');
    expect(observer.takeRecords().some((record) => !isOwnedCarrierMutation(record))).toBe(true);
    appendOwnedCarrierSheet(sheet, document.head);
    observer.takeRecords();
    sheet.firstChild!.textContent = '.test { color: blue; }';
    expect(observer.takeRecords().some((record) => !isOwnedCarrierMutation(record))).toBe(true);
    document.body.append(sheet);
    expect(observer.takeRecords().some((record) => !isOwnedCarrierMutation(record))).toBe(true);
    removeOwnedCarrierSheet(sheet);
    observer.disconnect();
  });
});
